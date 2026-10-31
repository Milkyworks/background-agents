-- Projects: a named group of sessions with standing instructions and a default
-- session target (phase 1 of the projects model).
--
-- Projects are workspace resources like sessions: every member with session
-- read access can see them. sessions.project_id is FK-less, matching
-- sessions.environment_id, so archiving or deleting a project never rewrites
-- session history. Additive only, so a pre-0080 worker keeps running during
-- the migrations-before-worker window.

CREATE TABLE projects (
  id                  TEXT PRIMARY KEY,            -- proj_<id>
  name                TEXT NOT NULL,
  instructions        TEXT NOT NULL DEFAULT '',
  default_target_json TEXT,                        -- {"environmentId"} | {"repositories":[...]} | NULL
  default_model       TEXT,
  created_by          TEXT NOT NULL,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL,
  archived_at         INTEGER
);

CREATE INDEX idx_projects_active_updated ON projects (updated_at DESC) WHERE archived_at IS NULL;

ALTER TABLE sessions ADD COLUMN project_id TEXT;

CREATE INDEX idx_sessions_project_updated
  ON sessions (project_id, updated_at DESC)
  WHERE project_id IS NOT NULL;
