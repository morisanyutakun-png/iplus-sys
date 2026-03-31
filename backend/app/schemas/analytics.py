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


class AccuracyEntry(BaseModel):
    date: str
    material_key: str
    material_name: str
    accuracy_rate: float


class StudentAccuracyResponse(BaseModel):
    entries: list[AccuracyEntry]
    fitness_rate: float | None = None
