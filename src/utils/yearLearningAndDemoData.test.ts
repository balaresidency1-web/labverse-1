import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getYearFromSemester,
  formatAcademicYearLabel,
  getAcademicYearConfigs,
  getSubjectsForLabCourseAndYear,
  getAcademicYearStats,
  getExperimentsForLabCourseSubject,
  validateYouTubeUrl,
  isExperimentVideoAvailable,
  isExperimentSimulationAvailable,
  calculatePcLabSummaryStats,
  categorizePcComputers,
} from './labRules';
import {
  INITIAL_LABS,
  INITIAL_COURSES,
  INITIAL_SUBJECTS,
  INITIAL_EXPERIMENTS,
  INITIAL_DOCUMENTS,
  INITIAL_EXPERIMENT_COURSES,
  INITIAL_PC_COMPUTERS,
  INITIAL_PC_MAINTENANCE_RECORDS,
  SAMPLE_PROFILES,
} from '../data/initialData';
import {
  buildDemoManualContentText,
  generateDemoManualPdfDataUrl,
  generateDemoSyllabusPdfDataUrl,
  generateProfessionalPdfBlob,
} from './pdfGenerator';

function decodeDataUrlPdf(dataUrl: string): string {
  assert.ok(dataUrl.startsWith('data:application/pdf;base64,'), 'Must be a valid PDF data URL');
  const b64 = dataUrl.slice('data:application/pdf;base64,'.length);
  return Buffer.from(b64, 'base64').toString('latin1');
}

test('getYearFromSemester maps standard 8 semesters into Years 1..4 cleanly', () => {
  assert.equal(getYearFromSemester(1), 1);
  assert.equal(getYearFromSemester(2), 1);
  assert.equal(getYearFromSemester(3), 2);
  assert.equal(getYearFromSemester(4), 2);
  assert.equal(getYearFromSemester(5), 3);
  assert.equal(getYearFromSemester(6), 3);
  assert.equal(getYearFromSemester(7), 4);
  assert.equal(getYearFromSemester(8), 4);

  // Configurable future course structure (e.g. 3 semesters/year)
  assert.equal(getYearFromSemester(1, 3), 1);
  assert.equal(getYearFromSemester(3, 3), 1);
  assert.equal(getYearFromSemester(4, 3), 2);
});

test('getAcademicYearConfigs defaults to 4-year B.Tech structure and supports overrides', () => {
  const defaultConfigs = getAcademicYearConfigs(null);
  assert.equal(defaultConfigs.length, 4);
  assert.equal(defaultConfigs[0].label, '1st Year');
  assert.equal(defaultConfigs[0].semesterLabel, 'Semesters 1 & 2');
  assert.equal(defaultConfigs[3].label, '4th Year');
  assert.equal(defaultConfigs[3].semesterLabel, 'Semesters 7 & 8');

  const customCourse = getAcademicYearConfigs({ academic_years_count: 3, semesters_per_year: 2 });
  assert.equal(customCourse.length, 3);
  assert.equal(formatAcademicYearLabel(4), '4th Year');
});

