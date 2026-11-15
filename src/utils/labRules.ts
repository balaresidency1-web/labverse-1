/**
 * LABVERSE – MVIT Laboratory validation rules, permission checks, and inventory logic
 */

/**
 * Validates whether a given URL is a legitimate YouTube URL
 */
export function validateYouTubeUrl(url: string | null | undefined): { isValid: boolean; videoId: string | null; error?: string } {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { isValid: false, videoId: null, error: 'URL is required' };
  }

  const trimmed = url.trim();

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();

    const isYouTubeHost = host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com';
    const isYouTuBeHost = host === 'youtu.be';

    if (!isYouTubeHost && !isYouTuBeHost) {
      return { isValid: false, videoId: null, error: 'Only official YouTube domains (youtube.com, youtu.be) are supported' };
    }

    if (isYouTuBeHost) {
      const id = parsed.pathname.slice(1).split('/')[0].split('?')[0];
      if (id && id.length >= 6) {
        return { isValid: true, videoId: id };
      }
      return { isValid: false, videoId: null, error: 'Invalid youtu.be video identifier' };
    }

    if (isYouTubeHost) {
      if (parsed.pathname === '/watch') {
        const v = parsed.searchParams.get('v');
        if (v && v.length >= 6) {
          return { isValid: true, videoId: v };
        }
        return { isValid: false, videoId: null, error: 'Missing or invalid "v" parameter in YouTube URL' };
      }

      if (parsed.pathname.startsWith('/embed/')) {
        const id = parsed.pathname.replace('/embed/', '').split('/')[0].split('?')[0];
        if (id && id.length >= 6) {
          return { isValid: true, videoId: id };
        }
      }

      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.replace('/shorts/', '').split('/')[0].split('?')[0];
        if (id && id.length >= 6) {
          return { isValid: true, videoId: id };
        }
      }
    }

    return { isValid: false, videoId: null, error: 'Unrecognized YouTube video path structure' };
  } catch {
    return { isValid: false, videoId: null, error: 'Malformed URL format' };
  }
}

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  return validateYouTubeUrl(url).videoId;
}

export function validateYouTubeSearchUrl(
  url: string | null | undefined
): { isValid: boolean; normalizedUrl: string | null; query: string | null } {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return { isValid: false, normalizedUrl: null, query: null };
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') {
      return { isValid: false, normalizedUrl: null, query: null };
    }
    const host = parsed.hostname.toLowerCase();
    const isYtHost = host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com';
    if (!isYtHost || parsed.pathname !== '/results') {
      return { isValid: false, normalizedUrl: null, query: null };
    }
    const q = parsed.searchParams.get('search_query')?.trim() || '';
    if (!q) {
      return { isValid: false, normalizedUrl: null, query: null };
    }
    return { isValid: true, normalizedUrl: parsed.toString(), query: q };
  } catch {
    return { isValid: false, normalizedUrl: null, query: null };
  }
}

export interface ClassifiedYouTubeResource {
  mode: 'direct_video' | 'search_only' | 'unavailable';
  videoId: string | null;
  watchUrl: string | null;
  altVideoId: string | null;
  altWatchUrl: string | null;
  searchUrl: string | null;
  searchQuery: string | null;
  ctaLabel: 'WATCH EXPERIMENT VIDEO' | 'FIND A DEMONSTRATION' | 'VIDEO UNAVAILABLE';
}

