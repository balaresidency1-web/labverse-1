import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateYouTubeUrl,
  checkBenchTwinEmbedSupport,
  validateInventoryIssue,
  validateInventoryReturn,
  validateInventoryDamage,
  calculateStockStatus,
  formatCountLabel,
  resolveDemoSignInProfile,
  isCollegeAdmin,
  isLabAssistant,
  canAssistantAccessLab,
  normalizeTabForRole,
  isPublicVisibleLab,
  canViewPcLabComputers,
  canManagePcLabComputers,
} from './labRules';

// Existing tests kept intact above...


test('validateYouTubeUrl handles valid YouTube formats', () => {
  const res1 = validateYouTubeUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ');
  assert.equal(res1.isValid, true);
  assert.equal(res1.videoId, 'aqz-KE-bpKQ');

  const res2 = validateYouTubeUrl('https://youtu.be/dQw4w9WgXcQ');
  assert.equal(res2.isValid, true);
  assert.equal(res2.videoId, 'dQw4w9WgXcQ');

  const res3 = validateYouTubeUrl('https://www.youtube.com/embed/jfKfPfyJRdk');
  assert.equal(res3.isValid, true);
  assert.equal(res3.videoId, 'jfKfPfyJRdk');

  const res4 = validateYouTubeUrl('https://youtube.com/shorts/3jz1ZkVx8mQ');
  assert.equal(res4.isValid, true);
  assert.equal(res4.videoId, '3jz1ZkVx8mQ');
});

test('validateYouTubeUrl rejects invalid or non-YouTube domains', () => {
  const invalid1 = validateYouTubeUrl('https://vimeo.com/123456');
  assert.equal(invalid1.isValid, false);
  assert.match(invalid1.error || '', /domains/i);

  const invalid2 = validateYouTubeUrl('not-a-url');
  assert.equal(invalid2.isValid, false);

  const empty = validateYouTubeUrl('');
  assert.equal(empty.isValid, false);
});

test('checkBenchTwinEmbedSupport identifies allowlisted vs external simulation URLs', () => {
  const res1 = checkBenchTwinEmbedSupport('https://benchtwin.com/exp/diode-forward-bias');
  assert.equal(res1.canEmbed, true);
  assert.equal(res1.isSafeUrl, true);

  const res2 = checkBenchTwinEmbedSupport(
    'https://phet.colorado.edu/sims/html/pendulum-lab/latest/pendulum-lab_en.html'
  );
  assert.equal(res2.canEmbed, true);

  const res3 = checkBenchTwinEmbedSupport('https://example.com/untrusted-sim');
  assert.equal(res3.isSafeUrl, true);
  assert.equal(res3.canEmbed, false);
  assert.match(res3.reason, /allowlist/i);

  const res4 = checkBenchTwinEmbedSupport('http://benchtwin.com/insecure');
  assert.equal(res4.canEmbed, false);
  assert.equal(res4.isSafeUrl, false);
});

test('validateInventoryIssue enforces non-negative stock and validates availability', () => {
  const valid = validateInventoryIssue(50, 10);
  assert.equal(valid.canIssue, true);
  assert.equal(valid.remainingQty, 40);

  const exact = validateInventoryIssue(10, 10);
  assert.equal(exact.canIssue, true);
  assert.equal(exact.remainingQty, 0);

  const excess = validateInventoryIssue(10, 15);
  assert.equal(excess.canIssue, false);
  assert.equal(excess.remainingQty, 10);
  assert.match(excess.error || '', /Insufficient inventory/i);

  assert.equal(validateInventoryIssue(10, 0).canIssue, false);
  assert.equal(validateInventoryIssue(10, -5).canIssue, false);
});

test('calculateStockStatus classifies in_stock, low_stock, and out_of_stock accurately', () => {
  assert.equal(calculateStockStatus(15, 5), 'in_stock');
  assert.equal(calculateStockStatus(5, 5), 'low_stock');
  assert.equal(calculateStockStatus(2, 5), 'low_stock');
  assert.equal(calculateStockStatus(0, 5), 'out_of_stock');
  assert.equal(calculateStockStatus(-1, 5), 'out_of_stock');
});

