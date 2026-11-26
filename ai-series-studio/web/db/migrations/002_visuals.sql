-- Release 1, build phase 2a: visual approvals.

-- Every stored file (uploads, generated images), addressed by its sha256.
CREATE TABLE IF NOT EXISTS files (
  sha text PRIMARY KEY,
  storage_key text NOT NULL,
  mime text NOT NULL,
  bytes int NOT NULL,
  origin text NOT NULL,                      -- upload | generated | derived
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One thing to approve: a character look, an outfit, a location, a prop.
CREATE TABLE IF NOT EXISTS visual_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL,                    -- character | wardrobe | location | prop
  key text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  base_prompt text NOT NULL,
  parent_key text,                           -- wardrobe → its character; age variant → base look
  episodes int[] NOT NULL DEFAULT '{}',
  required boolean NOT NULL DEFAULT true,    -- needed by an episode still to be produced
  protected boolean NOT NULL DEFAULT false,  -- a child or anyone not clearly adult
  reference_hint text,                       -- e.g. "Episode 1 still at 01:25.5"
  status text NOT NULL DEFAULT 'todo',       -- todo | generating | review | approved | flagged
  approved_version_id uuid,
  flag_reason text,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

-- A candidate: one prompt and the images it produced (or an uploaded image).
CREATE TABLE IF NOT EXISTS visual_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES visual_items(id) ON DELETE CASCADE,
  n int NOT NULL,
  prompt text NOT NULL,
  change_request text,                       -- the user's words, if this came from Change
  understood text,                           -- what the app understood, shown before generating
  views text[] NOT NULL,
  reference_shas text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',      -- draft | queued | generating | ready | failed
  error text,
  provider text,                             -- gemini | mock | upload
  model text,
  est_cents numeric NOT NULL DEFAULT 0,
  cost_cents numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, n)
);

CREATE TABLE IF NOT EXISTS visual_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES visual_versions(id) ON DELETE CASCADE,
  view text NOT NULL,
  file_sha text NOT NULL REFERENCES files(sha),
  prompt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Every paid call, for the running total and the project cap.
CREATE TABLE IF NOT EXISTS spend (
  id bigserial PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL,                    -- image | llm | voice | video
  provider text NOT NULL,
  model text,
  cents numeric NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Approved world, frozen when the user finishes step 2 (and later steps).
CREATE TABLE IF NOT EXISTS bible_versions (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, version)
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS visuals_status text NOT NULL DEFAULT 'none'; -- none | planning | ready | failed
ALTER TABLE projects ADD COLUMN IF NOT EXISTS visual_style text;
