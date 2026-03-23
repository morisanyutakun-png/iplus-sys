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


class NearlyCompleteItem(BaseModel):
    student_id: str
    student_name: str
    material_key: str
    material_name: str
    pointer: int
    total_nodes: int
    remaining: int
    acknowledged: bool = False


class AcknowledgeReminderRequest(BaseModel):
    student_id: str
    material_key: str


class WeeklyTrendItem(BaseModel):
    week: str
    actions: int


class StudentMaterialProgress(BaseModel):
    material_key: str
    material_name: str
    pointer: int
    total_nodes: int
    percent: float


class StudentProgressRow(BaseModel):
    student_id: str
    student_name: str
    materials: list[StudentMaterialProgress]
    avg_percent: float


class LowAccuracyItem(BaseModel):
    student_id: str
    student_name: str
    material_key: str
    material_name: str
    node_key: str
    node_title: str = ""
    latest_rates: list[float] = []
    acknowledged: bool = False


class AcknowledgeLowAccuracyRequest(BaseModel):
    student_id: str
    material_key: str
    node_key: str


class DashboardStats(BaseModel):
    total_students: int
    total_materials: int
    nearly_complete: list[NearlyCompleteItem]
    low_accuracy: list[LowAccuracyItem] = []
    weekly_actions: int
    weekly_trend: list[WeeklyTrendItem]
    student_progress: list[StudentProgressRow]
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
