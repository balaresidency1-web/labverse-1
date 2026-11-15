-- ==============================================================================
-- LABVERSE – MVIT PRODUCTION SECURITY HARDENING & ATOMIC ASSIGNMENT MIGRATION
-- Target Institution: Manakula Vinayagar Institute of Technology (MVIT)
-- Canonical UUID: de34eef0-1cd3-476d-9ef6-d66fff6934e0 (preserved, never altered)
--
-- Implements:
--   1. Complete Super Admin / legacy multi-role removal (college_admin & lab_assistant only)
--   2. Lab-scoped lab_manual_documents & storage.objects RLS (manuals & diagrams)
--   3. Restricted inventory_items / inventory_transactions RLS + sanitized public QR RPC
--   4. Immutable profiles trigger (blocks role/institution/id escalation) + invite activation RPC
--   5. Atomic assign_lab_assistant & set_assistant_lab_assignments RPCs
--   6. Safe deletion protection on labs with linked educational/inventory records
-- ==============================================================================

-- 1. Safe Schema Additions (Preserve existing tables, UUIDs, and MVIT records)
ALTER TABLE lab_manual_documents
  ADD COLUMN IF NOT EXISTS lab_id UUID REFERENCES labs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Backfill lab_id on existing lab_manual_documents from linked practical_subjects when missing
UPDATE lab_manual_documents d
SET lab_id = ps.lab_id
FROM practical_subjects ps
WHERE d.subject_id = ps.id
  AND d.lab_id IS NULL
  AND ps.lab_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_manual_documents_lab ON lab_manual_documents(lab_id);

-- Ensure canonical MVIT institution stays active without altering its UUID
UPDATE institutions
SET active = true,
    status = 'active',
    institution_code = COALESCE(institution_code, code)
WHERE UPPER(code) = 'MVIT';

-- 2. Drop ALL legacy policies referencing is_super_admin(), faculty, or student roles
DROP POLICY IF EXISTS "Institutions Super Admin Manage" ON institutions;
DROP POLICY IF EXISTS "Institutions Member Read" ON institutions;
DROP POLICY IF EXISTS "Public Read Active MVIT Institution" ON institutions;

DROP POLICY IF EXISTS "Profiles Super Admin Manage" ON profiles;
DROP POLICY IF EXISTS "Profiles Same Institution Read" ON profiles;
DROP POLICY IF EXISTS "Profiles Self Update" ON profiles;
DROP POLICY IF EXISTS "Profiles College Admin Manage" ON profiles;
DROP POLICY IF EXISTS "Profiles College Admin Insert" ON profiles;
DROP POLICY IF EXISTS "Profiles College Admin Update" ON profiles;

DROP POLICY IF EXISTS "Departments Isolation" ON departments;
DROP POLICY IF EXISTS "Departments Read" ON departments;
DROP POLICY IF EXISTS "Public Read MVIT Departments" ON departments;
DROP POLICY IF EXISTS "Departments College Admin Manage" ON departments;

DROP POLICY IF EXISTS "Academic Terms Manage" ON academic_terms;
DROP POLICY IF EXISTS "Academic Terms Read" ON academic_terms;
DROP POLICY IF EXISTS "Public Read Active Terms" ON academic_terms;
DROP POLICY IF EXISTS "Academic Terms College Admin Manage" ON academic_terms;

DROP POLICY IF EXISTS "Labs Super Admin Manage" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Manage" ON labs;
DROP POLICY IF EXISTS "Labs Member Read Active" ON labs;
DROP POLICY IF EXISTS "Labs Read Policy" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Insert" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Update" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Delete" ON labs;

DROP POLICY IF EXISTS "Subjects Staff Manage" ON practical_subjects;
DROP POLICY IF EXISTS "Subjects Student Read" ON practical_subjects;
DROP POLICY IF EXISTS "Public Read Active Subjects" ON practical_subjects;
DROP POLICY IF EXISTS "Subjects Staff Write" ON practical_subjects;

DROP POLICY IF EXISTS "Syllabus Staff Manage" ON subject_syllabuses;
DROP POLICY IF EXISTS "Syllabus Member Read" ON subject_syllabuses;
DROP POLICY IF EXISTS "Public Read Active Subject Syllabuses" ON subject_syllabuses;
DROP POLICY IF EXISTS "Syllabus Staff Write" ON subject_syllabuses;