export function classifyYouTubeResource(exp?: {
  youtube_url?: string | null;
  youtube_alt_url?: string | null;
  youtube_search_url?: string | null;
} | null): ClassifiedYouTubeResource {
  const primary = validateYouTubeUrl(exp?.youtube_url);
  const alt = validateYouTubeUrl(exp?.youtube_alt_url);
  const searchFromField = validateYouTubeSearchUrl(exp?.youtube_search_url);
  // Also gracefully support if someone pasted a /results search URL into youtube_url
  const searchFromPrimary = !primary.isValid ? validateYouTubeSearchUrl(exp?.youtube_url) : { isValid: false, normalizedUrl: null, query: null };

  const searchUrl = searchFromField.normalizedUrl || searchFromPrimary.normalizedUrl;
  const searchQuery = searchFromField.query || searchFromPrimary.query;

  if (primary.isValid && primary.videoId) {
    return {
      mode: 'direct_video',
      videoId: primary.videoId,
      watchUrl: `https://www.youtube.com/watch?v=${primary.videoId}`,
      altVideoId: alt.isValid ? alt.videoId : null,
      altWatchUrl: alt.isValid && alt.videoId ? `https://www.youtube.com/watch?v=${alt.videoId}` : null,
      searchUrl,
      searchQuery,
      ctaLabel: 'WATCH EXPERIMENT VIDEO',
    };
  }

  if (alt.isValid && alt.videoId) {
    return {
      mode: 'direct_video',
      videoId: alt.videoId,
      watchUrl: `https://www.youtube.com/watch?v=${alt.videoId}`,
      altVideoId: null,
      altWatchUrl: null,
      searchUrl,
      searchQuery,
      ctaLabel: 'WATCH EXPERIMENT VIDEO',
    };
  }

  if (searchUrl) {
    return {
      mode: 'search_only',
      videoId: null,
      watchUrl: null,
      altVideoId: null,
      altWatchUrl: null,
      searchUrl,
      searchQuery,
      ctaLabel: 'FIND A DEMONSTRATION',
    };
  }

  return {
    mode: 'unavailable',
    videoId: null,
    watchUrl: null,
    altVideoId: null,
    altWatchUrl: null,
    searchUrl: null,
    searchQuery: null,
    ctaLabel: 'VIDEO UNAVAILABLE',
  };
}

/**
 * Verified Allowlist for embedded simulation domains
 */
export const ALLOWED_EMBED_DOMAINS = [
  'benchtwin.com',
  'lab.benchtwin.com',
  'sim.benchtwin.com',
  'phet.colorado.edu',
  'vlab.co.in',
  'vlabs.ac.in',
  'fsp1-iiith.vlabs.ac.in',
  'be-iitkgp.vlabs.ac.in',
  'ae-iitr.vlabs.ac.in',
  'circuitverse.org',
  'labverse.io',
  'mvit.edu.in',
];

/**
 * Checks if a Bench Twin or simulation destination URL allows iframe embedding
 */
export function checkBenchTwinEmbedSupport(url: string | null | undefined): {
  isSafeUrl: boolean;
  canEmbed: boolean;
  normalizedUrl: string | null;
  reason: string;
} {
  if (!url || !url.trim()) {
    return {
      isSafeUrl: false,
      canEmbed: false,
      normalizedUrl: null,
      reason: 'No simulation URL configured',
    };
  }

  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') {
      return {
        isSafeUrl: false,
        canEmbed: false,
        normalizedUrl: null,
        reason: 'Only HTTPS URLs are allowed for virtual simulations',
      };
    }

    const host = parsed.hostname.toLowerCase();
    const isDomainAllowed = ALLOWED_EMBED_DOMAINS.some(
      (domain) => host === domain || host.endsWith('.' + domain)
    );

    if (isDomainAllowed) {
      return {
        isSafeUrl: true,
        canEmbed: true,
        normalizedUrl: parsed.toString(),
        reason: `Domain ${host} is verified for inline embedded simulation.`,
      };
    }

    return {
      isSafeUrl: true,
      canEmbed: false,
      normalizedUrl: parsed.toString(),
      reason: `Domain ${host} is not on the verified iframe allowlist. Launch directly in a new tab.`,
    };
  } catch {
    return {
      isSafeUrl: false,
      canEmbed: false,
      normalizedUrl: null,
      reason: 'Invalid URL provided',
    };
  }
}

/**
 * Calculates stock balance and verifies non-negative rule
 */
export function validateInventoryIssue(
  availableQty: number,
  requestedQty: number
): { canIssue: boolean; valid: boolean; remainingQty: number; error?: string } {
  if (requestedQty <= 0) {
    return {
      canIssue: false,
      valid: false,
      remainingQty: availableQty,
      error: 'Quantity must be greater than zero',
    };
  }

  if (requestedQty > availableQty) {
    return {
      canIssue: false,
      valid: false,
      remainingQty: availableQty,
      error: `Insufficient inventory: requested ${requestedQty}, but only ${availableQty} are currently in stock.`,
    };
  }

  return { canIssue: true, valid: true, remainingQty: availableQty - requestedQty };
}

/**
 * Evaluates stock health based on minimum threshold
 */
export function calculateStockStatus(
  quantity: number,
  minThreshold: number
): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= minThreshold) return 'low_stock';
  return 'in_stock';
}

/**
 * Validates equipment return quantity against checked-out balance
 */
