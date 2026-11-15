-- ==============================================================================
-- LABVERSE – DATA API GRANTS, STAFF-ONLY POLICY ROLES & FUNCTION ACL HARDENING
-- Follow-up for fresh Supabase projects where Data API grants are opt-in.
-- All public reads remain policy-filtered; privileged writes require authenticated staff.
-- ==============================================================================

-- 1. Explicitly scope all write/manage policies to authenticated staff.
ALTER POLICY "Academic Terms College Admin Manage" ON public.academic_terms TO authenticated;
ALTER POLICY "Departments College Admin Manage" ON public.departments TO authenticated;
ALTER POLICY "Experiments Staff Write" ON public.experiments TO authenticated;
ALTER POLICY "Labs College Admin Delete" ON public.labs TO authenticated;
ALTER POLICY "Labs College Admin Insert" ON public.labs TO authenticated;
ALTER POLICY "Labs College Admin Update" ON public.labs TO authenticated;
ALTER POLICY "Subjects Staff Write" ON public.practical_subjects TO authenticated;
ALTER POLICY "Lab Assignments Admin Manage" ON public.profile_lab_assignments TO authenticated;
ALTER POLICY "Lab Assignments Assistant Read" ON public.profile_lab_assignments TO authenticated;
ALTER POLICY "Profiles College Admin Insert" ON public.profiles TO authenticated;
ALTER POLICY "Profiles College Admin Update" ON public.profiles TO authenticated;
ALTER POLICY "Profiles Same Institution Read" ON public.profiles TO authenticated;
ALTER POLICY "Profiles Self Update" ON public.profiles TO authenticated;
ALTER POLICY "Syllabus Staff Write" ON public.subject_syllabuses TO authenticated;

-- 2. Explicit Data API grants (required for projects created after the 2026-10-30
--    default change). Public clients receive SELECT only on learning-portal data.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON TABLE
  public.institutions,
  public.departments,
  public.academic_terms,
  public.labs,
  public.courses,
  public.laboratory_courses,
  public.practical_subjects,
  public.subject_syllabuses,
  public.experiments,
  public.experiment_courses,
  public.experiment_resources,
  public.lab_manual_documents
TO anon;

-- Staff privileges are still constrained by each table's RLS policies.
GRANT SELECT ON TABLE public.institutions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.departments,
  public.academic_terms,
  public.labs,
  public.courses,
  public.laboratory_courses,
  public.practical_subjects,
  public.subject_syllabuses,
  public.experiments,
  public.experiment_courses,
  public.experiment_resources,
  public.lab_manual_documents,
  public.profile_lab_assignments,
  public.inventory_items,
  public.notifications,
  public.pc_lab_computers,
  public.pc_lab_maintenance_records
TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT ON TABLE public.inventory_transactions TO authenticated;
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

-- Deprecated student progress tables stay closed; do not reintroduce student tracking.
REVOKE ALL ON TABLE public.experiment_progress, public.progress_events FROM anon, authenticated;

-- 3. Remove default PUBLIC/anonymous function execution and explicitly grant only
--    policy helpers / staff RPCs required by the application.
REVOKE EXECUTE ON FUNCTION public.activate_own_invited_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_lab_assistant(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_staff_access_lab_manuals(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_staff_access_manual_object(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_pc_lab_record_integrity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_auth_institution_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_mvit_institution_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_lab_access(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_college_admin(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_institution_staff(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_pc_lab_assistant(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_public_lab(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_public_manual_object(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_public_inventory_qr(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_inventory_transaction(UUID, VARCHAR, INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_assistant_lab_assignments(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.storage_path_lab_id(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_pc_computer_condition_from_maintenance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_lab_deletion_with_records() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_immutable_columns() FROM PUBLIC, anon, authenticated;

-- Read-only policy helpers needed by anonymous learning-portal policies and public QR.
GRANT EXECUTE ON FUNCTION public.get_mvit_institution_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_institution_staff(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_lab(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_public_manual_object(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_public_inventory_qr(TEXT) TO anon, authenticated;

-- Authenticated staff helpers and protected management RPCs.
GRANT EXECUTE ON FUNCTION public.activate_own_invited_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_lab_assistant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_staff_access_lab_manuals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_staff_access_manual_object(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_institution_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_lab_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_college_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pc_lab_assistant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_inventory_transaction(UUID, VARCHAR, INTEGER, VARCHAR, VARCHAR, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_assistant_lab_assignments(UUID, UUID[]) TO authenticated;

-- Trigger-only routines must not be exposed as RPC endpoints.
ALTER FUNCTION public.prevent_lab_deletion_with_records() SET search_path = public, pg_temp;
