-- Additional database indexes for enhanced export filtering performance
-- Run this migration to optimize query performance with comprehensive filters

-- Applications table indexes for export filtering
CREATE INDEX IF NOT EXISTS idx_applications_status_priority ON applications (status, priority);
CREATE INDEX IF NOT EXISTS idx_applications_submitted_at ON applications (submitted_at);
CREATE INDEX IF NOT EXISTS idx_applications_reviewed_at ON applications (reviewed_at);
CREATE INDEX IF NOT EXISTS idx_applications_updated_at ON applications (updated_at);
CREATE INDEX IF NOT EXISTS idx_applications_reviewed_by ON applications (reviewed_by);

-- User profiles indexes for employee filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_department ON user_profiles (department);
CREATE INDEX IF NOT EXISTS idx_user_profiles_sub_organization ON user_profiles (sub_organization);
CREATE INDEX IF NOT EXISTS idx_user_profiles_job_title ON user_profiles (job_title);
CREATE INDEX IF NOT EXISTS idx_user_profiles_experience_years ON user_profiles (experience_years);
CREATE INDEX IF NOT EXISTS idx_user_profiles_manager_name ON user_profiles (manager_name);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_department ON user_profiles (role, department);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created_at ON user_profiles (created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated_at ON user_profiles (updated_at);

-- Courses table indexes for course filtering
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses (category);
CREATE INDEX IF NOT EXISTS idx_courses_level ON courses (level);
CREATE INDEX IF NOT EXISTS idx_courses_format ON courses (format);
CREATE INDEX IF NOT EXISTS idx_courses_price ON courses (price);
CREATE INDEX IF NOT EXISTS idx_courses_is_active ON courses (is_active);
CREATE INDEX IF NOT EXISTS idx_courses_category_level ON courses (category, level);
CREATE INDEX IF NOT EXISTS idx_courses_price_active ON courses (price, is_active);
CREATE INDEX IF NOT EXISTS idx_courses_updated_at ON courses (updated_at);

-- Users table indexes for date filtering
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_users_updated_at ON users (updated_at);

-- Text search indexes using GIN for full-text search capabilities
-- Note: These require PostgreSQL extensions and may need to be created separately

-- For applications text search
CREATE INDEX IF NOT EXISTS idx_applications_text_search ON applications 
USING gin(to_tsvector('english', COALESCE(notes, '')));

-- For courses text search  
CREATE INDEX IF NOT EXISTS idx_courses_text_search ON courses 
USING gin(
  to_tsvector('english', 
    COALESCE(title, '') || ' ' || 
    COALESCE(subtitle, '') || ' ' || 
    COALESCE(category, '') || ' ' || 
    COALESCE(description, '')
  )
);

-- For user profiles text search
CREATE INDEX IF NOT EXISTS idx_user_profiles_text_search ON user_profiles 
USING gin(
  to_tsvector('english', 
    COALESCE(full_name, '') || ' ' || 
    COALESCE(employee_id, '') || ' ' || 
    COALESCE(department, '') || ' ' || 
    COALESCE(sub_organization, '') || ' ' || 
    COALESCE(job_title, '') || ' ' || 
    COALESCE(manager_name, '')
  )
);

-- Composite indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_applications_status_dept_date ON applications (status, created_at)
  WHERE status IN ('submitted', 'under_review', 'approved', 'rejected');

CREATE INDEX IF NOT EXISTS idx_courses_active_category_price ON courses (is_active, category, price)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_profiles_role_dept_exp ON user_profiles (role, department, experience_years)
  WHERE role != 'super_admin';

-- Partial indexes for commonly filtered data
CREATE INDEX IF NOT EXISTS idx_applications_active_status ON applications (created_at)
  WHERE status IN ('submitted', 'under_review', 'approved');

CREATE INDEX IF NOT EXISTS idx_courses_active_only ON courses (created_at, category, level)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_profiles_active_employees ON user_profiles (created_at, department)
  WHERE role IN ('admin', 'applicant');

-- Export jobs table indexes for better export management
CREATE INDEX IF NOT EXISTS idx_export_jobs_user_status ON export_jobs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_status ON export_jobs (created_at, status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires_at ON export_jobs (expires_at);

-- Comments for index usage
COMMENT ON INDEX idx_applications_status_priority IS 'Optimizes filtering by status and priority combinations';
COMMENT ON INDEX idx_user_profiles_role_department IS 'Optimizes employee filtering by role and department';
COMMENT ON INDEX idx_courses_category_level IS 'Optimizes course filtering by category and level';
COMMENT ON INDEX idx_applications_text_search IS 'Enables fast full-text search across application notes';
COMMENT ON INDEX idx_courses_text_search IS 'Enables fast full-text search across course content';
COMMENT ON INDEX idx_user_profiles_text_search IS 'Enables fast full-text search across user profile data';