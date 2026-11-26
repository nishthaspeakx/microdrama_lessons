-- The exact lines (id, speaker, text) a take was made with, so an edited line shows which clips it affects.
ALTER TABLE episode_takes ADD COLUMN IF NOT EXISTS line_texts jsonb NOT NULL DEFAULT '[]';
-- Where a take's dialogue sits once the recordings are measured: [{id, start, end}] in clip seconds.
ALTER TABLE episode_takes ADD COLUMN IF NOT EXISTS line_times jsonb NOT NULL DEFAULT '[]';
