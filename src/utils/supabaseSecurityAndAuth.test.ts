import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatInventoryQrPayload,
  parseInventoryQrPayload,
  validateQrScanAccess,
} from './qrCodeService';
import {
  MVIT_INSTITUTION,
  INITIAL_LABS,
  SAMPLE_PROFILES,
  INITIAL_INVENTORY,
  INITIAL_SUBJECTS,
} from '../data/initialData';
import { InventoryItem, Profile } from '../types';
import { validateInventoryIssue } from './labRules';
import { LabverseRepository } from '../services/labverseRepository';
import { processAdminInviteRequest } from './adminInviteHandler';

const CANONICAL_MVIT_UUID = 'de34eef0-1cd3-476d-9ef6-d66fff6934e0';
const CANONICAL_LAB_UUID = '11111111-1111-4111-8111-111111111111';
const CANONICAL_DEPT_UUID = '22222222-2222-4222-8222-222222222222';
const ADMIN_UUID = '33333333-3333-4333-8333-333333333333';
const ASSISTANT_UUID = '44444444-4444-4444-8444-444444444444';

test('QR v2 format contains schema version, inventoryId, institutionId, and labId', () => {
  const item: InventoryItem = {
    id: 'inv-uuid-12345',
    institution_id: 'inst-mvit',
    lab_id: 'lab-mvit-psl-01',
    item_code: 'MVIT-CAL-001',
    name: 'MVIT Precision Digital Caliper',
    category: 'instrument',
    location: 'Cabinet P-1',
    quantity_available: 15,
    quantity_total: 15,
    unit: 'units',
    min_safety_threshold: 3,
    status: 'in_stock',
  };

  const payloadStr = formatInventoryQrPayload(item);
  const parsedJson = JSON.parse(payloadStr);

  assert.equal(parsedJson.app, 'LABVERSE');
  assert.equal(parsedJson.version, '2.0');
  assert.equal(parsedJson.inventoryId, 'inv-uuid-12345');
  assert.equal(parsedJson.itemCode, 'MVIT-CAL-001');
  assert.equal(parsedJson.institutionId, 'inst-mvit');
  assert.equal(parsedJson.labId, 'lab-mvit-psl-01');

  const parsedResult = parseInventoryQrPayload(payloadStr);
  assert.equal(parsedResult.valid, true);
  assert.equal(parsedResult.version, '2.0');
  assert.equal(parsedResult.inventoryId, 'inv-uuid-12345');
});

test('validateQrScanAccess blocks non-MVIT equipment QR scans cleanly', () => {
  const mvitAssistant: Profile = {
    id: 'user-mvit-labasst',
    institution_id: 'inst-mvit',
    role: 'lab_assistant',
    name: 'V. Murugan',
    email: 'murugan.lab@mvit.edu.in',
    identifier: 'TECH-MVIT-05',
    status: 'active',
    assigned_lab_ids: ['lab-mvit-psl-01'],
  };

  const externalItem: InventoryItem = {
    id: 'inv-ext-001',
    institution_id: 'inst-external',
    lab_id: 'lab-ext-01',
    item_code: 'EXT-CAL-001',
    name: 'External Caliper',
    category: 'instrument',
    location: 'Shelf 1',
    quantity_available: 5,
    quantity_total: 5,
    unit: 'pcs',
    min_safety_threshold: 2,
    status: 'in_stock',
  };

  const payload = parseInventoryQrPayload(formatInventoryQrPayload(externalItem));
  const staffResult = validateQrScanAccess(payload, mvitAssistant, externalItem);
  assert.equal(staffResult.allowed, false);
  assert.match(staffResult.reason || '', /MVIT/i);

  const publicResult = validateQrScanAccess(payload, null, externalItem);
  assert.equal(publicResult.allowed, false);
  assert.equal(publicResult.readOnly, true);
});

