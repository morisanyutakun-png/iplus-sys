from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.exam import ExamMaterial, ExamSubject
from app.schemas.exam import (
    ExamMaterialCreate,
    ExamMaterialOut,
    ExamSubjectCreate,
    ExamSubjectOut,
)

router = APIRouter()


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

    material = ExamMaterial(
        name=body.name,
        exam_type=body.exam_type,
        year=body.year,
        university=body.university,
        faculty=body.faculty,
        exam_period=body.exam_period,
        sort_order=max_order + 1,
    )
    db.add(material)
    await db.flush()

    for idx, subj in enumerate(body.subjects):
        db.add(ExamSubject(
            exam_material_id=material.id,
            subject_name=subj.subject_name,
            max_score=subj.max_score,
            sort_order=idx + 1,
        ))

    await db.commit()
    await db.refresh(material)
    return ExamMaterialOut.model_validate(material)


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
    material = result.scalars().first()
    if not material:
        raise HTTPException(status_code=404, detail="試験が見つかりません")
    await db.execute(delete(ExamMaterial).where(ExamMaterial.id == material_id))
    await db.commit()
    return {"status": "deleted"}


@router.post("/{material_id}/subjects", response_model=ExamSubjectOut)
async def add_subject(
    material_id: int, body: ExamSubjectCreate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(ExamMaterial).where(ExamMaterial.id == material_id))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="試験が見つかりません")

    max_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(ExamSubject.sort_order), 0))
        .where(ExamSubject.exam_material_id == material_id)
    )
    max_order = max_result.scalar()

    subject = ExamSubject(
        exam_material_id=material_id,
        subject_name=body.subject_name,
        max_score=body.max_score,
        sort_order=max_order + 1,
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
    await db.execute(delete(ExamSubject).where(ExamSubject.id == subject_id))
    await db.commit()
    return {"status": "deleted"}
