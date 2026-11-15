-- ==============================================================================
-- LABVERSE – MVIT HACKATHON DEMO DATA SEED SCRIPT (IDEMPOTENT / SAFE TO RE-RUN)
-- ==============================================================================
-- Target Institution: Manakula Vinayagar Institute of Technology (MVIT)
-- Guarantees:
--   * Preserves existing institution, departments, terms, labs, courses, and custom uploads
--   * Populates Years 1–4 illustrative demo practical subjects & experiments
--   * Maps courses cleanly without cross-contamination
--   * Seeds sample PC Lab computers (5 working, 1 defective, 1 under maintenance, 2 staff)
--   * Safe to run multiple times via ON CONFLICT DO NOTHING / WHERE NOT EXISTS
-- ==============================================================================

DO $$
DECLARE
  v_inst_id UUID;
  v_term_id UUID;
  v_dept_ece UUID;
  v_dept_cse UUID;
  v_dept_sci UUID;

  v_lab_edl UUID;
  v_lab_psl UUID;
  v_lab_pcl UUID;
  v_lab_pc UUID;

  v_course_ece UUID;
  v_course_eee UUID;
  v_course_cse UUID;
  v_course_it UUID;
  v_course_mech UUID;

  v_subj_phy101 UUID;
  v_subj_chm101 UUID;
  v_subj_eee101 UUID;
  v_subj_hss101 UUID;
  v_subj_ece201 UUID;
  v_subj_ece202 UUID;
  v_subj_ece301 UUID;
  v_subj_ece302 UUID;
  v_subj_hss301 UUID;
  v_subj_ece401 UUID;
  v_subj_ece402 UUID;

  v_exp_id UUID;
  v_pc_04 UUID;
  v_pc_05 UUID;
