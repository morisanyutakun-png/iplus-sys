-- 009: PDFバイナリをDBに保存するためのテーブル
CREATE TABLE IF NOT EXISTS pdf_blobs (
    relpath VARCHAR PRIMARY KEY,
    content BYTEA NOT NULL,
    size INTEGER NOT NULL DEFAULT 0,
    content_type VARCHAR NOT NULL DEFAULT 'application/pdf',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
