-- Migration: Add lesson_records table
-- Date: 2026-03-17

CREATE TABLE IF NOT EXISTS lesson_records (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    material_key VARCHAR NOT NULL REFERENCES materials(key) ON DELETE CASCADE,
    node_key VARCHAR,
    lesson_date DATE NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'completed',
    score INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_lesson_record UNIQUE (student_id, material_key, node_key, lesson_date)
);

CREATE INDEX IF NOT EXISTS idx_lesson_records_student ON lesson_records(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_records_material ON lesson_records(material_key);
CREATE INDEX IF NOT EXISTS idx_lesson_records_date ON lesson_records(lesson_date);
