-- ==============================================================================
-- LABVERSE – MVIT FINAL PC LAB, COURSE MAPPING & ROLE PERMISSION REFINEMENT
-- Idempotent migration:
-- 1. Deduplicate Physical Science Lab (preserve PHYS-SCI-01 UUID, assignments, subjects, inventory)
-- 2. Enforce composite unique constraints & composite FKs for PC Lab computers + maintenance history
-- 3. Trigger syncing maintenance status updates to computer condition while preserving all history
-- 4. Strict PC Lab RLS separation: College Admin = SELECT ONLY; Assigned PC Lab Assistant = CRUD
-- 5. Public QR lookup strictly excludes PC Lab assets
-- 6. Safe starter experiment-to-course mappings only for unmapped legacy starter experiments
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PHYSICAL SCIENCE LAB DEDUPLICATION & PRESERVATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_inst_id UUID;
  v_canonical_psl_id UUID;
  v_dup RECORD;
BEGIN
  SELECT id INTO v_inst_id FROM public.institutions WHERE UPPER(code) = 'MVIT' LIMIT 1;
  IF v_inst_id IS NULL THEN
    RETURN;
  END IF;

  -- Prefer the original Physical Science Lab (PHYS-SCI-01), then earliest row by name
  SELECT id INTO v_canonical_psl_id
  FROM public.labs
  WHERE institution_id = v_inst_id
    AND (
      UPPER(lab_code) IN ('PHYS-SCI-01', 'PSL-01')
      OR LOWER(TRIM(name)) = 'physical science lab'
    )
  ORDER BY
    CASE
      WHEN UPPER(lab_code) = 'PHYS-SCI-01' THEN 0
      WHEN UPPER(lab_code) = 'PSL-01' THEN 2
      ELSE 1
    END,
    created_at ASC
  LIMIT 1;

  IF v_canonical_psl_id IS NOT NULL THEN
    -- Ensure canonical Physical Science Lab metadata & lab_type are accurate without changing its UUID or existing code
    UPDATE public.labs
    SET
      lab_type = 'practical',
      updated_at = NOW()
    WHERE id = v_canonical_psl_id
      AND COALESCE(lab_type, '') <> 'practical';

    -- If a second duplicate Physical Science Lab row was previously inserted (e.g., PSL-01 alongside PHYS-SCI-01),
    -- migrate all child mappings/records onto the canonical UUID and delete the empty duplicate row.
    FOR v_dup IN
      SELECT id
      FROM public.labs
      WHERE institution_id = v_inst_id
        AND id <> v_canonical_psl_id
        AND (
          UPPER(lab_code) IN ('PHYS-SCI-01', 'PSL-01')
          OR LOWER(TRIM(name)) = 'physical science lab'
        )
    LOOP
      -- Move lab-course links safely
      INSERT INTO public.laboratory_courses (institution_id, lab_id, course_id)
      SELECT institution_id, v_canonical_psl_id, course_id
      FROM public.laboratory_courses
      WHERE lab_id = v_dup.id
      ON CONFLICT (lab_id, course_id) DO NOTHING;
      DELETE FROM public.laboratory_courses WHERE lab_id = v_dup.id;

      -- Move profile lab assignments safely
      INSERT INTO public.profile_lab_assignments (profile_id, lab_id, institution_id)
      SELECT profile_id, v_canonical_psl_id, institution_id
      FROM public.profile_lab_assignments
      WHERE lab_id = v_dup.id
      ON CONFLICT (profile_id, lab_id) DO NOTHING;
      DELETE FROM public.profile_lab_assignments WHERE lab_id = v_dup.id;

      -- Move practical subjects, inventory items, and documents
      -- (experiments follow via practical_subjects.lab_id; inventory_transactions follow via inventory_items.lab_id)
      UPDATE public.practical_subjects SET lab_id = v_canonical_psl_id WHERE lab_id = v_dup.id;
      UPDATE public.inventory_items SET lab_id = v_canonical_psl_id WHERE lab_id = v_dup.id;
      UPDATE public.lab_manual_documents SET lab_id = v_canonical_psl_id WHERE lab_id = v_dup.id;

      -- Now safe to delete empty duplicate lab row
      DELETE FROM public.labs WHERE id = v_dup.id;
    END LOOP;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. COMPOSITE UNIQUE CONSTRAINTS & FOREIGN KEYS FOR PC LAB INTEGRITY
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'labs_institution_id_id_unique'
  ) THEN
    ALTER TABLE public.labs
      ADD CONSTRAINT labs_institution_id_id_unique UNIQUE (institution_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pc_lab_computers_inst_lab_id_unique'
  ) THEN
    ALTER TABLE public.pc_lab_computers
      ADD CONSTRAINT pc_lab_computers_inst_lab_id_unique UNIQUE (institution_id, lab_id, id);
  END IF;
