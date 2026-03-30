from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.instructor import Instructor

router = APIRouter()


class InstructorOut(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class InstructorCreate(BaseModel):
    name: str


@router.get("")
async def list_instructors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Instructor).order_by(Instructor.name))
    instructors = result.scalars().all()
    return {"instructors": [InstructorOut.model_validate(i) for i in instructors]}


@router.post("", response_model=InstructorOut)
async def create_instructor(body: InstructorCreate, db: AsyncSession = Depends(get_db)):
    instructor = Instructor(name=body.name)
    db.add(instructor)
    await db.commit()
    await db.refresh(instructor)
    return InstructorOut.model_validate(instructor)


@router.delete("/{instructor_id}")
async def delete_instructor(instructor_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Instructor).where(Instructor.id == instructor_id))
    instructor = result.scalars().first()
    if instructor:
        await db.delete(instructor)
        await db.commit()
        return {"status": "deleted"}
    return {"status": "not_found"}
