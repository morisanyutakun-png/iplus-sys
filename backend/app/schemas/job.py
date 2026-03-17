from datetime import datetime

from pydantic import BaseModel


class PrintJobItemOut(BaseModel):
    id: int
    sort_order: int
    student_id: str | None = None
    student_name: str | None = None
    material_key: str | None = None
    material_name: str | None = None
    node_key: str | None = None
    node_name: str | None = None
    pdf_relpath: str | None = None
    missing_pdf: bool = False
    duplex: bool = False

    model_config = {"from_attributes": True}


class PrintJobOut(BaseModel):
    id: str
    status: str
    item_count: int
    missing: int
    created_at: datetime
    executed_at: datetime | None = None
    items: list[PrintJobItemOut] = []

    model_config = {"from_attributes": True}


class PrintJobListOut(BaseModel):
    jobs: list[PrintJobOut]