export function validateInventoryReturn(
  availableQty: number,
  totalQty: number,
  returnQty: number
): { canReturn: boolean; newAvailable: number; error?: string } {
  if (!Number.isFinite(returnQty) || returnQty <= 0) {
    return {
      canReturn: false,
      newAvailable: availableQty,
      error: 'Return quantity must be greater than zero.',
    };
  }
  const checkedOut = Math.max(0, totalQty - availableQty);
  if (returnQty > checkedOut) {
    return {
      canReturn: false,
      newAvailable: availableQty,
      error:
        checkedOut === 0
          ? 'All units are currently in stock; none are checked out.'
          : `Cannot return ${returnQty} units; only ${checkedOut} units are currently checked out.`,
    };
  }
  return { canReturn: true, newAvailable: availableQty + returnQty };
}

/**
 * Validates damaged/scrapped stock write-off quantity
 */
export function validateInventoryDamage(
  availableQty: number,
  totalQty: number,
  damageQty: number,
  reason: string
): { canWriteOff: boolean; newAvailable: number; newTotal: number; error?: string } {
  if (!Number.isFinite(damageQty) || damageQty <= 0) {
    return {
      canWriteOff: false,
      newAvailable: availableQty,
      newTotal: totalQty,
      error: 'Damaged quantity must be greater than zero.',
    };
  }
  if (!reason.trim()) {
    return {
      canWriteOff: false,
      newAvailable: availableQty,
      newTotal: totalQty,
      error: 'Please enter a damage reason for audit tracking.',
    };
  }
  if (damageQty > totalQty) {
    return {
      canWriteOff: false,
      newAvailable: availableQty,
      newTotal: totalQty,
      error: `Cannot write off ${damageQty} units; total inventory is only ${totalQty}.`,
    };
  }
  return {
    canWriteOff: true,
    newAvailable: Math.max(0, availableQty - damageQty),
    newTotal: Math.max(0, totalQty - damageQty),
  };
}

/**
 * Formats singular/plural count labels cleanly
 */
