-- Plan / Build execution mode. Orthogonal to the harness axis: the harness
-- selects which agent runs a session, the mode selects how much it may
-- change the repo. 'build' is what every existing row ran with.
ALTER TABLE sessions ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'build'
  CHECK (execution_mode IN ('build', 'plan'));
ALTER TABLE automations ADD COLUMN execution_mode TEXT NOT NULL DEFAULT 'build'
  CHECK (execution_mode IN ('build', 'plan'));