DROP POLICY IF EXISTS "Experiments Faculty Manage" ON experiments;
DROP POLICY IF EXISTS "Experiments Student Read" ON experiments;
DROP POLICY IF EXISTS "Public Read Published Experiments" ON experiments;
DROP POLICY IF EXISTS "Experiments Staff Write" ON experiments;

DROP POLICY IF EXISTS "Documents Faculty Manage" ON lab_manual_documents;
DROP POLICY IF EXISTS "Documents Student Read" ON lab_manual_documents;
DROP POLICY IF EXISTS "Public Read Published Lab Manuals" ON lab_manual_documents;
DROP POLICY IF EXISTS "Manuals Staff Write" ON lab_manual_documents;

DROP POLICY IF EXISTS "Student Own Progress Access" ON experiment_progress;
DROP POLICY IF EXISTS "Faculty Evaluate Progress" ON experiment_progress;
DROP POLICY IF EXISTS "Progress Events Access" ON progress_events;

DROP POLICY IF EXISTS "Inventory Staff Manage" ON inventory_items;
DROP POLICY IF EXISTS "Inventory View All Roles" ON inventory_items;
DROP POLICY IF EXISTS "Public Read Inventory QR Summary" ON inventory_items;
DROP POLICY IF EXISTS "Inventory Staff Write" ON inventory_items;
DROP POLICY IF EXISTS "Inventory Staff Read" ON inventory_items;

DROP POLICY IF EXISTS "Inventory Transactions Insert" ON inventory_transactions;
DROP POLICY IF EXISTS "Inventory Transactions Read" ON inventory_transactions;
DROP POLICY IF EXISTS "Inventory Transactions Staff Read" ON inventory_transactions;
DROP POLICY IF EXISTS "Inventory Transactions Staff Insert" ON inventory_transactions;

DROP POLICY IF EXISTS "Notifications Recipient Access" ON notifications;
DROP POLICY IF EXISTS "Notifications MVIT Staff Access" ON notifications;

DROP POLICY IF EXISTS "Audit Logs Admin Access" ON audit_logs;
DROP POLICY IF EXISTS "Audit Logs Staff Insert" ON audit_logs;
DROP POLICY IF EXISTS "Audit Logs Admin Read" ON audit_logs;

DROP POLICY IF EXISTS "Profile Lab Assignments Super Admin Manage" ON profile_lab_assignments;
DROP POLICY IF EXISTS "Profile Lab Assignments College Admin Manage" ON profile_lab_assignments;
DROP POLICY IF EXISTS "Profile Lab Assignments Self Read" ON profile_lab_assignments;
DROP POLICY IF EXISTS "Lab Assignments Admin Manage" ON profile_lab_assignments;
DROP POLICY IF EXISTS "Lab Assignments Assistant Read" ON profile_lab_assignments;

DROP POLICY IF EXISTS "Public Read Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Staff Upload Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Staff Update Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Staff Delete Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Diagrams" ON storage.objects;
DROP POLICY IF EXISTS "Staff Upload Diagrams" ON storage.objects;
DROP POLICY IF EXISTS "Staff Update Diagrams" ON storage.objects;
DROP POLICY IF EXISTS "Staff Delete Diagrams" ON storage.objects;

-- Drop legacy Super Admin & multi-college functions cleanly
DROP FUNCTION IF EXISTS register_new_college(VARCHAR, VARCHAR, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS is_super_admin();

-- 3. Restrict profiles.role strictly to ('college_admin', 'lab_assistant')
DO $$
DECLARE
  v_constraint RECORD;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'profiles'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%role%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS %I', v_constraint.conname);
  END LOOP;
END $$;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_mvit_check
  CHECK (role IN ('college_admin', 'lab_assistant'));

-- 4. Core MVIT Helper Functions (Zero Super Admin / Faculty / Student)
CREATE OR REPLACE FUNCTION get_mvit_institution_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT id FROM institutions WHERE UPPER(code) = 'MVIT' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_auth_institution_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT institution_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_auth_role()
RETURNS VARCHAR LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_college_admin(p_inst_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND status = 'active'
      AND institution_id = p_inst_id
      AND institution_id = get_mvit_institution_id()
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
      AND institution_id = get_mvit_institution_id()
      AND role IN ('college_admin', 'lab_assistant')
  );
$$;

CREATE OR REPLACE FUNCTION has_lab_access(p_lab_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN labs l ON l.id = p_lab_id
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND p.institution_id = get_mvit_institution_id()
      AND l.institution_id = p.institution_id
      AND (
        p.role = 'college_admin'
        OR (
          p.role = 'lab_assistant'
          AND l.status = 'active'
          AND (
            l.primary_assistant_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM profile_lab_assignments pla
              WHERE pla.profile_id = auth.uid()
                AND pla.lab_id = p_lab_id
                AND pla.institution_id = p.institution_id
            )
          )
        )
      )
  );
