from datetime import datetime, date

from sqlalchemy import (
    String, Integer, Float, Date, Text, Boolean,
    DateTime, ForeignKey, JSON, func, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB

from app.models.base import Base


class ExamMaterial(Base):
    __tablename__ = "exam_materials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    exam_type: Mapped[str] = mapped_column(String, nullable=False)  # common_test / university_past
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    university: Mapped[str | None] = mapped_column(String, nullable=True)
    faculty: Mapped[str | None] = mapped_column(String, nullable=True)
    exam_period: Mapped[str | None] = mapped_column(String, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    subjects: Mapped[list["ExamSubject"]] = relationship(
        "ExamSubject",
        back_populates="exam_material",
        lazy="selectin",
        order_by="ExamSubject.sort_order",
        cascade="all, delete-orphan",
    )


class ExamSubject(Base):
    __tablename__ = "exam_subjects"
    __table_args__ = (
        UniqueConstraint("exam_material_id", "subject_name", name="uq_exam_subject"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exam_material_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_materials.id", ondelete="CASCADE"), nullable=False
    )
    subject_name: Mapped[str] = mapped_column(String, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    node_key: Mapped[str | None] = mapped_column(String, nullable=True)

    exam_material: Mapped["ExamMaterial"] = relationship(
        "ExamMaterial", back_populates="subjects"
    )


class StudentExamAssignment(Base):
    __tablename__ = "student_exam_assignments"

    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), primary_key=True
    )
    exam_material_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_materials.id", ondelete="CASCADE"), primary_key=True
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class ExamScore(Base):
    __tablename__ = "exam_scores"
    __table_args__ = (
        UniqueConstraint("student_id", "exam_subject_id", "attempt_date", name="uq_exam_score"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    exam_material_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_materials.id", ondelete="CASCADE"), nullable=False
    )
    exam_subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_subjects.id", ondelete="CASCADE"), nullable=False
    )
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    attempt_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class UniversityScoreWeight(Base):
    __tablename__ = "university_score_weights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    university: Mapped[str] = mapped_column(String, nullable=False)
    faculty: Mapped[str] = mapped_column(String, nullable=False)
    weights: Mapped[dict] = mapped_column(JSONB, nullable=False)
    total_compressed_max: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ExamScoreTarget(Base):
    __tablename__ = "exam_score_targets"
    __table_args__ = (
        UniqueConstraint("student_id", "exam_subject_id", name="uq_exam_target"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    exam_material_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_materials.id", ondelete="CASCADE"), nullable=False
    )
    exam_subject_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_subjects.id", ondelete="CASCADE"), nullable=False
    )
    target_score: Mapped[float] = mapped_column(Float, nullable=False)
