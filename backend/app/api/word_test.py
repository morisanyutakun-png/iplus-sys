from collections import Counter
from collections.abc import Iterable
import re
import unicodedata
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete, update, func as sa_func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.material import Material, MaterialNode
from app.models.student_material import (
    StudentMaterial, ProgressHistory, ReminderAcknowledgment, LowAccuracyAcknowledgment,
)
from app.models.lesson_record import LessonRecord
from app.models.print_queue import PrintQueue
from app.models.word_test import WordBook, Word
from app.schemas.word_test import (
    WordBookCreate, WordBookUpdate, WordBookOut,
    WordOut, CsvImportRequest, CsvImportResponse,
)

router = APIRouter()

CsvParseMode = Literal["line_break", "comma_only"]
_DOUBLE_QUOTES = {'"', "“", "”", "„", "‟", "＂"}
_SINGLE_QUOTES = {"'", "‘", "’", "＇"}
_ZERO_WIDTH_CHARS = {"\u200b", "\u200c", "\u200d", "\u2060"}
_TRIMMABLE_CHARS = " \t\u00a0\u3000"
_IMPORT_UPSERT_BATCH_SIZE = 250
_IMPORT_LOOKUP_BATCH_SIZE = 1000
_MAX_IMPORT_ERRORS = 100
_NUMBER_HEADER_ALIASES = {
    "no", "no.", "number", "問題番号", "設問番号", "問番号", "番号",
}
_QUESTION_HEADER_ALIASES = {
    "question", "問題", "設問", "問い", "英文", "英単語",
}
_ANSWER_HEADER_ALIASES = {
    "answer", "ans", "解答", "答え", "回答", "正答", "訳", "意味",
}
_IGNORE_HEADER_ALIASES = {
    "章", "単元", "修正内容", "備考", "メモ", "comment", "comments",
}


def _normalize_csv_source(text: str) -> str:
    return (
        text.replace("\r\n", "\n")
        .replace("\r", "\n")
        .lstrip("\ufeff")
    )


def _quote_family(ch: str | None) -> str | None:
    if ch in _DOUBLE_QUOTES:
        return "double"
    if ch in _SINGLE_QUOTES:
        return "single"
    return None


def _clean_parsed_cell(value: str) -> str:
    return value.strip(_TRIMMABLE_CHARS)


