import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculatePcLabSummaryStats,
  categorizePcComputers,
  canManagePcLabComputers,
  getCoursesForLab,
  getSubjectsForLabAndCourse,
  getExperimentsForLabCourseSubject,
  normalizeTabForRole,
} from './labRules';
import {
  formatPcComputerQrPayload,
  parsePcComputerQrPayload,
  validatePcQrScanAccess,
} from './qrCodeService';
import { LabverseRepository } from '../services/labverseRepository';

const CANONICAL_MVIT_UUID = 'de34eef0-1cd3-476d-9ef6-d66fff6934e0';
const CANONICAL_PC_LAB_UUID = '11111111-1111-4111-8111-111111111111';
const CANONICAL_COURSE_UUID = '22222222-2222-4222-8222-222222222222';
const CANONICAL_PC_UUID = '33333333-3333-4333-8333-333333333333';
const CANONICAL_MAINT_UUID = '44444444-4444-4444-8444-444444444444';

test('calculatePcLabSummaryStats computes dynamic KPI counts across all PC statuses and categories', () => {
  const computers = [
    { id: 'pc-1', lab_id: 'lab-pc', computer_type: 'student_computer' as const, status: 'working' as const },
    { id: 'pc-2', lab_id: 'lab-pc', computer_type: 'student_computer' as const, status: 'repaired' as const },
    { id: 'pc-3', lab_id: 'lab-pc', computer_type: 'student_computer' as const, status: 'defective' as const },
    { id: 'pc-4', lab_id: 'lab-pc', computer_type: 'student_computer' as const, status: 'under_maintenance' as const },
    { id: 'pc-5', lab_id: 'lab-pc', computer_type: 'staff_computer' as const, status: 'working' as const },
    { id: 'pc-6', lab_id: 'lab-pc', computer_type: 'staff_computer' as const, status: 'defective' as const },
  ];

  const stats = calculatePcLabSummaryStats(computers);
  assert.equal(stats.totalComputers, 6);
  assert.equal(stats.workingComputers, 3); // working + repaired across all
  assert.equal(stats.defectiveComputers, 2);
  assert.equal(stats.underMaintenanceComputers, 1);
  assert.equal(stats.staffComputers, 2);
  assert.equal(stats.workingStudentComputers, 2);
  assert.equal(stats.defectiveStudentComputers, 2);

  const emptyStats = calculatePcLabSummaryStats([]);
  assert.equal(emptyStats.totalComputers, 0);
  assert.equal(emptyStats.workingComputers, 0);
  assert.equal(emptyStats.staffComputers, 0);
});

test('categorizePcComputers strictly separates Working, Defective/Maintenance, and Staff computers', () => {
  const computers = [
    { id: 'pc-w', lab_id: 'lab-pc', computer_type: 'student_computer' as const, status: 'working' as const },
    { id: 'pc-r', lab_id: 'lab-pc', computer_type: 'student_computer' as const, status: 'repaired' as const },
    { id: 'pc-d', lab_id: 'lab-pc', computer_type: 'student_computer' as const, status: 'defective' as const },
    { id: 'pc-m', lab_id: 'lab-pc', computer_type: 'student_computer' as const, status: 'under_maintenance' as const },
    { id: 'pc-s1', lab_id: 'lab-pc', computer_type: 'staff_computer' as const, status: 'working' as const },
    { id: 'pc-s2', lab_id: 'lab-pc', computer_type: 'staff_computer' as const, status: 'defective' as const },
  ];

  const groups = categorizePcComputers(computers);
  assert.deepEqual(groups.workingStudent.map((c) => c.id), ['pc-w', 'pc-r']);
  assert.deepEqual(groups.defectiveOrMaintenanceStudent.map((c) => c.id), ['pc-d', 'pc-m']);
  assert.deepEqual(groups.staffComputers.map((c) => c.id), ['pc-s1', 'pc-s2']);
});

