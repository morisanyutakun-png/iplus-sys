from datetime import datetime

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
    material_key: str | None = None
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


class ColumnMapping(BaseModel):
    number_col: int | None = None  # None = auto-number
    word_col: int
    translation_col: int
    skip_header: bool = False


class CsvImportRequest(BaseModel):
    csv_text: str
    column_mapping: ColumnMapping | None = None


class CsvImportResponse(BaseModel):
    imported: int
    updated: int
    errors: list[str]