def _normalize_header_label(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    normalized = normalized.lower()
    return re.sub(r"[\s\u00a0\u3000_\-:：/／()（）.,、，。]+", "", normalized)


def _detect_header_role(value: str) -> str | None:
    normalized = _normalize_header_label(value)
    if not normalized:
        return "ignore"
    if normalized in {_normalize_header_label(alias) for alias in _NUMBER_HEADER_ALIASES}:
        return "number"
    if normalized in {_normalize_header_label(alias) for alias in _QUESTION_HEADER_ALIASES}:
        return "word"
    if normalized in {_normalize_header_label(alias) for alias in _ANSWER_HEADER_ALIASES}:
        return "translation"
    if normalized in {_normalize_header_label(alias) for alias in _IGNORE_HEADER_ALIASES}:
        return "ignore"
    return None


def _detect_header_roles(row: list[str]) -> list[str] | None:
    roles = [_detect_header_role(value) for value in row]
    recognized = [role for role in roles if role is not None]
    if len(recognized) < 2:
        return None
    return [role or "ignore" for role in roles]


def _next_meaningful_char(text: str, start: int) -> str | None:
    for ch in text[start:]:
        if ch in _ZERO_WIDTH_CHARS:
            continue
        return ch
    return None


def _count_unquoted_delimiters(text: str, delimiter: str) -> int:
    count = 0
    quote_family: str | None = None
    for ch in text:
        if ch in _ZERO_WIDTH_CHARS:
            continue
        current_quote = _quote_family(ch)
        if quote_family:
            if current_quote == quote_family:
                quote_family = None
            continue
        if current_quote:
            quote_family = current_quote
            continue
        if ch == delimiter:
            count += 1
    return count


def _choose_line_delimiter(rows: Iterable[str]) -> str:
    tab_count = 0
    comma_count = 0

    for raw_row in rows:
        row = raw_row.strip()
        if not row:
            continue
        tab_count += _count_unquoted_delimiters(row, "\t")
        comma_count += _count_unquoted_delimiters(row, ",")

    return "\t" if tab_count > comma_count else ","


def _expected_columns_from_mapping(mapping) -> int | None:
    if mapping is None:
        return None
    columns = [
        col
        for col in [mapping.number_col, mapping.word_col, mapping.translation_col]
        if col is not None
    ]
    return (max(columns) + 1) if columns else None


def _infer_expected_columns(rows: list[list[str]]) -> int:
    flat_cells = [cell for row in rows for cell in row]
    numeric_positions = [
        index
        for index, value in enumerate(flat_cells[:50])
        if re.fullmatch(r"\d+", value or "")
    ]
    if len(numeric_positions) >= 2 and numeric_positions[0] == 0:
        gaps = [
            current - previous
            for previous, current in zip(numeric_positions, numeric_positions[1:])
            if current > previous
        ]
        if gaps:
            gap, _ = Counter(gaps).most_common(1)[0]
            if gap > 0:
                return gap

    def score_grouping(width: int) -> float:
        row_count = len(flat_cells) // width
        if row_count < 2:
            return 0.0
        score = 0.0
        for column in range(width):
            values = [
                flat_cells[row_index * width + column]
                for row_index in range(row_count)
                if flat_cells[row_index * width + column]
            ]
            if not values:
                continue
            ratios = (
                sum(bool(re.fullmatch(r"\d+", value)) for value in values) / len(values),
                sum(_is_japanese(value) for value in values) / len(values),
                sum(_looks_like_word_value(value) for value in values) / len(values),
            )
            score += max(ratios)
        if len(flat_cells) % width == 0:
            score += 0.2
        return score

    best_width = 0
    best_score = -1.0
    for width in range(2, min(6, len(flat_cells)) + 1):
        score = score_grouping(width)
        if score > best_score:
            best_width = width
            best_score = score
    if best_width:
        return best_width

    if len(flat_cells) >= 3 and re.fullmatch(r"\d+", flat_cells[0] or ""):
        return 3
    if len(flat_cells) >= 2:
        return 2
    return max(1, len(flat_cells))


def _tokenize_csv_like_rows(text: str, parse_mode: CsvParseMode) -> list[list[str]]:
    normalized = _normalize_csv_source(text)
    if not normalized.strip():
        return []

    raw_rows = normalized.split("\n")
    delimiter = "," if parse_mode == "comma_only" else _choose_line_delimiter(raw_rows[:10])

    rows: list[list[str]] = []
    current_row: list[str] = []
    current_cell: list[str] = []
    quote_family: str | None = None
    i = 0

    def flush_cell() -> None:
        value = _clean_parsed_cell("".join(current_cell))
        current_row.append(value)
        current_cell.clear()

    def flush_row() -> None:
        if current_row and any(cell != "" for cell in current_row):
            rows.append(current_row.copy())
        current_row.clear()

    while i < len(normalized):
        ch = normalized[i]
        if ch in _ZERO_WIDTH_CHARS:
            i += 1
            continue

        current_quote = _quote_family(ch)
        if quote_family:
            if current_quote == quote_family:
                next_char = normalized[i + 1] if i + 1 < len(normalized) else None
                if _quote_family(next_char) == quote_family:
                    current_cell.append('"' if quote_family == "double" else "'")
                    i += 2
                    continue
                quote_family = None
                i += 1
                continue
            current_cell.append(ch)
            i += 1
            continue

        if current_quote and not "".join(current_cell).strip(_TRIMMABLE_CHARS):
            quote_family = current_quote
            i += 1
            continue

        if ch == delimiter:
            flush_cell()
            i += 1
            continue

        if ch == "\n":
            if parse_mode == "line_break":
                flush_cell()
                flush_row()
            else:
                next_char = _next_meaningful_char(normalized, i + 1)
                if (
                    current_cell
                    and next_char not in {None, ","}
                    and not current_cell[-1].isspace()
                ):
                    current_cell.append(" ")
            i += 1
            continue

        current_cell.append(ch)
        i += 1

    flush_cell()
    flush_row()
    return rows


def _parse_csv_rows(
    text: str,
    parse_mode: CsvParseMode,
    expected_columns: int | None = None,
) -> list[list[str]]:
    rows = _tokenize_csv_like_rows(text, parse_mode)
    if parse_mode != "comma_only":
        return rows

    flat_cells = [cell for row in rows for cell in row]
    if not flat_cells:
        return []

    group_size = expected_columns or _infer_expected_columns(rows)
    grouped_rows: list[list[str]] = []
    for start in range(0, len(flat_cells), group_size):
        chunk = flat_cells[start:start + group_size]
        if any(cell != "" for cell in chunk):
            grouped_rows.append(chunk)
    return grouped_rows


def _append_import_error(errors: list[str], message: str) -> None:
    if len(errors) < _MAX_IMPORT_ERRORS:
        errors.append(message)
    elif len(errors) == _MAX_IMPORT_ERRORS:
        errors.append("エラーが多いため、以降は省略しました")


def _chunked(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start:start + size]


async def _fetch_existing_word_numbers(
    db: AsyncSession,
    book_id: int,
    word_numbers: list[int],
) -> set[int]:
    existing_numbers: set[int] = set()
    for chunk in _chunked(word_numbers, _IMPORT_LOOKUP_BATCH_SIZE):
        result = await db.execute(
            select(Word.word_number).where(
                Word.word_book_id == book_id,
                Word.word_number.in_(chunk),
            )
        )
        existing_numbers.update(result.scalars().all())
    return existing_numbers


async def _upsert_words_in_batches(
    db: AsyncSession,
    rows: list[dict],
) -> None:
    for chunk in _chunked(rows, _IMPORT_UPSERT_BATCH_SIZE):
        stmt = pg_insert(Word).values(chunk)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_word_book_number",
            set_={"question": stmt.excluded.question, "answer": stmt.excluded.answer},
        )
        await db.execute(stmt)
        await db.flush()


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

    book = WordBook(name=body.name, description=body.description, subject=body.subject)
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return WordBookOut.model_validate(book)


