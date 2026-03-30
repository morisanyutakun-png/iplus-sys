-- 2026-03-30: Add instructors table and instructor_id to lesson_records
CREATE TABLE IF NOT EXISTS instructors (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lesson_records ADD COLUMN IF NOT EXISTS instructor_id INTEGER;
