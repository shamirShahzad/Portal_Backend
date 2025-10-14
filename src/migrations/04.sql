-- Add manager approval fields to applications table
ALTER TABLE applications 
ADD COLUMN manager_approval BOOLEAN DEFAULT NULL,
ADD COLUMN manager_notes TEXT DEFAULT NULL;