-- ==============================================================================
-- LABVERSE – MVIT: PC LABORATORY MODULE & COURSE-DRIVEN LEARNING WORKFLOW
-- Migration: 20261115_pc_lab_and_course_learning_workflow.sql
--
-- Extends MVIT's single-college schema WITHOUT altering existing institution UUIDs,
-- existing RLS security helpers, or breaking existing tables:
--   1. labs.lab_type ('practical' | 'pc_lab')
--   2. courses, laboratory_courses, experiment_courses, experiment_resources
--   3. pc_lab_computers & pc_lab_maintenance_records (STRICTLY STAFF-ONLY RLS; ZERO ANON ACCESS)
--   4. Deletion guard extension so PC Labs with computer records cannot be permanently deleted
--   5. Idempotent MVIT course, laboratory, and course-mapping seed data
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND LABS WITH LAB_TYPE
-- ------------------------------------------------------------------------------
ALTER TABLE public.labs
  ADD COLUMN IF NOT EXISTS lab_type VARCHAR(20) NOT NULL DEFAULT 'practical'
  CHECK (lab_type IN ('practical', 'pc_lab'));

CREATE INDEX IF NOT EXISTS idx_labs_lab_type ON public.labs(institution_id, lab_type);

-- ------------------------------------------------------------------------------
-- 2. COURSES & LABORATORY-COURSE / EXPERIMENT-COURSE MAPPINGS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  degree VARCHAR(80) NOT NULL DEFAULT 'B.Tech',
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, code)
);

CREATE TABLE IF NOT EXISTS public.laboratory_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lab_id, course_id)
);

CREATE TABLE IF NOT EXISTS public.experiment_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES public.experiments(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(experiment_id, course_id)
);

ALTER TABLE public.practical_subjects
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.experiment_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL REFERENCES public.experiments(id) ON DELETE CASCADE,
  resource_type VARCHAR(30) NOT NULL CHECK (resource_type IN ('manual_pdf', 'youtube', 'bench_twin')),
  title VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_inst ON public.courses(institution_id, display_order);