test('normalizeTabForRole enforces PC Lab Assistant vs Practical Lab Assistant vs College Admin tabs', () => {
  assert.equal(normalizeTabForRole('college_admin', 'pc_lab'), 'dashboard');
  assert.equal(normalizeTabForRole('college_admin', 'pc_working'), 'dashboard');
  assert.equal(normalizeTabForRole('college_admin', 'manage_labs'), 'manage_labs');
  assert.equal(normalizeTabForRole('college_admin', 'assignments'), 'assignments');

  assert.equal(normalizeTabForRole('lab_assistant', 'pc_working', 'pc_lab'), 'pc_working');
  assert.equal(normalizeTabForRole('lab_assistant', 'pc_defective', 'pc_lab'), 'pc_defective');
  assert.equal(normalizeTabForRole('lab_assistant', 'pc_staff', 'pc_lab'), 'pc_staff');
  assert.equal(normalizeTabForRole('lab_assistant', 'qr_codes', 'pc_lab'), 'qr_codes');
  assert.equal(normalizeTabForRole('lab_assistant', 'experiments', 'pc_lab'), 'dashboard');

  assert.equal(normalizeTabForRole('lab_assistant', 'pc_working', 'practical'), 'dashboard');
  assert.equal(normalizeTabForRole('lab_assistant', 'experiments', 'practical'), 'experiments');
});

test('Course, Subject, and Experiment drill-down helpers filter cleanly by Lab -> Course -> Subject', () => {
  const courses = [
    { id: 'c-ece', code: 'ECE', is_active: true, display_order: 1 },
    { id: 'c-cse', code: 'CSE', is_active: true, display_order: 2 },
    { id: 'c-old', code: 'OLD', is_active: false, display_order: 3 },
  ];
  const labCourses = [
    { lab_id: 'lab-edl', course_id: 'c-ece' },
    { lab_id: 'lab-edl', course_id: 'c-old' },
  ];

  const edlCourses = getCoursesForLab('lab-edl', courses, labCourses);
  assert.deepEqual(edlCourses.map((c) => c.id), ['c-ece']);

  // Strict mapping: lab with zero configured courses returns [] (never silently returns all courses)
  const unmappedLabCourses = getCoursesForLab('lab-new', courses, labCourses);
  assert.deepEqual(unmappedLabCourses.map((c) => c.id), []);

  const subjects = [
    { id: 's-1', lab_id: 'lab-edl', course_id: 'c-ece', is_active: true },
    { id: 's-2', lab_id: 'lab-edl', is_active: true }, // course derived from mapped experiments
    { id: 's-3', lab_id: 'lab-psl', is_active: true }, // zero mapped experiments -> excluded when course filter active
  ];
  const experiments = [
    { id: 'e-1', subject_id: 's-1', exp_number: 1, is_published: true, course_ids: ['c-ece'] },
    { id: 'e-2', subject_id: 's-2', exp_number: 2, is_published: true },
    { id: 'e-3', subject_id: 's-2', exp_number: 1, is_published: true },
    { id: 'e-4', subject_id: 's-2', exp_number: 3, is_published: false },
    { id: 'e-5', subject_id: 's-2', exp_number: 4, is_published: true }, // intentionally unmapped!
  ];
  const expCourses = [
    { experiment_id: 'e-2', course_id: 'c-ece' },
    { experiment_id: 'e-3', course_id: 'c-cse' },
  ];

  const eceSubjects = getSubjectsForLabAndCourse('lab-edl', 'c-ece', subjects, experiments, expCourses);
  assert.deepEqual(eceSubjects.map((s) => s.id), ['s-1', 's-2']);

  const cseSubjects = getSubjectsForLabAndCourse('lab-edl', 'c-cse', subjects, experiments, expCourses);
  assert.deepEqual(cseSubjects.map((s) => s.id), ['s-2']);

  const pslSubjectsForCse = getSubjectsForLabAndCourse('lab-psl', 'c-cse', subjects, experiments, expCourses);
  assert.deepEqual(pslSubjectsForCse, []);

  // Unmapped e-5 MUST NOT appear under ECE or CSE course-specific filters
  const eceS2Exps = getExperimentsForLabCourseSubject('c-ece', 's-2', experiments, expCourses);
  assert.deepEqual(eceS2Exps.map((e) => e.id), ['e-2']);

  const cseS2Exps = getExperimentsForLabCourseSubject('c-cse', 's-2', experiments, expCourses);
  assert.deepEqual(cseS2Exps.map((e) => e.id), ['e-3']);
});

