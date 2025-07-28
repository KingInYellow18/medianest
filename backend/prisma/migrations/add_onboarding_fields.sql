-- Add onboarding fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_skipped BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step VARCHAR(255),
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;