CREATE INDEX IF NOT EXISTS idx_lab_courses_lab ON public.laboratory_courses(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_courses_course ON public.laboratory_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_exp_courses_exp ON public.experiment_courses(experiment_id);
CREATE INDEX IF NOT EXISTS idx_exp_courses_course ON public.experiment_courses(course_id);
CREATE INDEX IF NOT EXISTS idx_exp_resources_exp ON public.experiment_resources(experiment_id);

-- ------------------------------------------------------------------------------
-- 3. PC LABORATORY MODULE (WORKING, DEFECTIVE/MAINTENANCE & SEPARATE STAFF COMPUTERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pc_lab_computers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE RESTRICT,
  computer_code VARCHAR(60) NOT NULL,
  hostname VARCHAR(120) NOT NULL DEFAULT '',
  computer_type VARCHAR(30) NOT NULL DEFAULT 'student_computer'
    CHECK (computer_type IN ('student_computer', 'staff_computer')),
  processor VARCHAR(160) DEFAULT '',
  ram VARCHAR(80) DEFAULT '',
  storage VARCHAR(80) DEFAULT '',
  operating_system VARCHAR(120) DEFAULT '',
  location VARCHAR(160) NOT NULL DEFAULT 'PC Lab',
  assigned_staff_name VARCHAR(160) DEFAULT '',
  assigned_department VARCHAR(160) DEFAULT '',
  specs_summary TEXT DEFAULT '',
  status VARCHAR(30) NOT NULL DEFAULT 'working'
    CHECK (status IN ('working', 'defective', 'under_maintenance', 'repaired')),
  maintenance_status VARCHAR(40) DEFAULT 'operational',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(institution_id, computer_code)
);

CREATE TABLE IF NOT EXISTS public.pc_lab_maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  lab_id UUID NOT NULL REFERENCES public.labs(id) ON DELETE RESTRICT,
  computer_id UUID NOT NULL REFERENCES public.pc_lab_computers(id) ON DELETE CASCADE,
  reported_issue VARCHAR(255) NOT NULL,
  defect_description TEXT DEFAULT '',
  date_reported DATE NOT NULL DEFAULT CURRENT_DATE,
  repair_status VARCHAR(30) NOT NULL DEFAULT 'defective'
    CHECK (repair_status IN ('defective', 'under_maintenance', 'repaired', 'working')),
  maintenance_remarks TEXT DEFAULT '',
  resolution_date DATE,
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pc_computers_inst_lab ON public.pc_lab_computers(institution_id, lab_id);
CREATE INDEX IF NOT EXISTS idx_pc_computers_type_status ON public.pc_lab_computers(computer_type, status);
CREATE INDEX IF NOT EXISTS idx_pc_maint_computer ON public.pc_lab_maintenance_records(computer_id, date_reported DESC);
CREATE INDEX IF NOT EXISTS idx_pc_maint_lab_status ON public.pc_lab_maintenance_records(lab_id, repair_status);

-- ------------------------------------------------------------------------------
-- 4. EXTEND LAB DELETION GUARD TO PROTECT PC LAB RECORDS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_lab_deletion_with_records()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.practical_subjects WHERE lab_id = OLD.id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot permanently delete laboratory: % practical subjects are linked to this lab. Deactivate the lab instead.', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.inventory_items WHERE lab_id = OLD.id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot permanently delete laboratory: % inventory items are linked to this lab. Deactivate the lab instead.', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.lab_manual_documents WHERE lab_id = OLD.id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot permanently delete laboratory: % PDF manuals are linked to this lab. Deactivate the lab instead.', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.pc_lab_computers WHERE lab_id = OLD.id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Cannot permanently delete laboratory: % PC Lab computer records exist. Deactivate the lab instead.', v_count;
  END IF;

  RETURN OLD;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. HARDENED ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laboratory_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pc_lab_computers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pc_lab_maintenance_records ENABLE ROW LEVEL SECURITY;

-- Courses: public active read, College Admin write
DROP POLICY IF EXISTS "Public read active MVIT courses" ON public.courses;
CREATE POLICY "Public read active MVIT courses" ON public.courses
  FOR SELECT TO anon
  USING (institution_id = public.get_mvit_institution_id() AND is_active = true);

DROP POLICY IF EXISTS "Staff read MVIT courses" ON public.courses;
CREATE POLICY "Staff read MVIT courses" ON public.courses
  FOR SELECT TO authenticated
  USING (public.is_institution_staff(institution_id));

DROP POLICY IF EXISTS "Admin manage MVIT courses" ON public.courses;
CREATE POLICY "Admin manage MVIT courses" ON public.courses
  FOR ALL TO authenticated
  USING (public.is_college_admin(institution_id))
  WITH CHECK (public.is_college_admin(institution_id));

-- Laboratory Courses: public active lab mappings read, College Admin write
DROP POLICY IF EXISTS "Public read active MVIT lab courses" ON public.laboratory_courses;
CREATE POLICY "Public read active MVIT lab courses" ON public.laboratory_courses
  FOR SELECT TO anon
  USING (
    institution_id = public.get_mvit_institution_id()
    AND EXISTS (
      SELECT 1 FROM public.labs l
      WHERE l.id = laboratory_courses.lab_id AND l.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Staff read MVIT lab courses" ON public.laboratory_courses;
CREATE POLICY "Staff read MVIT lab courses" ON public.laboratory_courses
  FOR SELECT TO authenticated
  USING (public.is_institution_staff(institution_id));

DROP POLICY IF EXISTS "Admin manage MVIT lab courses" ON public.laboratory_courses;
CREATE POLICY "Admin manage MVIT lab courses" ON public.laboratory_courses
  FOR ALL TO authenticated
  USING (public.is_college_admin(institution_id))
  WITH CHECK (public.is_college_admin(institution_id));

-- Experiment Courses: public read for published experiments, assigned Lab Assistant / Admin write
DROP POLICY IF EXISTS "Public read published MVIT exp courses" ON public.experiment_courses;
CREATE POLICY "Public read published MVIT exp courses" ON public.experiment_courses
  FOR SELECT TO anon
  USING (
    institution_id = public.get_mvit_institution_id()
    AND EXISTS (
      SELECT 1 FROM public.experiments e
      WHERE e.id = experiment_courses.experiment_id AND e.is_published = true
    )
  );

DROP POLICY IF EXISTS "Staff read MVIT exp courses" ON public.experiment_courses;
CREATE POLICY "Staff read MVIT exp courses" ON public.experiment_courses
  FOR SELECT TO authenticated
  USING (public.is_institution_staff(institution_id));

DROP POLICY IF EXISTS "Scoped staff manage MVIT exp courses" ON public.experiment_courses;
CREATE POLICY "Scoped staff manage MVIT exp courses" ON public.experiment_courses
  FOR ALL TO authenticated
  USING (
    public.is_college_admin(institution_id)
    OR EXISTS (
      SELECT 1 FROM public.experiments e
      JOIN public.practical_subjects ps ON ps.id = e.subject_id
      WHERE e.id = experiment_courses.experiment_id
        AND public.has_lab_access(ps.lab_id)
    )
  )
  WITH CHECK (
    public.is_college_admin(institution_id)
    OR EXISTS (
      SELECT 1 FROM public.experiments e
      JOIN public.practical_subjects ps ON ps.id = e.subject_id
      WHERE e.id = experiment_courses.experiment_id
        AND public.has_lab_access(ps.lab_id)
    )
  );

-- Experiment Resources: public read for published resources/experiments, scoped staff write
DROP POLICY IF EXISTS "Public read published MVIT exp resources" ON public.experiment_resources;
CREATE POLICY "Public read published MVIT exp resources" ON public.experiment_resources
  FOR SELECT TO anon
  USING (
    institution_id = public.get_mvit_institution_id()
    AND is_published = true
    AND EXISTS (
      SELECT 1 FROM public.experiments e
      WHERE e.id = experiment_resources.experiment_id AND e.is_published = true
    )
  );

DROP POLICY IF EXISTS "Staff read MVIT exp resources" ON public.experiment_resources;
CREATE POLICY "Staff read MVIT exp resources" ON public.experiment_resources
  FOR SELECT TO authenticated
  USING (public.is_institution_staff(institution_id));

DROP POLICY IF EXISTS "Scoped staff manage MVIT exp resources" ON public.experiment_resources;
CREATE POLICY "Scoped staff manage MVIT exp resources" ON public.experiment_resources
  FOR ALL TO authenticated
  USING (
    public.is_college_admin(institution_id)
    OR EXISTS (
      SELECT 1 FROM public.experiments e
      JOIN public.practical_subjects ps ON ps.id = e.subject_id
      WHERE e.id = experiment_resources.experiment_id
        AND public.has_lab_access(ps.lab_id)
    )
  )
  WITH CHECK (
    public.is_college_admin(institution_id)
    OR EXISTS (
      SELECT 1 FROM public.experiments e
      JOIN public.practical_subjects ps ON ps.id = e.subject_id
      WHERE e.id = experiment_resources.experiment_id
        AND public.has_lab_access(ps.lab_id)
    )
  );

-- PC LAB COMPUTERS: ZERO ANON ACCESS! Strictly authenticated College Admin or assigned PC Lab Assistant.
DROP POLICY IF EXISTS "Staff manage assigned PC lab computers" ON public.pc_lab_computers;
CREATE POLICY "Staff manage assigned PC lab computers" ON public.pc_lab_computers
  FOR ALL TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND (public.is_college_admin(institution_id) OR public.has_lab_access(lab_id))
  )
  WITH CHECK (
    institution_id = public.get_mvit_institution_id()
    AND (public.is_college_admin(institution_id) OR public.has_lab_access(lab_id))
  );

-- PC LAB MAINTENANCE RECORDS: ZERO ANON ACCESS! Strictly authenticated College Admin or assigned PC Lab Assistant.
DROP POLICY IF EXISTS "Staff manage assigned PC lab maintenance" ON public.pc_lab_maintenance_records;
CREATE POLICY "Staff manage assigned PC lab maintenance" ON public.pc_lab_maintenance_records
  FOR ALL TO authenticated
  USING (
    institution_id = public.get_mvit_institution_id()
    AND (public.is_college_admin(institution_id) OR public.has_lab_access(lab_id))
  )
  WITH CHECK (
    institution_id = public.get_mvit_institution_id()
    AND (public.is_college_admin(institution_id) OR public.has_lab_access(lab_id))
  );

-- ------------------------------------------------------------------------------
-- 6. IDEMPOTENT MVIT SEED DATA (COURSES, CORE LABS & LAB-COURSE MAPPINGS)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_inst_id UUID;
  v_dept_ece UUID;
  v_dept_cse UUID;
  v_dept_sci UUID;
  v_lab_psl UUID;
  v_lab_edl UUID;
  v_lab_comm UUID;
  v_lab_pc UUID;
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

  SELECT id INTO v_dept_ece FROM public.departments WHERE institution_id = v_inst_id AND UPPER(code) = 'ECE' LIMIT 1;
  SELECT id INTO v_dept_cse FROM public.departments WHERE institution_id = v_inst_id AND UPPER(code) = 'CSE' LIMIT 1;
  SELECT id INTO v_dept_sci FROM public.departments WHERE institution_id = v_inst_id AND UPPER(code) IN ('ENG-SCI', 'PHYSICS') LIMIT 1;

  -- Seed MVIT Courses
  INSERT INTO public.courses (institution_id, code, name, degree, description, is_active, display_order)
  VALUES
    (v_inst_id, 'ECE', 'Electronics and Communication Engineering', 'B.Tech', 'Analog/digital electronics, communication systems, and VLSI practicals.', true, 1),
    (v_inst_id, 'EEE', 'Electrical and Electronics Engineering', 'B.Tech', 'Circuit theory, semiconductor devices, power electronics, and control systems.', true, 2),
    (v_inst_id, 'CSE', 'Computer Science and Engineering', 'B.Tech', 'Programming, data structures, systems, AI, and computational laboratories.', true, 3),
    (v_inst_id, 'IT', 'Information Technology', 'B.Tech', 'Software engineering, web technologies, networking, and communication labs.', true, 4),
    (v_inst_id, 'MECH', 'Mechanical Engineering', 'B.Tech', 'Engineering physics, precision metrology, materials, and CAD computing.', true, 5)
  ON CONFLICT (institution_id, code) DO NOTHING;

  SELECT id INTO v_course_ece FROM public.courses WHERE institution_id = v_inst_id AND code = 'ECE' LIMIT 1;
  SELECT id INTO v_course_eee FROM public.courses WHERE institution_id = v_inst_id AND code = 'EEE' LIMIT 1;
  SELECT id INTO v_course_cse FROM public.courses WHERE institution_id = v_inst_id AND code = 'CSE' LIMIT 1;
  SELECT id INTO v_course_it FROM public.courses WHERE institution_id = v_inst_id AND code = 'IT' LIMIT 1;
  SELECT id INTO v_course_mech FROM public.courses WHERE institution_id = v_inst_id AND code = 'MECH' LIMIT 1;

  -- Ensure core MVIT Laboratories exist without duplicating Physical Science Lab (PHYS-SCI-01 / PSL-01)
  INSERT INTO public.labs (institution_id, department_id, lab_code, name, description, building, room_number, location, capacity, status, lab_type, display_order)
  VALUES
    (
      v_inst_id, v_dept_ece, 'EDL-01', 'Electronic Devices Lab',
      'Analog semiconductor characterization, rectifier circuits, amplifier testing, and oscilloscope measurement laboratory.',
      'ECE Block', 'Lab 104', 'Floor 1, East Wing', 40, 'active', 'practical', 1
    ),
    (
      v_inst_id, v_dept_sci, 'PCL-01', 'Professional Communication Lab',
      'Digital language studio, phonetics practice, technical presentation, and group communication laboratory.',
      'Academic Annex', 'Lab 302', 'Floor 3, North Wing', 36, 'active', 'practical', 3
    ),
    (
      v_inst_id, v_dept_cse, 'COMP-PC-01', 'PC Lab',
      'Centralized student computing workstations, programming suites, and campus staff workstation infrastructure management.',
      'CSE & IT Block', 'Center 401', 'Floor 4, Central Wing', 60, 'active', 'pc_lab', 4
    )
  ON CONFLICT (institution_id, lab_code) DO NOTHING;

  -- Detect existing Physical Science Lab by institution + name or known codes (PHYS-SCI-01 / PSL-01)
  SELECT id INTO v_lab_psl
  FROM public.labs
  WHERE institution_id = v_inst_id
    AND (
      UPPER(lab_code) IN ('PHYS-SCI-01', 'PSL-01')
      OR LOWER(TRIM(name)) = 'physical science lab'
    )
  ORDER BY
    CASE WHEN UPPER(lab_code) = 'PHYS-SCI-01' THEN 0 ELSE 1 END,
    created_at ASC
  LIMIT 1;

  IF v_lab_psl IS NULL THEN
    INSERT INTO public.labs (
      institution_id, department_id, lab_code, name, description,
      building, room_number, location, capacity, status, lab_type, display_order
    )
    VALUES (
      v_inst_id, v_dept_sci, 'PHYS-SCI-01', 'Physical Science Lab',
      'Integrated engineering physics, precision vernier metrology, optical bench, and analytical chemistry laboratory.',
      'Main Academic Block', 'Lab 201', 'Floor 2, South Wing', 45, 'active', 'practical', 2
    )
    RETURNING id INTO v_lab_psl;
  ELSE
    UPDATE public.labs
    SET
      lab_type = 'practical',
      department_id = COALESCE(department_id, v_dept_sci),
      description = COALESCE(NULLIF(TRIM(description), ''), 'Integrated engineering physics, precision vernier metrology, optical bench, and analytical chemistry laboratory.'),
      building = COALESCE(NULLIF(TRIM(building), ''), 'Main Academic Block'),
      room_number = COALESCE(NULLIF(TRIM(room_number), ''), 'Lab 201'),
      location = COALESCE(NULLIF(TRIM(location), ''), 'Floor 2, South Wing'),
      display_order = COALESCE(display_order, 2),
      updated_at = NOW()
    WHERE id = v_lab_psl;
  END IF;

  UPDATE public.labs
  SET lab_type = 'pc_lab'
  WHERE institution_id = v_inst_id AND UPPER(lab_code) = 'COMP-PC-01';

  SELECT id INTO v_lab_edl FROM public.labs WHERE institution_id = v_inst_id AND UPPER(lab_code) = 'EDL-01' LIMIT 1;
  SELECT id INTO v_lab_comm FROM public.labs WHERE institution_id = v_inst_id AND UPPER(lab_code) = 'PCL-01' LIMIT 1;
  SELECT id INTO v_lab_pc FROM public.labs WHERE institution_id = v_inst_id AND UPPER(lab_code) = 'COMP-PC-01' LIMIT 1;

  -- Map Laboratories <-> Courses
  INSERT INTO public.laboratory_courses (institution_id, lab_id, course_id)
  SELECT v_inst_id, l_id, c_id
  FROM (VALUES
    (v_lab_edl, v_course_ece),
    (v_lab_edl, v_course_eee),
    (v_lab_psl, v_course_ece),
    (v_lab_psl, v_course_eee),
    (v_lab_psl, v_course_cse),
    (v_lab_psl, v_course_it),
    (v_lab_psl, v_course_mech),
    (v_lab_comm, v_course_ece),
    (v_lab_comm, v_course_cse),
    (v_lab_comm, v_course_it),
    (v_lab_comm, v_course_mech),
    (v_lab_pc, v_course_cse),
    (v_lab_pc, v_course_it),
    (v_lab_pc, v_course_ece)
  ) AS pairs(l_id, c_id)
  WHERE l_id IS NOT NULL AND c_id IS NOT NULL
  ON CONFLICT (lab_id, course_id) DO NOTHING;
END $$;
