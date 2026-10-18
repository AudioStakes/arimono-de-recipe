CREATE TABLE IF NOT EXISTS ai_usage_buckets (
  bucket TEXT PRIMARY KEY,
  used INTEGER NOT NULL CHECK (used >= 0),
  max_units INTEGER NOT NULL CHECK (max_units > 0),
  expires_at INTEGER NOT NULL,
  CONSTRAINT ai_usage_within_limit CHECK (used <= max_units)
);

CREATE INDEX IF NOT EXISTS ai_usage_expiry ON ai_usage_buckets(expires_at);