$$;

-- Safe UUID extraction from storage object paths shaped: mvit/<lab_uuid>/<type>/<filename>
CREATE OR REPLACE FUNCTION storage_path_lab_id(p_name TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
DECLARE
  v_segments TEXT[];
  v_candidate TEXT;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;
  v_segments := string_to_array(p_name, '/');
  IF array_length(v_segments, 1) < 2 THEN
    RETURN NULL;
  END IF;
  v_candidate := v_segments[2];
  IF v_candidate ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v_candidate::UUID;
  END IF;
  RETURN NULL;
END;
$$;

-- 5. Profile Immutability Trigger (Blocks privilege/role/institution tampering)
CREATE OR REPLACE FUNCTION protect_profile_immutable_columns()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  -- Allow privileged backend/service_role or SQL migrations without auth session
  IF auth.uid() IS NULL OR v_jwt_role = 'service_role' OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Never allow altering identity UUID, institutional tenant, or role via client UPDATE
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Forbidden: Profile ID is immutable.';
  END IF;

  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    RAISE EXCEPTION 'Forbidden: Institution ID cannot be altered.';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Forbidden: Profile role cannot be changed or elevated via client updates.';
  END IF;

  -- Non-admin staff can only edit non-privileged display metadata (name, avatar_url, identifier)
  IF NOT is_college_admin(OLD.institution_id) THEN
    IF NEW.id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Forbidden: Cannot modify another staff member profile.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Forbidden: Account status can only be changed by College Administration or verified activation RPC.';
    END IF;
    IF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
      RAISE EXCEPTION 'Forbidden: Department assignment is managed by College Administration.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_immutable_columns ON profiles;
CREATE TRIGGER trg_protect_profile_immutable_columns
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_profile_immutable_columns();

-- Controlled RPC for newly invited staff completing password setup
CREATE OR REPLACE FUNCTION activate_own_invited_profile()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_profile profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication session required.');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'MVIT staff profile not found.');
  END IF;

  IF v_profile.institution_id != get_mvit_institution_id() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile does not belong to MVIT.');
  END IF;

  IF v_profile.role NOT IN ('college_admin', 'lab_assistant') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unsupported staff role.');
  END IF;

  IF v_profile.status = 'suspended' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended by MVIT administration.');
  END IF;

  IF v_profile.status = 'invited' THEN
    UPDATE profiles
    SET status = 'active',
        updated_at = NOW()
    WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'active', 'role', v_profile.role);
END;
$$;

REVOKE ALL ON FUNCTION activate_own_invited_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_own_invited_profile() TO authenticated;

-- 6. Prevent Permanent Deletion of Labs Containing Records
CREATE OR REPLACE FUNCTION prevent_lab_deletion_with_records()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM inventory_items WHERE lab_id = OLD.id)
     OR EXISTS (SELECT 1 FROM practical_subjects WHERE lab_id = OLD.id)
     OR EXISTS (SELECT 1 FROM lab_manual_documents WHERE lab_id = OLD.id) THEN
    RAISE EXCEPTION 'Cannot permanently delete laboratory "%" because inventory, practical subjects, or manuals reference it. Deactivate the laboratory instead.', OLD.lab_code;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_lab_deletion_with_records ON labs;
CREATE TRIGGER trg_prevent_lab_deletion_with_records
  BEFORE DELETE ON labs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_lab_deletion_with_records();

