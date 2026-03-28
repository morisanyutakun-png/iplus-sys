from datetime import datetime

from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[str] = mapped_column(String, default="created")
    printer_name: Mapped[str | None] = mapped_column(String, nullable=True)
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    missing: Mapped[int] = mapped_column(Integer, default=0)
    merged_pdf: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    executed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    items: Mapped[list["PrintJobItem"]] = relationship(
        "PrintJobItem",
        back_populates="job",
        lazy="selectin",
        order_by="PrintJobItem.sort_order",
    )


class PrintJobItem(Base):
    __tablename__ = "print_job_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(
        String, ForeignKey("print_jobs.id", ondelete="CASCADE"), nullable=False
    )
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    student_id: Mapped[str | None] = mapped_column(String, nullable=True)
    student_name: Mapped[str | None] = mapped_column(String, nullable=True)
    material_key: Mapped[str | None] = mapped_column(String, nullable=True)
    material_name: Mapped[str | None] = mapped_column(String, nullable=True)
    node_key: Mapped[str | None] = mapped_column(String, nullable=True)
    node_name: Mapped[str | None] = mapped_column(String, nullable=True)
    pdf_relpath: Mapped[str | None] = mapped_column(String, nullable=True)
    pdf_resolved: Mapped[str | None] = mapped_column(String, nullable=True)
    missing_pdf: Mapped[bool] = mapped_column(Boolean, default=False)
    range_text: Mapped[str | None] = mapped_column(String, nullable=True)
    duplex: Mapped[bool] = mapped_column(Boolean, default=False)
    start_on: Mapped[str | None] = mapped_column(String, nullable=True)
    copies: Mapped[int] = mapped_column(Integer, default=1)
    pdf_type: Mapped[str] = mapped_column(String, default="question")

    job: Mapped["PrintJob"] = relationship("PrintJob", back_populates="items")
