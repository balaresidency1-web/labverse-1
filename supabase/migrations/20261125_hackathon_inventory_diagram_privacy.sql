-- LABVERSE hackathon privacy hardening.
-- Keep the PC Lab isolated from College Admin inventory access, and make
-- diagram objects private with the same lab-scoped Storage authorization as manuals.

-- 1. College Admins may manage practical-lab inventory, but never PC Lab inventory.
DROP POLICY IF EXISTS "Inventory Staff Read" ON public.inventory_items;
CREATE POLICY "Inventory Staff Read"
  ON public.inventory_items
  FOR SELECT TO authenticated
  USING (
    (
      public.is_college_admin(institution_id)
      AND (
        lab_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.labs l
          WHERE l.id = inventory_items.lab_id
            AND l.institution_id = inventory_items.institution_id
            AND COALESCE(l.lab_type, 'practical') <> 'pc_lab'
        )
      )
    )
    OR (
      NOT public.is_college_admin(institution_id)
      AND lab_id IS NOT NULL
      AND public.has_lab_access(lab_id)
    )
  );

DROP POLICY IF EXISTS "Inventory Staff Write" ON public.inventory_items;
CREATE POLICY "Inventory Staff Write"
  ON public.inventory_items
  FOR ALL TO authenticated
  USING (
    (
      public.is_college_admin(institution_id)
      AND (
        lab_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.labs l
          WHERE l.id = inventory_items.lab_id
            AND l.institution_id = inventory_items.institution_id
            AND COALESCE(l.lab_type, 'practical') <> 'pc_lab'
        )
      )
    )
    OR (
      NOT public.is_college_admin(institution_id)
      AND lab_id IS NOT NULL
      AND public.has_lab_access(lab_id)
    )
  )
  WITH CHECK (
    (
      public.is_college_admin(institution_id)
      AND (
        lab_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.labs l
          WHERE l.id = inventory_items.lab_id
            AND l.institution_id = inventory_items.institution_id
            AND COALESCE(l.lab_type, 'practical') <> 'pc_lab'
        )
      )
    )
    OR (
      NOT public.is_college_admin(institution_id)
      AND lab_id IS NOT NULL
      AND public.has_lab_access(lab_id)
    )
  );

-- 2. Defense in depth: the SECURITY DEFINER inventory RPC independently rejects
-- College Admin operations against any PC Lab inventory item.
CREATE OR REPLACE FUNCTION public.process_inventory_transaction(
  p_item_id uuid,
  p_type character varying,
  p_quantity integer,
  p_student_roll character varying,
  p_student_name character varying,
  p_experiment_title character varying,
  p_remarks text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  IF v_caller_role = 'college_admin'
     AND v_item_lab_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.labs l
       WHERE l.id = v_item_lab_id
         AND l.institution_id = v_item_inst_id
         AND COALESCE(l.lab_type, 'practical') = 'pc_lab'
     ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'College Admin is not permitted to access PC Lab inventory');
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
$function$;

-- 3. The diagrams bucket currently has no stored objects, so it is safe to make
-- it private before any private/PC Lab diagrams are uploaded.
UPDATE storage.buckets
SET public = false
WHERE id = 'diagrams';

DROP POLICY IF EXISTS "Public Read Diagrams" ON storage.objects;
DROP POLICY IF EXISTS "Staff Read Diagrams" ON storage.objects;
DROP POLICY IF EXISTS "Staff Upload Diagrams" ON storage.objects;
DROP POLICY IF EXISTS "Staff Update Diagrams" ON storage.objects;
DROP POLICY IF EXISTS "Staff Delete Diagrams" ON storage.objects;

CREATE POLICY "Staff Read Diagrams"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'diagrams'
    AND public.can_staff_access_manual_object(name)
  );

CREATE POLICY "Staff Upload Diagrams"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'diagrams'
    AND public.can_staff_access_manual_object(name)
  );

CREATE POLICY "Staff Update Diagrams"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'diagrams'
    AND public.can_staff_access_manual_object(name)
  )
  WITH CHECK (
    bucket_id = 'diagrams'
    AND public.can_staff_access_manual_object(name)
  );

CREATE POLICY "Staff Delete Diagrams"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'diagrams'
    AND public.can_staff_access_manual_object(name)
  );

COMMENT ON POLICY "Inventory Staff Read" ON public.inventory_items IS
  'College Admins can read practical-lab inventory only; Lab Assistants can read only assigned-lab inventory, including PC Lab when assigned.';
COMMENT ON POLICY "Staff Read Diagrams" ON storage.objects IS
  'Private diagram objects are readable only by active College Admins for public practical labs or assigned Lab Assistants for their assigned labs.';
