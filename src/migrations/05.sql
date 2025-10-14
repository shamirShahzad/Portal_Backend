-- Create manager approval tokens table for secure approval links
CREATE TABLE IF NOT EXISTS manager_approval_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  manager_email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  is_valid BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_manager_tokens_token ON manager_approval_tokens(token);
CREATE INDEX IF NOT EXISTS idx_manager_tokens_application_id ON manager_approval_tokens(application_id);
CREATE INDEX IF NOT EXISTS idx_manager_tokens_expires_at ON manager_approval_tokens(expires_at);

-- Add manager_reviewed_at field to applications table
ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS manager_reviewed_at TIMESTAMPTZ NULL;