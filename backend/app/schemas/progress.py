from datetime import datetime

from pydantic import BaseModel


class ProgressEntryOut(BaseModel):
    id: int
    student_id: str
    material_key: str
    node_key: str | None = None
    action: str
    old_pointer: int | None = None
    new_pointer: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class MaterialProgress(BaseModel):
    material_key: str
    material_name: str
    pointer: int
    total_nodes: int
    percent: float


class StudentProgressOut(BaseModel):
    student_id: str
    student_name: str
    materials: list[MaterialProgress]
    history: list[ProgressEntryOut]


class DashboardStats(BaseModel):
    total_students: int
    total_materials: int
    active_assignments: int
    avg_completion: float
    recent_activity: list[ProgressEntryOut]


class PrintLogOut(BaseModel):
    id: int
    type: str
    job_id: str | None = None
    student_id: str | None = None
    student_name: str | None = None
    material_key: str | None = None
    material_name: str | None = None
    node_key: str | None = None
    node_name: str | None = None
    success: bool | None = None
    message: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