export function formatCountLabel(count: number, singular: string, plural?: string): string {
  const pluralForm = plural || `${singular}s`;
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Resolves a demo account sign-in attempt against stored staff profiles
 */
export function resolveDemoSignInProfile<
  T extends { id: string; email: string; role: string; status?: string }
>(
  profiles: T[],
  rawEmail: string
): { ok: true; profile: T } | { ok: false; error: string } {
  const cleanEmail = rawEmail.trim().toLowerCase();
  if (!cleanEmail) {
    return { ok: false, error: 'Please enter your registered MVIT staff email address.' };
  }
  const matched = profiles.find((p) => p.email.toLowerCase() === cleanEmail);
  if (!matched) {
    return {
      ok: false,
      error: `No staff account found matching "${cleanEmail}". Please verify your MVIT email address.`,
    };
  }
  if (matched.status === 'suspended') {
    return {
      ok: false,
      error: `Account "${cleanEmail}" has been suspended by MVIT College Administration.`,
    };
  }
  return { ok: true, profile: matched };
}

/**
 * Permission checks for MVIT 2-role staff model
 */
export function isCollegeAdmin(role?: string | null): boolean {
  return role === 'college_admin';
}

export function isLabAssistant(role?: string | null): boolean {
  return role === 'lab_assistant';
}

export function canAssistantAccessLab(
  user: { role?: string | null; assigned_lab_ids?: string[] } | null | undefined,
  labId: string | undefined | null
): boolean {
  if (!user || !labId) return false;
  if (user.role === 'college_admin') return true;
  if (user.role === 'lab_assistant') {
    return Boolean(user.assigned_lab_ids && user.assigned_lab_ids.includes(labId));
  }
  return false;
}

/**
 * Returns the default/valid navigation tab when switching roles or labs
 */
export function normalizeTabForRole(
  role: string,
  currentTab: string,
  labType?: 'practical' | 'pc_lab'
): string {
  const practicalAssistantTabs = [
    'dashboard',
    'my_labs',
    'subjects',
    'experiments',
    'syllabus',
    'manuals',
    'youtube',
    'bench_twin',
    'inventory',
    'qr_codes',
    'settings',
  ];

  const pcLabAssistantTabs = [
    'dashboard',
    'my_labs',
    'pc_working',
    'pc_defective',
    'pc_staff',
    'qr_codes',
    'settings',
  ];

  const validTabsByRole: Record<string, string[]> = {
    college_admin: ['dashboard', 'manage_labs', 'assistants', 'assignments', 'settings'],
    lab_assistant: labType === 'pc_lab' ? pcLabAssistantTabs : practicalAssistantTabs,
  };
  const allowed = validTabsByRole[role] || ['dashboard'];
  return allowed.includes(currentTab) ? currentTab : 'dashboard';
}

/**
 * Determines whether a laboratory is eligible to appear in the unauthenticated Public Learning Portal.
 * Internal laboratories (is_public === false) and PC Labs (lab_type === 'pc_lab') are strictly excluded.
 */
export function isPublicVisibleLab(
  lab?: { status?: string; is_public?: boolean; lab_type?: string } | null
): boolean {
  if (!lab) return false;
  if (lab.status !== 'active') return false;
  if (lab.is_public === false) return false;
  if (lab.lab_type === 'pc_lab') return false;
  return true;
}

export interface PcComputerLike {
  id: string;
  lab_id: string;
  computer_type: 'student_computer' | 'staff_computer';
  status: 'working' | 'defective' | 'under_maintenance' | 'repaired';
}

export interface PcLabSummaryStatsResult {
  totalComputers: number;
  workingComputers: number;
  defectiveComputers: number;
  underMaintenanceComputers: number;
  staffComputers: number;
  workingStudentComputers: number;
  defectiveStudentComputers: number;
}

/**
 * Dynamically calculates PC Lab KPI counts from persisted computer records.
 */
export function calculatePcLabSummaryStats(computers: PcComputerLike[]): PcLabSummaryStatsResult {
  const totalComputers = computers.length;
  const workingComputers = computers.filter(
    (c) => c.status === 'working' || c.status === 'repaired'
  ).length;
  const defectiveComputers = computers.filter((c) => c.status === 'defective').length;
  const underMaintenanceComputers = computers.filter((c) => c.status === 'under_maintenance').length;
  const staffComputers = computers.filter((c) => c.computer_type === 'staff_computer').length;

  const studentComputers = computers.filter((c) => c.computer_type === 'student_computer');
  const workingStudentComputers = studentComputers.filter(
    (c) => c.status === 'working' || c.status === 'repaired'
  ).length;
  const defectiveStudentComputers = studentComputers.filter(
    (c) => c.status === 'defective' || c.status === 'under_maintenance'
  ).length;

  return {
    totalComputers,
    workingComputers,
    defectiveComputers,
    underMaintenanceComputers,
    staffComputers,
    workingStudentComputers,
    defectiveStudentComputers,
  };
}

/**
 * Strictly separates student-use computers (working vs defective/maintenance) from staff computers.
 */
export function categorizePcComputers<T extends PcComputerLike>(computers: T[]): {
  workingStudent: T[];
  defectiveOrMaintenanceStudent: T[];
  staffComputers: T[];
} {
  const workingStudent: T[] = [];
  const defectiveOrMaintenanceStudent: T[] = [];
  const staffComputers: T[] = [];

  for (const pc of computers) {
    if (pc.computer_type === 'staff_computer') {
      staffComputers.push(pc);
    } else if (pc.status === 'defective' || pc.status === 'under_maintenance') {
      defectiveOrMaintenanceStudent.push(pc);
    } else {
      workingStudent.push(pc);
    }
  }

  return { workingStudent, defectiveOrMaintenanceStudent, staffComputers };
}

/**
 * Enforces strict PC Lab operational responsibility separation:
 * - Public users & College Admin CANNOT view or manage individual PC computers,
 *   defect logs, maintenance history, or workstation QR records.
 * - Only an active Lab Assistant explicitly assigned to that active PC Lab may
 *   view/add/edit computers, report defects, update repairs, manage staff workstations,
 *   or generate/print PC QR tags.
 */
export function canViewPcLabComputers(
  user?: { id?: string; role?: string; status?: string; assigned_lab_ids?: string[] } | null,
  lab?: { id?: string; lab_type?: string; status?: string; assigned_assistant_id?: string | null } | null
): boolean {
  if (!user) return false;
  if (user.status === 'suspended') return false;
  if (user.role !== 'lab_assistant') return false;
  if (!lab || !lab.id) {
    return Boolean(user.assigned_lab_ids && user.assigned_lab_ids.length > 0);
  }
  if (lab.lab_type !== 'pc_lab') return false;
  if (lab.status === 'inactive') return false;
  return Boolean(
    user.assigned_lab_ids?.includes(lab.id) ||
      (user.id && lab.assigned_assistant_id && lab.assigned_assistant_id === user.id)
  );
}

export function canManagePcLabComputers(
  user?: { id?: string; role?: string; status?: string; assigned_lab_ids?: string[] } | null,
  lab?: { id?: string; lab_type?: string; status?: string; assigned_assistant_id?: string | null } | null
): boolean {
  if (!lab || !lab.id) return false;
  return canViewPcLabComputers(user, lab);
}

/**
 * Returns the list of course IDs explicitly mapped to an experiment.
 */
export function getMappedCourseIdsForExperiment<
  TExperiment extends { id: string; course_ids?: string[] },
  TExpCourse extends { experiment_id: string; course_id: string }
>(experiment: TExperiment, expCourses: TExpCourse[]): string[] {
  const ids = new Set<string>();
  for (const ec of expCourses) {
    if (ec.experiment_id === experiment.id) ids.add(ec.course_id);
  }
  if (experiment.course_ids) {
    for (const cid of experiment.course_ids) {
      if (cid) ids.add(cid);
    }
  }
  return Array.from(ids);
}

/**
 * Resolves courses explicitly configured by College Admin for a specific MVIT laboratory.
 * Never silently falls back to returning all courses when no lab-course mapping exists.
 */
export function getCoursesForLab<
  TCourse extends { id: string; is_active?: boolean; display_order?: number },
  TLabCourse extends { lab_id: string; course_id: string }
>(labId: string, courses: TCourse[], labCourses: TLabCourse[]): TCourse[] {
  const activeCourses = courses.filter((c) => c.is_active !== false);
  const mappedCourseIds = new Set(
    labCourses.filter((lc) => lc.lab_id === labId).map((lc) => lc.course_id)
  );
  if (mappedCourseIds.size === 0) return [];

  const matched = activeCourses.filter((c) => mappedCourseIds.has(c.id));
  return [...matched].sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99));
}

