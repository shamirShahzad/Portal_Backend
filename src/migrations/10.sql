-- Migration 10: Add is_tamkeen_support column to courses table
-- Date: 2025-10-15
-- Description: Add boolean column to track if a course has Tamkeen support

ALTER TABLE courses 
ADD COLUMN is_tamkeen_support BOOLEAN NOT NULL DEFAULT false;

-- Add index for better query performance on this column
CREATE INDEX IF NOT EXISTS idx_courses_is_tamkeen_support ON courses (is_tamkeen_support);

-- Update existing courses to have default value (optional - adjust as needed)
-- UPDATE courses SET is_tamkeen_support = false WHERE is_tamkeen_support IS NULL;