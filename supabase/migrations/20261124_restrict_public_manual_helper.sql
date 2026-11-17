-- ==============================================================================
-- LABVERSE – RESTRICT PUBLISHED MANUAL HELPER PRIVILEGES
-- ==============================================================================

-- Run published-manual access checks as the caller so public-row RLS applies.
ALTER FUNCTION public.is_public_manual_object(text) SECURITY INVOKER;

-- These two RPCs remain intentionally callable for their limited public workflows.
-- Remove the implicit PUBLIC grant and retain explicit, scoped application roles.
REVOKE EXECUTE ON FUNCTION public.is_public_manual_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_manual_object(text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.lookup_public_inventory_qr(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_inventory_qr(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.is_public_manual_object(text) IS
  'SECURITY INVOKER: validates public manual object paths using caller-visible published public manual rows and existing RLS policies.';

COMMENT ON FUNCTION public.lookup_public_inventory_qr(text) IS
  'Intentional public QR lookup. SECURITY DEFINER is retained because anonymous users must not query inventory_items directly; function filters to active MVIT public non-PC labs and returns only the public QR field projection.';
