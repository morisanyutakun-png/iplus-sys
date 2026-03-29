from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from sqlalchemy import select, delete, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.material import Material, MaterialNode
from app.models.student_material import StudentMaterial, ProgressHistory, ArchivedProgress
from app.services.pdf_store import upsert_pdf_blob
from app.schemas.material import MaterialOut, MaterialListOut, MaterialCreate, MaterialCreateSimple, MaterialNodeCreate, MaterialNodeOut, MaterialNodeUpdate

router = APIRouter()


@router.get("", response_model=MaterialListOut)
async def list_materials(
    include_all: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    query = select(Material).options(selectinload(Material.nodes)).order_by(Material.sort_order)
    if not include_all:
        query = query.where(Material.exam_material_id.is_(None))
    result = await db.execute(query)
    materials = result.scalars().unique().all()
    return MaterialListOut(materials=[MaterialOut.model_validate(m) for m in materials])


@router.post("", response_model=MaterialOut)
async def create_material(body: MaterialCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Material).where(Material.key == body.key))
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="Material already exists")

    max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(Material.sort_order), 0))
    )
    max_order = max_result.scalar()

    material = Material(
        key=body.key,
        name=body.name,
        start_on=body.start_on,
        aliases=body.aliases,
        sort_order=max_order + 1,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return MaterialOut.model_validate(material)


@router.post("/simple", response_model=MaterialOut)
async def create_material_simple(body: MaterialCreateSimple, db: AsyncSession = Depends(get_db)):
    """Simplified material creation: name only. Key is auto-generated from name."""
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="名前を入力してください")

    key = name

    result = await db.execute(select(Material).where(Material.key == key))
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="同じ名前の教材が既に存在します")

    max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(Material.sort_order), 0))
    )
    max_order = max_result.scalar()

    material = Material(
        key=key,
        name=name,
        subject=body.subject,
        aliases=[],
        sort_order=max_order + 1,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return MaterialOut.model_validate(material)


@router.get("/{material_key}", response_model=MaterialOut)
async def get_material(material_key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Material)
        .where(Material.key == material_key)
        .options(selectinload(Material.nodes))
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return MaterialOut.model_validate(material)


@router.post("/{material_key}/nodes", response_model=MaterialNodeOut)
async def add_node(
    material_key: str, body: MaterialNodeCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Material).where(Material.key == material_key)
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Get max sort_order for this material
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(MaterialNode.sort_order), 0)).where(
            MaterialNode.material_key == material_key
        )
    )
    max_order = result.scalar()

    node = MaterialNode(
        key=body.key,
        material_key=material_key,
        title=body.title,
        range_text=body.range_text,
        pdf_relpath=body.pdf_relpath,
        answer_pdf_relpath=body.answer_pdf_relpath,
        recheck_pdf_relpath=body.recheck_pdf_relpath,
        recheck_answer_pdf_relpath=body.recheck_answer_pdf_relpath,
        duplex=body.duplex,
        sort_order=max_order + 1,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return MaterialNodeOut.model_validate(node)


@router.post("/{material_key}/nodes/simple", response_model=MaterialNodeOut)
async def add_node_simple(
    material_key: str,
    title: str = Form(...),
    file: UploadFile | None = File(None),
    answer_file: UploadFile | None = File(None),
    recheck_file: UploadFile | None = File(None),
    recheck_answer_file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    """Simplified node creation: title + optional question/answer/recheck PDF uploads.
    Auto-generates node key and handles PDF storage."""
    result = await db.execute(
        select(Material).where(Material.key == material_key)
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Get next sort_order
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(MaterialNode.sort_order), 0)).where(
            MaterialNode.material_key == material_key
        )
    )
    max_order = result.scalar()
    next_order = max_order + 1

    # Auto-generate node key
    node_key = f"{material_key}:{next_order:03d}"

    subfolder = material_key.replace(":", "/")
    storage_root = Path(settings.pdf_storage_dir)

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

    # Handle recheck PDF upload
    recheck_pdf_relpath = ""
    if recheck_file and recheck_file.filename and recheck_file.filename.lower().endswith(".pdf"):
        content = await recheck_file.read()
        target_dir = storage_root / subfolder / "recheck"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / recheck_file.filename
        with open(target_file, "wb") as f:
            f.write(content)
        recheck_pdf_relpath = str(target_file.relative_to(storage_root))
        await upsert_pdf_blob(db, recheck_pdf_relpath, content, recheck_file.content_type or "application/pdf")

    # Handle recheck answer PDF upload
    recheck_answer_pdf_relpath = ""
    if recheck_answer_file and recheck_answer_file.filename and recheck_answer_file.filename.lower().endswith(".pdf"):
        content = await recheck_answer_file.read()
        target_dir = storage_root / subfolder / "recheck" / "answers"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_file = target_dir / recheck_answer_file.filename
        with open(target_file, "wb") as f:
            f.write(content)
        recheck_answer_pdf_relpath = str(target_file.relative_to(storage_root))
        await upsert_pdf_blob(db, recheck_answer_pdf_relpath, content, recheck_answer_file.content_type or "application/pdf")

    node = MaterialNode(
        key=node_key,
        material_key=material_key,
        title=title.strip(),
        range_text=title.strip(),
        pdf_relpath=pdf_relpath,
        answer_pdf_relpath=answer_pdf_relpath,
        recheck_pdf_relpath=recheck_pdf_relpath,
        recheck_answer_pdf_relpath=recheck_answer_pdf_relpath,
        duplex=False,
        sort_order=next_order,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return MaterialNodeOut.model_validate(node)


@router.patch("/{material_key}/nodes/{node_key}", response_model=MaterialNodeOut)
async def update_node(
    material_key: str, node_key: str, body: MaterialNodeUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(MaterialNode).where(
            MaterialNode.key == node_key, MaterialNode.material_key == material_key
        )
    )
    node = result.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    if body.title is not None:
        node.title = body.title.strip()
    if body.range_text is not None:
        node.range_text = body.range_text.strip()
    if body.duplex is not None:
        node.duplex = body.duplex
    if body.answer_pdf_relpath is not None:
        node.answer_pdf_relpath = body.answer_pdf_relpath
    if body.recheck_pdf_relpath is not None:
        node.recheck_pdf_relpath = body.recheck_pdf_relpath
    if body.recheck_answer_pdf_relpath is not None:
        node.recheck_answer_pdf_relpath = body.recheck_answer_pdf_relpath

    await db.commit()
    await db.refresh(node)
    return MaterialNodeOut.model_validate(node)


@router.delete("/{material_key}/nodes/{node_key}")
async def delete_node(
    material_key: str, node_key: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(MaterialNode).where(
            MaterialNode.key == node_key, MaterialNode.material_key == material_key
        )
    )
    node = result.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    # Delete the node
    await db.execute(
        delete(MaterialNode).where(MaterialNode.key == node_key)
    )

    # Re-number remaining nodes' sort_order to be contiguous
    remaining_result = await db.execute(
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .order_by(MaterialNode.sort_order)
    )
    remaining_nodes = remaining_result.scalars().all()
    for idx, n in enumerate(remaining_nodes, 1):
        n.sort_order = idx

    new_total = len(remaining_nodes)

    # Adjust student pointers that exceed new total
    sm_result = await db.execute(
        select(StudentMaterial).where(StudentMaterial.material_key == material_key)
    )
    assignments = sm_result.scalars().all()
    pointer_adjustments = 0

    for sm in assignments:
        if new_total == 0:
            clamped = 1
        elif sm.pointer > new_total:
            clamped = new_total
        else:
            continue
        db.add(ProgressHistory(
            student_id=sm.student_id,
            material_key=material_key,
            node_key=node_key,
            action="node_deleted",
            old_pointer=sm.pointer,
            new_pointer=clamped,
            metadata_={"deleted_node": node_key},
        ))
        sm.pointer = clamped
        pointer_adjustments += 1

    await db.commit()
    return {"status": "deleted", "pointer_adjustments": pointer_adjustments}


@router.delete("/{material_key}")
async def delete_material(material_key: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Material).where(Material.key == material_key)
    )
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    # Archive and unassign all student assignments before deletion
    assigned_result = await db.execute(
        select(StudentMaterial).where(StudentMaterial.material_key == material_key)
    )
    assigned = assigned_result.scalars().all()
    unassigned_count = len(assigned)

    for sm in assigned:
        db.add(ArchivedProgress(
            student_id=sm.student_id,
            material_key=material_key,
            pointer=sm.pointer,
        ))
        db.add(ProgressHistory(
            student_id=sm.student_id,
            material_key=material_key,
            action="remove",
            old_pointer=sm.pointer,
            metadata_={"reason": "material_deleted"},
        ))

    if unassigned_count > 0:
        await db.execute(
            delete(StudentMaterial).where(StudentMaterial.material_key == material_key)
        )

    await db.execute(delete(Material).where(Material.key == material_key))
    await db.commit()
    return {"status": "deleted", "unassigned": unassigned_count}