END $$;

-- Ensure pc_lab_computers.(institution_id, lab_id) references labs.(institution_id, id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pc_lab_computers_inst_lab_fk'
  ) THEN
    ALTER TABLE public.pc_lab_computers
      ADD CONSTRAINT pc_lab_computers_inst_lab_fk
      FOREIGN KEY (institution_id, lab_id)
      REFERENCES public.labs(institution_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure pc_lab_maintenance_records shares exact (institution_id, lab_id, computer_id) with pc_lab_computers and labs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pc_lab_maintenance_inst_lab_fk'
  ) THEN
    ALTER TABLE public.pc_lab_maintenance_records
      ADD CONSTRAINT pc_lab_maintenance_inst_lab_fk
      FOREIGN KEY (institution_id, lab_id)
      REFERENCES public.labs(institution_id, id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pc_lab_maintenance_comp_scoped_fk'
  ) THEN
    ALTER TABLE public.pc_lab_maintenance_records
      ADD CONSTRAINT pc_lab_maintenance_comp_scoped_fk
      FOREIGN KEY (institution_id, lab_id, computer_id)
      REFERENCES public.pc_lab_computers(institution_id, lab_id, id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. INTEGRITY & HISTORY-PRESERVING CONDITION SYNC TRIGGERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_pc_lab_record_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mvit_id UUID;
  v_lab_type TEXT;
  v_comp_inst_id UUID;
  v_comp_lab_id UUID;
BEGIN
  v_mvit_id := public.get_mvit_institution_id();
  IF v_mvit_id IS NULL OR NEW.institution_id <> v_mvit_id THEN
    RAISE EXCEPTION 'PC Lab records must belong strictly to MVIT.';
  END IF;

  SELECT l.lab_type INTO v_lab_type
  FROM public.labs l
  WHERE l.id = NEW.lab_id AND l.institution_id = NEW.institution_id;

  IF v_lab_type IS NULL THEN
    RAISE EXCEPTION 'Target laboratory does not exist under MVIT.';
  END IF;

  IF v_lab_type <> 'pc_lab' THEN
    RAISE EXCEPTION 'PC workstation records may only belong to a PC Laboratory (lab_type = pc_lab).';
  END IF;

  IF TG_TABLE_NAME = 'pc_lab_maintenance_records' THEN
    SELECT c.institution_id, c.lab_id
    INTO v_comp_inst_id, v_comp_lab_id
    FROM public.pc_lab_computers c
    WHERE c.id = NEW.computer_id;

    IF v_comp_lab_id IS NULL OR v_comp_lab_id <> NEW.lab_id OR v_comp_inst_id <> NEW.institution_id THEN
      RAISE EXCEPTION 'Maintenance record must match the computer''s assigned laboratory and institution.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pc_computer_integrity ON public.pc_lab_computers;
CREATE TRIGGER trg_enforce_pc_computer_integrity
  BEFORE INSERT OR UPDATE ON public.pc_lab_computers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pc_lab_record_integrity();

DROP TRIGGER IF EXISTS trg_enforce_pc_maintenance_integrity ON public.pc_lab_maintenance_records;
CREATE TRIGGER trg_enforce_pc_maintenance_integrity
  BEFORE INSERT OR UPDATE ON public.pc_lab_maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_pc_lab_record_integrity();

CREATE OR REPLACE FUNCTION public.sync_pc_computer_condition_from_maintenance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_pc_status TEXT;
  v_next_maint_status TEXT;
BEGIN
  v_next_pc_status := CASE
    WHEN NEW.repair_status IN ('repaired', 'working') THEN 'working'
    WHEN NEW.repair_status = 'under_maintenance' THEN 'under_maintenance'
    ELSE 'defective'
  END;

  v_next_maint_status := CASE
    WHEN NEW.repair_status IN ('repaired', 'working') THEN 'operational'
    WHEN NEW.repair_status = 'under_maintenance' THEN 'in_repair'
    ELSE 'awaiting_service'
  END;

  UPDATE public.pc_lab_computers
  SET
    status = v_next_pc_status,
    maintenance_status = v_next_maint_status,
    last_updated = NOW(),
    updated_at = NOW()
  WHERE id = NEW.computer_id
    AND lab_id = NEW.lab_id
    AND institution_id = NEW.institution_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pc_condition_from_maintenance ON public.pc_lab_maintenance_records;
CREATE TRIGGER trg_sync_pc_condition_from_maintenance
  AFTER INSERT OR UPDATE OF repair_status, resolution_date, maintenance_remarks
  ON public.pc_lab_maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_pc_computer_condition_from_maintenance();

-- ------------------------------------------------------------------------------
-- 4. STRICT PC LAB ROLE PERMISSION SEPARATION (RLS)
-- College Admin: Read-only monitoring (SELECT only)
-- Assigned PC Lab Assistant: Full workstation & maintenance management (INSERT/UPDATE/DELETE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_pc_lab_assistant(p_inst_id UUID, p_lab_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.labs l ON l.id = p_lab_id AND l.institution_id = p_inst_id
    WHERE p.id = auth.uid()
      AND p.role = 'lab_assistant'
      AND p.status = 'active'
      AND p.institution_id = public.get_mvit_institution_id()
      AND p.institution_id = p_inst_id
      AND l.lab_type = 'pc_lab'
      AND l.status = 'active'
      AND public.has_lab_access(p_lab_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_pc_lab_assistant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pc_lab_assistant(UUID, UUID) TO authenticated;

-- Replace permissive FOR ALL policies on pc_lab_computers
DROP POLICY IF EXISTS "Staff manage assigned PC lab computers" ON public.pc_lab_computers;
DROP POLICY IF EXISTS "Admin and PC Lab Assistant view PC lab computers" ON public.pc_lab_computers;
DROP POLICY IF EXISTS "PC Lab Assistant insert computers" ON public.pc_lab_computers;
DROP POLICY IF EXISTS "PC Lab Assistant update computers" ON public.pc_lab_computers;
DROP POLICY IF EXISTS "PC Lab Assistant delete computers" ON public.pc_lab_computers;

CREATE POLICY "Admin and PC Lab Assistant view PC lab computers"
  ON public.pc_lab_computers
  FOR SELECT TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND (
      public.is_college_admin(institution_id)
      OR public.is_pc_lab_assistant(institution_id, lab_id)
    )
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

-- Replace permissive FOR ALL policies on pc_lab_maintenance_records
DROP POLICY IF EXISTS "Staff manage assigned PC lab maintenance" ON public.pc_lab_maintenance_records;
DROP POLICY IF EXISTS "Admin and PC Lab Assistant view PC maintenance" ON public.pc_lab_maintenance_records;
DROP POLICY IF EXISTS "PC Lab Assistant insert maintenance" ON public.pc_lab_maintenance_records;
DROP POLICY IF EXISTS "PC Lab Assistant update maintenance" ON public.pc_lab_maintenance_records;

CREATE POLICY "Admin and PC Lab Assistant view PC maintenance"
  ON public.pc_lab_maintenance_records
  FOR SELECT TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND (
      public.is_college_admin(institution_id)
      OR public.is_pc_lab_assistant(institution_id, lab_id)
    )
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

-- ------------------------------------------------------------------------------
-- 5. HARDEN PUBLIC QR LOOKUP TO EXCLUDE PC LAB INTERNAL ASSETS
-- ------------------------------------------------------------------------------
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
    AND (l.id IS NULL OR (l.status = 'active' AND COALESCE(l.lab_type, 'practical') <> 'pc_lab'))
    AND (
      i.id::TEXT = TRIM(p_identifier)
      OR UPPER(i.item_code) = UPPER(TRIM(p_identifier))
    )
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_public_inventory_qr(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_inventory_qr(TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 6. SAFE EXPERIMENT-TO-COURSE MAPPING BACKFILL FOR EXISTING MVIT STARTER EXPERIMENTS
-- Only maps known starter experiments that currently have zero rows in experiment_courses.
-- Does NOT auto-assign newly created or unknown experiments to every course.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_inst_id UUID;
  v_course_ece UUID;
  v_course_eee UUID;
  v_course_cse UUID;
  v_course_it UUID;
  v_course_mech UUID;
BEGIN
  SELECT id INTO v_inst_id FROM public.institutions WHERE UPPER(code) = 'MVIT' LIMIT 1;
  IF v_inst_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_course_ece FROM public.courses WHERE institution_id = v_inst_id AND code = 'ECE' LIMIT 1;
  SELECT id INTO v_course_eee FROM public.courses WHERE institution_id = v_inst_id AND code = 'EEE' LIMIT 1;
  SELECT id INTO v_course_cse FROM public.courses WHERE institution_id = v_inst_id AND code = 'CSE' LIMIT 1;
  SELECT id INTO v_course_it FROM public.courses WHERE institution_id = v_inst_id AND code = 'IT' LIMIT 1;
  SELECT id INTO v_course_mech FROM public.courses WHERE institution_id = v_inst_id AND code = 'MECH' LIMIT 1;

  -- Electronics / Circuit experiments -> ECE, EEE
  INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
  SELECT v_inst_id, e.id, c.id
  FROM public.experiments e
  JOIN public.courses c ON c.id IN (v_course_ece, v_course_eee)
  WHERE e.institution_id = v_inst_id
    AND (
      LOWER(e.title) LIKE '%pn junction%'
      OR LOWER(e.title) LIKE '%ohm%'
      OR LOWER(e.title) LIKE '%logic gate%'
    )
    AND NOT EXISTS (SELECT 1 FROM public.experiment_courses ec WHERE ec.experiment_id = e.id)
  ON CONFLICT (experiment_id, course_id) DO NOTHING;

  -- Simple Pendulum -> ECE, CSE, IT, MECH
  INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
  SELECT v_inst_id, e.id, c.id
  FROM public.experiments e
  JOIN public.courses c ON c.id IN (v_course_ece, v_course_cse, v_course_it, v_course_mech)
  WHERE e.institution_id = v_inst_id
    AND LOWER(e.title) LIKE '%pendulum%'
    AND NOT EXISTS (SELECT 1 FROM public.experiment_courses ec WHERE ec.experiment_id = e.id)
  ON CONFLICT (experiment_id, course_id) DO NOTHING;

  -- Vernier Calipers -> MECH, ECE
  INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
  SELECT v_inst_id, e.id, c.id
  FROM public.experiments e
  JOIN public.courses c ON c.id IN (v_course_mech, v_course_ece)
  WHERE e.institution_id = v_inst_id
    AND LOWER(e.title) LIKE '%vernier%'
    AND NOT EXISTS (SELECT 1 FROM public.experiment_courses ec WHERE ec.experiment_id = e.id)
  ON CONFLICT (experiment_id, course_id) DO NOTHING;

  -- pH Meter -> CSE, IT, EEE
  INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
  SELECT v_inst_id, e.id, c.id
  FROM public.experiments e
  JOIN public.courses c ON c.id IN (v_course_cse, v_course_it, v_course_eee)
  WHERE e.institution_id = v_inst_id
    AND LOWER(e.title) LIKE '%ph %'
    AND NOT EXISTS (SELECT 1 FROM public.experiment_courses ec WHERE ec.experiment_id = e.id)
  ON CONFLICT (experiment_id, course_id) DO NOTHING;

  -- Communication / Phonetics -> CSE, IT, ECE, MECH
  INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
  SELECT v_inst_id, e.id, c.id
  FROM public.experiments e
  JOIN public.courses c ON c.id IN (v_course_cse, v_course_it, v_course_ece, v_course_mech)
  WHERE e.institution_id = v_inst_id
    AND (LOWER(e.title) LIKE '%phonetic%' OR LOWER(e.title) LIKE '%communication%')
    AND NOT EXISTS (SELECT 1 FROM public.experiment_courses ec WHERE ec.experiment_id = e.id)
  ON CONFLICT (experiment_id, course_id) DO NOTHING;
END $$;
