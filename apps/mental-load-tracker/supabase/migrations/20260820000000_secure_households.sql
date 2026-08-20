-- Existing installations: apply the canonical idempotent migration from the
-- Supabase CLI. The SQL editor should run ../schema.sql directly instead.
-- psql resolves \ir relative to this migration file.
\ir ../schema.sql
