-- 005: score/max_score を REAL 化 + accuracy_rate + 低正答率リマインド

-- 1. score を INTEGER → REAL に変更（既存データ互換）
ALTER TABLE lesson_records ALTER COLUMN score TYPE REAL;

-- 2. max_score, accuracy_rate カラム追加
ALTER TABLE lesson_records ADD COLUMN IF NOT EXISTS max_score REAL;
ALTER TABLE lesson_records ADD COLUMN IF NOT EXISTS accuracy_rate REAL;

-- 3. 低正答率リマインド用の確認テーブル
CREATE TABLE IF NOT EXISTS low_accuracy_acknowledgments (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    material_key VARCHAR NOT NULL REFERENCES materials(key) ON DELETE CASCADE,
    node_key VARCHAR NOT NULL,
    acknowledged_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_low_accuracy_ack UNIQUE (student_id, material_key, node_key)
);

-- 4. 連続低正答率検索用インデックス
CREATE INDEX IF NOT EXISTS idx_lesson_records_accuracy_lookup
    ON lesson_records(student_id, material_key, node_key, lesson_date DESC);
