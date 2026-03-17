from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.print_log import PrintLog
from app.schemas.progress import PrintLogOut

router = APIRouter()


@router.get("")
async def list_logs(
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PrintLog).order_by(PrintLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return {"logs": [PrintLogOut.model_validate(l) for l in logs]}
