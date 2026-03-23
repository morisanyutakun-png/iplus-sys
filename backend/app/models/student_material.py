from datetime import datetime

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, JSON, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class StudentMaterial(Base):
    __tablename__ = "student_materials"

    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True
    )
    material_key: Mapped[str] = mapped_column(
        String, ForeignKey("materials.key", ondelete="CASCADE"), primary_key=True
    )
    pointer: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    low_score_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    student: Mapped["Student"] = relationship("Student", back_populates="materials")
    material: Mapped["Material"] = relationship("Material", lazy="selectin")


class ProgressHistory(Base):
    __tablename__ = "progress_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    material_key: Mapped[str] = mapped_column(
        String, ForeignKey("materials.key", ondelete="CASCADE"), nullable=False
    )
    node_key: Mapped[str | None] = mapped_column(String, nullable=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    old_pointer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_pointer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ReminderAcknowledgment(Base):
    __tablename__ = "reminder_acknowledgments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    material_key: Mapped[str] = mapped_column(
        String, ForeignKey("materials.key", ondelete="CASCADE"), nullable=False
    )
    acknowledged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class LowAccuracyAcknowledgment(Base):
    __tablename__ = "low_accuracy_acknowledgments"
    __table_args__ = (
        UniqueConstraint("student_id", "material_key", "node_key", name="uq_low_accuracy_ack"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    material_key: Mapped[str] = mapped_column(
        String, ForeignKey("materials.key", ondelete="CASCADE"), nullable=False
    )
    node_key: Mapped[str] = mapped_column(String, nullable=False)
    acknowledged_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ArchivedProgress(Base):
    __tablename__ = "archived_progress"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    material_key: Mapped[str] = mapped_column(String, nullable=False)
    pointer: Mapped[int] = mapped_column(Integer, nullable=False)
    archived_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
