-- LABVERSE UX and Animation practical track: four year-wise published experiments.
-- Idempotent: safe to apply more than once.

DO $$
DECLARE
  v_institution_id uuid;
  v_term_id uuid;
  v_department_id uuid;
  v_lab_id uuid;
  v_course_id uuid;
  v_subject_id uuid;
  v_experiment_id uuid;
  v_row record;
  v_course_code text;
  v_manual_url text := 'https://xppklywqcffewljoswog.supabase.co/functions/v1/labverse-ux-manual';
  v_external_reference_url text := 'https://www.dsource.in/sites/default/files/course/principles-animation/downloads/file/Course-Principles-animation_new_version_Final.pdf';
BEGIN
  SELECT id INTO v_institution_id
  FROM public.institutions
  WHERE active = true
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_term_id
  FROM public.academic_terms
  WHERE institution_id = v_institution_id AND is_current = true
  ORDER BY created_at
  LIMIT 1;

  SELECT id INTO v_department_id
  FROM public.departments
  WHERE institution_id = v_institution_id AND upper(code) = 'CSE'
  ORDER BY created_at
  LIMIT 1;

  IF v_institution_id IS NULL OR v_term_id IS NULL OR v_department_id IS NULL THEN
    RAISE EXCEPTION 'LABVERSE institution, current academic term, or CSE department is missing; UX track seed was not applied.';
  END IF;

  INSERT INTO public.labs (
    institution_id, department_id, lab_code, name, description,
    building, room_number, location, capacity, status, display_order, lab_type, is_public
  )
  VALUES (
    v_institution_id, v_department_id, 'UXL-01', 'Digital Design & Interaction Lab',
    'Public practical workspace for visual motion, animation, human-computer interaction, usability testing, and inclusive interface design. Illustrative hackathon learning track.',
    'Digital Learning Studio', 'UX Lab 01', 'Digital Design Studio', 36, 'active', 4, 'practical', true
  )
  ON CONFLICT (institution_id, lab_code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = 'active',
    lab_type = 'practical',
    is_public = true,
    updated_at = now()
  RETURNING id INTO v_lab_id;

  FOR v_course_code IN SELECT unnest(ARRAY['CSE', 'IT']) LOOP
    SELECT id INTO v_course_id
    FROM public.courses
    WHERE institution_id = v_institution_id AND code = v_course_code AND is_active = true
    LIMIT 1;

    IF v_course_id IS NOT NULL THEN
      INSERT INTO public.laboratory_courses (institution_id, lab_id, course_id)
      VALUES (v_institution_id, v_lab_id, v_course_id)
      ON CONFLICT (lab_id, course_id) DO NOTHING;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT *
    FROM (VALUES
      ('UXA-101L', 'Visual Motion & Animation Fundamentals (Demo)', 2, 'Year 1: Motion Foundations', 'Create a bouncing-ball motion study',
       'Create and evaluate a short bouncing-ball animation that demonstrates squash and stretch, anticipation, staging, pose-to-pose planning, follow-through, easing, arcs, secondary action, timing, exaggeration, solid form, and appeal.',
       'The 12 traditional animation principles provide a vocabulary for readable motion. Key poses establish the action; in-between frames control timing. A ball accelerates under gravity, deforms at impact, and recovers while preserving a convincing sense of volume. This exercise treats the supplied 20-principle list as the track rubric; principles 13–20 are introduced as interface-design extensions.',
       '12 principles of animation bouncing ball tutorial',
       'https://www.dsource.in/course/principles-animation',
       'Animation craft reference: D''Source / IDC IIT Bombay Principles of Animation PDF.',
       '[{"step":1,"title":"Storyboard","instruction":"Draw at least five key poses: rest, anticipation, fall, impact, and rebound. Mark the intended screen focus."},{"step":2,"title":"Block the motion","instruction":"Create a pose-to-pose timeline with evenly spaced keyframes, then add in-betweens."},{"step":3,"title":"Apply motion principles","instruction":"Add squash and stretch at impact, a small anticipation wind-up, an arcing path, follow-through, and a restrained secondary action."},{"step":4,"title":"Tune timing","instruction":"Use slow-in/slow-out easing for the fall and rebound. Compare a snappy version with a slow version."},{"step":5,"title":"Review appeal and form","instruction":"Check volume, perspective, silhouette clarity, staging, and whether exaggerated feedback remains readable."},{"step":6,"title":"Record evidence","instruction":"Export a short clip or GIF and annotate the timeline with the principles used."}]',
       '[{"key":"keyframes","header":"Key poses","unit":"count"},{"key":"duration","header":"Animation duration","unit":"seconds"},{"key":"impact_frames","header":"Impact hold","unit":"frames"},{"key":"review_score","header":"Principles demonstrated","unit":"/12"}]',
       '[{"keyframes":"5","duration":"3.0","impact_frames":"2","review_score":"12"}]',
       'A short, readable bouncing-ball animation is produced. The learner explains at least six animation principles and identifies where all 12 craft principles appear in the timeline.'),
      ('UXA-201L', 'Human-Computer Interaction & Interface Usability (Demo)', 4, 'Year 2: Touch Targets and Choice Architecture', 'Measure and improve touch-target and menu usability',
       'Measure how target size and menu choice count affect the speed and accuracy of selecting interface controls.',
       'Fitts''s Law models pointing time as a function of target distance and width. Hick-Hyman Law relates decision time to the number and uncertainty of choices. This practical also examines larger hit areas, cognitive load (Miller''s law as a design heuristic), familiar conventions (Jakob''s law), and repeated tasks.',
       'Fitts law Hick Hyman law interface usability experiment',
       'https://hci-iitg.vlabs.ac.in/Fitts.html',
       'HCI virtual laboratory reference for Fitts''s Law and Hick-Hyman Law.',
       '[{"step":1,"title":"Prepare variants","instruction":"Create two equivalent screens: one with small targets and one with enlarged hit areas. Keep labels and visual style constant."},{"step":2,"title":"Measure Fitts tasks","instruction":"Have participants select targets at different distances and widths. Record movement time and misses; do not collect names or sensitive details."},{"step":3,"title":"Measure choice complexity","instruction":"Create menus with 2, 4, 8, and 16 choices. Record selection time and wrong choices for the same task."},{"step":4,"title":"Apply UX principles","instruction":"Compare larger hit areas, chunked choices, familiar layout conventions, and the effect of frequently used controls being easy to reach."},{"step":5,"title":"Analyse results","instruction":"Calculate mean task time and error rate for each variant. Plot target width versus time and choice count versus decision time."},{"step":6,"title":"Report design changes","instruction":"Recommend a target size and menu structure based on observed evidence, not preference alone."}]',
       '[{"key":"target_width","header":"Target width","unit":"pixels"},{"key":"distance","header":"Pointer distance","unit":"pixels"},{"key":"choices","header":"Menu choices","unit":"count"},{"key":"time","header":"Mean selection time","unit":"seconds"},{"key":"errors","header":"Selection errors","unit":"count"}]',
       '[{"target_width":"24","distance":"320","choices":"8","time":"1.42","errors":"3"},{"target_width":"48","distance":"320","choices":"8","time":"1.01","errors":"1"}]',
       'The learner submits a comparison of target sizes and menu structures with measured selection times, error rates, and a justified accessibility-oriented recommendation.'),
      ('UXA-301L', 'Motion Feedback & Interaction Evaluation (Demo)', 6, 'Year 3: Feedback, Timing and Interaction Quality', 'Evaluate motion feedback and perceived responsiveness',
       'Build and evaluate interface micro-interactions that communicate loading, success, error, and state changes without delaying user work.',
       'Motion can stage attention, communicate cause and effect, and provide secondary feedback. Short and consistent response times support perceived responsiveness. The Doherty threshold is treated as a historical interaction-design guideline rather than a universal guarantee; actual task timing and participant perception must be measured. Postel''s law is considered for robust input handling, with clear validation and error recovery.',
       'UX microinteractions motion feedback usability evaluation',
       'https://hci-iitg.vlabs.ac.in/introduction_expt.html',
       'HCI user testing reference for structured usability evaluation; pair it with a timing study of motion feedback.',
       '[{"step":1,"title":"Define states","instruction":"List loading, success, warning, error, and disabled states for a simple form or upload flow."},{"step":2,"title":"Prototype feedback","instruction":"Create a no-motion baseline and a motion version using easing, follow-through, secondary action, and clear staging."},{"step":3,"title":"Measure response","instruction":"Measure from action to visible acknowledgement and to task completion. Record animation duration separately from system response."},{"step":4,"title":"Test robustness","instruction":"Try empty, malformed, repeated, and unexpected inputs. Provide understandable validation and recovery rather than silently accepting invalid data."},{"step":5,"title":"Run a usability review","instruction":"Ask participants to complete the same task in both variants. Record task time, errors, clarity ratings, and distracting-motion feedback."},{"step":6,"title":"Refine","instruction":"Remove animation that blocks action; make important feedback noticeable, brief, and accessible with a reduced-motion alternative."}]',
       '[{"key":"variant","header":"Prototype variant"},{"key":"ack_time","header":"Time to acknowledgement","unit":"ms"},{"key":"task_time","header":"Task completion time","unit":"seconds"},{"key":"errors","header":"Errors","unit":"count"},{"key":"clarity","header":"Feedback clarity","unit":"/5"}]',
       '[{"variant":"Baseline","ack_time":"180","task_time":"14.2","errors":"2","clarity":"3"},{"variant":"Motion","ack_time":"120","task_time":"12.8","errors":"1","clarity":"4"}]',
       'A prototype and short evaluation report compare feedback clarity, task completion, errors, and perceived responsiveness. The learner includes a reduced-motion option and explains trade-offs.'),
      ('UXA-401L', 'Integrated UX & Motion Design Capstone (Demo)', 8, 'Year 4: Integrated UX and Motion Capstone', 'Build and evaluate an integrated UX and motion prototype',
       'Design, prototype, and evaluate an end-to-end interface flow that combines motion design, accessibility, predictable navigation, robust input handling, and measured usability.',
       'This capstone integrates all 20 supplied principles. Animation principles guide staging, poses, arcs, timing, form, follow-through, and appeal. UX principles guide target size, choice complexity, cognitive load, responsive feedback, tolerant input, familiar conventions, and frequency-based prioritisation. The principles are applied as design prompts and validated through user tasks.',
       'UX design prototype usability testing motion design capstone',
       'https://new.vlab.co.in/computer-science-and-engineering/creative-design-prototyping-experiential-lab-111',
       'HCI consistency reference for evaluating familiar and predictable interface patterns.',
       '[{"step":1,"title":"Choose a user task","instruction":"Select a realistic flow such as locating an experiment, opening its manual, and launching a simulation."},{"step":2,"title":"Map the journey","instruction":"Sketch task stages and identify the primary action, decision points, repeated controls, and likely input errors."},{"step":3,"title":"Build the visual system","instruction":"Create a coherent 2D/3D visual language with clear focus, appealing composition, stable forms, and consistent controls."},{"step":4,"title":"Add motion","instruction":"Use anticipation, pose-to-pose, squash and stretch where appropriate, arcs, easing, follow-through, secondary actions, and clear state feedback."},{"step":5,"title":"Apply interaction rules","instruction":"Use large hit areas, reduce unnecessary choices, group related options, preserve familiar patterns, accept recoverable input variations, and prioritise frequent actions."},{"step":6,"title":"Evaluate","instruction":"Run at least five task-based trials where practical. Record completion time, errors, misclicks, task success, and participant comments without collecting identifying data."},{"step":7,"title":"Iterate and present","instruction":"Compare the first and revised prototype, explain changes using the 20 principles, and provide a reduced-motion and keyboard-accessible path."}]',
       '[{"key":"success","header":"Task success rate","unit":"%"},{"key":"time","header":"Median task time","unit":"seconds"},{"key":"errors","header":"User errors","unit":"count"},{"key":"misclicks","header":"Misclicks","unit":"count"},{"key":"accessibility","header":"Accessibility checks passed","unit":"count"}]',
       '[{"success":"90","time":"38","errors":"1","misclicks":"2","accessibility":"8"}]',
       'A functioning interactive prototype, test summary, revised design, and rationale mapping all 20 principles to concrete interface and motion decisions are presented.')
    ) AS x(code, subject_name, semester, year_topic, experiment_title, subject_description, experiment_theory, video_query, simulation_url, resource_note, procedure_json, observation_json, sample_json, expected_result)
  LOOP
    INSERT INTO public.practical_subjects (
      institution_id, lab_id, department_id, term_id, code, name, credits,
      semester, description, schedule_info, location, is_active, course_id
    )
    VALUES (
      v_institution_id, v_lab_id, v_department_id, v_term_id, v_row.code,
      v_row.subject_name, 2, v_row.semester,
      'DEMO / ILLUSTRATIVE CONTENT: ' || v_row.subject_description,
      'Flexible digital studio practical', 'Digital Design Studio', true, NULL
    )
    ON CONFLICT (institution_id, code) DO UPDATE SET
      lab_id = EXCLUDED.lab_id,
      department_id = EXCLUDED.department_id,
      term_id = EXCLUDED.term_id,
      name = EXCLUDED.name,
      semester = EXCLUDED.semester,
      description = EXCLUDED.description,
      schedule_info = EXCLUDED.schedule_info,
      location = EXCLUDED.location,
      is_active = true
    RETURNING id INTO v_subject_id;

    INSERT INTO public.experiments (
      institution_id, subject_id, exp_number, title, slug, aim, theory,
      learning_objectives, components_required, equipment_required, procedure,
      observation_headers, sample_observations, expected_result, precautions,
      manual_content, manual_doc_name, manual_pdf_url, manual_pdf_name,
      youtube_url, youtube_video_id, youtube_search_url, bench_twin_url,
      bench_twin_mode, simulator_type, simulation_url, simulation_provider,
      simulation_type, simulation_note, resource_status, last_verified_at,
      is_published
    )
    VALUES (
      v_institution_id, v_subject_id, 1, v_row.experiment_title,
      lower(replace(v_row.code, '-', '-')) || '-experiment-1',
      v_row.subject_description,
      v_row.experiment_theory,
      jsonb_build_array(
        'Apply the relevant animation and UX principles in a practical prototype.',
        'Record measurable observations and explain design trade-offs.',
        'Produce an evidence-based improvement and a short practical report.'
      ),
      '[{"name":"Design storyboard or interface sketch","quantity":"1 set","spec":"Paper or digital wireframe"},{"name":"Prototype assets","quantity":"As required","spec":"Shapes, text, icons, and interface components"}]'::jsonb,
      '[{"name":"Computer with browser","model":"Desktop or laptop","spec":"Any modern browser and a drawing/prototyping tool"},{"name":"Timer or screen recorder","model":"Software tool","spec":"For recording task time and prototype evidence"}]'::jsonb,
      v_row.procedure_json::jsonb,
      v_row.observation_json::jsonb,
      v_row.sample_json::jsonb,
      v_row.expected_result,
      jsonb_build_array(
        'Use fictional or consented participants only; do not record names or sensitive personal information.',
        'Provide a reduced-motion alternative for motion-heavy prototypes.',
        'Do not treat sample observations as measured results; collect actual observations during the practical.'
      ),
      'DEMO / ILLUSTRATIVE PRACTICAL. ' || v_row.expected_result,
      'LABVERSE-UX-and-Animation-Practical-Manual.pdf',
      v_manual_url,
      'Principles-of-Animation-IIT-Bombay-Reference.pdf',
      '',
      NULL,
      'https://www.youtube.com/results?search_query=' || replace(v_row.video_query, ' ', '+'),
      v_row.simulation_url,
      'external',
      'custom',
      v_row.simulation_url,
      'virtual_labs',
      'external',
      v_row.resource_note,
      'verified',
      now(),
      true
    )
    ON CONFLICT (subject_id, exp_number) DO UPDATE SET
      title = EXCLUDED.title,
      slug = EXCLUDED.slug,
      aim = EXCLUDED.aim,
      theory = EXCLUDED.theory,
      learning_objectives = EXCLUDED.learning_objectives,
      components_required = EXCLUDED.components_required,
      equipment_required = EXCLUDED.equipment_required,
      procedure = EXCLUDED.procedure,
      observation_headers = EXCLUDED.observation_headers,
      sample_observations = EXCLUDED.sample_observations,
      expected_result = EXCLUDED.expected_result,
      precautions = EXCLUDED.precautions,
      manual_content = EXCLUDED.manual_content,
      manual_doc_name = EXCLUDED.manual_doc_name,
      manual_pdf_url = EXCLUDED.manual_pdf_url,
      manual_pdf_name = EXCLUDED.manual_pdf_name,
      youtube_search_url = EXCLUDED.youtube_search_url,
      bench_twin_url = EXCLUDED.bench_twin_url,
      bench_twin_mode = EXCLUDED.bench_twin_mode,
      simulator_type = EXCLUDED.simulator_type,
      simulation_url = EXCLUDED.simulation_url,
      simulation_provider = EXCLUDED.simulation_provider,
      simulation_type = EXCLUDED.simulation_type,
      simulation_note = EXCLUDED.simulation_note,
      resource_status = EXCLUDED.resource_status,
      last_verified_at = EXCLUDED.last_verified_at,
      is_published = true,
      updated_at = now()
    RETURNING id INTO v_experiment_id;

    FOR v_course_code IN SELECT unnest(ARRAY['CSE', 'IT']) LOOP
      SELECT id INTO v_course_id
      FROM public.courses
      WHERE institution_id = v_institution_id AND code = v_course_code AND is_active = true
      LIMIT 1;

      IF v_course_id IS NOT NULL THEN
        INSERT INTO public.experiment_courses (institution_id, experiment_id, course_id)
        VALUES (v_institution_id, v_experiment_id, v_course_id)
        ON CONFLICT (experiment_id, course_id) DO NOTHING;
      END IF;
    END LOOP;

    -- Keep one published source PDF link plus the relevant interactive HCI source.
    IF NOT EXISTS (
      SELECT 1 FROM public.experiment_resources
      WHERE experiment_id = v_experiment_id AND resource_type = 'manual_pdf' AND url = v_manual_url
    ) THEN
      INSERT INTO public.experiment_resources (
        institution_id, experiment_id, resource_type, title, url, metadata, is_published
      )
      VALUES (
        v_institution_id, v_experiment_id, 'manual_pdf',
        'LABVERSE UX & Animation Practical Manual',
        v_manual_url,
        jsonb_build_object('note', 'Original LABVERSE companion manual covering the user-supplied 20 principles and all four year-wise experiments.'),
        true
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.experiment_resources
      WHERE experiment_id = v_experiment_id AND resource_type = 'bench_twin' AND url = v_row.simulation_url
    ) THEN
      INSERT INTO public.experiment_resources (
        institution_id, experiment_id, resource_type, title, url, metadata, is_published
      )
      VALUES (
        v_institution_id, v_experiment_id, 'bench_twin',
        'HCI virtual lab / interaction design reference',
        v_row.simulation_url,
        jsonb_build_object('note', v_row.resource_note, 'launch_mode', 'external'),
        true
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.experiment_resources
      WHERE experiment_id = v_experiment_id AND resource_type = 'manual_pdf' AND url = v_external_reference_url
    ) THEN
      INSERT INTO public.experiment_resources (
        institution_id, experiment_id, resource_type, title, url, metadata, is_published
      )
      VALUES (
        v_institution_id, v_experiment_id, 'manual_pdf',
        'D''Source / IDC, IIT Bombay - Principles of Animation reference PDF',
        v_external_reference_url,
        jsonb_build_object('note', 'Supplementary source for the traditional 12 animation principles; the full 20-principle practical is the original LABVERSE companion manual.'),
        true
      );
    END IF;
  END LOOP;
END $;
