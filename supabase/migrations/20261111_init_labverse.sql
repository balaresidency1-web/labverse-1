-- ==============================================================================
-- LABVERSE POSTGRESQL PRODUCTION SCHEMA & ROW LEVEL SECURITY (RLS)
-- Multi-Tenant Laboratory SaaS Architecture (PostgreSQL 14+)
-- ==============================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Institutions (Multi-College Tenants)
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) UNIQUE NOT NULL,
  domain VARCHAR(255) NOT NULL,
  address TEXT,
  logo_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Profiles (Auth Integration linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  role VARCHAR(30) NOT NULL CHECK (role IN ('super_admin', 'college_admin', 'faculty', 'lab_assistant', 'student')),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url TEXT,
  identifier VARCHAR(100) NOT NULL, -- Roll Number or Employee ID
  department_id UUID,
  semester INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Academic Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  head_faculty_name VARCHAR(255),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, code)
);

-- 5. Academic Terms / Semesters
CREATE TABLE IF NOT EXISTS academic_terms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, code)
);

-- 5b. Laboratories (Multi-Laboratory Selection & Management)
CREATE TABLE IF NOT EXISTS labs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  lab_code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  building VARCHAR(100),
  room_number VARCHAR(50),
  location VARCHAR(255),
  capacity INT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  display_order INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, lab_code)
);

-- 6. Practical Subjects / Laboratory Courses
CREATE TABLE IF NOT EXISTS practical_subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  lab_id UUID REFERENCES labs(id) ON DELETE SET NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  term_id UUID NOT NULL REFERENCES academic_terms(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  credits INT DEFAULT 2,
  semester INT NOT NULL,
  faculty_id UUID REFERENCES profiles(id),
  lab_assistant_id UUID REFERENCES profiles(id),
  location VARCHAR(255),
  schedule_info VARCHAR(255),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, code)
);

-- 7. Subject Syllabuses (Curriculum Units)
CREATE TABLE IF NOT EXISTS subject_syllabuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID NOT NULL REFERENCES practical_subjects(id) ON DELETE CASCADE,
  unit_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  learning_outcomes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Experiments Catalog
CREATE TABLE IF NOT EXISTS experiments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES practical_subjects(id) ON DELETE CASCADE,
  exp_number INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  aim TEXT NOT NULL,
  theory TEXT NOT NULL,
  learning_objectives JSONB DEFAULT '[]'::jsonb,
  components_required JSONB DEFAULT '[]'::jsonb,
  equipment_required JSONB DEFAULT '[]'::jsonb,
  diagram_url TEXT,
  procedure JSONB DEFAULT '[]'::jsonb,
  observation_headers JSONB DEFAULT '[]'::jsonb,
  sample_observations JSONB DEFAULT '[]'::jsonb,
  expected_result TEXT,
  precautions JSONB DEFAULT '[]'::jsonb,
  manual_content TEXT,
  manual_doc_name VARCHAR(255),
  manual_pdf_url TEXT,
  manual_pdf_name VARCHAR(255),
  youtube_url TEXT,
  youtube_video_id VARCHAR(50),
  bench_twin_url TEXT,
  bench_twin_mode VARCHAR(20) DEFAULT 'embedded' CHECK (bench_twin_mode IN ('embedded', 'external')),
  simulator_type VARCHAR(50) DEFAULT 'custom',
  is_published BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(subject_id, exp_number)
);

-- 9. Practical Manual Documents & Uploaded PDFs (Storage Mapping)
CREATE TABLE IF NOT EXISTS lab_manual_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES practical_subjects(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('syllabus', 'experiment_manual', 'safety_guideline')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  is_published BOOLEAN DEFAULT TRUE,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Student Experiment Progress
CREATE TABLE IF NOT EXISTS experiment_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status VARCHAR(30) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'self_confirmed', 'faculty_verified')),
  manual_viewed BOOLEAN DEFAULT FALSE,
  manual_viewed_at TIMESTAMPTZ,
  youtube_opened BOOLEAN DEFAULT FALSE,
  youtube_opened_at TIMESTAMPTZ,
  youtube_confirmed BOOLEAN DEFAULT FALSE,
  youtube_confirmed_at TIMESTAMPTZ,
  bench_twin_launched BOOLEAN DEFAULT FALSE,
  bench_twin_launched_at TIMESTAMPTZ,
  bench_twin_confirmed BOOLEAN DEFAULT FALSE,
  bench_twin_confirmed_at TIMESTAMPTZ,
  self_confirmed_at TIMESTAMPTZ,
  student_notes TEXT,
  observation_data JSONB DEFAULT '[]'::jsonb,
  faculty_verified BOOLEAN DEFAULT FALSE,
  faculty_verified_at TIMESTAMPTZ,
  faculty_verifier_id UUID REFERENCES profiles(id),
  faculty_grade VARCHAR(20),
  faculty_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(experiment_id, student_id)
);