/**
 * Resolves practical subjects belonging to a selected (Lab, Course) pair.
 * Requires explicit course match (subject.course_id === courseId or at least one published
 * experiment inside the subject explicitly mapped to courseId).
 */
export function getSubjectsForLabAndCourse<
  TSubject extends { id: string; lab_id?: string; course_id?: string; is_active?: boolean },
  TExperiment extends { id: string; subject_id: string; is_published?: boolean; course_ids?: string[] },
  TExpCourse extends { experiment_id: string; course_id: string }
>(
  labId: string,
  courseId: string | null,
  subjects: TSubject[],
  experiments: TExperiment[],
  expCourses: TExpCourse[]
): TSubject[] {
  const labSubjects = subjects.filter((s) => s.is_active !== false && s.lab_id === labId);
  if (!courseId) return labSubjects;

  const expToCourses = new Map<string, Set<string>>();
  for (const ec of expCourses) {
    if (!expToCourses.has(ec.experiment_id)) expToCourses.set(ec.experiment_id, new Set());
    expToCourses.get(ec.experiment_id)!.add(ec.course_id);
  }
  for (const exp of experiments) {
    if (exp.course_ids && exp.course_ids.length > 0) {
      if (!expToCourses.has(exp.id)) expToCourses.set(exp.id, new Set());
      exp.course_ids.forEach((cid) => expToCourses.get(exp.id)!.add(cid));
    }
  }

  return labSubjects.filter((subj) => {
    if (subj.course_id) {
      return subj.course_id === courseId;
    }
    const subjExps = experiments.filter((e) => e.subject_id === subj.id && e.is_published !== false);
    if (subjExps.length === 0) return false;
    return subjExps.some((e) => {
      const mapped = expToCourses.get(e.id);
      return Boolean(mapped && mapped.has(courseId));
    });
  });
}

/**
 * Resolves published experiments strictly mapped to a selected (Course, Subject) combination.
 * Unmapped experiments (zero course mappings) are NOT shown under a course-specific filter.
 */
export function getExperimentsForLabCourseSubject<
  TExperiment extends {
    id: string;
    subject_id: string;
    exp_number: number;
    is_published?: boolean;
    course_ids?: string[];
  },
  TExpCourse extends { experiment_id: string; course_id: string }
>(
  courseId: string | null,
  subjectId: string | null,
  experiments: TExperiment[],
  expCourses: TExpCourse[]
): TExperiment[] {
  if (!subjectId) return [];
  const expToCourses = new Map<string, Set<string>>();
  for (const ec of expCourses) {
    if (!expToCourses.has(ec.experiment_id)) expToCourses.set(ec.experiment_id, new Set());
    expToCourses.get(ec.experiment_id)!.add(ec.course_id);
  }
  for (const exp of experiments) {
    if (exp.course_ids && exp.course_ids.length > 0) {
      if (!expToCourses.has(exp.id)) expToCourses.set(exp.id, new Set());
      exp.course_ids.forEach((cid) => expToCourses.get(exp.id)!.add(cid));
    }
  }

  return experiments
    .filter((e) => {
      if (e.subject_id !== subjectId || e.is_published === false) return false;
      if (!courseId) return true;
      const mapped = expToCourses.get(e.id);
      return Boolean(mapped && mapped.has(courseId));
    })
    .sort((a, b) => a.exp_number - b.exp_number);
}

