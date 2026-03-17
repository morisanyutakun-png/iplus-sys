from datetime import date, datetime

from pydantic import BaseModel


class LessonRecordOut(BaseModel):
    id: int
    student_id: str
    material_key: str
    node_key: str | None = None
    lesson_date: date
    status: str
    score: int | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LessonRecordUpsert(BaseModel):
    student_id: str
    material_key: str
    node_key: str | None = None
    lesson_date: date
    status: str = "completed"
    score: int | None = None
    notes: str | None = None


class LessonRecordBatchRequest(BaseModel):
    records: list[LessonRecordUpsert]


class LessonRecordBatchResponse(BaseModel):
    upserted: int
