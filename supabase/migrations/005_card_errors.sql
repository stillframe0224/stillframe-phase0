-- Card creation error tracking for observability
CREATE TABLE IF NOT EXISTS card_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  url TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT,
  status_code INTEGER,
  user_agent TEXT,
  ip_address TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  request_id TEXT,
  stack_trace TEXT
);

CREATE INDEX idx_card_errors_created_at ON card_errors(created_at DESC);
CREATE INDEX idx_card_errors_type ON card_errors(error_type);
CREATE INDEX idx_card_errors_url_hash ON card_errors(md5(url));

ALTER TABLE card_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read card_errors" ON card_errors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert card_errors" ON card_errors
  FOR INSERT
  TO service_role
  WITH CHECK (true);
