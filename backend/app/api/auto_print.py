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
                    material_key=mat.key,
                    material_name=mat.name,
                    node_key=node.key,
                    node_title=node.title,
                    pdf_relpath=node.pdf_relpath,
                    duplex=node.duplex,
                    pointer=sm.pointer,
                ))
                break
    return items


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
    """Auto-queue next print items for specified students (or all students)."""
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

    queued = 0
    student_count = 0
    for student in students:
        next_items = _find_next_nodes(student)
        if next_items:
            student_count += 1
        for item in next_items:
            queue_entry = PrintQueue(
                student_id=item.student_id,
                student_name=item.student_name,
                material_key=item.material_key,
                material_name=item.material_name,
                node_key=item.node_key,
                node_name=item.node_title,
                sort_order=sort_order,
                status="pending",
                start_on=None,
            )
            db.add(queue_entry)
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
