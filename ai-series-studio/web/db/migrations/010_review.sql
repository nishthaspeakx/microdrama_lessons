-- Release 1, build phase 4: timestamped review and revisions.

-- Edits that need no new footage live on the clip and are applied at assembly.
ALTER TABLE episode_clips ADD COLUMN IF NOT EXISTS trim_start numeric NOT NULL DEFAULT 0;   -- seconds cut from the head
ALTER TABLE episode_clips ADD COLUMN IF NOT EXISTS trim_end numeric NOT NULL DEFAULT 0;     -- seconds cut from the tail
ALTER TABLE episode_clips ADD COLUMN IF NOT EXISTS ambience numeric NOT NULL DEFAULT 0.3;   -- level of the clip's own sound under our dialogue
ALTER TABLE episode_clips ADD COLUMN IF NOT EXISTS sfx jsonb NOT NULL DEFAULT '[]';         -- [{sha, at, volume, description}] at = clip seconds
ALTER TABLE episode_clips ADD COLUMN IF NOT EXISTS mutes jsonb NOT NULL DEFAULT '[]';       -- [{from, to}] silence the clip's own sound, clip seconds

-- Every assembled cut is kept. Timestamps in notes refer to the cut being watched.
CREATE TABLE IF NOT EXISTS episode_cuts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  n int NOT NULL,
  video_sha text NOT NULL REFERENCES files(sha),
  srt_sha text REFERENCES files(sha),
  seconds numeric NOT NULL,
  markers jsonb NOT NULL DEFAULT '[]',        -- scene markers [{scene, title, start}]
  clip_map jsonb NOT NULL DEFAULT '[]',       -- [{clip_id, take_id, n, scene, start, end, trim_start, lines:[{id,start,end}]}] in cut seconds
  revision_id uuid,
  changes jsonb NOT NULL DEFAULT '[]',        -- [{start, end, label}] where this cut differs from the one it revises
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (episode_id, n)
);
ALTER TABLE episodes ADD COLUMN IF NOT EXISTS current_cut_id uuid;

CREATE TABLE IF NOT EXISTS edit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  cut_id uuid NOT NULL REFERENCES episode_cuts(id) ON DELETE CASCADE,  -- the version the note was written against
  t_start numeric NOT NULL,
  t_end numeric,
  final_shot boolean NOT NULL DEFAULT false,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'open',        -- open | planned | applied | dismissed
  revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  base_cut_id uuid NOT NULL REFERENCES episode_cuts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'planning',    -- planning | planned | applying | applied | failed | discarded
  plan jsonb NOT NULL DEFAULT '[]',           -- the instructions, possibly edited by the user
  user_edited boolean NOT NULL DEFAULT false,
  result_cut_id uuid,
  progress text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
