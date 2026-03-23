from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, delete, text, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.student import Student
from app.models.material import Material
from app.models.student_material import StudentMaterial, ProgressHistory, ReminderAcknowledgment, LowAccuracyAcknowledgment
from datetime import datetime, timedelta, timezone

from app.schemas.progress import (
    AcknowledgeReminderRequest,
    AcknowledgeLowAccuracyRequest,
    DashboardStats,
    NearlyCompleteItem,
    LowAccuracyItem,
    WeeklyTrendItem,
    StudentMaterialProgress,
    StudentProgressRow,
    StudentProgressOut,
    MaterialProgress,
    ProgressEntryOut,
)

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(db: AsyncSession = Depends(get_db)):
    # Total students
    result = await db.execute(select(sa_func.count(Student.id)))
    total_students = result.scalar()

    # Total materials
    result = await db.execute(select(sa_func.count(Material.key)))
    total_materials = result.scalar()

    # All student-material assignments with eager loading
    result = await db.execute(
        select(Student).options(
            selectinload(Student.materials)
            .selectinload(StudentMaterial.material)
            .selectinload(Material.nodes)
        )
    )
    students = result.scalars().unique().all()

    # Build student progress table & nearly complete list
    nearly_complete: list[NearlyCompleteItem] = []
    student_progress: list[StudentProgressRow] = []

    for student in students:
        mat_progress_list: list[StudentMaterialProgress] = []
        percents: list[float] = []
        for sm in student.materials:
            total = len(sm.material.nodes) if sm.material else 0
            pct = min((sm.pointer - 1) / total * 100, 100) if total > 0 else 0
            remaining = max(total - sm.pointer + 1, 0) if total > 0 else 0
            percents.append(pct)
            mat_progress_list.append(StudentMaterialProgress(
                material_key=sm.material_key,
                material_name=sm.material.name if sm.material else sm.material_key,
                pointer=sm.pointer,
                total_nodes=total,
                percent=round(pct, 1),
            ))
            if 0 < remaining <= 2 and total > 0:
                nearly_complete.append(NearlyCompleteItem(
                    student_id=student.id,
                    student_name=student.name,
                    material_key=sm.material_key,
                    material_name=sm.material.name if sm.material else sm.material_key,
                    pointer=sm.pointer,
                    total_nodes=total,
                    remaining=remaining,
                ))
        avg_pct = round(sum(percents) / len(percents), 1) if percents else 0
        student_progress.append(StudentProgressRow(
            student_id=student.id,
            student_name=student.name,
            materials=mat_progress_list,
            avg_percent=avg_pct,
        ))

    # Sort nearly_complete by remaining ascending
    nearly_complete.sort(key=lambda x: x.remaining)

    # Fetch acknowledgments
    ack_result = await db.execute(select(ReminderAcknowledgment))
    ack_set = {(a.student_id, a.material_key) for a in ack_result.scalars().all()}
    for item in nearly_complete:
        item.acknowledged = (item.student_id, item.material_key) in ack_set

    # Weekly actions (this week, Mon-Sun)
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(sa_func.count(ProgressHistory.id)).where(
            ProgressHistory.created_at >= week_start,
            ProgressHistory.action.in_(["advance", "print", "manual_set"]),
        )
    )
    weekly_actions = result.scalar() or 0

    # Weekly trend (last 8 weeks)
    eight_weeks_ago = now - timedelta(weeks=8)
    result = await db.execute(
        select(ProgressHistory).where(
            ProgressHistory.created_at >= eight_weeks_ago,
            ProgressHistory.action.in_(["advance", "print", "manual_set"]),
        )
    )
    trend_entries = result.scalars().all()
    weeks_data: dict[str, int] = {}
    for h in trend_entries:
        week_key = h.created_at.strftime("%m/%d")
        # Use Monday of that week as key
        entry_date = h.created_at
        monday = entry_date - timedelta(days=entry_date.weekday())
        week_label = monday.strftime("%m/%d")
        weeks_data[week_label] = weeks_data.get(week_label, 0) + 1
    weekly_trend = [
        WeeklyTrendItem(week=k, actions=v)
        for k, v in sorted(weeks_data.items())
    ]

    # Recent activity
    result = await db.execute(
        select(ProgressHistory)
        .order_by(ProgressHistory.created_at.desc())
        .limit(20)
    )
    recent = result.scalars().all()

    # Low accuracy reminders: uses low_score_streak counter on student_materials
    # The counter is incremented each time a score < 60% is saved via mastery input,
    # and reset to 0 when a score >= 60% is saved. This works regardless of
    # lesson_records upsert behavior (same day/same node = 1 record).
    low_accuracy_items: list[LowAccuracyItem] = []

    # Fetch low accuracy acknowledgments
    la_ack_result = await db.execute(select(LowAccuracyAcknowledgment))
    la_ack_set = {
        (a.student_id, a.material_key)
        for a in la_ack_result.scalars().all()
    }

    for student in students:
        for sm in student.materials:
            if (sm.low_score_streak or 0) >= 2:
                # Find current node title
                current_node_title = ""
                if sm.material and sm.material.nodes:
                    for n in sm.material.nodes:
                        if n.sort_order == sm.pointer:
                            current_node_title = n.title
                            break

                low_accuracy_items.append(LowAccuracyItem(
                    student_id=student.id,
                    student_name=student.name,
                    material_key=sm.material_key,
                    material_name=sm.material.name if sm.material else sm.material_key,
                    node_key=current_node_title or sm.material_key,
                    node_title=current_node_title or "現在の範囲",
                    latest_rates=[sm.last_accuracy or 0] * min(sm.low_score_streak or 0, 3),
                    streak=sm.low_score_streak or 0,
                    acknowledged=(student.id, sm.material_key) in la_ack_set,
                ))

    return DashboardStats(
        total_students=total_students,
        total_materials=total_materials,
        nearly_complete=nearly_complete,
        low_accuracy=low_accuracy_items,
        weekly_actions=weekly_actions,
        weekly_trend=weekly_trend,
        student_progress=student_progress,
        recent_activity=[ProgressEntryOut.model_validate(r) for r in recent],
    )


