import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pydantic import BaseModel
from typing import Optional, Literal

from app.config import settings
from app.database import get_db
from app.models.print_queue import PrintQueue
from app.models.print_job import PrintJob, PrintJobItem
from app.models.print_log import PrintLog
from app.models.student_material import StudentMaterial, ProgressHistory
from app.models.material import MaterialNode
from app.schemas.job import PrintJobOut, PrintJobListOut
from app.services.pdf_store import pdf_exists, resolve_pdf_for_reading

router = APIRouter()


class MergePreviewRequest(BaseModel):
    student_ids: Optional[list[str]] = None
    pdf_types: Optional[list[str]] = None


@router.post("/merge-preview")
async def merge_preview(body: MergePreviewRequest = None, db: AsyncSession = Depends(get_db)):
    """Merge all pending queue PDFs into a single PDF and return it."""
    from fastapi.responses import Response
    from pypdf import PdfWriter

    body = body or MergePreviewRequest()

    query = select(PrintQueue).where(PrintQueue.status == "pending")
    if body.student_ids:
        query = query.where(PrintQueue.student_id.in_(body.student_ids))
    if body.pdf_types:
        query = query.where(PrintQueue.pdf_type.in_(body.pdf_types))

    result = await db.execute(query.order_by(PrintQueue.sort_order, PrintQueue.id))
    queue_items = result.scalars().all()
    if not queue_items:
        raise HTTPException(status_code=400, detail="キューが空です")

    writer = PdfWriter()
    missing: list[str] = []

    for qi in queue_items:
        pdf_relpath = ""
        if qi.generated_pdf:
            pdf_relpath = qi.generated_pdf
        elif qi.node_key:
            node_result = await db.execute(
                select(MaterialNode).where(MaterialNode.key == qi.node_key)
            )
            node = node_result.scalars().first()
            if node:
                if qi.pdf_type == "recheck_question":
                    pdf_relpath = node.recheck_pdf_relpath
                elif qi.pdf_type == "recheck_answer":
                    pdf_relpath = node.recheck_answer_pdf_relpath
                elif qi.pdf_type == "answer":
                    pdf_relpath = qi.generated_pdf or node.answer_pdf_relpath
                else:
                    pdf_relpath = qi.generated_pdf or node.pdf_relpath

        if not pdf_relpath:
            missing.append(f"{qi.student_name}: {qi.material_name}/{qi.node_name}")
            continue

        resolved = await resolve_pdf_for_reading(db, pdf_relpath)
        if not resolved:
            missing.append(f"{qi.student_name}: {qi.material_name}/{qi.node_name}")
            continue

        try:
            writer.append(resolved)
        except Exception:
            missing.append(f"{qi.student_name}: {qi.material_name}/{qi.node_name} (読み取りエラー)")

    if len(writer.pages) == 0:
        raise HTTPException(
            status_code=404,
            detail=f"印刷可能なPDFがありません。不足: {', '.join(missing)}"
        )

    import io
    buf = io.BytesIO()
    writer.write(buf)
    pdf_bytes = buf.getvalue()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline; filename=print_preview.pdf",
            "X-Missing-Count": str(len(missing)),
        },
    )


@router.get("/preview/queue/{item_id}")
async def preview_queue_item_pdf(item_id: int, db: AsyncSession = Depends(get_db)):
    """Serve a PDF preview for a specific queue item (supports generated_pdf for word tests)."""
    from fastapi.responses import FileResponse

    result = await db.execute(
        select(PrintQueue).where(PrintQueue.id == item_id)
    )
    qi = result.scalars().first()
    if not qi:
        raise HTTPException(status_code=404, detail="キューアイテムが見つかりません")

    # Try generated_pdf first (word tests), then fall back to node-based lookup
    relpath = None
    if qi.generated_pdf:
        relpath = qi.generated_pdf
    elif qi.node_key:
        node_result = await db.execute(
            select(MaterialNode).where(MaterialNode.key == qi.node_key)
        )
        node = node_result.scalars().first()
        if node:
            if qi.pdf_type == "recheck_question":
                relpath = node.recheck_pdf_relpath
            elif qi.pdf_type == "recheck_answer":
                relpath = node.recheck_answer_pdf_relpath
            elif qi.pdf_type == "answer":
                relpath = node.answer_pdf_relpath
            else:
                relpath = node.pdf_relpath

    if not relpath:
        raise HTTPException(status_code=404, detail="PDFが見つかりません")
    resolved = await resolve_pdf_for_reading(db, relpath)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail=f"PDFファイルが存在しません: {relpath}",
        )
    return FileResponse(resolved, media_type="application/pdf")


