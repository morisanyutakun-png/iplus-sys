from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.exam import ExamMaterial, ExamSubject, ExamScore, UniversityScoreWeight
from app.models.student import Student
from app.schemas.exam import (
    CompressedScoreResult,
    CompressedScoreSubject,
    ExamOverview,
    StudentExamRanking,
    SubjectAverage,
)

router = APIRouter()


@router.get("/compressed/{student_id}", response_model=CompressedScoreResult)
async def compressed_score(
    student_id: str,
    weight_id: int = 0,
    exam_material_id: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """Calculate compressed score for a student given a university weight profile."""
    if not weight_id:
        raise HTTPException(status_code=400, detail="weight_id is required")

    # Get weight profile
    w_result = await db.execute(
        select(UniversityScoreWeight).where(UniversityScoreWeight.id == weight_id)
    )
    weight = w_result.scalars().first()
    if not weight:
        raise HTTPException(status_code=404, detail="圧縮点プロファイルが見つかりません")

    # Get latest scores for the student (latest attempt per subject)
    q = select(ExamScore).where(ExamScore.student_id == student_id)
    if exam_material_id:
        q = q.where(ExamScore.exam_material_id == exam_material_id)
    q = q.order_by(ExamScore.attempt_date.desc())
    result = await db.execute(q)
    all_scores = result.scalars().all()

    # Build subject_name -> latest score map
    # Need subject info
    subject_ids = list({s.exam_subject_id for s in all_scores})
    subj_result = await db.execute(
        select(ExamSubject).where(ExamSubject.id.in_(subject_ids)) if subject_ids else select(ExamSubject).where(False)
    )
    subj_map = {s.id: s for s in subj_result.scalars().all()}

    # Latest score per subject name
    latest_scores: dict[str, float] = {}
    for s in all_scores:
        subj = subj_map.get(s.exam_subject_id)
        if subj and subj.subject_name not in latest_scores and s.score is not None:
            latest_scores[subj.subject_name] = s.score

    # Calculate compressed scores
    subjects = []
    total_compressed = 0.0
    for subject_name, config in weight.weights.items():
        original_max = config.get("max", 100)
        compressed_max = config.get("compressed_max", 0)
        raw_score = latest_scores.get(subject_name, 0)
        compressed = (raw_score / original_max * compressed_max) if original_max > 0 else 0
        subjects.append(CompressedScoreSubject(
            subject_name=subject_name,
            raw_score=raw_score,
            original_max=original_max,
            compressed_max=compressed_max,
            compressed_score=round(compressed, 1),
        ))
        total_compressed += compressed

    percentage = (total_compressed / weight.total_compressed_max * 100) if weight.total_compressed_max > 0 else 0

    return CompressedScoreResult(
        weight_name=weight.name,
        university=weight.university,
        faculty=weight.faculty,
        subjects=subjects,
        total_compressed=round(total_compressed, 1),
        total_compressed_max=weight.total_compressed_max,
        percentage=round(percentage, 1),
    )


@router.get("/overview", response_model=ExamOverview)
async def exam_overview(
    exam_material_id: int = 0,
    grade: str | None = None,
    attempt_date: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Class-level analytics: rankings and subject averages for a given exam."""
    if not exam_material_id:
        raise HTTPException(status_code=400, detail="exam_material_id is required")

    mat_result = await db.execute(select(ExamMaterial).where(ExamMaterial.id == exam_material_id))
    mat = mat_result.scalars().first()
    if not mat:
        raise HTTPException(status_code=404, detail="試験が見つかりません")

    # Get all subjects
    subj_result = await db.execute(
        select(ExamSubject)
        .where(ExamSubject.exam_material_id == exam_material_id)
        .order_by(ExamSubject.sort_order)
    )
    all_subjects = subj_result.scalars().all()
    total_max = sum(s.max_score for s in all_subjects)

    # Get scores, optionally filtered by grade and attempt_date
    q = (
        select(ExamScore, Student)
        .join(Student, Student.id == ExamScore.student_id)
        .where(ExamScore.exam_material_id == exam_material_id)
    )
    if grade:
        q = q.where(Student.grade == grade)
    if attempt_date:
        q = q.where(ExamScore.attempt_date == attempt_date)

    result = await db.execute(q)
    rows = result.all()

    # Group scores by student
    from collections import defaultdict
    student_scores: dict[str, dict] = {}
    subject_totals: dict[int, list[float]] = defaultdict(list)

    for score_row, student in rows:
        sid = student.id
        if sid not in student_scores:
            student_scores[sid] = {
                "student": student,
                "total": 0.0,
                "subjects": {},
            }
        if score_row.score is not None:
            student_scores[sid]["total"] += score_row.score
            student_scores[sid]["subjects"][score_row.exam_subject_id] = score_row.score
            subject_totals[score_row.exam_subject_id].append(score_row.score)

    # Rankings
    rankings = []
    for sid, data in student_scores.items():
        st = data["student"]
        total = data["total"]
        pct = (total / total_max * 100) if total_max > 0 else 0
        rankings.append(StudentExamRanking(
            student_id=sid,
            student_name=st.name,
            grade=st.grade,
            total_score=round(total, 1),
            total_max=total_max,
            percentage=round(pct, 1),
        ))
    rankings.sort(key=lambda r: r.percentage, reverse=True)

    # Subject averages
    subject_averages = []
    for subj in all_subjects:
        scores_list = subject_totals.get(subj.id, [])
        avg = sum(scores_list) / len(scores_list) if scores_list else 0
        avg_pct = (avg / subj.max_score * 100) if subj.max_score > 0 else 0
        subject_averages.append(SubjectAverage(
            subject_name=subj.subject_name,
            max_score=subj.max_score,
            avg_score=round(avg, 1),
            avg_percentage=round(avg_pct, 1),
            student_count=len(scores_list),
        ))

    # Class average
    all_totals = [d["total"] for d in student_scores.values()]
    class_avg = sum(all_totals) / len(all_totals) if all_totals else 0
    class_avg_pct = (class_avg / total_max * 100) if total_max > 0 else 0

    return ExamOverview(
        exam_material_id=exam_material_id,
        exam_name=mat.name,
        rankings=rankings,
        subject_averages=subject_averages,
        class_average_total=round(class_avg, 1),
        class_average_percentage=round(class_avg_pct, 1),
    )
