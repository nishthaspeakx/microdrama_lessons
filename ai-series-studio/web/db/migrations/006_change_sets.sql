-- A change can update a whole family of items; versions can wait for a parent's new version.
ALTER TABLE visual_versions ADD COLUMN IF NOT EXISTS change_set_id uuid;
ALTER TABLE visual_versions ADD COLUMN IF NOT EXISTS wait_for_version_id uuid REFERENCES visual_versions(id) ON DELETE SET NULL;
ALTER TABLE visual_versions ADD COLUMN IF NOT EXISTS new_description text;
CREATE INDEX IF NOT EXISTS visual_versions_wait ON visual_versions (wait_for_version_id) WHERE wait_for_version_id IS NOT NULL;
