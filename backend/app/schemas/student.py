from datetime import datetime

from pydantic import BaseModel


class StudentMaterialInfo(BaseModel):
    material_key: str
    material_name: str
    pointer: int
    total_nodes: int
    max_node: int | None = None
    percent: float
    next_node_title: str | None = None


class StudentOut(BaseModel):
    id: str
    name: str
    grade: str | None = None
    created_at: datetime
    materials: list[StudentMaterialInfo] = []

    model_config = {"from_attributes": True}


class StudentCreate(BaseModel):
    id: str
    name: str
    grade: str | None = None


class StudentUpdate(BaseModel):
    name: str | None = None
    grade: str | None = None


class StudentListOut(BaseModel):
    students: list[StudentOut]
