-- Add unique constraint to prevent duplicate applications
-- This ensures data integrity at the database level
ALTER TABLE applications 
ADD CONSTRAINT unique_applicant_course 
UNIQUE (applicant_id, course_id);