-- 11. Progress Event Audit Log
CREATE TABLE IF NOT EXISTS progress_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  progress_id UUID NOT NULL REFERENCES experiment_progress(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (
    event_type IN ('manual_viewed', 'youtube_opened', 'youtube_confirmed', 'bench_twin_launched', 'bench_twin_confirmed', 'self_submitted', 'faculty_verified')
  ),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata TEXT
);

-- 12. Laboratory Inventory Registry
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  lab_id UUID REFERENCES labs(id) ON DELETE SET NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  item_code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('electronic', 'glassware', 'instrument', 'chemical', 'mechanical', 'hardware')),
  location VARCHAR(255),
  quantity_available INT NOT NULL CHECK (quantity_available >= 0), -- Non-negative constraint!
  quantity_total INT NOT NULL CHECK (quantity_total >= 0),
  unit VARCHAR(50) NOT NULL,
  min_safety_threshold INT NOT NULL DEFAULT 5,
  last_inspected DATE DEFAULT CURRENT_DATE,
  UNIQUE(institution_id, item_code)
);

-- 13. Inventory Checkouts and Returns (Transactions)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('issue', 'return', 'damage_writeoff', 'restock')),
  quantity INT NOT NULL CHECK (quantity > 0),
  student_roll_number VARCHAR(100),
  student_name VARCHAR(255),
  experiment_title VARCHAR(255),
  handled_by UUID REFERENCES profiles(id),
  remarks TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Real-Time System Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  recipient_role VARCHAR(30) DEFAULT 'all',
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'alert')),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Audit Trails
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(30) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(100),
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- SECURE HELPER FUNCTIONS FOR ROW LEVEL SECURITY (Prevents Recursion)
-- ==============================================================================

-- Fetch auth user's institutional tenant without triggering recursive RLS
CREATE OR REPLACE FUNCTION get_auth_institution_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT institution_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Fetch auth user's system role without triggering recursive RLS
CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS VARCHAR LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Super admin check
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- College admin check for specific institution
CREATE OR REPLACE FUNCTION is_college_admin(p_inst_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND (role = 'super_admin' OR (institution_id = p_inst_id AND role = 'college_admin'))
  );
$$;

-- Staff check (faculty, lab assistant, or admin)
CREATE OR REPLACE FUNCTION is_institution_staff(p_inst_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND (role = 'super_admin' OR (institution_id = p_inst_id AND role IN ('college_admin', 'faculty', 'lab_assistant')))
  );
$$;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — MULTI-TENANT ISOLATION
-- ==============================================================================

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE practical_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_syllabuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_manual_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. Institutions: Super admin can manage all; others can only view their own
CREATE POLICY "Institutions Super Admin Manage" ON institutions
  FOR ALL USING (is_super_admin());

CREATE POLICY "Institutions Member Read" ON institutions
  FOR SELECT USING (id = get_auth_institution_id());

-- 2. Profiles: Non-recursive profile policies
CREATE POLICY "Profiles Super Admin Manage" ON profiles
  FOR ALL USING (is_super_admin());

CREATE POLICY "Profiles Same Institution Read" ON profiles
  FOR SELECT USING (institution_id = get_auth_institution_id());

CREATE POLICY "Profiles Self Update" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Profiles College Admin Manage" ON profiles
  FOR INSERT WITH CHECK (is_college_admin(institution_id));

-- 3. Departments: Isolated by institution
CREATE POLICY "Departments Isolation" ON departments
  FOR ALL USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND is_college_admin(institution_id))
  );

