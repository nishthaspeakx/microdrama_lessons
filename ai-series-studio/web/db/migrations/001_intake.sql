-- Release 1, build phase 1: projects, sources, intake, jobs.
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  step int NOT NULL DEFAULT 1,              -- 1 upload, 2 visuals, 3 voices, 4 episode, 5 review
  status text NOT NULL DEFAULT 'created',   -- created, extracting, intake_ready, intake_failed
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS source_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  idx int NOT NULL,                          -- d1, d2 ... in upload order
  filename text NOT NULL,
  kind text NOT NULL,                        -- upload | typed_brief
  mime text,
  sha256 text NOT NULL,
  bytes int NOT NULL,
  storage_key text,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, idx)
);

CREATE TABLE IF NOT EXISTS source_sections (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ref text NOT NULL,                         -- 'd1:s12'
  document_id uuid NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
  level int NOT NULL,
  heading text NOT NULL,
  path text[] NOT NULL DEFAULT '{}',
  start_line int NOT NULL,
  end_line int NOT NULL,
  text text NOT NULL,
  kind text,                                 -- set by extraction: screenplay, production_note, sample_prompt, ...
  PRIMARY KEY (project_id, ref)
);

CREATE TABLE IF NOT EXISTS intake (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  extraction jsonb NOT NULL,                 -- as returned by the model, never edited
  summary jsonb NOT NULL,                    -- the user's editable copy
  warnings jsonb NOT NULL DEFAULT '[]',
  backend text NOT NULL,                     -- api | recorded
  model text,
  input_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'queued',     -- queued, running, done, failed
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 2,
  error text,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS jobs_queue ON jobs (status, run_after, created_at);

CREATE TABLE IF NOT EXISTS llm_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  role text NOT NULL,
  backend text NOT NULL,
  model text,
  input_tokens int, output_tokens int, cache_read_tokens int,
  ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id bigserial PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'
);