@router.put("/{book_id}", response_model=WordBookOut)
async def update_word_book(
    book_id: int, body: WordBookUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(WordBook).where(WordBook.id == book_id))
    book = result.scalars().first()
    if not book:
        raise HTTPException(status_code=404, detail="単語帳が見つかりません")

    if body.name is not None and body.name != book.name:
        # Check for duplicate name
        dup = await db.execute(select(WordBook.id).where(WordBook.name == body.name, WordBook.id != book_id))
        if dup.scalars().first():
            raise HTTPException(status_code=409, detail="同名の単語帳が既に存在します")

        old_key = book.material_key
        new_key = f"単語:{body.name}"
        new_mat_name = f"単語テスト:{body.name}"
        book.name = body.name

        # Update linked Material key and name
        if old_key:
            mat = await db.get(Material, old_key)
            if mat:
                # 1. Update MaterialNode keys and material_key
                old_nodes = (await db.execute(
                    select(MaterialNode).where(MaterialNode.material_key == old_key)
                )).scalars().all()
                for node in old_nodes:
                    suffix = node.key.split(":")[-1] if ":" in node.key else ""
                    node.key = f"単語:{body.name}:{suffix}"
                    node.material_key = new_key
                await db.flush()

                # 2. Bulk-update all FK references BEFORE deleting old Material
                #    to prevent CASCADE DELETE from destroying related data
                await db.execute(
                    update(StudentMaterial)
                    .where(StudentMaterial.material_key == old_key)
                    .values(material_key=new_key)
                )
                await db.execute(
                    update(ProgressHistory)
                    .where(ProgressHistory.material_key == old_key)
                    .values(material_key=new_key)
                )
                await db.execute(
                    update(ReminderAcknowledgment)
                    .where(ReminderAcknowledgment.material_key == old_key)
                    .values(material_key=new_key)
                )
                await db.execute(
                    update(LowAccuracyAcknowledgment)
                    .where(LowAccuracyAcknowledgment.material_key == old_key)
                    .values(material_key=new_key)
                )
                await db.execute(
                    update(LessonRecord)
                    .where(LessonRecord.material_key == old_key)
                    .values(material_key=new_key)
                )
                await db.execute(
                    update(PrintQueue)
                    .where(PrintQueue.material_key == old_key)
                    .values(material_key=new_key)
                )
                await db.flush()

                # 3. Now safe to delete old Material (no FK refs remain)
                await db.delete(mat)
                await db.flush()

                # 4. Create new Material with new key
                mat_new = Material(
                    key=new_key, name=new_mat_name,
                    subject=mat.subject, sort_order=mat.sort_order,
                )
                db.add(mat_new)
                await db.flush()

            book.material_key = new_key

    if body.description is not None:
        book.description = body.description

    if body.subject is not None:
        book.subject = body.subject
        # Update linked Material subject
        if book.material_key:
            mat = await db.get(Material, book.material_key)
            if mat:
                mat.subject = body.subject

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

    mapping = body.column_mapping
    parse_mode = body.parse_mode
    imported = 0
    updated = 0
    errors: list[str] = []
    auto_number = 1
    parsed_word_map: dict[int, dict] = {}
    parsed_rows = _parse_csv_rows(
        body.csv_text,
        parse_mode=parse_mode,
        expected_columns=_expected_columns_from_mapping(mapping),
    )

    start_idx = 1 if mapping and mapping.skip_header else 0

    for row_index, raw_parts in enumerate(parsed_rows, start=1):
        if row_index - 1 < start_idx:
            continue
        if not raw_parts or all(part == "" for part in raw_parts):
            continue

        parts = [_clean_parsed_cell(part) for part in raw_parts]

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
                _append_import_error(errors, f"行{row_index}: 列数が不足しています（{len(parts)}列）")
                continue

            if mapping.number_col is not None:
                try:
                    word_number = int(parts[mapping.number_col])
                except ValueError:
                    _append_import_error(
                        errors,
                        f"行{row_index}: 番号が不正です: {parts[mapping.number_col]}",
                    )
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
                _append_import_error(errors, f"行{row_index}: 番号が不正です: {parts[0]}")
                continue
            question = parts[1]
            answer = parts[2]
        elif len(parts) == 2:
            # question, answer (auto-number)
            word_number = auto_number
            question = parts[0]
            answer = parts[1]
        else:
            _append_import_error(errors, f"行{row_index}: 列数が不足しています")
            continue

        if not question or not answer:
            _append_import_error(errors, f"行{row_index}: 問題または答えが空です")
            continue

        if word_number in parsed_word_map:
            _append_import_error(
                errors,
                f"行{row_index}: 問題番号 {word_number} が重複しているため、後ろの行で上書きしました",
            )

        auto_number = word_number + 1
        parsed_word_map[word_number] = {
            "word_book_id": book_id,
            "word_number": word_number,
            "question": question,
            "answer": answer,
        }

    parsed_words = [
        parsed_word_map[word_number]
        for word_number in sorted(parsed_word_map)
    ]

    # ── Bulk upsert (INSERT ... ON CONFLICT DO UPDATE) ──
    if parsed_words:
        parsed_numbers = [w["word_number"] for w in parsed_words]
        existing_numbers = await _fetch_existing_word_numbers(db, book_id, parsed_numbers)

        for w in parsed_words:
            if w["word_number"] in existing_numbers:
                updated += 1
            else:
                imported += 1

        await _upsert_words_in_batches(db, parsed_words)

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
    subject = book.subject or "英語"
    existing_mat = await db.get(Material, material_key)
    if existing_mat:
        existing_mat.name = material_name
        existing_mat.subject = subject
    else:
        db.add(Material(
            key=material_key, name=material_name, subject=subject, sort_order=900,
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


def _looks_like_word_value(text: str) -> bool:
    has_latin = False
    for ch in text:
        if ch.isspace():
            continue
        name = unicodedata.name(ch, "")
        category = unicodedata.category(ch)
        if "LATIN" in name:
            has_latin = True
            continue
        if category.startswith(("M", "N", "P", "S")):
            continue
        return False
    return has_latin


@router.post("/detect-columns")
async def detect_columns(body: CsvImportRequest):
    """Auto-detect column roles from sample CSV data."""
    rows = _parse_csv_rows(body.csv_text, parse_mode=body.parse_mode)
    if not rows:
        return {"columns": [], "suggested_mapping": None}

    parts = rows[0]
    num_cols = len(parts)
    header_roles = _detect_header_roles(parts)
    has_header = header_roles is not None

    # Analyze multiple lines
    sample_rows = rows[1:min(11, len(rows))] if has_header else rows[:min(10, len(rows))]
    col_scores: list[dict[str, float]] = [
        {"number": 0, "word": 0, "translation": 0} for _ in range(num_cols)
    ]

    for row in sample_rows:
        for j, val in enumerate(row):
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
            # Latin word detection, including accents and common symbols
            elif _looks_like_word_value(val):
                col_scores[j]["word"] += 1

    n_lines = len(sample_rows)
    columns = []
    for j in range(num_cols):
        if header_roles:
            role = header_roles[j]
        else:
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
            "skip_header": has_header,
        }

    return {"columns": columns, "suggested_mapping": suggested}
