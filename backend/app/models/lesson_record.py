from datetime import date, datetime

from sqlalchemy import String, Integer, Float, Date, DateTime, Text, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class LessonRecord(Base):
    __tablename__ = "lesson_records"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "material_key", "node_key", "lesson_date",
            name="uq_lesson_record",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    material_key: Mapped[str] = mapped_column(
        String, ForeignKey("materials.key", ondelete="CASCADE"), nullable=False
    )
    node_key: Mapped[str | None] = mapped_column(String, nullable=True)
    lesson_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="completed")
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
