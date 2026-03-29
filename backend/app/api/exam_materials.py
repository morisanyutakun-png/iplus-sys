from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select, delete, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.exam import ExamMaterial, ExamSubject
from app.models.material import Material, MaterialNode
from app.services.pdf_store import upsert_pdf_blob
from app.schemas.exam import (
    ExamMaterialCreate,
    ExamMaterialOut,
    ExamSubjectCreate,
    ExamSubjectOut,
)

router = APIRouter()


def _make_material_key(exam_name: str, subject_name: str) -> str:
    """Generate a material key for an exam subject."""
    return f"試験:{exam_name}:{subject_name}"


def _make_node_key(exam_name: str, subject_name: str) -> str:
    """Generate a node key for an exam subject."""
    return f"試験:{exam_name}:{subject_name}:001"


@router.get("", response_model=list[ExamMaterialOut])
async def list_exam_materials(
    exam_type: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(ExamMaterial).options(selectinload(ExamMaterial.subjects)).order_by(ExamMaterial.sort_order)
    if exam_type:
        q = q.where(ExamMaterial.exam_type == exam_type)
    result = await db.execute(q)
    materials = result.scalars().unique().all()
    return [ExamMaterialOut.model_validate(m) for m in materials]


@router.post("", response_model=ExamMaterialOut)
async def create_exam_material(body: ExamMaterialCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(ExamMaterial).where(ExamMaterial.name == body.name))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="同じ名前の試験が既に存在します")

    max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(ExamMaterial.sort_order), 0))
    )
    max_order = max_result.scalar()

    exam_mat = ExamMaterial(
        name=body.name,
        exam_type=body.exam_type,
        year=body.year,
        university=body.university,
        faculty=body.faculty,
        exam_period=body.exam_period,
        sort_order=max_order + 1,
    )
    db.add(exam_mat)
    await db.flush()  # Get exam_mat.id

    # Get max sort_order for materials table
    mat_max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(Material.sort_order), 0))
    )
    mat_sort_order = mat_max_result.scalar()

    # Create Material + MaterialNode for each subject
    for idx, subj in enumerate(body.subjects):
        mat_key = _make_material_key(body.name, subj.subject_name)
        node_key = _make_node_key(body.name, subj.subject_name)
        mat_sort_order += 1

        # Create Material (linked to exam via exam_material_id)
        material = Material(
            key=mat_key,
            name=f"{body.name} {subj.subject_name}",
            subject=subj.subject_name,
            exam_material_id=exam_mat.id,
            sort_order=mat_sort_order,
        )
        db.add(material)

        # Create single MaterialNode (for PDF attachment)
        node = MaterialNode(
            key=node_key,
            material_key=mat_key,
            title=subj.subject_name,
            range_text=f"{body.name}",
            sort_order=1,
        )
        db.add(node)

        # Create ExamSubject with node_key link
        exam_subj = ExamSubject(
            exam_material_id=exam_mat.id,
            subject_name=subj.subject_name,
            max_score=subj.max_score,
            sort_order=idx + 1,
            node_key=node_key,
        )
        db.add(exam_subj)

    await db.commit()
    await db.refresh(exam_mat)
    return ExamMaterialOut.model_validate(exam_mat)


@router.get("/{material_id}", response_model=ExamMaterialOut)
async def get_exam_material(material_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamMaterial)
        .where(ExamMaterial.id == material_id)
        .options(selectinload(ExamMaterial.subjects))
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="試験が見つかりません")
    return ExamMaterialOut.model_validate(material)


@router.delete("/{material_id}")
async def delete_exam_material(material_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ExamMaterial).where(ExamMaterial.id == material_id))
    exam_mat = result.scalars().first()
    if not exam_mat:
        raise HTTPException(status_code=404, detail="試験が見つかりません")

    # Delete linked Materials (cascade will handle nodes, student_materials, etc.)
    linked_result = await db.execute(
        select(Material).where(Material.exam_material_id == material_id)
    )
    linked_materials = linked_result.scalars().all()
    for mat in linked_materials:
        await db.execute(delete(Material).where(Material.key == mat.key))

    # Delete exam material (cascade handles subjects, scores, assignments)
    await db.execute(delete(ExamMaterial).where(ExamMaterial.id == material_id))
    await db.commit()
    return {"status": "deleted", "materials_removed": len(linked_materials)}


