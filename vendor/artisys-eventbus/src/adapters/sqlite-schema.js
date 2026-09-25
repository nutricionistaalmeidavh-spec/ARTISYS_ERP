'use strict';
const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS domain_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  mutation_id TEXT,
  source TEXT NOT NULL,
  actor_json TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  dispatched_at TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_domain_events_pending ON domain_events(dispatched_at, occurred_at, event_id);
CREATE TABLE IF NOT EXISTS domain_event_effects (
  event_id TEXT NOT NULL,
  effect_key TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  PRIMARY KEY (event_id, effect_key)
);
`;
module.exports={SQLITE_SCHEMA};
