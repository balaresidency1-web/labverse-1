import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Role,
  Institution,
  Department,
  AcademicTerm,
  Profile,
  PracticalSubject,
  Experiment,
  InventoryItem,
  InventoryTransaction,
  AuditLog,
  NotificationItem,
  LabManualDocument,
  Lab,
  SubjectSyllabus,
  Course,
  LaboratoryCourse,
  ExperimentCourse,
  PcLabComputer,
  PcLabMaintenanceRecord,
  PcComputerStatus,
  PcLabSummaryStats,
} from '../types';
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
  INITIAL_NOTIFICATIONS,
  INITIAL_COURSES,
  INITIAL_LAB_COURSES,
  INITIAL_EXPERIMENT_COURSES,
  INITIAL_PC_COMPUTERS,
  INITIAL_PC_MAINTENANCE_RECORDS,
} from '../data/initialData';
import {
  calculateStockStatus,
  validateInventoryIssue,
  validateInventoryReturn,
  validateInventoryDamage,
  canAssistantAccessLab,
  canViewPcLabComputers,
  canManagePcLabComputers,
  calculatePcLabSummaryStats,
  isPublicVisibleLab,
} from '../utils/labRules';
import { idbGet, idbSet, idbClear, deletePdfBlob } from '../utils/indexedDbStorage';
import { extractIdbKey } from '../utils/pdfSource';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  uploadFileToStorage,
  deleteFileFromStorage,
} from '../services/supabaseClient';
import { labverseRepository } from '../services/labverseRepository';
import { Session } from '@supabase/supabase-js';

const STORAGE_KEY = 'labverse_mvit_platform_v4';

interface PersistedState {
  labs: Lab[];
  departments: Department[];
  courses: Course[];
  laboratoryCourses: LaboratoryCourse[];
  experimentCourses: ExperimentCourse[];
  subjects: PracticalSubject[];
  experiments: Experiment[];
  documents: LabManualDocument[];
  inventory: InventoryItem[];
  transactions: InventoryTransaction[];
  pcComputers: PcLabComputer[];
  pcMaintenanceRecords: PcLabMaintenanceRecord[];
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  allProfiles: Profile[];
  selectedLabId?: string | null;
  demoAuthRole?: Role | null;
  demoAuthUserId?: string | null;
}

interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

interface LabverseContextType {
  institution: Institution;
  isSupabaseActive: boolean;
  session: Session | null;
  authLoading: boolean;
  dataLoadError: string | null;
  isAuthenticated: boolean;
  currentRole: Role | null;
  currentUser: Profile | null;
  isAccountSuspended: boolean;
  isInstitutionInactive: boolean;
  signOut: () => Promise<void>;
  authenticateDemoUser: (role: Role, profileId?: string) => void;

  // Laboratories
  labs: Lab[];
  publicLabs: Lab[];
  activeLabs: Lab[];
  accessibleLabs: Lab[];
  selectedLabId: string | null;
  selectedLab: Lab | null;
  setSelectedLabId: (labId: string | null) => void;
  switchLab: () => void;
  createNewLab: (labData: Omit<Lab, 'id' | 'institution_id' | 'created_at' | 'updated_at'>) => Promise<{ success: boolean; lab?: Lab; error?: string }>;
  updateExistingLab: (labId: string, updates: Partial<Lab>) => Promise<{ success: boolean; lab?: Lab; error?: string }>;
  deactivateExistingLab: (labId: string) => Promise<{ success: boolean; error?: string }>;
  activateExistingLab: (labId: string) => Promise<{ success: boolean; error?: string }>;
  assignAssistantToLab: (labId: string, assistantId: string | null) => Promise<{ success: boolean; error?: string }>;

  // Departments & Term
  departments: Department[];
  currentTerm: AcademicTerm;
  addDepartment: (dept: Omit<Department, 'id' | 'institution_id' | 'active_subjects_count'>) => Promise<ActionResult>;

  // Staff Profiles (College Admin + Lab Assistants)
  allProfiles: Profile[];
  labAssistants: Profile[];
  inviteLabAssistant: (params: {
    name: string;
    email: string;
    identifier: string;
    departmentId?: string;
    assignedLabIds?: string[];
  }) => Promise<{ success: boolean; error?: string; message?: string; source?: string }>;
  resendAssistantInvite: (userId: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  sendAssistantPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updateProfileStatus: (userId: string, status: 'active' | 'suspended' | 'invited') => Promise<{ success: boolean; error?: string }>;
  updateUserLabAssignments: (userId: string, labIds: string[]) => Promise<{ success: boolean; error?: string }>;

  // Practical Subjects & Syllabus
  subjects: PracticalSubject[];
  labSubjects: PracticalSubject[];
  addSubject: (subj: Omit<PracticalSubject, 'id' | 'institution_id' | 'term_id'>) => Promise<ActionResult>;
  updateSubject: (subjectId: string, updates: Partial<PracticalSubject>) => Promise<ActionResult>;
  deleteSubject: (subjectId: string) => Promise<ActionResult>;
  saveSubjectSyllabus: (subjectId: string, units: SubjectSyllabus[]) => Promise<ActionResult>;

  // Experiments & Resources
  experiments: Experiment[];
  labExperiments: Experiment[];
  addExperiment: (exp: Omit<Experiment, 'id' | 'created_at' | 'updated_at'>) => Promise<ActionResult>;
  updateExperiment: (expId: string, updates: Partial<Experiment>) => Promise<ActionResult>;
  deleteExperiment: (expId: string) => Promise<ActionResult>;

  // PDF Documents & Manuals
  documents: LabManualDocument[];
  addOrUpdateDocument: (
    doc: Omit<LabManualDocument, 'id' | 'created_at' | 'updated_at'>,
    rawFile?: File,
    existingId?: string
  ) => Promise<{ success: boolean; doc?: LabManualDocument; error?: string }>;
  deleteDocument: (docId: string) => Promise<ActionResult>;

  // Inventory & QR
  inventory: InventoryItem[];
  labInventory: InventoryItem[];
  transactions: InventoryTransaction[];
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'institution_id' | 'status'>) => Promise<ActionResult>;
  updateInventoryItem: (itemId: string, updates: Partial<InventoryItem>) => Promise<ActionResult>;
  deleteInventoryItem: (itemId: string) => Promise<ActionResult>;
  issueEquipment: (
    itemId: string,
    qty: number,
    borrowerId: string,
    borrowerName: string,
    expTitle: string,
    remarks: string
  ) => Promise<ActionResult>;
  returnEquipment: (itemId: string, qty: number, borrowerName: string, remarks: string) => Promise<ActionResult>;
  logDamageWriteOff: (itemId: string, qty: number, reason: string) => Promise<ActionResult>;
  restockEquipment: (itemId: string, qty: number, supplierRemarks: string) => Promise<ActionResult>;
  mapItemToExperiment: (itemId: string, expId: string) => void;

  // Courses & Course Mappings
  courses: Course[];
  laboratoryCourses: LaboratoryCourse[];
  experimentCourses: ExperimentCourse[];
  addCourse: (course: Omit<Course, 'id' | 'institution_id' | 'created_at' | 'updated_at'>) => Promise<ActionResult>;
  updateCourse: (courseId: string, updates: Partial<Course>) => Promise<ActionResult>;
  setLabCourses: (labId: string, courseIds: string[]) => Promise<ActionResult>;
  setExperimentCourses: (experimentId: string, courseIds: string[]) => Promise<ActionResult>;

  // PC Laboratory (Staff-Only Operational Records)
  pcComputers: PcLabComputer[];
  labPcComputers: PcLabComputer[];
  pcMaintenanceRecords: PcLabMaintenanceRecord[];
  pcLabStats: PcLabSummaryStats;
  addPcComputer: (pc: Omit<PcLabComputer, 'id' | 'institution_id' | 'created_at' | 'updated_at'>) => Promise<ActionResult>;
  updatePcComputer: (pcId: string, updates: Partial<PcLabComputer>) => Promise<ActionResult>;
  deletePcComputer: (pcId: string) => Promise<ActionResult>;
  reportPcDefect: (params: {
    computerId: string;
    reportedIssue: string;
    defectDescription?: string;
    maintenanceRemarks?: string;
    repairStatus?: 'defective' | 'under_maintenance';
  }) => Promise<ActionResult>;
  updatePcRepairStatus: (params: {
    computerId: string;
    repairStatus: PcComputerStatus;
    maintenanceRemarks: string;
    recordId?: string;
    resolutionDate?: string | null;
  }) => Promise<ActionResult>;

  // Audit, Notifications & Utilities
  auditLogs: AuditLog[];
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
  resetToDefaultData: () => void;
  exportToCsv: (type: 'inventory' | 'audit_logs') => void;
}

const LabverseContext = createContext<LabverseContextType | undefined>(undefined);