test('Year-wise filtering strictly returns selected year subjects (never falls back to other years)', () => {
  const publishedSubjs = INITIAL_SUBJECTS.filter((s) => s.is_active !== false);
  const publishedExps = INITIAL_EXPERIMENTS.filter((e) => e.is_published);

  // ECE Year 1 inside PSL-01 -> PHY-101L & CHM-101L
  const eceYear1Psl = getSubjectsForLabCourseAndYear(
    'lab-mvit-psl-01',
    'course-mvit-ece',
    1,
    publishedSubjs,
    publishedExps,
    INITIAL_EXPERIMENT_COURSES
  );
  assert.ok(eceYear1Psl.some((s) => s.code === 'PHY-101L'));
  assert.ok(eceYear1Psl.some((s) => s.code === 'CHM-101L'));

  // ECE Year 1 inside EDL-01 -> EEE-101L (Year 1 foundational practicals)
  const eceYear1Edl = getSubjectsForLabCourseAndYear(
    'lab-mvit-edl-01',
    'course-mvit-ece',
    1,
    publishedSubjs,
    publishedExps,
    INITIAL_EXPERIMENT_COURSES
  );
  assert.deepEqual(
    eceYear1Edl.map((s) => s.code),
    ['EEE-101L']
  );

  // CSE Year 1 inside PCL-01 -> HSS-101L
  const cseYear1Pcl = getSubjectsForLabCourseAndYear(
    'lab-mvit-pcl-01',
    'course-mvit-cse',
    1,
    publishedSubjs,
    publishedExps,
    INITIAL_EXPERIMENT_COURSES
  );
  assert.deepEqual(
    cseYear1Pcl.map((s) => s.code),
    ['HSS-101L']
  );

  // Every public lab + mapped course has >= 1 published Year 1 subject, experiment, and manual
  const publicLabs = INITIAL_LABS.filter((l) => l.lab_type !== 'pc_lab' && l.is_public !== false);
  for (const lab of publicLabs) {
    for (const courseId of lab.course_ids || []) {
      const y1Subjects = getSubjectsForLabCourseAndYear(
        lab.id,
        courseId,
        1,
        publishedSubjs,
        publishedExps,
        INITIAL_EXPERIMENT_COURSES
      );
      assert.ok(
        y1Subjects.length >= 1,
        `Expected >= 1 Year 1 subject for lab ${lab.lab_code} and course ${courseId}`
      );
      const y1Experiments = y1Subjects.flatMap((s) =>
        getExperimentsForLabCourseSubject(courseId, s.id, publishedExps, INITIAL_EXPERIMENT_COURSES)
      );
      assert.ok(
        y1Experiments.length >= 1,
        `Expected >= 1 Year 1 experiment for lab ${lab.lab_code} and course ${courseId}`
      );
      const y1Manuals = INITIAL_DOCUMENTS.filter(
        (d) =>
          d.is_published &&
          ((d.subject_id && y1Subjects.some((s) => s.id === d.subject_id)) ||
            (d.experiment_id && y1Experiments.some((e) => e.id === d.experiment_id)))
      );
      assert.ok(
        y1Manuals.length >= 1,
        `Expected >= 1 Year 1 PDF manual/syllabus for lab ${lab.lab_code} and course ${courseId}`
      );
    }
  }

  // ECE Year 2, Year 3, Year 4 inside EDL-01 -> strictly scoped to their semesters
  const eceYear2 = getSubjectsForLabCourseAndYear(
    'lab-mvit-edl-01',
    'course-mvit-ece',
    2,
    publishedSubjs,
    publishedExps,
    INITIAL_EXPERIMENT_COURSES
  );
  assert.deepEqual(
    eceYear2.map((s) => s.code).sort(),
    ['ECE-201L', 'ECE-202L']
  );

  const eceYear3 = getSubjectsForLabCourseAndYear(
    'lab-mvit-edl-01',
    'course-mvit-ece',
    3,
    publishedSubjs,
    publishedExps,
    INITIAL_EXPERIMENT_COURSES
  );
  assert.deepEqual(
    eceYear3.map((s) => s.code).sort(),
    ['ECE-301L', 'ECE-302L']
  );

  const eceYear4 = getSubjectsForLabCourseAndYear(
    'lab-mvit-edl-01',
    'course-mvit-ece',
    4,
    publishedSubjs,
    publishedExps,
    INITIAL_EXPERIMENT_COURSES
  );
  assert.deepEqual(
    eceYear4.map((s) => s.code).sort(),
    ['ECE-401L', 'ECE-402L']
  );

  // 4th Year experiments load strictly 4th year experiments (not Year 1-3)
  const year4Exps = getExperimentsForLabCourseSubject(
    'course-mvit-ece',
    eceYear4[0].id,
    publishedExps,
    INITIAL_EXPERIMENT_COURSES
  );
  assert.ok(year4Exps.length >= 2);
  assert.ok(year4Exps.every((e) => e.subject_id === eceYear4[0].id));
});

