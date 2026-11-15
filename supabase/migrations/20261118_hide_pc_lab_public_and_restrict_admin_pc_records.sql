-- ==============================================================================
-- LABVERSE – HIDE PC LAB FROM PUBLIC USERS & RESTRICT ADMIN COMPUTER VISIBILITY
-- ==============================================================================
-- Guarantees:
--   1. Adds `is_public BOOLEAN NOT NULL DEFAULT TRUE` on public.labs without
--      deleting any existing PC Lab, computer, maintenance, or audit records.
--   2. Marks COMP-PC-01 / lab_type = 'pc_lab' as is_public = FALSE.
--   3. Blocks anon/public API queries from reading non-public / PC labs and any
--      linked courses, subjects, experiments, manuals, or QR lookups.
--   4. Restricts SELECT/INSERT/UPDATE/DELETE on pc_lab_computers and
--      pc_lab_maintenance_records STRICTLY to the assigned PC Lab Assistant
--      (removing College Admin read access to individual computer records).
-- ==============================================================================

-- 1. Add non-destructive visibility flag to public.labs
ALTER TABLE public.labs
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.labs
SET is_public = FALSE
WHERE lab_type = 'pc_lab'
   OR UPPER(lab_code) LIKE 'COMP-PC%'
   OR UPPER(lab_code) LIKE 'PC-%';

CREATE INDEX IF NOT EXISTS idx_labs_public_active
  ON public.labs(institution_id, status, is_public);

-- 2. Helper: check whether a laboratory is active and publicly visible
CREATE OR REPLACE FUNCTION public.is_public_lab(p_lab_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.labs l
    JOIN public.institutions inst ON inst.id = l.institution_id
    WHERE l.id = p_lab_id
      AND UPPER(inst.code) = 'MVIT'
      AND inst.active = true
      AND l.status = 'active'
      AND l.is_public = true
      AND COALESCE(l.lab_type, 'practical') <> 'pc_lab'
  );
$$;

REVOKE ALL ON FUNCTION public.is_public_lab(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_public_lab(UUID) TO anon, authenticated;

-- 3. Harden public.labs SELECT policies (hide internal / PC Labs from anon)
DROP POLICY IF EXISTS "Labs Read Policy" ON public.labs;
DROP POLICY IF EXISTS "Public read active public MVIT labs" ON public.labs;
DROP POLICY IF EXISTS "Staff read MVIT labs" ON public.labs;

CREATE POLICY "Public read active public MVIT labs"
  ON public.labs
  FOR SELECT TO anon
  USING (
    status = 'active'
    AND is_public = true
    AND COALESCE(lab_type, 'practical') <> 'pc_lab'
  );

CREATE POLICY "Staff read MVIT labs"
  ON public.labs
  FOR SELECT TO authenticated
  USING (
    public.is_college_admin(institution_id)
    OR public.has_lab_access(id)
    OR (
      status = 'active'
      AND is_public = true
      AND COALESCE(lab_type, 'practical') <> 'pc_lab'
    )
  );

-- 4. Harden laboratory_courses SELECT policy for anon (hide PC Lab course mappings publicly)
DROP POLICY IF EXISTS "Public read active MVIT lab courses" ON public.laboratory_courses;
CREATE POLICY "Public read active MVIT lab courses"
  ON public.laboratory_courses
  FOR SELECT TO anon
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.is_public_lab(lab_id)
  );

-- 5. Harden practical_subjects, experiments & manuals so anon never reads items tied to non-public labs
DROP POLICY IF EXISTS "Public Read Active Subjects" ON public.practical_subjects;
DROP POLICY IF EXISTS "Public read active public subjects" ON public.practical_subjects;
DROP POLICY IF EXISTS "Staff read MVIT subjects" ON public.practical_subjects;

CREATE POLICY "Public read active public subjects"
  ON public.practical_subjects
  FOR SELECT TO anon
  USING (
    is_active = true
    AND (lab_id IS NULL OR public.is_public_lab(lab_id))
  );

CREATE POLICY "Staff read MVIT subjects"
  ON public.practical_subjects
  FOR SELECT TO authenticated
  USING (
    (is_active = true AND (lab_id IS NULL OR public.is_public_lab(lab_id)))
    OR public.is_college_admin(institution_id)
    OR (lab_id IS NOT NULL AND public.has_lab_access(lab_id))
  );

DROP POLICY IF EXISTS "Public Read Published Experiments" ON public.experiments;
DROP POLICY IF EXISTS "Public read published public experiments" ON public.experiments;
DROP POLICY IF EXISTS "Staff read MVIT experiments" ON public.experiments;

CREATE POLICY "Public read published public experiments"
  ON public.experiments
  FOR SELECT TO anon
  USING (
    is_published = true
    AND EXISTS (
      SELECT 1
      FROM public.practical_subjects ps
      WHERE ps.id = experiments.subject_id
        AND ps.is_active = true
        AND (ps.lab_id IS NULL OR public.is_public_lab(ps.lab_id))
    )
  );

CREATE POLICY "Staff read MVIT experiments"
  ON public.experiments
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.is_college_admin(institution_id)
    OR EXISTS (
      SELECT 1
      FROM public.practical_subjects ps
      WHERE ps.id = experiments.subject_id
        AND ps.lab_id IS NOT NULL
        AND public.has_lab_access(ps.lab_id)
    )
  );

