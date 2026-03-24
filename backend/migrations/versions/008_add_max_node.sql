-- 008: student_materials に max_node を追加（範囲限定割り当て用）
ALTER TABLE student_materials ADD COLUMN IF NOT EXISTS max_node INTEGER;
