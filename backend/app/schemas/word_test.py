from datetime import date, datetime

from pydantic import BaseModel


# ── WordBook ──

class WordBookCreate(BaseModel):
    name: str
    description: str = ""


class WordBookOut(BaseModel):
    id: int
    name: str
    description: str
    total_words: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Word ──

class WordOut(BaseModel):
    id: int
    word_book_id: int
    word_number: int
    question: str
    answer: str

    model_config = {"from_attributes": True}


class WordImportItem(BaseModel):
    word_number: int
    question: str
    answer: str


class CsvImportRequest(BaseModel):
    csv_text: str


class CsvImportResponse(BaseModel):
    imported: int
    updated: int
    errors: list[str]


# ── Test Generation ──

class TestRange(BaseModel):
    start: int
    end: int


class WordTestGenerateRequest(BaseModel):
    word_book_id: int
    ranges: list[TestRange]
    count: int | None = None


class WordTestGenerateResponse(BaseModel):
    words: list[WordOut]
    total: int


# ── Test Session ──

class WordTestSessionCreate(BaseModel):
    student_id: str
    word_book_id: int
    ranges: list[TestRange]
    total_questions: int
    correct_count: int
    test_date: date


class WordTestSessionOut(BaseModel):
    id: int
    student_id: str
    word_book_id: int
    ranges: list[TestRange]
    total_questions: int
    correct_count: int
    accuracy_rate: float
    test_date: date
    created_at: datetime
    student_name: str | None = None
    word_book_name: str | None = None

    model_config = {"from_attributes": True}