@router.post("/{material_id}/subjects", response_model=ExamSubjectOut)
async def add_subject(
    material_id: int, body: ExamSubjectCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ExamMaterial).where(ExamMaterial.id == material_id)
    )
    exam_mat = result.scalars().first()
    if not exam_mat:
        raise HTTPException(status_code=404, detail="試験が見つかりません")

    max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(ExamSubject.sort_order), 0))
        .where(ExamSubject.exam_material_id == material_id)
    )
    max_order = max_result.scalar()

    # Create corresponding Material + MaterialNode
    mat_key = _make_material_key(exam_mat.name, body.subject_name)
    node_key = _make_node_key(exam_mat.name, body.subject_name)

    mat_max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(Material.sort_order), 0))
    )
    mat_sort_order = mat_max_result.scalar() + 1

    material = Material(
        key=mat_key,
        name=f"{exam_mat.name} {body.subject_name}",
        subject=body.subject_name,
        exam_material_id=material_id,
        sort_order=mat_sort_order,
    )
    db.add(material)

    node = MaterialNode(
        key=node_key,
        material_key=mat_key,
        title=body.subject_name,
        range_text=exam_mat.name,
        sort_order=1,
    )
    db.add(node)

    subject = ExamSubject(
        exam_material_id=material_id,
        subject_name=body.subject_name,
        max_score=body.max_score,
        sort_order=max_order + 1,
        node_key=node_key,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return ExamSubjectOut.model_validate(subject)


@router.post("/{material_id}/subjects/simple", response_model=ExamSubjectOut)
async def add_subject_simple(
    material_id: int,
    subject_name: str = Form(...),
    max_score: float = Form(100),
    file: UploadFile | None = File(None),
    answer_file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Add a subject (教科) with optional PDF uploads. Like /materials/{key}/nodes/simple."""
    result = await db.execute(
        select(ExamMaterial).where(ExamMaterial.id == material_id)
    )
    exam_mat = result.scalars().first()
    if not exam_mat:
        raise HTTPException(status_code=404, detail="試験が見つかりません")

    subject_name = subject_name.strip()
    if not subject_name:
        raise HTTPException(status_code=400, detail="教科名を入力してください")

    # Check for duplicate subject
    existing = await db.execute(
        select(ExamSubject).where(
            ExamSubject.exam_material_id == material_id,
            ExamSubject.subject_name == subject_name,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="同じ教科が既に存在します")

    max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(ExamSubject.sort_order), 0))
        .where(ExamSubject.exam_material_id == material_id)
    )
    max_order = max_result.scalar()

    mat_key = _make_material_key(exam_mat.name, subject_name)
    node_key = _make_node_key(exam_mat.name, subject_name)

    mat_max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(Material.sort_order), 0))
    )
    mat_sort_order = mat_max_result.scalar() + 1

    storage_root = Path(settings.pdf_storage_dir)
    subfolder = f"試験/{exam_mat.name}"

    # Handle question PDF upload
    pdf_relpath = ""
    if file and file.filename and file.filename.lower().endswith(".pdf"):
        content = await file.read()
        target_dir = storage_root / subfolder
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / file.filename
        with open(target_file, "wb") as f:
            f.write(content)
        pdf_relpath = str(target_file.relative_to(storage_root))
        await upsert_pdf_blob(db, pdf_relpath, content, file.content_type or "application/pdf")

    # Handle answer PDF upload
    answer_pdf_relpath = ""
    if answer_file and answer_file.filename and answer_file.filename.lower().endswith(".pdf"):
        content = await answer_file.read()
        target_dir = storage_root / subfolder / "answers"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / answer_file.filename
        with open(target_file, "wb") as f:
            f.write(content)
        answer_pdf_relpath = str(target_file.relative_to(storage_root))
        await upsert_pdf_blob(db, answer_pdf_relpath, content, answer_file.content_type or "application/pdf")

    # Create Material
    material = Material(
        key=mat_key,
        name=f"{exam_mat.name} {subject_name}",
        subject=subject_name,
        exam_material_id=material_id,
        sort_order=mat_sort_order,
    )
    db.add(material)

    # Create MaterialNode with PDFs
    node = MaterialNode(
        key=node_key,
        material_key=mat_key,
        title=subject_name,
        range_text=exam_mat.name,
        pdf_relpath=pdf_relpath,
        answer_pdf_relpath=answer_pdf_relpath,
        sort_order=1,
    )
    db.add(node)

    # Create ExamSubject
    subject = ExamSubject(
        exam_material_id=material_id,
        subject_name=subject_name,
        max_score=max_score,
        sort_order=max_order + 1,
        node_key=node_key,
    )
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return ExamSubjectOut.model_validate(subject)


@router.delete("/{material_id}/subjects/{subject_id}")
async def delete_subject(
    material_id: int, subject_id: int, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ExamSubject).where(
            ExamSubject.id == subject_id,
            ExamSubject.exam_material_id == material_id,
        )
    )
    subject = result.scalars().first()
    if not subject:
        raise HTTPException(status_code=404, detail="教科が見つかりません")

    # Get exam material name to reconstruct material key
    exam_result = await db.execute(
        select(ExamMaterial).where(ExamMaterial.id == material_id)
    )
    exam_mat = exam_result.scalars().first()
    if exam_mat:
        mat_key = _make_material_key(exam_mat.name, subject.subject_name)
        await db.execute(delete(Material).where(Material.key == mat_key))

    await db.execute(delete(ExamSubject).where(ExamSubject.id == subject_id))
    await db.commit()
    return {"status": "deleted"}