test('validatePdfFile enforces PDF MIME/extension and 15MB file size limit', async () => {
  const { validatePdfFile } = await import('./pdfGenerator');

  const validFile = {
    name: 'MVIT_PSL_Manual.pdf',
    type: 'application/pdf',
    size: 2 * 1024 * 1024,
  } as File;
  assert.equal(validatePdfFile(validFile).isValid, true);

  const oversizedFile = {
    name: 'Huge_Manual.pdf',
    type: 'application/pdf',
    size: 16 * 1024 * 1024,
  } as File;
  const resOversized = validatePdfFile(oversizedFile);
  assert.equal(resOversized.isValid, false);
  assert.match(resOversized.error || '', /15 MB|exceeds/i);

  const invalidTypeFile = {
    name: 'diagram.png',
    type: 'image/png',
    size: 500 * 1024,
  } as File;
  const resInvalid = validatePdfFile(invalidTypeFile);
  assert.equal(resInvalid.isValid, false);
  assert.match(resInvalid.error || '', /PDF file/i);
});

test('validateInventoryReturn prevents returning more than checked-out quantity', () => {
  const valid = validateInventoryReturn(15, 20, 3);
  assert.equal(valid.canReturn, true);
  assert.equal(valid.newAvailable, 18);

  const excess = validateInventoryReturn(18, 20, 5);
  assert.equal(excess.canReturn, false);
  assert.match(excess.error || '', /only 2 units are currently checked out/i);

  const noneOut = validateInventoryReturn(20, 20, 1);
  assert.equal(noneOut.canReturn, false);
  assert.match(noneOut.error || '', /none are checked out/i);

  assert.equal(validateInventoryReturn(15, 20, 0).canReturn, false);
});

test('validateInventoryDamage validates positive qty, non-empty reason, and bounds', () => {
  const valid = validateInventoryDamage(10, 20, 2, 'Cracked glass electrode');
  assert.equal(valid.canWriteOff, true);
  assert.equal(valid.newAvailable, 8);
  assert.equal(valid.newTotal, 18);

  const missingReason = validateInventoryDamage(10, 20, 2, '   ');
  assert.equal(missingReason.canWriteOff, false);
  assert.match(missingReason.error || '', /damage reason/i);

  const exceedsTotal = validateInventoryDamage(10, 20, 25, 'Flood');
  assert.equal(exceedsTotal.canWriteOff, false);
  assert.match(exceedsTotal.error || '', /total inventory is only 20/i);
});

test('formatCountLabel handles singular and plural nouns cleanly', () => {
  assert.equal(formatCountLabel(0, 'lab'), '0 labs');
  assert.equal(formatCountLabel(1, 'lab'), '1 lab');
  assert.equal(formatCountLabel(3, 'lab'), '3 labs');
  assert.equal(formatCountLabel(1, 'Experiment'), '1 Experiment');
  assert.equal(formatCountLabel(2, 'Experiment'), '2 Experiments');
});

test('resolveDemoSignInProfile rejects unknown emails and suspended MVIT staff cleanly', () => {
  const profiles = [
    { id: '1', email: 'principal@mvit.edu.in', role: 'college_admin', status: 'active' },
    { id: '2', email: 'murugan.lab@mvit.edu.in', role: 'lab_assistant', status: 'active' },
    { id: '3', email: 'suspended@mvit.edu.in', role: 'lab_assistant', status: 'suspended' },
  ];

  assert.equal(resolveDemoSignInProfile(profiles, '  ').ok, false);

  const unknown = resolveDemoSignInProfile(profiles, 'nobody@example.com');
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.match(unknown.error, /No staff account found/i);
  }

  const suspended = resolveDemoSignInProfile(profiles, 'SUSPENDED@mvit.edu.in');
  assert.equal(suspended.ok, false);
  if (!suspended.ok) {
    assert.match(suspended.error, /suspended/i);
  }

  const valid = resolveDemoSignInProfile(profiles, '  Murugan.Lab@MVIT.edu.in ');
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.profile.id, '2');
  }
});

