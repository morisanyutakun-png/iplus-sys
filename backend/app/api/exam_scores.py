from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import get_db
from app.models.exam import ExamMaterial, ExamSubject, ExamScore, ExamScoreTarget
from app.models.student import Student
from app.schemas.exam import (
    ExamScoreOut,
    ExamScoreBatchRequest,
    ExamScoreBatchResponse,
    StudentExamSummary,
    ExamAttemptSummary,
    SubjectScoreDetail,
)

router = APIRouter()


@router.get("", response_model=list[ExamScoreOut])
async def list_exam_scores(
    student_id: str | None = None,
    exam_material_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(ExamScore).order_by(ExamScore.attempt_date.desc())
    if student_id:
        q = q.where(ExamScore.student_id == student_id)
    if exam_material_id:
        q = q.where(ExamScore.exam_material_id == exam_material_id)
    result = await db.execute(q)
    scores = result.scalars().all()
    return [ExamScoreOut.model_validate(s) for s in scores]


@router.post("/batch", response_model=ExamScoreBatchResponse)
async def batch_upsert_scores(body: ExamScoreBatchRequest, db: AsyncSession = Depends(get_db)):
    upserted = 0
    for s in body.scores:
        stmt = pg_insert(ExamScore).values(
            student_id=s.student_id,
            exam_material_id=s.exam_material_id,
            exam_subject_id=s.exam_subject_id,
            score=s.score,
            attempt_date=s.attempt_date,
            notes=s.notes,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_exam_score",
            set_={
                "score": stmt.excluded.score,
                "notes": stmt.excluded.notes,
                "updated_at": sa_func.now(),
            },
        )
        await db.execute(stmt)
        upserted += 1
    await db.commit()
    return ExamScoreBatchResponse(upserted=upserted)


@router.get("/student/{student_id}/summary", response_model=StudentExamSummary)
async def student_exam_summary(student_id: str, exam_material_id: int | None = None, db: AsyncSession = Depends(get_db)):
    # Get student
    st_result = await db.execute(select(Student).where(Student.id == student_id))
    student = st_result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")

    # Get scores
    q = select(ExamScore).where(ExamScore.student_id == student_id).order_by(ExamScore.attempt_date)
    if exam_material_id:
        q = q.where(ExamScore.exam_material_id == exam_material_id)
    result = await db.execute(q)
    scores = result.scalars().all()

    # Get targets
    tq = select(ExamScoreTarget).where(ExamScoreTarget.student_id == student_id)
    target_result = await db.execute(tq)
    targets_list = target_result.scalars().all()
    targets_map = {t.exam_subject_id: t.target_score for t in targets_list}

    # Group by (exam_material_id, attempt_date)
    from collections import defaultdict
    groups: dict[tuple[int, str], list] = defaultdict(list)
    for s in scores:
        groups[(s.exam_material_id, str(s.attempt_date))].append(s)

    # Build attempts
    attempts = []
    for (mat_id, att_date), group_scores in groups.items():
        # Get exam material info
        mat_result = await db.execute(
            select(ExamMaterial).where(ExamMaterial.id == mat_id)
        )
        mat = mat_result.scalars().first()
        if not mat:
            continue

        # Get all subjects for this exam
        subj_result = await db.execute(
            select(ExamSubject)
            .where(ExamSubject.exam_material_id == mat_id)
            .order_by(ExamSubject.sort_order)
        )
        all_subjects = subj_result.scalars().all()

        score_map = {s.exam_subject_id: s.score for s in group_scores}
        subject_details = []
        total_score = 0.0
        total_max = 0.0
        for subj in all_subjects:
            sc = score_map.get(subj.id)
            target = targets_map.get(subj.id)
            subject_details.append(SubjectScoreDetail(
                subject_name=subj.subject_name,
                max_score=subj.max_score,
                score=sc,
                target_score=target,
            ))
            total_max += subj.max_score
            if sc is not None:
                total_score += sc

        percentage = (total_score / total_max * 100) if total_max > 0 else 0.0

        attempts.append(ExamAttemptSummary(
            exam_material_id=mat_id,
            exam_name=mat.name,
            exam_type=mat.exam_type,
            attempt_date=att_date,
            subjects=subject_details,
            total_score=round(total_score, 1),
            total_max=round(total_max, 1),
            percentage=round(percentage, 1),
        ))

    return StudentExamSummary(
        student_id=student_id,
        student_name=student.name,
        attempts=attempts,
    )
