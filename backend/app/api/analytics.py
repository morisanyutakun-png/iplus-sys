from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.student import Student
from app.models.material import Material
from app.models.student_material import StudentMaterial, ProgressHistory
from app.models.lesson_record import LessonRecord
from app.schemas.analytics import (
    StudentAnalytics,
    OverviewAnalytics,
    StudentRanking,
    MaterialDifficulty,
    WeeklyActivity,
)

router = APIRouter()


@router.get("/students/{student_id}")
async def get_student_analytics(student_id: str, db: AsyncSession = Depends(get_db)):
    # Progress timeline from ProgressHistory
    result = await db.execute(
        select(ProgressHistory)
        .where(ProgressHistory.student_id == student_id)
        .order_by(ProgressHistory.created_at.asc())
    )
    history = result.scalars().all()

    timeline = []
    for h in history:
        # Exclude exam materials from student analytics
        if h.material_key.startswith("試験:"):
            continue
        timeline.append({
            "date": h.created_at.isoformat(),
            "material_key": h.material_key,
            "action": h.action,
            "old_pointer": h.old_pointer,
            "new_pointer": h.new_pointer,
        })

    # Completion rates
    result = await db.execute(
        select(StudentMaterial)
        .where(StudentMaterial.student_id == student_id)
        .options(selectinload(StudentMaterial.material).selectinload(Material.nodes))
    )
    sms = result.scalars().all()
    completion_rates = []
    for sm in sms:
        # Exclude exam materials from student analytics
        if sm.material_key.startswith("試験:"):
            continue
        total = len(sm.material.nodes) if sm.material else 0
        pct = min((sm.pointer - 1) / total * 100, 100) if total > 0 else 0
        completion_rates.append({
            "material_key": sm.material_key,
            "material_name": sm.material.name if sm.material else sm.material_key,
            "pointer": sm.pointer,
            "total_nodes": total,
            "percent": round(pct, 1),
        })

    # Learning pace: nodes completed per week (from print actions in last 8 weeks)
    eight_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=8)
    result = await db.execute(
        select(ProgressHistory)
        .where(
            ProgressHistory.student_id == student_id,
            ProgressHistory.action == "print",
            ProgressHistory.created_at >= eight_weeks_ago,
        )
        .order_by(ProgressHistory.created_at.asc())
    )
    print_history = result.scalars().all()

    weeks_data: dict[str, int] = {}
    for h in print_history:
        if h.material_key.startswith("試験:"):
            continue
        week_key = h.created_at.strftime("%Y-W%W")
        weeks_data[week_key] = weeks_data.get(week_key, 0) + 1

    total_weeks = max(len(weeks_data), 1)
    total_nodes = sum(weeks_data.values())
    nodes_per_week = round(total_nodes / total_weeks, 1)

    # Determine trend
    if len(weeks_data) >= 4:
        values = list(weeks_data.values())
        first_half = sum(values[: len(values) // 2])
        second_half = sum(values[len(values) // 2 :])
        if second_half > first_half * 1.2:
            trend = "improving"
        elif second_half < first_half * 0.8:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"

    return StudentAnalytics(
        progress_timeline=timeline,
        completion_rates=completion_rates,
        pace={"nodes_per_week": nodes_per_week, "trend": trend, "weekly_detail": weeks_data},
    )


@router.get("/overview", response_model=OverviewAnalytics)
async def get_overview_analytics(db: AsyncSession = Depends(get_db)):
    # Student rankings
    result = await db.execute(
        select(Student).options(
            selectinload(Student.materials)
            .selectinload(StudentMaterial.material)
            .selectinload(Material.nodes)
        )
    )
    students = result.scalars().unique().all()

    rankings = []
    heatmap = []
    for student in students:
        percents = []
        total_completed = 0
        for sm in student.materials:
            if sm.material_key.startswith("試験:"):
                continue
            total = len(sm.material.nodes) if sm.material else 0
            pct = min((sm.pointer - 1) / total * 100, 100) if total > 0 else 0
            percents.append(pct)
            total_completed += min(sm.pointer - 1, total) if total > 0 else 0
            heatmap.append({
                "student_id": student.id,
                "student_name": student.name,
                "material_key": sm.material_key,
                "material_name": sm.material.name if sm.material else sm.material_key,
                "percent": round(pct, 1),
            })
        avg = round(sum(percents) / len(percents), 1) if percents else 0
        rankings.append(StudentRanking(
            student_id=student.id,
            name=student.name,
            avg_percent=avg,
            total_nodes_completed=total_completed,
        ))
    rankings.sort(key=lambda r: r.avg_percent, reverse=True)

    # Material difficulty (avg pace from ProgressHistory)
    result = await db.execute(
        select(Material).options(selectinload(Material.nodes))
    )
    materials = result.scalars().unique().all()
    material_difficulties = []
    for mat in materials:
        if mat.key.startswith("試験:"):
            continue
        # Count print actions per material
        count_result = await db.execute(
            select(sa_func.count(ProgressHistory.id))
            .where(
                ProgressHistory.material_key == mat.key,
                ProgressHistory.action == "print",
            )
        )
        print_count = count_result.scalar() or 0

        # Get avg score from lesson_records
        avg_result = await db.execute(
            select(sa_func.avg(LessonRecord.score))
            .where(
                LessonRecord.material_key == mat.key,
                LessonRecord.score.isnot(None),
            )
        )
        avg_score_val = avg_result.scalar()

        total_nodes = len(mat.nodes)
        avg_pace = round(print_count / max(total_nodes, 1), 1)
        material_difficulties.append(MaterialDifficulty(
            material_key=mat.key,
            name=mat.name,
            avg_pace=avg_pace,
            avg_score=round(avg_score_val, 1) if avg_score_val else None,
        ))

    # Weekly activity (last 8 weeks)
    eight_weeks_ago = datetime.now(timezone.utc) - timedelta(weeks=8)
    result = await db.execute(
        select(ProgressHistory)
        .where(ProgressHistory.created_at >= eight_weeks_ago)
    )
    progress_entries = result.scalars().all()

    result = await db.execute(
        select(LessonRecord)
        .where(LessonRecord.created_at >= eight_weeks_ago)
    )
    lesson_entries = result.scalars().all()

    weekly: dict[str, dict[str, int]] = {}
    for h in progress_entries:
        week_key = h.created_at.strftime("%Y-W%W")
        if week_key not in weekly:
            weekly[week_key] = {"records_count": 0, "prints_count": 0, "manual_set_count": 0}
        if h.action == "print":
            weekly[week_key]["prints_count"] += 1
        elif h.action == "manual_set":
            weekly[week_key]["manual_set_count"] += 1

    for l in lesson_entries:
        week_key = l.created_at.strftime("%Y-W%W")
        if week_key not in weekly:
            weekly[week_key] = {"records_count": 0, "prints_count": 0, "manual_set_count": 0}
        weekly[week_key]["records_count"] += 1

    weekly_activity = [
        WeeklyActivity(week=k, **v) for k, v in sorted(weekly.items())
    ]

    return OverviewAnalytics(
        student_rankings=rankings,
        material_difficulty=material_difficulties,
        weekly_activity=weekly_activity,
        completion_heatmap=heatmap,
    )