test('getAcademicYearStats computes accurate dynamic counts and never fabricates empty Live Mode data', () => {
  const edlStats = getAcademicYearStats(
    'lab-mvit-edl-01',
    'course-mvit-ece',
    INITIAL_SUBJECTS,
    INITIAL_EXPERIMENTS,
    INITIAL_EXPERIMENT_COURSES,
    INITIAL_DOCUMENTS
  );
  assert.equal(edlStats.length, 4);
  assert.equal(edlStats[0].subjectCount, 1);
  assert.equal(edlStats[0].experimentCount, 2);
  assert.equal(edlStats[0].manualCount, 2);
  assert.equal(edlStats[1].subjectCount, 2);
  assert.equal(edlStats[1].experimentCount, 4);
  assert.equal(edlStats[1].manualCount, 4);
  assert.equal(edlStats[2].subjectCount, 2);
  assert.equal(edlStats[3].subjectCount, 2);
  assert.equal(edlStats[3].experimentCount, 4);

  // Empty live DB mode -> strictly zeros across all 4 years
  const emptyStats = getAcademicYearStats('lab-live-1', 'course-live-ece', [], [], [], []);
  assert.equal(emptyStats.length, 4);
  assert.ok(emptyStats.every((y) => y.subjectCount === 0 && y.experimentCount === 0 && y.manualCount === 0));
});

test('Demo dataset maintains 4 unique labs, 5 courses, zero duplicate IDs, and honest demo markers', () => {
  assert.equal(INITIAL_LABS.length, 4);
  assert.equal(new Set(INITIAL_LABS.map((l) => l.lab_code)).size, 4);
  assert.equal(INITIAL_COURSES.length, 5);

  assert.equal(new Set(INITIAL_SUBJECTS.map((s) => s.id)).size, INITIAL_SUBJECTS.length);
  assert.equal(new Set(INITIAL_EXPERIMENTS.map((e) => e.id)).size, INITIAL_EXPERIMENTS.length);
  assert.equal(new Set(INITIAL_DOCUMENTS.map((d) => d.id)).size, INITIAL_DOCUMENTS.length);
  assert.equal(
    new Set(INITIAL_EXPERIMENT_COURSES.map((ec) => ec.id)).size,
    INITIAL_EXPERIMENT_COURSES.length
  );

  // All demo entities carry is_demo: true and zero misleading official-approval claims
  assert.ok(INITIAL_SUBJECTS.every((s) => s.is_demo === true));
  assert.ok(INITIAL_EXPERIMENTS.every((e) => e.is_demo === true));
  assert.ok(INITIAL_DOCUMENTS.every((d) => d.is_demo === true));
  for (const doc of INITIAL_DOCUMENTS) {
    assert.ok(!/official mvit/i.test(doc.title), `Unexpected Official MVIT claim in doc: ${doc.title}`);
  }
});

test('Multi-page PDF generator produces valid multi-page Demo Manuals without misleading headers', async () => {
  const pnExp = INITIAL_EXPERIMENTS.find((e) => e.id === 'exp-pn-diode')!;
  assert.ok(pnExp);

  const manualText = buildDemoManualContentText({
    title: pnExp.title,
    subjectCode: pnExp.subject_code,
    expNumber: pnExp.exp_number,
    aim: pnExp.aim,
    theory: pnExp.theory,
    componentsRequired: pnExp.components_required,
    equipmentRequired: pnExp.equipment_required,
    procedure: pnExp.procedure,
    observationHeaders: pnExp.observation_headers,
    sampleObservations: pnExp.sample_observations,
    expectedResult: pnExp.expected_result,
    precautions: pnExp.precautions,
  });
  assert.ok(manualText.includes('1. AIM'));
  assert.ok(manualText.includes('2. THEORY'));
  assert.ok(manualText.includes('3. REQUIRED COMPONENTS & APPARATUS'));
  assert.ok(manualText.includes('STEP-BY-STEP PROCEDURE'));
  assert.ok(manualText.includes('PRECAUTIONS'));

  const dataUrl = generateDemoManualPdfDataUrl({
    title: pnExp.title,
    subjectCode: pnExp.subject_code,
    expNumber: pnExp.exp_number,
    aim: pnExp.aim,
    theory: pnExp.theory,
    componentsRequired: pnExp.components_required,
    equipmentRequired: pnExp.equipment_required,
    procedure: pnExp.procedure,
    observationHeaders: pnExp.observation_headers,
    sampleObservations: pnExp.sample_observations,
    expectedResult: pnExp.expected_result,
    precautions: pnExp.precautions,
  });
  const rawPdf = decodeDataUrlPdf(dataUrl);
  assert.ok(rawPdf.startsWith('%PDF-1.4'));
  assert.ok(rawPdf.includes('%%EOF'));
  assert.ok(rawPdf.includes('DEMO MANUAL - SAMPLE CONTENT'));
  assert.ok(!rawPdf.includes('OFFICIAL LABORATORY MANUAL'));
  assert.ok(!rawPdf.includes('NATIONAL ACCREDITED SYLLABUS'));

  // Long manual forces >= 2 pages
  const longLines = Array.from({ length: 110 }, (_, idx) => `Line ${idx + 1}: Sample procedure detail for multi-page verification.`).join('\n');
  const multi = generateProfessionalPdfBlob({
    title: 'ECE-401L Embedded Lab Sample',
    subjectCode: 'ECE-401L',
    institutionName: 'MVIT Demo',
    content: longLines,
    isDemo: true,
  });
  assert.ok(multi.pageCount >= 2, `Expected >= 2 pages, got ${multi.pageCount}`);
  const blobPdfText = Buffer.from(await multi.blob.arrayBuffer()).toString('latin1');
  assert.ok(blobPdfText.includes(`/Count ${multi.pageCount}`));
  assert.ok(blobPdfText.includes('Page 2 of'));

  // Syllabus PDF data URL also uses demo disclaimer
  const sylUrl = generateDemoSyllabusPdfDataUrl({
    subjectCode: 'ECE-401L',
    subjectName: 'Embedded Systems Lab',
    semester: 7,
    year: 4,
    description: 'Sample syllabus description',
    units: [{ unit_number: 1, title: 'GPIO & Timers', description: 'Interrupt control', learning_outcomes: ['Configure timers'] }],
  });
  const sylRaw = decodeDataUrlPdf(sylUrl);
  assert.ok(sylRaw.includes('DEMO SYLLABUS - SAMPLE CONTENT'));
});