test('validateQrScanAccess enforces assigned lab scope for Lab Assistants while permitting College Admin', () => {
  const mvitAssistant: Profile = {
    id: 'user-mvit-labasst',
    institution_id: 'inst-mvit',
    role: 'lab_assistant',
    name: 'V. Murugan',
    email: 'murugan.lab@mvit.edu.in',
    identifier: 'TECH-MVIT-05',
    status: 'active',
    assigned_lab_ids: ['lab-mvit-psl-01'],
  };

  const mvitAdmin: Profile = {
    id: 'user-mvit-admin',
    institution_id: 'inst-mvit',
    role: 'college_admin',
    name: 'Dr. S. Malarkkan',
    email: 'principal@mvit.edu.in',
    identifier: 'MVIT-ADM-001',
    status: 'active',
  };

  const unassignedLabItem: InventoryItem = {
    id: 'inv-mvit-ece-001',
    institution_id: 'inst-mvit',
    lab_id: 'lab-mvit-edl-01',
    item_code: 'MVIT-CRO-01',
    name: 'Cathode Ray Oscilloscope',
    category: 'electronic',
    location: 'ECE Bench 2',
    quantity_available: 10,
    quantity_total: 10,
    unit: 'units',
    min_safety_threshold: 2,
    status: 'in_stock',
  };

  const payload = parseInventoryQrPayload(formatInventoryQrPayload(unassignedLabItem));

  const assistantAccess = validateQrScanAccess(payload, mvitAssistant, unassignedLabItem);
  assert.equal(assistantAccess.allowed, false);
  assert.match(assistantAccess.reason || '', /not assigned/i);

  const adminAccess = validateQrScanAccess(payload, mvitAdmin, unassignedLabItem);
  assert.equal(adminAccess.allowed, true);
  assert.equal(adminAccess.readOnly, false);
});

test('MVIT single-institution configuration, PSL-01 lab, and 2-role staff profiles are properly seeded', () => {
  assert.equal(MVIT_INSTITUTION.id, 'inst-mvit');
  assert.equal(MVIT_INSTITUTION.code, 'MVIT');
  assert.equal(MVIT_INSTITUTION.active, true);

  const mvitLab = INITIAL_LABS.find((l) => l.institution_id === 'inst-mvit' && l.lab_code === 'PSL-01');
  assert.ok(mvitLab, 'MVIT PSL-01 laboratory must exist');
  assert.equal(mvitLab.name, 'Physical Science Lab');
  assert.equal(mvitLab.status, 'active');

  const admin = SAMPLE_PROFILES.find((p) => p.role === 'college_admin');
  assert.ok(admin, 'MVIT College Admin must exist');
  assert.equal(admin.name, 'Dr. S. Malarkkan');
  assert.equal(admin.status, 'active');

  const assistant = SAMPLE_PROFILES.find((p) => p.role === 'lab_assistant');
  assert.ok(assistant, 'MVIT Lab Assistant must exist');
  assert.equal(assistant.name, 'V. Murugan');
  assert.ok(assistant.assigned_lab_ids?.includes('lab-mvit-psl-01'));

  assert.equal(
    SAMPLE_PROFILES.every((p) => p.role === 'college_admin' || p.role === 'lab_assistant'),
    true,
    'Only college_admin and lab_assistant profiles should exist'
  );

  const mvitInventory = INITIAL_INVENTORY.filter((i) => i.institution_id === 'inst-mvit');
  assert.ok(mvitInventory.length >= 2);
  assert.ok(mvitInventory.some((i) => i.item_code === 'MVIT-CAL-001'));

  const mvitSubject = INITIAL_SUBJECTS.find((s) => s.institution_id === 'inst-mvit');
  assert.ok(mvitSubject);
  assert.equal(mvitSubject.lab_id, 'lab-mvit-psl-01');
});

test('Inventory issue validation prevents negative quantities and stock depletion', () => {
  assert.equal(validateInventoryIssue(10, 0).valid, false);
  assert.equal(validateInventoryIssue(10, -3).valid, false);

  const overCheck = validateInventoryIssue(5, 6);
  assert.equal(overCheck.valid, false);
  assert.match(overCheck.error || '', /insufficient/i);

  assert.equal(validateInventoryIssue(5, 3).valid, true);
});

