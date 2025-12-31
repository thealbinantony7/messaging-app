-- Migration: Add password_hash to users table (and remove phone completely if present)
ALTER TABLE users ADD COLUMN password_hash VARCHAR(255);

-- Ensure email is unique (already handled by schema, but good for safety)
-- ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);

-- Remove phone column if it exists (cleanup)
-- ALTER TABLE users DROP COLUMN IF EXISTS phone;
