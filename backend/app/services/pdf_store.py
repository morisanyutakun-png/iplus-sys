from pathlib import Path
import hashlib

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pdf_blob import PdfBlob
from app.services.pdf_paths import resolve_pdf_path


def _cache_root() -> Path:
    return Path("/tmp/iplus_pdf_cache")


def _cache_path(relpath: str) -> Path:
    digest = hashlib.sha256(relpath.encode("utf-8")).hexdigest()
    return _cache_root() / f"{digest}.pdf"


async def upsert_pdf_blob(
    db: AsyncSession,
    relpath: str,
    content: bytes,
    content_type: str = "application/pdf",
) -> None:
    if not relpath:
        return
    existing = await db.get(PdfBlob, relpath)
    if existing:
        existing.content = content
        existing.size = len(content)
        existing.content_type = content_type
        return
    db.add(
        PdfBlob(
            relpath=relpath,
            content=content,
            size=len(content),
            content_type=content_type,
        )
    )


async def delete_pdf_blob(db: AsyncSession, relpath: str) -> None:
    if not relpath:
        return
    existing = await db.get(PdfBlob, relpath)
    if existing:
        await db.delete(existing)


async def has_pdf_blob(db: AsyncSession, relpath: str) -> bool:
    if not relpath:
        return False
    return await db.get(PdfBlob, relpath) is not None


async def pdf_exists(db: AsyncSession, relpath: str) -> bool:
    if not relpath:
        return False
    if resolve_pdf_path(relpath):
        return True
    return await has_pdf_blob(db, relpath)


async def resolve_pdf_for_reading(db: AsyncSession, relpath: str) -> str | None:
    """Resolve to a filesystem path, materializing DB blob into cache when needed."""
    if not relpath:
        return None

    local = resolve_pdf_path(relpath)
    if local:
        return local

    blob = await db.get(PdfBlob, relpath)
    if not blob:
        return None

    cache_file = _cache_path(relpath)
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_bytes(blob.content)
    return str(cache_file)


async def list_pdf_blob_paths(db: AsyncSession) -> list[tuple[str, int]]:
    rows = (
        await db.execute(select(PdfBlob.relpath, PdfBlob.size).order_by(PdfBlob.relpath))
    ).all()
    return [(r[0], r[1]) for r in rows]
