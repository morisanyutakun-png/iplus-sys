"""Generate per-student randomized word test PDFs for material nodes."""

import re
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.material import MaterialNode
from app.models.word_test import WordBook, Word
from app.services.pdf_store import upsert_pdf_blob
from app.services.word_test_pdf import generate_word_test_pdf


async def generate_student_pdfs(
    db: AsyncSession,
    student_id: str,
    student_name: str,
    material_key: str,
    start_node: int | None = None,
    end_node: int | None = None,
) -> list[tuple[str, str]]:
    """Generate randomized PDFs for nodes of a word-test material.

    Args:
        start_node: sort_order of first node to generate (inclusive). None = all.
        end_node: sort_order of last node to generate (inclusive). None = all.

    Returns list of (node_key, pdf_relpath) tuples.
    """
    book_name = material_key.removeprefix("単語:")

    # Find WordBook
    result = await db.execute(
        select(WordBook).where(WordBook.name == book_name)
    )
    book = result.scalars().first()
    if not book:
        return []

    # Load all words
    words_result = await db.execute(
        select(Word)
        .where(Word.word_book_id == book.id)
        .order_by(Word.word_number)
    )
    all_words = words_result.scalars().all()
    if not all_words:
        return []

    # Load material nodes (with optional range filter)
    stmt = (
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .order_by(MaterialNode.sort_order)
    )
    if start_node is not None:
        stmt = stmt.where(MaterialNode.sort_order >= start_node)
    if end_node is not None:
        stmt = stmt.where(MaterialNode.sort_order <= end_node)

    nodes = (await db.execute(stmt)).scalars().all()
    if not nodes:
        return []

    generated: list[tuple[str, str]] = []

    for node in nodes:
        range_text = node.range_text
        s, e = _parse_range(range_text)
        if s is None or e is None:
            continue

        word_tuples = [
            (w.word_number, w.question, w.answer)
            for w in all_words
            if s <= w.word_number <= e
        ]
        if not word_tuples:
            continue

        pdf_relpath = f"単語/{book_name}/{student_id}/{node.sort_order:03d}.pdf"
        pdf_path = Path(settings.pdf_storage_dir) / pdf_relpath

        generate_word_test_pdf(
            output_path=pdf_path,
            title=f"{book_name} {node.title}",
            words=word_tuples,
            shuffle=True,
            student_name=student_name,
        )
        await upsert_pdf_blob(db, pdf_relpath, pdf_path.read_bytes())

        generated.append((node.key, pdf_relpath))

    return generated


def _parse_range(range_text: str) -> tuple[int | None, int | None]:
    """Parse 'No.1〜100' into (1, 100)."""
    m = re.search(r"(\d+)\s*[〜~\-]\s*(\d+)", range_text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None