DROP POLICY IF EXISTS "Public Read Published Lab Manuals" ON public.lab_manual_documents;
DROP POLICY IF EXISTS "Public read published public lab manuals" ON public.lab_manual_documents;
DROP POLICY IF EXISTS "Staff read MVIT lab manuals" ON public.lab_manual_documents;

CREATE POLICY "Public read published public lab manuals"
  ON public.lab_manual_documents
  FOR SELECT TO anon
  USING (
    is_published = true
    AND (
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      ) IS NULL
      OR public.is_public_lab(
        COALESCE(
          lab_id,
          (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
        )
      )
    )
  );

CREATE POLICY "Staff read MVIT lab manuals"
  ON public.lab_manual_documents
  FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.is_college_admin(institution_id)
    OR public.has_lab_access(
      COALESCE(
        lab_id,
        (SELECT ps.lab_id FROM public.practical_subjects ps WHERE ps.id = lab_manual_documents.subject_id)
      )
    )
  );

-- 6. Restrict PC Lab computer & maintenance records STRICTLY to the assigned PC Lab Assistant
--    (College Admin MUST NOT view or query individual computers, hostnames, specs, defects, or repair logs)
DROP POLICY IF EXISTS "Admin and PC Lab Assistant view PC lab computers" ON public.pc_lab_computers;
DROP POLICY IF EXISTS "PC Lab Assistant view computers" ON public.pc_lab_computers;
DROP POLICY IF EXISTS "PC Lab Assistant insert computers" ON public.pc_lab_computers;
DROP POLICY IF EXISTS "PC Lab Assistant update computers" ON public.pc_lab_computers;
DROP POLICY IF EXISTS "PC Lab Assistant delete computers" ON public.pc_lab_computers;

CREATE POLICY "PC Lab Assistant view computers"
  ON public.pc_lab_computers
  FOR SELECT TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  );

CREATE POLICY "PC Lab Assistant insert computers"
  ON public.pc_lab_computers
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  );

CREATE POLICY "PC Lab Assistant update computers"
  ON public.pc_lab_computers
  FOR UPDATE TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  )
  WITH CHECK (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  );

CREATE POLICY "PC Lab Assistant delete computers"
  ON public.pc_lab_computers
  FOR DELETE TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  );

DROP POLICY IF EXISTS "Admin and PC Lab Assistant view PC maintenance" ON public.pc_lab_maintenance_records;
DROP POLICY IF EXISTS "PC Lab Assistant view maintenance" ON public.pc_lab_maintenance_records;
DROP POLICY IF EXISTS "PC Lab Assistant insert maintenance" ON public.pc_lab_maintenance_records;
DROP POLICY IF EXISTS "PC Lab Assistant update maintenance" ON public.pc_lab_maintenance_records;
DROP POLICY IF EXISTS "PC Lab Assistant delete maintenance" ON public.pc_lab_maintenance_records;

CREATE POLICY "PC Lab Assistant view maintenance"
  ON public.pc_lab_maintenance_records
  FOR SELECT TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  );

CREATE POLICY "PC Lab Assistant insert maintenance"
  ON public.pc_lab_maintenance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  );

CREATE POLICY "PC Lab Assistant update maintenance"
  ON public.pc_lab_maintenance_records
  FOR UPDATE TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  )
  WITH CHECK (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  );

CREATE POLICY "PC Lab Assistant delete maintenance"
  ON public.pc_lab_maintenance_records
  FOR DELETE TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND public.is_pc_lab_assistant(institution_id, lab_id)
  );

-- 7. Update public QR lookup RPC to enforce is_public = true as well as lab_type <> 'pc_lab'
CREATE OR REPLACE FUNCTION public.lookup_public_inventory_qr(p_identifier TEXT)
RETURNS TABLE (
  id UUID,
  institution_id UUID,
  lab_id UUID,
  laboratory_name VARCHAR,
  laboratory_code VARCHAR,
  department_id UUID,
  department_name VARCHAR,
  item_code VARCHAR,
  name VARCHAR,
  category VARCHAR,
  location VARCHAR,
  unit VARCHAR,
  quantity_available INT,
  quantity_total INT,
  availability_status TEXT
) LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp AS $$
  SELECT
    i.id,
    i.institution_id,
    i.lab_id,
    l.name AS laboratory_name,
    l.lab_code AS laboratory_code,
    i.department_id,
    d.name AS department_name,
    i.item_code,
    i.name,
    i.category,
    i.location,
    i.unit,
    i.quantity_available,
    i.quantity_total,
    CASE
      WHEN i.quantity_available <= 0 THEN 'out_of_stock'
      WHEN i.quantity_available <= i.min_safety_threshold THEN 'low_stock'
      ELSE 'in_stock'
    END AS availability_status
  FROM public.inventory_items i
  JOIN public.institutions inst ON inst.id = i.institution_id
  LEFT JOIN public.labs l ON l.id = i.lab_id
  LEFT JOIN public.departments d ON d.id = i.department_id
  WHERE UPPER(inst.code) = 'MVIT'
    AND inst.active = true
    AND (
      l.id IS NULL
      OR (
        l.status = 'active'
        AND l.is_public = true
        AND COALESCE(l.lab_type, 'practical') <> 'pc_lab'
      )
    )
    AND (
      i.id::TEXT = TRIM(p_identifier)
      OR UPPER(i.item_code) = UPPER(TRIM(p_identifier))
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_public_inventory_qr(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_inventory_qr(TEXT) TO anon, authenticated;