test('Live LabverseRepository resolves MVIT canonical UUID via getInstitutionByCode and rejects inst-mvit writes/queries', async () => {
  const mockClient: any = {
    from: (table: string) => ({
      select: () => ({
        ilike: (_col: string, val: string) => ({
          single: async () => {
            if (table === 'institutions' && val.toUpperCase() === 'MVIT') {
              return {
                data: {
                  id: CANONICAL_MVIT_UUID,
                  name: 'Manakula Vinayagar Institute of Technology',
                  code: 'MVIT',
                  location: 'Kalitheerthalkuppam, Puducherry',
                  address: 'Kalitheerthalkuppam, Madagadipet, Puducherry 605107',
                  contact_email: 'principal@mvit.edu.in',
                  active: true,
                  created_at: '2026-11-10T00:00:00Z',
                },
                error: null,
              };
            }
            return { data: null, error: { message: 'Not found' } };
          },
        }),
      }),
    }),
  };

  const repo = new LabverseRepository({ isLive: true, client: mockClient });
  const instRes = await repo.getInstitutionByCode('MVIT');
  assert.equal(instRes.source, 'supabase');
  assert.equal(instRes.data?.id, CANONICAL_MVIT_UUID);
  assert.equal(instRes.data?.code, 'MVIT');

  // Placeholder 'inst-mvit' must be rejected in live mode instead of querying or returning demo rows
  const badLabs = await repo.getLabs('inst-mvit');
  assert.equal(badLabs.data, null);
  assert.equal(badLabs.source, 'supabase');
  assert.match(badLabs.error || '', /UUID/i);

  const badSubjects = await repo.getSubjects('inst-mvit');
  assert.equal(badSubjects.data, null);
  assert.equal(badSubjects.source, 'supabase');
});

test('Live LabverseRepository never falls back to demo fixtures when Supabase queries fail', async () => {
  const failingClient: any = {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: async () => ({
              data: null,
              error: { message: 'RLS permission denied' },
            }),
          }),
        }),
      }),
    }),
  };

  const repo = new LabverseRepository({ isLive: true, client: failingClient });
  const labsRes = await repo.getLabs(CANONICAL_MVIT_UUID);
  assert.equal(labsRes.source, 'supabase');
  assert.equal(labsRes.data, null);
  assert.match(labsRes.error || '', /RLS permission denied/i);
});

test('Live LabverseRepository calls atomic assignment RPCs and sanitized lookupPublicInventoryQr RPC', async () => {
  const rpcCalls: Array<{ fn: string; params: Record<string, any> }> = [];
  const mockClient: any = {
    rpc: async (fn: string, params: Record<string, any>) => {
      rpcCalls.push({ fn, params });
      if (fn === 'assign_lab_assistant') {
        return { data: { success: true, lab_id: params.p_lab_id }, error: null };
      }
      if (fn === 'set_assistant_lab_assignments') {
        return { data: { success: true, assistant_id: params.p_assistant_id }, error: null };
      }
      if (fn === 'lookup_public_inventory_qr') {
        return {
          data: [
            {
              id: '55555555-5555-4555-8555-555555555555',
              institution_id: CANONICAL_MVIT_UUID,
              lab_id: CANONICAL_LAB_UUID,
              laboratory_name: 'Physical Science Lab',
              laboratory_code: 'PSL-01',
              department_id: CANONICAL_DEPT_UUID,
              department_name: 'Science & Humanities',
              item_code: 'MVIT-CAL-001',
              name: 'Digital Vernier Caliper',
              category: 'instrument',
              location: 'Cabinet P-1',
              unit: 'pcs',
              quantity_available: 15,
              quantity_total: 15,
              availability_status: 'in_stock',
            },
          ],
          error: null,
        };
      }
      return { data: null, error: { message: 'Unknown RPC' } };
    },
  };

  const repo = new LabverseRepository({ isLive: true, client: mockClient });

  const assignRes = await repo.assignLabAssistantAtomic(CANONICAL_LAB_UUID, ASSISTANT_UUID);
  assert.equal(assignRes.error, undefined);
  assert.equal(assignRes.success, true);
  assert.equal(rpcCalls[0].fn, 'assign_lab_assistant');
  assert.deepEqual(rpcCalls[0].params, {
    p_lab_id: CANONICAL_LAB_UUID,
    p_assistant_id: ASSISTANT_UUID,
  });

  const setRes = await repo.setAssistantLabAssignmentsAtomic(ASSISTANT_UUID, [CANONICAL_LAB_UUID]);
  assert.equal(setRes.error, undefined);
  assert.equal(setRes.success, true);
  assert.equal(rpcCalls[1].fn, 'set_assistant_lab_assignments');
  assert.deepEqual(rpcCalls[1].params, {
    p_assistant_id: ASSISTANT_UUID,
    p_lab_ids: [CANONICAL_LAB_UUID],
  });

  const qrRes = await repo.lookupPublicInventoryQr('MVIT-CAL-001');
  assert.equal(qrRes.error, undefined);
  assert.equal(qrRes.source, 'supabase');
  assert.equal(qrRes.data?.item_code, 'MVIT-CAL-001');
  assert.equal(qrRes.data?.institution_id, CANONICAL_MVIT_UUID);
  assert.equal(qrRes.data?.laboratory_name, 'Physical Science Lab');
  assert.equal(qrRes.data?.availability_status, 'in_stock');
  assert.equal('min_safety_threshold' in (qrRes.data || {}), false);
});

