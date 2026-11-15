-- ==============================================================================
-- LABVERSE POSTGRESQL PRODUCTION SECURITY REPAIR & RLS HARDENING
-- Addresses: Profile privilege escalation prevention, atomic inventory lock with
-- role & lab authorization, laboratory management policy enforcement, and fixed search_path.
-- ==============================================================================

-- 1. Ensure fixed search_path on all security-definer helper functions
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

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND role = 'super_admin' 
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_college_admin(p_inst_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND status = 'active'
      AND (role = 'super_admin' OR (institution_id = p_inst_id AND role = 'college_admin'))
  );
$$;

CREATE OR REPLACE FUNCTION is_institution_staff(p_inst_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND status = 'active'
      AND (role = 'super_admin' OR (institution_id = p_inst_id AND role IN ('college_admin', 'faculty', 'lab_assistant')))
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
        p.role = 'super_admin' OR
        (p.role = 'college_admin' AND EXISTS (SELECT 1 FROM labs l WHERE l.id = p_lab_id AND l.institution_id = p.institution_id)) OR
        EXISTS (
          SELECT 1 FROM profile_lab_assignments pla 
          WHERE pla.profile_id = auth.uid() AND pla.lab_id = p_lab_id
        )
      )
  );
$$;

-- 2. Correct Profile Policies:
-- Users CANNOT change their own role, institution_id, authentication UUID, or administrative permissions.
DROP POLICY IF EXISTS "Profiles Self Update" ON profiles;
DROP POLICY IF EXISTS "Profiles Super Admin Manage" ON profiles;
DROP POLICY IF EXISTS "Profiles College Admin Manage" ON profiles;
DROP POLICY IF EXISTS "Profiles Same Institution Read" ON profiles;

-- Super Admin can manage all profiles
CREATE POLICY "Profiles Super Admin Manage" ON profiles
  FOR ALL USING (is_super_admin());

-- College Admin can insert and manage staff/students within their own institution (except super_admin)
CREATE POLICY "Profiles College Admin Insert" ON profiles
  FOR INSERT WITH CHECK (
    is_college_admin(institution_id) AND role != 'super_admin'
  );

CREATE POLICY "Profiles College Admin Update" ON profiles
  FOR UPDATE USING (
    is_college_admin(institution_id)
  ) WITH CHECK (
    is_college_admin(institution_id) AND role != 'super_admin'
  );

-- Users can update only their own name/avatar/identifier (CANNOT modify role or institution_id!)
CREATE POLICY "Profiles Self Update" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) AND
    institution_id = (SELECT p.institution_id FROM profiles p WHERE p.id = auth.uid())
  );

-- Users can read profiles from their own active institution; Super Admin can read all
CREATE POLICY "Profiles Same Institution Read" ON profiles
  FOR SELECT USING (
    is_super_admin() OR 
    (institution_id = get_auth_institution_id() AND status != 'suspended')
  );

-- 3. Laboratory Management Policies (Product Rules):
-- Super Admin: manages colleges, not individual college laboratories.
-- College Admin: creates, edits and deactivates laboratories in their own institution.
-- Faculty / Lab Assistant / Student: cannot create or modify laboratories.
DROP POLICY IF EXISTS "Labs Super Admin Manage" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Manage" ON labs;
DROP POLICY IF EXISTS "Labs Member Read Active" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Insert" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Update" ON labs;
DROP POLICY IF EXISTS "Labs College Admin Delete" ON labs;
DROP POLICY IF EXISTS "Labs Read Policy" ON labs;

-- College Admin creates laboratories in their own institution
CREATE POLICY "Labs College Admin Insert" ON labs
  FOR INSERT WITH CHECK (
    institution_id = get_auth_institution_id() AND is_college_admin(institution_id)
  );

-- College Admin updates laboratories in their own institution
CREATE POLICY "Labs College Admin Update" ON labs
  FOR UPDATE USING (
    institution_id = get_auth_institution_id() AND is_college_admin(institution_id)
  ) WITH CHECK (
    institution_id = get_auth_institution_id() AND is_college_admin(institution_id)
  );

-- College Admin deactivates/deletes laboratories in their own institution
CREATE POLICY "Labs College Admin Delete" ON labs
  FOR DELETE USING (
    institution_id = get_auth_institution_id() AND is_college_admin(institution_id)
  );

-- Reading laboratories:
-- Super Admin can view all labs;
-- College Admin can view all labs in their institution;
-- Other members (Faculty, Lab Assistant, Student) view active labs in their institution.
CREATE POLICY "Labs Read Policy" ON labs
  FOR SELECT USING (
    is_super_admin() OR
    (institution_id = get_auth_institution_id() AND (status = 'active' OR is_college_admin(institution_id)))
  );

-- 4. Correct Atomic Inventory Transaction Function:
-- Requires: authenticated user, valid active profile, permitted role, correct institution,
-- appropriate laboratory access, and positive transaction quantity.
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
  v_item_code VARCHAR(100);
  v_item_name VARCHAR(255);
  v_min_threshold INT;
  v_new_available INT;
  v_new_total INT;
  v_tx_id UUID;
BEGIN
  -- Security Check 1: Authenticated user required
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required to process inventory transactions');
  END IF;

  -- Security Check 2: Caller profile and active status verification
  SELECT role, institution_id, status
  INTO v_caller_role, v_caller_inst_id, v_caller_status
  FROM profiles
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'User account is not active or verified');
  END IF;

  -- Security Check 3: Permitted role (only lab assistant, college admin, or super admin)
  IF v_caller_role NOT IN ('lab_assistant', 'college_admin', 'super_admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Lab Assistant or College Admin privileges required');
  END IF;

  -- Security Check 4: Positive transaction quantity
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction quantity must be strictly greater than zero');
  END IF;

  -- Lock row FOR UPDATE to prevent race conditions and fetch tenant/lab details
  SELECT institution_id, lab_id, quantity_available, quantity_total, item_code, name, min_safety_threshold
  INTO v_item_inst_id, v_item_lab_id, v_current_available, v_current_total, v_item_code, v_item_name, v_min_threshold
  FROM inventory_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory apparatus record not found');
  END IF;

  -- Security Check 5: Tenant isolation check (caller must belong to same institution as item)
  IF v_caller_role != 'super_admin' AND v_caller_inst_id != v_item_inst_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Apparatus belongs to another institutional tenant');
  END IF;

  -- Security Check 6: Laboratory workstation access check
  IF v_caller_role != 'super_admin' AND v_item_lab_id IS NOT NULL THEN
    IF NOT has_lab_access(v_item_lab_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied: You do not have workstation privileges for this laboratory');
    END IF;
  END IF;

  -- Transaction quantity calculation
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
      RETURN jsonb_build_object('success', false, 'error', 'Cannot write off more apparatus than is currently available in stock');
    END IF;
    v_new_available := v_current_available - p_quantity;
    v_new_total := GREATEST(0, v_current_total - p_quantity);

  ELSIF p_type = 'restock' THEN
    v_new_available := v_current_available + p_quantity;
    v_new_total := v_current_total + p_quantity;

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unrecognized transaction type: ' || p_type);
  END IF;

  -- Update inventory item
  UPDATE inventory_items
  SET quantity_available = v_new_available,
      quantity_total = v_new_total
  WHERE id = p_item_id;

  -- Insert transaction audit log
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
