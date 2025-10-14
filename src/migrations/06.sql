-- Update unique constraint to allow reapplication for rejected/cancelled applications
-- Drop the old constraint that prevents all duplicates
ALTER TABLE applications
DROP CONSTRAINT IF EXISTS unique_applicant_course;

-- Add a partial unique constraint that only applies to non-rejected and non-cancelled applications
-- This allows users to reapply only if their previous application was rejected or cancelled
CREATE UNIQUE INDEX unique_applicant_course_active ON applications (applicant_id, course_id)
WHERE
    status NOT IN('rejected', 'cancelled');