// ============================================================================
// ACADEMIC YEAR MAPPING & YEAR-WISE LEARNING HELPERS
// ============================================================================

export interface AcademicYearConfig {
  year: number;
  label: string;
  semesterLabel: string;
  semesters: number[];
}

export interface AcademicYearStats extends AcademicYearConfig {
  subjectCount: number;
  experimentCount: number;
  manualCount: number;
}

/**
 * Computes academic year (1..4+) from 1-based semester index.
 * Standard 4-year B.Tech programmes: Sem 1-2 -> Year 1, Sem 3-4 -> Year 2,
 * Sem 5-6 -> Year 3, Sem 7-8 -> Year 4.
 * Supports optional course-specific semestersPerYear configuration cleanly.
 */
export function getYearFromSemester(semester: number, semestersPerYear = 2): number {
  const safeSem = Number.isFinite(semester) && semester >= 1 ? Math.floor(semester) : 1;
  const safeDiv = Number.isFinite(semestersPerYear) && semestersPerYear >= 1 ? Math.floor(semestersPerYear) : 2;
  return Math.ceil(safeSem / safeDiv);
}

export function formatAcademicYearLabel(year: number): string {
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  return `${year}th Year`;
}

/**
 * Generates academic year configurations for a course (defaults to 4 years, 2 semesters/year).
 */
export function getAcademicYearConfigs(course?: {
  academic_years_count?: number;
  semesters_per_year?: number;
} | null): AcademicYearConfig[] {
  const yearsCount = course?.academic_years_count && course.academic_years_count >= 1
    ? Math.floor(course.academic_years_count)
    : 4;
  const semsPerYear = course?.semesters_per_year && course.semesters_per_year >= 1
    ? Math.floor(course.semesters_per_year)
    : 2;

  const configs: AcademicYearConfig[] = [];
  for (let year = 1; year <= yearsCount; year++) {
    const startSem = (year - 1) * semsPerYear + 1;
    const semesters: number[] = [];
    for (let s = 0; s < semsPerYear; s++) {
      semesters.push(startSem + s);
    }
    const semesterLabel =
      semesters.length === 2
        ? `Semesters ${semesters[0]} & ${semesters[1]}`
        : semesters.length === 1
        ? `Semester ${semesters[0]}`
        : `Semesters ${semesters[0]}–${semesters[semesters.length - 1]}`;

    configs.push({
      year,
      label: formatAcademicYearLabel(year),
      semesterLabel,
      semesters,
    });
  }
  return configs;
}

/**
 * Filters practical subjects strictly by Laboratory + Course + Academic Year + Active status.
 */
export function getSubjectsForLabCourseAndYear<
  TSubject extends {
    id: string;
    lab_id?: string;
    course_id?: string;
    semester: number;
    is_active?: boolean;
  },
  TExperiment extends { id: string; subject_id: string; is_published?: boolean; course_ids?: string[] },
  TExpCourse extends { experiment_id: string; course_id: string }
>(
  labId: string,
  courseId: string | null,
  year: number | null,
  subjects: TSubject[],
  experiments: TExperiment[],
  expCourses: TExpCourse[],
  course?: { semesters_per_year?: number } | null
): TSubject[] {
  const courseSubjects = getSubjectsForLabAndCourse(labId, courseId, subjects, experiments, expCourses);
  if (!year) return courseSubjects;

  const semsPerYear = course?.semesters_per_year ?? 2;
  return courseSubjects.filter((subj) => getYearFromSemester(subj.semester, semsPerYear) === year);
}

/**
 * Dynamically calculates Practical Subjects, Experiments, and Available Manuals counts per academic year.
 * Never fabricates records if a year has 0 configured resources.
 */
export function getAcademicYearStats<
  TSubject extends {
    id: string;
    lab_id?: string;
    course_id?: string;
    semester: number;
    is_active?: boolean;
    syllabus_pdf_url?: string;
  },
  TExperiment extends {
    id: string;
    subject_id: string;
    exp_number: number;
    is_published?: boolean;
    course_ids?: string[];
    manual_pdf_id?: string;
    manual_pdf_url?: string;
  },
  TExpCourse extends { experiment_id: string; course_id: string },
  TDoc extends {
    id: string;
    subject_id?: string;
    experiment_id?: string;
    type: string;
    is_published?: boolean;
  }
