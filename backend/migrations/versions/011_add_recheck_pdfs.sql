-- Add recheck PDF columns to material_nodes
-- Recheck PDFs are optional alternative PDFs used when a student retries after failing
ALTER TABLE material_nodes ADD COLUMN IF NOT EXISTS recheck_pdf_relpath VARCHAR DEFAULT '';
ALTER TABLE material_nodes ADD COLUMN IF NOT EXISTS recheck_answer_pdf_relpath VARCHAR DEFAULT '';
