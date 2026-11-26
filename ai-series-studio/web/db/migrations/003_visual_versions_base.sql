-- A changed version regenerates some views and carries the rest over from its base.
ALTER TABLE visual_versions ADD COLUMN IF NOT EXISTS base_version_id uuid REFERENCES visual_versions(id) ON DELETE SET NULL;
ALTER TABLE visual_versions ADD COLUMN IF NOT EXISTS keep_identity boolean NOT NULL DEFAULT true;
