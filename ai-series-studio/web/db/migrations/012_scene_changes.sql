-- A plain-words change to one scene in step 4: what was understood, which clips it rewrites, and their new prompts.
CREATE TABLE IF NOT EXISTS scene_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  scene_n int NOT NULL,
  request text NOT NULL,
  understood text NOT NULL DEFAULT '',
  plan jsonb NOT NULL DEFAULT '{}',          -- {clips:[{clip_n, why, prompt, shots, duration_s}], lines:[{line_id,new_devanagari,new_english}], cannot}
  est_cents numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'planned',    -- planned | applied | discarded
  created_at timestamptz NOT NULL DEFAULT now()
);
