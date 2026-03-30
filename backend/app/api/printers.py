"""Printer discovery, registration, and management endpoints.

Separated from print_jobs.py to avoid FastAPI route shadowing
(the /{job_id} catch-all route was intercepting /printers requests).
"""
import re
import subprocess

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.models.configured_printer import ConfiguredPrinter

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def _normalize_host(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().rstrip(".").replace(".local", "")


def _parse_dnssd_uri(uri: str) -> tuple[str | None, str | None, int]:
    """Parse a dnssd:// URI and return (instance_name, scheme_hint, port).

    Example URI: dnssd://EPSON%20EW-M754T%20Series._ipps._tcp.local./?uuid=...
    Returns: ("EPSON EW-M754T Series", "ipps", 631)
    """
    from urllib.parse import urlparse, unquote

    if not uri.startswith("dnssd://"):
        return None, None, 0

    # Use netloc directly (not parsed.hostname) to preserve original case
    parsed = urlparse(uri)
    netloc = parsed.netloc or ""
    # Strip port suffix if present
    if ":" in netloc.rsplit(".", 1)[-1]:
        netloc, _, port_str = netloc.rpartition(":")
        port = int(port_str) if port_str.isdigit() else 631
    else:
        port = 631

    raw = unquote(netloc)
    if not raw:
        return None, None, 0

    # Extract service type to determine ipp vs ipps
    scheme_hint = "ipp"
    if "_ipps._tcp" in raw:
        scheme_hint = "ipps"

    # Instance name is everything before ._ipp(s)._tcp
    m = re.match(r"^(.+?)\._ipps?\._tcp", raw)
    instance_name = m.group(1).strip() if m else raw.split(".")[0]

    return instance_name, scheme_hint, port


def _parse_cups_device_uri_map() -> dict[str, str]:
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
                match = re.match(r"(.+?)のデバイス:\s+(.+)$", text)
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

    resolved_port = port or parsed.port or (631 if parsed.scheme in ("ipp", "ipps", "dnssd") else 0)
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
            if uri.startswith(("ipp://", "ipps://")):
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
            elif uri.startswith("dnssd://"):
                inst_name, scheme_hint, dnssd_port = _parse_dnssd_uri(uri)
                if inst_name:
                    _upsert_discovered_printer(
                        discovered,
                        instance_name=inst_name,
                        hostname=inst_name,
                        port=dnssd_port,
                        uri=uri,
                    )
    except Exception:
        pass

    # 4. Existing CUPS network printers (important fallback for printers visible in macOS settings)
    for cups_name, uri in cups_device_map.items():
        parsed = urlparse(uri)
        if parsed.scheme in ("ipp", "ipps"):
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
        elif parsed.scheme == "dnssd":
            # dnssd:// URIs — extract instance name, keep the CUPS device URI
            inst_name, scheme_hint, dnssd_port = _parse_dnssd_uri(uri)
            _upsert_discovered_printer(
                discovered,
                instance_name=inst_name or cups_name,
                hostname=cups_name,  # Use CUPS name as hostname key
                port=dnssd_port,
                uri=uri,
                cups_name=cups_name,
            )

    return list(discovered.values())


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/discover")
async def discover_printers(db: AsyncSession = Depends(get_db)):
    """Scan LAN for printers using Bonjour, ippfind, and lpinfo."""
    discovered = _discover_lan_printers()

    # Check CUPS registration
    cups_names: set[str] = set()
    try:
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


@router.post("/register")
async def register_printer(body: RegisterPrinterRequest, db: AsyncSession = Depends(get_db)):
    """Register a discovered LAN printer into CUPS and the database."""
    # Validate URI
    if not body.uri.startswith(("ipp://", "ipps://", "dnssd://")):
        raise HTTPException(status_code=422, detail="URIは ipp://, ipps://, または dnssd:// で始まる必要があります")

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

    # Check if already registered in CUPS (skip lpadmin if so)
    already_in_cups = False
    try:
        check = subprocess.run(
            ["lpstat", "-p", safe_name], capture_output=True, text=True, timeout=5,
        )
        if check.returncode == 0:
            already_in_cups = True
    except Exception:
        pass

    if already_in_cups:
        registered = True
    else:
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
            pass
        except subprocess.TimeoutExpired:
            pass

    # Save to DB
    if body.is_default:
        await db.execute(update(ConfiguredPrinter).values(is_default=False))
    printer = ConfiguredPrinter(name=safe_name, device_uri=body.uri, is_default=body.is_default)
    db.add(printer)
    await db.commit()

    return {"status": "ok", "name": safe_name, "uri": body.uri}


@router.get("")
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


@router.post("")
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


@router.delete("/{printer_name}")
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


@router.put("/{printer_name}/default")
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
