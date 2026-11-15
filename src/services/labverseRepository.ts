/**
 * LABVERSE – MVIT Unified Repository & Data Access Layer
 * Single-institution repository for Manakula Vinayagar Institute of Technology, Puducherry.
 * Supports Supabase PostgreSQL + RLS in Live Mode (zero demo fallback on DB errors)
 * and synchronous/in-memory Demo Local Mode when Supabase is not configured.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Institution,
  Department,
  AcademicTerm,
  Profile,
  PracticalSubject,
  SubjectSyllabus,
  Experiment,
  InventoryItem,
  InventoryTransaction,
  PublicQrInventoryItem,
  AuditLog,
  LabManualDocument,
  Role,
  Lab,
  Course,
  LaboratoryCourse,
  ExperimentCourse,
  PcLabComputer,
  PcLabMaintenanceRecord,
  PcComputerStatus,
} from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import {
  MVIT_INSTITUTION,
  INITIAL_LABS,
  INITIAL_DEPARTMENTS,
  INITIAL_TERMS,
  SAMPLE_PROFILES,
  INITIAL_SUBJECTS,
  INITIAL_EXPERIMENTS,
  INITIAL_DOCUMENTS,
  INITIAL_INVENTORY,
  INITIAL_TRANSACTIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_COURSES,
  INITIAL_LAB_COURSES,
  INITIAL_EXPERIMENT_COURSES,
  INITIAL_PC_COMPUTERS,
  INITIAL_PC_MAINTENANCE_RECORDS,
} from '../data/initialData';
import { calculateStockStatus, isPublicVisibleLab } from '../utils/labRules';

export interface RepositoryResult<T> {
  data: T | null;
  error?: string;
  source: 'supabase' | 'demo_local';
}

export interface LabverseRepositoryOptions {
  isLive?: boolean;
  client?: SupabaseClient | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class LabverseRepository {
  private readonly isLive: boolean;
  private readonly clientOverride?: SupabaseClient | null;

  private demoLabs: Lab[] = INITIAL_LABS.map((l) => ({ ...l }));
  private demoDepartments: Department[] = INITIAL_DEPARTMENTS.map((d) => ({ ...d }));
  private demoSubjects: PracticalSubject[] = INITIAL_SUBJECTS.map((s) => ({
    ...s,
    syllabus: s.syllabus.map((u) => ({ ...u })),
  }));
  private demoExperiments: Experiment[] = INITIAL_EXPERIMENTS.map((e) => ({ ...e }));
  private demoDocuments: LabManualDocument[] = INITIAL_DOCUMENTS.map((d) => ({ ...d }));
  private demoInventory: InventoryItem[] = INITIAL_INVENTORY.map((i) => ({ ...i }));
  private demoTransactions: InventoryTransaction[] = INITIAL_TRANSACTIONS.map((t) => ({ ...t }));
  private demoProfiles: Profile[] = SAMPLE_PROFILES.map((p) => ({
    ...p,
    assigned_lab_ids: [...(p.assigned_lab_ids || [])],
  }));
  private demoAuditLogs: AuditLog[] = INITIAL_AUDIT_LOGS.map((a) => ({ ...a }));
  private demoCourses: Course[] = INITIAL_COURSES.map((c) => ({ ...c }));
  private demoLabCourses: LaboratoryCourse[] = INITIAL_LAB_COURSES.map((lc) => ({ ...lc }));
  private demoExperimentCourses: ExperimentCourse[] = INITIAL_EXPERIMENT_COURSES.map((ec) => ({ ...ec }));
  private demoPcComputers: PcLabComputer[] = INITIAL_PC_COMPUTERS.map((pc) => ({ ...pc }));
  private demoPcMaintenanceRecords: PcLabMaintenanceRecord[] = INITIAL_PC_MAINTENANCE_RECORDS.map((r) => ({ ...r }));

  constructor(options?: LabverseRepositoryOptions) {
    this.isLive = options?.isLive ?? isSupabaseConfigured();
    this.clientOverride = options?.client;
  }

  private getClient(): SupabaseClient | null {
    return this.clientOverride !== undefined ? this.clientOverride : getSupabaseClient();
  }

  private isUuid(val?: string | null): boolean {
    return Boolean(val && UUID_REGEX.test(val.trim()));
  }

  private requireLiveInstitutionId(institutionId?: string): string | null {
    if (!institutionId || institutionId === 'inst-mvit' || !this.isUuid(institutionId)) {
      return null;
    }
    return institutionId.trim();
  }

  private mapInstitutionRow(data: any): Institution {
    return {
      id: data.id,
      name: data.name,
      code: data.code,
      institution_code: data.institution_code || data.code,
      domain: data.domain,
      contact_email: data.contact_email,
      address: data.address || MVIT_INSTITUTION.address,
      city: data.city || 'Puducherry',
      state: data.state || 'Puducherry',
      country: data.country || 'India',
      contact_person: data.contact_person,
      admin_name: data.admin_name,
      admin_email: data.admin_email,
      admin_designation: data.admin_designation,
      active: data.active ?? true,
      status: data.status || (data.active === false ? 'inactive' : 'active'),
      createdAt: data.created_at,
    };
  }

  private mapLabRow(row: any): Lab {
    const codeUpper = String(row.lab_code || '').trim().toUpperCase();
    const inferredType =
      row.lab_type === 'pc_lab' || codeUpper.startsWith('COMP-PC') || codeUpper.startsWith('PC-')
        ? 'pc_lab'
        : 'practical';
    const resolvedType = row.lab_type || inferredType;
    const isPublic =
      typeof row.is_public === 'boolean'
        ? row.is_public && resolvedType !== 'pc_lab'
        : resolvedType !== 'pc_lab';
    return {
      id: row.id,
      institution_id: row.institution_id,
      department_id: row.department_id,
      department_name: row.departments?.name || row.department_name || '',
      lab_code: row.lab_code,
      name: row.name,
      description: row.description || '',
      building: row.building || '',
      room_number: row.room_number || '',
      location: row.location || '',
      capacity: row.capacity,
      status: row.status as 'active' | 'inactive',
      lab_type: resolvedType,
      is_public: isPublic,
      display_order: row.display_order ?? 1,
      assigned_assistant_id: row.primary_assistant_id || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapInventoryRow(row: any): InventoryItem {
    return {
      id: row.id,
      institution_id: row.institution_id,
      lab_id: row.lab_id || undefined,
      laboratory_name: row.labs?.name || undefined,
      laboratory_code: row.labs?.lab_code || undefined,
      department_id: row.department_id,
      department_name: row.departments?.name || 'Department',
      item_code: row.item_code,
      name: row.name,
      category: row.category,
      location: row.location || 'Lab Store',
      quantity_available: row.quantity_available,
      quantity_total: row.quantity_total,
      unit: row.unit,
      min_safety_threshold: row.min_safety_threshold,
      status: calculateStockStatus(row.quantity_available, row.min_safety_threshold),
      last_inspected: row.last_inspected || new Date().toISOString().slice(0, 10),
    };
  }

  // ============================================================================
  // INSTITUTION (MVIT ONLY — DYNAMIC UUID RESOLUTION)
  // ============================================================================

  async getInstitutionByCode(code: string = 'MVIT'): Promise<RepositoryResult<Institution>> {
    const cleanCode = (code || 'MVIT').trim().toUpperCase();
    const supabase = this.getClient();

    if (this.isLive) {
      if (!supabase) {
        return {
          data: null,
          error: 'Supabase client is unavailable in live mode.',
          source: 'supabase',
        };
      }
      try {
        const { data, error } = await supabase
          .from('institutions')
          .select('*')
          .ilike('code', cleanCode)
          .single();

        if (error) throw error;
        if (!data) {
          return {
            data: null,
            error: `Institution with code "${cleanCode}" not found.`,
            source: 'supabase',
          };
        }

        return {
          data: this.mapInstitutionRow(data),
          source: 'supabase',
        };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || `Failed to resolve institution "${cleanCode}" from Supabase.`,
          source: 'supabase',
        };
      }
    }

    if (cleanCode === MVIT_INSTITUTION.code.toUpperCase()) {
      return { data: MVIT_INSTITUTION, source: 'demo_local' };
    }
    return {
      data: null,
      error: `Institution "${cleanCode}" not found in local sandbox.`,
      source: 'demo_local',
    };
  }

  async getInstitution(id: string = 'inst-mvit'): Promise<RepositoryResult<Institution>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client is unavailable in live mode.', source: 'supabase' };
      }
      const validId = this.requireLiveInstitutionId(id);
      if (!validId) {
        return this.getInstitutionByCode('MVIT');
      }
      try {
        const { data, error } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', validId)
          .single();
        if (error) throw error;
        return {
          data: this.mapInstitutionRow(data),
          source: 'supabase',
        };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load institution from Supabase.',
          source: 'supabase',
        };
      }
    }
    return { data: MVIT_INSTITUTION, source: 'demo_local' };
  }

  // ============================================================================
  // ACADEMIC TERMS
  // ============================================================================

  async getCurrentTerm(institutionId: string = 'inst-mvit'): Promise<RepositoryResult<AcademicTerm>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('academic_terms')
          .select('*')
          .eq('institution_id', validInstId)
          .order('is_current', { ascending: false })
          .limit(1);
        if (error) throw error;
        const row = data?.[0];
        if (!row) {
          return { data: null, error: 'No active academic term configured for MVIT.', source: 'supabase' };
        }
        return {
          data: {
            id: row.id,
            institution_id: row.institution_id,
            name: row.name,
            code: row.code,
            is_current: Boolean(row.is_current),
          },
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to fetch academic term.', source: 'supabase' };
      }
    }
    return { data: INITIAL_TERMS[0], source: 'demo_local' };
  }

  // ============================================================================
  // LABORATORIES (MVIT)
  // ============================================================================

  async getLabs(
    institutionId: string = 'inst-mvit',
    options?: { publicOnly?: boolean }
  ): Promise<RepositoryResult<Lab[]>> {
    const publicOnly = Boolean(options?.publicOnly);
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        let query = supabase
          .from('labs')
          .select('*, departments (name)')
          .eq('institution_id', validInstId);

        if (publicOnly) {
          query = query.eq('status', 'active').eq('is_public', true).neq('lab_type', 'pc_lab');
        }

        const { data, error } = await query
          .order('display_order', { ascending: true })
          .order('name', { ascending: true });

        if (error) throw error;

        const mapped: Lab[] = (data || []).map((row: any) => this.mapLabRow(row));
        return {
          data: publicOnly ? mapped.filter((l) => isPublicVisibleLab(l)) : mapped,
          source: 'supabase',
        };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load laboratories from Supabase.',
          source: 'supabase',
        };
      }
    }

    const demoFiltered = this.demoLabs.filter((l) => {
      if (l.institution_id !== institutionId) return false;
      return publicOnly ? isPublicVisibleLab(l) : true;
    });
    return {
      data: demoFiltered,
      source: 'demo_local',
    };
  }

  async getLabById(
    id: string,
    options?: { publicOnly?: boolean }
  ): Promise<RepositoryResult<Lab>> {
    const publicOnly = Boolean(options?.publicOnly);
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('labs')
          .select('*, departments (name)')
          .eq('id', id)
          .single();
        if (error) throw error;

        const mapped = this.mapLabRow(data);
        if (publicOnly && !isPublicVisibleLab(mapped)) {
          return { data: null, error: 'Laboratory not found.', source: 'supabase' };
        }
        return {
          data: mapped,
          source: 'supabase',
        };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Laboratory not found in Supabase.',
          source: 'supabase',
        };
      }
    }

    const found = this.demoLabs.find((l) => l.id === id);
    if (!found || (publicOnly && !isPublicVisibleLab(found))) {
      return { data: null, error: 'Laboratory not found', source: 'demo_local' };
    }
    return { data: found, source: 'demo_local' };
  }

  async createLab(labData: Omit<Lab, 'id' | 'created_at' | 'updated_at'>): Promise<RepositoryResult<Lab>> {
    const cleanCode = (labData.lab_code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { data: null, error: 'Laboratory code is required.', source: this.isLive ? 'supabase' : 'demo_local' };
    }
    if (!labData.name || !labData.name.trim()) {
      return { data: null, error: 'Laboratory name is required.', source: this.isLive ? 'supabase' : 'demo_local' };
    }

    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(labData.institution_id);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required to create a laboratory.', source: 'supabase' };
      }

      try {
        const { data, error } = await supabase
          .from('labs')
          .insert([
            {
              institution_id: validInstId,
              department_id: labData.department_id || null,
              lab_code: cleanCode,
              name: labData.name.trim(),
              description: labData.description || '',
              building: labData.building || '',
              room_number: labData.room_number || '',
              location: labData.location || '',
              capacity: labData.capacity || null,
              status: labData.status || 'active',
              lab_type: labData.lab_type || 'practical',
              is_public:
                labData.lab_type === 'pc_lab'
                  ? false
                  : labData.is_public ?? true,
              display_order: labData.display_order ?? 1,
              primary_assistant_id: null,
            },
          ])
          .select('*, departments(name)')
          .single();

        if (error) throw error;

        let assignedId: string | null = null;
        if (labData.assigned_assistant_id) {
          const assignRes = await this.assignLabAssistantAtomic(data.id, labData.assigned_assistant_id);
          if (!assignRes.success) {
            return {
              data: null,
              error: assignRes.error || 'Laboratory created, but Lab Assistant assignment failed.',
              source: 'supabase',
            };
          }
          assignedId = labData.assigned_assistant_id;
        }

        return {
          data: {
            ...this.mapLabRow(data),
            department_name: data.departments?.name || labData.department_name || '',
            assigned_assistant_id: assignedId,
            assigned_assistant_name: assignedId ? labData.assigned_assistant_name || null : null,
          },
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to register laboratory in Supabase', source: 'supabase' };
      }
    }

    const targetInst = labData.institution_id || 'inst-mvit';
    const exists = this.demoLabs.some(
      (l) => l.institution_id === targetInst && l.lab_code.toUpperCase() === cleanCode
    );
    if (exists) {
      return {
        data: null,
        error: `Laboratory code "${cleanCode}" already exists at MVIT.`,
        source: 'demo_local',
      };
    }

    const now = new Date().toISOString();
    const newLab: Lab = {
      ...labData,
      institution_id: targetInst,
      id: `lab-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now().toString(36)}`,
      lab_code: cleanCode,
      name: labData.name.trim(),
      status: labData.status || 'active',
      display_order: labData.display_order ?? this.demoLabs.length + 1,
      created_at: now,
      updated_at: now,
    };

    this.demoLabs.push(newLab);
    return { data: newLab, source: 'demo_local' };
  }

  async updateLab(id: string, updates: Partial<Lab>): Promise<RepositoryResult<Lab>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.name !== undefined) payload.name = updates.name.trim();
        if (updates.lab_code !== undefined) payload.lab_code = updates.lab_code.trim().toUpperCase();
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.building !== undefined) payload.building = updates.building;
        if (updates.room_number !== undefined) payload.room_number = updates.room_number;
        if (updates.location !== undefined) payload.location = updates.location;
        if (updates.capacity !== undefined) payload.capacity = updates.capacity;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.lab_type !== undefined) payload.lab_type = updates.lab_type;
        if (updates.is_public !== undefined) {
          payload.is_public = updates.lab_type === 'pc_lab' ? false : updates.is_public;
        } else if (updates.lab_type === 'pc_lab') {
          payload.is_public = false;
        }
        if (updates.display_order !== undefined) payload.display_order = updates.display_order;
        if (updates.department_id !== undefined) payload.department_id = updates.department_id || null;

        const { data, error } = await supabase
          .from('labs')
          .update(payload)
          .eq('id', id)
          .select('*, departments(name)')
          .single();

        if (error) throw error;

        let effectiveAssistantId: string | null = data.primary_assistant_id || null;
        if (updates.assigned_assistant_id !== undefined) {
          const assignRes = await this.assignLabAssistantAtomic(id, updates.assigned_assistant_id || null);
          if (!assignRes.success) {
            return {
              data: null,
              error: assignRes.error || 'Updated lab fields, but assistant reassignment failed.',
              source: 'supabase',
            };
          }
          effectiveAssistantId = updates.assigned_assistant_id || null;
        }

        return {
          data: {
            ...this.mapLabRow(data),
            assigned_assistant_id: effectiveAssistantId,
          },
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to update laboratory', source: 'supabase' };
      }
    }

    const index = this.demoLabs.findIndex((l) => l.id === id);
    if (index === -1) {
      return { data: null, error: 'Laboratory not found', source: 'demo_local' };
    }

    if (updates.lab_code) {
      const cleanCode = updates.lab_code.trim().toUpperCase();
      const duplicate = this.demoLabs.some(
        (l, i) => i !== index && l.lab_code.toUpperCase() === cleanCode
      );
      if (duplicate) {
        return {
          data: null,
          error: `Laboratory code "${cleanCode}" already exists at MVIT.`,
          source: 'demo_local',
        };
      }
      updates.lab_code = cleanCode;
    }

    this.demoLabs[index] = {
      ...this.demoLabs[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    return { data: this.demoLabs[index], source: 'demo_local' };
  }

  async deactivateLab(id: string): Promise<RepositoryResult<Lab>> {
    return this.updateLab(id, { status: 'inactive' });
  }

  async activateLab(id: string): Promise<RepositoryResult<Lab>> {
    return this.updateLab(id, { status: 'active' });
  }

  async deleteLab(id: string): Promise<RepositoryResult<boolean>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: false, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { error } = await supabase.from('labs').delete().eq('id', id);
        if (error) throw error;
        return { data: true, source: 'supabase' };
      } catch (err: any) {
        return {
          data: false,
          error: err?.message || 'Cannot permanently delete laboratory.',
          source: 'supabase',
        };
      }
    }

    const hasLinkedRecords =
      this.demoSubjects.some((s) => s.lab_id === id) ||
      this.demoInventory.some((i) => i.lab_id === id) ||
      this.demoDocuments.some((d) => d.lab_id === id);

    if (hasLinkedRecords) {
      return {
        data: false,
        error: 'Cannot permanently delete laboratory because inventory, subjects, or manuals reference it. Deactivate the laboratory instead.',
        source: 'demo_local',
      };
    }

    this.demoLabs = this.demoLabs.filter((l) => l.id !== id);
    return { data: true, source: 'demo_local' };
  }

  // ============================================================================
  // PROFILES & ATOMIC LAB ASSIGNMENTS
  // ============================================================================

  async getProfile(userId: string): Promise<RepositoryResult<Profile>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, profile_lab_assignments (lab_id)')
          .eq('id', userId)
          .single();
        if (error) throw error;

        const assignedLabs: string[] = (data.profile_lab_assignments || []).map((a: any) => a.lab_id);
        return {
          data: {
            id: data.id,
            institution_id: data.institution_id,
            role: data.role as Role,
            name: data.name,
            email: data.email,
            avatar: data.avatar_url,
            identifier: data.identifier,
            department_id: data.department_id,
            status: data.status || 'active',
            invited_at: data.invited_at,
            assigned_lab_ids: assignedLabs,
            created_at: data.created_at,
          },
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err.message, source: 'supabase' };
      }
    }
    const profile = this.demoProfiles.find((p) => p.id === userId) || this.demoProfiles[0];
    return { data: profile, source: 'demo_local' };
  }

  async getProfiles(institutionId: string = 'inst-mvit'): Promise<RepositoryResult<Profile[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*, profile_lab_assignments (lab_id)')
          .eq('institution_id', validInstId)
          .in('role', ['college_admin', 'lab_assistant'])
          .order('name');
        if (error) throw error;

        const mapped: Profile[] = (data || []).map((row: any) => ({
          id: row.id,
          institution_id: row.institution_id,
          role: row.role as Role,
          name: row.name,
          email: row.email,
          avatar: row.avatar_url,
          identifier: row.identifier,
          department_id: row.department_id,
          status: row.status || 'active',
          invited_at: row.invited_at,
          assigned_lab_ids: (row.profile_lab_assignments || []).map((a: any) => a.lab_id),
          created_at: row.created_at,
        }));
        return { data: mapped, source: 'supabase' };
      } catch (err: any) {
        return { data: null, error: err.message, source: 'supabase' };
      }
    }
    return {
      data: this.demoProfiles.filter((p) => p.institution_id === institutionId),
      source: 'demo_local',
    };
  }

  async updateProfileStatus(
    userId: string,
    status: 'active' | 'suspended' | 'invited'
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { success: false, error: 'Supabase client unavailable.' };
      }
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', userId);
        if (error) throw error;
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }
    this.demoProfiles = this.demoProfiles.map((p) => (p.id === userId ? { ...p, status } : p));
    return { success: true };
  }

  async assignLabAssistantAtomic(
    labId: string,
    assistantId: string | null
  ): Promise<{ success: boolean; error?: string; source: 'supabase' | 'demo_local' }> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { success: false, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase.rpc('assign_lab_assistant', {
          p_lab_id: labId,
          p_assistant_id: assistantId,
        });
        if (error) throw error;
        if (data && data.success === false) {
          return {
            success: false,
            error: data.error || 'Atomic lab assignment failed.',
            source: 'supabase',
          };
        }
        return { success: true, source: 'supabase' };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Atomic lab assignment failed.',
          source: 'supabase',
        };
      }
    }

    this.demoProfiles = this.demoProfiles.map((p) => {
      if (p.role !== 'lab_assistant') return p;
      const filtered = (p.assigned_lab_ids || []).filter((id) => id !== labId);
      if (assistantId && p.id === assistantId) {
        return { ...p, assigned_lab_ids: Array.from(new Set([...filtered, labId])) };
      }
      return { ...p, assigned_lab_ids: filtered };
    });
    this.demoLabs = this.demoLabs.map((l) =>
      l.id === labId ? { ...l, assigned_assistant_id: assistantId } : l
    );
    return { success: true, source: 'demo_local' };
  }

  async setAssistantLabAssignmentsAtomic(
    assistantId: string,
    labIds: string[]
  ): Promise<{ success: boolean; error?: string; source: 'supabase' | 'demo_local' }> {
    const cleanLabIds = Array.from(new Set(labIds.filter((id) => Boolean(id && id.trim()))));
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { success: false, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase.rpc('set_assistant_lab_assignments', {
          p_assistant_id: assistantId,
          p_lab_ids: cleanLabIds,
        });
        if (error) throw error;
        if (data && data.success === false) {
          return {
            success: false,
            error: data.error || 'Atomic laboratory assignment update failed.',
            source: 'supabase',
          };
        }
        return { success: true, source: 'supabase' };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Atomic laboratory assignment update failed.',
          source: 'supabase',
        };
      }
    }

    this.demoProfiles = this.demoProfiles.map((p) =>
      p.id === assistantId ? { ...p, assigned_lab_ids: cleanLabIds } : p
    );
    this.demoLabs = this.demoLabs.map((l) => {
      if (cleanLabIds.includes(l.id) && !l.assigned_assistant_id) {
        return { ...l, assigned_assistant_id: assistantId };
      }
      if (l.assigned_assistant_id === assistantId && !cleanLabIds.includes(l.id)) {
        return { ...l, assigned_assistant_id: null };
      }
      return l;
    });
    return { success: true, source: 'demo_local' };
  }

  async updateUserLabAssignments(
    userId: string,
    institutionId: string,
    labIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isLive && !this.requireLiveInstitutionId(institutionId)) {
      return { success: false, error: 'Resolved MVIT institution UUID is required.' };
    }
    const res = await this.setAssistantLabAssignmentsAtomic(userId, labIds);
    return { success: res.success, error: res.error };
  }

  // ============================================================================
  // DEPARTMENTS (MVIT)
  // ============================================================================

  async getDepartments(institutionId: string = 'inst-mvit'): Promise<RepositoryResult<Department[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('departments')
          .select('*')
          .eq('institution_id', validInstId)
          .order('name');
        if (error) throw error;
        const mapped: Department[] = (data || []).map((row: any) => ({
          id: row.id,
          institution_id: row.institution_id,
          code: row.code,
          name: row.name,
          description: row.description || '',
          head_faculty_name: row.head_faculty_name || '',
          active_subjects_count: 0,
        }));
        return { data: mapped, source: 'supabase' };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load departments from Supabase.',
          source: 'supabase',
        };
      }
    }
    return {
      data: this.demoDepartments.filter((d) => d.institution_id === institutionId),
      source: 'demo_local',
    };
  }

  async saveDepartment(
    dept: Omit<Department, 'id' | 'active_subjects_count'>
  ): Promise<RepositoryResult<Department>> {
    const cleanCode = (dept.code || '').trim().toUpperCase();
    const cleanName = (dept.name || '').trim();
    if (!cleanCode || !cleanName) {
      return {
        data: null,
        error: 'Department code and name are required.',
        source: this.isLive ? 'supabase' : 'demo_local',
      };
    }

    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(dept.institution_id);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('departments')
          .insert({
            institution_id: validInstId,
            code: cleanCode,
            name: cleanName,
            head_faculty_name: dept.head_faculty_name || '',
            description: dept.description || '',
          })
          .select()
          .single();
        if (error) throw error;
        return {
          data: {
            id: data.id,
            institution_id: data.institution_id,
            code: data.code,
            name: data.name,
            description: data.description || '',
            head_faculty_name: data.head_faculty_name || '',
            active_subjects_count: 0,
          },
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to save department.', source: 'supabase' };
      }
    }

    const created: Department = {
      ...dept,
      id: `dept-mvit-${Date.now().toString(36)}`,
      institution_id: dept.institution_id || 'inst-mvit',
      code: cleanCode,
      name: cleanName,
      active_subjects_count: 0,
    };
    this.demoDepartments.push(created);
    return { data: created, source: 'demo_local' };
  }

  // ============================================================================
  // PRACTICAL SUBJECTS & SYLLABUSES
  // ============================================================================

  async getSubjects(
    institutionId: string = 'inst-mvit',
    labId?: string
  ): Promise<RepositoryResult<PracticalSubject[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        let query = supabase
          .from('practical_subjects')
          .select('*, departments (name), subject_syllabuses (*)')
          .eq('institution_id', validInstId)
          .order('code');

        if (labId) {
          query = query.eq('lab_id', labId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const mapped: PracticalSubject[] = (data || []).map((row: any) => {
          const syllabusUnits: SubjectSyllabus[] = Array.isArray(row.subject_syllabuses)
            ? row.subject_syllabuses
                .map((u: any) => ({
                  id: u.id,
                  subject_id: u.subject_id || row.id,
                  unit_number: u.unit_number,
                  title: u.title,
                  description: u.description || '',
                  learning_outcomes: Array.isArray(u.learning_outcomes) ? u.learning_outcomes : [],
                }))
                .sort((a: SubjectSyllabus, b: SubjectSyllabus) => a.unit_number - b.unit_number)
            : [];

          return {
            id: row.id,
            institution_id: row.institution_id,
            lab_id: row.lab_id || undefined,
            course_id: row.course_id || undefined,
            department_id: row.department_id,
            department_name: row.departments?.name || 'Department',
            term_id: row.term_id,
            code: row.code,
            name: row.name,
            credits: row.credits ?? 2,
            semester: row.semester ?? 1,
            location: row.location || 'Lab Workstation',
            schedule_info: row.schedule_info || 'Regular Schedule',
            description: row.description || '',
            is_active: row.is_active ?? true,
            syllabus_pdf_id: row.syllabus_pdf_id || undefined,
            syllabus_pdf_url: row.syllabus_pdf_url || undefined,
            syllabus_pdf_name: row.syllabus_pdf_name || undefined,
            syllabus: syllabusUnits,
          };
        });
        return { data: mapped, source: 'supabase' };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load practical subjects from Supabase.',
          source: 'supabase',
        };
      }
    }

    const filtered = this.demoSubjects.filter((s) => {
      if (s.institution_id !== institutionId) return false;
      if (labId) return s.lab_id === labId;
      return true;
    });
    return { data: filtered, source: 'demo_local' };
  }

  async saveSubject(
    subj: Omit<PracticalSubject, 'id'>,
    existingId?: string
  ): Promise<RepositoryResult<PracticalSubject>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(subj.institution_id);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        let resolvedTermId = this.isUuid(subj.term_id) ? subj.term_id : '';
        if (!resolvedTermId) {
          const termRes = await this.getCurrentTerm(validInstId);
          if (!termRes.data?.id) {
            return {
              data: null,
              error: termRes.error || 'No academic term found for MVIT.',
              source: 'supabase',
            };
          }
          resolvedTermId = termRes.data.id;
        }

        const payload: Record<string, any> = {
          institution_id: validInstId,
          lab_id: subj.lab_id || null,
          course_id: this.isUuid(subj.course_id) ? subj.course_id : null,
          department_id: subj.department_id || null,
          term_id: resolvedTermId,
          code: subj.code.trim().toUpperCase(),
          name: subj.name.trim(),
          credits: subj.credits,
          semester: subj.semester,
          description: subj.description,
          schedule_info: subj.schedule_info,
          location: subj.location,
          is_active: subj.is_active ?? true,
          syllabus_pdf_id: this.isUuid(subj.syllabus_pdf_id) ? subj.syllabus_pdf_id : null,
          syllabus_pdf_url: subj.syllabus_pdf_url || null,
          syllabus_pdf_name: subj.syllabus_pdf_name || null,
        };

        const result = existingId
          ? await supabase.from('practical_subjects').update(payload).eq('id', existingId).select().single()
          : await supabase.from('practical_subjects').insert(payload).select().single();

        if (result.error) throw result.error;
        const subjectId = result.data.id;

        if (Array.isArray(subj.syllabus)) {
          const { error: delErr } = await supabase
            .from('subject_syllabuses')
            .delete()
            .eq('subject_id', subjectId);
          if (delErr) throw delErr;

          if (subj.syllabus.length > 0) {
            const unitRows = subj.syllabus.map((u, idx) => ({
              subject_id: subjectId,
              unit_number: u.unit_number || idx + 1,
              title: u.title,
              description: u.description || '',
              learning_outcomes: u.learning_outcomes || [],
            }));
            const { error: insErr } = await supabase.from('subject_syllabuses').insert(unitRows);
            if (insErr) throw insErr;
          }
        }

        return {
          data: {
            ...subj,
            id: subjectId,
            institution_id: validInstId,
            term_id: resolvedTermId,
          },
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to save subject', source: 'supabase' };
      }
    }

    const saved: PracticalSubject = {
      ...subj,
      id: existingId || `subj-${Date.now().toString(36)}`,
    };
    if (existingId) {
      this.demoSubjects = this.demoSubjects.map((s) => (s.id === existingId ? saved : s));
    } else {
      this.demoSubjects.push(saved);
    }
    return { data: saved, source: 'demo_local' };
  }

  async deleteSubject(id: string): Promise<RepositoryResult<boolean>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: false, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { error } = await supabase.from('practical_subjects').delete().eq('id', id);
        if (error) throw error;
        return { data: true, source: 'supabase' };
      } catch (err: any) {
        return {
          data: false,
          error: err?.message || 'Failed to delete practical subject.',
          source: 'supabase',
        };
      }
    }

    this.demoSubjects = this.demoSubjects.filter((s) => s.id !== id);
    return { data: true, source: 'demo_local' };
  }

  // ============================================================================
  // EXPERIMENTS
  // ============================================================================

  async getExperiments(
    institutionId: string = 'inst-mvit',
    subjectId?: string
  ): Promise<RepositoryResult<Experiment[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        let query = supabase
          .from('experiments')
          .select(
            `
            *,
            practical_subjects (code, name, lab_id, department_id, departments(name))
          `
          )
          .eq('institution_id', validInstId)
          .order('exp_number');

        if (subjectId) {
          query = query.eq('subject_id', subjectId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const mapped: Experiment[] = (data || []).map((row: any) => ({
          id: row.id,
          institution_id: row.institution_id,
          lab_id: row.practical_subjects?.lab_id || undefined,
          subject_id: row.subject_id,
          subject_code: row.practical_subjects?.code || 'LAB',
          subject_name: row.practical_subjects?.name || 'Subject',
          department_id: row.practical_subjects?.department_id || '',
          department_name: row.practical_subjects?.departments?.name || '',
          exp_number: row.exp_number,
          title: row.title,
          slug: row.slug,
          aim: row.aim,
          theory: row.theory,
          learning_objectives: row.learning_objectives || [],
          components_required: row.components_required || [],
          equipment_required: row.equipment_required || [],
          diagram_url: row.diagram_url,
          procedure: row.procedure || [],
          observation_headers: row.observation_headers || [],
          sample_observations: row.sample_observations || [],
          expected_result: row.expected_result,
          precautions: row.precautions || [],
          manual_content: row.manual_content || '',
          manual_doc_name: row.manual_doc_name,
          manual_pdf_url: row.manual_pdf_url,
          manual_pdf_name: row.manual_pdf_name,
          youtube_url: row.youtube_url || '',
          youtube_video_id: row.youtube_video_id,
          youtube_alt_url: row.youtube_alt_url || '',
          youtube_search_url: row.youtube_search_url || '',
          bench_twin_url: row.simulation_url || row.bench_twin_url || '',
          bench_twin_mode: row.bench_twin_mode || 'external',
          simulation_url: row.simulation_url || row.bench_twin_url || '',
          simulation_provider: row.simulation_provider || 'custom',
          simulation_type: row.simulation_type || undefined,
          built_in_simulator_id: row.built_in_simulator_id || null,
          simulation_note: row.simulation_note || '',
          resource_status: row.resource_status || 'verified',
          last_verified_at: row.last_verified_at || undefined,
          simulator_type: row.simulator_type || 'custom',
          is_published: row.is_published ?? true,
          created_by: row.created_by || 'Lab Assistant',
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        return { data: mapped, source: 'supabase' };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load experiments from Supabase.',
          source: 'supabase',
        };
      }
    }

    let filtered = this.demoExperiments.filter((e) => (e.institution_id || 'inst-mvit') === institutionId);
    if (subjectId) {
      filtered = filtered.filter((e) => e.subject_id === subjectId);
    }
    return { data: filtered, source: 'demo_local' };
  }

  async saveExperiment(
    exp: Omit<Experiment, 'id' | 'created_at' | 'updated_at'>,
    existingId?: string
  ): Promise<RepositoryResult<Experiment>> {
    const supabase = this.getClient();
    const canonicalSimUrl = exp.simulation_url ?? exp.bench_twin_url ?? '';
    const canonicalBuiltIn =
      exp.built_in_simulator_id !== undefined
        ? exp.built_in_simulator_id
        : exp.simulator_type && exp.simulator_type !== 'custom'
          ? exp.simulator_type
          : null;

    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(exp.institution_id);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const payload: Record<string, any> = {
          institution_id: validInstId,
          subject_id: exp.subject_id,
          exp_number: exp.exp_number,
          title: exp.title,
          slug: exp.slug,
          aim: exp.aim,
          theory: exp.theory,
          learning_objectives: exp.learning_objectives,
          components_required: exp.components_required,
          equipment_required: exp.equipment_required,
          diagram_url: exp.diagram_url,
          procedure: exp.procedure,
          observation_headers: exp.observation_headers,
          sample_observations: exp.sample_observations,
          expected_result: exp.expected_result,
          precautions: exp.precautions,
          manual_content: exp.manual_content,
          manual_doc_name: exp.manual_doc_name,
          manual_pdf_url: exp.manual_pdf_url,
          manual_pdf_name: exp.manual_pdf_name,
          youtube_url: exp.youtube_url,
          youtube_video_id: exp.youtube_video_id,
          youtube_alt_url: exp.youtube_alt_url ?? '',
          youtube_search_url: exp.youtube_search_url ?? '',
          bench_twin_url: canonicalSimUrl,
          bench_twin_mode: exp.bench_twin_mode,
          simulation_url: canonicalSimUrl,
          simulation_provider: exp.simulation_provider ?? 'custom',
          simulation_type: exp.simulation_type ?? 'none',
          built_in_simulator_id: canonicalBuiltIn,
          simulation_note: exp.simulation_note ?? '',
          resource_status: exp.resource_status ?? 'verified',
          last_verified_at: exp.last_verified_at ?? new Date().toISOString(),
          simulator_type: exp.simulator_type,
          is_published: exp.is_published,
          updated_at: new Date().toISOString(),
        };

        if (this.isUuid(exp.created_by)) {
          payload.created_by = exp.created_by;
        }

        const result = existingId
          ? await supabase.from('experiments').update(payload).eq('id', existingId).select().single()
          : await supabase.from('experiments').insert(payload).select().single();

        if (result.error) throw result.error;
        const row = result.data;
        return {
          data: {
            ...exp,
            id: row.id,
            institution_id: validInstId,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to save experiment', source: 'supabase' };
      }
    }

    const now = new Date().toISOString();
    const saved: Experiment = {
      ...exp,
      id: existingId || `exp-${Date.now().toString(36)}`,
      created_at: now,
      updated_at: now,
    };
    if (existingId) {
      this.demoExperiments = this.demoExperiments.map((e) => (e.id === existingId ? saved : e));
    } else {
      this.demoExperiments.push(saved);
    }
    return { data: saved, source: 'demo_local' };
  }

  async deleteExperiment(id: string): Promise<RepositoryResult<boolean>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: false, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { error } = await supabase.from('experiments').delete().eq('id', id);
        if (error) throw error;
        return { data: true, source: 'supabase' };
      } catch (err: any) {
        return { data: false, error: err?.message || 'Failed to delete experiment.', source: 'supabase' };
      }
    }

    this.demoExperiments = this.demoExperiments.filter((e) => e.id !== id);
    return { data: true, source: 'demo_local' };
  }

  // ============================================================================
  // LAB MANUAL DOCUMENTS (PDFs & Lab-Scoped Storage)
  // ============================================================================

  async getDocuments(institutionId: string = 'inst-mvit'): Promise<RepositoryResult<LabManualDocument[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('lab_manual_documents')
          .select(
            `
            *,
            practical_subjects (code, lab_id),
            experiments (title),
            profiles:uploaded_by (name)
          `
          )
          .eq('institution_id', validInstId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        const mapped: LabManualDocument[] = (data || []).map((row: any) => ({
          id: row.id,
          institution_id: row.institution_id,
          lab_id: row.lab_id || row.practical_subjects?.lab_id || undefined,
          subject_id: row.subject_id || undefined,
          subject_code: row.practical_subjects?.code,
          experiment_id: row.experiment_id || undefined,
          experiment_title: row.experiments?.title,
          type: row.type,
          title: row.title,
          description: row.description || '',
          file_name: row.file_name,
          file_size: Number(row.file_size || 0),
          file_url: row.file_url,
          storage_path: row.storage_path || undefined,
          is_published: row.is_published ?? true,
          uploaded_by_id: row.uploaded_by,
          uploaded_by_name: row.profiles?.name || 'Lab Assistant',
          created_at: row.created_at,
          updated_at: row.updated_at,
        }));
        return { data: mapped, source: 'supabase' };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load laboratory manual documents.',
          source: 'supabase',
        };
      }
    }
    return {
      data: this.demoDocuments.filter((d) => d.institution_id === institutionId),
      source: 'demo_local',
    };
  }

  async saveDocument(
    doc: Omit<LabManualDocument, 'id' | 'created_at' | 'updated_at'>,
    existingId?: string
  ): Promise<RepositoryResult<LabManualDocument>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(doc.institution_id);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const payload = {
          institution_id: validInstId,
          lab_id: doc.lab_id || null,
          subject_id: doc.subject_id || null,
          experiment_id: doc.experiment_id || null,
          type: doc.type,
          title: doc.title,
          description: doc.description,
          file_name: doc.file_name,
          file_size: doc.file_size,
          file_url: doc.file_url,
          storage_path: doc.storage_path || null,
          is_published: doc.is_published,
          uploaded_by: this.isUuid(doc.uploaded_by_id) ? doc.uploaded_by_id : null,
          updated_at: new Date().toISOString(),
        };

        const result = existingId
          ? await supabase.from('lab_manual_documents').update(payload).eq('id', existingId).select().single()
          : await supabase.from('lab_manual_documents').insert(payload).select().single();

        if (result.error) throw result.error;
        const row = result.data;
        return {
          data: {
            ...doc,
            id: row.id,
            institution_id: validInstId,
            lab_id: row.lab_id || doc.lab_id,
            storage_path: row.storage_path || doc.storage_path,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to save document metadata', source: 'supabase' };
      }
    }

    const now = new Date().toISOString();
    const saved: LabManualDocument = {
      ...doc,
      id: existingId || `doc-${Date.now().toString(36)}`,
      created_at: now,
      updated_at: now,
    };
    if (existingId) {
      this.demoDocuments = this.demoDocuments.map((d) => (d.id === existingId ? saved : d));
    } else {
      this.demoDocuments.unshift(saved);
    }
    return { data: saved, source: 'demo_local' };
  }

  async deleteDocument(id: string): Promise<RepositoryResult<boolean>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: false, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { error } = await supabase.from('lab_manual_documents').delete().eq('id', id);
        if (error) throw error;
        return { data: true, source: 'supabase' };
      } catch (err: any) {
        return { data: false, error: err.message, source: 'supabase' };
      }
    }
    this.demoDocuments = this.demoDocuments.filter((d) => d.id !== id);
    return { data: true, source: 'demo_local' };
  }

  // ============================================================================
  // INVENTORY, TRANSACTIONS & SANITIZED PUBLIC QR LOOKUP
  // ============================================================================

  async getInventory(
    institutionId: string = 'inst-mvit',
    labId?: string
  ): Promise<RepositoryResult<InventoryItem[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        let query = supabase
          .from('inventory_items')
          .select('*, departments(name), labs(name, lab_code)')
          .eq('institution_id', validInstId)
          .order('name');

        if (labId) {
          query = query.eq('lab_id', labId);
        }

        const { data, error } = await query;
        if (error) throw error;
        const mapped: InventoryItem[] = (data || []).map((row: any) => this.mapInventoryRow(row));
        return { data: mapped, source: 'supabase' };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load inventory items from Supabase.',
          source: 'supabase',
        };
      }
    }

    const filtered = this.demoInventory.filter((i) => {
      if (i.institution_id !== institutionId) return false;
      if (labId) return i.lab_id === labId;
      return true;
    });
    return { data: filtered, source: 'demo_local' };
  }

  async getInventoryItemById(id: string): Promise<RepositoryResult<InventoryItem>> {
    const supabase = this.getClient();
    const cleanId = id.trim();
    const isUuid = this.isUuid(cleanId);

    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        let query = supabase.from('inventory_items').select('*, departments(name), labs(name, lab_code)');
        query = isUuid ? query.eq('id', cleanId) : query.eq('item_code', cleanId.toUpperCase());

        const { data, error } = await query.single();
        if (error) throw error;

        return {
          data: this.mapInventoryRow(data),
          source: 'supabase',
        };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Apparatus record not found or access denied.',
          source: 'supabase',
        };
      }
    }

    const found = this.demoInventory.find(
      (i) => i.id === cleanId || i.item_code.toUpperCase() === cleanId.toUpperCase()
    );
    if (found) {
      return { data: found, source: 'demo_local' };
    }
    return { data: null, error: 'Apparatus item record not found in MVIT inventory', source: 'demo_local' };
  }

  async lookupPublicInventoryQr(identifier: string): Promise<RepositoryResult<PublicQrInventoryItem>> {
    const cleanId = (identifier || '').trim();
    if (!cleanId) {
      return {
        data: null,
        error: 'Equipment QR identifier or item code is required.',
        source: this.isLive ? 'supabase' : 'demo_local',
      };
    }

    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase.rpc('lookup_public_inventory_qr', {
          p_identifier: cleanId,
        });
        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          return {
            data: null,
            error: 'No approved MVIT apparatus matched that QR code.',
            source: 'supabase',
          };
        }

        const sanitized: PublicQrInventoryItem = {
          id: row.id,
          institution_id: row.institution_id,
          lab_id: row.lab_id || undefined,
          laboratory_name: row.laboratory_name || undefined,
          laboratory_code: row.laboratory_code || undefined,
          department_id: row.department_id || undefined,
          department_name: row.department_name || undefined,
          item_code: row.item_code,
          name: row.name,
          category: row.category,
          location: row.location || 'MVIT Laboratory',
          unit: row.unit,
          quantity_available: Number(row.quantity_available ?? 0),
          quantity_total: Number(row.quantity_total ?? 0),
          availability_status: row.availability_status || 'in_stock',
        };
        return { data: sanitized, source: 'supabase' };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Public QR lookup failed.',
          source: 'supabase',
        };
      }
    }

    const matched = this.demoInventory.find(
      (i) => i.id === cleanId || i.item_code.toUpperCase() === cleanId.toUpperCase()
    );
    if (!matched) {
      return {
        data: null,
        error: 'Apparatus item record not found in MVIT inventory',
        source: 'demo_local',
      };
    }

    const matchedLab = this.demoLabs.find((l) => l.id === matched.lab_id);
    if (matchedLab && !isPublicVisibleLab(matchedLab)) {
      return {
        data: null,
        error: 'This laboratory asset is not available on the public portal.',
        source: 'demo_local',
      };
    }

    return {
      data: {
        id: matched.id,
        institution_id: matched.institution_id,
        lab_id: matched.lab_id,
        laboratory_name: matchedLab?.name,
        laboratory_code: matchedLab?.lab_code,
        department_id: matched.department_id,
        department_name: matched.department_name,
        item_code: matched.item_code,
        name: matched.name,
        category: matched.category,
        location: matched.location,
        unit: matched.unit,
        quantity_available: matched.quantity_available,
        quantity_total: matched.quantity_total,
        availability_status: calculateStockStatus(
          matched.quantity_available,
          matched.min_safety_threshold
        ),
      },
      source: 'demo_local',
    };
  }

  async saveInventoryItem(
    item: Omit<InventoryItem, 'id' | 'status'>,
    existingId?: string
  ): Promise<RepositoryResult<InventoryItem>> {
    const cleanCode = (item.item_code || '').trim().toUpperCase();
    if (!cleanCode || !item.name.trim()) {
      return {
        data: null,
        error: 'Item code and apparatus name are required.',
        source: this.isLive ? 'supabase' : 'demo_local',
      };
    }

    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(item.institution_id);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const payload = {
          institution_id: validInstId,
          lab_id: item.lab_id || null,
          department_id: item.department_id || null,
          item_code: cleanCode,
          name: item.name.trim(),
          category: item.category,
          location: item.location || 'Lab Store',
          quantity_available: item.quantity_available,
          quantity_total: item.quantity_total,
          unit: item.unit || 'pcs',
          min_safety_threshold: item.min_safety_threshold ?? 5,
          last_inspected: item.last_inspected || new Date().toISOString().slice(0, 10),
        };

        const result = existingId
          ? await supabase
              .from('inventory_items')
              .update(payload)
              .eq('id', existingId)
              .select('*, departments(name), labs(name, lab_code)')
              .single()
          : await supabase
              .from('inventory_items')
              .insert(payload)
              .select('*, departments(name), labs(name, lab_code)')
              .single();

        if (result.error) throw result.error;
        return {
          data: this.mapInventoryRow(result.data),
          source: 'supabase',
        };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to save inventory item.',
          source: 'supabase',
        };
      }
    }

    const saved: InventoryItem = {
      ...item,
      id: existingId || `inv-mvit-${Date.now().toString(36)}`,
      institution_id: item.institution_id || 'inst-mvit',
      item_code: cleanCode,
      status: calculateStockStatus(item.quantity_available, item.min_safety_threshold),
      last_inspected: item.last_inspected || new Date().toISOString().slice(0, 10),
    };
    if (existingId) {
      this.demoInventory = this.demoInventory.map((i) => (i.id === existingId ? saved : i));
    } else {
      this.demoInventory.unshift(saved);
    }
    return { data: saved, source: 'demo_local' };
  }

  async deleteInventoryItem(id: string): Promise<RepositoryResult<boolean>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: false, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { error } = await supabase.from('inventory_items').delete().eq('id', id);
        if (error) throw error;
        return { data: true, source: 'supabase' };
      } catch (err: any) {
        return {
          data: false,
          error: err?.message || 'Failed to delete inventory item.',
          source: 'supabase',
        };
      }
    }
    this.demoInventory = this.demoInventory.filter((i) => i.id !== id);
    return { data: true, source: 'demo_local' };
  }

  async getInventoryTransactions(
    institutionId: string = 'inst-mvit'
  ): Promise<RepositoryResult<InventoryTransaction[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('inventory_transactions')
          .select(
            `
            *,
            inventory_items!inner (institution_id, item_code, name),
            profiles:handled_by (name)
          `
          )
          .eq('inventory_items.institution_id', validInstId)
          .order('timestamp', { ascending: false })
          .limit(150);

        if (error) throw error;
        const mapped: InventoryTransaction[] = (data || []).map((row: any) => ({
          id: row.id,
          item_id: row.item_id,
          item_code: row.inventory_items?.item_code || '',
          item_name: row.inventory_items?.name || '',
          transaction_type: row.transaction_type,
          quantity: row.quantity,
          borrower_id: row.student_roll_number || undefined,
          borrower_name: row.student_name || undefined,
          experiment_title: row.experiment_title || undefined,
          handled_by_name: row.profiles?.name || 'Lab Assistant',
          timestamp: row.timestamp,
          remarks: row.remarks || '',
        }));
        return { data: mapped, source: 'supabase' };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load inventory transactions.',
          source: 'supabase',
        };
      }
    }
    return { data: this.demoTransactions, source: 'demo_local' };
  }

  async processInventoryTransaction(
    itemId: string,
    type: 'issue' | 'return' | 'damage_writeoff' | 'restock',
    quantity: number,
    borrowerId: string,
    borrowerName: string,
    experimentTitle: string,
    remarks: string
  ): Promise<{ success: boolean; error?: string; source: 'supabase' | 'demo_local' }> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { success: false, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase.rpc('process_inventory_transaction', {
          p_item_id: itemId,
          p_type: type,
          p_quantity: quantity,
          p_student_roll: borrowerId,
          p_student_name: borrowerName,
          p_experiment_title: experimentTitle,
          p_remarks: remarks,
        });

        if (error) throw error;
        if (data && !data.success) {
          return { success: false, error: data.error, source: 'supabase' };
        }
        return { success: true, source: 'supabase' };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Inventory transaction failed', source: 'supabase' };
      }
    }

    return { success: true, source: 'demo_local' };
  }

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  async getAuditLogs(institutionId: string = 'inst-mvit'): Promise<RepositoryResult<AuditLog[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) {
        return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      }
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) {
        return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      }
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('institution_id', validInstId)
          .order('timestamp', { ascending: false })
          .limit(100);

        if (error) throw error;
        const mapped: AuditLog[] = (data || []).map((row: any) => ({
          id: row.id,
          institution_id: row.institution_id,
          user_name: row.user_name,
          user_role: row.user_role as Role,
          action: row.action,
          resource_type: row.resource_type,
          resource_id: row.resource_id,
          details: row.details || '',
          timestamp: row.timestamp,
        }));
        return { data: mapped, source: 'supabase' };
      } catch (err: any) {
        return {
          data: null,
          error: err?.message || 'Failed to load audit logs from Supabase.',
          source: 'supabase',
        };
      }
    }

    return {
      data: this.demoAuditLogs.filter((l) => l.institution_id === institutionId),
      source: 'demo_local',
    };
  }

  async recordAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    const supabase = this.getClient();
    if (this.isLive && supabase) {
      const validInstId = this.requireLiveInstitutionId(log.institution_id);
      if (!validInstId) return;
      try {
        await supabase.from('audit_logs').insert({
          institution_id: validInstId,
          user_name: log.user_name,
          user_role: log.user_role,
          action: log.action,
          resource_type: log.resource_type,
          resource_id: log.resource_id,
          details: log.details,
        });
      } catch (err) {
        console.warn('Failed to insert audit log in Supabase:', err);
      }
    }
  }

  // ============================================================================
  // COURSES & LABORATORY / EXPERIMENT COURSE MAPPINGS
  // ============================================================================

  async getCourses(institutionId: string = 'inst-mvit'): Promise<RepositoryResult<Course[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      try {
        const { data, error } = await supabase
          .from('courses')
          .select('*')
          .eq('institution_id', validInstId)
          .order('display_order', { ascending: true })
          .order('code', { ascending: true });
        if (error) throw error;
        return {
          data: (data || []).map((row: any) => ({
            id: row.id,
            institution_id: row.institution_id,
            code: row.code,
            name: row.name,
            degree: row.degree || 'B.Tech',
            description: row.description || '',
            is_active: row.is_active ?? true,
            display_order: row.display_order ?? 1,
            created_at: row.created_at,
            updated_at: row.updated_at,
          })),
          source: 'supabase',
        };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to load courses.', source: 'supabase' };
      }
    }
    return {
      data: this.demoCourses.filter((c) => c.institution_id === institutionId),
      source: 'demo_local',
    };
  }

  async saveCourse(
    course: Omit<Course, 'id' | 'created_at' | 'updated_at'>,
    existingId?: string
  ): Promise<RepositoryResult<Course>> {
    const cleanCode = (course.code || '').trim().toUpperCase();
    if (!cleanCode || !course.name.trim()) {
      return { data: null, error: 'Course code and name are required.', source: this.isLive ? 'supabase' : 'demo_local' };
    }
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      const validInstId = this.requireLiveInstitutionId(course.institution_id);
      if (!validInstId) return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      try {
        const payload = {
          institution_id: validInstId,
          code: cleanCode,
          name: course.name.trim(),
          degree: course.degree || 'B.Tech',
          description: course.description || '',
          is_active: course.is_active ?? true,
          display_order: course.display_order ?? 1,
          updated_at: new Date().toISOString(),
        };
        const res = existingId
          ? await supabase.from('courses').update(payload).eq('id', existingId).select().single()
          : await supabase.from('courses').insert(payload).select().single();
        if (res.error) throw res.error;
        return { data: res.data as Course, source: 'supabase' };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to save course.', source: 'supabase' };
      }
    }
    const created: Course = {
      ...course,
      id: existingId || `course-mvit-${cleanCode.toLowerCase()}-${Date.now().toString(36)}`,
      code: cleanCode,
      name: course.name.trim(),
    };
    if (existingId) {
      this.demoCourses = this.demoCourses.map((c) => (c.id === existingId ? created : c));
    } else {
      this.demoCourses.push(created);
    }
    return { data: created, source: 'demo_local' };
  }

  async getLaboratoryCourses(institutionId: string = 'inst-mvit'): Promise<RepositoryResult<LaboratoryCourse[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      try {
        const { data, error } = await supabase
          .from('laboratory_courses')
          .select('*')
          .eq('institution_id', validInstId);
        if (error) throw error;
        return { data: (data || []) as LaboratoryCourse[], source: 'supabase' };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to load laboratory course mappings.', source: 'supabase' };
      }
    }
    return {
      data: this.demoLabCourses.filter((lc) => lc.institution_id === institutionId),
      source: 'demo_local',
    };
  }

  async setLabCourses(
    institutionId: string,
    labId: string,
    courseIds: string[]
  ): Promise<{ success: boolean; error?: string; data?: LaboratoryCourse[] }> {
    const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { success: false, error: 'Supabase client unavailable.' };
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) return { success: false, error: 'Resolved MVIT institution UUID is required.' };
      try {
        const { error: delErr } = await supabase
          .from('laboratory_courses')
          .delete()
          .eq('lab_id', labId)
          .eq('institution_id', validInstId);
        if (delErr) throw delErr;
        if (uniqueCourseIds.length > 0) {
          const rows = uniqueCourseIds.map((courseId) => ({
            institution_id: validInstId,
            lab_id: labId,
            course_id: courseId,
          }));
          const { data, error: insErr } = await supabase.from('laboratory_courses').insert(rows).select();
          if (insErr) throw insErr;
          return { success: true, data: (data || []) as LaboratoryCourse[] };
        }
        return { success: true, data: [] };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to save laboratory course mappings.' };
      }
    }

    const others = this.demoLabCourses.filter((lc) => lc.lab_id !== labId);
    const added: LaboratoryCourse[] = uniqueCourseIds.map((cid, idx) => ({
      id: `lc-${labId}-${cid}-${idx}`,
      institution_id: institutionId,
      lab_id: labId,
      course_id: cid,
    }));
    this.demoLabCourses = [...others, ...added];
    return { success: true, data: added };
  }

  async getExperimentCourses(institutionId: string = 'inst-mvit'): Promise<RepositoryResult<ExperimentCourse[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      try {
        const { data, error } = await supabase
          .from('experiment_courses')
          .select('*')
          .eq('institution_id', validInstId);
        if (error) throw error;
        return { data: (data || []) as ExperimentCourse[], source: 'supabase' };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to load experiment course mappings.', source: 'supabase' };
      }
    }
    return {
      data: this.demoExperimentCourses.filter((ec) => ec.institution_id === institutionId),
      source: 'demo_local',
    };
  }

  async setExperimentCourses(
    institutionId: string,
    experimentId: string,
    courseIds: string[]
  ): Promise<{ success: boolean; error?: string; data?: ExperimentCourse[] }> {
    const uniqueCourseIds = Array.from(new Set(courseIds.filter(Boolean)));
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { success: false, error: 'Supabase client unavailable.' };
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) return { success: false, error: 'Resolved MVIT institution UUID is required.' };
      try {
        const { error: delErr } = await supabase
          .from('experiment_courses')
          .delete()
          .eq('experiment_id', experimentId)
          .eq('institution_id', validInstId);
        if (delErr) throw delErr;
        if (uniqueCourseIds.length > 0) {
          const rows = uniqueCourseIds.map((courseId) => ({
            institution_id: validInstId,
            experiment_id: experimentId,
            course_id: courseId,
          }));
          const { data, error: insErr } = await supabase.from('experiment_courses').insert(rows).select();
          if (insErr) throw insErr;
          return { success: true, data: (data || []) as ExperimentCourse[] };
        }
        return { success: true, data: [] };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to save experiment course mappings.' };
      }
    }

    const others = this.demoExperimentCourses.filter((ec) => ec.experiment_id !== experimentId);
    const added: ExperimentCourse[] = uniqueCourseIds.map((cid, idx) => ({
      id: `ec-${experimentId}-${cid}-${idx}`,
      institution_id: institutionId,
      experiment_id: experimentId,
      course_id: cid,
    }));
    this.demoExperimentCourses = [...others, ...added];
    return { success: true, data: added };
  }

  // ============================================================================
  // PC LABORATORY MANAGEMENT (STRICTLY STAFF-ONLY IN LIVE RLS)
  // ============================================================================

  private mapPcComputerRow(row: any): PcLabComputer {
    return {
      id: row.id,
      institution_id: row.institution_id,
      lab_id: row.lab_id,
      computer_code: row.computer_code,
      hostname: row.hostname || '',
      computer_type: row.computer_type || 'student_computer',
      processor: row.processor || '',
      ram: row.ram || '',
      storage: row.storage || '',
      operating_system: row.operating_system || '',
      location: row.location || 'PC Lab',
      assigned_staff_name: row.assigned_staff_name || '',
      assigned_department: row.assigned_department || '',
      specs_summary: row.specs_summary || '',
      status: row.status || 'working',
      maintenance_status: row.maintenance_status || 'operational',
      last_updated: row.last_updated ? String(row.last_updated).slice(0, 10) : new Date().toISOString().slice(0, 10),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapPcMaintenanceRow(row: any): PcLabMaintenanceRecord {
    return {
      id: row.id,
      institution_id: row.institution_id,
      lab_id: row.lab_id,
      computer_id: row.computer_id,
      reported_issue: row.reported_issue,
      defect_description: row.defect_description || '',
      date_reported: row.date_reported ? String(row.date_reported).slice(0, 10) : new Date().toISOString().slice(0, 10),
      repair_status: row.repair_status || 'defective',
      maintenance_remarks: row.maintenance_remarks || '',
      resolution_date: row.resolution_date ? String(row.resolution_date).slice(0, 10) : null,
      reported_by: row.reported_by || undefined,
      updated_by: row.updated_by || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async getPcComputers(
    institutionId: string = 'inst-mvit',
    labId?: string
  ): Promise<RepositoryResult<PcLabComputer[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      try {
        let query = supabase
          .from('pc_lab_computers')
          .select('*')
          .eq('institution_id', validInstId)
          .order('computer_code');
        if (labId) query = query.eq('lab_id', labId);
        const { data, error } = await query;
        if (error) throw error;
        return { data: (data || []).map((r: any) => this.mapPcComputerRow(r)), source: 'supabase' };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to load PC Lab computers.', source: 'supabase' };
      }
    }
    return {
      data: this.demoPcComputers.filter((c) => c.institution_id === institutionId && (!labId || c.lab_id === labId)),
      source: 'demo_local',
    };
  }

  async savePcComputer(
    computer: Omit<PcLabComputer, 'id' | 'created_at' | 'updated_at'>,
    existingId?: string
  ): Promise<RepositoryResult<PcLabComputer>> {
    const cleanCode = (computer.computer_code || '').trim().toUpperCase();
    if (!cleanCode || !computer.lab_id) {
      return {
        data: null,
        error: 'Computer identification number and target PC Laboratory are required.',
        source: this.isLive ? 'supabase' : 'demo_local',
      };
    }

    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      const validInstId = this.requireLiveInstitutionId(computer.institution_id);
      if (!validInstId) return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      try {
        const nowIso = new Date().toISOString();
        const payload = {
          institution_id: validInstId,
          lab_id: computer.lab_id,
          computer_code: cleanCode,
          hostname: computer.hostname || '',
          computer_type: computer.computer_type || 'student_computer',
          processor: computer.processor || '',
          ram: computer.ram || '',
          storage: computer.storage || '',
          operating_system: computer.operating_system || '',
          location: computer.location || 'PC Lab',
          assigned_staff_name: computer.assigned_staff_name || '',
          assigned_department: computer.assigned_department || '',
          specs_summary: computer.specs_summary || '',
          status: computer.status || 'working',
          maintenance_status: computer.maintenance_status || 'operational',
          last_updated: nowIso,
          updated_at: nowIso,
        };
        const res = existingId
          ? await supabase.from('pc_lab_computers').update(payload).eq('id', existingId).select().single()
          : await supabase.from('pc_lab_computers').insert(payload).select().single();
        if (res.error) throw res.error;
        return { data: this.mapPcComputerRow(res.data), source: 'supabase' };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to save PC Lab computer record.', source: 'supabase' };
      }
    }

    const saved: PcLabComputer = {
      ...computer,
      id: existingId || `pc-${Date.now().toString(36)}`,
      computer_code: cleanCode,
      last_updated: computer.last_updated || new Date().toISOString().slice(0, 10),
    };
    if (existingId) {
      this.demoPcComputers = this.demoPcComputers.map((c) => (c.id === existingId ? saved : c));
    } else {
      this.demoPcComputers.unshift(saved);
    }
    return { data: saved, source: 'demo_local' };
  }

  async deletePcComputer(id: string): Promise<RepositoryResult<boolean>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: false, error: 'Supabase client unavailable.', source: 'supabase' };
      try {
        const { error } = await supabase.from('pc_lab_computers').delete().eq('id', id);
        if (error) throw error;
        return { data: true, source: 'supabase' };
      } catch (err: any) {
        return { data: false, error: err?.message || 'Failed to delete PC Lab computer.', source: 'supabase' };
      }
    }
    this.demoPcComputers = this.demoPcComputers.filter((c) => c.id !== id);
    this.demoPcMaintenanceRecords = this.demoPcMaintenanceRecords.filter((r) => r.computer_id !== id);
    return { data: true, source: 'demo_local' };
  }

  async getPcMaintenanceRecords(
    institutionId: string = 'inst-mvit',
    labId?: string
  ): Promise<RepositoryResult<PcLabMaintenanceRecord[]>> {
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      const validInstId = this.requireLiveInstitutionId(institutionId);
      if (!validInstId) return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      try {
        let query = supabase
          .from('pc_lab_maintenance_records')
          .select('*')
          .eq('institution_id', validInstId)
          .order('date_reported', { ascending: false });
        if (labId) query = query.eq('lab_id', labId);
        const { data, error } = await query;
        if (error) throw error;
        return { data: (data || []).map((r: any) => this.mapPcMaintenanceRow(r)), source: 'supabase' };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to load PC maintenance records.', source: 'supabase' };
      }
    }
    return {
      data: this.demoPcMaintenanceRecords.filter(
        (r) => r.institution_id === institutionId && (!labId || r.lab_id === labId)
      ),
      source: 'demo_local',
    };
  }

  async reportPcDefect(
    record: Omit<PcLabMaintenanceRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<RepositoryResult<PcLabMaintenanceRecord>> {
    if (!record.reported_issue.trim() || !record.computer_id) {
      return {
        data: null,
        error: 'Computer ID and reported issue summary are required.',
        source: this.isLive ? 'supabase' : 'demo_local',
      };
    }
    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { data: null, error: 'Supabase client unavailable.', source: 'supabase' };
      const validInstId = this.requireLiveInstitutionId(record.institution_id);
      if (!validInstId) return { data: null, error: 'Resolved MVIT institution UUID is required.', source: 'supabase' };
      try {
        const nowIso = new Date().toISOString();
        const { data, error } = await supabase
          .from('pc_lab_maintenance_records')
          .insert({
            institution_id: validInstId,
            lab_id: record.lab_id,
            computer_id: record.computer_id,
            reported_issue: record.reported_issue.trim(),
            defect_description: record.defect_description || '',
            date_reported: record.date_reported || nowIso.slice(0, 10),
            repair_status: record.repair_status || 'defective',
            maintenance_remarks: record.maintenance_remarks || '',
            resolution_date: null,
            reported_by: this.isUuid(record.reported_by) ? record.reported_by : null,
          })
          .select()
          .single();
        if (error) throw error;

        const { error: pcErr } = await supabase
          .from('pc_lab_computers')
          .update({
            status: record.repair_status || 'defective',
            maintenance_status: record.repair_status === 'under_maintenance' ? 'in_repair' : 'awaiting_service',
            last_updated: nowIso,
            updated_at: nowIso,
          })
          .eq('id', record.computer_id);
        if (pcErr) throw pcErr;

        return { data: this.mapPcMaintenanceRow(data), source: 'supabase' };
      } catch (err: any) {
        return { data: null, error: err?.message || 'Failed to report PC defect.', source: 'supabase' };
      }
    }

    const created: PcLabMaintenanceRecord = {
      ...record,
      id: `pcm-${Date.now().toString(36)}`,
      date_reported: record.date_reported || new Date().toISOString().slice(0, 10),
      resolution_date: null,
    };
    this.demoPcMaintenanceRecords.unshift(created);
    this.demoPcComputers = this.demoPcComputers.map((pc) =>
      pc.id === record.computer_id
        ? {
            ...pc,
            status: record.repair_status || 'defective',
            maintenance_status: record.repair_status === 'under_maintenance' ? 'in_repair' : 'awaiting_service',
            last_updated: new Date().toISOString().slice(0, 10),
          }
        : pc
    );
    return { data: created, source: 'demo_local' };
  }

  async updatePcRepairStatus(
    computerId: string,
    repairStatus: PcComputerStatus,
    remarks: string,
    recordId?: string,
    resolutionDate?: string | null,
    updatedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    const effectiveResolution =
      resolutionDate !== undefined
        ? resolutionDate
        : repairStatus === 'repaired' || repairStatus === 'working'
          ? new Date().toISOString().slice(0, 10)
          : null;

    const normalizedComputerStatus: PcComputerStatus =
      repairStatus === 'repaired' ? 'working' : repairStatus;

    const supabase = this.getClient();
    if (this.isLive) {
      if (!supabase) return { success: false, error: 'Supabase client unavailable.' };
      try {
        const nowIso = new Date().toISOString();
        const { error: pcErr } = await supabase
          .from('pc_lab_computers')
          .update({
            status: normalizedComputerStatus,
            maintenance_status:
              normalizedComputerStatus === 'working'
                ? 'operational'
                : normalizedComputerStatus === 'under_maintenance'
                  ? 'in_repair'
                  : 'awaiting_service',
            last_updated: nowIso,
            updated_at: nowIso,
          })
          .eq('id', computerId);
        if (pcErr) throw pcErr;

        if (recordId) {
          const { error: recErr } = await supabase
            .from('pc_lab_maintenance_records')
            .update({
              repair_status: repairStatus,
              maintenance_remarks: remarks,
              resolution_date: effectiveResolution,
              updated_by: this.isUuid(updatedBy) ? updatedBy : null,
              updated_at: nowIso,
            })
            .eq('id', recordId);
          if (recErr) throw recErr;
        }
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to update PC repair status.' };
      }
    }

    this.demoPcComputers = this.demoPcComputers.map((pc) =>
      pc.id === computerId
        ? {
            ...pc,
            status: normalizedComputerStatus,
            maintenance_status:
              normalizedComputerStatus === 'working'
                ? 'operational'
                : normalizedComputerStatus === 'under_maintenance'
                  ? 'in_repair'
                  : 'awaiting_service',
            last_updated: new Date().toISOString().slice(0, 10),
          }
        : pc
    );
    if (recordId) {
      this.demoPcMaintenanceRecords = this.demoPcMaintenanceRecords.map((r) =>
        r.id === recordId
          ? {
              ...r,
              repair_status: repairStatus,
              maintenance_remarks: remarks || r.maintenance_remarks,
              resolution_date: effectiveResolution,
            }
          : r
      );
    }
    return { success: true };
  }
}

export const labverseRepository = new LabverseRepository();
