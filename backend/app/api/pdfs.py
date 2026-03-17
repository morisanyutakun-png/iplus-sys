import os
import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse

from app.config import settings

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
async def list_pdfs(prefix: str = ""):
    """List PDF files under the storage directory, optionally filtered by prefix."""
    root = _storage_root()
    search_dir = _safe_path(prefix) if prefix else root

    if not search_dir.exists():
        return {"files": [], "directories": []}

    files = []
    directories = []
    for entry in sorted(search_dir.iterdir()):
        rel = str(entry.relative_to(root))
        if entry.is_dir():
            directories.append({"name": entry.name, "path": rel})
        elif entry.suffix.lower() == ".pdf":
            files.append({
                "name": entry.name,
                "path": rel,
                "size": entry.stat().st_size,
            })

    return {"files": files, "directories": directories}


@router.post("/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    material_key: str = Query("", description="Material key for subfolder"),
):
    """Upload a PDF file to storage."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    subdir = material_key if material_key else ""
    target_dir = _safe_path(subdir) if subdir else _storage_root()
    target_dir.mkdir(parents=True, exist_ok=True)

    target_file = target_dir / file.filename
    with open(target_file, "wb") as f:
        shutil.copyfileobj(file.file, f)

    rel = str(target_file.relative_to(_storage_root()))
    return {"path": rel, "name": file.filename, "size": target_file.stat().st_size}


@router.delete("/{path:path}")
async def delete_pdf(path: str):
    """Delete a PDF file from storage."""
    target = _safe_path(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()
    return {"status": "deleted", "path": path}


@router.get("/file/{path:path}")
async def get_pdf_file(path: str):
    """Serve a PDF file for preview/download."""
    target = _safe_path(path)
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(target, media_type="application/pdf", filename=target.name)


@router.get("/tree")
async def pdf_tree():
    """Return full directory tree of PDF storage."""
    root = _storage_root()
    if not root.exists():
        return {"tree": []}

    result = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames.sort()
        rel_dir = os.path.relpath(dirpath, root)
        if rel_dir == ".":
            rel_dir = ""
        pdfs = [f for f in sorted(filenames) if f.lower().endswith(".pdf")]
        if pdfs or rel_dir:
            entry = {
                "directory": rel_dir,
                "files": [
                    {
                        "name": f,
                        "path": os.path.join(rel_dir, f) if rel_dir else f,
                        "size": os.path.getsize(os.path.join(dirpath, f)),
                    }
                    for f in pdfs
                ],
            }
            result.append(entry)

    return {"tree": result}
