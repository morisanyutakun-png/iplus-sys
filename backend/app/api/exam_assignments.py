from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.exam import ExamMaterial, ExamSubject, StudentExamAssignment
from app.models.material import Material, MaterialNode
from app.models.student import Student
from app.models.student_material import StudentMaterial, ProgressHistory
from app.models.print_queue import PrintQueue
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
    # Check exam exists with subjects
    mat_result = await db.execute(
        select(ExamMaterial)
        .where(ExamMaterial.id == body.exam_material_id)
        .options(selectinload(ExamMaterial.subjects))
    )
    mat = mat_result.scalars().first()
    if not mat:
        raise HTTPException(status_code=404, detail="試験が見つかりません")

    # Check student exists
    student_result = await db.execute(select(Student).where(Student.id == body.student_id))
    student = student_result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="生徒が見つかりません")

    # Check not already assigned
    existing = await db.execute(
        select(StudentExamAssignment).where(
            StudentExamAssignment.student_id == body.student_id,
            StudentExamAssignment.exam_material_id == body.exam_material_id,
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="既に割り当て済みです")

    # Create exam assignment
    assignment = StudentExamAssignment(
        student_id=body.student_id,
        exam_material_id=body.exam_material_id,
    )
    db.add(assignment)

    # Get current max print queue sort_order
    max_order_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PrintQueue.sort_order), 0))
    )
    sort_order = max_order_result.scalar() + 1

    # For each subject: assign the linked Material to the student + queue printing
    for subj in mat.subjects:
        if not subj.node_key:
            continue

        # Find the linked Material
        mat_key = f"試験:{mat.name}:{subj.subject_name}"
        linked_mat_result = await db.execute(
            select(Material).where(Material.key == mat_key).options(selectinload(Material.nodes))
        )
        linked_mat = linked_mat_result.scalars().first()
        if not linked_mat:
            continue

        # Assign material to student (if not already)
        existing_sm = await db.execute(
            select(StudentMaterial).where(
                StudentMaterial.student_id == body.student_id,
                StudentMaterial.material_key == mat_key,
            )
        )
        if not existing_sm.scalars().first():
            sm = StudentMaterial(
                student_id=body.student_id,
                material_key=mat_key,
                pointer=1,
            )
            db.add(sm)
            db.add(ProgressHistory(
                student_id=body.student_id,
                material_key=mat_key,
                action="assign",
                new_pointer=1,
                metadata_={"source": "exam_assignment", "exam_name": mat.name},
            ))

        # Queue the node for printing
        first_node = sorted(linked_mat.nodes, key=lambda n: n.sort_order)[0] if linked_mat.nodes else None
        if first_node:
            # Question PDF (queue even if pdf_relpath is empty — marks it as needed)
            has_question_pdf = bool(first_node.pdf_relpath)
            db.add(PrintQueue(
                student_id=body.student_id,
                student_name=student.name,
                student_grade=student.grade,
                material_key=mat_key,
                material_name=linked_mat.name,
                material_valid=True,
                node_key=first_node.key,
                node_name=first_node.title,
                node_valid=has_question_pdf,
                sort_order=sort_order,
                status="pending",
                pdf_type="question",
            ))
            sort_order += 1

            if first_node.answer_pdf_relpath:
                db.add(PrintQueue(
                    student_id=body.student_id,
                    student_name=student.name,
                    student_grade=student.grade,
                    material_key=mat_key,
                    material_name=linked_mat.name,
                    material_valid=True,
                    node_key=first_node.key,
                    node_name=first_node.title,
                    node_valid=True,
                    sort_order=sort_order,
                    status="pending",
                    pdf_type="answer",
                ))
                sort_order += 1

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

    # Also remove linked student_materials
    mat_result = await db.execute(
        select(ExamMaterial).where(ExamMaterial.id == exam_material_id)
        .options(selectinload(ExamMaterial.subjects))
    )
    mat = mat_result.scalars().first()
    if mat:
        for subj in mat.subjects:
            mat_key = f"試験:{mat.name}:{subj.subject_name}"
            await db.execute(
                delete(StudentMaterial).where(
                    StudentMaterial.student_id == student_id,
                    StudentMaterial.material_key == mat_key,
                )
            )

    await db.execute(
        delete(StudentExamAssignment).where(
            StudentExamAssignment.student_id == student_id,
            StudentExamAssignment.exam_material_id == exam_material_id,
        )
    )
    await db.commit()
    return {"status": "deleted"}