test('YouTube and Simulator availability helpers handle missing/broken resources cleanly', () => {
  assert.equal(isExperimentVideoAvailable({ youtube_url: '' }), false);
  assert.equal(isExperimentVideoAvailable({ youtube_url: 'https://invalid-site.example/watch?v=123' }), false);
  assert.equal(validateYouTubeUrl('https://www.youtube.com/watch?v=MV_v7gT2Q9o').isValid, true);
  assert.equal(isExperimentVideoAvailable({ youtube_url: 'https://www.youtube.com/watch?v=MV_v7gT2Q9o' }), true);

  assert.equal(isExperimentSimulationAvailable({ simulator_type: 'pn_junction' }), true);
  assert.equal(isExperimentSimulationAvailable({ simulator_type: 'pendulum' }), true);
  assert.equal(isExperimentSimulationAvailable({ simulator_type: 'calipers' }), true);
  assert.equal(isExperimentSimulationAvailable({ simulator_type: 'ph_meter' }), true);
  assert.equal(isExperimentSimulationAvailable({ simulator_type: 'custom', bench_twin_url: '' }), false);
  assert.equal(isExperimentSimulationAvailable({ simulator_type: 'custom', bench_twin_url: 'https://phet.colorado.edu/sims/html/ohms-law/latest/ohms-law_en.html' }), true);
});

test('PC Lab demo dataset preserves exact fleet breakdown and categorization', () => {
  const stats = calculatePcLabSummaryStats(INITIAL_PC_COMPUTERS);
  assert.equal(stats.totalComputers, 7);
  assert.equal(stats.workingComputers, 5);
  assert.equal(stats.defectiveComputers, 1);
  assert.equal(stats.underMaintenanceComputers, 1);
  assert.equal(stats.staffComputers, 2);

  const cats = categorizePcComputers(INITIAL_PC_COMPUTERS);
  assert.equal(cats.workingStudent.length, 3);
  assert.equal(cats.defectiveOrMaintenanceStudent.length, 2);
  assert.equal(cats.staffComputers.length, 2);
  assert.equal(INITIAL_PC_MAINTENANCE_RECORDS.length, 2);

  // Verify Quick Demo Access profiles match active staff roles
  const admin = SAMPLE_PROFILES.find((p) => p.id === 'user-mvit-admin');
  const labAsst = SAMPLE_PROFILES.find((p) => p.id === 'user-mvit-labasst');
  const pcLabAsst = SAMPLE_PROFILES.find((p) => p.id === 'user-mvit-pclab-asst');
  assert.equal(admin?.role, 'college_admin');
  assert.equal(labAsst?.role, 'lab_assistant');
  assert.equal(pcLabAsst?.role, 'lab_assistant');
  assert.ok(admin?.status !== 'suspended' && labAsst?.status !== 'suspended' && pcLabAsst?.status !== 'suspended');
});
