-- Shared serverless rate limiting for external resource validation.
-- The counter table is deliberately kept outside exposed API schemas and only
-- the server-side service_role may use the RPC.
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.staff_invitation_rate_limits (
  subject_id uuid PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL CHECK (request_count >= 1),
  updated_at timestamptz NOT NULL
);

ALTER TABLE private.staff_invitation_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.staff_invitation_rate_limits
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE private.staff_invitation_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_staff_invitation_rate_limit(
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

  INSERT INTO private.staff_invitation_rate_limits AS bucket (
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
      ELSE LEAST(bucket.request_count + 1, 6)
    END,
    updated_at = v_now
  RETURNING request_count INTO v_request_count;

  RETURN v_request_count <= 5;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_staff_invitation_rate_limit(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_staff_invitation_rate_limit(uuid)
  TO service_role;

COMMENT ON FUNCTION public.consume_staff_invitation_rate_limit(uuid) IS
  'Atomic, database-backed fixed-window limit: at most 5 staff invitations per active staff UUID per 60-second window. Callable only by service_role.';


-- Future uploads only; existing documents and all object policies are preserved.
UPDATE storage.buckets SET file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif','application/pdf']::text[]
WHERE id = 'diagrams';