CREATE POLICY "Departments Read" ON departments
  FOR SELECT USING (
    is_super_admin() OR institution_id = get_auth_institution_id()
  );

-- 4. Academic Terms:
CREATE POLICY "Academic Terms Manage" ON academic_terms
  FOR ALL USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND is_college_admin(institution_id))
  );

CREATE POLICY "Academic Terms Read" ON academic_terms
  FOR SELECT USING (
    is_super_admin() OR institution_id = get_auth_institution_id()
  );

-- 4b. Laboratories: Super Admin manage all, College Admin manage theirs, Members view active
CREATE POLICY "Labs Super Admin Manage" ON labs
  FOR ALL USING (is_super_admin());

CREATE POLICY "Labs College Admin Manage" ON labs
  FOR ALL USING (
    institution_id = get_auth_institution_id() AND is_college_admin(institution_id)
  );

CREATE POLICY "Labs Member Read Active" ON labs
  FOR SELECT USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND (status = 'active' OR is_college_admin(institution_id)))
  );

-- 5. Practical Subjects:
CREATE POLICY "Subjects Staff Manage" ON practical_subjects
  FOR ALL USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND get_auth_role() IN ('college_admin', 'faculty'))
  );

CREATE POLICY "Subjects Student Read" ON practical_subjects
  FOR SELECT USING (
    is_super_admin() OR institution_id = get_auth_institution_id()
  );

-- 6. Subject Syllabuses:
CREATE POLICY "Syllabus Staff Manage" ON subject_syllabuses
  FOR ALL USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM practical_subjects s
      WHERE s.id = subject_syllabuses.subject_id
        AND s.institution_id = get_auth_institution_id()
        AND get_auth_role() IN ('college_admin', 'faculty')
    )
  );

CREATE POLICY "Syllabus Member Read" ON subject_syllabuses
  FOR SELECT USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM practical_subjects s
      WHERE s.id = subject_syllabuses.subject_id
        AND s.institution_id = get_auth_institution_id()
    )
  );

-- 7. Experiments:
CREATE POLICY "Experiments Faculty Manage" ON experiments
  FOR ALL USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND get_auth_role() IN ('faculty', 'college_admin'))
  );

CREATE POLICY "Experiments Student Read" ON experiments
  FOR SELECT USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND (is_published = TRUE OR get_auth_role() IN ('faculty', 'college_admin', 'lab_assistant')))
  );

-- 8. Practical Manual Documents:
CREATE POLICY "Documents Faculty Manage" ON lab_manual_documents
  FOR ALL USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND get_auth_role() IN ('faculty', 'college_admin'))
  );

CREATE POLICY "Documents Student Read" ON lab_manual_documents
  FOR SELECT USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND is_published = TRUE)
  );

-- 9. Student Progress:
CREATE POLICY "Student Own Progress Access" ON experiment_progress
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Faculty Evaluate Progress" ON experiment_progress
  FOR ALL USING (
    is_super_admin() OR
    (
      get_auth_role() IN ('faculty', 'college_admin') AND
      EXISTS (
        SELECT 1 FROM experiments e
        WHERE e.id = experiment_progress.experiment_id
          AND e.institution_id = get_auth_institution_id()
      )
    )
  );

-- 10. Progress Events:
CREATE POLICY "Progress Events Access" ON progress_events
  FOR ALL USING (
    is_super_admin() OR
    student_id = auth.uid() OR
    get_auth_role() IN ('faculty', 'college_admin')
  );

-- 11. Inventory:
CREATE POLICY "Inventory Staff Manage" ON inventory_items
  FOR ALL USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND get_auth_role() IN ('lab_assistant', 'college_admin'))
  );

CREATE POLICY "Inventory View All Roles" ON inventory_items
  FOR SELECT USING (
    is_super_admin() OR institution_id = get_auth_institution_id()
  );

-- 12. Inventory Transactions:
CREATE POLICY "Inventory Transactions Insert" ON inventory_transactions
  FOR INSERT WITH CHECK (
    is_super_admin() OR get_auth_role() IN ('lab_assistant', 'college_admin')
  );

