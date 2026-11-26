-- Subset of docs/DATABASE_AND_DATA_MODELS.md for the proof of concept.
-- JSON columns are TEXT holding JSON. Times are ISO-8601 UTC.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS asset (
  id TEXT PRIMARY KEY,            -- sha256 of the bytes
  kind TEXT NOT NULL,             -- image, video, audio, document, json
  mime TEXT, bytes INTEGER, width INTEGER, height INTEGER,
  duration_ms INTEGER, fps REAL,
  storage_key TEXT NOT NULL,      -- path under data/assets
  origin TEXT NOT NULL,           -- upload, generated, derived
  source_path TEXT,               -- repo-relative path it was imported from
  provider_job_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY, slug TEXT UNIQUE, name TEXT, name_en TEXT,
  status TEXT, production_mode TEXT, config TEXT,
  current_bible_version INTEGER, budget_episode_cents INTEGER
);

CREATE TABLE IF NOT EXISTS bible_version (
  series_id TEXT REFERENCES series(id), version INTEGER,
  status TEXT, created_from TEXT, change_summary TEXT,
  approved_by TEXT, approved_at TEXT, snapshot TEXT,
  PRIMARY KEY (series_id, version)
);

CREATE TABLE IF NOT EXISTS style_guide (
  series_id TEXT REFERENCES series(id), bible_version INTEGER,
  data TEXT, PRIMARY KEY (series_id, bible_version)
);

CREATE TABLE IF NOT EXISTS character (
  id TEXT PRIMARY KEY, series_id TEXT REFERENCES series(id), key TEXT,
  name TEXT, aliases TEXT, being TEXT, role TEXT,
  age_statement TEXT, age_source TEXT, protected INTEGER NOT NULL,
  profile TEXT, personality TEXT, speech_style TEXT, relationships TEXT,
  locked INTEGER DEFAULT 0, voice_id TEXT,
  UNIQUE (series_id, key)
);

CREATE TABLE IF NOT EXISTS character_look (
  id TEXT PRIMARY KEY, character_id TEXT REFERENCES character(id), key TEXT,
  kind TEXT, derived_from_look_id TEXT, description TEXT, wardrobe TEXT,
  status TEXT, first_episode INTEGER, last_episode INTEGER,
  UNIQUE (character_id, key)
);

CREATE TABLE IF NOT EXISTS reference_image (
  id TEXT PRIMARY KEY, subject_type TEXT, subject_id TEXT,
  asset_id TEXT REFERENCES asset(id), angle TEXT,
  provider_handle TEXT, approved INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS voice (
  id TEXT PRIMARY KEY, series_id TEXT, character_id TEXT,
  provider TEXT, provider_voice_id TEXT, origin TEXT,
  consent_record_asset_id TEXT, language TEXT, settings TEXT,
  delivery_notes TEXT, pronunciations TEXT, locked INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS location (
  id TEXT PRIMARY KEY, series_id TEXT, key TEXT, name TEXT,
  description TEXT, period TEXT, fixed_features TEXT,
  UNIQUE (series_id, key)
);

CREATE TABLE IF NOT EXISTS location_view (
  id TEXT PRIMARY KEY, location_id TEXT REFERENCES location(id), key TEXT,
  hour TEXT, light TEXT, asset_id TEXT, provider_handle TEXT, approved INTEGER
);

CREATE TABLE IF NOT EXISTS prop (
  id TEXT PRIMARY KEY, series_id TEXT, key TEXT, name TEXT,
  description TEXT, owner_character_id TEXT, asset_id TEXT, provider_handle TEXT,
  UNIQUE (series_id, key)
);

CREATE TABLE IF NOT EXISTS continuity_fact (
  id TEXT PRIMARY KEY, series_id TEXT,
  subject_type TEXT, subject_key TEXT, kind TEXT,
  statement TEXT NOT NULL, data TEXT,
  permanence TEXT, valid_from TEXT, valid_to TEXT, story_time TEXT,
  source TEXT, confidence TEXT, supersedes_id TEXT
);

CREATE TABLE IF NOT EXISTS episode (
  id TEXT PRIMARY KEY, series_id TEXT, number INTEGER, title TEXT,
  title_en TEXT, status TEXT, approved_version INTEGER, target_seconds INTEGER,
  UNIQUE (series_id, number)
);

CREATE TABLE IF NOT EXISTS episode_summary (
  episode_id TEXT PRIMARY KEY REFERENCES episode(id),
  summary TEXT, end_states TEXT, cliffhanger TEXT, key_frames TEXT
);

CREATE TABLE IF NOT EXISTS provider_job (
  id TEXT PRIMARY KEY, provider TEXT, model TEXT, operation TEXT,
  idempotency_key TEXT UNIQUE NOT NULL, request TEXT, status TEXT,
  provider_ref TEXT, submitted_at TEXT, finished_at TEXT,
  error_code TEXT, error_message TEXT, refunded INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cost_entry (
  id TEXT PRIMARY KEY, provider_job_id TEXT, llm_call_id TEXT,
  series_id TEXT, episode_number INTEGER, unit_key TEXT,
  category TEXT, reason TEXT,
  estimated_cents REAL, actual_cents REAL, verified INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS budget (
  scope TEXT PRIMARY KEY,         -- 'poc', 'series:<id>', 'episode:<id>'
  cap_cents INTEGER NOT NULL,
  reserved_cents REAL DEFAULT 0,
  spent_cents REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS llm_call (
  id TEXT PRIMARY KEY, role TEXT, model TEXT, prompt_version TEXT,
  input_tokens INTEGER, output_tokens INTEGER,
  cache_read_tokens INTEGER, cache_write_tokens INTEGER,
  cents REAL, created_at TEXT
);

CREATE TABLE IF NOT EXISTS qc_finding (
  id TEXT PRIMARY KEY, scope TEXT, target TEXT, check_key TEXT,
  severity TEXT, t_start REAL, t_end REAL, evidence TEXT,
  diagnosis TEXT, suggested_action TEXT, status TEXT, created_at TEXT
);

CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, kind TEXT, data TEXT
);
