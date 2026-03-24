-- 007: WordBook に material_key を追加（教材連携用）
ALTER TABLE word_books ADD COLUMN IF NOT EXISTS material_key VARCHAR
    REFERENCES materials(key) ON DELETE SET NULL;
