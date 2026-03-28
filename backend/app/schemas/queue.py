from datetime import datetime

from pydantic import BaseModel


class QueueItemOut(BaseModel):
    id: int
    student_id: str
    student_name: str | None = None
    student_grade: str | None = None
    material_key: str
    material_name: str | None = None
    node_key: str | None = None
    node_name: str | None = None
    sort_order: int
    status: str
    pdf_type: str = "question"
    generated_pdf: str | None = None
    scheduled_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class QueueItemCreate(BaseModel):
    student_id: str
    material_key: str
    node_key: str | None = None
    pdf_type: str = "question"


class QueueItemUpdate(BaseModel):
    student_id: str | None = None
    material_key: str | None = None
    node_key: str | None = None


class QueueReorder(BaseModel):
    item_ids: list[int]


class QueueListOut(BaseModel):
    items: list[QueueItemOut]
