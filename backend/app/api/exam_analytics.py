from collections import defaultdict

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

    w_result = await db.execute(
        select(UniversityScoreWeight).where(UniversityScoreWeight.id == weight_id)
    )
    weight = w_result.scalars().first()
    if not weight:
        raise HTTPException(status_code=404, detail="圧縮点プロファイルが見つかりません")

    q = select(ExamScore).where(ExamScore.student_id == student_id)
    if exam_material_id:
        q = q.where(ExamScore.exam_material_id == exam_material_id)
    q = q.order_by(ExamScore.attempt_date.desc())
    result = await db.execute(q)
    all_scores = result.scalars().all()

    subject_ids = list({s.exam_subject_id for s in all_scores})
    subj_result = await db.execute(
        select(ExamSubject).where(ExamSubject.id.in_(subject_ids)) if subject_ids else select(ExamSubject).where(False)
    )
    subj_map = {s.id: s for s in subj_result.scalars().all()}

    latest_scores: dict[str, float] = {}
    for s in all_scores:
        subj = subj_map.get(s.exam_subject_id)
        if subj and subj.subject_name not in latest_scores and s.score is not None:
            latest_scores[subj.subject_name] = s.score

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
    exam_type: str | None = None,
    grade: str | None = None,
    attempt_date: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Class-level analytics. If exam_material_id=0, aggregate across all exams (optionally filtered by exam_type)."""

    # Determine which subjects and scores to include
    if exam_material_id:
        # Single exam mode
        mat_result = await db.execute(select(ExamMaterial).where(ExamMaterial.id == exam_material_id))
        mat = mat_result.scalars().first()
        if not mat:
            raise HTTPException(status_code=404, detail="試験が見つかりません")
        exam_name = mat.name

        subj_result = await db.execute(
            select(ExamSubject)
            .where(ExamSubject.exam_material_id == exam_material_id)
            .order_by(ExamSubject.sort_order)
        )
        all_subjects = subj_result.scalars().all()

        q = (
            select(ExamScore, Student)
            .join(Student, Student.id == ExamScore.student_id)
            .where(ExamScore.exam_material_id == exam_material_id)
        )
    else:
        # Cross-exam mode: aggregate by subject_name across all exams
        exam_name = "全試験" if not exam_type else ("共テ・模試" if exam_type == "common_test" else "大学過去問")

        subj_q = select(ExamSubject)
        if exam_type:
            subj_q = subj_q.join(ExamMaterial, ExamMaterial.id == ExamSubject.exam_material_id).where(ExamMaterial.exam_type == exam_type)
        subj_result = await db.execute(subj_q.order_by(ExamSubject.subject_name))
        raw_subjects = subj_result.scalars().all()

        # Deduplicate by subject_name (use max of max_score across exams)
        subj_name_map: dict[str, ExamSubject] = {}
        for s in raw_subjects:
            if s.subject_name not in subj_name_map or s.max_score > subj_name_map[s.subject_name].max_score:
                subj_name_map[s.subject_name] = s
        all_subjects = list(subj_name_map.values())

        q = (
            select(ExamScore, Student)
            .join(Student, Student.id == ExamScore.student_id)
        )
        if exam_type:
            q = q.join(ExamMaterial, ExamMaterial.id == ExamScore.exam_material_id).where(ExamMaterial.exam_type == exam_type)

    if grade and grade != "all":
        q = q.where(Student.grade == grade)
    if attempt_date:
        q = q.where(ExamScore.attempt_date == attempt_date)

    result = await db.execute(q)
    rows = result.all()

    # For cross-exam: we need subject_id -> subject_name mapping
    all_subj_ids = list({s.id for s in all_subjects})
    if not exam_material_id:
        # Fetch ALL subject records to map IDs to names
        all_subj_result = await db.execute(select(ExamSubject))
        all_subj_records = all_subj_result.scalars().all()
        subj_id_to_name = {s.id: s.subject_name for s in all_subj_records}
    else:
        subj_id_to_name = {s.id: s.subject_name for s in all_subjects}

    # Build subject_name -> max_score map
    subj_name_to_max: dict[str, float] = {}
    for s in all_subjects:
        subj_name_to_max[s.subject_name] = s.max_score

    total_max = sum(subj_name_to_max.values())

    # Group: student_id -> { subject_name -> latest_score }
    # Use latest score per subject_name per student
    student_subject_scores: dict[str, dict[str, float]] = defaultdict(dict)
    student_info: dict[str, Student] = {}
    # Sort rows by date desc so first encountered = latest
    sorted_rows = sorted(rows, key=lambda r: str(r[0].attempt_date), reverse=True)

    for score_row, student in sorted_rows:
        sid = student.id
        student_info[sid] = student
        sname = subj_id_to_name.get(score_row.exam_subject_id)
        if sname and sname in subj_name_to_max and sname not in student_subject_scores[sid]:
            if score_row.score is not None:
                student_subject_scores[sid][sname] = score_row.score

    # Subject averages
    subject_score_lists: dict[str, list[float]] = defaultdict(list)
    for sid, subj_scores in student_subject_scores.items():
        for sname, score in subj_scores.items():
            subject_score_lists[sname].append(score)

    subject_averages = []
    for sname, max_sc in subj_name_to_max.items():
        scores_list = subject_score_lists.get(sname, [])
        avg = sum(scores_list) / len(scores_list) if scores_list else 0
        avg_pct = (avg / max_sc * 100) if max_sc > 0 else 0
        subject_averages.append(SubjectAverage(
            subject_name=sname,
            max_score=max_sc,
            avg_score=round(avg, 1),
            avg_percentage=round(avg_pct, 1),
            student_count=len(scores_list),
        ))

    # Rankings: sum of latest scores per subject
    rankings = []
    for sid, subj_scores in student_subject_scores.items():
        st = student_info[sid]
        total = sum(subj_scores.values())
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

    # Class average
    all_totals = [sum(ss.values()) for ss in student_subject_scores.values()]
    class_avg = sum(all_totals) / len(all_totals) if all_totals else 0
    class_avg_pct = (class_avg / total_max * 100) if total_max > 0 else 0

    return ExamOverview(
        exam_material_id=exam_material_id,
        exam_name=exam_name,
        rankings=rankings,
        subject_averages=subject_averages,
        class_average_total=round(class_avg, 1),
        class_average_percentage=round(class_avg_pct, 1),
    )
