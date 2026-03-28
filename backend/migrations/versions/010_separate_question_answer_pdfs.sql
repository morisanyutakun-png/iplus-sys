-- 010: Separate question and answer PDFs
-- Add answer_pdf_relpath to material_nodes for storing answer PDF separately
ALTER TABLE material_nodes ADD COLUMN IF NOT EXISTS answer_pdf_relpath VARCHAR NOT NULL DEFAULT '';

-- Add pdf_type to print_queue to distinguish question vs answer items
ALTER TABLE print_queue ADD COLUMN IF NOT EXISTS pdf_type VARCHAR NOT NULL DEFAULT 'question';

-- Add pdf_type to print_job_items
ALTER TABLE print_job_items ADD COLUMN IF NOT EXISTS pdf_type VARCHAR NOT NULL DEFAULT 'question';
