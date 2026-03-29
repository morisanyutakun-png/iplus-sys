from datetime import date, datetime

from pydantic import BaseModel


# ── ExamSubject ──

class ExamSubjectCreate(BaseModel):
    subject_name: str
    max_score: float


class ExamSubjectOut(BaseModel):
    id: int
    exam_material_id: int
    subject_name: str
    max_score: float
    sort_order: int
    node_key: str | None = None

    model_config = {"from_attributes": True}


# ── ExamMaterial ──

class ExamMaterialCreate(BaseModel):
    name: str
    exam_type: str  # common_test / university_past
    year: int | None = None
    university: str | None = None
    faculty: str | None = None
    exam_period: str | None = None
    subjects: list[ExamSubjectCreate] = []


class ExamMaterialOut(BaseModel):
    id: int
    name: str
    exam_type: str
    year: int | None = None
    university: str | None = None
    faculty: str | None = None
    exam_period: str | None = None
    sort_order: int
    subjects: list[ExamSubjectOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── StudentExamAssignment ──

class ExamAssignmentCreate(BaseModel):
    student_id: str
    exam_material_id: int


class ExamAssignmentOut(BaseModel):
    student_id: str
    exam_material_id: int
    assigned_at: datetime
    exam_name: str | None = None

    model_config = {"from_attributes": True}


# ── ExamScore ──

class ExamScoreUpsert(BaseModel):
    student_id: str
    exam_material_id: int
    exam_subject_id: int
    score: float | None = None
    attempt_date: date
    notes: str | None = None


class ExamScoreBatchRequest(BaseModel):
    scores: list[ExamScoreUpsert]


class ExamScoreBatchResponse(BaseModel):
    upserted: int


class ExamScoreOut(BaseModel):
    id: int
    student_id: str
    exam_material_id: int
    exam_subject_id: int
    score: float | None = None
    attempt_date: date
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── ExamScoreTarget ──

class ExamScoreTargetCreate(BaseModel):
    student_id: str
    exam_material_id: int
    exam_subject_id: int
    target_score: float


class ExamScoreTargetBatchRequest(BaseModel):
    targets: list[ExamScoreTargetCreate]


class ExamScoreTargetOut(BaseModel):
    id: int
    student_id: str
    exam_material_id: int
    exam_subject_id: int
    target_score: float

    model_config = {"from_attributes": True}


# ── UniversityScoreWeight ──

class UniversityScoreWeightCreate(BaseModel):
    name: str
    university: str
    faculty: str
    weights: dict  # {"英語R": {"max": 100, "compressed_max": 60}, ...}
    total_compressed_max: float


class UniversityScoreWeightUpdate(BaseModel):
    name: str | None = None
    university: str | None = None
    faculty: str | None = None
    weights: dict | None = None
    total_compressed_max: float | None = None


class UniversityScoreWeightOut(BaseModel):
    id: int
    name: str
    university: str
    faculty: str
    weights: dict
    total_compressed_max: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Analytics ──

class SubjectScoreDetail(BaseModel):
    subject_name: str
    max_score: float
    score: float | None = None
    target_score: float | None = None


class ExamAttemptSummary(BaseModel):
    exam_material_id: int
    exam_name: str
    exam_type: str
    attempt_date: date
    subjects: list[SubjectScoreDetail]
    total_score: float
    total_max: float
    percentage: float


class StudentExamSummary(BaseModel):
    student_id: str
    student_name: str
    attempts: list[ExamAttemptSummary]


class CompressedScoreSubject(BaseModel):
    subject_name: str
    raw_score: float
    original_max: float
    compressed_max: float
    compressed_score: float


class CompressedScoreResult(BaseModel):
    weight_name: str
    university: str
    faculty: str
    subjects: list[CompressedScoreSubject]
    total_compressed: float
    total_compressed_max: float
    percentage: float


class StudentExamRanking(BaseModel):
    student_id: str
    student_name: str
    grade: str | None = None
    total_score: float
    total_max: float
    percentage: float


class SubjectAverage(BaseModel):
    subject_name: str
    max_score: float
    avg_score: float
    avg_percentage: float
    student_count: int


class ExamOverview(BaseModel):
    exam_material_id: int
    exam_name: str
    rankings: list[StudentExamRanking]
    subject_averages: list[SubjectAverage]
    class_average_total: float
    class_average_percentage: float
