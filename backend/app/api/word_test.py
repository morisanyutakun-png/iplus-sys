import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete, update, func as sa_func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.material import Material, MaterialNode
from app.models.word_test import WordBook, Word
from app.schemas.word_test import (
    WordBookCreate, WordBookOut,
    WordOut, CsvImportRequest, CsvImportResponse,
)

router = APIRouter()


# ── WordBook CRUD ──

@router.get("", response_model=list[WordBookOut])
async def list_word_books(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WordBook).order_by(WordBook.id))
    return [WordBookOut.model_validate(b) for b in result.scalars().all()]


@router.post("", response_model=WordBookOut)
async def create_word_book(body: WordBookCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(WordBook).where(WordBook.name == body.name))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="同名の単語帳が既に存在します")

    book = WordBook(name=body.name, description=body.description)
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return WordBookOut.model_validate(book)


@router.delete("/{book_id}")
async def delete_word_book(book_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WordBook.id, WordBook.material_key).where(WordBook.id == book_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="単語帳が見つかりません")

    material_key = row.material_key
    # Delete associated Material + MaterialNodes (CASCADE) in set-based SQL
    if material_key:
        await db.execute(delete(Material).where(Material.key == material_key))

    await db.execute(delete(WordBook).where(WordBook.id == book_id))
    await db.commit()
    return {"ok": True}


# ── Words ──

@router.get("/{book_id}/words", response_model=list[WordOut])
async def list_words(
    book_id: int,
    range_from: int | None = Query(None, alias="from"),
    range_to: int | None = Query(None, alias="to"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Word).where(Word.word_book_id == book_id)
    if range_from is not None:
        stmt = stmt.where(Word.word_number >= range_from)
    if range_to is not None:
        stmt = stmt.where(Word.word_number <= range_to)
    stmt = stmt.order_by(Word.word_number)
    result = await db.execute(stmt)
    return [WordOut.model_validate(w) for w in result.scalars().all()]


@router.post("/{book_id}/words/import-csv", response_model=CsvImportResponse)
async def import_csv(
    book_id: int, body: CsvImportRequest, db: AsyncSession = Depends(get_db)
):
    # Verify book exists
    result = await db.execute(select(WordBook).where(WordBook.id == book_id))
    book = result.scalars().first()
    if not book:
        raise HTTPException(status_code=404, detail="単語帳が見つかりません")

    lines = body.csv_text.strip().split("\n")
    mapping = body.column_mapping
    imported = 0
    updated = 0
    errors: list[str] = []
    auto_number = 1
    parsed_words: list[dict] = []

    start_idx = 1 if mapping and mapping.skip_header else 0

    for i, raw_line in enumerate(lines, start=1):
        if i - 1 < start_idx:
            continue
        line = raw_line.strip()
        if not line:
            continue

        # Split by tab first, then comma
        parts = line.split("\t") if "\t" in line else line.split(",")
        parts = [p.strip() for p in parts]

        word_number: int | None = None
        question: str = ""
        answer: str = ""

        if mapping:
            # Use explicit column mapping
            max_col = max(
                c for c in [mapping.number_col, mapping.word_col, mapping.translation_col]
                if c is not None
            )
            if len(parts) <= max_col:
                errors.append(f"行{i}: 列数が不足しています（{len(parts)}列）")
                continue

            if mapping.number_col is not None:
                try:
                    word_number = int(parts[mapping.number_col])
                except ValueError:
                    errors.append(f"行{i}: 番号が不正です: {parts[mapping.number_col]}")
                    continue
            else:
                word_number = auto_number

            question = parts[mapping.word_col]
            answer = parts[mapping.translation_col]
        elif len(parts) >= 3:
            # Auto-detect: number, question, answer
            try:
                word_number = int(parts[0])
            except ValueError:
                errors.append(f"行{i}: 番号が不正です: {parts[0]}")
                continue
            question = parts[1]
            answer = parts[2]
        elif len(parts) == 2:
            # question, answer (auto-number)
            word_number = auto_number
            question = parts[0]
            answer = parts[1]
        else:
            errors.append(f"行{i}: 列数が不足しています")
            continue

        if not question or not answer:
            errors.append(f"行{i}: 問題または答えが空です")
            continue

        auto_number = word_number + 1
        parsed_words.append({
            "word_book_id": book_id,
            "word_number": word_number,
            "question": question,
            "answer": answer,
        })

    # ── Bulk upsert (INSERT ... ON CONFLICT DO UPDATE) ──
    if parsed_words:
        # Single SELECT to find which word_numbers already exist
        parsed_numbers = sorted({w["word_number"] for w in parsed_words})
        existing_result = await db.execute(
            select(Word.word_number).where(
                Word.word_book_id == book_id,
                Word.word_number.in_(parsed_numbers),
            )
        )
        existing_numbers = set(existing_result.scalars().all())

        for w in parsed_words:
            if w["word_number"] in existing_numbers:
                updated += 1
            else:
                imported += 1

        stmt = pg_insert(Word).values(parsed_words)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_word_book_number",
            set_={"question": stmt.excluded.question, "answer": stmt.excluded.answer},
        )
        await db.execute(stmt)

    # Update total_words count
    await db.flush()
    count_result = await db.execute(
        select(sa_func.count()).select_from(Word).where(Word.word_book_id == book_id)
    )
    book.total_words = count_result.scalar() or 0

    # Auto-generate material from word book
    if parsed_words and book.total_words > 0:
        await _auto_generate_material(db, book)

    await db.commit()
    return CsvImportResponse(imported=imported, updated=updated, errors=errors)


