from pathlib import Path

from app.config import settings


def _candidate_storage_roots() -> list[Path]:
    configured = Path(settings.pdf_storage_dir)
    roots: list[Path] = []

    for candidate in (
        configured,
        Path.cwd() / configured,
        Path(__file__).resolve().parents[2] / configured,
    ):
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if resolved not in roots:
            roots.append(resolved)

    return roots


def resolve_pdf_path(pdf_relpath: str) -> str | None:
    """Resolve a material PDF from local storage, base dirs, or an absolute path."""
    if not pdf_relpath:
        return None

    path = Path(pdf_relpath)
    if path.is_file():
        return str(path)

    for storage_root in _candidate_storage_roots():
        candidate = storage_root / pdf_relpath
        if candidate.is_file():
            return str(candidate)

    for base_dir in settings.materials_base_dirs_list:
        candidate = Path(base_dir) / pdf_relpath
        if candidate.is_file():
            return str(candidate)

    return None
