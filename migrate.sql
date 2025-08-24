-- Remove NOT NULL constraint from resident_id in bathing_records table
ALTER TABLE bathing_records ALTER COLUMN resident_id DROP NOT NULL;