test('MVIT 2-role permission helpers and tab normalization enforce role boundaries', () => {
  assert.equal(isCollegeAdmin('college_admin'), true);
  assert.equal(isCollegeAdmin('lab_assistant'), false);
  assert.equal(isLabAssistant('lab_assistant'), true);
  assert.equal(isLabAssistant('college_admin'), false);

  const admin = { role: 'college_admin', assigned_lab_ids: [] };
  const assistant = { role: 'lab_assistant', assigned_lab_ids: ['lab-mvit-psl-01'] };
  assert.equal(canAssistantAccessLab(admin, 'lab-mvit-edl-01'), true);
  assert.equal(canAssistantAccessLab(assistant, 'lab-mvit-psl-01'), true);
  assert.equal(canAssistantAccessLab(assistant, 'lab-mvit-edl-01'), false);

  assert.equal(normalizeTabForRole('college_admin', 'manage_labs'), 'manage_labs');
  assert.equal(normalizeTabForRole('college_admin', 'assistants'), 'assistants');
  assert.equal(normalizeTabForRole('college_admin', 'pc_lab'), 'dashboard');
  assert.equal(normalizeTabForRole('college_admin', 'inventory'), 'dashboard');

  assert.equal(normalizeTabForRole('lab_assistant', 'manage_labs'), 'dashboard');
  assert.equal(normalizeTabForRole('lab_assistant', 'experiments'), 'experiments');
  assert.equal(normalizeTabForRole('lab_assistant', 'qr_codes'), 'qr_codes');
  assert.equal(normalizeTabForRole('lab_assistant', 'bench_twin'), 'bench_twin');
});

test('isPublicVisibleLab excludes PC Lab, is_public=false, and inactive labs', () => {
  assert.equal(
    isPublicVisibleLab({ status: 'active', is_public: true, lab_type: 'practical' }),
    true
  );
  assert.equal(
    isPublicVisibleLab({ status: 'active', is_public: false, lab_type: 'practical' }),
    false
  );
  assert.equal(
    isPublicVisibleLab({ status: 'active', is_public: true, lab_type: 'pc_lab' }),
    false
  );
  assert.equal(
    isPublicVisibleLab({ status: 'active', is_public: false, lab_type: 'pc_lab' }),
    false
  );
  assert.equal(
    isPublicVisibleLab({ status: 'inactive', is_public: true, lab_type: 'practical' }),
    false
  );
  assert.equal(isPublicVisibleLab(null), false);
});

test('PC Lab computer visibility & management are strictly restricted to assigned PC Lab Assistant', () => {
  const pcLab = {
    id: 'lab-mvit-pc-01',
    lab_type: 'pc_lab',
    status: 'active',
    assigned_assistant_id: 'user-mvit-pclab-asst',
  };
  const practicalLab = {
    id: 'lab-mvit-edl-01',
    lab_type: 'practical',
    status: 'active',
    assigned_assistant_id: 'user-mvit-labasst',
  };

  const admin = { id: 'user-mvit-admin', role: 'college_admin', status: 'active', assigned_lab_ids: [] };
  const pcAssistant = {
    id: 'user-mvit-pclab-asst',
    role: 'lab_assistant',
    status: 'active',
    assigned_lab_ids: ['lab-mvit-pc-01'],
  };
  const otherAssistant = {
    id: 'user-mvit-labasst',
    role: 'lab_assistant',
    status: 'active',
    assigned_lab_ids: ['lab-mvit-edl-01'],
  };
  const suspendedPcAssistant = {
    id: 'user-mvit-pclab-asst',
    role: 'lab_assistant',
    status: 'suspended',
    assigned_lab_ids: ['lab-mvit-pc-01'],
  };

  // Public & College Admin cannot view or manage PC Lab computers
  assert.equal(canViewPcLabComputers(null, pcLab), false);
  assert.equal(canManagePcLabComputers(null, pcLab), false);
  assert.equal(canViewPcLabComputers(admin, pcLab), false);
  assert.equal(canViewPcLabComputers(admin), false);
  assert.equal(canManagePcLabComputers(admin, pcLab), false);

  // Unassigned or suspended assistants cannot access PC Lab computers
  assert.equal(canViewPcLabComputers(otherAssistant, pcLab), false);
  assert.equal(canManagePcLabComputers(otherAssistant, pcLab), false);
  assert.equal(canViewPcLabComputers(suspendedPcAssistant, pcLab), false);

  // Assigned PC Lab Assistant retains full view & management on active PC Lab only
  assert.equal(canViewPcLabComputers(pcAssistant, pcLab), true);
  assert.equal(canManagePcLabComputers(pcAssistant, pcLab), true);
  assert.equal(canViewPcLabComputers(pcAssistant, practicalLab), false);
  assert.equal(canViewPcLabComputers(pcAssistant, { ...pcLab, status: 'inactive' }), false);
});

