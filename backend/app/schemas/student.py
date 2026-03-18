from datetime import datetime

from pydantic import BaseModel


class StudentMaterialInfo(BaseModel):
    material_key: str
    material_name: str
    pointer: int
    total_nodes: int
    percent: float
    next_node_title: str | None = None


class StudentOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    materials: list[StudentMaterialInfo] = []

    model_config = {"from_attributes": True}


class StudentCreate(BaseModel):
    id: str
    name: str


class StudentUpdate(BaseModel):
    name: str


class StudentListOut(BaseModel):
    students: list[StudentOut]