test('PC QR payload formatting, parsing, and strict staff-only access control', () => {
  const pc = {
    id: CANONICAL_PC_UUID,
    computer_code: 'MVIT-PCLAB-01',
    hostname: 'mvit-pc-01.local',
    institution_id: CANONICAL_MVIT_UUID,
    lab_id: CANONICAL_PC_LAB_UUID,
  };

  const payloadStr = formatPcComputerQrPayload(pc);
  const parsed = parsePcComputerQrPayload(payloadStr);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.computerId, CANONICAL_PC_UUID);
  assert.equal(parsed.computerCode, 'MVIT-PCLAB-01');
  assert.equal(parsed.institutionId, CANONICAL_MVIT_UUID);
  assert.equal(parsed.labId, CANONICAL_PC_LAB_UUID);

  // Public unauthenticated users MUST ALWAYS be blocked from PC Lab internal asset QR lookup
  const publicRes = validatePcQrScanAccess(parsed, null, {
    institution_id: CANONICAL_MVIT_UUID,
    lab_id: CANONICAL_PC_LAB_UUID,
  });
  assert.equal(publicRes.allowed, false);
  assert.match(publicRes.error || '', /restricted|authorized MVIT staff/i);

  // Wrong institution blocked
  const wrongInstAdmin = {
    role: 'college_admin',
    institution_id: '99999999-9999-4999-8999-999999999999',
    assigned_lab_ids: [],
  };
  assert.equal(validatePcQrScanAccess(parsed, wrongInstAdmin).allowed, false);

  // Unassigned lab assistant blocked
  const unassignedAsst = {
    role: 'lab_assistant',
    institution_id: CANONICAL_MVIT_UUID,
    assigned_lab_ids: ['other-lab'],
  };
  assert.equal(validatePcQrScanAccess(parsed, unassignedAsst).allowed, false);

  // Assigned PC lab assistant has full access; College Admin is strictly denied individual PC QR inspection
  const pcAsst = {
    role: 'lab_assistant',
    institution_id: CANONICAL_MVIT_UUID,
    assigned_lab_ids: [CANONICAL_PC_LAB_UUID],
  };
  const pcAsstAccess = validatePcQrScanAccess(parsed, pcAsst);
  assert.equal(pcAsstAccess.allowed, true);
  assert.equal(pcAsstAccess.readOnly, false);

  const admin = {
    role: 'college_admin',
    institution_id: CANONICAL_MVIT_UUID,
    assigned_lab_ids: [],
  };
  const adminAccess = validatePcQrScanAccess(parsed, admin);
  assert.equal(adminAccess.allowed, false);
  assert.match(adminAccess.error || '', /restricted|assigned PC Lab Assistant/i);
});

test('canManagePcLabComputers strictly restricts PC hardware mutations to active assigned PC Lab Assistant', () => {
  const pcLab = { id: CANONICAL_PC_LAB_UUID, lab_type: 'pc_lab', status: 'active' };
  const practicalLab = { id: 'lab-psl', lab_type: 'practical', status: 'active' };

  assert.equal(canManagePcLabComputers(null, pcLab), false);
  assert.equal(
    canManagePcLabComputers({ role: 'college_admin', status: 'active', assigned_lab_ids: [CANONICAL_PC_LAB_UUID] }, pcLab),
    false
  );
  assert.equal(
    canManagePcLabComputers({ role: 'lab_assistant', status: 'active', assigned_lab_ids: ['other-lab'] }, pcLab),
    false
  );
  assert.equal(
    canManagePcLabComputers({ role: 'lab_assistant', status: 'suspended', assigned_lab_ids: [CANONICAL_PC_LAB_UUID] }, pcLab),
    false
  );
  assert.equal(
    canManagePcLabComputers({ role: 'lab_assistant', status: 'active', assigned_lab_ids: ['lab-psl'] }, practicalLab),
    false
  );
  assert.equal(
    canManagePcLabComputers({ role: 'lab_assistant', status: 'active', assigned_lab_ids: [CANONICAL_PC_LAB_UUID] }, pcLab),
    true
  );
});

