-- Versions made by "Create all" (and first generations) are approved the moment they are ready.
ALTER TABLE visual_versions ADD COLUMN IF NOT EXISTS auto_approve boolean NOT NULL DEFAULT false;
