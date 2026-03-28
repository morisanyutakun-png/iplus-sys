from datetime import datetime

from pydantic import BaseModel


class MaterialNodeOut(BaseModel):
    key: str
    material_key: str
    title: str
    range_text: str
    pdf_relpath: str
    answer_pdf_relpath: str = ""
    recheck_pdf_relpath: str = ""
    recheck_answer_pdf_relpath: str = ""
    duplex: bool
    sort_order: int

    model_config = {"from_attributes": True}


class MaterialOut(BaseModel):
    key: str
    name: str
    subject: str = "その他"
    start_on: str | None = None
    aliases: list[str] = []
    sort_order: int
    nodes: list[MaterialNodeOut] = []

    model_config = {"from_attributes": True}


class MaterialListOut(BaseModel):
    materials: list[MaterialOut]


class MaterialCreate(BaseModel):
    key: str
    name: str
    start_on: str | None = None
    aliases: list[str] = []


class MaterialCreateSimple(BaseModel):
    name: str
    subject: str = "その他"


class MaterialNodeCreate(BaseModel):
    key: str
    title: str
    range_text: str = ""
    pdf_relpath: str = ""
    answer_pdf_relpath: str = ""
    recheck_pdf_relpath: str = ""
    recheck_answer_pdf_relpath: str = ""
    duplex: bool = False


class MaterialNodeUpdate(BaseModel):
    title: str | None = None
    range_text: str | None = None
    duplex: bool | None = None
    answer_pdf_relpath: str | None = None
    recheck_pdf_relpath: str | None = None
    recheck_answer_pdf_relpath: str | None = None
