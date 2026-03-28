from datetime import date

from pydantic import BaseModel


class NextPrintItem(BaseModel):
    student_id: str
    student_name: str
    student_grade: str | None = None
    material_key: str
    material_name: str
    node_key: str
    node_title: str
    pdf_relpath: str
    answer_pdf_relpath: str = ""
    duplex: bool
    pointer: int


class NextPrintsResponse(BaseModel):
    items: list[NextPrintItem]


class AutoQueueRequest(BaseModel):
    student_ids: list[str] | None = None
    print_mode: str = "both"  # "questions_only", "answers_only", "both"


class AutoQueueResponse(BaseModel):
    queued: int
    students: int


class StudentAnalytics(BaseModel):
    progress_timeline: list[dict]
    completion_rates: list[dict]
    pace: dict


class StudentRanking(BaseModel):
    student_id: str
    name: str
    avg_percent: float
    total_nodes_completed: int


class MaterialDifficulty(BaseModel):
    material_key: str
    name: str
    avg_pace: float
    avg_score: float | None = None


class WeeklyActivity(BaseModel):
    week: str
    records_count: int
    prints_count: int
    manual_set_count: int = 0


class OverviewAnalytics(BaseModel):
    student_rankings: list[StudentRanking]
    material_difficulty: list[MaterialDifficulty]
    weekly_activity: list[WeeklyActivity]
    completion_heatmap: list[dict]