@router.get("/preview/{node_key}")
async def preview_pdf(node_key: str, pdf_type: str = "question", db: AsyncSession = Depends(get_db)):
    """Serve a PDF file for preview by node_key. Use ?pdf_type=answer for answer PDF."""
    from fastapi.responses import FileResponse

    result = await db.execute(
        select(MaterialNode).where(MaterialNode.key == node_key)
    )
    node = result.scalars().first()
    if not node:
        raise HTTPException(status_code=404, detail="PDFが見つかりません")

    if pdf_type == "recheck_question":
        relpath = node.recheck_pdf_relpath
    elif pdf_type == "recheck_answer":
        relpath = node.recheck_answer_pdf_relpath
    elif pdf_type == "answer":
        relpath = node.answer_pdf_relpath
    else:
        relpath = node.pdf_relpath
    if not relpath:
        raise HTTPException(status_code=404, detail="PDFが見つかりません")
    resolved = await resolve_pdf_for_reading(db, relpath)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail=f"PDFファイルが存在しません: {relpath}",
        )
    return FileResponse(resolved, media_type="application/pdf")


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
                if qi.pdf_type == "recheck_question":
                    pdf_relpath = node.recheck_pdf_relpath
                elif qi.pdf_type == "recheck_answer":
                    pdf_relpath = node.recheck_answer_pdf_relpath
                elif qi.pdf_type == "answer":
                    pdf_relpath = qi.generated_pdf or node.answer_pdf_relpath
                else:
                    pdf_relpath = qi.generated_pdf or node.pdf_relpath
                duplex = node.duplex
                range_text = node.range_text

        resolved = await resolve_pdf_for_reading(db, pdf_relpath)
        is_missing = (not await pdf_exists(db, pdf_relpath)) if pdf_relpath else False

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
            pdf_type=qi.pdf_type,
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


class ExecuteRequest(BaseModel):
    printer_name: Optional[str] = None
    student_ids: Optional[list[str]] = None
    pdf_types: Optional[list[str]] = None  # e.g. ["question","recheck_question"] or ["answer","recheck_answer"]
    agent_id: Optional[str] = None  # for logging when using agent mode
    use_agent: Optional[bool] = None


class AgentAckItem(BaseModel):
    item_id: int
    success: bool
    message: str = ""


class AgentAckRequest(BaseModel):
    job_id: str
    status: Literal["done", "failed"]
    results: list[AgentAckItem]
    agent_id: Optional[str] = None


