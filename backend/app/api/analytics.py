from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.material import Material
from app.models.student_material import StudentMaterial, ProgressHistory
from app.models.lesson_record import LessonRecord
from app.schemas.analytics import StudentAnalytics, StudentAccuracyResponse

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


@router.get("/students/{student_id}/accuracy", response_model=StudentAccuracyResponse)
async def get_student_accuracy(student_id: str, db: AsyncSession = Depends(get_db)):
    """Return accuracy rates per material per date for a student."""
    result = await db.execute(
        select(LessonRecord)
        .where(
            LessonRecord.student_id == student_id,
            LessonRecord.accuracy_rate.isnot(None),
        )
        .order_by(LessonRecord.lesson_date.asc())
    )
    records = result.scalars().all()

    # Build material name lookup
    mat_keys = list({r.material_key for r in records})
    mat_result = await db.execute(
        select(Material).where(Material.key.in_(mat_keys))
    )
    mat_map = {m.key: m.name for m in mat_result.scalars().all()}

    entries = []
    total_count = 0
    fit_count = 0
    for r in records:
        if r.material_key.startswith("試験:"):
            continue
        entries.append({
            "date": r.lesson_date.isoformat(),
            "material_key": r.material_key,
            "material_name": mat_map.get(r.material_key, r.material_key),
            "accuracy_rate": r.accuracy_rate,
        })
        total_count += 1
        if 0.8 <= r.accuracy_rate < 1.0:
            fit_count += 1

    fitness_rate = round(fit_count / total_count * 100, 1) if total_count > 0 else None

    return StudentAccuracyResponse(entries=entries, fitness_rate=fitness_rate)
