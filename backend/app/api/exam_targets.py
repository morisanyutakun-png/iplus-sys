from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import get_db
from app.models.exam import ExamScoreTarget
from app.schemas.exam import (
    ExamScoreTargetOut,
    ExamScoreTargetBatchRequest,
)

router = APIRouter()


@router.get("/{student_id}", response_model=list[ExamScoreTargetOut])
async def list_student_targets(student_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamScoreTarget).where(ExamScoreTarget.student_id == student_id)
    )
    return [ExamScoreTargetOut.model_validate(t) for t in result.scalars().all()]


@router.post("/batch", response_model=dict)
async def batch_set_targets(body: ExamScoreTargetBatchRequest, db: AsyncSession = Depends(get_db)):
    upserted = 0
    for t in body.targets:
        stmt = pg_insert(ExamScoreTarget).values(
            student_id=t.student_id,
            exam_material_id=t.exam_material_id,
            exam_subject_id=t.exam_subject_id,
            target_score=t.target_score,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_exam_target",
            set_={"target_score": stmt.excluded.target_score},
        )
        await db.execute(stmt)
        upserted += 1
    await db.commit()
    return {"upserted": upserted}


@router.delete("/{student_id}/{exam_subject_id}")
async def delete_target(student_id: str, exam_subject_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExamScoreTarget).where(
            ExamScoreTarget.student_id == student_id,
            ExamScoreTarget.exam_subject_id == exam_subject_id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="目標が見つかりません")
    await db.execute(
        delete(ExamScoreTarget).where(
            ExamScoreTarget.student_id == student_id,
            ExamScoreTarget.exam_subject_id == exam_subject_id,
        )
    )
    await db.commit()
    return {"status": "deleted"}
