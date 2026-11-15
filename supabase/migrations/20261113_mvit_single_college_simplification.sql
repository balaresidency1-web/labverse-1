-- ==============================================================================
-- LABVERSE – MVIT SINGLE-COLLEGE DIGITAL LABORATORY LEARNING PLATFORM
-- Safe, Incremental Database Migration
-- Preserves existing tables & MVIT records, adds primary assistant assignment,
-- enables public read-only learning portal RLS, and enforces 2-role staff RBAC
-- (college_admin & lab_assistant only).
-- ==============================================================================

-- 1. Safe Schema Additions (Preserve all existing tables and data)
ALTER TABLE labs
  ADD COLUMN IF NOT EXISTS primary_assistant_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE practical_subjects
  ADD COLUMN IF NOT EXISTS syllabus_pdf_id UUID,
  ADD COLUMN IF NOT EXISTS syllabus_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS syllabus_pdf_name TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Role Helper Functions (Single Institution MVIT, 2 Staff Roles Only)
CREATE OR REPLACE FUNCTION is_college_admin(p_inst_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND institution_id = p_inst_id
      AND role = 'college_admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_institution_staff(p_inst_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND institution_id = p_inst_id
      AND role IN ('college_admin', 'lab_assistant')
  );
$$;

CREATE OR REPLACE FUNCTION has_lab_access(p_lab_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND (
        (p.role = 'college_admin' AND EXISTS (
          SELECT 1 FROM labs l WHERE l.id = p_lab_id AND l.institution_id = p.institution_id
        ))
        OR (
          p.role = 'lab_assistant'
          AND (
            EXISTS (
              SELECT 1 FROM profile_lab_assignments pla
              WHERE pla.profile_id = auth.uid() AND pla.lab_id = p_lab_id
            )
            OR EXISTS (
              SELECT 1 FROM labs l
              WHERE l.id = p_lab_id AND l.primary_assistant_id = auth.uid()
            )
          )
        )
      )
  );
$$;

-- 3. Public Learning Portal Read-Only Policies (No authentication required for published resources)
DROP POLICY IF EXISTS "Public Read Active MVIT Institution" ON institutions;
CREATE POLICY "Public Read Active MVIT Institution" ON institutions
  FOR SELECT TO anon, authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Public Read MVIT Departments" ON departments;
CREATE POLICY "Public Read MVIT Departments" ON departments
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Labs Read Policy" ON labs;
CREATE POLICY "Labs Read Policy" ON labs
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR is_college_admin(institution_id)
    OR has_lab_access(id)
  );

DROP POLICY IF EXISTS "Public Read Active Subjects" ON practical_subjects;
CREATE POLICY "Public Read Active Subjects" ON practical_subjects
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR is_institution_staff(institution_id)
  );

DROP POLICY IF EXISTS "Public Read Published Experiments" ON experiments;
CREATE POLICY "Public Read Published Experiments" ON experiments
  FOR SELECT TO anon, authenticated
  USING (
    is_published = true
    OR is_institution_staff(institution_id)
  );

DROP POLICY IF EXISTS "Public Read Published Lab Manuals" ON lab_manual_documents;
CREATE POLICY "Public Read Published Lab Manuals" ON lab_manual_documents
  FOR SELECT TO anon, authenticated
  USING (
    is_published = true
    OR is_institution_staff(institution_id)
  );

-- Public read-only QR lookup for apparatus specifications & availability
DROP POLICY IF EXISTS "Public Read Inventory QR Summary" ON inventory_items;
CREATE POLICY "Public Read Inventory QR Summary" ON inventory_items
  FOR SELECT TO anon, authenticated
  USING (true);

-- 4. Staff Write Policies: College Admin vs Lab Assistant Separation of Duties
-- College Admin ONLY manages Laboratories, Profiles, and Lab Assistant Assignments
DROP POLICY IF EXISTS "Labs College Admin Insert" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Update" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Delete" ON labs;

CREATE POLICY "Labs College Admin Insert" ON labs
  FOR INSERT WITH CHECK (is_college_admin(institution_id));

CREATE POLICY "Labs College Admin Update" ON labs
  FOR UPDATE USING (is_college_admin(institution_id))
  WITH CHECK (is_college_admin(institution_id));

CREATE POLICY "Labs College Admin Delete" ON labs
  FOR DELETE USING (is_college_admin(institution_id));

DROP POLICY IF EXISTS "Profiles Super Admin Manage" ON profiles;
DROP POLICY IF EXISTS "Profiles College Admin Insert" ON profiles;
DROP POLICY IF EXISTS "Profiles College Admin Update" ON profiles;
DROP POLICY IF EXISTS "Profiles Same Institution Read" ON profiles;

CREATE POLICY "Profiles College Admin Insert" ON profiles
  FOR INSERT WITH CHECK (
    is_college_admin(institution_id) AND role = 'lab_assistant'
  );

CREATE POLICY "Profiles College Admin Update" ON profiles
  FOR UPDATE USING (
    is_college_admin(institution_id)
  ) WITH CHECK (
    is_college_admin(institution_id) AND role IN ('college_admin', 'lab_assistant')
  );

CREATE POLICY "Profiles Same Institution Read" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR is_college_admin(institution_id)
    OR (institution_id = get_auth_institution_id() AND status != 'suspended' AND role IN ('college_admin', 'lab_assistant'))
  );

