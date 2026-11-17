-- Shared serverless rate limiting for external resource validation.
-- The counter table is deliberately kept outside exposed API schemas and only
-- the server-side service_role may use the RPC.
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.resource_validation_rate_limits (
  subject_id uuid PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 1),
  updated_at timestamptz NOT NULL
);

ALTER TABLE private.resource_validation_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.resource_validation_rate_limits
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE private.resource_validation_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_resource_validation_rate_limit(
  p_subject uuid
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_request_count integer;
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'Rate-limit RPC is restricted to the server service role.'
      USING ERRCODE = '42501';
  END IF;

  IF p_subject IS NULL THEN
    RAISE EXCEPTION 'A staff subject is required.'
      USING ERRCODE = '22004';
  END IF;

  INSERT INTO private.resource_validation_rate_limits AS bucket (
    subject_id,
    window_started_at,
    request_count,
    updated_at
  )
  VALUES (p_subject, v_now, 1, v_now)
  ON CONFLICT (subject_id) DO UPDATE
  SET
    window_started_at = CASE
      WHEN bucket.window_started_at <= v_now - INTERVAL '60 seconds'
        THEN v_now
      ELSE bucket.window_started_at
    END,
    request_count = CASE
      WHEN bucket.window_started_at <= v_now - INTERVAL '60 seconds'
        THEN 1
      ELSE bucket.request_count + 1
    END,
    updated_at = v_now
  RETURNING request_count INTO v_request_count;

  RETURN v_request_count <= 30;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_resource_validation_rate_limit(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_resource_validation_rate_limit(uuid)
  TO service_role;

COMMENT ON FUNCTION public.consume_resource_validation_rate_limit(uuid) IS
  'Atomic, database-backed fixed-window limit: at most 30 external resource probes per active staff UUID per 60-second window. Callable only by service_role.';

-- Enforce the same 15 MB PDF-only rule that the staff upload form validates.
-- The manuals bucket remains private and object RLS continues to decide access.
UPDATE storage.buckets
SET
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['application/pdf']::text[]
WHERE id = 'manuals';

-- Close a cross-tenant edge case in the SECURITY DEFINER transaction RPC:
-- only staff belonging to the canonical MVIT institution may transact stock,
-- including unassigned (lab_id IS NULL) institution-level inventory.
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

  IF v_caller_inst_id IS DISTINCT FROM get_mvit_institution_id() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied: Only active MVIT staff may process inventory transactions');
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

COMMENT ON FUNCTION public.process_inventory_transaction(
  uuid, character varying, integer, character varying, character varying, character varying, text
) IS
  'Processes stock changes only for active MVIT staff, with assigned-lab checks and explicit College Admin exclusion from PC Lab inventory.';