-- 7. Atomic Lab Assistant Assignment RPCs (College Admin Only)
CREATE OR REPLACE FUNCTION assign_lab_assistant(
  p_lab_id UUID,
  p_assistant_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_mvit_id UUID := get_mvit_institution_id();
  v_lab labs%ROWTYPE;
  v_assistant profiles%ROWTYPE;
BEGIN
  IF v_mvit_id IS NULL OR NOT is_college_admin(v_mvit_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Active MVIT College Admin privileges required.');
  END IF;

  SELECT * INTO v_lab
  FROM labs
  WHERE id = p_lab_id AND institution_id = v_mvit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Laboratory not found at MVIT.');
  END IF;

  IF p_assistant_id IS NOT NULL THEN
    SELECT * INTO v_assistant
    FROM profiles
    WHERE id = p_assistant_id
      AND institution_id = v_mvit_id
      AND role = 'lab_assistant';

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Selected staff member is not a valid MVIT Lab Assistant.');
    END IF;

    IF v_assistant.status != 'active' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only active MVIT Lab Assistants may be assigned to laboratories.');
    END IF;
  END IF;

  -- Synchronize both profile_lab_assignments and labs.primary_assistant_id atomically
  DELETE FROM profile_lab_assignments
  WHERE lab_id = p_lab_id AND institution_id = v_mvit_id;

  IF p_assistant_id IS NOT NULL THEN
    INSERT INTO profile_lab_assignments (institution_id, profile_id, lab_id)
    VALUES (v_mvit_id, p_assistant_id, p_lab_id)
    ON CONFLICT (profile_id, lab_id) DO NOTHING;
  END IF;

  UPDATE labs
  SET primary_assistant_id = p_assistant_id,
      updated_at = NOW()
  WHERE id = p_lab_id;

  RETURN jsonb_build_object(
    'success', true,
    'lab_id', p_lab_id,
    'assistant_id', p_assistant_id
  );
END;
$$;

REVOKE ALL ON FUNCTION assign_lab_assistant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_lab_assistant(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION set_assistant_lab_assignments(
  p_assistant_id UUID,
  p_lab_ids UUID[]
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_mvit_id UUID := get_mvit_institution_id();
  v_assistant profiles%ROWTYPE;
  v_clean_lab_ids UUID[];
  v_valid_count INT;
BEGIN
  IF v_mvit_id IS NULL OR NOT is_college_admin(v_mvit_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden: Active MVIT College Admin privileges required.');
  END IF;

  SELECT * INTO v_assistant
  FROM profiles
  WHERE id = p_assistant_id
    AND institution_id = v_mvit_id
    AND role = 'lab_assistant';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user is not a Lab Assistant at MVIT.');
  END IF;

  IF v_assistant.status = 'suspended' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot assign laboratories to a suspended Lab Assistant account.');
  END IF;

  SELECT COALESCE(array_agg(DISTINCT u), ARRAY[]::UUID[])
  INTO v_clean_lab_ids
  FROM unnest(COALESCE(p_lab_ids, ARRAY[]::UUID[])) AS u;

  SELECT COUNT(*) INTO v_valid_count
  FROM labs
  WHERE institution_id = v_mvit_id AND id = ANY(v_clean_lab_ids);

  IF v_valid_count != COALESCE(array_length(v_clean_lab_ids, 1), 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or more selected laboratories do not belong to MVIT.');
  END IF;

  DELETE FROM profile_lab_assignments
  WHERE profile_id = p_assistant_id AND institution_id = v_mvit_id;

  IF COALESCE(array_length(v_clean_lab_ids, 1), 0) > 0 THEN
    INSERT INTO profile_lab_assignments (institution_id, profile_id, lab_id)
    SELECT v_mvit_id, p_assistant_id, lid
    FROM unnest(v_clean_lab_ids) AS lid
    ON CONFLICT (profile_id, lab_id) DO NOTHING;
  END IF;

  -- Keep labs.primary_assistant_id synchronized
  UPDATE labs
  SET primary_assistant_id = NULL,
      updated_at = NOW()
  WHERE institution_id = v_mvit_id
    AND primary_assistant_id = p_assistant_id
    AND NOT (id = ANY(v_clean_lab_ids));

  IF COALESCE(array_length(v_clean_lab_ids, 1), 0) > 0 THEN
    UPDATE labs
    SET primary_assistant_id = p_assistant_id,
        updated_at = NOW()
    WHERE institution_id = v_mvit_id
      AND id = ANY(v_clean_lab_ids)
      AND primary_assistant_id IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'assistant_id', p_assistant_id,
    'assigned_lab_ids', to_jsonb(v_clean_lab_ids)
  );
END;
$$;

REVOKE ALL ON FUNCTION set_assistant_lab_assignments(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_assistant_lab_assignments(UUID, UUID[]) TO authenticated;

-- 8. Hardened RLS Policies (Public Read-Only Portal vs Admin vs Assigned Lab Assistant)

-- Institutions: Public active MVIT read only
CREATE POLICY "Public Read Active MVIT Institution" ON institutions
  FOR SELECT TO anon, authenticated
  USING (active = true);

-- Departments: Public read, College Admin write
CREATE POLICY "Public Read MVIT Departments" ON departments
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Departments College Admin Manage" ON departments
  FOR ALL USING (is_college_admin(institution_id))
  WITH CHECK (is_college_admin(institution_id));

-- Academic Terms: Public current term read, College Admin write
CREATE POLICY "Public Read Active Terms" ON academic_terms
  FOR SELECT TO anon, authenticated
  USING (is_current = true OR is_institution_staff(institution_id));

CREATE POLICY "Academic Terms College Admin Manage" ON academic_terms
  FOR ALL USING (is_college_admin(institution_id))
  WITH CHECK (is_college_admin(institution_id));

-- Labs: Public active labs read; College Admin full control; Assistants see assigned labs
CREATE POLICY "Labs Read Policy" ON labs
  FOR SELECT TO anon, authenticated
  USING (
    status = 'active'
    OR is_college_admin(institution_id)
    OR has_lab_access(id)
  );

CREATE POLICY "Labs College Admin Insert" ON labs
  FOR INSERT WITH CHECK (is_college_admin(institution_id));

CREATE POLICY "Labs College Admin Update" ON labs
  FOR UPDATE USING (is_college_admin(institution_id))
  WITH CHECK (is_college_admin(institution_id));

CREATE POLICY "Labs College Admin Delete" ON labs
  FOR DELETE USING (is_college_admin(institution_id));

-- Profiles: College Admin & self read/update (trigger blocks privilege/role tampering)
CREATE POLICY "Profiles Same Institution Read" ON profiles
  FOR SELECT USING (
    id = auth.uid()
    OR is_college_admin(institution_id)
    OR (
      is_institution_staff(institution_id)
      AND status != 'suspended'
      AND role IN ('college_admin', 'lab_assistant')
    )
  );

CREATE POLICY "Profiles College Admin Insert" ON profiles
  FOR INSERT WITH CHECK (
    is_college_admin(institution_id) AND role = 'lab_assistant'
  );

CREATE POLICY "Profiles College Admin Update" ON profiles
  FOR UPDATE USING (is_college_admin(institution_id))
  WITH CHECK (
    is_college_admin(institution_id) AND role IN ('college_admin', 'lab_assistant')
  );

CREATE POLICY "Profiles Self Update" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role IN ('college_admin', 'lab_assistant'));

-- Profile Lab Assignments: College Admin manage, assistant read own
CREATE POLICY "Lab Assignments Admin Manage" ON profile_lab_assignments
  FOR ALL USING (is_college_admin(institution_id))
  WITH CHECK (is_college_admin(institution_id));

CREATE POLICY "Lab Assignments Assistant Read" ON profile_lab_assignments
  FOR SELECT USING (profile_id = auth.uid() OR is_college_admin(institution_id));

-- Practical Subjects: Public active read, College Admin or assigned Lab Assistant write
CREATE POLICY "Public Read Active Subjects" ON practical_subjects
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    OR is_college_admin(institution_id)
    OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  );

CREATE POLICY "Subjects Staff Write" ON practical_subjects
  FOR ALL USING (
    is_college_admin(institution_id)
    OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  )
  WITH CHECK (
    is_college_admin(institution_id)
    OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  );

-- Subject Syllabuses: Public active read, College Admin or assigned Lab Assistant write
CREATE POLICY "Public Read Active Subject Syllabuses" ON subject_syllabuses
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM practical_subjects ps
      WHERE ps.id = subject_syllabuses.subject_id
        AND (
          ps.is_active = true
          OR is_college_admin(ps.institution_id)
          OR (ps.lab_id IS NOT NULL AND has_lab_access(ps.lab_id))
        )
    )
  );

CREATE POLICY "Syllabus Staff Write" ON subject_syllabuses
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM practical_subjects ps
      WHERE ps.id = subject_syllabuses.subject_id
        AND (
          is_college_admin(ps.institution_id)
          OR (ps.lab_id IS NOT NULL AND has_lab_access(ps.lab_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practical_subjects ps
      WHERE ps.id = subject_syllabuses.subject_id
        AND (
          is_college_admin(ps.institution_id)
          OR (ps.lab_id IS NOT NULL AND has_lab_access(ps.lab_id))
        )
    )
  );

-- Experiments: Public published read, College Admin or assigned Lab Assistant write
CREATE POLICY "Public Read Published Experiments" ON experiments
  FOR SELECT TO anon, authenticated
  USING (
    is_published = true
    OR is_college_admin(institution_id)
    OR EXISTS (
      SELECT 1 FROM practical_subjects ps
      WHERE ps.id = experiments.subject_id
        AND ps.lab_id IS NOT NULL
        AND has_lab_access(ps.lab_id)
    )
  );

CREATE POLICY "Experiments Staff Write" ON experiments
  FOR ALL USING (
    is_college_admin(institution_id)
    OR EXISTS (
      SELECT 1 FROM practical_subjects ps
      WHERE ps.id = experiments.subject_id
        AND ps.lab_id IS NOT NULL
        AND has_lab_access(ps.lab_id)
    )
  )
  WITH CHECK (
    is_college_admin(institution_id)
    OR EXISTS (
      SELECT 1 FROM practical_subjects ps
      WHERE ps.id = experiments.subject_id
        AND ps.lab_id IS NOT NULL
        AND has_lab_access(ps.lab_id)
    )
  );

-- Lab Manual Documents: Lab-scoped staff write (fixes broad is_institution_staff policy!)
CREATE POLICY "Public Read Published Lab Manuals" ON lab_manual_documents
  FOR SELECT TO anon, authenticated
  USING (
    is_published = true
    OR is_college_admin(institution_id)
    OR has_lab_access(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  );

CREATE POLICY "Manuals Staff Write" ON lab_manual_documents
  FOR ALL USING (
    is_college_admin(institution_id)
    OR has_lab_access(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  )
  WITH CHECK (
    is_college_admin(institution_id)
    OR has_lab_access(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  );

-- Inventory Items & Transactions: Strictly staff/lab-scoped (NO direct anon table SELECT!)
CREATE POLICY "Inventory Staff Read" ON inventory_items
  FOR SELECT TO authenticated
  USING (
    is_college_admin(institution_id)
    OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  );

CREATE POLICY "Inventory Staff Write" ON inventory_items
  FOR ALL TO authenticated
  USING (
    is_college_admin(institution_id)
    OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  )
  WITH CHECK (
    is_college_admin(institution_id)
    OR (lab_id IS NOT NULL AND has_lab_access(lab_id))
  );

CREATE POLICY "Inventory Transactions Staff Read" ON inventory_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM inventory_items i
      WHERE i.id = inventory_transactions.item_id
        AND (
          is_college_admin(i.institution_id)
          OR (i.lab_id IS NOT NULL AND has_lab_access(i.lab_id))
        )
    )
  );

CREATE POLICY "Inventory Transactions Staff Insert" ON inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inventory_items i
      WHERE i.id = inventory_transactions.item_id
        AND (
          is_college_admin(i.institution_id)
          OR (i.lab_id IS NOT NULL AND has_lab_access(i.lab_id))
        )
    )
  );

-- Notifications & Audit Logs: MVIT staff only
CREATE POLICY "Notifications MVIT Staff Access" ON notifications
  FOR ALL TO authenticated
  USING (
    is_college_admin(institution_id)
    OR (
      is_institution_staff(institution_id)
      AND (recipient_id = auth.uid() OR recipient_role = get_auth_role())
    )
  )
  WITH CHECK (is_institution_staff(institution_id));

CREATE POLICY "Audit Logs Admin Read" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_college_admin(institution_id));

CREATE POLICY "Audit Logs Staff Insert" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_institution_staff(institution_id));

