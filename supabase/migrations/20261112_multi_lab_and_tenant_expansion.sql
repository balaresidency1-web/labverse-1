-- ==============================================================================
-- LABVERSE INCREMENTAL MIGRATION: MULTI-LAB & MULTI-COLLEGE TENANT EXPANSION
-- (PostgreSQL 14+ / Supabase Production Schema)
-- Preserves all existing tables and data structures without dropping tables.
-- ==============================================================================

-- 1. Extend institutions with multi-college SaaS metadata & status
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS institution_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(100),
  ADD COLUMN IF NOT EXISTS country VARCHAR(100),
  ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admin_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admin_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS admin_designation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- Sync institution_code with code if null
UPDATE institutions SET institution_code = code WHERE institution_code IS NULL;

-- 2. Extend profiles with account lifecycle status and invitation audit
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'invited')),
  ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;

-- 3. Extend labs with creator tracking
ALTER TABLE labs
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Ensure practical_subjects and inventory_items have lab_id (already set in base, safe if exists)
ALTER TABLE practical_subjects
  ADD COLUMN IF NOT EXISTS lab_id UUID REFERENCES labs(id) ON DELETE SET NULL;

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS lab_id UUID REFERENCES labs(id) ON DELETE SET NULL;

-- 4. Create profile_lab_assignments (Controls individual laboratory workstation access)
CREATE TABLE IF NOT EXISTS profile_lab_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES labs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, lab_id)
);

-- Index for high performance laboratory access checks
CREATE INDEX IF NOT EXISTS idx_profile_lab_assignments_user 
  ON profile_lab_assignments(profile_id, lab_id);
CREATE INDEX IF NOT EXISTS idx_profile_lab_assignments_inst 
  ON profile_lab_assignments(institution_id);

-- 5. Enable RLS on profile_lab_assignments
ALTER TABLE profile_lab_assignments ENABLE ROW LEVEL SECURITY;

-- Helper to check if a user is assigned to a lab or has institution-wide privileges
CREATE OR REPLACE FUNCTION has_lab_access(p_lab_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND (
      p.role = 'super_admin' OR
      (p.role = 'college_admin' AND EXISTS (SELECT 1 FROM labs l WHERE l.id = p_lab_id AND l.institution_id = p.institution_id)) OR
      EXISTS (
        SELECT 1 FROM profile_lab_assignments pla 
        WHERE pla.profile_id = auth.uid() AND pla.lab_id = p_lab_id
      )
    )
  );
$$;

-- RLS Policies for profile_lab_assignments
CREATE POLICY "Profile Lab Assignments Super Admin Manage" ON profile_lab_assignments
  FOR ALL USING (is_super_admin());

CREATE POLICY "Profile Lab Assignments College Admin Manage" ON profile_lab_assignments
  FOR ALL USING (
    institution_id = get_auth_institution_id() AND is_college_admin(institution_id)
  );

CREATE POLICY "Profile Lab Assignments Self Read" ON profile_lab_assignments
  FOR SELECT USING (
    profile_id = auth.uid() OR
    institution_id = get_auth_institution_id()
  );

-- 6. Helper: Secure College Registration and Admin Invitation Procedure
CREATE OR REPLACE FUNCTION register_new_college(
  p_name VARCHAR(255),
  p_code VARCHAR(50),
  p_domain VARCHAR(255),
  p_email VARCHAR(255),
  p_address TEXT,
  p_city VARCHAR(100),
  p_state VARCHAR(100),
  p_country VARCHAR(100),
  p_contact_person VARCHAR(255),
  p_admin_name VARCHAR(255),
  p_admin_email VARCHAR(255),
  p_admin_designation VARCHAR(100)
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inst_id UUID;
  v_default_dept_id UUID;
  v_default_lab_id UUID;
  v_invite_token VARCHAR(255);
BEGIN
  -- Security check: Only Super Admin can register colleges
  IF NOT is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Super Admin privilege required');
  END IF;

  -- Check duplicate code
  IF EXISTS (SELECT 1 FROM institutions WHERE LOWER(code) = LOWER(p_code) OR LOWER(institution_code) = LOWER(p_code)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Institution code already registered');
  END IF;

  -- Insert institution
  INSERT INTO institutions (
    name, code, institution_code, domain, contact_email,
    address, city, state, country, contact_person,
    admin_name, admin_email, admin_designation, active, status
  ) VALUES (
    p_name, UPPER(p_code), UPPER(p_code), p_domain, p_email,
    p_address, p_city, p_state, p_country, p_contact_person,
    p_admin_name, p_admin_email, p_admin_designation, true, 'active'
  ) RETURNING id INTO v_inst_id;

  -- Create initial Department (e.g. Science & Engineering)
  INSERT INTO departments (
    institution_id, code, name, head_faculty_name, description
  ) VALUES (
    v_inst_id, 'ENG-SCI', 'Engineering & Applied Sciences', p_admin_name, 'Foundational department for engineering physics and chemistry'
  ) RETURNING id INTO v_default_dept_id;

  -- Create initial Laboratory (Physical Science Lab)
  INSERT INTO labs (
    institution_id, department_id, lab_code, name, description,
    building, room_number, location, capacity, status, display_order
  ) VALUES (
    v_inst_id, v_default_dept_id, 'PSL-01', 'Physical Science Lab',
    'Applied physics and engineering measurement laboratory',
    'Main Academic Block', 'Lab 201', 'Floor 2, South Wing', 40, 'active', 1
  ) RETURNING id INTO v_default_lab_id;

  -- Generate secure invitation token
  v_invite_token := md5(random()::text || clock_timestamp()::text);

  RETURN jsonb_build_object(
    'success', true,
    'institution_id', v_inst_id,
    'default_dept_id', v_default_dept_id,
    'default_lab_id', v_default_lab_id,
    'invitation_token', v_invite_token
  );
END;
$$;