test('validateQrScanAccess enforces dynamic canonical MVIT UUID when supplied', () => {
  const parsed = parseInventoryQrPayload('MVIT-CAL-001');
  const mvitItem = {
    institution_id: CANONICAL_MVIT_UUID,
    lab_id: CANONICAL_LAB_UUID,
  };
  const wrongInstItem = {
    institution_id: 'inst-mvit',
    lab_id: CANONICAL_LAB_UUID,
  };

  // Public visitor checks against resolved MVIT UUID
  assert.equal(validateQrScanAccess(parsed, null, mvitItem, CANONICAL_MVIT_UUID).allowed, true);
  assert.equal(
    validateQrScanAccess(parsed, null, wrongInstItem, CANONICAL_MVIT_UUID).allowed,
    false
  );

  // Assigned assistant allowed, unassigned blocked
  const assistant = {
    role: 'lab_assistant',
    institution_id: CANONICAL_MVIT_UUID,
    assigned_lab_ids: [CANONICAL_LAB_UUID],
  };
  assert.equal(
    validateQrScanAccess(parsed, assistant, mvitItem, CANONICAL_MVIT_UUID).allowed,
    true
  );
  assert.equal(
    validateQrScanAccess(
      parsed,
      assistant,
      { institution_id: CANONICAL_MVIT_UUID, lab_id: '99999999-9999-4999-8999-999999999999' },
      CANONICAL_MVIT_UUID
    ).allowed,
    false
  );
});

