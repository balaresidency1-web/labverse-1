import test from 'node:test';
import assert from 'node:assert/strict';
import { LabverseRepository } from '../services/labverseRepository';

test('Initial MVIT laboratory setup contains core MVIT laboratories including Physical Science Lab (PSL-01) and PC Lab (PC-01)', async () => {
  const repo = new LabverseRepository();
  const mvitLabsRes = await repo.getLabs('inst-mvit');

  assert.equal(mvitLabsRes.source, 'demo_local');
  assert.ok(mvitLabsRes.data);
  assert.ok(mvitLabsRes.data.length >= 4, 'MVIT should start with 4 core laboratories');

  const pslLab = mvitLabsRes.data.find((l) => l.lab_code === 'PSL-01');
  assert.ok(pslLab, 'Physical Science Lab (PSL-01) must exist');
  assert.equal(pslLab.name, 'Physical Science Lab');
  assert.equal(pslLab.status, 'active');
  assert.equal(pslLab.institution_id, 'inst-mvit');

  const pcLab = mvitLabsRes.data.find((l) => l.lab_code === 'COMP-PC-01');
  assert.ok(pcLab, 'PC Lab (COMP-PC-01) must exist');
  assert.equal(pcLab.lab_type, 'pc_lab');
});

test('MVIT College Admin laboratory creation dynamically adds new labs', async () => {
  const repo = new LabverseRepository();

  const initialRes = await repo.getLabs('inst-mvit');
  const initialCount = initialRes.data?.length || 0;
  assert.ok(initialCount >= 4);

  const createRes = await repo.createLab({
    institution_id: 'inst-mvit',
    department_id: 'dept-mvit-ece',
    department_name: 'Electronics and Communication Engineering',
    lab_code: 'IOT-01',
    name: 'Embedded & IoT Systems Lab',
    description: 'Microcontroller interfacing, sensor telemetry, and embedded firmware bench.',
    building: 'ECE Block',
    room_number: 'ECE-305',
    location: 'Floor 3, ECE Wing',
    capacity: 35,
    status: 'active',
    lab_type: 'practical',
    display_order: 5,
  });

  assert.ok(createRes.data);
  assert.equal(createRes.data.lab_code, 'IOT-01');
  assert.equal(createRes.data.name, 'Embedded & IoT Systems Lab');

  const afterRes = await repo.getLabs('inst-mvit');
  assert.equal(afterRes.data?.length, initialCount + 1, 'Total MVIT laboratory count must increment by 1');
});

test('MVIT laboratory code uniqueness validation prevents duplicate lab codes', async () => {
  const repo = new LabverseRepository();

  const duplicateAttempt = await repo.createLab({
    institution_id: 'inst-mvit',
    lab_code: 'psl-01',
    name: 'Duplicate Physical Science Lab',
    building: 'Main Academic Block',
    room_number: 'Lab 201',
    location: 'Floor 2',
    status: 'active',
    display_order: 3,
  });

  assert.equal(duplicateAttempt.data, null);
  assert.ok(duplicateAttempt.error);
  assert.match(duplicateAttempt.error, /already exists/i);
});

test('Laboratory activation and deactivation toggles status without deleting records', async () => {
  const repo = new LabverseRepository();

  const deactRes = await repo.deactivateLab('lab-mvit-psl-01');
  assert.ok(deactRes.data);
  assert.equal(deactRes.data.status, 'inactive');

  const verifyDeact = await repo.getLabById('lab-mvit-psl-01');
  assert.equal(verifyDeact.data?.status, 'inactive');

  const reactRes = await repo.activateLab('lab-mvit-psl-01');
  assert.ok(reactRes.data);
  assert.equal(reactRes.data.status, 'active');

  const verifyActive = await repo.getLabById('lab-mvit-psl-01');
  assert.equal(verifyActive.data?.status, 'active');
});

test('MVIT subjects and inventory queries filter strictly by lab_id', async () => {
  const repo = new LabverseRepository();

  const pslSubjects = await repo.getSubjects('inst-mvit', 'lab-mvit-psl-01');
  assert.ok(pslSubjects.data);
  assert.ok(pslSubjects.data.length > 0);
  assert.ok(pslSubjects.data.every((s) => s.lab_id === 'lab-mvit-psl-01'));

  const pslInventory = await repo.getInventory('inst-mvit', 'lab-mvit-psl-01');
  assert.ok(pslInventory.data);
  assert.ok(pslInventory.data.length > 0);
  assert.ok(pslInventory.data.every((i) => i.lab_id === 'lab-mvit-psl-01'));

  const emptyLabSubjects = await repo.getSubjects('inst-mvit', 'lab-unpopulated-099');
  assert.equal(emptyLabSubjects.data?.length, 0);
});
