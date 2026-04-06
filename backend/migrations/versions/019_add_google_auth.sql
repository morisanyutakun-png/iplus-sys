-- 2026-04-07: Add Google OAuth support
-- Add google_email column for Google account authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email VARCHAR(256) UNIQUE;

-- Make hashed_password nullable (Google users have no password)
ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;

-- Index for google_email lookups
CREATE INDEX IF NOT EXISTS idx_users_google_email ON users(google_email);
