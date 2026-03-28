-- 2026-03-28: Add grade column to students and student_grade to print_queue
ALTER TABLE students ADD COLUMN IF NOT EXISTS grade VARCHAR;
ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS student_grade VARCHAR;
