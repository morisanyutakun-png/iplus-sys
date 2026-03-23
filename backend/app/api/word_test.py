import random

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete, func as sa_func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.word_test import WordBook, Word, WordTestSession
from app.models.student import Student
from app.schemas.word_test import (
    WordBookCreate, WordBookOut,
    WordOut, CsvImportRequest, CsvImportResponse,
    WordTestGenerateRequest, WordTestGenerateResponse,
    WordTestSessionCreate, WordTestSessionOut,
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
    result = await db.execute(select(WordBook).where(WordBook.id == book_id))
    book = result.scalars().first()
    if not book:
        raise HTTPException(status_code=404, detail="単語帳が見つかりません")
    await db.delete(book)
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
    imported = 0
    updated = 0
    errors: list[str] = []
    auto_number = 1

    for i, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line:
            continue

        # Split by tab first, then comma
        parts = line.split("\t") if "\t" in line else line.split(",")
        parts = [p.strip() for p in parts]

        word_number: int | None = None
        question: str = ""
        answer: str = ""

        if len(parts) >= 3:
            # number, question, answer
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

        # Upsert
        existing = await db.execute(
            select(Word).where(
                Word.word_book_id == book_id,
                Word.word_number == word_number,
            )
        )
        existing_word = existing.scalars().first()
        if existing_word:
            existing_word.question = question
            existing_word.answer = answer
            updated += 1
        else:
            db.add(Word(
                word_book_id=book_id,
                word_number=word_number,
                question=question,
                answer=answer,
            ))
            imported += 1

    # Update total_words count
    count_result = await db.execute(
        select(sa_func.count()).select_from(Word).where(Word.word_book_id == book_id)
    )
    # Add the newly imported count (not yet flushed) — flush first
    await db.flush()
    count_result = await db.execute(
        select(sa_func.count()).select_from(Word).where(Word.word_book_id == book_id)
    )
    book.total_words = count_result.scalar() or 0

    await db.commit()
    return CsvImportResponse(imported=imported, updated=updated, errors=errors)


@router.delete("/{book_id}/words")
async def delete_all_words(book_id: int, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Word).where(Word.word_book_id == book_id))
    # Reset total_words
    result = await db.execute(select(WordBook).where(WordBook.id == book_id))
    book = result.scalars().first()
    if book:
        book.total_words = 0
    await db.commit()
    return {"ok": True}


# ── Test Generation ──

@router.post("/generate", response_model=WordTestGenerateResponse)
async def generate_test(
    body: WordTestGenerateRequest, db: AsyncSession = Depends(get_db)
):
    if not body.ranges:
        raise HTTPException(status_code=400, detail="範囲を指定してください")

    # Build OR conditions for ranges
    conditions = [
        and_(Word.word_number >= r.start, Word.word_number <= r.end)
        for r in body.ranges
    ]
    stmt = (
        select(Word)
        .where(Word.word_book_id == body.word_book_id)
        .where(or_(*conditions))
        .order_by(Word.word_number)
    )
    result = await db.execute(stmt)
    words = list(result.scalars().all())

    # Shuffle
    random.shuffle(words)

    # Limit if count specified
    if body.count and body.count < len(words):
        words = words[:body.count]

    return WordTestGenerateResponse(
        words=[WordOut.model_validate(w) for w in words],
        total=len(words),
    )


# ── Test Sessions ──

@router.post("/sessions", response_model=WordTestSessionOut)
async def create_session(
    body: WordTestSessionCreate, db: AsyncSession = Depends(get_db)
):
    accuracy = body.correct_count / body.total_questions if body.total_questions > 0 else 0.0

    session = WordTestSession(
        student_id=body.student_id,
        word_book_id=body.word_book_id,
        ranges=[{"start": r.start, "end": r.end} for r in body.ranges],
        total_questions=body.total_questions,
        correct_count=body.correct_count,
        accuracy_rate=round(accuracy, 4),
        test_date=body.test_date,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Fetch names for response
    student = await db.get(Student, body.student_id)
    book = await db.get(WordBook, body.word_book_id)

    out = WordTestSessionOut.model_validate(session)
    out.student_name = student.name if student else None
    out.word_book_name = book.name if book else None
    return out


@router.get("/sessions", response_model=list[WordTestSessionOut])
async def list_sessions(
    student_id: str | None = None,
    word_book_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WordTestSession).order_by(WordTestSession.test_date.desc(), WordTestSession.id.desc())
    if student_id:
        stmt = stmt.where(WordTestSession.student_id == student_id)
    if word_book_id:
        stmt = stmt.where(WordTestSession.word_book_id == word_book_id)

    result = await db.execute(stmt)
    sessions = result.scalars().all()

    # Batch fetch student and book names
    student_ids = {s.student_id for s in sessions}
    book_ids = {s.word_book_id for s in sessions}

    students_map: dict[str, str] = {}
    if student_ids:
        sr = await db.execute(select(Student).where(Student.id.in_(student_ids)))
        students_map = {s.id: s.name for s in sr.scalars().all()}

    books_map: dict[int, str] = {}
    if book_ids:
        br = await db.execute(select(WordBook).where(WordBook.id.in_(book_ids)))
        books_map = {b.id: b.name for b in br.scalars().all()}

    out = []
    for s in sessions:
        item = WordTestSessionOut.model_validate(s)
        item.student_name = students_map.get(s.student_id)
        item.word_book_name = books_map.get(s.word_book_id)
        out.append(item)
    return out