-- 9. Sanitized Public QR Lookup RPC (Safe public apparatus info only; zero remarks/transactions/thresholds)
CREATE OR REPLACE FUNCTION lookup_public_inventory_qr(p_identifier TEXT)
RETURNS TABLE (
  id UUID,
  institution_id UUID,
  lab_id UUID,
  laboratory_name VARCHAR,
  laboratory_code VARCHAR,
  department_id UUID,
  department_name VARCHAR,
  item_code VARCHAR,
  name VARCHAR,
  category VARCHAR,
  location VARCHAR,
  unit VARCHAR,
  quantity_available INT,
  quantity_total INT,
  availability_status TEXT
) LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT
    i.id,
    i.institution_id,
    i.lab_id,
    l.name AS laboratory_name,
    l.lab_code AS laboratory_code,
    i.department_id,
    d.name AS department_name,
    i.item_code,
    i.name,
    i.category,
    i.location,
    i.unit,
    i.quantity_available,
    i.quantity_total,
    CASE
      WHEN i.quantity_available <= 0 THEN 'out_of_stock'
      WHEN i.quantity_available <= i.min_safety_threshold THEN 'low_stock'
      ELSE 'in_stock'
    END AS availability_status
  FROM inventory_items i
  JOIN institutions inst ON inst.id = i.institution_id
  LEFT JOIN labs l ON l.id = i.lab_id
  LEFT JOIN departments d ON d.id = i.department_id
  WHERE UPPER(inst.code) = 'MVIT'
    AND inst.active = true
    AND (l.id IS NULL OR l.status = 'active')
    AND (
      i.id::TEXT = TRIM(p_identifier)
      OR UPPER(i.item_code) = UPPER(TRIM(p_identifier))
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION lookup_public_inventory_qr(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_public_inventory_qr(TEXT) TO anon, authenticated;

-- 10. Storage Bucket Policies (Lab-scoped upload/update/delete for manuals & diagrams)
CREATE POLICY "Public Read Manuals" ON storage.objects
  FOR SELECT USING (bucket_id = 'manuals');

CREATE POLICY "Staff Upload Manuals" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'manuals'
    AND is_institution_staff(get_mvit_institution_id())
    AND (
      is_college_admin(get_mvit_institution_id())
      OR (
        storage_path_lab_id(name) IS NOT NULL
        AND has_lab_access(storage_path_lab_id(name))
      )
    )
  );

CREATE POLICY "Staff Update Manuals" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'manuals'
    AND is_institution_staff(get_mvit_institution_id())
    AND (
      is_college_admin(get_mvit_institution_id())
      OR (
        storage_path_lab_id(name) IS NOT NULL
        AND has_lab_access(storage_path_lab_id(name))
      )
    )
  )
  WITH CHECK (
    bucket_id = 'manuals'
    AND is_institution_staff(get_mvit_institution_id())
    AND (
      is_college_admin(get_mvit_institution_id())
      OR (
        storage_path_lab_id(name) IS NOT NULL
        AND has_lab_access(storage_path_lab_id(name))
      )
    )
  );