>(
  labId: string,
  courseId: string | null,
  subjects: TSubject[],
  experiments: TExperiment[],
  expCourses: TExpCourse[],
  documents: TDoc[],
  course?: { academic_years_count?: number; semesters_per_year?: number } | null
): AcademicYearStats[] {
  const yearConfigs = getAcademicYearConfigs(course);
  const publishedManualExpIds = new Set(
    documents
      .filter((d) => d.type === 'experiment_manual' && d.is_published !== false && d.experiment_id)
      .map((d) => d.experiment_id!)
  );

  return yearConfigs.map((cfg) => {
    const yearSubjects = getSubjectsForLabCourseAndYear(
      labId,
      courseId,
      cfg.year,
      subjects,
      experiments,
      expCourses,
      course
    );

    let experimentCount = 0;
    let manualCount = 0;

    for (const subj of yearSubjects) {
      const subjExps = getExperimentsForLabCourseSubject(courseId, subj.id, experiments, expCourses);
      experimentCount += subjExps.length;
      for (const exp of subjExps) {
        if (Boolean(exp.manual_pdf_url) || Boolean(exp.manual_pdf_id) || publishedManualExpIds.has(exp.id)) {
          manualCount += 1;
        }
      }
    }

    return {
      ...cfg,
      subjectCount: yearSubjects.length,
      experimentCount,
      manualCount,
    };
  });
}

const BUILTIN_SIMULATOR_TYPES = new Set(['pn_junction', 'pendulum', 'calipers', 'ph_meter']);

export function detectSimulationProviderFromUrl(url: string | null | undefined):
  | 'virtual_labs'
  | 'phet'
  | 'circuitverse'
  | 'benchtwin'
  | 'custom'
  | 'none' {
  if (!url || !url.trim()) return 'none';
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    if (host === 'vlabs.ac.in' || host.endsWith('.vlabs.ac.in') || host === 'vlab.co.in' || host.endsWith('.vlab.co.in')) {
      return 'virtual_labs';
    }
    if (host === 'phet.colorado.edu') return 'phet';
    if (host === 'circuitverse.org' || host.endsWith('.circuitverse.org')) return 'circuitverse';
    if (host === 'benchtwin.com' || host.endsWith('.benchtwin.com')) return 'benchtwin';
    return 'custom';
  } catch {
    return 'none';
  }
}

export function getSimulationProviderLabel(provider: string): string {
  switch (provider) {
    case 'built_in':
      return 'LABVERSE Interactive Rig';
    case 'virtual_labs':
      return 'IIT Virtual Labs';
    case 'phet':
      return 'PhET Interactive Simulations';
    case 'circuitverse':
      return 'CircuitVerse Digital Simulator';
    case 'benchtwin':
      return 'BenchTwin Hardware Studio';
    case 'custom':
      return 'External Virtual Simulator';
    default:
      return 'No Simulation';
  }
}

export interface ResolvedExperimentSimulation {
  isAvailable: boolean;
  hasBuiltin: boolean;
  builtInSimulatorId: 'pn_junction' | 'pendulum' | 'calipers' | 'ph_meter' | null;
  hasExternal: boolean;
  externalUrl: string | null;
  canEmbedExternal: boolean;
  provider: string;
  providerLabel: string;
  simulationType: 'built_in' | 'external' | 'hybrid' | 'none';
  note: string;
}

/**
 * Resolves built-in and external simulation behavior for an experiment.
 * Prioritizes built-in interactive rigs while truthfully checking whether an external
 * destination supports inline iframe embedding vs external new-tab launch.
 */
