-- Error logging table for tracking application errors
CREATE TABLE IF NOT EXISTS error_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Error classification
  error_type TEXT NOT NULL,           -- e.g., 'card_create', 'ogp_fetch', 'auth_failure'
  error_message TEXT,
  error_stack TEXT,
  
  -- Context
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  url TEXT,
  
  -- Metadata (JSONB for flexible structure)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Indexing for queries
  CONSTRAINT error_type_not_empty CHECK (error_type != '')
);

-- Index for common queries
CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_user_id ON error_logs(user_id) WHERE user_id IS NOT NULL;

-- RLS policies (authenticated users can insert their own errors)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own error logs"
  ON error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Service role can read all (for dashboards)
CREATE POLICY "Service role can read all error logs"
  ON error_logs
  FOR SELECT
  TO service_role
  USING (true);

COMMENT ON TABLE error_logs IS 'Application error tracking for observability and debugging';
COMMENT ON COLUMN error_logs.error_type IS 'Error category: card_create, ogp_fetch, auth_failure, etc.';
COMMENT ON COLUMN error_logs.metadata IS 'Flexible JSON field for error-specific context (card_id, url, http_status, etc.)';