CREATE POLICY "Staff Delete Manuals" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'manuals'
    AND is_institution_staff(get_mvit_institution_id())
    AND (
      is_college_admin(get_mvit_institution_id())
      OR (
        storage_path_lab_id(name) IS NOT NULL
        AND has_lab_access(storage_path_lab_id(name))
      )
    )
  );

CREATE POLICY "Public Read Diagrams" ON storage.objects
  FOR SELECT USING (bucket_id = 'diagrams');

CREATE POLICY "Staff Upload Diagrams" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'diagrams'
    AND is_institution_staff(get_mvit_institution_id())
    AND (
      is_college_admin(get_mvit_institution_id())
      OR (
        storage_path_lab_id(name) IS NOT NULL
        AND has_lab_access(storage_path_lab_id(name))
      )
    )
  );

CREATE POLICY "Staff Update Diagrams" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'diagrams'
    AND is_institution_staff(get_mvit_institution_id())
    AND (
      is_college_admin(get_mvit_institution_id())
      OR (
        storage_path_lab_id(name) IS NOT NULL
        AND has_lab_access(storage_path_lab_id(name))
      )
    )
  )
  WITH CHECK (
    bucket_id = 'diagrams'
    AND is_institution_staff(get_mvit_institution_id())
    AND (
      is_college_admin(get_mvit_institution_id())
      OR (
        storage_path_lab_id(name) IS NOT NULL
        AND has_lab_access(storage_path_lab_id(name))
      )
    )
  );

CREATE POLICY "Staff Delete Diagrams" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'diagrams'
    AND is_institution_staff(get_mvit_institution_id())
    AND (
      is_college_admin(get_mvit_institution_id())
      OR (
        storage_path_lab_id(name) IS NOT NULL
        AND has_lab_access(storage_path_lab_id(name))
      )
    )
  );
