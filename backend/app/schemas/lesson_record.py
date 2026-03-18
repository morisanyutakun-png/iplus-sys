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


class MasteryInput(BaseModel):
    student_id: str
    material_key: str
    node_key: str
    lesson_date: date
    status: str  # "completed" or "retry"
    score: int | None = None
    notes: str | None = None


class MasteryBatchRequest(BaseModel):
    records: list[MasteryInput]


class MasteryResultItem(BaseModel):
    student_id: str
    material_key: str
    node_key: str
    status: str
    advanced: bool
    completed: bool = False
    new_pointer: int
    queued_node_key: str | None = None
    queued_node_title: str | None = None


class MasteryBatchResponse(BaseModel):
    processed: int
    advanced: int
    retried: int
    queued: int
    completed: int = 0
    results: list[MasteryResultItem]
