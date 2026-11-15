-- ==============================================================================
-- LABVERSE – REVOKE PROJECT DEFAULT DATA API GRANTS
-- Follow-up: fresh projects may otherwise inherit broad anon/authenticated grants.
-- ==============================================================================

-- Start from deny-by-default on all current public-schema tables.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Anonymous access is read-only and only for public learning portal data.
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

-- Authenticated application operations; table RLS policies remain the row-level boundary.
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

-- Student progress tracking is outside the LABVERSE public learning portal scope.
REVOKE ALL PRIVILEGES ON TABLE public.experiment_progress, public.progress_events FROM PUBLIC, anon, authenticated;

-- New tables and functions created by postgres must opt in to client exposure.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC, anon, authenticated;