BEGIN
  -- 1. Resolve canonical MVIT institution
  SELECT id INTO v_inst_id FROM public.institutions WHERE UPPER(code) = 'MVIT' LIMIT 1;
  IF v_inst_id IS NULL THEN
    INSERT INTO public.institutions (name, code, institution_code, domain, contact_email, address, active, status)
    VALUES (
      'Manakula Vinayagar Institute of Technology',
      'MVIT',
      'MVIT',
      'mvit.edu.in',
      'principal@mvit.edu.in',
      'Kalitheerthalkuppam, Madagadipet, Puducherry 605107',
      true,
      'active'
    )
    RETURNING id INTO v_inst_id;
  END IF;

  -- 2. Resolve or seed core Departments
  INSERT INTO public.departments (institution_id, code, name, head_faculty_name, description)
  VALUES
    (v_inst_id, 'ENG-SCI', 'Engineering & Applied Sciences', 'Prof. R. Subramanian', 'First-year Physics, Chemistry, and Professional Communication.'),
    (v_inst_id, 'ECE', 'Electronics and Communication Engineering', 'Dr. K. Anand', 'Semiconductor devices, embedded systems, VLSI, and IoT.'),
    (v_inst_id, 'CSE', 'Computer Science and Engineering', 'Dr. V. Rajesh', 'Computing systems, algorithms, and PC laboratory suites.')
  ON CONFLICT (institution_id, code) DO NOTHING;

  SELECT id INTO v_dept_sci FROM public.departments WHERE institution_id = v_inst_id AND UPPER(code) IN ('ENG-SCI', 'PHYSICS') ORDER BY created_at ASC LIMIT 1;
  SELECT id INTO v_dept_ece FROM public.departments WHERE institution_id = v_inst_id AND UPPER(code) = 'ECE' LIMIT 1;
  SELECT id INTO v_dept_cse FROM public.departments WHERE institution_id = v_inst_id AND UPPER(code) = 'CSE' LIMIT 1;
  v_dept_sci := COALESCE(v_dept_sci, v_dept_ece, v_dept_cse);
  v_dept_ece := COALESCE(v_dept_ece, v_dept_sci);
  v_dept_cse := COALESCE(v_dept_cse, v_dept_sci);

  -- 2b. Ensure core laboratories exist before demo subjects reference them.
  INSERT INTO public.labs (
    institution_id, department_id, lab_code, name, description,
    building, room_number, location, capacity, status, lab_type, display_order
  )
  VALUES
    (v_inst_id, v_dept_ece, 'EDL-01', 'Electronic Devices Lab',
     'Analog semiconductor characterization, rectifier circuits, amplifier testing, and oscilloscope measurement laboratory.',
     'ECE Block', 'Lab 104', 'Floor 1, East Wing', 40, 'active', 'practical', 1),
    (v_inst_id, v_dept_sci, 'PCL-01', 'Professional Communication Lab',
     'Digital language studio, phonetics practice, technical presentation, and group communication laboratory.',
     'Academic Annex', 'Lab 302', 'Floor 3, North Wing', 36, 'active', 'practical', 3),
    (v_inst_id, v_dept_cse, 'COMP-PC-01', 'PC Lab',
     'Centralized computing workstations and internal staff workstation infrastructure management.',
     'CSE & IT Block', 'Center 401', 'Floor 4, Central Wing', 60, 'active', 'pc_lab', 4)
  ON CONFLICT (institution_id, lab_code) DO NOTHING;

  SELECT id INTO v_lab_psl
  FROM public.labs
  WHERE institution_id = v_inst_id
    AND (UPPER(lab_code) IN ('PHYS-SCI-01', 'PSL-01') OR LOWER(TRIM(name)) = 'physical science lab')
  ORDER BY CASE WHEN UPPER(lab_code) = 'PHYS-SCI-01' THEN 0 ELSE 1 END, created_at ASC
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
  END IF;

  UPDATE public.labs
  SET lab_type = 'pc_lab', is_public = false
  WHERE institution_id = v_inst_id AND UPPER(lab_code) = 'COMP-PC-01';

  SELECT id INTO v_lab_edl FROM public.labs WHERE institution_id = v_inst_id AND UPPER(lab_code) = 'EDL-01' LIMIT 1;
  SELECT id INTO v_lab_pcl FROM public.labs WHERE institution_id = v_inst_id AND UPPER(lab_code) = 'PCL-01' LIMIT 1;
  SELECT id INTO v_lab_pc FROM public.labs WHERE institution_id = v_inst_id AND UPPER(lab_code) = 'COMP-PC-01' LIMIT 1;

  -- 3. Resolve or seed active Academic Term
  SELECT id INTO v_term_id FROM public.academic_terms WHERE institution_id = v_inst_id AND is_current = true LIMIT 1;
  IF v_term_id IS NULL THEN
    INSERT INTO public.academic_terms (institution_id, name, code, is_current)
    VALUES (v_inst_id, 'Academic Year 2026-27 (Demo)', 'AY-2026-27', true)
    ON CONFLICT (institution_id, code) DO UPDATE SET is_current = true
    RETURNING id INTO v_term_id;
  END IF;

  -- 4. Resolve or seed Courses (ECE, EEE, CSE, IT, MECH)
  INSERT INTO public.courses (institution_id, code, name, degree, description, is_active, display_order)
  VALUES
    (v_inst_id, 'ECE', 'Electronics and Communication Engineering', 'B.Tech', 'Analog/digital electronics, communication systems, and embedded practicals.', true, 1),
    (v_inst_id, 'EEE', 'Electrical and Electronics Engineering', 'B.Tech', 'Circuit theory, semiconductor devices, and instrumentation labs.', true, 2),
    (v_inst_id, 'CSE', 'Computer Science and Engineering', 'B.Tech', 'Programming, data structures, computing systems, and applied sciences.', true, 3),
    (v_inst_id, 'IT', 'Information Technology', 'B.Tech', 'Software engineering, networking, and communication laboratories.', true, 4),
    (v_inst_id, 'MECH', 'Mechanical Engineering', 'B.Tech', 'Engineering physics, precision metrology, and CAD laboratories.', true, 5)
  ON CONFLICT (institution_id, code) DO NOTHING;

  SELECT id INTO v_course_ece FROM public.courses WHERE institution_id = v_inst_id AND code = 'ECE' LIMIT 1;
  SELECT id INTO v_course_eee FROM public.courses WHERE institution_id = v_inst_id AND code = 'EEE' LIMIT 1;
  SELECT id INTO v_course_cse FROM public.courses WHERE institution_id = v_inst_id AND code = 'CSE' LIMIT 1;
  SELECT id INTO v_course_it FROM public.courses WHERE institution_id = v_inst_id AND code = 'IT' LIMIT 1;
  SELECT id INTO v_course_mech FROM public.courses WHERE institution_id = v_inst_id AND code = 'MECH' LIMIT 1;

  -- 4b. Map laboratories to illustrative courses.
  INSERT INTO public.laboratory_courses (institution_id, lab_id, course_id)
  SELECT v_inst_id, pair.lab_id, pair.course_id
  FROM (VALUES
    (v_lab_edl, v_course_ece), (v_lab_edl, v_course_eee),
    (v_lab_psl, v_course_ece), (v_lab_psl, v_course_eee),
    (v_lab_psl, v_course_cse), (v_lab_psl, v_course_it), (v_lab_psl, v_course_mech),
    (v_lab_pcl, v_course_ece), (v_lab_pcl, v_course_cse),
    (v_lab_pcl, v_course_it), (v_lab_pcl, v_course_mech),
    (v_lab_pc, v_course_cse), (v_lab_pc, v_course_it), (v_lab_pc, v_course_ece)
  ) AS pair(lab_id, course_id)
  WHERE pair.lab_id IS NOT NULL AND pair.course_id IS NOT NULL
  ON CONFLICT (lab_id, course_id) DO NOTHING;

  -- Labs were provisioned above before subjects are inserted.

  -- 6. Seed Years 1–4 Demo Practical Subjects (idempotent on institution_id + code)
  INSERT INTO public.practical_subjects (institution_id, lab_id, department_id, term_id, code, name, credits, semester, location, schedule_info, description, is_active)
  VALUES
    (v_inst_id, v_lab_psl, v_dept_sci, v_term_id, 'PHY-101L', 'Engineering Physics Practicals (Demo)', 2, 1, 'Main Academic Block, Lab 201', 'Mon & Wed Practical Batches', 'DEMO CONTENT: Year 1 mechanics, oscillatory motion, and precision metrology practicals.', true),
    (v_inst_id, v_lab_psl, v_dept_sci, v_term_id, 'CHM-101L', 'Engineering Chemistry Practicals (Demo)', 2, 2, 'Main Academic Block, Lab 201', 'Tue & Thu Practical Batches', 'DEMO CONTENT: Year 1 electrochemistry, pH analysis, and buffer standardization.', true),
    (v_inst_id, v_lab_edl, v_dept_ece, v_term_id, 'EEE-101L', 'Basic Electrical & Electronic Measurements Lab (Demo)', 2, 1, 'ECE Block, Lab 104', 'Mon Practical Batches', 'DEMO CONTENT: Year 1 passive component decoding, digital multimeter usage, and KVL/KCL circuit checks.', true),
    (v_inst_id, v_lab_pcl, v_dept_sci, v_term_id, 'HSS-101L', 'Technical English & Active Listening Lab (Demo)', 1, 2, 'Academic Annex, Lab 302', 'Wed Studio Sessions', 'DEMO CONTENT: Year 1 active technical listening, reading comprehension, and concise oral summaries.', true),
    (v_inst_id, v_lab_edl, v_dept_ece, v_term_id, 'ECE-201L', 'Electronic Devices Laboratory (Demo)', 2, 3, 'ECE Block, Lab 104', 'Mon & Thu Practical Batches', 'DEMO CONTENT: Year 2 semiconductor diode characteristics and circuit analysis.', true),
    (v_inst_id, v_lab_edl, v_dept_ece, v_term_id, 'ECE-202L', 'Digital & Analog Circuit Design Lab (Demo)', 2, 4, 'ECE Block, Lab 104', 'Tue & Fri Practical Batches', 'DEMO CONTENT: Year 2 resistive verification and combinational logic gates.', true),
    (v_inst_id, v_lab_edl, v_dept_ece, v_term_id, 'ECE-301L', 'Analog Electronic Circuits Laboratory (Demo)', 2, 5, 'ECE Block, Lab 104', 'Wed & Fri Practical Batches', 'DEMO CONTENT: Year 3 BJT amplifiers and operational amplifier circuits.', true),
    (v_inst_id, v_lab_edl, v_dept_ece, v_term_id, 'ECE-302L', 'Digital System & Logic Lab (Demo)', 2, 6, 'ECE Block, Lab 104', 'Mon & Wed Practical Batches', 'DEMO CONTENT: Year 3 combinational systems and sequential counters.', true),
    (v_inst_id, v_lab_pcl, v_dept_sci, v_term_id, 'HSS-301L', 'Professional Communication Skills Lab (Demo)', 1, 5, 'Academic Annex, Lab 302', 'Fri Studio Sessions', 'DEMO CONTENT: Year 3 phonetics articulation and technical group discussion.', true),
    (v_inst_id, v_lab_edl, v_dept_ece, v_term_id, 'ECE-401L', 'Embedded Systems & Microcontroller Lab (Demo)', 2, 7, 'ECE Block, Lab 104', 'Tue & Thu Senior Batches', 'DEMO CONTENT: Year 4 microcontroller GPIO interfacing and sensor data acquisition.', true),
    (v_inst_id, v_lab_edl, v_dept_ece, v_term_id, 'ECE-402L', 'Communication & IoT Systems Lab (Demo)', 2, 8, 'ECE Block, Lab 104', 'Wed & Fri Senior Batches', 'DEMO CONTENT: Year 4 wireless telemetry and IoT edge device integration.', true)
  ON CONFLICT (institution_id, code) DO NOTHING;

  -- Repair previously seeded demo subjects that were inserted before their labs existed.
  UPDATE public.practical_subjects ps
  SET lab_id = CASE
    WHEN ps.code IN ('PHY-101L', 'CHM-101L') THEN v_lab_psl
    WHEN ps.code IN ('EEE-101L', 'ECE-201L', 'ECE-202L', 'ECE-301L', 'ECE-302L', 'ECE-401L', 'ECE-402L') THEN v_lab_edl
    WHEN ps.code IN ('HSS-101L', 'HSS-301L') THEN v_lab_pcl
    ELSE ps.lab_id
  END
  WHERE ps.institution_id = v_inst_id
    AND ps.lab_id IS NULL
    AND ps.code IN ('PHY-101L', 'CHM-101L', 'EEE-101L', 'ECE-201L', 'ECE-202L', 'ECE-301L', 'ECE-302L', 'ECE-401L', 'ECE-402L', 'HSS-101L', 'HSS-301L');

  SELECT id INTO v_subj_phy101 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'PHY-101L' LIMIT 1;
  SELECT id INTO v_subj_chm101 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'CHM-101L' LIMIT 1;
  SELECT id INTO v_subj_eee101 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'EEE-101L' LIMIT 1;
  SELECT id INTO v_subj_hss101 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'HSS-101L' LIMIT 1;
  SELECT id INTO v_subj_ece201 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'ECE-201L' LIMIT 1;
  SELECT id INTO v_subj_ece202 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'ECE-202L' LIMIT 1;
  SELECT id INTO v_subj_ece301 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'ECE-301L' LIMIT 1;
  SELECT id INTO v_subj_ece302 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'ECE-302L' LIMIT 1;
  SELECT id INTO v_subj_hss301 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'HSS-301L' LIMIT 1;
  SELECT id INTO v_subj_ece401 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'ECE-401L' LIMIT 1;
  SELECT id INTO v_subj_ece402 FROM public.practical_subjects WHERE institution_id = v_inst_id AND code = 'ECE-402L' LIMIT 1;

  -- 7. Seed Demo Experiments across Years 1–4 (preserves existing experiments by subject_id + exp_number)
  -- Year 1 (PHY-101L)
  INSERT INTO public.experiments (institution_id, subject_id, exp_number, title, slug, aim, theory, expected_result, youtube_url, youtube_video_id, youtube_search_url, bench_twin_mode, simulator_type, built_in_simulator_id, simulation_type, simulation_provider, is_published)
  VALUES
    (v_inst_id, v_subj_phy101, 1, 'Simple Pendulum – Acceleration due to Gravity', 'simple-pendulum-g', 'To determine the acceleration due to gravity (g) using a simple pendulum.', 'DEMO CONTENT: Period T = 2*pi*sqrt(L/g). Slope of T^2 vs L determines g.', 'Experimental g within +/-2% of 9.81 m/s^2.', 'https://www.youtube.com/watch?v=lfKU07S2Qwc', 'lfKU07S2Qwc', 'https://www.youtube.com/results?search_query=simple+pendulum+physics+lab+experiment+demonstration', 'external', 'pendulum', 'pendulum', 'built_in', 'built_in', true),
    (v_inst_id, v_subj_phy101, 2, 'Precision Measurement Using Vernier Calipers', 'vernier-calipers-metrology', 'To determine the dimensions and volume of a solid cylinder using vernier calipers.', 'DEMO CONTENT: Total Reading = MSR + (VSR * LC), LC = 0.01 cm.', 'Volume determined with calibrated least count precision.', '', NULL, 'https://www.youtube.com/results?search_query=Vernier+calipers+least+count+engineering+physics+lab+experiment', 'external', 'calipers', 'calipers', 'built_in', 'built_in', true)
  ON CONFLICT (subject_id, exp_number) DO NOTHING;

  -- Year 1 (CHM-101L)
  INSERT INTO public.experiments (institution_id, subject_id, exp_number, title, slug, aim, theory, expected_result, youtube_search_url, bench_twin_url, simulation_url, bench_twin_mode, simulator_type, built_in_simulator_id, simulation_type, simulation_provider, is_published)
  VALUES
    (v_inst_id, v_subj_chm101, 1, 'pH Determination of Aqueous Samples Using Digital pH Meter', 'ph-meter-analysis', 'To calibrate a glass electrode pH meter and measure the pH of unknown solutions.', 'DEMO CONTENT: Nernst equation relates electrode potential to hydrogen ion activity.', 'Accurate pH readings across acidic, neutral, and alkaline samples.', 'https://www.youtube.com/results?search_query=pH+meter+calibration+laboratory+experiment', 'https://phet.colorado.edu/en/simulations/ph-scale', 'https://phet.colorado.edu/en/simulations/ph-scale', 'external', 'ph_meter', 'ph_meter', 'hybrid', 'phet', true),
    (v_inst_id, v_subj_chm101, 2, 'Buffer Solution Preparation & Standardization', 'buffer-solution-standardization', 'To prepare and verify standard acidic and alkaline buffer solutions.', 'DEMO CONTENT: Henderson-Hasselbalch equation governs buffer resistance to pH shifts.', 'Buffer solutions maintain target pH within +/- 0.05 units.', 'https://www.youtube.com/results?search_query=buffer+solution+preparation+pH+calibration+lab+experiment', 'https://phet.colorado.edu/en/simulations/ph-scale', 'https://phet.colorado.edu/en/simulations/ph-scale', 'external', 'ph_meter', 'ph_meter', 'hybrid', 'phet', true)
  ON CONFLICT (subject_id, exp_number) DO NOTHING;

  -- Year 1 (EEE-101L in EDL-01 & HSS-101L in PCL-01)
  INSERT INTO public.experiments (institution_id, subject_id, exp_number, title, slug, aim, theory, expected_result, youtube_url, youtube_video_id, youtube_search_url, bench_twin_url, simulation_url, bench_twin_mode, simulator_type, simulation_type, simulation_provider, is_published)
  VALUES
    (v_inst_id, v_subj_eee101, 1, 'Resistor Color Coding & Digital Multimeter Measurements', 'resistor-color-coding-dmm-measurements', 'To decode standard 4-band resistor color bands and verify measured resistance with a digital multimeter.', 'DEMO CONTENT: R = (AB * 10^C) Ohm +/- tolerance.', 'Tested resistors matched manufacturer tolerance.', '', NULL, 'https://www.youtube.com/results?search_query=resistor+color+code+digital+multimeter+lab+experiment', 'https://phet.colorado.edu/en/simulations/ohms-law', 'https://phet.colorado.edu/en/simulations/ohms-law', 'external', 'custom', 'external', 'phet', true),
    (v_inst_id, v_subj_eee101, 2, 'DC Series-Parallel Circuit Analysis & KVL/KCL Verification', 'dc-series-parallel-kvl-kcl-verification', 'To assemble a two-loop DC bridge and verify Kirchhoff Voltage and Current Laws.', 'DEMO CONTENT: Algebraic sum of loop voltages and node currents equal zero.', 'Measured KVL and KCL totals agreed within 0.3%.', '', NULL, 'https://www.youtube.com/results?search_query=KVL+KCL+DC+series+parallel+circuit+engineering+lab', 'https://phet.colorado.edu/en/simulations/ohms-law', 'https://phet.colorado.edu/en/simulations/ohms-law', 'external', 'custom', 'external', 'phet', true),
    (v_inst_id, v_subj_hss101, 1, 'Active Technical Listening & Articulation Fundamentals', 'active-technical-listening-articulation', 'To capture quantitative parameters from technical briefings and deliver clear oral paraphrases.', 'DEMO CONTENT: Active listening isolates key numerical parameters and sequence markers.', '90% specification recall achieved in studio exercise.', 'https://www.youtube.com/watch?v=eIho2S0ZahI', 'eIho2S0ZahI', 'https://www.youtube.com/results?search_query=active+listening+engineering+communication+skills+lab', '', '', 'external', 'custom', 'none', 'none', true),
    (v_inst_id, v_subj_hss101, 2, 'Technical Reading Comprehension & Oral Summary Lab', 'technical-reading-comprehension-oral-summary', 'To extract operating ratings from technical abstracts and present a structured 2-minute summary.', 'DEMO CONTENT: Structured reading pairs structural skimming with parameter scanning.', 'Clear 3-part spoken summary delivered within 2 minutes.', '', NULL, 'https://www.youtube.com/results?search_query=technical+reading+comprehension+oral+presentation+engineering+lab', '', '', 'external', 'custom', 'none', 'none', true)
  ON CONFLICT (subject_id, exp_number) DO NOTHING;

  -- Year 2 (ECE-201L & ECE-202L)
  INSERT INTO public.experiments (institution_id, subject_id, exp_number, title, slug, aim, theory, expected_result, youtube_url, youtube_video_id, youtube_alt_url, youtube_search_url, bench_twin_url, simulation_url, bench_twin_mode, simulator_type, built_in_simulator_id, simulation_type, simulation_provider, is_published)
  VALUES
    (v_inst_id, v_subj_ece201, 1, 'PN Junction Diode – Forward Bias Characteristics', 'pn-diode-forward-bias', 'To study V-I characteristics of a silicon PN junction diode under forward bias and determine knee voltage.', 'DEMO CONTENT: Diode conducts exponentially above ~0.7V barrier potential.', 'Knee voltage ~0.68V-0.72V and positive dynamic conductance observed.', 'https://www.youtube.com/watch?v=QIoEw28Y9Wk', 'QIoEw28Y9Wk', 'https://www.youtube.com/watch?v=UdaATCmDfYU', 'https://www.youtube.com/results?search_query=PN+junction+diode+VI+characteristics+lab+experiment', 'https://fsp1-iiith.vlabs.ac.in/exp/pn-junction-diode/simulation.html', 'https://fsp1-iiith.vlabs.ac.in/exp/pn-junction-diode/simulation.html', 'embedded', 'pn_junction', 'pn_junction', 'hybrid', 'virtual_labs', true),
    (v_inst_id, v_subj_ece201, 2, 'PN Junction Diode – Reverse Saturation & Breakdown Study', 'pn-diode-reverse-bias', 'To examine reverse leakage current and reverse breakdown behavior of a PN junction diode.', 'DEMO CONTENT: Depletion barrier widens under reverse bias, limiting current to microamperes.', 'Stable reverse leakage current observed below breakdown threshold.', 'https://www.youtube.com/watch?v=QIoEw28Y9Wk', 'QIoEw28Y9Wk', 'https://www.youtube.com/watch?v=UdaATCmDfYU', 'https://www.youtube.com/results?search_query=PN+junction+diode+reverse+bias+characteristics+lab', 'https://fsp1-iiith.vlabs.ac.in/exp/pn-junction-diode/simulation.html', 'https://fsp1-iiith.vlabs.ac.in/exp/pn-junction-diode/simulation.html', 'embedded', 'pn_junction', 'pn_junction', 'hybrid', 'virtual_labs', true)
  ON CONFLICT (subject_id, exp_number) DO NOTHING;

  INSERT INTO public.experiments (institution_id, subject_id, exp_number, title, slug, aim, theory, expected_result, youtube_search_url, bench_twin_url, simulation_url, bench_twin_mode, simulator_type, simulation_type, simulation_provider, is_published)
  VALUES
    (v_inst_id, v_subj_ece202, 1, 'Verification of Ohm''s Law & Series-Parallel Resistive Networks', 'ohms-law-resistive-networks', 'To verify V = I*R across linear resistors and compute equivalent resistance.', 'DEMO CONTENT: Current is directly proportional to applied voltage at constant temperature.', 'Linear V-I slope matches theoretical equivalent resistance.', 'https://www.youtube.com/results?search_query=Ohms+law+verification+electrical+engineering+lab+experiment', 'https://phet.colorado.edu/en/simulations/ohms-law', 'https://phet.colorado.edu/en/simulations/ohms-law', 'external', 'custom', 'external', 'phet', true),
    (v_inst_id, v_subj_ece202, 2, 'Realization of Basic Digital Logic Gates', 'basic-digital-logic-gates', 'To verify truth tables of AND, OR, NOT, NAND, NOR, and XOR logic gates.', 'DEMO CONTENT: Boolean logic levels map TTL voltages to binary states 0 and 1.', 'Measured outputs match standard Boolean truth tables.', 'https://www.youtube.com/results?search_query=digital+logic+gates+engineering+lab+experiment', 'https://circuitverse.org/simulator', 'https://circuitverse.org/simulator', 'external', 'custom', 'external', 'circuitverse', true)
  ON CONFLICT (subject_id, exp_number) DO NOTHING;

  -- Year 3 (ECE-301L, ECE-302L, HSS-301L)
  INSERT INTO public.experiments (institution_id, subject_id, exp_number, title, slug, aim, theory, expected_result, youtube_url, youtube_video_id, youtube_search_url, bench_twin_url, simulation_url, bench_twin_mode, simulator_type, simulation_type, simulation_provider, is_published)
  VALUES
    (v_inst_id, v_subj_ece301, 1, 'BJT Input & Output Characteristics (Common Emitter Configuration)', 'bjt-ce-characteristics', 'To plot input and output characteristics of an NPN bipolar junction transistor in CE mode.', 'DEMO CONTENT: Collector current is governed by base current and current gain beta.', 'Active, cutoff, and saturation regions identified clearly.', '', NULL, 'https://www.youtube.com/results?search_query=BJT+common+emitter+characteristics+engineering+lab+experiment', 'https://be-iitkgp.vlabs.ac.in/exp/common-emitter-characteristics/simulation.html', 'https://be-iitkgp.vlabs.ac.in/exp/common-emitter-characteristics/simulation.html', 'embedded', 'custom', 'external', 'virtual_labs', true),
    (v_inst_id, v_subj_ece301, 2, 'Common Emitter RC-Coupled Voltage Amplifier Frequency Response', 'ce-amplifier-response', 'To measure mid-band voltage gain and 3-dB bandwidth of a single-stage CE amplifier.', 'DEMO CONTENT: Coupling and bypass capacitors shape low-frequency roll-off.', 'Mid-band gain and lower/upper cutoff frequencies plotted.', '', NULL, 'https://www.youtube.com/results?search_query=common+emitter+amplifier+practical+lab+experiment', 'https://be-iitkgp.vlabs.ac.in/exp/ce-amplifier/simulation.html', 'https://be-iitkgp.vlabs.ac.in/exp/ce-amplifier/simulation.html', 'embedded', 'custom', 'external', 'virtual_labs', true),
    (v_inst_id, v_subj_ece302, 1, 'Design & Verification of Combinational Adder/Subtractor Circuits', 'combinational-adder-subtractor', 'To implement half adder, full adder, and 4-bit binary adder/subtractor circuits.', 'DEMO CONTENT: XOR and NAND networks compute sum and carry bits.', 'Sum and carry outputs verified across all binary input states.', '', NULL, 'https://www.youtube.com/results?search_query=full+adder+multiplexer+digital+logic+lab+experiment', 'https://circuitverse.org/simulator', 'https://circuitverse.org/simulator', 'external', 'custom', 'external', 'circuitverse', true),
    (v_inst_id, v_subj_ece302, 2, 'Design of Synchronous & Ripple Up/Down Counters', 'sequential-up-down-counters', 'To construct and verify flip-flop based synchronous decade and mod-N counters.', 'DEMO CONTENT: Clocked JK/D flip-flops sequence through binary states.', 'State transitions verified cleanly on LED indicators.', '', NULL, 'https://www.youtube.com/results?search_query=synchronous+decade+counter+flip+flop+lab+experiment', 'https://circuitverse.org/simulator', 'https://circuitverse.org/simulator', 'external', 'custom', 'external', 'circuitverse', true),
    (v_inst_id, v_subj_hss301, 1, 'English Phonetics, Stress & Intonation Practice', 'english-phonetics-intonation', 'To practice vowel/consonant articulation and word stress patterns.', 'DEMO CONTENT: Acoustic pitch contours and syllable stress shape spoken clarity.', 'Improved pronunciation consistency in technical reading.', 'https://www.youtube.com/watch?v=eIho2S0ZahI', 'eIho2S0ZahI', 'https://www.youtube.com/results?search_query=English+phonetics+pronunciation+engineering+communication+lab', '', '', 'external', 'custom', 'none', 'none', true),
    (v_inst_id, v_subj_hss301, 2, 'Technical Group Discussion & Mock Interview Simulation', 'technical-group-discussion', 'To evaluate structured argumentation, active listening, and formal presentation.', 'DEMO CONTENT: Organized evidence and concise phrasing enhance team communication.', 'Structured speaking rubric scores recorded cleanly.', '', NULL, 'https://www.youtube.com/results?search_query=technical+group+discussion+mock+interview+engineering+skills', '', '', 'external', 'custom', 'none', 'none', true)
  ON CONFLICT (subject_id, exp_number) DO NOTHING;

  -- Year 4 (ECE-401L & ECE-402L)
  INSERT INTO public.experiments (institution_id, subject_id, exp_number, title, slug, aim, theory, expected_result, youtube_search_url, bench_twin_url, simulation_url, bench_twin_mode, simulator_type, simulation_type, simulation_provider, is_published)
  VALUES
    (v_inst_id, v_subj_ece401, 1, 'Microcontroller GPIO Interfacing & Timer Interrupt Control', 'mcu-gpio-timer-interrupts', 'To configure microcontroller digital I/O ports and timer interrupts for actuator control.', 'DEMO CONTENT: Memory-mapped registers configure port direction and periodic ISR triggers.', 'Deterministic LED and stepper sequencing under timer interrupt control.', 'https://www.youtube.com/results?search_query=microcontroller+LCD+keypad+interfacing+embedded+lab', 'https://benchtwin.com/', 'https://benchtwin.com/', 'external', 'custom', 'external', 'benchtwin', true),
    (v_inst_id, v_subj_ece401, 2, 'ADC Sensor Interfacing & Serial Telemetry Acquisition', 'adc-sensor-data-acquisition', 'To sample analog temperature/light sensors using an on-chip ADC and stream telemetry via UART.', 'DEMO CONTENT: Successive approximation ADC quantizes sensor voltage into discrete digital counts.', 'Calibrated physical readings transmitted cleanly at 9600/115200 baud.', 'https://www.youtube.com/results?search_query=ADC+temperature+sensor+LM35+microcontroller+lab', 'https://benchtwin.com/', 'https://benchtwin.com/', 'external', 'custom', 'external', 'benchtwin', true),
    (v_inst_id, v_subj_ece402, 1, 'Wireless Digital Modulation & RF Link Budget Simulation', 'wireless-rf-link-demo', 'To evaluate BER vs SNR across BPSK/QPSK modulation and compute free-space path loss.', 'DEMO CONTENT: Friis transmission equation links antenna gains, frequency, and distance to SNR.', 'Link margin and BER curves validated across modulation schemes.', 'https://www.youtube.com/results?search_query=ASK+FSK+digital+modulation+communication+lab+experiment', 'https://ae-iitr.vlabs.ac.in/exp/function-generator/simulation.html', 'https://ae-iitr.vlabs.ac.in/exp/function-generator/simulation.html', 'embedded', 'custom', 'external', 'virtual_labs', true),
    (v_inst_id, v_subj_ece402, 2, 'IoT Edge Device MQTT Telemetry & Cloud Integration Study', 'iot-mqtt-telemetry-study', 'To publish structured JSON sensor payloads over MQTT/HTTP from an embedded node.', 'DEMO CONTENT: Lightweight pub/sub brokers decouple constrained IoT nodes from dashboard consumers.', 'End-to-end telemetry round-trip verified cleanly.', 'https://www.youtube.com/results?search_query=IoT+MQTT+ESP32+telemetry+engineering+lab', 'https://benchtwin.com/', 'https://benchtwin.com/', 'external', 'custom', 'external', 'benchtwin', true)
  ON CONFLICT (subject_id, exp_number) DO NOTHING;

  -- 7b. Attach publisher-hosted reference PDFs to one published experiment per year.
  -- These are external source links, not copies. Preserve any manual previously uploaded by staff.
  UPDATE public.experiments
  SET manual_pdf_url = 'https://scce.ac.in/noticeboard/10969_21122017SIMPLE_PENDULUM.pdf',
      manual_pdf_name = 'SCCE_Simple_Pendulum_Lab_Manual.pdf',
      manual_doc_name = 'Simple Pendulum – Acceleration due to Gravity – SCCE reference',
      last_verified_at = now(),
      updated_at = now()
  WHERE subject_id = v_subj_phy101 AND exp_number = 1
    AND (manual_pdf_url IS NULL OR manual_pdf_url LIKE 'data:%');

  UPDATE public.experiments
  SET manual_pdf_url = 'https://mits.ac.in/assets/pdf/ece/EED%20Lab%20Manual.pdf',
      manual_pdf_name = 'MITS_Electronic_Devices_and_Circuits_Lab_Manual.pdf',
      manual_doc_name = 'PN Junction Diode – MITS reference manual',
      last_verified_at = now(),
      updated_at = now()
  WHERE subject_id = v_subj_ece201 AND exp_number = 1
    AND (manual_pdf_url IS NULL OR manual_pdf_url LIKE 'data:%');

  UPDATE public.experiments
  SET manual_pdf_url = 'https://iitr.ac.in/Academics/static/Department/Physics/Analog%20Electronics/BJT_Characteristics.pdf',
      manual_pdf_name = 'IIT_Roorkee_BJT_Common_Emitter_Characteristics.pdf',
      manual_doc_name = 'BJT Common Emitter Characteristics – IIT Roorkee reference',
      last_verified_at = now(),
      updated_at = now()
  WHERE subject_id = v_subj_ece301 AND exp_number = 1
    AND (manual_pdf_url IS NULL OR manual_pdf_url LIKE 'data:%');

  UPDATE public.experiments
  SET manual_pdf_url = 'https://iitr.ac.in/Academics/static/Department/Physics/Microcontroller%20Lab/ADC.pdf',
      manual_pdf_name = 'IIT_Roorkee_Microcontroller_ADC_Interfacing_Manual.pdf',
      manual_doc_name = 'ADC Sensor Interfacing – IIT Roorkee reference manual',
      last_verified_at = now(),
      updated_at = now()
  WHERE subject_id = v_subj_ece401 AND exp_number = 2
    AND (manual_pdf_url IS NULL OR manual_pdf_url LIKE 'data:%');

  INSERT INTO public.experiment_resources
    (institution_id, experiment_id, resource_type, title, url, metadata, is_published)
  SELECT
    v_inst_id,
    e.id,
    'manual_pdf',
    ref.title || ' – External reference PDF',
    ref.pdf_url,
    jsonb_build_object(
      'source_institution', ref.source_name,
      'publisher_page', ref.source_page,
      'provenance', 'external_public_reference',
      'hosting', 'Hosted by the original educational publisher. LABVERSE links to the source and does not claim authorship or redistribute the file.'
    ),
    true
  FROM (
    VALUES
      (v_subj_phy101, 1, 'Simple Pendulum – Acceleration due to Gravity',
       'https://scce.ac.in/noticeboard/10969_21122017SIMPLE_PENDULUM.pdf',
       'SCCE – Kinematics and Dynamics Lab Manual', 'https://scce.ac.in/'),
      (v_subj_ece201, 1, 'PN Junction Diode – Forward Bias Characteristics',
       'https://mits.ac.in/assets/pdf/ece/EED%20Lab%20Manual.pdf',
       'MITS – Electronic Devices and Circuits Lab Manual', 'https://mits.ac.in/'),
      (v_subj_ece301, 1, 'BJT Common Emitter Characteristics',
       'https://iitr.ac.in/Academics/static/Department/Physics/Analog%20Electronics/BJT_Characteristics.pdf',
       'IIT Roorkee – Analog Electronics Teaching Laboratory',
       'https://iitr.ac.in/Departments/Physics%20Department/Academics/Teaching%20Laboratories.html'),
      (v_subj_ece401, 2, 'ADC Sensor Interfacing & Serial Telemetry Acquisition',
       'https://iitr.ac.in/Academics/static/Department/Physics/Microcontroller%20Lab/ADC.pdf',
       'IIT Roorkee – Microcontroller Laboratory',
       'https://iitr.ac.in/Departments/Physics%20Department/Academics/Teaching%20Laboratories.html')
  ) AS ref(subject_id, exp_number, title, pdf_url, source_name, source_page)
  JOIN public.experiments e
    ON e.subject_id = ref.subject_id AND e.exp_number = ref.exp_number
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.experiment_resources er
    WHERE er.experiment_id = e.id
      AND er.resource_type = 'manual_pdf'
      AND er.url = ref.pdf_url
  );

  -- 8. Map ECE + Related Courses to seeded experiments cleanly (preserving any existing mappings)
  INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
  SELECT v_inst_id, e.id, c.id
  FROM public.experiments e
  JOIN public.practical_subjects s ON s.id = e.subject_id
  JOIN public.courses c ON c.institution_id = v_inst_id
  WHERE e.institution_id = v_inst_id
    AND s.code IN ('EEE-101L', 'ECE-201L', 'ECE-202L', 'ECE-301L', 'ECE-302L', 'ECE-401L', 'ECE-402L')
    AND c.code IN ('ECE', 'EEE')
  ON CONFLICT (experiment_id, course_id) DO NOTHING;

  INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
  SELECT v_inst_id, e.id, c.id
  FROM public.experiments e
  JOIN public.practical_subjects s ON s.id = e.subject_id
  JOIN public.courses c ON c.institution_id = v_inst_id
  WHERE e.institution_id = v_inst_id
    AND s.code IN ('HSS-101L', 'HSS-301L')
    AND c.code IN ('CSE', 'IT', 'ECE', 'MECH')
  ON CONFLICT (experiment_id, course_id) DO NOTHING;

  INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
  SELECT v_inst_id, e.id, c.id
  FROM public.experiments e
  JOIN public.practical_subjects s ON s.id = e.subject_id
  JOIN public.courses c ON c.institution_id = v_inst_id
  WHERE e.institution_id = v_inst_id
    AND s.code IN ('PHY-101L', 'CHM-101L')
    AND c.code IN ('ECE', 'EEE', 'CSE', 'IT', 'MECH')
  ON CONFLICT (experiment_id, course_id) DO NOTHING;

  -- 9. Seed Sample PC Lab Computers & Maintenance History (strictly inside COMP-PC-01)
  IF v_lab_pc IS NOT NULL THEN
    INSERT INTO public.pc_lab_computers (
      institution_id, lab_id, computer_code, hostname, computer_type,
      processor, ram, storage, operating_system, location,
      assigned_staff_name, assigned_department, specs_summary, status, maintenance_status
    )
    VALUES
      (v_inst_id, v_lab_pc, 'MVIT-PCLAB-01', 'mvit-pclab-ws01', 'student_computer', 'Intel Core i5-12400', '16 GB DDR4', '512 GB NVMe SSD', 'Ubuntu 22.04 LTS / Windows 11', 'Row A - Desk 01', '', '', 'Core i5-12400 · 16GB RAM · 512GB NVMe', 'working', 'operational'),
      (v_inst_id, v_lab_pc, 'MVIT-PCLAB-02', 'mvit-pclab-ws02', 'student_computer', 'Intel Core i5-12400', '16 GB DDR4', '512 GB NVMe SSD', 'Ubuntu 22.04 LTS / Windows 11', 'Row A - Desk 02', '', '', 'Core i5-12400 · 16GB RAM · 512GB NVMe', 'working', 'operational'),
      (v_inst_id, v_lab_pc, 'MVIT-PCLAB-03', 'mvit-pclab-ws03', 'student_computer', 'Intel Core i5-12400', '16 GB DDR4', '512 GB NVMe SSD', 'Windows 11 Pro', 'Row A - Desk 03', '', '', 'Core i5-12400 · 16GB RAM · 512GB NVMe', 'working', 'operational'),
      (v_inst_id, v_lab_pc, 'MVIT-PCLAB-04', 'mvit-pclab-ws04', 'student_computer', 'Intel Core i5-11400', '16 GB DDR4', '512 GB SATA SSD', 'Windows 11 Pro', 'Row B - Desk 04', '', '', 'Core i5-11400 · 16GB RAM · 512GB SSD', 'defective', 'awaiting_service'),
      (v_inst_id, v_lab_pc, 'MVIT-PCLAB-05', 'mvit-pclab-ws05', 'student_computer', 'Intel Core i5-11400', '16 GB DDR4', '512 GB SATA SSD', 'Ubuntu 22.04 LTS', 'Row B - Desk 05', '', '', 'Core i5-11400 · 16GB RAM · 512GB SSD', 'under_maintenance', 'in_repair'),
      (v_inst_id, v_lab_pc, 'MVIT-STAFF-01', 'mvit-staff-cse01', 'staff_computer', 'Intel Core i7-13700', '32 GB DDR5', '1 TB NVMe SSD', 'Windows 11 Pro', 'PC Lab Faculty Console Desk', 'Dr. M. Kavitha', 'CSE', 'Core i7-13700 · 32GB DDR5 · 1TB NVMe', 'working', 'operational'),
      (v_inst_id, v_lab_pc, 'MVIT-STAFF-02', 'mvit-staff-asst01', 'staff_computer', 'Intel Core i7-12700', '16 GB DDR4', '1 TB NVMe SSD', 'Ubuntu 22.04 LTS', 'PC Lab Assistant Control Booth', 'K. Aravind', 'IT & Computing', 'Core i7-12700 · 16GB RAM · 1TB NVMe', 'working', 'operational')
    ON CONFLICT (institution_id, computer_code) DO NOTHING;

    SELECT id INTO v_pc_04 FROM public.pc_lab_computers WHERE institution_id = v_inst_id AND computer_code = 'MVIT-PCLAB-04' LIMIT 1;
    SELECT id INTO v_pc_05 FROM public.pc_lab_computers WHERE institution_id = v_inst_id AND computer_code = 'MVIT-PCLAB-05' LIMIT 1;

    IF v_pc_04 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pc_lab_maintenance_records WHERE computer_id = v_pc_04) THEN
      INSERT INTO public.pc_lab_maintenance_records (
        institution_id, lab_id, computer_id, reported_issue, defect_description,
        date_reported, repair_status, maintenance_remarks
      ) VALUES (
        v_inst_id, v_lab_pc, v_pc_04,
        'SMPS Power Supply Failure & No POST',
        'DEMO RECORD: Workstation failed to power on during morning lab inspection; awaiting replacement PSU.',
        CURRENT_DATE - INTERVAL '3 days',
        'defective',
        'Tagged out of service until PSU swap completes.'
      );
    END IF;

    IF v_pc_05 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.pc_lab_maintenance_records WHERE computer_id = v_pc_05) THEN
      INSERT INTO public.pc_lab_maintenance_records (
        institution_id, lab_id, computer_id, reported_issue, defect_description,
        date_reported, repair_status, maintenance_remarks
      ) VALUES (
        v_inst_id, v_lab_pc, v_pc_05,
        'NVMe Boot Drive Corruption & OS Re-imaging',
        'DEMO RECORD: Dual-boot GRUB bootloader corrupted; workstation under bench recovery.',
        CURRENT_DATE - INTERVAL '2 days',
        'under_maintenance',
        'Disk health check passed; Ubuntu 22.04 LTS image deployment in progress.'
      );
    END IF;
  END IF;
END $$;
