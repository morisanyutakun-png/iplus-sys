from datetime import datetime

from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Material(Base):
    __tablename__ = "materials"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, default="その他")
    start_on: Mapped[str | None] = mapped_column(String, nullable=True)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    exam_material_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("exam_materials.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    nodes: Mapped[list["MaterialNode"]] = relationship(
        "MaterialNode",
        back_populates="material",
        lazy="selectin",
        order_by="MaterialNode.sort_order",
    )


class MaterialNode(Base):
    __tablename__ = "material_nodes"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    material_key: Mapped[str] = mapped_column(
        String, ForeignKey("materials.key", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    range_text: Mapped[str] = mapped_column(String, default="")
    pdf_relpath: Mapped[str] = mapped_column(String, default="")
    answer_pdf_relpath: Mapped[str] = mapped_column(String, default="")
    recheck_pdf_relpath: Mapped[str] = mapped_column(String, default="")
    recheck_answer_pdf_relpath: Mapped[str] = mapped_column(String, default="")
    duplex: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    aliases: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    material: Mapped["Material"] = relationship("Material", back_populates="nodes")