test('Live LabverseRepository performs Courses & PC Lab CRUD with mocked Supabase and fails closed on DB errors', async () => {
  const insertedCalls: Array<{ table: string; payload: any }> = [];
  const updatedCalls: Array<{ table: string; payload: any }> = [];

  const mockClient: any = {
    from: (table: string) => {
      if (table === 'courses') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                order: async () => ({
                  data: [
                    {
                      id: CANONICAL_COURSE_UUID,
                      institution_id: CANONICAL_MVIT_UUID,
                      code: 'CSE',
                      name: 'Computer Science and Engineering',
                      degree: 'B.Tech',
                      description: 'Computing courses',
                      is_active: true,
                      display_order: 1,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
          insert: (payload: any) => {
            insertedCalls.push({ table, payload });
            return {
              select: () => ({
                single: async () => ({
                  data: { id: CANONICAL_COURSE_UUID, ...payload },
                  error: null,
                }),
              }),
            };
          },
        };
      }
      if (table === 'pc_lab_computers') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                eq: async () => ({
                  data: [
                    {
                      id: CANONICAL_PC_UUID,
                      institution_id: CANONICAL_MVIT_UUID,
                      lab_id: CANONICAL_PC_LAB_UUID,
                      computer_code: 'MVIT-PC-01',
                      hostname: 'mvit-pc-01',
                      computer_type: 'student_computer',
                      operating_system: 'Ubuntu 24.04',
                      location: 'PC Lab Bay A',
                      status: 'working',
                      maintenance_status: 'operational',
                      last_updated: '2026-11-15T00:00:00Z',
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
          insert: (payload: any) => {
            insertedCalls.push({ table, payload });
            return {
              select: () => ({
                single: async () => ({
                  data: { id: CANONICAL_PC_UUID, ...payload },
                  error: null,
                }),
              }),
            };
          },
          update: (payload: any) => {
            updatedCalls.push({ table, payload });
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      if (table === 'pc_lab_maintenance_records') {
        return {
          insert: (payload: any) => {
            insertedCalls.push({ table, payload });
            return {
              select: () => ({
                single: async () => ({
                  data: { id: CANONICAL_MAINT_UUID, ...payload },
                  error: null,
                }),
              }),
            };
          },
          update: (payload: any) => {
            updatedCalls.push({ table, payload });
            return {
              eq: async () => ({ error: null }),
            };
          },
        };
      }
      return {};
    },
  };

  const repo = new LabverseRepository({ isLive: true, client: mockClient });

  const coursesRes = await repo.getCourses(CANONICAL_MVIT_UUID);
  assert.equal(coursesRes.source, 'supabase');
  assert.equal(coursesRes.data?.[0].code, 'CSE');

  const savedCourse = await repo.saveCourse({
    institution_id: CANONICAL_MVIT_UUID,
    code: 'ai',
    name: 'Artificial Intelligence',
    degree: 'B.Tech',
    description: 'AI Lab track',
    is_active: true,
    display_order: 2,
  });
  assert.equal(savedCourse.source, 'supabase');
  assert.equal(savedCourse.data?.code, 'AI');

  const pcsRes = await repo.getPcComputers(CANONICAL_MVIT_UUID, CANONICAL_PC_LAB_UUID);
  assert.equal(pcsRes.source, 'supabase');
  assert.equal(pcsRes.data?.[0].computer_code, 'MVIT-PC-01');

  const savedPc = await repo.savePcComputer({
    institution_id: CANONICAL_MVIT_UUID,
    lab_id: CANONICAL_PC_LAB_UUID,
    computer_code: 'mvit-pc-09',
    hostname: 'mvit-pc-09',
    computer_type: 'student_computer',
    operating_system: 'Windows 11',
    location: 'Bay B',
    status: 'working',
    maintenance_status: 'operational',
    last_updated: '2026-11-15',
  });
  assert.equal(savedPc.source, 'supabase');
  assert.equal(savedPc.data?.computer_code, 'MVIT-PC-09');

  const defectRes = await repo.reportPcDefect({
    institution_id: CANONICAL_MVIT_UUID,
    lab_id: CANONICAL_PC_LAB_UUID,
    computer_id: CANONICAL_PC_UUID,
    reported_issue: 'SMPS power failure',
    defect_description: 'System fails to POST',
    date_reported: '2026-11-15',
    repair_status: 'defective',
    maintenance_remarks: 'Awaiting spare PSU',
    resolution_date: null,
  });
  assert.equal(defectRes.source, 'supabase');
  assert.equal(defectRes.data?.repair_status, 'defective');
  assert.ok(updatedCalls.some((u) => u.table === 'pc_lab_computers' && u.payload.status === 'defective'));

  const repairRes = await repo.updatePcRepairStatus(
    CANONICAL_PC_UUID,
    'repaired',
    'Replaced 500W PSU',
    CANONICAL_MAINT_UUID,
    '2026-11-16'
  );
  assert.equal(repairRes.success, true);
  assert.ok(
    updatedCalls.some(
      (u) => u.table === 'pc_lab_computers' && u.payload.status === 'working' && u.payload.maintenance_status === 'operational'
    )
  );
  assert.ok(
    updatedCalls.some(
      (u) => u.table === 'pc_lab_maintenance_records' && u.payload.repair_status === 'repaired'
    )
  );

  // Fail-closed check when Supabase query returns RLS error
  const errorClient: any = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: null, error: { message: 'RLS denied for anon' } }),
        }),
      }),
    }),
  };
  const errRepo = new LabverseRepository({ isLive: true, client: errorClient });
  const blockedPcs = await errRepo.getPcComputers(CANONICAL_MVIT_UUID);
  assert.equal(blockedPcs.source, 'supabase');
  assert.equal(blockedPcs.data, null);
  assert.match(blockedPcs.error || '', /RLS denied/i);

  // Local maintenance history preservation across multiple defect/repair cycles
  const demoRepo = new LabverseRepository({ isLive: false });
  const d1 = await demoRepo.reportPcDefect({
    institution_id: 'inst-mvit',
    lab_id: 'lab-mvit-pc-01',
    computer_id: 'pc-01',
    reported_issue: 'Display flicker',
    defect_description: 'HDMI cable loose',
    date_reported: '2026-11-10',
    repair_status: 'defective',
    maintenance_remarks: 'Pending inspection',
    resolution_date: null,
  });
  assert.ok(d1.data?.id);
  await demoRepo.updatePcRepairStatus('pc-01', 'repaired', 'Replaced HDMI cable', d1.data!.id, '2026-11-11');
  const d2 = await demoRepo.reportPcDefect({
    institution_id: 'inst-mvit',
    lab_id: 'lab-mvit-pc-01',
    computer_id: 'pc-01',
    reported_issue: 'SSD SMART warning',
    defect_description: 'Slow boot',
    date_reported: '2026-11-15',
    repair_status: 'under_maintenance',
    maintenance_remarks: 'Swapping NVMe drive',
    resolution_date: null,
  });
  const historyRes = await demoRepo.getPcMaintenanceRecords('inst-mvit', 'lab-mvit-pc-01');
  const pc01History = (historyRes.data || []).filter((r) => r.computer_id === 'pc-01');
  assert.ok(pc01History.some((r) => r.id === d1.data!.id && r.repair_status === 'repaired'));
  assert.ok(pc01History.some((r) => r.id === d2.data!.id && r.repair_status === 'under_maintenance'));
});

test('Repository publicOnly queries exclude PC Lab while admin/internal queries retain PC Lab record', async () => {
  const demoRepo = new LabverseRepository({ isLive: false });

  const publicLabsRes = await demoRepo.getLabs('inst-mvit', { publicOnly: true });
  assert.equal(publicLabsRes.data?.length, 3);
  assert.equal(
    publicLabsRes.data?.some((l) => l.lab_type === 'pc_lab' || l.lab_code === 'COMP-PC-01'),
    false
  );

  const allLabsRes = await demoRepo.getLabs('inst-mvit');
  assert.equal(allLabsRes.data?.length, 4);
  assert.equal(
    allLabsRes.data?.some((l) => l.lab_type === 'pc_lab' && l.is_public === false),
    true
  );

  const publicPcLookup = await demoRepo.getLabById('lab-mvit-pc-01', { publicOnly: true });
  assert.equal(publicPcLookup.data, null);

  const staffPcLookup = await demoRepo.getLabById('lab-mvit-pc-01');
  assert.equal(staffPcLookup.data?.lab_code, 'COMP-PC-01');
});

