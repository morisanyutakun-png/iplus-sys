"""Generate per-student randomized word test PDFs for material nodes.

Each PDF has left side = review words (from previous ranges), right side = new
words (from current range).
"""

import random
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
    questions_per_test: int = 50,
    rows_per_side: int = 50,
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

    # Load ALL nodes from beginning (needed for review word accumulation)
    stmt = (
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .order_by(MaterialNode.sort_order)
    )
    nodes = (await db.execute(stmt)).scalars().all()
    if not nodes:
        return []

    generated: list[tuple[str, str]] = []
    previous_words: list[tuple[int, str, str]] = []

    for node in nodes:
        range_text = node.range_text
        s, e = _parse_range(range_text)
        if s is None or e is None:
            continue

        # Words in the current range
        current_word_tuples = [
            (w.word_number, w.question, w.answer)
            for w in all_words
            if s <= w.word_number <= e
        ]
        if not current_word_tuples:
            previous_words.extend(current_word_tuples)
            continue

        # Check if this node is in the generation range
        in_range = True
        if start_node is not None and node.sort_order < start_node:
            in_range = False
        if end_node is not None and node.sort_order > end_node:
            in_range = False

        if in_range:
            # Sample review words from all previous ranges
            review_words = None
            review_range_label = ""
            if previous_words:
                review_words = random.sample(
                    previous_words, min(questions_per_test, len(previous_words))
                )
                # Determine review range extent (No.1 ~ last previous end)
                prev_end = max(w[0] for w in previous_words)
                review_range_label = f"復習 No.1〜{prev_end}"

            pdf_relpath = f"単語/{book_name}/{student_id}/{node.sort_order:03d}.pdf"
            pdf_path = Path(settings.pdf_storage_dir) / pdf_relpath

            generate_word_test_pdf(
                output_path=pdf_path,
                title=f"{book_name} {node.title}",
                new_words=current_word_tuples,
                review_words=review_words,
                student_name=student_name,
                new_range_label=f"No.{s}〜{e}",
                review_range_label=review_range_label,
                questions_per_test=questions_per_test,
                rows_per_side=rows_per_side,
            )
            await upsert_pdf_blob(db, pdf_relpath, pdf_path.read_bytes())

            generated.append((node.key, pdf_relpath))

        # Always accumulate for future review (even if not in generation range)
        previous_words.extend(current_word_tuples)

    return generated


def _parse_range(range_text: str) -> tuple[int | None, int | None]:
    """Parse 'No.1〜100' into (1, 100)."""
    m = re.search(r"(\d+)\s*[〜~\-]\s*(\d+)", range_text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None
