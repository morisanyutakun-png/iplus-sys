from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.student import Student
from app.models.student_material import StudentMaterial
from app.models.material import Material, MaterialNode
from app.models.print_queue import PrintQueue
from app.models.print_log import PrintLog
from app.schemas.analytics import NextPrintItem, NextPrintsResponse, AutoQueueRequest, AutoQueueResponse
from app.schemas.progress import PrintLogOut
from app.services.print_ordering import material_sort_key

router = APIRouter()


def _find_next_nodes(student: Student) -> list[NextPrintItem]:
    """Find the next node to print for each of a student's assigned materials."""
    items = []
    for sm in student.materials:
        mat = sm.material
        if not mat:
            continue
        total = len(mat.nodes)
        if sm.pointer > total:
            continue  # completed
        for node in mat.nodes:
            if node.sort_order == sm.pointer:
                items.append(NextPrintItem(
                    student_id=student.id,
                    student_name=student.name,
                    student_grade=student.grade,
                    material_key=mat.key,
                    material_name=mat.name,
                    node_key=node.key,
                    node_title=node.title,
                    pdf_relpath=node.pdf_relpath,
                    answer_pdf_relpath=node.answer_pdf_relpath,
                    duplex=node.duplex,
                    pointer=sm.pointer,
                ))
                break
    # Sort by subject priority
    items.sort(key=lambda it: material_sort_key(it.material_key, _get_subject(it, student)))
    return items


def _get_subject(item: NextPrintItem, student: Student) -> str:
    """Get the subject for a NextPrintItem from the student's materials."""
    for sm in student.materials:
        if sm.material and sm.material.key == item.material_key:
            return sm.material.subject
    return "その他"


@router.get("/students/{student_id}/next-prints", response_model=NextPrintsResponse)
async def get_next_prints(student_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Student)
        .where(Student.id == student_id)
        .options(
            selectinload(Student.materials)
            .selectinload(StudentMaterial.material)
            .selectinload(Material.nodes)
        )
    )
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return NextPrintsResponse(items=_find_next_nodes(student))


@router.post("/auto-queue", response_model=AutoQueueResponse)
async def auto_queue(
    body: AutoQueueRequest = AutoQueueRequest(),
    db: AsyncSession = Depends(get_db),
):
    """Auto-queue next print items for specified students (or all students).

    print_mode: "both" (default), "questions_only", "answers_only"
    Ordering per student: all questions (by subject), then all answers (by subject).
    """
    query = select(Student).options(
        selectinload(Student.materials)
        .selectinload(StudentMaterial.material)
        .selectinload(Material.nodes)
    )
    if body.student_ids:
        query = query.where(Student.id.in_(body.student_ids))

    result = await db.execute(query)
    students = result.scalars().unique().all()

    # Get current max sort_order in queue
    max_order_result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PrintQueue.sort_order), 0))
    )
    sort_order = max_order_result.scalar() + 1

    print_mode = body.print_mode or "both"

    queued = 0
    student_count = 0
    for student in students:
        next_items = _find_next_nodes(student)  # already sorted by subject
        if not next_items:
            continue
        student_count += 1

        # Build queue entries: questions first, then answers
        entries_to_add: list[PrintQueue] = []

        if print_mode in ("both", "questions_only"):
            for item in next_items:
                has_question = bool(item.pdf_relpath)
                if has_question:
                    entries_to_add.append(PrintQueue(
                        student_id=item.student_id,
                        student_name=item.student_name,
                        student_grade=item.student_grade,
                        material_key=item.material_key,
                        material_name=item.material_name,
                        node_key=item.node_key,
                        node_name=item.node_title,
                        sort_order=0,  # will be set below
                        status="pending",
                        pdf_type="question",
                    ))

        if print_mode in ("both", "answers_only"):
            for item in next_items:
                has_answer = bool(item.answer_pdf_relpath)
                if has_answer:
                    entries_to_add.append(PrintQueue(
                        student_id=item.student_id,
                        student_name=item.student_name,
                        student_grade=item.student_grade,
                        material_key=item.material_key,
                        material_name=item.material_name,
                        node_key=item.node_key,
                        node_name=item.node_title,
                        sort_order=0,
                        status="pending",
                        pdf_type="answer",
                    ))

        for entry in entries_to_add:
            entry.sort_order = sort_order
            db.add(entry)
            sort_order += 1
            queued += 1

    await db.commit()
    return AutoQueueResponse(queued=queued, students=student_count)


@router.get("/students/{student_id}/print-history")
async def get_student_print_history(
    student_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PrintLog)
        .where(PrintLog.student_id == student_id)
        .order_by(PrintLog.created_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    return {"logs": [PrintLogOut.model_validate(l) for l in logs]}
