"""Generate per-student randomized word test PDFs for all nodes of a material."""

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.material import Material, MaterialNode
from app.models.word_test import WordBook, Word
from app.services.word_test_pdf import generate_word_test_pdf


async def generate_student_pdfs(
    db: AsyncSession,
    student_id: str,
    student_name: str,
    material_key: str,
) -> list[tuple[str, str]]:
    """Generate randomized PDFs for all nodes of a word-test material.

    Returns list of (node_key, pdf_relpath) tuples.
    """
    # Extract book name from material_key "単語:{book_name}"
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

    # Load material nodes
    mat_result = await db.execute(
        select(Material).where(Material.key == material_key)
    )
    material = mat_result.scalars().first()
    if not material:
        return []

    nodes_result = await db.execute(
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .order_by(MaterialNode.sort_order)
    )
    nodes = nodes_result.scalars().all()
    if not nodes:
        return []

    # Build word lookup by word_number
    word_map = {w.word_number: w for w in all_words}

    generated: list[tuple[str, str]] = []

    for node in nodes:
        # Parse range from range_text "No.1〜100"
        range_text = node.range_text  # e.g. "No.1〜100"
        start_num, end_num = _parse_range(range_text)
        if start_num is None or end_num is None:
            continue

        # Collect words in range
        word_tuples = [
            (w.word_number, w.question, w.answer)
            for w in all_words
            if start_num <= w.word_number <= end_num
        ]
        if not word_tuples:
            continue

        # Generate per-student PDF
        pdf_relpath = f"単語/{book_name}/{student_id}/{node.sort_order:03d}.pdf"
        pdf_path = Path(settings.pdf_storage_dir) / pdf_relpath

        generate_word_test_pdf(
            output_path=pdf_path,
            title=f"{book_name} {node.title}",
            words=word_tuples,
            shuffle=True,
            student_name=student_name,
        )

        generated.append((node.key, pdf_relpath))

    return generated


def _parse_range(range_text: str) -> tuple[int | None, int | None]:
    """Parse 'No.1〜100' into (1, 100)."""
    import re
    m = re.search(r"(\d+)\s*[〜~\-]\s*(\d+)", range_text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None
