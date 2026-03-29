-- 014: Add exam management tables (共通テスト・過去問管理)

CREATE TABLE IF NOT EXISTS exam_materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    exam_type VARCHAR NOT NULL,
    year INTEGER,
    university VARCHAR,
    faculty VARCHAR,
    exam_period VARCHAR,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_subjects (
    id SERIAL PRIMARY KEY,
    exam_material_id INTEGER NOT NULL REFERENCES exam_materials(id) ON DELETE CASCADE,
    subject_name VARCHAR NOT NULL,
    max_score REAL NOT NULL,
    sort_order INTEGER DEFAULT 0,
    CONSTRAINT uq_exam_subject UNIQUE (exam_material_id, subject_name)
);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_material ON exam_subjects(exam_material_id);

CREATE TABLE IF NOT EXISTS student_exam_assignments (
    student_id VARCHAR NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_material_id INTEGER NOT NULL REFERENCES exam_materials(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (student_id, exam_material_id)
);

CREATE TABLE IF NOT EXISTS exam_scores (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_material_id INTEGER NOT NULL REFERENCES exam_materials(id) ON DELETE CASCADE,
    exam_subject_id INTEGER NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
    score REAL,
    attempt_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_exam_score UNIQUE (student_id, exam_subject_id, attempt_date)
);
CREATE INDEX IF NOT EXISTS idx_exam_scores_student ON exam_scores(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_material ON exam_scores(exam_material_id);
CREATE INDEX IF NOT EXISTS idx_exam_scores_date ON exam_scores(attempt_date);

CREATE TABLE IF NOT EXISTS university_score_weights (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    university VARCHAR NOT NULL,
    faculty VARCHAR NOT NULL,
    weights JSONB NOT NULL,
    total_compressed_max REAL NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_score_targets (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_material_id INTEGER NOT NULL REFERENCES exam_materials(id) ON DELETE CASCADE,
    exam_subject_id INTEGER NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
    target_score REAL NOT NULL,
    CONSTRAINT uq_exam_target UNIQUE (student_id, exam_subject_id)
);