@router.post("/execute")
async def execute_print(body: ExecuteRequest = None, db: AsyncSession = Depends(get_db)):
    """Prepare a print job. If settings.use_print_agent=True, queue for agent pickup; otherwise print immediately."""
    import subprocess

    body = body or ExecuteRequest()
    printer = body.printer_name or settings.printer_name
    use_agent = body.use_agent if body.use_agent is not None else settings.use_print_agent

    if not use_agent:
        try:
            check = subprocess.run(
                ["lpstat", "-p", printer], capture_output=True, text=True, timeout=5
            )
            output = check.stdout
            if "disabled" in output.lower() or "使用不可" in output or check.returncode != 0:
                raise HTTPException(
                    status_code=503,
                    detail=f"プリンタ '{printer}' はオフラインまたは無効です。オンラインを確認してから再実行してください。",
                )
        except FileNotFoundError:
            if not use_agent:
                raise HTTPException(status_code=503, detail="lpstatコマンドが見つかりません")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=503, detail="プリンタ状態の確認がタイムアウトしました")

    # Prepare job — optionally filter by student_ids and pdf_types
    query = select(PrintQueue).where(PrintQueue.status == "pending")
    if body.student_ids:
        query = query.where(PrintQueue.student_id.in_(body.student_ids))
    if body.pdf_types:
        query = query.where(PrintQueue.pdf_type.in_(body.pdf_types))
    result = await db.execute(query.order_by(PrintQueue.sort_order, PrintQueue.id))
    queue_items = result.scalars().all()
    if not queue_items:
        raise HTTPException(status_code=400, detail="Queue is empty")

    now = datetime.now(timezone.utc)
    job_id = now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]

    job_items: list[PrintJobItem] = []
    queue_ids: list[int] = []
    queue_pdf_types: list[str] = []
    missing_count = 0

    for idx, qi in enumerate(queue_items):
        pdf_relpath = ""
        duplex = False
        range_text = ""
        start_on = qi.start_on

        if qi.node_key:
            node_result = await db.execute(
                select(MaterialNode).where(MaterialNode.key == qi.node_key)
            )
            node = node_result.scalars().first()
            if node:
                if qi.pdf_type == "recheck_question":
                    pdf_relpath = node.recheck_pdf_relpath
                elif qi.pdf_type == "recheck_answer":
                    pdf_relpath = node.recheck_answer_pdf_relpath
                elif qi.pdf_type == "answer":
                    pdf_relpath = qi.generated_pdf or node.answer_pdf_relpath
                else:
                    pdf_relpath = qi.generated_pdf or node.pdf_relpath
                duplex = node.duplex
                range_text = node.range_text

        resolved = await resolve_pdf_for_reading(db, pdf_relpath)
        is_missing = (not await pdf_exists(db, pdf_relpath)) if pdf_relpath else False
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
            pdf_type=qi.pdf_type,
        ))
        queue_ids.append(qi.id)
        queue_pdf_types.append(qi.pdf_type)

    job_status = "queued" if use_agent else "created"
    job = PrintJob(
        id=job_id,
        status=job_status,
        printer_name=printer,
        item_count=len(job_items),
        missing=missing_count,
    )
    db.add(job)
    for item in job_items:
        db.add(item)

    await db.execute(
        update(PrintQueue)
        .where(PrintQueue.id.in_(queue_ids))
        .values(status="queued", generated_job_id=job_id)
    )

    await db.commit()

    if use_agent:
        return {"job_id": job_id, "status": "queued", "item_count": len(job_items), "missing": missing_count}

    # Build a set of (student_id, material_key, node_key) that have an answer item
    # so we know to skip pointer advancement on the question item
    answer_keys = set()
    for qi in queue_items:
        if qi.pdf_type in ("answer", "recheck_answer"):
            answer_keys.add((qi.student_id, qi.material_key, qi.node_key))

    # Legacy direct-print path
    results = []
    success_ids = []
    for idx, item in enumerate(job_items):
        success = False
        message = ""

        if item.pdf_resolved:
            try:
                cmd = [settings.printer_command, "-d", printer]
                if item.duplex:
                    cmd += ["-o", "sides=two-sided-long-edge"]
                cmd.append(item.pdf_resolved)
                subprocess.run(cmd, check=True, capture_output=True, timeout=30)
                success = True
                message = "Sent to printer"
            except Exception as e:
                message = str(e)
        else:
            message = f"PDF not found: {item.pdf_relpath}"

        log_entry = PrintLog(
            type="printed" if success else "failed",
            job_id=job_id,
            student_id=item.student_id,
            student_name=item.student_name,
            material_key=item.material_key,
            material_name=item.material_name,
            node_key=item.node_key,
            node_name=item.node_name,
            success=success,
            message=message,
        )
        db.add(log_entry)

        if success:
            success_ids.append(queue_ids[idx])
            # Only advance pointer on the last item for this node
            # If both question+answer exist, advance on answer only
            item_pdf_type = queue_pdf_types[idx]
            should_advance = True
            if item_pdf_type in ("question", "recheck_question") and (item.student_id, item.material_key, item.node_key) in answer_keys:
                should_advance = False  # will advance when answer prints

            if should_advance:
                sm_result = await db.execute(
                    select(StudentMaterial).where(
                        StudentMaterial.student_id == item.student_id,
                        StudentMaterial.material_key == item.material_key,
                    )
                )
                sm = sm_result.scalars().first()
                if sm:
                    old_pointer = sm.pointer
                    sm.pointer = old_pointer + 1
                    history = ProgressHistory(
                        student_id=item.student_id,
                        material_key=item.material_key,
                        node_key=item.node_key,
                        action="print",
                        old_pointer=old_pointer,
                        new_pointer=old_pointer + 1,
                    )
                    db.add(history)

        results.append({
            "student": item.student_name,
            "material": item.material_name,
            "node": item.node_name,
            "pdf_type": queue_pdf_types[idx],
            "success": success,
            "message": message,
        })

    if success_ids:
        await db.execute(delete(PrintQueue).where(PrintQueue.id.in_(success_ids)))
    job.status = "done"
    job.executed_at = datetime.now(timezone.utc)
    await db.commit()

    return {"job_id": job_id, "results": results}


