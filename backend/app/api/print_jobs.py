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
from app.models.configured_printer import ConfiguredPrinter
from app.schemas.job import PrintJobOut, PrintJobListOut
from app.services.pdf_store import pdf_exists, resolve_pdf_for_reading

router = APIRouter()


def _normalize_host(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().rstrip(".").replace(".local", "")


def _parse_cups_device_uri_map() -> dict[str, str]:
    import re
    import subprocess

    device_map: dict[str, str] = {}
    try:
        result = subprocess.run(
            ["lpstat", "-v"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            text = line.strip()
            if not text:
                continue
            match = re.match(r"device for\s+(.+?):\s+(.+)$", text)
            if not match:
                match = re.match(r"(.+?)\s+のデバイス:\s+(.+)$", text)
            if match:
                device_map[match.group(1).strip()] = match.group(2).strip()
    except Exception:
        pass
    return device_map


def _upsert_discovered_printer(
    discovered: dict[str, dict],
    *,
    instance_name: str,
    hostname: str | None,
    port: int | None,
    uri: str,
    cups_name: str | None = None,
) -> None:
    from urllib.parse import urlparse

    parsed = urlparse(uri)
    resolved_hostname = hostname or parsed.hostname
    if not resolved_hostname:
        return

    resolved_port = port or parsed.port or (631 if parsed.scheme in ("ipp", "ipps") else 0)
    key = _normalize_host(resolved_hostname)
    if not key:
        return

    entry = discovered.get(key)
    candidate = {
        "instance_name": instance_name or resolved_hostname,
        "hostname": resolved_hostname,
        "port": resolved_port,
        "uri": uri,
    }
    if cups_name:
        candidate["cups_name"] = cups_name

    if entry is None:
        discovered[key] = candidate
        return

    if len(candidate["instance_name"]) > len(entry.get("instance_name", "")):
        entry["instance_name"] = candidate["instance_name"]
    if not entry.get("cups_name") and candidate.get("cups_name"):
        entry["cups_name"] = candidate["cups_name"]
    if entry.get("uri", "").startswith("ipp://") and candidate["uri"].startswith("ipps://"):
        entry["uri"] = candidate["uri"]
        entry["port"] = candidate["port"]
    elif not entry.get("uri") and candidate.get("uri"):
        entry["uri"] = candidate["uri"]
        entry["port"] = candidate["port"]


def _detect_local_printers() -> tuple[list[dict], str | None]:
    """Detect locally connected printers via CUPS + LAN (best-effort)."""
    import subprocess
    import re

    printer_names: list[str] = []
    printer_status: dict[str, str] = {}
    system_default: str | None = None

    # lpstat -e (locale-independent name list)
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

    # lpstat -p for status (English + Japanese)
    try:
        result = subprocess.run(
            ["lpstat", "-p"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            name = None
            if line.startswith("printer "):
                name = line.split()[1]
            else:
                m = re.match(r"プリンタ(\S+?)(?:は|使用不可|が)", line)
                if m:
                    name = m.group(1)
            if not name:
                continue
            low = line.lower()
            if "idle" in low or "待機中" in line or "printing" in low or "印刷中" in line:
                printer_status[name] = "online"
            elif "disabled" in low or "使用不可" in line:
                printer_status[name] = "offline"
            else:
                printer_status[name] = "online"
            if name not in printer_names:
                printer_names.append(name)
    except Exception:
        pass

    # System default
    try:
        result = subprocess.run(
            ["lpstat", "-d"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            if ":" in line:
                system_default = line.split(":")[-1].strip()
    except Exception:
        pass

    # LAN discovery via ippfind
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

    printers = [{"name": n, "status": printer_status.get(n, "unknown")} for n in printer_names]
    return printers, system_default


def _discover_lan_printers() -> list[dict]:
    """Discover LAN printers using dns-sd (Bonjour), ippfind, and lpinfo."""
    import subprocess
    import re
    import time
    from urllib.parse import urlparse

    discovered: dict[str, dict] = {}  # key: hostname/IP -> printer info

    # Already registered in CUPS
    cups_names: set[str] = set()
    try:
        result = subprocess.run(
            ["lpstat", "-e"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            name = line.strip()
            if name:
                cups_names.add(name)
    except Exception:
        pass
    cups_device_map = _parse_cups_device_uri_map()

    # 1. dns-sd browse/resolve (Bonjour/mDNS — finds printers in standby)
    for service_type, scheme in (("_ipp._tcp", "ipp"), ("_ipps._tcp", "ipps")):
        try:
            proc = subprocess.Popen(
                ["dns-sd", "-B", service_type],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            time.sleep(4)
            proc.kill()
            stdout, _ = proc.communicate(timeout=3)

            instance_names: list[str] = []
            known_instances = {
                d.get("instance_name") for d in discovered.values() if d.get("instance_name")
            }
            for line in stdout.splitlines():
                parts = line.split()
                if len(parts) >= 7 and parts[1] == "Add":
                    instance_name = " ".join(parts[6:])
                    if instance_name and instance_name not in known_instances:
                        instance_names.append(instance_name)
                        known_instances.add(instance_name)

            for inst in instance_names:
                try:
                    rproc = subprocess.Popen(
                        ["dns-sd", "-L", inst, service_type, "local."],
                        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                    )
                    time.sleep(2)
                    rproc.kill()
                    rstdout, _ = rproc.communicate(timeout=2)

                    hostname = None
                    port = 631
                    for rline in rstdout.splitlines():
                        m = re.search(r"can be reached at\s+(\S+?):(\d+)", rline)
                        if m:
                            hostname = m.group(1)
                            port = int(m.group(2))
                            break
                    if hostname:
                        _upsert_discovered_printer(
                            discovered,
                            instance_name=inst,
                            hostname=hostname,
                            port=port,
                            uri=f"{scheme}://{hostname}:{port}/ipp/print",
                        )
                except Exception:
                    continue
        except Exception:
            pass

    # 2. ippfind (active IPP printers)
    try:
        result = subprocess.run(
            ["ippfind", "-T", "3"],
            capture_output=True, text=True, timeout=8,
        )
        for line in result.stdout.splitlines():
            uri = line.strip()
            if not uri:
                continue
            parsed = urlparse(uri)
            hostname = parsed.hostname
            port = parsed.port or 631
            if hostname:
                _upsert_discovered_printer(
                    discovered,
                    instance_name=hostname,
                    hostname=hostname,
                    port=port,
                    uri=uri,
                )
    except Exception:
        pass

    # 3. lpinfo -v (CUPS backend enumeration)
    try:
        result = subprocess.run(
            ["lpinfo", "-v"], capture_output=True, text=True, timeout=10,
        )
        for line in result.stdout.splitlines():
            line = line.strip()
            if not line.startswith("network "):
                continue
            uri = line[len("network "):].strip()
            if not uri.startswith(("ipp://", "ipps://")):
                continue
            parsed = urlparse(uri)
            hostname = parsed.hostname
            port = parsed.port or 631
            if hostname:
                _upsert_discovered_printer(
                    discovered,
                    instance_name=hostname,
                    hostname=hostname,
                    port=port,
                    uri=uri,
                )
    except Exception:
        pass

    # 4. Existing CUPS network printers (important fallback for printers visible in macOS settings)
    for cups_name, uri in cups_device_map.items():
        parsed = urlparse(uri)
        if parsed.scheme not in ("ipp", "ipps"):
            continue
        hostname = parsed.hostname
        if not hostname:
            continue
        _upsert_discovered_printer(
            discovered,
            instance_name=cups_name,
            hostname=hostname,
            port=parsed.port or 631,
            uri=uri,
            cups_name=cups_name,
        )

    return list(discovered.values())


@router.get("/printers/discover")
async def discover_printers(db: AsyncSession = Depends(get_db)):
    """Scan LAN for printers using Bonjour, ippfind, and lpinfo."""
    discovered = _discover_lan_printers()

    # Check CUPS registration
    cups_names: set[str] = set()
    try:
        import subprocess
        result = subprocess.run(
            ["lpstat", "-e"], capture_output=True, text=True, timeout=5,
        )
        for line in result.stdout.splitlines():
            name = line.strip()
            if name:
                cups_names.add(name)
    except Exception:
        pass

    # Check DB registration
    db_result = await db.execute(select(ConfiguredPrinter))
    configured_names = {cp.name for cp in db_result.scalars().all()}
    configured_uris = set()
    for cp in (await db.execute(select(ConfiguredPrinter))).scalars().all():
        if cp.device_uri:
            configured_uris.add(cp.device_uri)

    for p in discovered:
        # Check if already in CUPS by matching hostname in any CUPS printer name
        normalized_host = _normalize_host(p.get("hostname"))
        p["already_in_cups"] = bool(p.get("cups_name")) or any(
            normalized_host and normalized_host in _normalize_host(cn)
            for cn in cups_names
        ) or any(cn in p.get("instance_name", "") for cn in cups_names)
        p["already_configured"] = (
            p.get("uri", "") in configured_uris
            or p.get("instance_name", "") in configured_names
            or p.get("cups_name", "") in configured_names
        )

    return {"discovered": discovered}


class RegisterPrinterRequest(BaseModel):
    uri: str
    name: str
    is_default: bool = False


@router.post("/printers/register")
async def register_printer(body: RegisterPrinterRequest, db: AsyncSession = Depends(get_db)):
    """Register a discovered LAN printer into CUPS and the database."""
    import subprocess
    import re

    # Validate URI
    if not body.uri.startswith(("ipp://", "ipps://")):
        raise HTTPException(status_code=422, detail="URIは ipp:// または ipps:// で始まる必要があります")

    # Sanitize name for CUPS (alphanumeric, hyphens, underscores only)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", body.name)
    if not safe_name:
        raise HTTPException(status_code=422, detail="無効なプリンタ名です")

    # Check DB duplicate
    existing = await db.execute(
        select(ConfiguredPrinter).where(ConfiguredPrinter.name == safe_name)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="このプリンタは既に登録されています")

    # Register in CUPS via lpadmin
    registered = False
    error_msg = ""

    # Try driverless first (-m everywhere)
    try:
        result = subprocess.run(
            ["lpadmin", "-p", safe_name, "-v", body.uri, "-m", "everywhere", "-E"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            registered = True
        else:
            error_msg = result.stderr.strip()
    except Exception as e:
        error_msg = str(e)

    # Fallback to raw driver
    if not registered:
        try:
            result = subprocess.run(
                ["lpadmin", "-p", safe_name, "-v", body.uri, "-m", "raw", "-E"],
                capture_output=True, text=True, timeout=15,
            )
            if result.returncode == 0:
                registered = True
            else:
                error_msg = result.stderr.strip()
        except Exception as e:
            error_msg = str(e)

    if not registered:
        raise HTTPException(
            status_code=422,
            detail=f"CUPSへの登録に失敗しました: {error_msg}",
        )

    # Verify with lpstat
    try:
        check = subprocess.run(
            ["lpstat", "-p", safe_name], capture_output=True, text=True, timeout=5,
        )
        if check.returncode != 0:
            raise HTTPException(
                status_code=422,
                detail=f"プリンタは追加されましたが、状態確認に失敗しました: {check.stderr.strip()}",
            )
    except FileNotFoundError:
        # lpstat not available in minimal images — allow registration to proceed
        pass
    except subprocess.TimeoutExpired:
        pass  # Printer added but status check timed out — proceed anyway

    # Save to DB
    if body.is_default:
        await db.execute(update(ConfiguredPrinter).values(is_default=False))
    printer = ConfiguredPrinter(name=safe_name, device_uri=body.uri, is_default=body.is_default)
    db.add(printer)
    await db.commit()

    return {"status": "ok", "name": safe_name, "uri": body.uri}


@router.get("/printers")
async def list_printers(db: AsyncSession = Depends(get_db)):
    """List printers from DB (configured) + local detection (if available)."""
    # 1. DB-configured printers (primary source — works on cloud)
    result = await db.execute(
        select(ConfiguredPrinter).order_by(ConfiguredPrinter.id)
    )
    configured = result.scalars().all()

    db_printers = []
    db_default: str | None = None
    db_names = set()
    for cp in configured:
        db_printers.append({"name": cp.name, "status": "configured"})
        db_names.add(cp.name)
        if cp.is_default:
            db_default = cp.name

    # 2. Local detection (best-effort — may fail on cloud)
    local_printers, system_default = _detect_local_printers()

    # Merge: DB printers first, then local printers not already in DB
    for lp in local_printers:
        if lp["name"] not in db_names:
            db_printers.append(lp)
            db_names.add(lp["name"])

    default_printer = db_default or system_default or (db_printers[0]["name"] if db_printers else settings.printer_name)

    return {"printers": db_printers, "default": default_printer}


class AddPrinterRequest(BaseModel):
    name: str
    is_default: bool = False


@router.post("/printers")
async def add_printer(body: AddPrinterRequest, db: AsyncSession = Depends(get_db)):
    """Add a printer to the configured list."""
    # Check duplicate
    existing = await db.execute(
        select(ConfiguredPrinter).where(ConfiguredPrinter.name == body.name)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="このプリンタは既に登録されています")

    # If setting as default, clear other defaults
    if body.is_default:
        await db.execute(
            update(ConfiguredPrinter).values(is_default=False)
        )

    printer = ConfiguredPrinter(name=body.name, is_default=body.is_default)
    db.add(printer)
    await db.commit()
    return {"status": "ok", "name": body.name}


@router.delete("/printers/{printer_name}")
async def remove_printer(printer_name: str, db: AsyncSession = Depends(get_db)):
    """Remove a printer from the configured list."""
    result = await db.execute(
        select(ConfiguredPrinter).where(ConfiguredPrinter.name == printer_name)
    )
    printer = result.scalars().first()
    if not printer:
        raise HTTPException(status_code=404, detail="プリンタが見つかりません")
    await db.delete(printer)
    await db.commit()
    return {"status": "deleted", "name": printer_name}


@router.put("/printers/{printer_name}/default")
async def set_default_printer(printer_name: str, db: AsyncSession = Depends(get_db)):
    """Set a printer as the default."""
    result = await db.execute(
        select(ConfiguredPrinter).where(ConfiguredPrinter.name == printer_name)
    )
    printer = result.scalars().first()
    if not printer:
        # Auto-register if not in DB yet
        printer = ConfiguredPrinter(name=printer_name, is_default=True)
        db.add(printer)
    # Clear all defaults, then set this one
    await db.execute(update(ConfiguredPrinter).values(is_default=False))
    printer.is_default = True
    await db.commit()
    return {"status": "ok", "default": printer_name}


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
    resolved = await resolve_pdf_for_reading(db, node.pdf_relpath)
    if not resolved:
        raise HTTPException(
            status_code=404,
            detail=f"PDFファイルが存在しません: {node.pdf_relpath}",
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

    job_items: list[PrintJobItem] = []
    queue_ids: list[int] = []
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
        ))
        queue_ids.append(qi.id)

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
