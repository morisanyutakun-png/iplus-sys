-- Migration: Add subject column to materials table
-- Date: 2026-03-18

ALTER TABLE materials ADD COLUMN IF NOT EXISTS subject VARCHAR DEFAULT 'その他';
