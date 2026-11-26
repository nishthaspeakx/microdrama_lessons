-- Lets an interrupted revision resume without applying its edits twice.
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS edits_done boolean NOT NULL DEFAULT false;
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS video_clip_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE revisions ADD COLUMN IF NOT EXISTS changed jsonb NOT NULL DEFAULT '[]';   -- [{clipId, label, kind}]
