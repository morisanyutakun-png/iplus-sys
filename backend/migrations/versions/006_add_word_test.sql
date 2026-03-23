-- 006: 単語ミックステスト - 単語帳・単語・テストセッション

-- word_books: 単語帳（例: ターゲット1900）
CREATE TABLE IF NOT EXISTS word_books (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL UNIQUE,
    description VARCHAR DEFAULT '',
    total_words INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- words: 個別の単語
CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    word_book_id INTEGER NOT NULL REFERENCES word_books(id) ON DELETE CASCADE,
    word_number INTEGER NOT NULL,
    question VARCHAR NOT NULL,
    answer VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT uq_word_book_number UNIQUE (word_book_id, word_number)
);
CREATE INDEX IF NOT EXISTS idx_words_book_number ON words(word_book_id, word_number);

-- word_test_sessions: テスト結果
CREATE TABLE IF NOT EXISTS word_test_sessions (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    word_book_id INTEGER NOT NULL REFERENCES word_books(id) ON DELETE CASCADE,
    ranges JSONB NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_count INTEGER NOT NULL,
    accuracy_rate REAL NOT NULL,
    test_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_word_test_student ON word_test_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_word_test_date ON word_test_sessions(test_date);
