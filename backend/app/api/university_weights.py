from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.exam import UniversityScoreWeight
from app.schemas.exam import (
    UniversityScoreWeightCreate,
    UniversityScoreWeightUpdate,
    UniversityScoreWeightOut,
)

router = APIRouter()


@router.get("", response_model=list[UniversityScoreWeightOut])
async def list_weights(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UniversityScoreWeight).order_by(UniversityScoreWeight.name))
    return [UniversityScoreWeightOut.model_validate(w) for w in result.scalars().all()]


@router.post("", response_model=UniversityScoreWeightOut)
async def create_weight(body: UniversityScoreWeightCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(UniversityScoreWeight).where(UniversityScoreWeight.name == body.name)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="同じ名前のプロファイルが既に存在します")

    weight = UniversityScoreWeight(
        name=body.name,
        university=body.university,
        faculty=body.faculty,
        weights=body.weights,
        total_compressed_max=body.total_compressed_max,
    )
    db.add(weight)
    await db.commit()
    await db.refresh(weight)
    return UniversityScoreWeightOut.model_validate(weight)


@router.put("/{weight_id}", response_model=UniversityScoreWeightOut)
async def update_weight(weight_id: int, body: UniversityScoreWeightUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UniversityScoreWeight).where(UniversityScoreWeight.id == weight_id))
    weight = result.scalars().first()
    if not weight:
        raise HTTPException(status_code=404, detail="プロファイルが見つかりません")

    if body.name is not None:
        weight.name = body.name
    if body.university is not None:
        weight.university = body.university
    if body.faculty is not None:
        weight.faculty = body.faculty
    if body.weights is not None:
        weight.weights = body.weights
    if body.total_compressed_max is not None:
        weight.total_compressed_max = body.total_compressed_max

    await db.commit()
    await db.refresh(weight)
    return UniversityScoreWeightOut.model_validate(weight)


@router.delete("/{weight_id}")
async def delete_weight(weight_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UniversityScoreWeight).where(UniversityScoreWeight.id == weight_id))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="プロファイルが見つかりません")
    await db.execute(delete(UniversityScoreWeight).where(UniversityScoreWeight.id == weight_id))
    await db.commit()
    return {"status": "deleted"}
