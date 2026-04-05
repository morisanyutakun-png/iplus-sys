from fastapi import APIRouter, Depends

from app.api.students import router as students_router
from app.api.materials import router as materials_router
from app.api.queue import router as queue_router
from app.api.print_jobs import router as jobs_router
from app.api.printers import router as printers_router
from app.api.progress import router as progress_router
from app.api.gas_webhook import router as gas_router
from app.api.pdfs import router as pdfs_router
from app.api.lesson_records import router as lesson_records_router
from app.api.auto_print import router as auto_print_router
from app.api.analytics import router as analytics_router
from app.api.word_test import router as word_test_router
from app.api.exam_materials import router as exam_materials_router
from app.api.exam_scores import router as exam_scores_router
from app.api.exam_assignments import router as exam_assignments_router
from app.api.exam_analytics import router as exam_analytics_router
from app.api.university_weights import router as university_weights_router
from app.api.exam_targets import router as exam_targets_router
from app.api.instructors import router as instructors_router
from app.api.auth import router as auth_router
from app.auth.dependencies import require_trainer_or_admin, require_admin

api_router = APIRouter()

# Auth (public — login/refresh/logout don't require auth)
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])

# Trainer + admin accessible
api_router.include_router(
    students_router, prefix="/students", tags=["students"],
    dependencies=[Depends(require_trainer_or_admin)],
)
api_router.include_router(
    progress_router, prefix="/progress", tags=["progress"],
    dependencies=[Depends(require_trainer_or_admin)],
)
api_router.include_router(
    lesson_records_router, prefix="/lesson-records", tags=["lesson-records"],
    dependencies=[Depends(require_trainer_or_admin)],
)

# Admin only
api_router.include_router(
    materials_router, prefix="/materials", tags=["materials"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    queue_router, prefix="/queue", tags=["queue"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    printers_router, prefix="/jobs/printers", tags=["printers"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    jobs_router, prefix="/jobs", tags=["jobs"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    pdfs_router, prefix="/pdfs", tags=["pdfs"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    auto_print_router, prefix="/print", tags=["auto-print"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    analytics_router, prefix="/analytics", tags=["analytics"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    word_test_router, prefix="/word-test", tags=["word-test"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    exam_materials_router, prefix="/exam-materials", tags=["exam-materials"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    exam_scores_router, prefix="/exam-scores", tags=["exam-scores"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    exam_assignments_router, prefix="/exam-assignments", tags=["exam-assignments"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    exam_analytics_router, prefix="/exam-analytics", tags=["exam-analytics"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    university_weights_router, prefix="/university-weights", tags=["university-weights"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    exam_targets_router, prefix="/exam-targets", tags=["exam-targets"],
    dependencies=[Depends(require_admin)],
)
api_router.include_router(
    instructors_router, prefix="/instructors", tags=["instructors"],
    dependencies=[Depends(require_admin)],
)

# GAS webhook: machine-to-machine, auth handled inside the handler via shared secret
api_router.include_router(gas_router, prefix="/gas", tags=["gas"])