test('processAdminInviteRequest enforces 503 missing-service-key, auth, caller role/institution checks, and atomic MVIT invite creation', async () => {
  const baseBody = {
    email: 'new.assistant@mvit.edu.in',
    role: 'lab_assistant',
    institutionId: CANONICAL_MVIT_UUID,
    name: 'R. Karthik',
    identifier: 'TECH-MVIT-09',
    departmentId: CANONICAL_DEPT_UUID,
    assignedLabIds: [CANONICAL_LAB_UUID],
  };

  // 1. Missing service role key when Supabase env is configured -> 503 (never falls back to demo_local)
  const missingKeyRes = await processAdminInviteRequest({
    authHeader: 'Bearer token',
    body: baseBody,
    deps: {
      adminClient: null,
      anonClient: {},
      supabaseEnvConfigured: true,
    },
  });
  assert.equal(missingKeyRes.statusCode, 503);

  // Build configurable mock admin client
  const createMockAdmin = (overrides: {
    callerProfile?: Record<string, any> | null;
    assignError?: { message: string } | null;
  }) => {
    const upsertedProfiles: any[] = [];
    const upsertedAssignments: any[] = [];
    const updatedLabs: any[] = [];

    const client: any = {
      _upsertedProfiles: upsertedProfiles,
      _upsertedAssignments: upsertedAssignments,
      _updatedLabs: updatedLabs,
      auth: {
        getUser: async (token: string) =>
          token === 'valid-jwt'
            ? { data: { user: { id: ADMIN_UUID } }, error: null }
            : { data: { user: null }, error: { message: 'Invalid token' } },
        admin: {
          inviteUserByEmail: async (email: string) => ({
            data: { user: { id: ASSISTANT_UUID, email } },
            error: null,
          }),
        },
      },
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data:
                    overrides.callerProfile !== undefined
                      ? overrides.callerProfile
                      : {
                          id: ADMIN_UUID,
                          institution_id: CANONICAL_MVIT_UUID,
                          role: 'college_admin',
                          status: 'active',
                        },
                  error: overrides.callerProfile === null ? { message: 'Not found' } : null,
                }),
              }),
            }),
            upsert: async (payload: any) => {
              upsertedProfiles.push(payload);
              return { error: null };
            },
          };
        }
        if (table === 'institutions') {
          return {
            select: () => ({
              ilike: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { id: CANONICAL_MVIT_UUID, code: 'MVIT', active: true },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'departments') {
          return {
            select: () => ({
              eq: (_c1: string, idVal: string) => ({
                eq: () => ({
                  single: async () =>
                    idVal === CANONICAL_DEPT_UUID
                      ? { data: { id: CANONICAL_DEPT_UUID }, error: null }
                      : { data: null, error: { message: 'Wrong department' } },
                }),
              }),
            }),
          };
        }
        if (table === 'labs') {
          return {
            select: () => ({
              eq: () => ({
                in: async (_c: string, ids: string[]) => ({
                  data: ids
                    .filter((id) => id === CANONICAL_LAB_UUID)
                    .map((id) => ({ id, primary_assistant_id: null })),
                  error: null,
                }),
              }),
            }),
            update: (payload: any) => ({
              eq: () => ({
                in: async (_c: string, ids: string[]) => {
                  updatedLabs.push({ payload, ids });
                  return { error: null };
                },
              }),
            }),
          };
        }
        if (table === 'profile_lab_assignments') {
          return {
            upsert: async (rows: any[]) => {
              if (overrides.assignError) {
                return { error: overrides.assignError };
              }
              upsertedAssignments.push(...rows);
              return { error: null };
            },
          };
        }
        return {};
      },
    };
    return client;
  };

  // 2. Missing Authorization header -> 401
  const noAuthRes = await processAdminInviteRequest({
    authHeader: undefined,
    body: baseBody,
    deps: {
      adminClient: createMockAdmin({}),
      anonClient: {},
      supabaseEnvConfigured: true,
    },
  });
  assert.equal(noAuthRes.statusCode, 401);

  // 3. Non-admin caller -> 403
  const nonAdminRes = await processAdminInviteRequest({
    authHeader: 'Bearer valid-jwt',
    body: baseBody,
    deps: {
      adminClient: createMockAdmin({
        callerProfile: {
          id: ADMIN_UUID,
          institution_id: CANONICAL_MVIT_UUID,
          role: 'lab_assistant',
          status: 'active',
        },
      }),
      anonClient: {},
      supabaseEnvConfigured: true,
    },
  });
  assert.equal(nonAdminRes.statusCode, 403);

  // 4. Attempting to invite a college_admin -> 400
  const roleEscalationRes = await processAdminInviteRequest({
    authHeader: 'Bearer valid-jwt',
    body: { ...baseBody, role: 'college_admin' },
    deps: {
      adminClient: createMockAdmin({}),
      anonClient: {},
      supabaseEnvConfigured: true,
    },
  });
  assert.equal(roleEscalationRes.statusCode, 400);

  // 5. Assignment DB failure surfaces 500 instead of silently succeeding
  const assignFailRes = await processAdminInviteRequest({
    authHeader: 'Bearer valid-jwt',
    body: baseBody,
    deps: {
      adminClient: createMockAdmin({ assignError: { message: 'Constraint error' } }),
      anonClient: {},
      supabaseEnvConfigured: true,
    },
  });
  assert.equal(assignFailRes.statusCode, 500);

  // 6. Valid College Admin invite resolves MVIT UUID, writes profile + lab assignment + syncs primary assistant
  const successClient = createMockAdmin({});
  const okRes = await processAdminInviteRequest({
    authHeader: 'Bearer valid-jwt',
    body: { ...baseBody, institutionId: undefined },
    deps: {
      adminClient: successClient,
      anonClient: {},
      supabaseEnvConfigured: true,
      appUrl: 'https://mvit-labverse.example',
    },
  });
  assert.equal(okRes.statusCode, 200);
  assert.equal(okRes.body.institutionId, CANONICAL_MVIT_UUID);
  assert.equal(okRes.body.source, 'supabase_production');
  assert.equal(successClient._upsertedProfiles[0].institution_id, CANONICAL_MVIT_UUID);
  assert.equal(successClient._upsertedProfiles[0].role, 'lab_assistant');
  assert.equal(successClient._upsertedAssignments[0].lab_id, CANONICAL_LAB_UUID);
  assert.equal(successClient._updatedLabs[0].payload.primary_assistant_id, ASSISTANT_UUID);
});
