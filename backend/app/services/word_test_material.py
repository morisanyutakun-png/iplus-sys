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
from app.services.word_test_pdf import generate_word_test_pdf, generate_word_test_pdfs


async def generate_student_pdfs(
    db: AsyncSession,
    student_id: str,
    student_name: str,
    material_key: str,
    start_node: int | None = None,
    end_node: int | None = None,
    questions_per_test: int = 50,
    rows_per_side: int = 50,
    student_grade: str | None = None,
) -> list[tuple[str, str, str]]:
    """Generate randomized PDFs for nodes of a word-test material.

    Args:
        start_node: sort_order of first node to generate (inclusive). None = all.
        end_node: sort_order of last node to generate (inclusive). None = all.

    Returns list of (node_key, question_pdf_relpath, answer_pdf_relpath) tuples.
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

    generated: list[tuple[str, str, str]] = []
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
                prev_end = max(w[0] for w in previous_words)
                review_range_label = f"復習 No.1〜{prev_end}"

            q_relpath = f"単語/{book_name}/{student_id}/{node.sort_order:03d}_q.pdf"
            a_relpath = f"単語/{book_name}/{student_id}/{node.sort_order:03d}_a.pdf"
            q_path = Path(settings.pdf_storage_dir) / q_relpath
            a_path = Path(settings.pdf_storage_dir) / a_relpath

            generate_word_test_pdfs(
                question_output_path=q_path,
                answer_output_path=a_path,
                title=f"{book_name} {node.title}",
                new_words=current_word_tuples,
                review_words=review_words,
                student_name=student_name,
                student_grade=student_grade,
                new_range_label=f"No.{s}〜{e}",
                review_range_label=review_range_label,
                questions_per_test=questions_per_test,
                rows_per_side=rows_per_side,
            )
            await upsert_pdf_blob(db, q_relpath, q_path.read_bytes())
            await upsert_pdf_blob(db, a_relpath, a_path.read_bytes())

            generated.append((node.key, q_relpath, a_relpath))

        # Always accumulate for future review (even if not in generation range)
        previous_words.extend(current_word_tuples)

    return generated


async def regenerate_node_pdfs(
    db: AsyncSession,
    student_id: str,
    student_name: str,
    material_key: str,
    target_node: "MaterialNode",
    questions_per_test: int = 50,
    rows_per_side: int = 50,
    student_grade: str | None = None,
) -> tuple[str, str] | None:
    """Regenerate randomized PDFs for a single node (recheck / retry).

    Generates new questions with different random sampling for the same word range.
    Returns (question_relpath, answer_relpath) or None on failure.
    """
    book_name = material_key.removeprefix("単語:")

    result = await db.execute(
        select(WordBook).where(WordBook.name == book_name)
    )
    book = result.scalars().first()
    if not book:
        return None

    words_result = await db.execute(
        select(Word)
        .where(Word.word_book_id == book.id)
        .order_by(Word.word_number)
    )
    all_words = words_result.scalars().all()
    if not all_words:
        return None

    # Load all nodes up to and including target to accumulate review words
    stmt = (
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .where(MaterialNode.sort_order <= target_node.sort_order)
        .order_by(MaterialNode.sort_order)
    )
    nodes = (await db.execute(stmt)).scalars().all()

    previous_words: list[tuple[int, str, str]] = []
    current_word_tuples: list[tuple[int, str, str]] = []

    for node in nodes:
        s, e = _parse_range(node.range_text)
        if s is None or e is None:
            continue
        word_tuples = [
            (w.word_number, w.question, w.answer)
            for w in all_words
            if s <= w.word_number <= e
        ]
        if node.sort_order == target_node.sort_order:
            current_word_tuples = word_tuples
        else:
            previous_words.extend(word_tuples)

    if not current_word_tuples:
        return None

    review_words = None
    review_range_label = ""
    if previous_words:
        review_words = random.sample(
            previous_words, min(questions_per_test, len(previous_words))
        )
        prev_end = max(w[0] for w in previous_words)
        review_range_label = f"復習 No.1〜{prev_end}"

    s, e = _parse_range(target_node.range_text)

    q_relpath = f"単語/{book_name}/{student_id}/{target_node.sort_order:03d}_q.pdf"
    a_relpath = f"単語/{book_name}/{student_id}/{target_node.sort_order:03d}_a.pdf"
    q_path = Path(settings.pdf_storage_dir) / q_relpath
    a_path = Path(settings.pdf_storage_dir) / a_relpath

    generate_word_test_pdfs(
        question_output_path=q_path,
        answer_output_path=a_path,
        title=f"{book_name} {target_node.title}（リチェック）",
        new_words=current_word_tuples,
        review_words=review_words,
        student_name=student_name,
        student_grade=student_grade,
        new_range_label=f"No.{s}〜{e}" if s and e else "",
        review_range_label=review_range_label,
        questions_per_test=questions_per_test,
        rows_per_side=rows_per_side,
    )
    await upsert_pdf_blob(db, q_relpath, q_path.read_bytes())
    await upsert_pdf_blob(db, a_relpath, a_path.read_bytes())

    return q_relpath, a_relpath


async def generate_review_pdf(
    db: AsyncSession,
    student_id: str,
    student_name: str,
    material_key: str,
    start_node: int = 1,
    end_node: int | None = None,
    questions_per_test: int = 50,
    rows_per_side: int = 50,
    student_grade: str | None = None,
) -> tuple[str, str] | None:
    """Generate a 総復習 (comprehensive review) PDF with random words from all assigned nodes.

    Returns (question_relpath, answer_relpath) or None on failure.
    """
    book_name = material_key.removeprefix("単語:")

    result = await db.execute(
        select(WordBook).where(WordBook.name == book_name)
    )
    book = result.scalars().first()
    if not book:
        return None

    words_result = await db.execute(
        select(Word)
        .where(Word.word_book_id == book.id)
        .order_by(Word.word_number)
    )
    all_words = words_result.scalars().all()
    if not all_words:
        return None

    # Load nodes in the assigned range
    stmt = (
        select(MaterialNode)
        .where(MaterialNode.material_key == material_key)
        .order_by(MaterialNode.sort_order)
    )
    if end_node is not None:
        stmt = stmt.where(MaterialNode.sort_order <= end_node)
    if start_node > 1:
        stmt = stmt.where(MaterialNode.sort_order >= start_node)
    nodes = (await db.execute(stmt)).scalars().all()
    if not nodes:
        return None

    # Collect ALL words from all nodes in range
    all_range_words: list[tuple[int, str, str]] = []
    for node in nodes:
        s, e = _parse_range(node.range_text)
        if s is None or e is None:
            continue
        word_tuples = [
            (w.word_number, w.question, w.answer)
            for w in all_words
            if s <= w.word_number <= e
        ]
        all_range_words.extend(word_tuples)

    if not all_range_words:
        return None

    # Random sample for the review test
    sampled = random.sample(all_range_words, min(questions_per_test, len(all_range_words)))

    # Determine range label
    first_num = min(w[0] for w in all_range_words)
    last_num = max(w[0] for w in all_range_words)
    range_label = f"総復習 No.{first_num}〜{last_num}"

    q_relpath = f"単語/{book_name}/{student_id}/review_q.pdf"
    a_relpath = f"単語/{book_name}/{student_id}/review_a.pdf"
    q_path = Path(settings.pdf_storage_dir) / q_relpath
    a_path = Path(settings.pdf_storage_dir) / a_relpath

    generate_word_test_pdfs(
        question_output_path=q_path,
        answer_output_path=a_path,
        title=f"{book_name} 総復習",
        new_words=sampled,
        review_words=None,
        student_name=student_name,
        student_grade=student_grade,
        new_range_label=range_label,
        review_range_label="",
        questions_per_test=questions_per_test,
        rows_per_side=rows_per_side,
    )
    await upsert_pdf_blob(db, q_relpath, q_path.read_bytes())
    await upsert_pdf_blob(db, a_relpath, a_path.read_bytes())

    return q_relpath, a_relpath


def _parse_range(range_text: str) -> tuple[int | None, int | None]:
    """Parse 'No.1〜100' into (1, 100)."""
    m = re.search(r"(\d+)\s*[〜~\-]\s*(\d+)", range_text)
    if m:
        return int(m.group(1)), int(m.group(2))
    return None, None