-- Lab Assignments managed exclusively by College Admin
DROP POLICY IF EXISTS "Lab Assignments Admin Manage" ON profile_lab_assignments;
CREATE POLICY "Lab Assignments Admin Manage" ON profile_lab_assignments
  FOR ALL USING (is_college_admin(institution_id))
  WITH CHECK (is_college_admin(institution_id));

DROP POLICY IF EXISTS "Lab Assignments Assistant Read" ON profile_lab_assignments;
CREATE POLICY "Lab Assignments Assistant Read" ON profile_lab_assignments
  FOR SELECT USING (profile_id = auth.uid() OR is_college_admin(institution_id));

-- Practical Subjects, Experiments, Lab Manuals & Inventory managed by Assigned Lab Assistant (or College Admin)
DROP POLICY IF EXISTS "Subjects Staff Write" ON practical_subjects;
CREATE POLICY "Subjects Staff Write" ON practical_subjects
  FOR ALL USING (
    is_college_admin(institution_id) OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  )
  WITH CHECK (
    is_college_admin(institution_id) OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  );

DROP POLICY IF EXISTS "Experiments Staff Write" ON experiments;
CREATE POLICY "Experiments Staff Write" ON experiments
  FOR ALL USING (
    is_college_admin(institution_id) OR EXISTS (
      SELECT 1 FROM practical_subjects ps
      WHERE ps.id = experiments.subject_id
        AND ps.lab_id IS NOT NULL
        AND has_lab_access(ps.lab_id)
    )
  )
  WITH CHECK (
    is_college_admin(institution_id) OR EXISTS (
      SELECT 1 FROM practical_subjects ps
      WHERE ps.id = experiments.subject_id
        AND ps.lab_id IS NOT NULL
        AND has_lab_access(ps.lab_id)
    )
  );

DROP POLICY IF EXISTS "Manuals Staff Write" ON lab_manual_documents;
CREATE POLICY "Manuals Staff Write" ON lab_manual_documents
  FOR ALL USING (is_institution_staff(institution_id))
  WITH CHECK (is_institution_staff(institution_id));

DROP POLICY IF EXISTS "Inventory Staff Write" ON inventory_items;
CREATE POLICY "Inventory Staff Write" ON inventory_items
  FOR ALL USING (
    is_college_admin(institution_id) OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  )
  WITH CHECK (
    is_college_admin(institution_id) OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  );

-- 5. Update Atomic Inventory Transaction Function for 2-Role MVIT Architecture
CREATE OR REPLACE FUNCTION process_inventory_transaction(
  p_item_id UUID,
  p_type VARCHAR(30),
  p_quantity INT,
  p_student_roll VARCHAR(100),
  p_student_name VARCHAR(255),
  p_experiment_title VARCHAR(255),
  p_remarks TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role VARCHAR(30);
  v_caller_inst_id UUID;
  v_caller_status VARCHAR(20);
  v_item_inst_id UUID;
  v_item_lab_id UUID;
  v_current_available INT;
  v_current_total INT;
  v_new_available INT;
  v_new_total INT;
  v_tx_id UUID;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to process inventory transactions');
  END IF;

  SELECT role, institution_id, status
  INTO v_caller_role, v_caller_inst_id, v_caller_status
  FROM profiles
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'User account is not active or verified');
  END IF;

  IF v_caller_role NOT IN ('lab_assistant', 'college_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Lab Assistant or College Admin privileges required');
  END IF;

  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction quantity must be strictly greater than zero');
  END IF;

  SELECT institution_id, lab_id, quantity_available, quantity_total
  INTO v_item_inst_id, v_item_lab_id, v_current_available, v_current_total
  FROM inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory apparatus record not found');
  END IF;

  IF v_caller_inst_id != v_item_inst_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Apparatus does not belong to MVIT');
  END IF;

  IF v_item_lab_id IS NOT NULL AND NOT has_lab_access(v_item_lab_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: You are not assigned to this laboratory');
  END IF;

  IF p_type = 'issue' THEN
    IF v_current_available < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient inventory available. Requested ' || p_quantity || ', available: ' || v_current_available);
    END IF;
    v_new_available := v_current_available - p_quantity;
    v_new_total := v_current_total;
  ELSIF p_type = 'return' THEN
    IF v_current_available + p_quantity > v_current_total THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot return more units than total checked-out stock');
    END IF;
    v_new_available := v_current_available + p_quantity;
    v_new_total := v_current_total;
  ELSIF p_type = 'damage_writeoff' THEN
    IF v_current_available < p_quantity THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot write off more apparatus than currently available in stock');
    END IF;
    v_new_available := v_current_available - p_quantity;
    v_new_total := GREATEST(0, v_current_total - p_quantity);
  ELSIF p_type = 'restock' THEN
    v_new_available := v_current_available + p_quantity;
    v_new_total := v_current_total + p_quantity;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unrecognized transaction type: ' || p_type);
  END IF;

  UPDATE inventory_items
  SET quantity_available = v_new_available,
      quantity_total = v_new_total
  WHERE id = p_item_id;

  INSERT INTO inventory_transactions (
    item_id, transaction_type, quantity,
    student_roll_number, student_name, experiment_title,
    handled_by, remarks
  ) VALUES (
    p_item_id, p_type, p_quantity,
    p_student_roll, p_student_name, p_experiment_title,
    v_caller_id, p_remarks
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'new_available', v_new_available,
    'new_total', v_new_total
  );
END;
$$;
