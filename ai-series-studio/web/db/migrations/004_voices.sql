-- Release 1, build phase 2b: voice casting.

-- One speaking part to cast. One voice per character across ages unless the
-- story gives an age its own voice (for example Veer at seventeen).
CREATE TABLE IF NOT EXISTS voice_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  name text NOT NULL,
  portrait_item_key text,                    -- visual item whose approved face is shown
  voice_brief text NOT NULL,                 -- age, gender, accent, tone: drives Voice Design
  audition_text text NOT NULL,               -- the same text every candidate reads (100+ characters)
  script_lines jsonb NOT NULL DEFAULT '[]',  -- this character's lines from the script
  reference_hint text,                       -- e.g. "Episode 1 at 00:57.7"
  reference_audio_sha text REFERENCES files(sha),
  required boolean NOT NULL DEFAULT true,
  protected boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'todo',       -- todo | generating | review | locked
  locked_candidate_id uuid,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS voice_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES voice_roles(id) ON DELETE CASCADE,
  n int NOT NULL,
  source text NOT NULL,                      -- design | pasted
  label text NOT NULL,
  provider text NOT NULL,                    -- elevenlabs | mock
  provider_voice_id text,                    -- set for pasted voices, and for designs once saved
  generated_voice_id text,                   -- Voice Design preview id, until saved
  description text,
  model text,
  settings jsonb NOT NULL DEFAULT '{}',
  text text NOT NULL,
  audio_sha text REFERENCES files(sha),
  status text NOT NULL DEFAULT 'queued',     -- queued | generating | ready | failed
  error text,
  cost_cents numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, n)
);

-- Project-wide pronunciation notes, applied to every line before speech.
CREATE TABLE IF NOT EXISTS pronunciations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  written text NOT NULL,
  say_as text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, written)
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS voices_status text NOT NULL DEFAULT 'none'; -- none | planning | ready | failed
