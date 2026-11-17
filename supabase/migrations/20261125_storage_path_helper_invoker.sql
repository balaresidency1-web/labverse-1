-- ==============================================================================
-- LABVERSE – MAKE STORAGE PATH PARSER AN INVOKER HELPER
-- ==============================================================================

-- This function only parses a UUID from a path segment; it does not need elevated
-- privileges or to bypass row-level security.
ALTER FUNCTION public.storage_path_lab_id(text) SECURITY INVOKER;

REVOKE EXECUTE ON FUNCTION public.storage_path_lab_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storage_path_lab_id(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.storage_path_lab_id(text) IS
  'SECURITY INVOKER: parses a lab UUID segment from a storage object path; it does not read or modify protected data.';
