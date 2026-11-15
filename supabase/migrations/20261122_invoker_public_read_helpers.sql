-- ==============================================================================
-- LABVERSE – REDUCE ELEVATED PRIVILEGES FOR PUBLIC READ HELPERS
-- ==============================================================================

-- These read helpers only query tables already visible under caller RLS.
ALTER FUNCTION public.get_mvit_institution_id() SECURITY INVOKER;
ALTER FUNCTION public.is_public_lab(UUID) SECURITY INVOKER;

-- Public visitors only see the current term. Signed-in staff may also see inactive terms.
DROP POLICY IF EXISTS "Public Read Active Terms" ON public.academic_terms;
CREATE POLICY "Public Read Active Terms"
  ON public.academic_terms
  FOR SELECT
  TO anon
  USING (is_current = true);

CREATE POLICY "Staff Read Active Terms"
  ON public.academic_terms
  FOR SELECT
  TO authenticated
  USING (is_current = true OR public.is_institution_staff(institution_id));

-- The staff check is no longer required in anonymous policy evaluation.
REVOKE EXECUTE ON FUNCTION public.is_institution_staff(UUID) FROM anon;
