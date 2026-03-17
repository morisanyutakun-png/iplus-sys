from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.student import Student
from app.models.material import Material
from app.models.student_material import StudentMaterial, ProgressHistory
from app.schemas.progress import (
    DashboardStats,
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

    # Active assignments
    result = await db.execute(select(sa_func.count()).select_from(StudentMaterial))
    active_assignments = result.scalar()

    # Average completion
    result = await db.execute(
        select(StudentMaterial).options(
            selectinload(StudentMaterial.material).selectinload(Material.nodes)
        )
    )
    sms = result.scalars().all()
    if sms:
        completions = []
        for sm in sms:
            total = len(sm.material.nodes) if sm.material else 0
            if total > 0:
                completions.append(min(sm.pointer / total * 100, 100))
        avg_completion = sum(completions) / len(completions) if completions else 0
    else:
        avg_completion = 0

    # Recent activity
    result = await db.execute(
        select(ProgressHistory)
        .order_by(ProgressHistory.created_at.desc())
        .limit(20)
    )
    recent = result.scalars().all()

    return DashboardStats(
        total_students=total_students,
        total_materials=total_materials,
        active_assignments=active_assignments,
        avg_completion=round(avg_completion, 1),
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
                percent=round(min(sm.pointer / total * 100, 100), 1) if total > 0 else 0,
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
