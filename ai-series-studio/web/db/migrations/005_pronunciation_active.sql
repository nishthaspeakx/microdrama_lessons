-- Suggested notes are saved switched off; the user turns on the ones they want.
ALTER TABLE pronunciations ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
