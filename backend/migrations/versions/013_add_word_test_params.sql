-- 2026-03-28: Store word test generation parameters on student_materials
ALTER TABLE student_materials ADD COLUMN IF NOT EXISTS questions_per_test INTEGER;
ALTER TABLE student_materials ADD COLUMN IF NOT EXISTS rows_per_side INTEGER;
