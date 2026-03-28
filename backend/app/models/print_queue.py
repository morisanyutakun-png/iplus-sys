from datetime import datetime

from sqlalchemy import String, Boolean, Integer, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PrintQueue(Base):
    __tablename__ = "print_queue"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    student_name: Mapped[str | None] = mapped_column(String, nullable=True)
    material_key: Mapped[str] = mapped_column(String, nullable=False)
    material_name: Mapped[str | None] = mapped_column(String, nullable=True)
    material_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    node_key: Mapped[str | None] = mapped_column(String, nullable=True)
    node_name: Mapped[str | None] = mapped_column(String, nullable=True)
    node_valid: Mapped[bool] = mapped_column(Boolean, default=True)
    node_matched_material: Mapped[str | None] = mapped_column(String, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String, default="pending")
    start_on: Mapped[str | None] = mapped_column(String, nullable=True)
    # GAS payload fields
    gas_status: Mapped[str | None] = mapped_column(String, nullable=True)
    gas_today: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    gas_due: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    print_r: Mapped[bool] = mapped_column(Boolean, default=False)
    print_w: Mapped[bool] = mapped_column(Boolean, default=False)
    gas_results: Mapped[list | None] = mapped_column(JSON, default=list)
    gas_works: Mapped[list | None] = mapped_column(JSON, default=list)
    work_title: Mapped[str | None] = mapped_column(String, nullable=True)
    work_detail: Mapped[str | None] = mapped_column(String, nullable=True)
    # Scheduling (for print reservation automation)
    scheduled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    recurrence: Mapped[str | None] = mapped_column(String, nullable=True)
    # Job reference
    generated_job_id: Mapped[str | None] = mapped_column(String, nullable=True)
    generated_pdf: Mapped[str | None] = mapped_column(String, nullable=True)
    pdf_type: Mapped[str] = mapped_column(String, default="question")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
