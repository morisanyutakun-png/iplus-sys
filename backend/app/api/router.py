from fastapi import APIRouter

from app.api.students import router as students_router
from app.api.materials import router as materials_router
from app.api.queue import router as queue_router
from app.api.print_jobs import router as jobs_router
from app.api.progress import router as progress_router
from app.api.logs import router as logs_router
from app.api.gas_webhook import router as gas_router
from app.api.pdfs import router as pdfs_router
from app.api.lesson_records import router as lesson_records_router
from app.api.auto_print import router as auto_print_router
from app.api.analytics import router as analytics_router
from app.api.word_test import router as word_test_router

api_router = APIRouter()
api_router.include_router(students_router, prefix="/students", tags=["students"])
api_router.include_router(materials_router, prefix="/materials", tags=["materials"])
api_router.include_router(queue_router, prefix="/queue", tags=["queue"])
api_router.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
api_router.include_router(progress_router, prefix="/progress", tags=["progress"])
api_router.include_router(logs_router, prefix="/logs", tags=["logs"])
api_router.include_router(gas_router, prefix="/gas", tags=["gas"])
api_router.include_router(pdfs_router, prefix="/pdfs", tags=["pdfs"])
api_router.include_router(lesson_records_router, prefix="/lesson-records", tags=["lesson-records"])
api_router.include_router(auto_print_router, prefix="/print", tags=["auto-print"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(word_test_router, prefix="/word-test", tags=["word-test"])