async def _auto_generate_material(db: AsyncSession, book: WordBook) -> None:
    """Auto-create/update Material + MaterialNodes from a WordBook (100 words per node)."""
    material_key = f"単語:{book.name}"
    material_name = f"単語テスト:{book.name}"
    words_per_test = 100

    # Create or update Material
    existing_mat = await db.get(Material, material_key)
    if existing_mat:
        existing_mat.name = material_name
        existing_mat.subject = "英語"
    else:
        db.add(Material(
            key=material_key, name=material_name, subject="英語", sort_order=900,
        ))
        await db.flush()

    # Get ordered word numbers only (lighter than full rows)
    words_result = await db.execute(
        select(Word.word_number).where(Word.word_book_id == book.id).order_by(Word.word_number)
    )
    word_numbers = words_result.scalars().all()

    desired_nodes: list[dict] = []
    for i in range(0, len(word_numbers), words_per_test):
        chunk = word_numbers[i:i + words_per_test]
        chunk_num = (i // words_per_test) + 1
        first_num = chunk[0]
        last_num = chunk[-1]
        desired_nodes.append({
            "key": f"単語:{book.name}:{chunk_num:03d}",
            "material_key": material_key,
            "title": f"{first_num}-{last_num}",
            "range_text": f"No.{first_num}〜{last_num}",
            "pdf_relpath": "",
            "duplex": True,
            "sort_order": chunk_num,
        })

    existing_rows = (
        await db.execute(
            select(
                MaterialNode.key,
                MaterialNode.title,
                MaterialNode.range_text,
                MaterialNode.sort_order,
                MaterialNode.duplex,
            )
            .where(MaterialNode.material_key == material_key)
            .order_by(MaterialNode.sort_order)
        )
    ).all()

    # Fast path: skip write if node layout is unchanged
    unchanged = len(existing_rows) == len(desired_nodes)
    if unchanged:
        for row, desired in zip(existing_rows, desired_nodes):
            if (
                row.key != desired["key"]
                or row.title != desired["title"]
                or row.range_text != desired["range_text"]
                or row.sort_order != desired["sort_order"]
                or row.duplex != desired["duplex"]
            ):
                unchanged = False
                break
    if unchanged:
        book.material_key = material_key
        return

    if desired_nodes:
        stmt = pg_insert(MaterialNode).values(desired_nodes)
        stmt = stmt.on_conflict_do_update(
            index_elements=[MaterialNode.key],
            set_={
                "material_key": stmt.excluded.material_key,
                "title": stmt.excluded.title,
                "range_text": stmt.excluded.range_text,
                "duplex": stmt.excluded.duplex,
                "sort_order": stmt.excluded.sort_order,
            },
        )
        await db.execute(stmt)

        desired_keys = [n["key"] for n in desired_nodes]
        await db.execute(
            delete(MaterialNode).where(
                MaterialNode.material_key == material_key,
                MaterialNode.key.not_in(desired_keys),
            )
        )
    else:
        await db.execute(
            delete(MaterialNode).where(MaterialNode.material_key == material_key)
        )

    book.material_key = material_key


@router.delete("/{book_id}/words")
async def delete_all_words(book_id: int, db: AsyncSession = Depends(get_db)):
    book_result = await db.execute(
        select(WordBook.material_key).where(WordBook.id == book_id)
    )
    material_key = book_result.scalar_one_or_none()
    if material_key is None:
        raise HTTPException(status_code=404, detail="単語帳が見つかりません")

    await db.execute(delete(Word).where(Word.word_book_id == book_id))
    if material_key:
        await db.execute(
            delete(MaterialNode).where(MaterialNode.material_key == material_key)
        )
    await db.execute(
        update(WordBook).where(WordBook.id == book_id).values(total_words=0)
    )
    await db.commit()
    return {"ok": True}


# ── Column Auto-Detection ──

def _is_japanese(text: str) -> bool:
    """Check if text contains Japanese characters."""
    for ch in text:
        cat = unicodedata.category(ch)
        if cat.startswith("Lo"):  # CJK ideograph, hiragana, katakana
            name = unicodedata.name(ch, "")
            if any(k in name for k in ("CJK", "HIRAGANA", "KATAKANA")):
                return True
    return False


@router.post("/detect-columns")
async def detect_columns(body: CsvImportRequest):
    """Auto-detect column roles from sample CSV data."""
    lines = body.csv_text.strip().split("\n")
    if not lines:
        return {"columns": [], "suggested_mapping": None}

    # Parse first line to count columns
    sample = lines[0]
    parts = sample.split("\t") if "\t" in sample else sample.split(",")
    parts = [p.strip() for p in parts]
    num_cols = len(parts)

    # Analyze multiple lines
    sample_lines = lines[:min(10, len(lines))]
    col_scores: list[dict[str, float]] = [
        {"number": 0, "word": 0, "translation": 0} for _ in range(num_cols)
    ]

    for raw_line in sample_lines:
        line_parts = raw_line.split("\t") if "\t" in raw_line else raw_line.split(",")
        line_parts = [p.strip() for p in line_parts]
        for j, val in enumerate(line_parts):
            if j >= num_cols:
                break
            if not val:
                continue
            # Number detection
            if re.match(r"^\d+$", val):
                col_scores[j]["number"] += 1
            # Japanese detection
            if _is_japanese(val):
                col_scores[j]["translation"] += 1
            # ASCII/Latin word detection
            elif re.match(r"^[a-zA-Z\s\-\']+$", val):
                col_scores[j]["word"] += 1

    n_lines = len(sample_lines)
    columns = []
    for j in range(num_cols):
        scores = col_scores[j]
        if scores["number"] >= n_lines * 0.7:
            role = "number"
        elif scores["word"] >= n_lines * 0.5:
            role = "word"
        elif scores["translation"] >= n_lines * 0.5:
            role = "translation"
        else:
            role = "ignore"
        columns.append({"index": j, "sample": parts[j], "suggested_role": role})

    # Build suggested mapping
    number_col = next((c["index"] for c in columns if c["suggested_role"] == "number"), None)
    word_col = next((c["index"] for c in columns if c["suggested_role"] == "word"), None)
    trans_col = next((c["index"] for c in columns if c["suggested_role"] == "translation"), None)

    suggested = None
    if word_col is not None and trans_col is not None:
        suggested = {
            "number_col": number_col,
            "word_col": word_col,
            "translation_col": trans_col,
            "skip_header": False,
        }

    return {"columns": columns, "suggested_mapping": suggested}
