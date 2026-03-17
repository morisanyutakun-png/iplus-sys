import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.print_queue import PrintQueue
from app.models.print_job import PrintJob, PrintJobItem
from app.models.print_log import PrintLog
from app.models.student_material import StudentMaterial, ProgressHistory
from app.models.material import MaterialNode
from app.schemas.job import PrintJobOut, PrintJobListOut

router = APIRouter()


def _resolve_pdf_path(pdf_relpath: str) -> str | None:
    """Find the actual file path for a PDF across configured base directories and local storage."""
    if not pdf_relpath:
        return None
    # Check local PDF storage first
    local_path = os.path.join(settings.pdf_storage_dir, pdf_relpath)
    if os.path.isfile(local_path):
        return local_path
    # Check network shares
    for base_dir in settings.materials_base_dirs:
        full_path = os.path.join(base_dir, pdf_relpath)
        if os.path.isfile(full_path):
            return full_path
    return None


@router.get("", response_model=PrintJobListOut)
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PrintJob).order_by(PrintJob.created_at.desc()).limit(50)
    )
    jobs = result.scalars().all()
    return PrintJobListOut(
        jobs=[PrintJobOut(
            id=j.id, status=j.status, item_count=j.item_count,
            missing=j.missing, created_at=j.created_at, executed_at=j.executed_at,
        ) for j in jobs]
    )


@router.get("/{job_id}", response_model=PrintJobOut)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PrintJob)
        .where(PrintJob.id == job_id)
        .options(selectinload(PrintJob.items))
    )
    job = result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return PrintJobOut.model_validate(job)


@router.post("/prepare")
async def prepare_job(db: AsyncSession = Depends(get_db)):
    """Prepare a print job from current queue items."""
    result = await db.execute(
        select(PrintQueue)
        .where(PrintQueue.status == "pending")
        .order_by(PrintQueue.sort_order, PrintQueue.id)
    )
    queue_items = result.scalars().all()
    if not queue_items:
        raise HTTPException(status_code=400, detail="Queue is empty")

    now = datetime.now(timezone.utc)
    job_id = now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]

    missing_count = 0
    job_items = []
    for idx, qi in enumerate(queue_items):
        pdf_relpath = ""
        duplex = False
        range_text = ""
        start_on = qi.start_on

        if qi.node_key:
            result = await db.execute(
                select(MaterialNode).where(MaterialNode.key == qi.node_key)
            )
            node = result.scalars().first()
            if node:
                pdf_relpath = node.pdf_relpath
                duplex = node.duplex
                range_text = node.range_text

        resolved = _resolve_pdf_path(pdf_relpath)
        is_missing = resolved is None and pdf_relpath != ""

        if is_missing:
            missing_count += 1

        job_items.append(PrintJobItem(
            job_id=job_id,
            sort_order=idx,
            student_id=qi.student_id,
            student_name=qi.student_name,
            material_key=qi.material_key,
            material_name=qi.material_name,
            node_key=qi.node_key,
            node_name=qi.node_name,
            pdf_relpath=pdf_relpath,
            pdf_resolved=resolved,
            missing_pdf=is_missing,
            range_text=range_text,
            duplex=duplex,
            start_on=start_on,
        ))

    job = PrintJob(
        id=job_id,
        status="created",
        item_count=len(job_items),
        missing=missing_count,
    )
    db.add(job)
    for item in job_items:
        db.add(item)

    await db.commit()
    return {"job_id": job_id, "item_count": len(job_items), "missing": missing_count}


@router.post("/execute")
async def execute_print(body: dict = None, db: AsyncSession = Depends(get_db)):
    """Execute printing: prepare job if needed, advance pointers, clear queue."""
    import subprocess

    # Prepare job first
    result = await db.execute(
        select(PrintQueue)
        .where(PrintQueue.status == "pending")
        .order_by(PrintQueue.sort_order, PrintQueue.id)
    )
    queue_items = result.scalars().all()
    if not queue_items:
        raise HTTPException(status_code=400, detail="Queue is empty")

    now = datetime.now(timezone.utc)
    job_id = now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]

    results = []
    for idx, qi in enumerate(queue_items):
        pdf_relpath = ""
        duplex = False
        node = None

        if qi.node_key:
            node_result = await db.execute(
                select(MaterialNode).where(MaterialNode.key == qi.node_key)
            )
            node = node_result.scalars().first()
            if node:
                pdf_relpath = node.pdf_relpath
                duplex = node.duplex

        resolved = _resolve_pdf_path(pdf_relpath)
        success = False
        message = ""

        if resolved:
            try:
                cmd = [settings.printer_command, "-d", settings.printer_name]
                if duplex:
                    cmd += ["-o", "sides=two-sided-long-edge"]
                cmd.append(resolved)
                subprocess.run(cmd, check=True, capture_output=True, timeout=30)
                success = True
                message = "Sent to printer"
            except Exception as e:
                message = str(e)
        else:
            message = f"PDF not found: {pdf_relpath}"

        # Log
        log_entry = PrintLog(
            type="printed" if success else "failed",
            job_id=job_id,
            student_id=qi.student_id,
            student_name=qi.student_name,
            material_key=qi.material_key,
            material_name=qi.material_name,
            node_key=qi.node_key,
            node_name=qi.node_name,
            success=success,
            message=message,
        )
        db.add(log_entry)

        # Advance pointer if success
        if success:
            sm_result = await db.execute(
                select(StudentMaterial).where(
                    StudentMaterial.student_id == qi.student_id,
                    StudentMaterial.material_key == qi.material_key,
                )
            )
            sm = sm_result.scalars().first()
            if sm:
                old_pointer = sm.pointer
                sm.pointer = old_pointer + 1
                history = ProgressHistory(
                    student_id=qi.student_id,
                    material_key=qi.material_key,
                    node_key=qi.node_key,
                    action="print",
                    old_pointer=old_pointer,
                    new_pointer=old_pointer + 1,
                )
                db.add(history)

        results.append({
            "student": qi.student_name,
            "material": qi.material_name,
            "node": qi.node_name,
            "success": success,
            "message": message,
        })

    # Clear printed queue items
    await db.execute(delete(PrintQueue).where(PrintQueue.status == "pending"))
    await db.commit()

    return {"job_id": job_id, "results": results}
