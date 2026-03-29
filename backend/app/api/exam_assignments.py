from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.exam import ExamMaterial, StudentExamAssignment
from app.schemas.exam import ExamAssignmentCreate, ExamAssignmentOut

router = APIRouter()


@router.get("/{student_id}", response_model=list[ExamAssignmentOut])
async def list_student_assignments(student_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StudentExamAssignment, ExamMaterial.name)
        .join(ExamMaterial, ExamMaterial.id == StudentExamAssignment.exam_material_id)
        .where(StudentExamAssignment.student_id == student_id)
        .order_by(StudentExamAssignment.assigned_at.desc())
    )
    rows = result.all()
    return [
        ExamAssignmentOut(
            student_id=row[0].student_id,
            exam_material_id=row[0].exam_material_id,
            assigned_at=row[0].assigned_at,
            exam_name=row[1],
        )
        for row in rows
    ]


@router.post("", response_model=ExamAssignmentOut)
async def assign_exam(body: ExamAssignmentCreate, db: AsyncSession = Depends(get_db)):
    # Check exam exists
    mat_result = await db.execute(select(ExamMaterial).where(ExamMaterial.id == body.exam_material_id))
    mat = mat_result.scalars().first()
    if not mat:
        raise HTTPException(status_code=404, detail="試験が見つかりません")

    # Check not already assigned
    existing = await db.execute(
        select(StudentExamAssignment).where(
            StudentExamAssignment.student_id == body.student_id,
            StudentExamAssignment.exam_material_id == body.exam_material_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="既に割り当て済みです")

    assignment = StudentExamAssignment(
        student_id=body.student_id,
        exam_material_id=body.exam_material_id,
    )
    db.add(assignment)
    await db.commit()
    await db.refresh(assignment)
    return ExamAssignmentOut(
        student_id=assignment.student_id,
        exam_material_id=assignment.exam_material_id,
        assigned_at=assignment.assigned_at,
        exam_name=mat.name,
    )


@router.delete("/{student_id}/{exam_material_id}")
async def unassign_exam(student_id: str, exam_material_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(StudentExamAssignment).where(
            StudentExamAssignment.student_id == student_id,
            StudentExamAssignment.exam_material_id == exam_material_id,
        )
    )
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="割り当てが見つかりません")

    await db.execute(
        delete(StudentExamAssignment).where(
            StudentExamAssignment.student_id == student_id,
            StudentExamAssignment.exam_material_id == exam_material_id,
        )
    )
    await db.commit()
    return {"status": "deleted"}