@router.get("/agent/poll")
async def agent_poll(limit: int = 5, db: AsyncSession = Depends(get_db)):
    """Agent pulls queued jobs to execute inside LAN."""
    result = await db.execute(
        select(PrintJob)
        .where(PrintJob.status == "queued")
        .order_by(PrintJob.created_at)
        .options(selectinload(PrintJob.items))
        .limit(limit)
    )
    jobs = result.scalars().all()
    payload: list[dict] = []
    job_ids = [job.id for job in jobs]
    if job_ids:
        await db.execute(
            update(PrintJob).where(PrintJob.id.in_(job_ids)).values(status="processing")
        )
        await db.commit()
    for job in jobs:
        items = []
        for item in job.items:
            items.append({
                "id": item.id,
                "sort_order": item.sort_order,
                "student_name": item.student_name,
                "material_name": item.material_name,
                "node_name": item.node_name,
                "pdf_resolved": item.pdf_resolved,
                "pdf_relpath": item.pdf_relpath,
                "duplex": item.duplex,
                "range_text": item.range_text,
                "pdf_type": item.pdf_type,
            })
        payload.append({
            "job_id": job.id,
            "printer_name": job.printer_name or settings.printer_name,
            "items": items,
        })
    return {"jobs": payload}


@router.post("/agent/ack")
async def agent_ack(body: AgentAckRequest, db: AsyncSession = Depends(get_db)):
    """Agent reports results after printing."""
    job_result = await db.execute(
        select(PrintJob)
        .where(PrintJob.id == body.job_id)
        .options(selectinload(PrintJob.items))
    )
    job = job_result.scalars().first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    items_by_id = {item.id: item for item in job.items}

    # Build set of (student_id, material_key, node_key) that have answer items
    answer_keys = set()
    for item in job.items:
        if item.pdf_type in ("answer", "recheck_answer"):
            answer_keys.add((item.student_id, item.material_key, item.node_key))

    for res in body.results:
        item = items_by_id.get(res.item_id)
        if not item:
            continue
        log_entry = PrintLog(
            type="printed" if res.success else "failed",
            job_id=job.id,
            student_id=item.student_id,
            student_name=item.student_name,
            material_key=item.material_key,
            material_name=item.material_name,
            node_key=item.node_key,
            node_name=item.node_name,
            success=res.success,
            message=res.message,
        )
        db.add(log_entry)

        if res.success:
            # Only advance pointer on the last item for this node
            should_advance = True
            if item.pdf_type in ("question", "recheck_question") and (item.student_id, item.material_key, item.node_key) in answer_keys:
                should_advance = False

            if should_advance:
                sm_result = await db.execute(
                    select(StudentMaterial).where(
                        StudentMaterial.student_id == item.student_id,
                        StudentMaterial.material_key == item.material_key,
                    )
                )
                sm = sm_result.scalars().first()
                if sm:
                    old_pointer = sm.pointer
                    sm.pointer = old_pointer + 1
                    history = ProgressHistory(
                        student_id=item.student_id,
                        material_key=item.material_key,
                        node_key=item.node_key,
                        action="print",
                        old_pointer=old_pointer,
                        new_pointer=old_pointer + 1,
                    )
                    db.add(history)

    await db.execute(
        delete(PrintQueue).where(PrintQueue.generated_job_id == job.id)
    )

    job.status = body.status
    job.executed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": body.status, "job_id": job.id}


# /{job_id} MUST be the last GET route to avoid shadowing other paths
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