export function resolveExperimentSimulation(exp?: {
  simulator_type?: string | null;
  built_in_simulator_id?: string | null;
  bench_twin_url?: string | null;
  simulation_url?: string | null;
  bench_twin_mode?: string | null;
  simulation_provider?: string | null;
  simulation_type?: string | null;
  simulation_note?: string | null;
} | null): ResolvedExperimentSimulation {
  if (!exp) {
    return {
      isAvailable: false,
      hasBuiltin: false,
      builtInSimulatorId: null,
      hasExternal: false,
      externalUrl: null,
      canEmbedExternal: false,
      provider: 'none',
      providerLabel: 'No Simulation',
      simulationType: 'none',
      note: 'No simulator configured.',
    };
  }

  const rawBuiltin = exp.built_in_simulator_id || exp.simulator_type || null;
  const builtInSimulatorId =
    rawBuiltin && BUILTIN_SIMULATOR_TYPES.has(rawBuiltin)
      ? (rawBuiltin as 'pn_junction' | 'pendulum' | 'calipers' | 'ph_meter')
      : null;
  const hasBuiltin = Boolean(builtInSimulatorId);

  const rawUrl = (exp.simulation_url || exp.bench_twin_url || '').trim();
  const safeCheck = checkBenchTwinEmbedSupport(rawUrl);
  const hasExternal = safeCheck.isSafeUrl && Boolean(safeCheck.normalizedUrl);
  const externalUrl = hasExternal ? safeCheck.normalizedUrl : null;

  const detectedProvider = hasExternal ? detectSimulationProviderFromUrl(externalUrl) : 'none';
  const provider =
    exp.simulation_provider && exp.simulation_provider !== 'none'
      ? exp.simulation_provider
      : hasExternal
      ? detectedProvider
      : hasBuiltin
      ? 'built_in'
      : 'none';

  // Determine whether external host permits iframe embedding without XFO/CSP refusal
  let hostAllowsIframe = false;
  if (externalUrl) {
    try {
      const parsed = new URL(externalUrl);
      const host = parsed.hostname.toLowerCase();
      if (host === 'benchtwin.com' || host.endsWith('.benchtwin.com')) {
        // BenchTwin sets X-Frame-Options: SAMEORIGIN
        hostAllowsIframe = false;
      } else if (host === 'circuitverse.org' || host.endsWith('.circuitverse.org')) {
        // CircuitVerse sets X-Frame-Options: SAMEORIGIN
        hostAllowsIframe = false;
      } else if (host === 'phet.colorado.edu' && parsed.pathname.startsWith('/en/simulations/')) {
        // PhET simulation landing pages enforce XFO: SAMEORIGIN / CSP frame-ancestors
        hostAllowsIframe = false;
      } else {
        hostAllowsIframe = safeCheck.canEmbed;
      }
    } catch {
      hostAllowsIframe = false;
    }
  }

  const canEmbedExternal =
    hasExternal && hostAllowsIframe && exp.bench_twin_mode === 'embedded';

  const simulationType: 'built_in' | 'external' | 'hybrid' | 'none' =
    hasBuiltin && hasExternal
      ? 'hybrid'
      : hasBuiltin
      ? 'built_in'
      : hasExternal
      ? 'external'
      : 'none';

  const providerLabel = getSimulationProviderLabel(
    hasExternal ? detectedProvider : provider
  );

  let note = exp.simulation_note || '';
  if (!note) {
    if (detectedProvider === 'benchtwin') {
      note =
        'BenchTwin opens externally in a new browser tab. Select or create an embedded hardware project inside BenchTwin.';
    } else if (detectedProvider === 'circuitverse') {
      note = 'CircuitVerse interactive digital logic workspace opens in a new browser tab.';
    } else if (detectedProvider === 'phet') {
      note = hasBuiltin
        ? 'PhET concept simulation opens in a new browser tab alongside the built-in LABVERSE rig above.'
        : 'PhET interactive simulation opens cleanly in a new browser tab.';
    } else if (detectedProvider === 'virtual_labs') {
      note = canEmbedExternal
        ? 'IIT Virtual Labs workbench supports inline preview as well as full-screen external launch.'
        : 'IIT Virtual Labs interactive experiment module.';
    } else if (hasBuiltin) {
      note = 'Built-in interactive LABVERSE virtual apparatus runs natively inside this workspace.';
    }
  }

  return {
    isAvailable: hasBuiltin || hasExternal,
    hasBuiltin,
    builtInSimulatorId,
    hasExternal,
    externalUrl,
    canEmbedExternal,
    provider,
    providerLabel,
    simulationType,
    note,
  };
}

export function isExperimentVideoAvailable(exp?: {
  youtube_url?: string;
  youtube_alt_url?: string;
  youtube_search_url?: string;
  youtube_video_id?: string | null;
} | null): boolean {
  if (!exp) return false;
  return classifyYouTubeResource(exp).mode !== 'unavailable';
}

export function isExperimentSimulationAvailable(exp?: {
  simulator_type?: string | null;
  built_in_simulator_id?: string | null;
  bench_twin_url?: string | null;
  simulation_url?: string | null;
} | null): boolean {
  if (!exp) return false;
  return resolveExperimentSimulation(exp).isAvailable;
}




