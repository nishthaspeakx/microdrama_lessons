-- Release 1, build phase 3: one complete episode.
-- Audio first: every line is recorded with its locked voice, each clip gets a
-- dialogue stem cut to its length, and the picture is generated against it.

CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number int NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'planning',   -- planning | plan_failed | ready | generating | assembling | assembled
  source text NOT NULL DEFAULT 'sources',    -- sources | draft (no screenplay in the sources)
  screenplay jsonb NOT NULL DEFAULT '{}',     -- {scenes:[{n,heading,location_key,summary,lines:[{id,speaker,devanagari,english,roman,direction}]}], notes:[]}
  settings jsonb NOT NULL DEFAULT '{}',       -- {model, resolution, aspect_ratio, fps, width, height, subtitles}
  bible_version int,
  cut_sha text REFERENCES files(sha),
  cut_srt_sha text REFERENCES files(sha),
  cut_markers jsonb NOT NULL DEFAULT '[]',    -- [{scene, title, start}]
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);

-- One recording per spoken line, with the locked voice of its speaker.
CREATE TABLE IF NOT EXISTS episode_lines (
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  line_id text NOT NULL,
  role_key text,
  spoken_text text NOT NULL,                 -- after pronunciation notes
  voice_id text,
  audio_sha text REFERENCES files(sha),
  duration_s numeric,
  status text NOT NULL DEFAULT 'queued',     -- queued | recording | ready | failed
  error text,
  cost_cents numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (episode_id, line_id)
);

-- A clip is one video generation (4 to 15 seconds) holding one to three shots.
CREATE TABLE IF NOT EXISTS episode_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  scene_n int NOT NULL,
  n int NOT NULL,                             -- order in the episode
  duration_s int NOT NULL,
  shots jsonb NOT NULL DEFAULT '[]',          -- [{t0,t1,framing,action}]
  lines jsonb NOT NULL DEFAULT '[]',          -- [{id, at}] seconds from the clip start
  refs jsonb NOT NULL DEFAULT '[]',           -- visual item keys
  prompt text NOT NULL,
  sound text NOT NULL DEFAULT '',
  transition text NOT NULL DEFAULT 'cut',
  status text NOT NULL DEFAULT 'draft',       -- draft | queued | generating | ready | failed
  current_take_id uuid,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id, n)
);

-- Every generation attempt for a clip. Earlier takes stay so one can be restored.
CREATE TABLE IF NOT EXISTS episode_takes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id uuid NOT NULL REFERENCES episode_clips(id) ON DELETE CASCADE,
  n int NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  resolution text NOT NULL,
  duration_s int NOT NULL,
  prompt text NOT NULL,                       -- the full prompt as sent
  ref_shas jsonb NOT NULL DEFAULT '[]',
  stem_sha text REFERENCES files(sha),
  request_id text,                            -- provider request; polling resumes from it after a restart
  status text NOT NULL DEFAULT 'queued',      -- queued | submitted | ready | failed
  video_sha text REFERENCES files(sha),
  error text,
  est_cents numeric NOT NULL DEFAULT 0,
  cost_cents numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (clip_id, n)
);

-- Files already uploaded to a provider, so a reference is sent once a day, not once per clip.
CREATE TABLE IF NOT EXISTS provider_uploads (
  sha text NOT NULL REFERENCES files(sha),
  provider text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sha, provider)
);
