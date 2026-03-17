from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import get_db
from app.models.lesson_record import LessonRecord
from app.schemas.lesson_record import (
    LessonRecordOut,
    LessonRecordBatchRequest,
    LessonRecordBatchResponse,
)

router = APIRouter()


@router.get("")
async def list_lesson_records(
    student_id: str | None = Query(None),
    material_key: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
):
    query = select(LessonRecord).order_by(
        LessonRecord.lesson_date.desc(), LessonRecord.id.desc()
    )
    if student_id:
        query = query.where(LessonRecord.student_id == student_id)
    if material_key:
        query = query.where(LessonRecord.material_key == material_key)
    if date_from:
        query = query.where(LessonRecord.lesson_date >= date_from)
    if date_to:
        query = query.where(LessonRecord.lesson_date <= date_to)
    query = query.limit(limit)

    result = await db.execute(query)
    records = result.scalars().all()
    return {"records": [LessonRecordOut.model_validate(r) for r in records]}


@router.post("/batch", response_model=LessonRecordBatchResponse)
async def batch_upsert_lesson_records(
    body: LessonRecordBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    if not body.records:
        return LessonRecordBatchResponse(upserted=0)

    for rec in body.records:
        stmt = pg_insert(LessonRecord).values(
            student_id=rec.student_id,
            material_key=rec.material_key,
            node_key=rec.node_key,
            lesson_date=rec.lesson_date,
            status=rec.status,
            score=rec.score,
            notes=rec.notes,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_lesson_record",
            set_={
                "status": stmt.excluded.status,
                "score": stmt.excluded.score,
                "notes": stmt.excluded.notes,
                "updated_at": LessonRecord.updated_at.default,
            },
        )
        await db.execute(stmt)

    await db.commit()
    return LessonRecordBatchResponse(upserted=len(body.records))
