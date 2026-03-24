from datetime import date, datetime

from sqlalchemy import (
    String, Integer, Float, Date, DateTime, ForeignKey, UniqueConstraint, func,
)
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class WordBook(Base):
    __tablename__ = "word_books"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    description: Mapped[str] = mapped_column(String, default="", server_default="")
    total_words: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    material_key: Mapped[str | None] = mapped_column(
        String, ForeignKey("materials.key", ondelete="SET NULL"), nullable=True, default=None
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    words: Mapped[list["Word"]] = relationship(
        "Word", back_populates="word_book", lazy="selectin",
        order_by="Word.word_number",
    )


class Word(Base):
    __tablename__ = "words"
    __table_args__ = (
        UniqueConstraint("word_book_id", "word_number", name="uq_word_book_number"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    word_book_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("word_books.id", ondelete="CASCADE"), nullable=False
    )
    word_number: Mapped[int] = mapped_column(Integer, nullable=False)
    question: Mapped[str] = mapped_column(String, nullable=False)
    answer: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    word_book: Mapped["WordBook"] = relationship("WordBook", back_populates="words")


class WordTestSession(Base):
    __tablename__ = "word_test_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[str] = mapped_column(
        String, ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    word_book_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("word_books.id", ondelete="CASCADE"), nullable=False
    )
    ranges: Mapped[list] = mapped_column(JSONB, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False)
    accuracy_rate: Mapped[float] = mapped_column(Float, nullable=False)
    test_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
