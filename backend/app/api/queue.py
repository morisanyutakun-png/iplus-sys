from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select, delete, update, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.print_queue import PrintQueue
from app.models.student import Student
from app.models.material import Material, MaterialNode
from app.schemas.queue import QueueItemOut, QueueItemCreate, QueueItemUpdate, QueueReorder, QueueListOut

router = APIRouter()


async def _resolve_names(db: AsyncSession, student_id: str, material_key: str, node_key: str | None):
    """Resolve display names for student, material, and node."""
    student_name = None
    student_grade = None
    material_name = None
    node_name = None

    result = await db.execute(select(Student.name, Student.grade).where(Student.id == student_id))
    row = result.first()
    if row:
        student_name = row[0]
        student_grade = row[1]

    result = await db.execute(select(Material.name).where(Material.key == material_key))
    row = result.first()
    if row:
        material_name = row[0]

    if node_key:
        result = await db.execute(select(MaterialNode.title).where(MaterialNode.key == node_key))
        row = result.first()
        if row:
            node_name = row[0]

    return student_name, student_grade, material_name, node_name


@router.get("", response_model=QueueListOut)
async def list_queue(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PrintQueue).order_by(PrintQueue.sort_order, PrintQueue.id)
    )
    items = result.scalars().all()
    return QueueListOut(items=[QueueItemOut.model_validate(i) for i in items])


@router.post("", response_model=QueueItemOut)
async def add_to_queue(body: QueueItemCreate, db: AsyncSession = Depends(get_db)):
    student_name, student_grade, material_name, node_name = await _resolve_names(
        db, body.student_id, body.material_key, body.node_key
    )

    # Get next sort_order
    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PrintQueue.sort_order), -1))
    )
    max_order = result.scalar()

    item = PrintQueue(
        student_id=body.student_id,
        student_name=student_name,
        student_grade=student_grade,
        material_key=body.material_key,
        material_name=material_name,
        node_key=body.node_key,
        node_name=node_name,
        sort_order=max_order + 1,
        pdf_type=body.pdf_type,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return QueueItemOut.model_validate(item)


@router.put("/{item_id}", response_model=QueueItemOut)
async def update_queue_item(
    item_id: int, body: QueueItemUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(PrintQueue).where(PrintQueue.id == item_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    if body.student_id is not None:
        item.student_id = body.student_id
        result = await db.execute(select(Student.name, Student.grade).where(Student.id == body.student_id))
        row = result.first()
        item.student_name = row[0] if row else None
        item.student_grade = row[1] if row else None

    if body.material_key is not None:
        item.material_key = body.material_key
        result = await db.execute(select(Material.name).where(Material.key == body.material_key))
        row = result.first()
        item.material_name = row[0] if row else None

    if body.node_key is not None:
        item.node_key = body.node_key
        result = await db.execute(select(MaterialNode.title).where(MaterialNode.key == body.node_key))
        row = result.first()
        item.node_name = row[0] if row else None

    await db.commit()
    await db.refresh(item)
    return QueueItemOut.model_validate(item)


@router.delete("/all")
async def clear_queue(db: AsyncSession = Depends(get_db)):
    """Delete all items from the print queue."""
    result = await db.execute(delete(PrintQueue))
    await db.commit()
    return {"status": "cleared", "deleted": result.rowcount}


@router.delete("/student/{student_id}")
async def remove_student_from_queue(
    student_id: str,
    pdf_types: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Delete queue items for a specific student. Optionally filter by pdf_types (comma-separated)."""
    query = delete(PrintQueue).where(PrintQueue.student_id == student_id)
    if pdf_types:
        types_list = [t.strip() for t in pdf_types.split(",") if t.strip()]
        if types_list:
            query = query.where(PrintQueue.pdf_type.in_(types_list))
    result = await db.execute(query)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="該当する生徒のキューアイテムがありません")
    await db.commit()
    return {"status": "removed", "deleted": result.rowcount}


@router.delete("/{item_id}")
async def remove_from_queue(item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        delete(PrintQueue).where(PrintQueue.id == item_id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Queue item not found")
    await db.commit()
    return {"status": "removed"}


@router.post("/reorder")
async def reorder_queue(body: QueueReorder, db: AsyncSession = Depends(get_db)):
    for idx, item_id in enumerate(body.item_ids):
        await db.execute(
            update(PrintQueue).where(PrintQueue.id == item_id).values(sort_order=idx)
        )
    await db.commit()
    return {"status": "ok"}


@router.post("/upload")
async def upload_csv_to_queue(
    file: UploadFile = File(...), db: AsyncSession = Depends(get_db)
):
    import csv
    import io

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    result = await db.execute(
        select(sa_func.coalesce(sa_func.max(PrintQueue.sort_order), -1))
    )
    max_order = result.scalar()

    added = 0
    for row in reader:
        student_id = row.get("student_id", "").strip()
        material_key = row.get("material", "").strip()
        node_key = row.get("node", "").strip() or None
        if not student_id or not material_key:
            continue

        student_name, student_grade, material_name, node_name = await _resolve_names(
            db, student_id, material_key, node_key
        )
        max_order += 1
        item = PrintQueue(
            student_id=student_id,
            student_name=student_name,
            student_grade=student_grade,
            material_key=material_key,
            material_name=material_name,
            node_key=node_key,
            node_name=node_name,
            sort_order=max_order,
        )
        db.add(item)
        added += 1

    await db.commit()
    return {"status": "ok", "added": added}
