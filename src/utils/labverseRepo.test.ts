import test from 'node:test';
import assert from 'node:assert/strict';
import { LabverseRepository } from '../services/labverseRepository';
import { validateInventoryIssue, calculateStockStatus, checkBenchTwinEmbedSupport } from './labRules';
import { validatePdfFile } from './pdfGenerator';

test('LabverseRepository returns MVIT institution, departments, subjects, experiments, and inventory', async () => {
  const repo = new LabverseRepository();

  const instRes = await repo.getInstitution('inst-mvit');
  assert.equal(instRes.source, 'demo_local');
  assert.equal(instRes.data?.code, 'MVIT');

  const mvitDepts = await repo.getDepartments('inst-mvit');
  assert.ok(mvitDepts.data && mvitDepts.data.length >= 4);
  assert.ok(mvitDepts.data.every((d) => d.institution_id === 'inst-mvit'));

  const mvitSubjects = await repo.getSubjects('inst-mvit');
  assert.ok(mvitSubjects.data && mvitSubjects.data.length > 0);
  assert.ok(mvitSubjects.data.every((s) => s.institution_id === 'inst-mvit'));

  const mvitExps = await repo.getExperiments('inst-mvit');
  assert.ok(mvitExps.data && mvitExps.data.length >= 4);

  const mvitInv = await repo.getInventory('inst-mvit');
  assert.ok(mvitInv.data && mvitInv.data.length > 0);
  assert.ok(mvitInv.data.every((i) => i.institution_id === 'inst-mvit'));
});

test('LabverseRepository profiles contain only MVIT College Admin and Lab Assistant roles', async () => {
  const repo = new LabverseRepository();
  const profilesRes = await repo.getProfiles('inst-mvit');
  assert.ok(profilesRes.data && profilesRes.data.length >= 2);
  assert.ok(
    profilesRes.data.every(
      (p) =>
        p.institution_id === 'inst-mvit' &&
        (p.role === 'college_admin' || p.role === 'lab_assistant')
    )
  );
});

test('Inventory issue validation strictly prevents negative stock', () => {
  const resValid = validateInventoryIssue(20, 5);
  assert.equal(resValid.canIssue, true);
  assert.equal(resValid.remainingQty, 15);

  const resExact = validateInventoryIssue(5, 5);
  assert.equal(resExact.canIssue, true);
  assert.equal(resExact.remainingQty, 0);

  const resOverdraft = validateInventoryIssue(4, 5);
  assert.equal(resOverdraft.canIssue, false);
  assert.match(resOverdraft.error || '', /Insufficient inventory/i);

  assert.equal(validateInventoryIssue(10, 0).canIssue, false);
});

test('Stock status calculation reflects safety threshold states', () => {
  assert.equal(calculateStockStatus(10, 4), 'in_stock');
  assert.equal(calculateStockStatus(4, 4), 'low_stock');
  assert.equal(calculateStockStatus(1, 4), 'low_stock');
  assert.equal(calculateStockStatus(0, 4), 'out_of_stock');
  assert.equal(calculateStockStatus(-2, 4), 'out_of_stock');
});

test('Bench Twin embed verification requires verified allowlist', () => {
  const verified1 = checkBenchTwinEmbedSupport('https://benchtwin.com/sim/servo-control');
  assert.equal(verified1.canEmbed, true);
  assert.equal(verified1.isSafeUrl, true);

  const verified2 = checkBenchTwinEmbedSupport(
    'https://phet.colorado.edu/sims/html/pendulum-lab/latest/pendulum-lab_en.html'
  );
  assert.equal(verified2.canEmbed, true);

  const unverified = checkBenchTwinEmbedSupport('https://external-unknown-site.org/sim');
  assert.equal(unverified.canEmbed, false);
  assert.equal(unverified.isSafeUrl, true);
});

test('PDF validator enforces file limits and types', () => {
  const validMock = {
    name: 'MVIT_Lab_Guide.pdf',
    type: 'application/pdf',
    size: 4 * 1024 * 1024,
  } as File;
  assert.equal(validatePdfFile(validMock).isValid, true);

  const invalidMock = {
    name: 'document.docx',
    type: 'application/msword',
    size: 1024 * 1024,
  } as File;
  assert.equal(validatePdfFile(invalidMock).isValid, false);
});
