-- ==============================================================================
-- LABVERSE – TIGHTEN STORAGE BUCKET & LAB MANUAL DOCUMENT RLS POLICIES
-- ==============================================================================
-- Guarantees:
--   1. Switches the 'manuals' storage bucket from public = true to private
--      (public = false) so unauthenticated /object/public/ guesses cannot bypass RLS.
--   2. Replaces permissive "Public Read Manuals" (bucket_id = 'manuals') with
--      strict published + public-lab checks via storage_path / lab_manual_documents.
--   3. Scopes Storage & lab_manual_documents access for College Admin away from
--      internal / PC Lab (lab_type = 'pc_lab' OR is_public = false) records while
--      preserving full access for the assigned Lab Assistant of each lab.
-- ==============================================================================

-- 1. Enforce private storage on the manuals bucket
UPDATE storage.buckets
SET public = false
WHERE id = 'manuals';

-- 2. Helper: Can anonymous/public callers read this manual object from storage?
CREATE OR REPLACE FUNCTION public.is_public_manual_object(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, storage, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lab_manual_documents d
    LEFT JOIN public.practical_subjects ps ON ps.id = d.subject_id
    WHERE d.is_published = true
      AND (
        d.storage_path = p_object_name
        OR d.file_url LIKE '%' || p_object_name || '%'
      )
      AND public.is_public_lab(
        COALESCE(
          d.lab_id,
          ps.lab_id,
          public.storage_path_lab_id(p_object_name)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_manual_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_manual_object(TEXT) TO anon, authenticated;

-- 3. Helper: Can authenticated MVIT staff read or manage this manual object or lab?
--    - Assigned active lab_assistant (via profile_lab_assignments) -> yes for their assigned lab
--    - Active college_admin -> yes ONLY for non-PC-Lab / public MVIT laboratories
CREATE OR REPLACE FUNCTION public.can_staff_access_lab_manuals(p_lab_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.labs l ON l.id = p_lab_id AND l.institution_id = p.institution_id
    WHERE p.id = auth.uid()
      AND p.status = 'active'
      AND p.institution_id = public.get_mvit_institution_id()
      AND (
        (
          p.role = 'college_admin'
          AND l.is_public = true
          AND COALESCE(l.lab_type, 'practical') <> 'pc_lab'
        )
        OR (
          p.role = 'lab_assistant'
          AND l.status = 'active'
          AND EXISTS (
            SELECT 1
            FROM public.profile_lab_assignments pla
            WHERE pla.profile_id = p.id
              AND pla.lab_id = l.id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_staff_access_lab_manuals(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_staff_access_lab_manuals(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_staff_access_manual_object(p_object_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, storage, pg_temp
AS $$
  SELECT COALESCE(
    public.can_staff_access_lab_manuals(public.storage_path_lab_id(p_object_name)),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.can_staff_access_manual_object(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_staff_access_manual_object(TEXT) TO authenticated;

-- 4. Tighten public.lab_manual_documents RLS policies (prevent College Admin reading/writing PC Lab manuals)
DROP POLICY IF EXISTS "Staff read MVIT lab manuals" ON public.lab_manual_documents;
DROP POLICY IF EXISTS "Manuals Staff Write" ON public.lab_manual_documents;
DROP POLICY IF EXISTS "Manuals Staff Insert" ON public.lab_manual_documents;
DROP POLICY IF EXISTS "Manuals Staff Update" ON public.lab_manual_documents;
DROP POLICY IF EXISTS "Manuals Staff Delete" ON public.lab_manual_documents;

CREATE POLICY "Staff read MVIT lab manuals"
  ON public.lab_manual_documents
  FOR SELECT TO authenticated
  USING (
    (
      is_published = true
      AND public.is_public_lab(
        COALESCE(
          lab_id,
          (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
        )
      )
    )
    OR public.can_staff_access_lab_manuals(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  );

CREATE POLICY "Manuals Staff Insert"
  ON public.lab_manual_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = public.get_mvit_institution_id()
    AND public.can_staff_access_lab_manuals(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  );

CREATE POLICY "Manuals Staff Update"
  ON public.lab_manual_documents
  FOR UPDATE TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.can_staff_access_lab_manuals(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  )
  WITH CHECK (
    institution_id = public.get_mvit_institution_id()
    AND public.can_staff_access_lab_manuals(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  );

CREATE POLICY "Manuals Staff Delete"
  ON public.lab_manual_documents
  FOR DELETE TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.can_staff_access_lab_manuals(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  );

-- 5. Replace overly broad storage.objects policies for 'manuals' bucket
DROP POLICY IF EXISTS "Public Read Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Published Public Read Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Staff Read Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Staff Upload Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Staff Update Manuals" ON storage.objects;
DROP POLICY IF EXISTS "Staff Delete Manuals" ON storage.objects;

CREATE POLICY "Published Public Read Manuals"
  ON storage.objects
  FOR SELECT TO anon
  USING (
    bucket_id = 'manuals'
    AND public.is_public_manual_object(name)
  );

CREATE POLICY "Staff Read Manuals"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'manuals'
    AND (
      public.is_public_manual_object(name)
      OR public.can_staff_access_manual_object(name)
    )
  );

CREATE POLICY "Staff Upload Manuals"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'manuals'
    AND public.can_staff_access_manual_object(name)
  );

CREATE POLICY "Staff Update Manuals"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'manuals'
    AND public.can_staff_access_manual_object(name)
  )
  WITH CHECK (
    bucket_id = 'manuals'
    AND public.can_staff_access_manual_object(name)
  );

CREATE POLICY "Staff Delete Manuals"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'manuals'
    AND public.can_staff_access_manual_object(name)
  );