CREATE POLICY "Inventory Transactions Read" ON inventory_transactions
  FOR SELECT USING (
    is_super_admin() OR
    EXISTS (
      SELECT 1 FROM inventory_items i
      WHERE i.id = inventory_transactions.item_id
        AND i.institution_id = get_auth_institution_id()
    )
  );

-- 13. Notifications:
CREATE POLICY "Notifications Recipient Access" ON notifications
  FOR ALL USING (
    is_super_admin() OR
    recipient_id = auth.uid() OR
    (institution_id = get_auth_institution_id() AND (recipient_role = 'all' OR recipient_role = get_auth_role()))
  );

-- 14. Audit Logs:
CREATE POLICY "Audit Logs Admin Access" ON audit_logs
  FOR ALL USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND get_auth_role() IN ('college_admin', 'super_admin'))
  );

-- ==============================================================================
-- ATOMIC INVENTORY TRANSACTION FUNCTION (Prevents Negative Stock)
-- ==============================================================================

CREATE OR REPLACE FUNCTION process_inventory_transaction(
  p_item_id UUID,
  p_type VARCHAR(30),
  p_quantity INT,
  p_student_roll VARCHAR(100),
  p_student_name VARCHAR(255),
  p_experiment_title VARCHAR(255),
  p_remarks TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current_available INT;
  v_current_total INT;
  v_item_code VARCHAR(100);
  v_item_name VARCHAR(255);
  v_min_threshold INT;
  v_new_available INT;
  v_new_total INT;
  v_tx_id UUID;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than zero');
  END IF;

  -- Lock row FOR UPDATE to prevent race conditions
  SELECT quantity_available, quantity_total, item_code, name, min_safety_threshold
  INTO v_current_available, v_current_total, v_item_code, v_item_name, v_min_threshold
  FROM inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory item not found');
  END IF;

  IF p_type = 'issue' THEN
    IF v_current_available < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient inventory available. Requested ' || p_quantity || ', available: ' || v_current_available);
    END IF;
    v_new_available := v_current_available - p_quantity;
    v_new_total := v_current_total;

  ELSIF p_type = 'return' THEN
    v_new_available := v_current_available + p_quantity;
    v_new_total := v_current_total;

  ELSIF p_type = 'damage_writeoff' THEN
    IF v_current_available < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot write off more than available in stock');
    END IF;
    v_new_available := v_current_available - p_quantity;
    v_new_total := GREATEST(0, v_current_total - p_quantity);

  ELSIF p_type = 'restock' THEN
    v_new_available := v_current_available + p_quantity;
    v_new_total := v_current_total + p_quantity;

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unrecognized transaction type: ' || p_type);
  END IF;

  -- Update stock
  UPDATE inventory_items
  SET quantity_available = v_new_available,
      quantity_total = v_new_total
  WHERE id = p_item_id;

  -- Record transaction
  INSERT INTO inventory_transactions (
    item_id, transaction_type, quantity,
    student_roll_number, student_name, experiment_title,
    handled_by, remarks
  ) VALUES (
    p_item_id, p_type, p_quantity,
    p_student_roll, p_student_name, p_experiment_title,
    auth.uid(), p_remarks
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_available', v_new_available,
    'new_total', v_new_total
  );
END;
$$;

-- ==============================================================================
-- STORAGE BUCKETS AND STORAGE RLS (Run in Supabase Storage SQL Editor)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('manuals', 'manuals', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('diagrams', 'diagrams', true) 
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Bucket Policies
CREATE POLICY "Public Read Manuals" ON storage.objects
  FOR SELECT USING (bucket_id = 'manuals');

CREATE POLICY "Staff Upload Manuals" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'manuals' AND
    (is_super_admin() OR get_auth_role() IN ('faculty', 'college_admin'))
  );

CREATE POLICY "Staff Delete Manuals" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'manuals' AND
    (is_super_admin() OR get_auth_role() IN ('faculty', 'college_admin'))
  );

CREATE POLICY "Public Read Diagrams" ON storage.objects
  FOR SELECT USING (bucket_id = 'diagrams');

CREATE POLICY "Staff Upload Diagrams" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'diagrams' AND
    (is_super_admin() OR get_auth_role() IN ('faculty', 'college_admin', 'lab_assistant'))
  );
