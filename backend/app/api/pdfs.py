import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from fastapi.responses import FileResponse
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.pdf_blob import PdfBlob
from app.services.pdf_store import (
    delete_pdf_blob,
    list_pdf_blob_paths,
    resolve_pdf_for_reading,
    upsert_pdf_blob,
)

router = APIRouter()


def _storage_root() -> Path:
    return Path(settings.pdf_storage_dir)


def _safe_path(relpath: str) -> Path:
    """Resolve path and ensure it stays within storage root."""
    root = _storage_root().resolve()
    target = (root / relpath).resolve()
    if not str(target).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid path")
    return target


@router.get("")
async def list_pdfs(prefix: str = "", db: AsyncSession = Depends(get_db)):
    """List PDF files under the storage directory, optionally filtered by prefix."""
    prefix = prefix.strip("/")
    root = _storage_root()
    search_dir = _safe_path(prefix) if prefix else root

    files: dict[str, dict] = {}
    directories: dict[str, dict] = {}

    if search_dir.exists():
        for entry in sorted(search_dir.iterdir()):
            rel = str(entry.relative_to(root))
            if entry.is_dir():
                directories[rel] = {"name": entry.name, "path": rel}
            elif entry.suffix.lower() == ".pdf":
                files[rel] = {
                    "name": entry.name,
                    "path": rel,
                    "size": entry.stat().st_size,
                }

    blob_paths = await list_pdf_blob_paths(db)
    for relpath, size in blob_paths:
        relpath = relpath.strip("/")
        if prefix:
            if not (relpath == prefix or relpath.startswith(prefix + "/")):
                continue
            tail = relpath[len(prefix):].lstrip("/")
        else:
            tail = relpath

        if not tail:
            continue
        if "/" in tail:
            child_dir = tail.split("/", 1)[0]
            rel_dir = f"{prefix}/{child_dir}" if prefix else child_dir
            directories.setdefault(rel_dir, {"name": child_dir, "path": rel_dir})
            continue

        files.setdefault(
            relpath,
            {
                "name": Path(relpath).name,
                "path": relpath,
                "size": size,
            },
        )

    return {
        "files": sorted(files.values(), key=lambda x: x["path"]),
        "directories": sorted(directories.values(), key=lambda x: x["path"]),
    }


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    material_key: str = Query("", description="Material key for subfolder"),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF file to storage."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    content = await file.read()

    subdir = material_key if material_key else ""
    target_dir = _safe_path(subdir) if subdir else _storage_root()
    target_dir.mkdir(parents=True, exist_ok=True)

    target_file = target_dir / file.filename
    with open(target_file, "wb") as f:
        f.write(content)

    rel = str(target_file.relative_to(_storage_root()))
    await upsert_pdf_blob(db, rel, content, file.content_type or "application/pdf")
    await db.commit()
    return {"path": rel, "name": file.filename, "size": target_file.stat().st_size}


@router.delete("/{path:path}")
async def delete_pdf(path: str, db: AsyncSession = Depends(get_db)):
    """Delete a PDF file from storage."""
    path = path.strip("/")
    target = _safe_path(path)
    deleted = False

    if target.exists():
        if target.is_dir():
            for file in target.rglob("*.pdf"):
                file.unlink(missing_ok=True)
            for d in sorted(target.rglob("*"), reverse=True):
                if d.is_dir():
                    d.rmdir()
            target.rmdir()
            await db.execute(
                delete(PdfBlob).where(
                    or_(
                        PdfBlob.relpath == path,
                        PdfBlob.relpath.like(f"{path}/%"),
                    )
                )
            )
        else:
            target.unlink()
            await delete_pdf_blob(db, path)
        deleted = True
    else:
        # Filesystemに無くてもDB保存分は削除可能にする
        if target.suffix.lower() == ".pdf":
            exists = await db.get(PdfBlob, path)
            if exists:
                await delete_pdf_blob(db, path)
                deleted = True
        else:
            result = await db.execute(
                select(PdfBlob.relpath).where(
                    or_(
                        PdfBlob.relpath == path,
                        PdfBlob.relpath.like(f"{path}/%"),
                    )
                )
            )
            rows = result.all()
            if rows:
                await db.execute(
                    delete(PdfBlob).where(
                        or_(
                            PdfBlob.relpath == path,
                            PdfBlob.relpath.like(f"{path}/%"),
                        )
                    )
                )
                deleted = True

    if not deleted:
        raise HTTPException(status_code=404, detail="File not found")

    await db.commit()
    return {"status": "deleted", "path": path}


@router.get("/file/{path:path}")
async def get_pdf_file(path: str, db: AsyncSession = Depends(get_db)):
    """Serve a PDF file for preview/download."""
    path = path.strip("/")
    target = _safe_path(path)
    if target.exists() and target.is_file():
        return FileResponse(target, media_type="application/pdf", filename=target.name)

    resolved = await resolve_pdf_for_reading(db, path)
    if not resolved:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(resolved, media_type="application/pdf", filename=Path(path).name)


@router.get("/tree")
async def pdf_tree(db: AsyncSession = Depends(get_db)):
    """Return full directory tree of PDF storage."""
    root = _storage_root()
    file_sizes: dict[str, int] = {}

    if root.exists():
        for dirpath, _, filenames in os.walk(root):
            rel_dir = os.path.relpath(dirpath, root)
            if rel_dir == ".":
                rel_dir = ""
            for f in filenames:
                if not f.lower().endswith(".pdf"):
                    continue
                rel = os.path.join(rel_dir, f) if rel_dir else f
                file_sizes[rel] = os.path.getsize(os.path.join(dirpath, f))

    for relpath, size in await list_pdf_blob_paths(db):
        file_sizes.setdefault(relpath, size)

    grouped: dict[str, list[dict]] = {}
    for rel, size in sorted(file_sizes.items()):
        directory = str(Path(rel).parent)
        if directory == ".":
            directory = ""
        grouped.setdefault(directory, []).append(
            {"name": Path(rel).name, "path": rel, "size": size}
        )

    result = []
    for directory in sorted(grouped.keys()):
        result.append({"directory": directory, "files": grouped[directory]})

    return {"tree": result}