const deduplicateById = <T extends { id: string }>(items: T[]): T[] => {
  const map = new Map<string, T>();
  for (const item of items) {
    if (item && item.id) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
};

const sanitizeDemoState = (raw?: Partial<PersistedState> | null): PersistedState => {
  const profilesRaw = raw?.allProfiles?.length ? raw.allProfiles : SAMPLE_PROFILES;
  const profiles = deduplicateById(
    profilesRaw.filter((p) => (p.role === 'college_admin' || p.role === 'lab_assistant') && p.institution_id === 'inst-mvit')
  );
  const safeProfiles = profiles.length > 0 ? profiles : SAMPLE_PROFILES;

  const labs = deduplicateById(raw?.labs?.length ? raw.labs : INITIAL_LABS).map((lab) => {
    const primaryAssistant = safeProfiles.find(
      (p) => p.role === 'lab_assistant' && (p.id === lab.assigned_assistant_id || p.assigned_lab_ids?.includes(lab.id))
    );
    return {
      ...lab,
      institution_id: 'inst-mvit',
      assigned_assistant_id: lab.assigned_assistant_id || primaryAssistant?.id || null,
      assigned_assistant_name: lab.assigned_assistant_name || primaryAssistant?.name || null,
    };
  });

  const courses = deduplicateById(raw?.courses?.length ? raw.courses : INITIAL_COURSES);
  const laboratoryCourses = deduplicateById(
    raw?.laboratoryCourses?.length ? raw.laboratoryCourses : INITIAL_LAB_COURSES
  );
  const experimentCourses = deduplicateById(
    raw?.experimentCourses?.length ? raw.experimentCourses : INITIAL_EXPERIMENT_COURSES
  );
  const rawDocuments = deduplicateById(raw?.documents?.length ? raw.documents : INITIAL_DOCUMENTS);
  const documents = rawDocuments.map((doc) => {
    if (doc.file_url?.startsWith('blob:') && doc.storage_path?.startsWith('idb://')) {
      return { ...doc, file_url: doc.storage_path };
    }
    return doc;
  });
  const docById = new Map(documents.map((d) => [d.id, d]));

  const subjects = deduplicateById(raw?.subjects?.length ? raw.subjects : INITIAL_SUBJECTS).map((subj) => {
    if (subj.syllabus_pdf_url?.startsWith('blob:') && subj.syllabus_pdf_id) {
      const linked = docById.get(subj.syllabus_pdf_id);
      if (linked?.file_url) {
        return { ...subj, syllabus_pdf_url: linked.file_url };
      }
    }
    return subj;
  });

  const experiments = deduplicateById(raw?.experiments?.length ? raw.experiments : INITIAL_EXPERIMENTS).map((exp) => {
    if (exp.manual_pdf_url?.startsWith('blob:') && exp.manual_pdf_id) {
      const linked = docById.get(exp.manual_pdf_id);
      if (linked?.file_url) {
        return { ...exp, manual_pdf_url: linked.file_url };
      }
    }
    return exp;
  });
  const inventory = deduplicateById(raw?.inventory?.length ? raw.inventory : INITIAL_INVENTORY);
  const transactions = deduplicateById(raw?.transactions?.length ? raw.transactions : INITIAL_TRANSACTIONS);
  const pcComputers = deduplicateById(raw?.pcComputers?.length ? raw.pcComputers : INITIAL_PC_COMPUTERS);
  const pcMaintenanceRecords = deduplicateById(
    raw?.pcMaintenanceRecords?.length ? raw.pcMaintenanceRecords : INITIAL_PC_MAINTENANCE_RECORDS
  );
  const auditLogs = deduplicateById(raw?.auditLogs?.length ? raw.auditLogs : INITIAL_AUDIT_LOGS);
  const notifications = deduplicateById(raw?.notifications?.length ? raw.notifications : INITIAL_NOTIFICATIONS);
  const departments = deduplicateById(raw?.departments?.length ? raw.departments : INITIAL_DEPARTMENTS);

  return {
    labs,
    departments,
    courses,
    laboratoryCourses,
    experimentCourses,
    subjects,
    experiments,
    documents,
    inventory,
    transactions,
    pcComputers,
    pcMaintenanceRecords,
    auditLogs,
    notifications,
    allProfiles: safeProfiles,
    selectedLabId: raw?.selectedLabId ?? null,
    demoAuthRole: raw?.demoAuthRole ?? null,
    demoAuthUserId: raw?.demoAuthUserId ?? null,
  };
};

export const LabverseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isSupabaseActive = isSupabaseConfigured();

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseActive);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [authenticatedProfile, setAuthenticatedProfile] = useState<Profile | null>(null);
  const [isAccountSuspended, setIsAccountSuspended] = useState<boolean>(false);

  const [institution, setInstitution] = useState<Institution>(MVIT_INSTITUTION);
  const [currentTerm, setCurrentTerm] = useState<AcademicTerm>(INITIAL_TERMS[0]);
  const [state, setState] = useState<PersistedState>(() => sanitizeDemoState(null));
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  // Sync lab assistant names onto labs dynamically
  const syncLabsWithProfiles = useCallback((labsList: Lab[], profilesList: Profile[]): Lab[] => {
    return labsList.map((lab) => {
      const matched =
        profilesList.find((p) => p.role === 'lab_assistant' && p.id === lab.assigned_assistant_id) ||
        profilesList.find((p) => p.role === 'lab_assistant' && p.assigned_lab_ids?.includes(lab.id));
      return {
        ...lab,
        assigned_assistant_id: matched ? matched.id : null,
        assigned_assistant_name: matched ? matched.name : null,
      };
    });
  }, []);

  // Load initial public data + authenticated staff scope from Supabase (zero demo fallback)
  const loadFromSupabase = useCallback(
    async (userId?: string) => {
      setDataLoadError(null);
      try {
        const instRes = await labverseRepository.getInstitutionByCode('MVIT');
        if (instRes.error || !instRes.data?.id) {
          const msg = instRes.error || 'Failed to resolve MVIT institution from Supabase.';
          setDataLoadError(msg);
          setAuthenticatedProfile(null);
          setState((prev) => ({
            ...prev,
            labs: [],
            departments: [],
            courses: [],
            laboratoryCourses: [],
            experimentCourses: [],
            subjects: [],
            experiments: [],
            documents: [],
            inventory: [],
            transactions: [],
            pcComputers: [],
            pcMaintenanceRecords: [],
            allProfiles: [],
            auditLogs: [],
          }));
          return;
        }

        const mvitInst = instRes.data;
        const mvitInstId = mvitInst.id;
        setInstitution(mvitInst);

        const [
          labsRes,
          deptRes,
          coursesRes,
          labCoursesRes,
          expCoursesRes,
          subjRes,
          expRes,
          docRes,
          termRes,
        ] = await Promise.all([
          labverseRepository.getLabs(mvitInstId, !userId ? { publicOnly: true } : undefined),
          labverseRepository.getDepartments(mvitInstId),
          labverseRepository.getCourses(mvitInstId),
          labverseRepository.getLaboratoryCourses(mvitInstId),
          labverseRepository.getExperimentCourses(mvitInstId),
          labverseRepository.getSubjects(mvitInstId),
          labverseRepository.getExperiments(mvitInstId),
          labverseRepository.getDocuments(mvitInstId),
          labverseRepository.getCurrentTerm(mvitInstId),
        ]);

        if (termRes.data) {
          setCurrentTerm(termRes.data);
        }

        const publicErrors = [
          labsRes.error,
          deptRes.error,
          subjRes.error,
          expRes.error,
          docRes.error,
        ].filter(Boolean);

        if (publicErrors.length > 0) {
          setDataLoadError(publicErrors[0] || 'Error loading MVIT laboratory data.');
        }

        let profilesData: Profile[] = [];
        let invData: InventoryItem[] = [];
        let txData: InventoryTransaction[] = [];
        let pcComputersData: PcLabComputer[] = [];
        let pcMaintData: PcLabMaintenanceRecord[] = [];
        let auditData: AuditLog[] = [];

        if (userId) {
          const profRes = await labverseRepository.getProfile(userId);
          const p = profRes.data;

          if (
            !p ||
            p.institution_id !== mvitInstId ||
            (p.role !== 'college_admin' && p.role !== 'lab_assistant')
          ) {
            setAuthenticatedProfile(null);
            setIsAccountSuspended(false);
            setDataLoadError(
              profRes.error ||
                'Access denied: Authenticated user does not hold an authorized MVIT College Admin or Lab Assistant profile.'
            );
            const supabase = getSupabaseClient();
            if (supabase) await supabase.auth.signOut();
          } else {
            setAuthenticatedProfile(p);
            const suspended = p.status === 'suspended';
            setIsAccountSuspended(suspended);

            if (!suspended) {
              const rawLabsList = labsRes.data || [];
              const hasAssignedPcLab =
                p.role === 'lab_assistant' &&
                rawLabsList.some(
                  (l) =>
                    l.lab_type === 'pc_lab' &&
                    l.status === 'active' &&
                    (Boolean(p.assigned_lab_ids?.includes(l.id)) || l.assigned_assistant_id === p.id)
                );

              const [profilesListRes, invRes, txRes, pcRes, pcMaintRes, auditRes] = await Promise.all([
                labverseRepository.getProfiles(mvitInstId),
                labverseRepository.getInventory(mvitInstId),
                labverseRepository.getInventoryTransactions(mvitInstId),
                hasAssignedPcLab
                  ? labverseRepository.getPcComputers(mvitInstId)
                  : Promise.resolve({ data: [] as PcLabComputer[], source: 'supabase' as const }),
                hasAssignedPcLab
                  ? labverseRepository.getPcMaintenanceRecords(mvitInstId)
                  : Promise.resolve({ data: [] as PcLabMaintenanceRecord[], source: 'supabase' as const }),
                p.role === 'college_admin'
                  ? labverseRepository.getAuditLogs(mvitInstId)
                  : Promise.resolve({ data: [] as AuditLog[], source: 'supabase' as const }),
              ]);

              if (profilesListRes.data) profilesData = profilesListRes.data;
              if (invRes.data) invData = invRes.data;
              if (txRes.data) txData = txRes.data;
              if (hasAssignedPcLab && pcRes.data) pcComputersData = pcRes.data;
              if (hasAssignedPcLab && pcMaintRes.data) pcMaintData = pcMaintRes.data;
              if (auditRes.data) auditData = auditRes.data;
            }
          }
        } else {
          setAuthenticatedProfile(null);
          setIsAccountSuspended(false);
        }

        const rawLabs = labsRes.data || [];
        const enrichedLabs = syncLabsWithProfiles(rawLabs, profilesData);

        setState((prev) => ({
          ...prev,
          labs: enrichedLabs,
          departments: deptRes.data || [],
          courses: coursesRes.data || [],
          laboratoryCourses: labCoursesRes.data || [],
          experimentCourses: expCoursesRes.data || [],
          subjects: subjRes.data || [],
          experiments: expRes.data || [],
          documents: docRes.data || [],
          inventory: invData,
          transactions: txData,
          pcComputers: pcComputersData,
          pcMaintenanceRecords: pcMaintData,
          allProfiles: profilesData,
          auditLogs: auditData,
        }));
      } catch (err: any) {
        setDataLoadError(err?.message || 'Unexpected error communicating with Supabase.');
      }
    },
    [syncLabsWithProfiles]
  );

  // Hydrate Demo Local Mode or Live Supabase Session on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (isSupabaseActive) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (!mounted) return;
          const activeSession = data?.session || null;
          setSession(activeSession);
          await loadFromSupabase(activeSession?.user?.id);
          if (mounted) setAuthLoading(false);

          const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
            if (!mounted) return;
            setSession(nextSession);
            if (nextSession?.user) {
              await loadFromSupabase(nextSession.user.id);
            } else {
              setAuthenticatedProfile(null);
              setIsAccountSuspended(false);
              await loadFromSupabase();
            }
          });

          return () => {
            listener?.subscription?.unsubscribe();
          };
        }
      } else {
        // Demo Local Mode hydration
        let loaded: PersistedState | null = null;
        try {
          const idb = await idbGet<PersistedState>(STORAGE_KEY);
          if (idb) loaded = idb;
        } catch {
          // ignore
        }
        if (!loaded) {
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) loaded = JSON.parse(raw);
          } catch {
            // ignore
          }
        }
        if (mounted) {
          setState(sanitizeDemoState(loaded));
          setIsHydrated(true);
          setAuthLoading(false);
        }
      }
      return undefined;
    };

    init();
    return () => {
      mounted = false;
    };
  }, [isSupabaseActive, loadFromSupabase]);

  // Persist Demo Local Mode changes
  useEffect(() => {
    if (!isSupabaseActive && isHydrated) {
      const savePayload = {
        ...state,
        allProfiles: state.allProfiles,
      };
      idbSet(STORAGE_KEY, savePayload).catch(() => {});
      try {
        // Strip huge base64 strings only if localStorage quota exceeded
        localStorage.setItem(STORAGE_KEY, JSON.stringify(savePayload));
      } catch {
        // ignore quota errors; IndexedDB retains full blobs
      }
    }
  }, [state, isHydrated, isSupabaseActive]);

  // Derived authentication & user profile
  const isAuthenticated = isSupabaseActive
    ? Boolean(session?.user && authenticatedProfile && !isAccountSuspended && institution.active)
    : Boolean(state.demoAuthRole && state.demoAuthUserId);

  const currentUser: Profile | null = useMemo(() => {
    if (!isAuthenticated) return null;
    if (isSupabaseActive) return authenticatedProfile;
    const matched =
      state.allProfiles.find((p) => p.id === state.demoAuthUserId) ||
      state.allProfiles.find((p) => p.role === state.demoAuthRole);
    return matched || null;
  }, [isAuthenticated, isSupabaseActive, authenticatedProfile, state.allProfiles, state.demoAuthUserId, state.demoAuthRole]);

  const currentRole: Role | null = currentUser?.role || null;
  const isInstitutionInactive = institution.active === false || institution.status === 'inactive';

  // Sync lab assistant assignment metadata automatically
  const labs = useMemo(
    () => syncLabsWithProfiles(state.labs, state.allProfiles),
    [state.labs, state.allProfiles, syncLabsWithProfiles]
  );

  const publicLabs = useMemo(
    () =>
      labs
        .filter((l) => isPublicVisibleLab(l))
        .sort((a, b) => a.display_order - b.display_order),
    [labs]
  );

  // Public-safe active laboratories (strictly excludes PC Lab / non-public labs)
  const activeLabs = publicLabs;

  const accessibleLabs = useMemo(() => {
    if (!currentUser) return publicLabs;
    if (currentUser.role === 'college_admin') return labs;
    // Lab Assistant: scoped to active labs assigned to them (including assigned internal PC Lab)
    return labs
      .filter(
        (l) =>
          l.status === 'active' &&
          (l.assigned_assistant_id === currentUser.id ||
            Boolean(currentUser.assigned_lab_ids?.includes(l.id)))
      )
      .sort((a, b) => a.display_order - b.display_order);
  }, [currentUser, labs, publicLabs]);

  // Effective selectedLabId for Lab Assistant (auto-select if 1 assigned lab; clear if unassigned)
  const selectedLabId = useMemo(() => {
    if (currentRole === 'lab_assistant') {
      if (state.selectedLabId && accessibleLabs.some((l) => l.id === state.selectedLabId)) {
        return state.selectedLabId;
      }
      if (accessibleLabs.length === 1) {
        return accessibleLabs[0].id;
      }
      return state.selectedLabId && accessibleLabs.some((l) => l.id === state.selectedLabId)
        ? state.selectedLabId
        : accessibleLabs[0]?.id || null;
    }
    if (state.selectedLabId && labs.some((l) => l.id === state.selectedLabId)) {
      return state.selectedLabId;
    }
    return null;
  }, [currentRole, state.selectedLabId, accessibleLabs, labs]);

  const selectedLab = useMemo(
    () => labs.find((l) => l.id === selectedLabId) || null,
    [labs, selectedLabId]
  );

  const setSelectedLabId = (labId: string | null) => {
    setState((prev) => ({ ...prev, selectedLabId: labId }));
  };

  const switchLab = () => {
    setState((prev) => ({ ...prev, selectedLabId: null }));
  };

  const authenticateDemoUser = (role: Role, profileId?: string) => {
    const matched =
      (profileId && state.allProfiles.find((p) => p.id === profileId)) ||
      state.allProfiles.find((p) => p.role === role && p.status !== 'suspended') ||
      state.allProfiles.find((p) => p.role === role);

    if (!matched) return;

    setState((prev) => ({
      ...prev,
      demoAuthRole: role,
      demoAuthUserId: matched.id,
      selectedLabId:
        role === 'lab_assistant' && matched.assigned_lab_ids?.length === 1
          ? matched.assigned_lab_ids[0]
          : null,
    }));
  };

  const signOut = async () => {
    if (isSupabaseActive) {
      const supabase = getSupabaseClient();
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setAuthenticatedProfile(null);
      setIsAccountSuspended(false);
    }
    setState((prev) => ({
      ...prev,
      demoAuthRole: null,
      demoAuthUserId: null,
      selectedLabId: null,
    }));
  };

  const ensureResolvedInstitutionId = useCallback((): string | null => {
    if (!institution.id || (isSupabaseActive && institution.id === 'inst-mvit')) {
      return null;
    }
    return institution.id;
  }, [institution.id, isSupabaseActive]);

  const appendAuditLog = useCallback(
    (action: string, resourceType: string, resourceId: string | undefined, details: string) => {
      if (!currentUser) return;
      const targetInstId = institution.id;
      const entry: AuditLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        institution_id: targetInstId,
        user_name: currentUser.name,
        user_role: currentUser.role,
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        timestamp: new Date().toISOString(),
        details,
      };
      setState((prev) => ({ ...prev, auditLogs: [entry, ...prev.auditLogs] }));
      labverseRepository.recordAuditLog(entry);
    },
    [currentUser, institution.id]
  );

  // ============================================================================
  // COLLEGE ADMIN: LABORATORY CRUD & LAB ASSISTANT ASSIGNMENTS
  // ============================================================================

  const createNewLab = async (
    labData: Omit<Lab, 'id' | 'institution_id' | 'created_at' | 'updated_at'>
  ): Promise<{ success: boolean; lab?: Lab; error?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can create laboratories.' };
    }
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const cleanCode = (labData.lab_code || '').trim().toUpperCase();
    if (!cleanCode || !labData.name.trim()) {
      return { success: false, error: 'Laboratory name and code are required.' };
    }
    if (state.labs.some((l) => l.lab_code.toUpperCase() === cleanCode)) {
      return { success: false, error: `Laboratory code "${cleanCode}" already exists at MVIT.` };
    }

    const assistantProfile = labData.assigned_assistant_id
      ? state.allProfiles.find((p) => p.id === labData.assigned_assistant_id && p.role === 'lab_assistant')
      : undefined;

    const deptObj = state.departments.find((d) => d.id === labData.department_id);

    const res = await labverseRepository.createLab({
      ...labData,
      institution_id: targetInstId,
      department_name: labData.department_name || deptObj?.name || 'Engineering & Applied Sciences',
      lab_code: cleanCode,
      is_public: labData.lab_type === 'pc_lab' ? false : (labData.is_public ?? true),
      assigned_assistant_id: assistantProfile?.id || null,
      assigned_assistant_name: assistantProfile?.name || null,
      created_by: currentUser?.id,
    });

    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to create laboratory.' };
    }

    const createdLab = res.data;
    setState((prev) => {
      const nextProfiles = assistantProfile
        ? prev.allProfiles.map((p) =>
            p.id === assistantProfile.id
              ? {
                  ...p,
                  assigned_lab_ids: Array.from(new Set([...(p.assigned_lab_ids || []), createdLab.id])),
                }
              : p
          )
        : prev.allProfiles;

      return {
        ...prev,
        labs: deduplicateById([...prev.labs, createdLab]),
        allProfiles: nextProfiles,
      };
    });

    appendAuditLog('CREATE_LABORATORY', 'laboratory', createdLab.id, `Registered ${createdLab.name} (${createdLab.lab_code}).`);
    return { success: true, lab: createdLab };
  };

  const updateExistingLab = async (
    labId: string,
    updates: Partial<Lab>
  ): Promise<{ success: boolean; lab?: Lab; error?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can edit laboratories.' };
    }
    if (updates.lab_code) {
      const cleanCode = updates.lab_code.trim().toUpperCase();
      const dup = state.labs.some((l) => l.id !== labId && l.lab_code.toUpperCase() === cleanCode);
      if (dup) {
        return { success: false, error: `Laboratory code "${cleanCode}" already exists at MVIT.` };
      }
      updates.lab_code = cleanCode;
    }

    const res = await labverseRepository.updateLab(labId, updates);
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to update laboratory.' };
    }

    const updated = res.data;
    setState((prev) => ({
      ...prev,
      labs: prev.labs.map((l) => (l.id === labId ? { ...l, ...updated } : l)),
    }));
    appendAuditLog('UPDATE_LABORATORY', 'laboratory', labId, `Updated laboratory ${updated.name} (${updated.lab_code}).`);
    return { success: true, lab: updated };
  };

  const deactivateExistingLab = async (labId: string): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can deactivate laboratories.' };
    }
    const res = await labverseRepository.deactivateLab(labId);
    if (res.error) return { success: false, error: res.error };

    setState((prev) => ({
      ...prev,
      labs: prev.labs.map((l) =>
        l.id === labId ? { ...l, status: 'inactive', updated_at: new Date().toISOString() } : l
      ),
    }));
    appendAuditLog('DEACTIVATE_LABORATORY', 'laboratory', labId, `Deactivated laboratory ${labId}.`);
    return { success: true };
  };

  const activateExistingLab = async (labId: string): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can activate laboratories.' };
    }
    const res = await labverseRepository.activateLab(labId);
    if (res.error) return { success: false, error: res.error };

    setState((prev) => ({
      ...prev,
      labs: prev.labs.map((l) =>
        l.id === labId ? { ...l, status: 'active', updated_at: new Date().toISOString() } : l
      ),
    }));
    appendAuditLog('ACTIVATE_LABORATORY', 'laboratory', labId, `Activated laboratory ${labId}.`);
    return { success: true };
  };

  const assignAssistantToLab = async (
    labId: string,
    assistantId: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can assign Lab Assistants.' };
    }

    const assistantProfile = assistantId
      ? state.allProfiles.find((p) => p.id === assistantId && p.role === 'lab_assistant')
      : null;

    if (assistantId && !assistantProfile) {
      return { success: false, error: 'Selected user is not an active MVIT Lab Assistant.' };
    }

    if (assistantProfile && isSupabaseActive && assistantProfile.status !== 'active') {
      return { success: false, error: 'Only active MVIT Lab Assistants may be assigned to laboratories.' };
    }

    const res = await labverseRepository.assignLabAssistantAtomic(labId, assistantProfile?.id || null);
    if (!res.success) {
      return { success: false, error: res.error || 'Failed to update laboratory assignment.' };
    }

    const updatedProfiles = state.allProfiles.map((p) => {
      if (p.role !== 'lab_assistant') return p;
      const existingIds = (p.assigned_lab_ids || []).filter((id) => id !== labId);
      if (assistantProfile && p.id === assistantProfile.id) {
        return { ...p, assigned_lab_ids: Array.from(new Set([...existingIds, labId])) };
      }
      return { ...p, assigned_lab_ids: existingIds };
    });

    setState((prev) => ({
      ...prev,
      allProfiles: updatedProfiles,
      labs: prev.labs.map((l) =>
        l.id === labId
          ? {
              ...l,
              assigned_assistant_id: assistantProfile?.id || null,
              assigned_assistant_name: assistantProfile?.name || null,
              updated_at: new Date().toISOString(),
            }
          : l
      ),
    }));

    const labName = state.labs.find((l) => l.id === labId)?.name || labId;
    appendAuditLog(
      'ASSIGN_LAB_ASSISTANT',
      'laboratory',
      labId,
      assistantProfile
        ? `Assigned ${assistantProfile.name} (${assistantProfile.identifier}) to ${labName}.`
        : `Cleared Lab Assistant assignment for ${labName}.`
    );
    return { success: true };
  };

  // ============================================================================
  // COLLEGE ADMIN: LAB ASSISTANT ACCOUNT MANAGEMENT
  // ============================================================================

  const labAssistants = useMemo(
    () => state.allProfiles.filter((p) => p.role === 'lab_assistant'),
    [state.allProfiles]
  );

  const inviteLabAssistant = async (params: {
    name: string;
    email: string;
    identifier: string;
    departmentId?: string;
    assignedLabIds?: string[];
  }): Promise<{ success: boolean; error?: string; message?: string; source?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can invite Lab Assistants.' };
    }

    const cleanEmail = params.email.trim().toLowerCase();
    if (!cleanEmail || !params.name.trim() || !params.identifier.trim()) {
      return { success: false, error: 'Name, email, and employee ID are required.' };
    }

    if (state.allProfiles.some((p) => p.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: `An MVIT staff account with email "${cleanEmail}" already exists.` };
    }

    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isSupabaseActive && session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: cleanEmail,
          role: 'lab_assistant',
          institutionId: targetInstId,
          name: params.name.trim(),
          identifier: params.identifier.trim().toUpperCase(),
          departmentId: params.departmentId || undefined,
          assignedLabIds: params.assignedLabIds || [],
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to invite Lab Assistant.' };
      }

      const dept = state.departments.find((d) => d.id === params.departmentId);
      const newProfile: Profile = {
        id: json.userId || `user-mvit-lab-${Date.now().toString(36)}`,
        institution_id: json.institutionId || targetInstId,
        role: 'lab_assistant',
        name: params.name.trim(),
        email: cleanEmail,
        identifier: params.identifier.trim().toUpperCase(),
        department_id: params.departmentId,
        department_name: dept?.name || 'Laboratory Operations',
        status: isSupabaseActive ? 'invited' : 'active',
        invited_at: json.invitedAt || new Date().toISOString(),
        assigned_lab_ids: params.assignedLabIds || [],
        created_at: new Date().toISOString(),
      };

      setState((prev) => ({
        ...prev,
        allProfiles: [...prev.allProfiles, newProfile],
        labs: prev.labs.map((l) =>
          params.assignedLabIds?.includes(l.id) && !l.assigned_assistant_id
            ? { ...l, assigned_assistant_id: newProfile.id, assigned_assistant_name: newProfile.name }
            : l
        ),
      }));

      appendAuditLog(
        'INVITE_LAB_ASSISTANT',
        'profile',
        newProfile.id,
        `Invited Lab Assistant ${newProfile.name} (${newProfile.email}).`
      );
      return { success: true, message: json.message, source: json.source };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error dispatching Lab Assistant invitation.' };
    }
  };

  const resendAssistantInvite = async (
    userId: string
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can resend invitations.' };
    }
    const target = state.allProfiles.find((p) => p.id === userId && p.role === 'lab_assistant');
    if (!target) return { success: false, error: 'Lab Assistant account not found.' };

    if (isSupabaseActive) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(target.email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) return { success: false, error: error.message };
      }
    }

    setState((prev) => ({
      ...prev,
      allProfiles: prev.allProfiles.map((p) =>
        p.id === userId ? { ...p, invited_at: new Date().toISOString() } : p
      ),
    }));
    appendAuditLog('RESEND_ASSISTANT_INVITE', 'profile', userId, `Resent access link to ${target.email}.`);
    return {
      success: true,
      message: isSupabaseActive
        ? `Access link email sent to ${target.email}`
        : `Demo access link refreshed for ${target.email}`,
    };
  };

  const sendAssistantPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (isSupabaseActive) {
      const supabase = getSupabaseClient();
      if (!supabase) return { success: false, error: 'Supabase not configured.' };
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) return { success: false, error: error.message };
    }
    appendAuditLog('PASSWORD_RESET_DISPATCHED', 'profile', undefined, `Dispatched password reset to ${email}.`);
    return { success: true };
  };

  const updateProfileStatus = async (
    userId: string,
    status: 'active' | 'suspended' | 'invited'
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can update staff account status.' };
    }
    const res = await labverseRepository.updateProfileStatus(userId, status);
    if (!res.success) return res;

    setState((prev) => ({
      ...prev,
      allProfiles: prev.allProfiles.map((p) => (p.id === userId ? { ...p, status } : p)),
    }));
    appendAuditLog('UPDATE_ASSISTANT_STATUS', 'profile', userId, `Changed Lab Assistant status to ${status}.`);
    return { success: true };
  };

  const updateUserLabAssignments = async (
    userId: string,
    labIds: string[]
  ): Promise<{ success: boolean; error?: string }> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can assign laboratories.' };
    }
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }

    const res = await labverseRepository.updateUserLabAssignments(userId, targetInstId, labIds);
    if (!res.success) return res;

    const assistant = state.allProfiles.find((p) => p.id === userId);
    setState((prev) => ({
      ...prev,
      allProfiles: prev.allProfiles.map((p) => (p.id === userId ? { ...p, assigned_lab_ids: labIds } : p)),
      labs: prev.labs.map((l) => {
        if (labIds.includes(l.id) && !l.assigned_assistant_id) {
          return {
            ...l,
            assigned_assistant_id: userId,
            assigned_assistant_name: assistant?.name || l.assigned_assistant_name || null,
          };
        }
        if (l.assigned_assistant_id === userId && !labIds.includes(l.id)) {
          return { ...l, assigned_assistant_id: null, assigned_assistant_name: null };
        }
        return l;
      }),
    }));
    appendAuditLog('UPDATE_LAB_ASSIGNMENTS', 'profile', userId, `Updated assigned labs (${labIds.length} labs).`);
    return { success: true };
  };

  // ============================================================================
  // DEPARTMENTS
  // ============================================================================

  const addDepartment = async (
    dept: Omit<Department, 'id' | 'institution_id' | 'active_subjects_count'>
  ): Promise<ActionResult> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can add academic departments.' };
    }
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }

    const res = await labverseRepository.saveDepartment({
      ...dept,
      institution_id: targetInstId,
    });
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to add department.' };
    }

    const newDept = res.data;
    setState((prev) => ({ ...prev, departments: deduplicateById([...prev.departments, newDept]) }));
    appendAuditLog('ADD_DEPARTMENT', 'department', newDept.id, `Added MVIT department ${newDept.name} (${newDept.code}).`);
    return { success: true, id: newDept.id };
  };

  // ============================================================================
  // LAB ASSISTANT: SUBJECTS, SYLLABUS, EXPERIMENTS & DOCUMENTS
  // ============================================================================

  const labSubjects = useMemo(() => {
    const targetLabId = selectedLabId;
    if (!targetLabId) return state.subjects;
    return state.subjects.filter((s) => !s.lab_id || s.lab_id === targetLabId);
  }, [state.subjects, selectedLabId]);

  const labExperiments = useMemo(() => {
    const subjectIds = new Set(labSubjects.map((s) => s.id));
    return state.experiments.filter((e) => subjectIds.has(e.subject_id));
  }, [state.experiments, labSubjects]);

  const labInventory = useMemo(() => {
    const targetLabId = selectedLabId;
    if (!targetLabId) return state.inventory;
    return state.inventory.filter((i) => !i.lab_id || i.lab_id === targetLabId);
  }, [state.inventory, selectedLabId]);

  const ensureLabWriteAccess = (labId?: string | null): string | null => {
    if (!currentUser) return 'Authentication required.';
    if (currentUser.role === 'college_admin') return null;
    if (!labId || !canAssistantAccessLab(currentUser, labId)) {
      return 'Access Denied: You can only modify resources inside your assigned MVIT laboratories.';
    }
    return null;
  };

  const ensurePcLabAssistantWriteAccess = (labId?: string | null): string | null => {
    if (!currentUser) return 'Authentication required.';
    if (currentUser.role === 'college_admin') {
      return 'Read-Only Access: MVIT College Admin monitors PC Lab status and assigns the PC Lab Assistant, who holds exclusive permission to edit workstations and maintenance records.';
    }
    const targetLab = state.labs.find((l) => l.id === labId) || null;
    if (!canManagePcLabComputers(currentUser, targetLab)) {
      return 'Access Denied: Only the assigned active PC Lab Assistant may modify computers or maintenance logs in this PC Laboratory.';
    }
    return null;
  };

  const addSubject = async (
    subj: Omit<PracticalSubject, 'id' | 'institution_id' | 'term_id'>
  ): Promise<ActionResult> => {
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const targetLabId = subj.lab_id || selectedLabId;
    const accessErr = ensureLabWriteAccess(targetLabId);
    if (accessErr) return { success: false, error: accessErr };

    const cleanCode = subj.code.trim().toUpperCase();
    if (!cleanCode || !subj.name.trim()) {
      return { success: false, error: 'Subject code and name are required.' };
    }

    const payload: Omit<PracticalSubject, 'id'> = {
      ...subj,
      code: cleanCode,
      institution_id: targetInstId,
      term_id: currentTerm.id,
      lab_id: targetLabId || undefined,
      is_active: subj.is_active ?? true,
      lab_assistant_id: currentUser?.id,
      lab_assistant_name: currentUser?.name,
    };

    const res = await labverseRepository.saveSubject(payload);
    if (res.error || !res.data) return { success: false, error: res.error || 'Failed to add subject.' };

    const created = res.data;
    setState((prev) => ({ ...prev, subjects: deduplicateById([...prev.subjects, created]) }));
    appendAuditLog('CREATE_SUBJECT', 'practical_subject', created.id, `Created subject ${created.code} — ${created.name}.`);
    return { success: true, id: created.id };
  };

  const updateSubject = async (subjectId: string, updates: Partial<PracticalSubject>): Promise<ActionResult> => {
    const existing = state.subjects.find((s) => s.id === subjectId);
    if (!existing) return { success: false, error: 'Subject not found.' };
    const accessErr = ensureLabWriteAccess(existing.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const merged = {
      ...existing,
      ...updates,
      institution_id: existing.institution_id || institution.id,
    };
    const res = await labverseRepository.saveSubject(merged, subjectId);
    if (res.error) return { success: false, error: res.error };

    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.map((s) => (s.id === subjectId ? merged : s)),
    }));
    appendAuditLog('UPDATE_SUBJECT', 'practical_subject', subjectId, `Updated practical subject ${merged.code}.`);
    return { success: true, id: subjectId };
  };

  const deleteSubject = async (subjectId: string): Promise<ActionResult> => {
    const existing = state.subjects.find((s) => s.id === subjectId);
    if (!existing) return { success: false, error: 'Subject not found.' };
    const accessErr = ensureLabWriteAccess(existing.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const linkedExperiments = state.experiments.filter((e) => e.subject_id === subjectId);
    if (linkedExperiments.length > 0) {
      return {
        success: false,
        error: `Cannot delete ${existing.code} because ${linkedExperiments.length} experiment(s) are linked to it. Archive/deactivate it instead or remove experiments first.`,
      };
    }

    const res = await labverseRepository.deleteSubject(subjectId);
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to delete practical subject.' };
    }

    setState((prev) => ({
      ...prev,
      subjects: prev.subjects.filter((s) => s.id !== subjectId),
    }));
    appendAuditLog('DELETE_SUBJECT', 'practical_subject', subjectId, `Deleted practical subject ${existing.code}.`);
    return { success: true };
  };

  const saveSubjectSyllabus = async (subjectId: string, units: SubjectSyllabus[]): Promise<ActionResult> => {
    return updateSubject(subjectId, { syllabus: units });
  };

  const addExperiment = async (
    exp: Omit<Experiment, 'id' | 'created_at' | 'updated_at'>
  ): Promise<ActionResult> => {
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const subj = state.subjects.find((s) => s.id === exp.subject_id);
    const targetLabId = exp.lab_id || subj?.lab_id || selectedLabId;
    const accessErr = ensureLabWriteAccess(targetLabId);
    if (accessErr) return { success: false, error: accessErr };

    const res = await labverseRepository.saveExperiment({
      ...exp,
      institution_id: targetInstId,
      lab_id: targetLabId || undefined,
      created_by: currentUser?.id || exp.created_by,
    });
    if (res.error || !res.data) return { success: false, error: res.error || 'Failed to create experiment.' };

    const created = res.data;
    setState((prev) => ({ ...prev, experiments: deduplicateById([...prev.experiments, created]) }));
    appendAuditLog('CREATE_EXPERIMENT', 'experiment', created.id, `Created experiment "${created.title}".`);
    return { success: true, id: created.id };
  };

  const updateExperiment = async (expId: string, updates: Partial<Experiment>): Promise<ActionResult> => {
    const existing = state.experiments.find((e) => e.id === expId);
    if (!existing) return { success: false, error: 'Experiment not found.' };
    const subj = state.subjects.find((s) => s.id === (updates.subject_id || existing.subject_id));
    const accessErr = ensureLabWriteAccess(existing.lab_id || subj?.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const merged: Experiment = {
      ...existing,
      ...updates,
      institution_id: existing.institution_id || institution.id,
      updated_at: new Date().toISOString(),
    };
    const res = await labverseRepository.saveExperiment(merged, expId);
    if (res.error) return { success: false, error: res.error };

    setState((prev) => ({
      ...prev,
      experiments: prev.experiments.map((e) => (e.id === expId ? merged : e)),
    }));
    appendAuditLog('UPDATE_EXPERIMENT', 'experiment', expId, `Updated experiment "${merged.title}".`);
    return { success: true, id: expId };
  };

  const deleteExperiment = async (expId: string): Promise<ActionResult> => {
    const existing = state.experiments.find((e) => e.id === expId);
    if (!existing) return { success: false, error: 'Experiment not found.' };
    const subj = state.subjects.find((s) => s.id === existing.subject_id);
    const accessErr = ensureLabWriteAccess(existing.lab_id || subj?.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const res = await labverseRepository.deleteExperiment(expId);
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to delete experiment.' };
    }

    setState((prev) => ({
      ...prev,
      experiments: prev.experiments.filter((e) => e.id !== expId),
    }));
    appendAuditLog('DELETE_EXPERIMENT', 'experiment', expId, `Removed experiment "${existing.title}".`);
    return { success: true };
  };

  const addOrUpdateDocument = async (
    doc: Omit<LabManualDocument, 'id' | 'created_at' | 'updated_at'>,
    rawFile?: File,
    existingId?: string
  ): Promise<{ success: boolean; doc?: LabManualDocument; error?: string }> => {
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const linkedSubject = doc.subject_id
      ? state.subjects.find((s) => s.id === doc.subject_id)
      : undefined;
    const targetLabId = doc.lab_id || linkedSubject?.lab_id || selectedLabId;
    const accessErr = ensureLabWriteAccess(targetLabId);
    if (accessErr) return { success: false, error: accessErr };

    if (!targetLabId) {
      return {
        success: false,
        error: 'A target laboratory (lab_id) is required to store or update manual documents.',
      };
    }

    let fileUrl = doc.file_url;
    let storagePath = doc.storage_path;

    if (rawFile && isSupabaseActive) {
      const safeName = rawFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uploadPath = `mvit/${targetLabId}/${doc.type}/${Date.now()}_${safeName}`;
      const uploadRes = await uploadFileToStorage('manuals', uploadPath, rawFile, {
        isPublic: doc.is_published,
      });
      if (uploadRes.error || !uploadRes.url) {
        return { success: false, error: uploadRes.error || 'PDF upload to Supabase Storage failed.' };
      }
      fileUrl = uploadRes.url;
      storagePath = uploadRes.path;
    }

    const res = await labverseRepository.saveDocument(
      {
        ...doc,
        institution_id: targetInstId,
        lab_id: targetLabId,
        file_url: fileUrl,
        storage_path: storagePath,
        uploaded_by_id: currentUser?.id || doc.uploaded_by_id,
        uploaded_by_name: currentUser?.name || doc.uploaded_by_name,
      },
      existingId
    );

    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to save PDF document record.' };
    }

    const savedDoc = res.data;
    setState((prev) => {
      const nextDocs = existingId
        ? prev.documents.map((d) => (d.id === existingId ? savedDoc : d))
        : [savedDoc, ...prev.documents];

      const nextExperiments = savedDoc.experiment_id
        ? prev.experiments.map((e) =>
            e.id === savedDoc.experiment_id
              ? {
                  ...e,
                  manual_pdf_id: savedDoc.id,
                  manual_pdf_url: savedDoc.file_url,
                  manual_pdf_name: savedDoc.file_name,
                  manual_doc_name: savedDoc.file_name,
                }
              : e
          )
        : prev.experiments;

      const nextSubjects =
        savedDoc.type === 'syllabus' && savedDoc.subject_id
          ? prev.subjects.map((s) =>
              s.id === savedDoc.subject_id
                ? {
                    ...s,
                    syllabus_pdf_id: savedDoc.id,
                    syllabus_pdf_url: savedDoc.file_url,
                    syllabus_pdf_name: savedDoc.file_name,
                  }
                : s
            )
          : prev.subjects;

      return {
        ...prev,
        documents: deduplicateById(nextDocs),
        experiments: nextExperiments,
        subjects: nextSubjects,
      };
    });

    appendAuditLog(
      existingId ? 'UPDATE_DOCUMENT' : 'UPLOAD_DOCUMENT',
      'lab_manual_document',
      savedDoc.id,
      `${existingId ? 'Updated' : 'Uploaded'} ${savedDoc.type} PDF "${savedDoc.file_name}".`
    );
    return { success: true, doc: savedDoc };
  };

  const deleteDocument = async (docId: string): Promise<ActionResult> => {
    const existing = state.documents.find((d) => d.id === docId);
    if (!existing) return { success: false, error: 'Document not found.' };
    const linkedSubject = existing.subject_id
      ? state.subjects.find((s) => s.id === existing.subject_id)
      : undefined;
    const accessErr = ensureLabWriteAccess(existing.lab_id || linkedSubject?.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    if (isSupabaseActive) {
      const targetStoragePath =
        existing.storage_path ||
        (existing.file_url?.includes('/manuals/')
          ? decodeURIComponent(existing.file_url.split('/manuals/')[1]?.split('?')[0] || '')
          : '');
      if (targetStoragePath) {
        const storageDel = await deleteFileFromStorage('manuals', targetStoragePath);
        if (storageDel.error) {
          return {
            success: false,
            error: `Storage cleanup denied: ${storageDel.error}`,
          };
        }
      }
    } else {
      const idbKey =
        extractIdbKey(existing.storage_path) ||
        extractIdbKey(existing.file_url) ||
        existing.id;
      if (idbKey) {
        try {
          await deletePdfBlob(idbKey);
        } catch {
          // Ignore IDB cleanup error when key does not exist
        }
      }
    }

    const res = await labverseRepository.deleteDocument(docId);
    if (res.error) return { success: false, error: res.error };

    setState((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== docId),
      experiments: prev.experiments.map((e) =>
        e.manual_pdf_id === docId
          ? { ...e, manual_pdf_id: undefined, manual_pdf_url: undefined, manual_pdf_name: undefined }
          : e
      ),
      subjects: prev.subjects.map((s) =>
        s.syllabus_pdf_id === docId
          ? { ...s, syllabus_pdf_id: undefined, syllabus_pdf_url: undefined, syllabus_pdf_name: undefined }
          : s
      ),
    }));
    appendAuditLog('DELETE_DOCUMENT', 'lab_manual_document', docId, `Deleted document "${existing.file_name}".`);
    return { success: true };
  };

  // ============================================================================
  // INVENTORY & QR WORKFLOWS
  // ============================================================================

  const addInventoryItem = async (
    item: Omit<InventoryItem, 'id' | 'institution_id' | 'status'>
  ): Promise<ActionResult> => {
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const targetLabId = item.lab_id || selectedLabId;
    const accessErr = ensureLabWriteAccess(targetLabId);
    if (accessErr) return { success: false, error: accessErr };

    const cleanCode = item.item_code.trim().toUpperCase();
    if (!cleanCode || !item.name.trim()) {
      return { success: false, error: 'Item code and name are required.' };
    }
    if (state.inventory.some((i) => i.item_code.toUpperCase() === cleanCode)) {
      return { success: false, error: `Inventory item code "${cleanCode}" already exists.` };
    }

    const res = await labverseRepository.saveInventoryItem({
      ...item,
      institution_id: targetInstId,
      lab_id: targetLabId || undefined,
      item_code: cleanCode,
      last_inspected: item.last_inspected || new Date().toISOString().slice(0, 10),
    });

    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to add inventory item.' };
    }

    const newItem = res.data;
    setState((prev) => ({ ...prev, inventory: deduplicateById([newItem, ...prev.inventory]) }));
    appendAuditLog('ADD_INVENTORY_ITEM', 'inventory_item', newItem.id, `Added ${newItem.name} (${newItem.item_code}).`);
    return { success: true, id: newItem.id };
  };

  const updateInventoryItem = async (itemId: string, updates: Partial<InventoryItem>): Promise<ActionResult> => {
    const existing = state.inventory.find((i) => i.id === itemId);
    if (!existing) return { success: false, error: 'Inventory item not found.' };
    const accessErr = ensureLabWriteAccess(existing.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const merged: InventoryItem = {
      ...existing,
      ...updates,
      institution_id: existing.institution_id || institution.id,
      status: calculateStockStatus(
        updates.quantity_available ?? existing.quantity_available,
        updates.min_safety_threshold ?? existing.min_safety_threshold
      ),
    };

    const res = await labverseRepository.saveInventoryItem(merged, itemId);
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to update inventory item.' };
    }

    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) => (i.id === itemId ? res.data! : i)),
    }));
    appendAuditLog('UPDATE_INVENTORY_ITEM', 'inventory_item', itemId, `Updated ${merged.name} (${merged.item_code}).`);
    return { success: true, id: itemId };
  };

  const deleteInventoryItem = async (itemId: string): Promise<ActionResult> => {
    const existing = state.inventory.find((i) => i.id === itemId);
    if (!existing) return { success: false, error: 'Inventory item not found.' };
    const accessErr = ensureLabWriteAccess(existing.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const res = await labverseRepository.deleteInventoryItem(itemId);
    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Failed to delete inventory item.' };
    }

    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.filter((i) => i.id !== itemId),
    }));
    appendAuditLog('DELETE_INVENTORY_ITEM', 'inventory_item', itemId, `Removed ${existing.name} (${existing.item_code}).`);
    return { success: true };
  };

  const issueEquipment = async (
    itemId: string,
    qty: number,
    borrowerId: string,
    borrowerName: string,
    expTitle: string,
    remarks: string
  ): Promise<ActionResult> => {
    const item = state.inventory.find((i) => i.id === itemId);
    if (!item) return { success: false, error: 'Apparatus item not found.' };
    const accessErr = ensureLabWriteAccess(item.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const check = validateInventoryIssue(item.quantity_available, qty);
    if (!check.canIssue) return { success: false, error: check.error };

    if (isSupabaseActive) {
      const rpcRes = await labverseRepository.processInventoryTransaction(
        itemId,
        'issue',
        qty,
        borrowerId,
        borrowerName,
        expTitle,
        remarks
      );
      if (!rpcRes.success) return { success: false, error: rpcRes.error };
    }

    const newAvailable = check.remainingQty;
    const newStatus = calculateStockStatus(newAvailable, item.min_safety_threshold);
    const tx: InventoryTransaction = {
      id: `tx-${Date.now().toString(36)}`,
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      transaction_type: 'issue',
      quantity: qty,
      borrower_id: borrowerId,
      borrower_name: borrowerName,
      experiment_title: expTitle,
      handled_by_name: currentUser?.name || 'Lab Assistant',
      timestamp: new Date().toISOString(),
      remarks,
    };

    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) =>
        i.id === itemId ? { ...i, quantity_available: newAvailable, status: newStatus } : i
      ),
      transactions: [tx, ...prev.transactions],
    }));

    appendAuditLog('INVENTORY_ISSUE', 'inventory_item', item.id, `Issued ${qty} ${item.unit} of ${item.item_code} to ${borrowerName}.`);
    return { success: true };
  };

  const returnEquipment = async (
    itemId: string,
    qty: number,
    borrowerName: string,
    remarks: string
  ): Promise<ActionResult> => {
    const item = state.inventory.find((i) => i.id === itemId);
    if (!item) return { success: false, error: 'Apparatus item not found.' };
    const accessErr = ensureLabWriteAccess(item.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const check = validateInventoryReturn(item.quantity_available, item.quantity_total, qty);
    if (!check.canReturn) return { success: false, error: check.error };

    if (isSupabaseActive) {
      const rpcRes = await labverseRepository.processInventoryTransaction(
        itemId,
        'return',
        qty,
        '',
        borrowerName,
        '',
        remarks
      );
      if (!rpcRes.success) return { success: false, error: rpcRes.error };
    }

    const newStatus = calculateStockStatus(check.newAvailable, item.min_safety_threshold);
    const tx: InventoryTransaction = {
      id: `tx-${Date.now().toString(36)}`,
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      transaction_type: 'return',
      quantity: qty,
      borrower_name: borrowerName,
      handled_by_name: currentUser?.name || 'Lab Assistant',
      timestamp: new Date().toISOString(),
      remarks,
    };

    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) =>
        i.id === itemId ? { ...i, quantity_available: check.newAvailable, status: newStatus } : i
      ),
      transactions: [tx, ...prev.transactions],
    }));
    appendAuditLog('INVENTORY_RETURN', 'inventory_item', item.id, `Returned ${qty} ${item.unit} of ${item.item_code}.`);
    return { success: true };
  };

  const logDamageWriteOff = async (itemId: string, qty: number, reason: string): Promise<ActionResult> => {
    const item = state.inventory.find((i) => i.id === itemId);
    if (!item) return { success: false, error: 'Apparatus item not found.' };
    const accessErr = ensureLabWriteAccess(item.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    const check = validateInventoryDamage(item.quantity_available, item.quantity_total, qty, reason);
    if (!check.canWriteOff) return { success: false, error: check.error };

    if (isSupabaseActive) {
      const rpcRes = await labverseRepository.processInventoryTransaction(
        itemId,
        'damage_writeoff',
        qty,
        '',
        '',
        '',
        reason
      );
      if (!rpcRes.success) return { success: false, error: rpcRes.error };
    }

    const newStatus = calculateStockStatus(check.newAvailable, item.min_safety_threshold);
    const tx: InventoryTransaction = {
      id: `tx-${Date.now().toString(36)}`,
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      transaction_type: 'damage_writeoff',
      quantity: qty,
      handled_by_name: currentUser?.name || 'Lab Assistant',
      timestamp: new Date().toISOString(),
      remarks: reason,
    };

    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) =>
        i.id === itemId
          ? { ...i, quantity_available: check.newAvailable, quantity_total: check.newTotal, status: newStatus }
          : i
      ),
      transactions: [tx, ...prev.transactions],
    }));
    appendAuditLog('INVENTORY_DAMAGE', 'inventory_item', item.id, `Wrote off ${qty} ${item.unit} of ${item.item_code}: ${reason}`);
    return { success: true };
  };

  const restockEquipment = async (
    itemId: string,
    qty: number,
    supplierRemarks: string
  ): Promise<ActionResult> => {
    if (!Number.isFinite(qty) || qty <= 0) {
      return { success: false, error: 'Restock quantity must be greater than zero.' };
    }
    const item = state.inventory.find((i) => i.id === itemId);
    if (!item) return { success: false, error: 'Apparatus item not found.' };
    const accessErr = ensureLabWriteAccess(item.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };

    if (isSupabaseActive) {
      const rpcRes = await labverseRepository.processInventoryTransaction(
        itemId,
        'restock',
        qty,
        '',
        '',
        '',
        supplierRemarks
      );
      if (!rpcRes.success) return { success: false, error: rpcRes.error };
    }

    const newAvailable = item.quantity_available + qty;
    const newTotal = item.quantity_total + qty;
    const newStatus = calculateStockStatus(newAvailable, item.min_safety_threshold);
    const tx: InventoryTransaction = {
      id: `tx-${Date.now().toString(36)}`,
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      transaction_type: 'restock',
      quantity: qty,
      handled_by_name: currentUser?.name || 'Lab Assistant',
      timestamp: new Date().toISOString(),
      remarks: supplierRemarks,
    };

    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) =>
        i.id === itemId
          ? { ...i, quantity_available: newAvailable, quantity_total: newTotal, status: newStatus }
          : i
      ),
      transactions: [tx, ...prev.transactions],
    }));
    appendAuditLog('INVENTORY_RESTOCK', 'inventory_item', item.id, `Restocked +${qty} ${item.unit} of ${item.item_code}.`);
    return { success: true };
  };

  const mapItemToExperiment = (itemId: string, expId: string) => {
    const item = state.inventory.find((i) => i.id === itemId);
    if (!item || ensureLabWriteAccess(item.lab_id || selectedLabId)) return;

    const currentMapped = item.mapped_experiment_ids || [];
    const exists = currentMapped.includes(expId);
    const updated = exists ? currentMapped.filter((id) => id !== expId) : [...currentMapped, expId];

    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.map((i) => (i.id === itemId ? { ...i, mapped_experiment_ids: updated } : i)),
    }));
  };

  // ============================================================================
  // AUDIT, NOTIFICATIONS & CSV EXPORT
  // ============================================================================

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  };

  const clearAllNotifications = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({ ...n, read: true })),
    }));
  };

  const resetToDefaultData = async () => {
    if (isSupabaseActive) return;
    try {
      await idbClear();
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setState((prev) => ({
      ...sanitizeDemoState(null),
      demoAuthRole: prev.demoAuthRole,
      demoAuthUserId: prev.demoAuthUserId,
    }));
  };

  const exportToCsv = (type: 'inventory' | 'audit_logs') => {
    let rows: string[][] = [];
    let filename = 'mvit_export.csv';

    if (type === 'inventory') {
      filename = 'MVIT_Lab_Inventory.csv';
      rows.push(['Item Code', 'Name', 'Category', 'Location', 'Available', 'Total', 'Unit', 'Status']);
      labInventory.forEach((i) => {
        rows.push([
          i.item_code,
          i.name,
          i.category,
          i.location,
          String(i.quantity_available),
          String(i.quantity_total),
          i.unit,
          i.status,
        ]);
      });
    } else {
      filename = 'MVIT_Audit_Trail.csv';
      rows.push(['Timestamp', 'Staff Name', 'Role', 'Action', 'Resource', 'Details']);
      state.auditLogs.forEach((l) => {
        rows.push([l.timestamp, l.user_name, l.user_role, l.action, l.resource_type, l.details]);
      });
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((r) => r.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ============================================================================
  // COURSES & LAB/EXPERIMENT COURSE MAPPINGS
  // ============================================================================

  const addCourse = async (
    course: Omit<Course, 'id' | 'institution_id' | 'created_at' | 'updated_at'>
  ): Promise<ActionResult> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can manage academic courses.' };
    }
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const res = await labverseRepository.saveCourse({ ...course, institution_id: targetInstId });
    if (res.error || !res.data) return { success: false, error: res.error || 'Failed to save course.' };
    const created = res.data;
    setState((prev) => ({ ...prev, courses: deduplicateById([...prev.courses, created]) }));
    appendAuditLog('ADD_COURSE', 'course', created.id, `Added MVIT course ${created.code} (${created.name}).`);
    return { success: true, id: created.id };
  };

  const updateCourse = async (courseId: string, updates: Partial<Course>): Promise<ActionResult> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can configure academic courses.' };
    }
    const existing = state.courses.find((c) => c.id === courseId);
    if (!existing) return { success: false, error: 'Course not found.' };

    const merged: Course = {
      ...existing,
      ...updates,
      institution_id: existing.institution_id || institution.id,
      updated_at: new Date().toISOString(),
    };
    const res = await labverseRepository.saveCourse(merged, courseId);
    if (res.error || !res.data) return { success: false, error: res.error || 'Failed to update course.' };

    setState((prev) => ({
      ...prev,
      courses: prev.courses.map((c) => (c.id === courseId ? res.data! : c)),
    }));
    appendAuditLog(
      'UPDATE_COURSE',
      'course',
      courseId,
      `Updated MVIT course ${merged.code} (active: ${merged.is_active !== false ? 'true' : 'false'}).`
    );
    return { success: true, id: courseId };
  };

  const setLabCourses = async (labId: string, courseIds: string[]): Promise<ActionResult> => {
    if (currentRole !== 'college_admin') {
      return { success: false, error: 'Only MVIT College Admin can configure laboratory courses.' };
    }
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const res = await labverseRepository.setLabCourses(targetInstId, labId, courseIds);
    if (!res.success) return { success: false, error: res.error };

    setState((prev) => ({
      ...prev,
      laboratoryCourses: [
        ...prev.laboratoryCourses.filter((lc) => lc.lab_id !== labId),
        ...(res.data || []),
      ],
      labs: prev.labs.map((l) => (l.id === labId ? { ...l, course_ids: courseIds } : l)),
    }));
    appendAuditLog('UPDATE_LAB_COURSES', 'laboratory', labId, `Mapped ${courseIds.length} course(s) to laboratory.`);
    return { success: true };
  };

  const setExperimentCourses = async (experimentId: string, courseIds: string[]): Promise<ActionResult> => {
    const existing = state.experiments.find((e) => e.id === experimentId);
    const subj = existing ? state.subjects.find((s) => s.id === existing.subject_id) : undefined;
    const accessErr = ensureLabWriteAccess(existing?.lab_id || subj?.lab_id || selectedLabId);
    if (accessErr) return { success: false, error: accessErr };
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const res = await labverseRepository.setExperimentCourses(targetInstId, experimentId, courseIds);
    if (!res.success) return { success: false, error: res.error };

    setState((prev) => ({
      ...prev,
      experimentCourses: [
        ...prev.experimentCourses.filter((ec) => ec.experiment_id !== experimentId),
        ...(res.data || []),
      ],
      experiments: prev.experiments.map((e) =>
        e.id === experimentId ? { ...e, course_ids: courseIds } : e
      ),
    }));
    return { success: true };
  };

  // ============================================================================
  // PC LABORATORY MANAGEMENT (STAFF-ONLY OPERATIONAL DATA)
  // ============================================================================

  const scopedPcComputers = useMemo(() => {
    if (!isAuthenticated || !currentUser) return [];
    // College Admin and public users must NEVER receive individual PC computer records
    if (currentUser.role !== 'lab_assistant' || currentUser.status === 'suspended') return [];
    const allowedPcLabIds = new Set(
      labs
        .filter((l) => canViewPcLabComputers(currentUser, l))
        .map((l) => l.id)
    );
    return state.pcComputers.filter((c) => allowedPcLabIds.has(c.lab_id));
  }, [isAuthenticated, currentUser, labs, state.pcComputers]);

  const scopedPcMaintenance = useMemo(() => {
    if (!isAuthenticated || !currentUser) return [];
    if (currentUser.role !== 'lab_assistant' || currentUser.status === 'suspended') return [];
    const allowedPcLabIds = new Set(
      labs
        .filter((l) => canViewPcLabComputers(currentUser, l))
        .map((l) => l.id)
    );
    return state.pcMaintenanceRecords.filter((r) => allowedPcLabIds.has(r.lab_id));
  }, [isAuthenticated, currentUser, labs, state.pcMaintenanceRecords]);

  const labPcComputers = useMemo(() => {
    if (!selectedLabId || selectedLab?.lab_type !== 'pc_lab') return scopedPcComputers;
    return scopedPcComputers.filter((c) => c.lab_id === selectedLabId);
  }, [scopedPcComputers, selectedLabId, selectedLab]);

  const pcLabStats = useMemo(
    () => calculatePcLabSummaryStats(labPcComputers),
    [labPcComputers]
  );

  const addPcComputer = async (
    pc: Omit<PcLabComputer, 'id' | 'institution_id' | 'created_at' | 'updated_at'>
  ): Promise<ActionResult> => {
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }
    const targetLabId = pc.lab_id || selectedLabId;
    const accessErr = ensurePcLabAssistantWriteAccess(targetLabId);
    if (accessErr) return { success: false, error: accessErr };
    if (!targetLabId) return { success: false, error: 'Target PC Laboratory is required.' };

    const cleanCode = pc.computer_code.trim().toUpperCase();
    if (!cleanCode) return { success: false, error: 'Computer identification number is required.' };
    if (state.pcComputers.some((c) => c.computer_code.toUpperCase() === cleanCode)) {
      return { success: false, error: `Computer ID "${cleanCode}" already exists in MVIT PC Lab.` };
    }

    const res = await labverseRepository.savePcComputer({
      ...pc,
      institution_id: targetInstId,
      lab_id: targetLabId,
      computer_code: cleanCode,
      last_updated: pc.last_updated || new Date().toISOString().slice(0, 10),
    });
    if (res.error || !res.data) return { success: false, error: res.error || 'Failed to add computer.' };

    const created = res.data;
    setState((prev) => ({ ...prev, pcComputers: deduplicateById([created, ...prev.pcComputers]) }));
    appendAuditLog('ADD_PC_COMPUTER', 'pc_lab_computer', created.id, `Registered workstation ${created.computer_code} (${created.computer_type}).`);
    return { success: true, id: created.id };
  };

  const updatePcComputer = async (pcId: string, updates: Partial<PcLabComputer>): Promise<ActionResult> => {
    const existing = state.pcComputers.find((c) => c.id === pcId);
    if (!existing) return { success: false, error: 'Computer record not found.' };
    const accessErr = ensurePcLabAssistantWriteAccess(existing.lab_id);
    if (accessErr) return { success: false, error: accessErr };

    const merged: PcLabComputer = {
      ...existing,
      ...updates,
      institution_id: existing.institution_id || institution.id,
      last_updated: new Date().toISOString().slice(0, 10),
    };
    const res = await labverseRepository.savePcComputer(merged, pcId);
    if (res.error || !res.data) return { success: false, error: res.error || 'Failed to update computer.' };

    setState((prev) => ({
      ...prev,
      pcComputers: prev.pcComputers.map((c) => (c.id === pcId ? res.data! : c)),
    }));
    appendAuditLog('UPDATE_PC_COMPUTER', 'pc_lab_computer', pcId, `Updated computer ${merged.computer_code} (${merged.status}).`);
    return { success: true, id: pcId };
  };

  const deletePcComputer = async (pcId: string): Promise<ActionResult> => {
    const existing = state.pcComputers.find((c) => c.id === pcId);
    if (!existing) return { success: false, error: 'Computer record not found.' };
    const accessErr = ensurePcLabAssistantWriteAccess(existing.lab_id);
    if (accessErr) return { success: false, error: accessErr };

    const res = await labverseRepository.deletePcComputer(pcId);
    if (res.error || !res.data) return { success: false, error: res.error || 'Failed to remove computer.' };

    setState((prev) => ({
      ...prev,
      pcComputers: prev.pcComputers.filter((c) => c.id !== pcId),
      pcMaintenanceRecords: prev.pcMaintenanceRecords.filter((r) => r.computer_id !== pcId),
    }));
    appendAuditLog('DELETE_PC_COMPUTER', 'pc_lab_computer', pcId, `Removed workstation ${existing.computer_code}.`);
    return { success: true };
  };

  const reportPcDefect = async (params: {
    computerId: string;
    reportedIssue: string;
    defectDescription?: string;
    maintenanceRemarks?: string;
    repairStatus?: 'defective' | 'under_maintenance';
  }): Promise<ActionResult> => {
    const pc = state.pcComputers.find((c) => c.id === params.computerId);
    if (!pc) return { success: false, error: 'Target workstation not found.' };
    const accessErr = ensurePcLabAssistantWriteAccess(pc.lab_id);
    if (accessErr) return { success: false, error: accessErr };
    const targetInstId = ensureResolvedInstitutionId();
    if (!targetInstId) {
      return { success: false, error: 'MVIT institution UUID has not been resolved from Supabase.' };
    }

    const nextStatus = params.repairStatus || 'defective';
    const res = await labverseRepository.reportPcDefect({
      institution_id: targetInstId,
      lab_id: pc.lab_id,
      computer_id: pc.id,
      reported_issue: params.reportedIssue.trim(),
      defect_description: params.defectDescription || '',
      date_reported: new Date().toISOString().slice(0, 10),
      repair_status: nextStatus,
      maintenance_remarks: params.maintenanceRemarks || '',
      resolution_date: null,
      reported_by: currentUser?.id,
    });
    if (res.error || !res.data) return { success: false, error: res.error || 'Failed to report defect.' };

    const createdRecord = res.data;
    setState((prev) => ({
      ...prev,
      pcMaintenanceRecords: deduplicateById([createdRecord, ...prev.pcMaintenanceRecords]),
      pcComputers: prev.pcComputers.map((c) =>
        c.id === pc.id
          ? {
              ...c,
              status: nextStatus,
              maintenance_status: nextStatus === 'under_maintenance' ? 'in_repair' : 'awaiting_service',
              last_updated: new Date().toISOString().slice(0, 10),
            }
          : c
      ),
    }));
    appendAuditLog('REPORT_PC_DEFECT', 'pc_lab_maintenance', createdRecord.id, `Reported defect on ${pc.computer_code}: ${params.reportedIssue}`);
    return { success: true, id: createdRecord.id };
  };

  const updatePcRepairStatus = async (params: {
    computerId: string;
    repairStatus: PcComputerStatus;
    maintenanceRemarks: string;
    recordId?: string;
    resolutionDate?: string | null;
  }): Promise<ActionResult> => {
    const pc = state.pcComputers.find((c) => c.id === params.computerId);
    if (!pc) return { success: false, error: 'Computer record not found.' };
    const accessErr = ensurePcLabAssistantWriteAccess(pc.lab_id);
    if (accessErr) return { success: false, error: accessErr };

    const effectiveResolution =
      params.resolutionDate !== undefined
        ? params.resolutionDate
        : params.repairStatus === 'repaired' || params.repairStatus === 'working'
          ? new Date().toISOString().slice(0, 10)
          : null;

    const targetRecord =
      (params.recordId && state.pcMaintenanceRecords.find((r) => r.id === params.recordId && r.computer_id === pc.id)) ||
      state.pcMaintenanceRecords.find(
        (r) =>
          r.computer_id === pc.id &&
          (!r.resolution_date || r.repair_status === 'defective' || r.repair_status === 'under_maintenance')
      );

    const res = await labverseRepository.updatePcRepairStatus(
      pc.id,
      params.repairStatus,
      params.maintenanceRemarks,
      targetRecord?.id,
      effectiveResolution,
      currentUser?.id
    );
    if (!res.success) return { success: false, error: res.error };

    const normalizedComputerStatus: PcComputerStatus =
      params.repairStatus === 'repaired' ? 'working' : params.repairStatus;

    setState((prev) => ({
      ...prev,
      pcComputers: prev.pcComputers.map((c) =>
        c.id === pc.id
          ? {
              ...c,
              status: normalizedComputerStatus,
              maintenance_status:
                normalizedComputerStatus === 'working'
                  ? 'operational'
                  : normalizedComputerStatus === 'under_maintenance'
                    ? 'in_repair'
                    : 'awaiting_service',
              last_updated: new Date().toISOString().slice(0, 10),
            }
          : c
      ),
      pcMaintenanceRecords: prev.pcMaintenanceRecords.map((r) =>
        targetRecord && r.id === targetRecord.id
          ? {
              ...r,
              repair_status: params.repairStatus,
              maintenance_remarks: params.maintenanceRemarks || r.maintenance_remarks,
              resolution_date: effectiveResolution,
            }
          : r
      ),
    }));
    appendAuditLog('UPDATE_PC_REPAIR', 'pc_lab_computer', pc.id, `Updated ${pc.computer_code} repair status to ${params.repairStatus}.`);
    return { success: true };
  };

  const value: LabverseContextType = {
    institution,
    isSupabaseActive,
    session,
    authLoading,
    dataLoadError,
    isAuthenticated,
    currentRole,
    currentUser,
    isAccountSuspended,
    isInstitutionInactive,
    signOut,
    authenticateDemoUser,

    labs,
    publicLabs,
    activeLabs,
    accessibleLabs,
    selectedLabId,
    selectedLab,
    setSelectedLabId,
    switchLab,
    createNewLab,
    updateExistingLab,
    deactivateExistingLab,
    activateExistingLab,
    assignAssistantToLab,

    departments: state.departments,
    currentTerm,
    addDepartment,

    allProfiles: state.allProfiles,
    labAssistants,
    inviteLabAssistant,
    resendAssistantInvite,
    sendAssistantPasswordReset,
    updateProfileStatus,
    updateUserLabAssignments,

    subjects: state.subjects,
    labSubjects,
    addSubject,
    updateSubject,
    deleteSubject,
    saveSubjectSyllabus,

    experiments: state.experiments,
    labExperiments,
    addExperiment,
    updateExperiment,
    deleteExperiment,

    documents: state.documents,
    addOrUpdateDocument,
    deleteDocument,

    inventory: state.inventory,
    labInventory,
    transactions: state.transactions,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    issueEquipment,
    returnEquipment,
    logDamageWriteOff,
    restockEquipment,
    mapItemToExperiment,

    courses: state.courses,
    laboratoryCourses: state.laboratoryCourses,
    experimentCourses: state.experimentCourses,
    addCourse,
    updateCourse,
    setLabCourses,
    setExperimentCourses,

    pcComputers: scopedPcComputers,
    labPcComputers,
    pcMaintenanceRecords: scopedPcMaintenance,
    pcLabStats,
    addPcComputer,
    updatePcComputer,
    deletePcComputer,
    reportPcDefect,
    updatePcRepairStatus,

    auditLogs: state.auditLogs,
    notifications: state.notifications,
    markNotificationRead,
    clearAllNotifications,
    resetToDefaultData,
    exportToCsv,
  };

  return <LabverseContext.Provider value={value}>{children}</LabverseContext.Provider>;
};

export const useLabverse = (): LabverseContextType => {
  const ctx = useContext(LabverseContext);
  if (!ctx) throw new Error('useLabverse must be used within a LabverseProvider');
  return ctx;
};