@router.get("/student/{student_id}", response_model=StudentProgressOut)
async def get_student_progress(student_id: str, db: AsyncSession = Depends(get_db)):
    # Get student
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalars().first()
    if not student:
        return StudentProgressOut(
            student_id=student_id, student_name="Unknown", materials=[], history=[]
        )

    # Get materials
    result = await db.execute(
        select(StudentMaterial)
        .where(StudentMaterial.student_id == student_id)
        .options(selectinload(StudentMaterial.material).selectinload(Material.nodes))
    )
    sms = result.scalars().all()
    materials = []
    for sm in sms:
        total = len(sm.material.nodes) if sm.material else 0
        materials.append(
            MaterialProgress(
                material_key=sm.material_key,
                material_name=sm.material.name if sm.material else sm.material_key,
                pointer=sm.pointer,
                total_nodes=total,
                percent=round(min((sm.pointer - 1) / total * 100, 100), 1) if total > 0 else 0,
            )
        )

    # Get history
    result = await db.execute(
        select(ProgressHistory)
        .where(ProgressHistory.student_id == student_id)
        .order_by(ProgressHistory.created_at.desc())
        .limit(50)
    )
    history = result.scalars().all()

    return StudentProgressOut(
        student_id=student_id,
        student_name=student.name,
        materials=materials,
        history=[ProgressEntryOut.model_validate(h) for h in history],
    )


@router.get("/history")
async def get_progress_history(
    student_id: str | None = Query(None),
    material_key: str | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(ProgressHistory).order_by(ProgressHistory.created_at.desc())

    if student_id:
        query = query.where(ProgressHistory.student_id == student_id)
    if material_key:
        query = query.where(ProgressHistory.material_key == material_key)

    query = query.limit(limit)
    result = await db.execute(query)
    entries = result.scalars().all()

    return {"history": [ProgressEntryOut.model_validate(e) for e in entries]}


@router.post("/acknowledge-reminder")
async def acknowledge_reminder(body: AcknowledgeReminderRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ReminderAcknowledgment).where(
            ReminderAcknowledgment.student_id == body.student_id,
            ReminderAcknowledgment.material_key == body.material_key,
        )
    )
    if result.scalars().first():
        return {"status": "already_acknowledged"}

    db.add(ReminderAcknowledgment(
        student_id=body.student_id,
        material_key=body.material_key,
    ))
    await db.commit()
    return {"status": "acknowledged"}


@router.post("/unacknowledge-reminder")
async def unacknowledge_reminder(body: AcknowledgeReminderRequest, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(ReminderAcknowledgment).where(
            ReminderAcknowledgment.student_id == body.student_id,
            ReminderAcknowledgment.material_key == body.material_key,
        )
    )
    await db.commit()
    return {"status": "unacknowledged"}


@router.post("/acknowledge-low-accuracy")
async def acknowledge_low_accuracy(body: AcknowledgeLowAccuracyRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(LowAccuracyAcknowledgment).where(
            LowAccuracyAcknowledgment.student_id == body.student_id,
            LowAccuracyAcknowledgment.material_key == body.material_key,
            LowAccuracyAcknowledgment.node_key == body.node_key,
        )
    )
    if result.scalars().first():
        return {"status": "already_acknowledged"}

    db.add(LowAccuracyAcknowledgment(
        student_id=body.student_id,
        material_key=body.material_key,
        node_key=body.node_key,
    ))
    await db.commit()
    return {"status": "acknowledged"}


@router.post("/unacknowledge-low-accuracy")
async def unacknowledge_low_accuracy(body: AcknowledgeLowAccuracyRequest, db: AsyncSession = Depends(get_db)):
    await db.execute(
        delete(LowAccuracyAcknowledgment).where(
            LowAccuracyAcknowledgment.student_id == body.student_id,
            LowAccuracyAcknowledgment.material_key == body.material_key,
            LowAccuracyAcknowledgment.node_key == body.node_key,
        )
    )
    await db.commit()
    return {"status": "unacknowledged"}
