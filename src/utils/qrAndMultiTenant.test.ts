import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatInventoryQrPayload,
  parseInventoryQrPayload,
  validateQrScanAccess,
  generateQrDataUrl,
  generateQrSvgString,
} from './qrCodeService';
import { InventoryItem, Profile, Lab } from '../types';
import { canAssistantAccessLab, isCollegeAdmin } from './labRules';

test('formatInventoryQrPayload creates standard LABVERSE QR version 2.0 payload for MVIT', () => {
  const mockItem: InventoryItem = {
    id: 'inv-mvit-cal-001',
    institution_id: 'inst-mvit',
    lab_id: 'lab-mvit-psl-01',
    department_id: 'dept-mvit-eng-sci',
    department_name: 'Engineering & Applied Sciences',
    item_code: 'MVIT-CAL-001',
    name: 'Digital Vernier Caliper',
    category: 'instrument',
    location: 'Shelf A2',
    quantity_available: 15,
    quantity_total: 15,
    unit: 'pcs',
    min_safety_threshold: 3,
    status: 'in_stock',
    last_inspected: '2026-11-10',
  };

  const payload = formatInventoryQrPayload(mockItem);
  const parsed = JSON.parse(payload);
  assert.equal(parsed.app, 'LABVERSE');
  assert.equal(parsed.version, '2.0');
  assert.equal(parsed.inventoryId, 'inv-mvit-cal-001');
  assert.equal(parsed.itemCode, 'MVIT-CAL-001');
  assert.equal(parsed.institutionId, 'inst-mvit');
  assert.equal(parsed.labId, 'lab-mvit-psl-01');
});

test('parseInventoryQrPayload parses standard, legacy, JSON, URL, and bare codes', () => {
  const res1 = parseInventoryQrPayload('LABVERSE:INV:MVIT-CAL-001');
  assert.equal(res1.valid, true);
  assert.equal(res1.itemCode, 'MVIT-CAL-001');

  const res2 = parseInventoryQrPayload('LABVERSE-EQUIP:MVIT-CAL-001:Vernier Caliper');
  assert.equal(res2.valid, true);
  assert.equal(res2.itemCode, 'MVIT-CAL-001');

  const res3 = parseInventoryQrPayload('{"app":"LABVERSE","itemCode":"MVIT-CRO-014"}');
  assert.equal(res3.valid, true);
  assert.equal(res3.itemCode, 'MVIT-CRO-014');

  const res4 = parseInventoryQrPayload('https://mvit.edu.in/labverse?qr=MVIT-PHM-001');
  assert.equal(res4.valid, true);
  assert.equal(res4.itemCode, 'MVIT-PHM-001');

  const res5 = parseInventoryQrPayload('MVIT-PEND-01');
  assert.equal(res5.valid, true);
  assert.equal(res5.itemCode, 'MVIT-PEND-01');

  assert.equal(parseInventoryQrPayload('').valid, false);
});

test('generateQrDataUrl and generateQrSvgString produce valid QR assets', async () => {
  const dataUrl = await generateQrDataUrl('LABVERSE:INV:MVIT-CAL-001', {
    size: 200,
    margin: 2,
    errorCorrectionLevel: 'M',
  });
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));
  assert.ok(dataUrl.length > 100);

  const svg = await generateQrSvgString('LABVERSE:INV:MVIT-CAL-001', {
    size: 250,
    margin: 2,
    errorCorrectionLevel: 'H',
  });
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(svg.includes('viewBox='));
});

test('Only MVIT College Admin can manage laboratories; Lab Assistants are strictly scoped', () => {
  assert.equal(isCollegeAdmin('college_admin'), true);
  assert.equal(isCollegeAdmin('lab_assistant'), false);

  const mockLabs: Lab[] = [
    {
      id: 'lab-mvit-psl-01',
      institution_id: 'inst-mvit',
      lab_code: 'PSL-01',
      name: 'Physical Science Lab',
      building: 'Main Academic Block',
      room_number: '201',
      location: 'Floor 2',
      status: 'active',
      display_order: 1,
      created_at: '2026-11-10',
      updated_at: '2026-11-10',
    },
    {
      id: 'lab-mvit-edl-01',
      institution_id: 'inst-mvit',
      lab_code: 'EDL-01',
      name: 'Electronic Devices Lab',
      building: 'ECE Block',
      room_number: '204',
      location: 'Floor 2',
      status: 'active',
      display_order: 2,
      created_at: '2026-11-10',
      updated_at: '2026-11-10',
    },
  ];

  const assistant: Profile = {
    id: 'user-mvit-labasst',
    institution_id: 'inst-mvit',
    role: 'lab_assistant',
    name: 'V. Murugan',
    email: 'murugan.lab@mvit.edu.in',
    identifier: 'TECH-MVIT-05',
    assigned_lab_ids: ['lab-mvit-psl-01'],
  };

  const allowedLabs = mockLabs.filter((l) => canAssistantAccessLab(assistant, l.id));
  assert.equal(allowedLabs.length, 1);
  assert.equal(allowedLabs[0].id, 'lab-mvit-psl-01');

  const parsed = parseInventoryQrPayload('MVIT-CAL-001');
  const publicAccess = validateQrScanAccess(parsed, null, {
    id: 'inv-1',
    institution_id: 'inst-mvit',
    lab_id: 'lab-mvit-psl-01',
    item_code: 'MVIT-CAL-001',
    name: 'Digital Vernier Caliper',
    category: 'instrument',
    location: 'Cabinet A',
    quantity_available: 10,
    quantity_total: 10,
    unit: 'pcs',
    min_safety_threshold: 2,
    status: 'in_stock',
  });
  assert.equal(publicAccess.allowed, true);
  assert.equal(publicAccess.readOnly, true);
});

test('Experiment key uniqueness: INITIAL_EXPERIMENTS contains 0 duplicate IDs', async () => {
  const { INITIAL_EXPERIMENTS } = await import('../data/initialData');
  const idCounts = new Map<string, number>();
  for (const exp of INITIAL_EXPERIMENTS) {
    idCounts.set(exp.id, (idCounts.get(exp.id) || 0) + 1);
  }
  for (const [id, count] of idCounts.entries()) {
    assert.equal(count, 1, `Experiment ID "${id}" must be strictly unique.`);
  }
});
