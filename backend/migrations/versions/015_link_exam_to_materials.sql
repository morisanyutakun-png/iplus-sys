-- 015: Link exam_materials to materials table for mastery integration
-- Each exam subject becomes a Material+MaterialNode, enabling mastery spreadsheet input

ALTER TABLE materials ADD COLUMN IF NOT EXISTS exam_material_id INTEGER REFERENCES exam_materials(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_materials_exam_material ON materials(exam_material_id);

ALTER TABLE exam_subjects ADD COLUMN IF NOT EXISTS node_key VARCHAR;
