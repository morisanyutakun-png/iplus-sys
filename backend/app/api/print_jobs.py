import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from pydantic import BaseModel
from typing import Optional

from app.config import settings
from app.database import get_db
from app.models.print_queue import PrintQueue
from app.models.print_job import PrintJob, PrintJobItem
from app.models.print_log import PrintLog
from app.models.student_material import StudentMaterial, ProgressHistory
from app.models.material import MaterialNode
from app.schemas.job import PrintJobOut, PrintJobListOut

router = APIRouter()


@router.get("/printers")
async def list_printers():
    """List available printers via CUPS + LAN discovery.

    lpstat output is locale-dependent (Japanese on this system), so we use
    lpstat -e (locale-independent name list) for discovery and lpstat -p
    with locale-aware parsing for status.
    """
    import subprocess
    import re

    printer_names: list[str] = []
    printer_status: dict[str, str] = {}
    system_default: str | None = None

    # Step 1: Get printer names via lpstat -e (locale-independent, just names)
    try:
        result = subprocess.run(
            ["lpstat", "-e"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            name = line.strip()
            if name:
                printer_names.append(name)
    except Exception:
        pass

    # Step 2: Get status via lpstat -p (handles both English and Japanese)
    # English: "printer PrinterName is idle."  /  "printer PrinterName disabled ..."
    # Japanese: "プリンタPrinterNameは待機中です"  /  "プリンタPrinterName使用不可..."
    try:
        result = subprocess.run(
            ["lpstat", "-p"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            # Extract printer name: try English format first, then Japanese
            name = None
            if line.startswith("printer "):
                name = line.split()[1]
            else:
                # Japanese: "プリンタ<NAME>は..." or "プリンタ<NAME> ..."
                m = re.match(r"プリンタ(\S+?)(?:は|使用不可|が)", line)
                if m:
                    name = m.group(1)
            if not name:
                continue

            # Determine status from line content
            low = line.lower()
            if "idle" in low or "待機中" in line or "printing" in low or "印刷中" in line:
                printer_status[name] = "online"
            elif "disabled" in low or "使用不可" in line:
                printer_status[name] = "offline"
            else:
                printer_status[name] = "online"

            # If lpstat -e failed, collect names from here
            if name not in printer_names:
                printer_names.append(name)
    except Exception:
        pass

    # Step 3: Get system default printer
    try:
        result = subprocess.run(
            ["lpstat", "-d"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            if ":" in line:
                system_default = line.split(":")[-1].strip()
    except Exception:
        pass

    # Step 4: LAN printer discovery via ippfind (flag is -T, not --timeout)
    try:
        from urllib.parse import urlparse
        result = subprocess.run(
            ["ippfind", "-T", "3"],
            capture_output=True, text=True, timeout=8
        )
        known_set = set(printer_names)
        for line in result.stdout.splitlines():
            uri = line.strip()
            if not uri:
                continue
            parsed = urlparse(uri)
            display_name = parsed.hostname or uri
            if display_name not in known_set:
                printer_names.append(display_name)
                printer_status[display_name] = "network"
                known_set.add(display_name)
    except Exception:
        pass

    # Build response
    printers = []
    for name in printer_names:
        status = printer_status.get(name, "unknown")
        printers.append({"name": name, "status": status})

    default_printer = system_default or (printer_names[0] if printer_names else settings.printer_name)

    return {"printers": printers, "default": default_printer}


@router.get("/preview/{node_key}")
async def preview_pdf(node_key: str, db: AsyncSession = Depends(get_db)):
    """Serve a PDF file for preview by node_key."""
    from fastapi.responses import FileResponse

    result = await db.execute(
        select(MaterialNode).where(MaterialNode.key == node_key)
    )
    node = result.scalars().first()
    if not node or not node.pdf_relpath:
        raise HTTPException(status_code=404, detail="PDFが見つかりません")
    resolved = _resolve_pdf_path(node.pdf_relpath)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail=f"PDFファイルが存在しません: {node.pdf_relpath}",
        )
    return FileResponse(resolved, media_type="application/pdf")


def _resolve_pdf_path(pdf_relpath: str) -> str | None:
    """Find the actual file path for a PDF across configured base directories and local storage."""
    if not pdf_relpath:
        return None
    # Check local PDF storage first
    local_path = os.path.join(settings.pdf_storage_dir, pdf_relpath)
    if os.path.isfile(local_path):
        return local_path
    # Check network shares
    for base_dir in settings.materials_base_dirs_list:
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


class ExecuteRequest(BaseModel):
    printer_name: Optional[str] = None
    student_ids: Optional[list[str]] = None


@router.post("/execute")
async def execute_print(body: ExecuteRequest = None, db: AsyncSession = Depends(get_db)):
    """Execute printing: prepare job if needed, advance pointers, clear queue."""
    import subprocess

    body = body or ExecuteRequest()
    printer = body.printer_name or settings.printer_name

    # Check printer is online before sending
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
        raise HTTPException(status_code=503, detail="lpstatコマンドが見つかりません")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=503, detail="プリンタ状態の確認がタイムアウトしました")

    # Prepare job — optionally filter by student_ids
    query = select(PrintQueue).where(PrintQueue.status == "pending")
    if body.student_ids:
        query = query.where(PrintQueue.student_id.in_(body.student_ids))
    result = await db.execute(query.order_by(PrintQueue.sort_order, PrintQueue.id))
    queue_items = result.scalars().all()
    if not queue_items:
        raise HTTPException(status_code=400, detail="Queue is empty")

    now = datetime.now(timezone.utc)
    job_id = now.strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:8]

    results = []
    success_ids = []
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
                cmd = [settings.printer_command, "-d", printer]
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
            success_ids.append(qi.id)
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

    # Only remove successfully printed items from queue
    if success_ids:
        await db.execute(delete(PrintQueue).where(PrintQueue.id.in_(success_ids)))
    await db.commit()

    return {"job_id": job_id, "results": results}
