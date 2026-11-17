export type Role = 'college_admin' | 'lab_assistant';

export interface Institution {
  id: string;
  name: string;
  code: string;
  institution_code?: string;
  domain: string;
  contact_email?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  contact_person?: string;
  admin_name?: string;
  admin_email?: string;
  admin_designation?: string;
  status?: 'active' | 'inactive';
  active: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  institution_id: string;
  code: string;
  name: string;
  description: string;
  head_faculty_name: string;
  active_subjects_count: number;
}

export interface AcademicTerm {
  id: string;
  institution_id: string;
  name: string;
  code: string;
  is_current: boolean;
}

export interface Profile {
  id: string;
  institution_id: string;
  role: Role;
  name: string;
  email: string;
  avatar?: string;
  identifier: string; // Employee / Lab Technician ID
  department_id?: string;
  department_name?: string;
  status?: 'active' | 'suspended' | 'invited';
  invited_at?: string;
  assigned_lab_ids?: string[];
  created_at?: string;
}

export interface ProfileLabAssignment {
  id: string;
  institution_id: string;
  profile_id: string;
  lab_id: string;
  created_at: string;
}

export interface SubjectSyllabus {
  id: string;
  subject_id: string;
  unit_number: number;
  title: string;
  description: string;
  learning_outcomes: string[];
}

export type LabType = 'practical' | 'pc_lab';

export interface Course {
  id: string;
  institution_id: string;
  code: string;
  name: string;
  degree: string;
  description?: string;
  is_active: boolean;
  display_order: number;
  academic_years_count?: number;
  semesters_per_year?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LaboratoryCourse {
  id: string;
  institution_id: string;
  lab_id: string;
  course_id: string;
}

export interface ExperimentCourse {
  id: string;
  institution_id: string;
  experiment_id: string;
  course_id: string;
}

export interface ExperimentResource {
  id: string;
  institution_id: string;
  experiment_id: string;
  resource_type: 'manual_pdf' | 'youtube' | 'bench_twin';
  title: string;
  url: string;
  metadata?: Record<string, any>;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Lab {
  id: string;
  institution_id: string;
  department_id?: string;
  department_name?: string;
  lab_code: string;
  name: string;
  description?: string;
  building: string;
  room_number: string;
  location: string;
  capacity?: number;
  status: 'active' | 'inactive';
  lab_type?: LabType;
  is_public?: boolean;
  image_key?: string;
  course_ids?: string[];
  display_order: number;
  assigned_assistant_id?: string | null;
  assigned_assistant_name?: string | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PracticalSubject {
  id: string;
  institution_id: string;
  lab_id?: string;
  course_id?: string;
  department_id: string;
  department_name: string;
  term_id: string;
  code: string;
  name: string;
  credits: number;
  semester: number;
  faculty_in_charge?: string;
  lab_assistant_id?: string;
  lab_assistant_name?: string;
  description: string;
  schedule_info: string;
  location: string;
  is_active?: boolean;
  syllabus_pdf_id?: string;
  syllabus_pdf_url?: string;
  syllabus_pdf_name?: string;
  is_demo?: boolean;
  syllabus: SubjectSyllabus[];
}

export interface ExperimentComponent {
  name: string;
  quantity: string;
  spec: string;
}

export interface ExperimentEquipment {
  name: string;
  model: string;
  spec: string;
}

export interface ExperimentProcedureStep {
  step: number;
  title: string;
  instruction: string;
  precaution?: string;
}

export interface ObservationColumn {
  key: string;
  header: string;
  unit?: string;
}

export interface LabManualDocument {
  id: string;
  institution_id: string;
  lab_id?: string;
  subject_id?: string;
  subject_code?: string;
  experiment_id?: string;
  experiment_title?: string;
  type: 'syllabus' | 'experiment_manual' | 'safety_guideline';
  title: string;
  description: string;
  file_name: string;
  file_size: number;
  file_url: string;
  storage_path?: string;
  is_published: boolean;
  uploaded_by_id: string;
  uploaded_by_name: string;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
}

export type SimulationProvider =
  | 'built_in'
  | 'virtual_labs'
  | 'phet'
  | 'circuitverse'
  | 'benchtwin'
  | 'custom'
  | 'none';

export type SimulationType = 'built_in' | 'external' | 'hybrid' | 'none';

export type BuiltInSimulatorId = 'pn_junction' | 'pendulum' | 'calipers' | 'ph_meter';

export interface ResourceLinkCheckResult {
  url: string;
  reachable: boolean | null;
  status: number | null;
  embeddable: boolean;
  provider: string;
  title?: string;
  authorName?: string;
  note: string;
  checkedAt: string;
}

export interface Experiment {
  id: string;
  institution_id?: string;
  lab_id?: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  department_id: string;
  department_name: string;
  exp_number: number;
  title: string;
  slug: string;
  aim: string;
  theory: string;
  learning_objectives: string[];
  components_required: ExperimentComponent[];
  equipment_required: ExperimentEquipment[];
  diagram_url?: string;
  procedure: ExperimentProcedureStep[];
  observation_headers: ObservationColumn[];
  sample_observations?: Record<string, string | number>[];
  expected_result: string;
  precautions: string[];
  manual_content: string;
  manual_doc_name?: string;
  manual_pdf_id?: string;
  manual_pdf_url?: string;
  manual_pdf_name?: string;
  youtube_url: string;
  youtube_video_id: string | null;
  youtube_title?: string;
  youtube_alt_url?: string;
  youtube_search_url?: string;
  bench_twin_url: string;
  bench_twin_mode: 'embedded' | 'external';
  simulation_url?: string;
  simulation_provider?: SimulationProvider;
  simulation_type?: SimulationType;
  built_in_simulator_id?: BuiltInSimulatorId | null;
  simulation_note?: string;
  resource_status?: 'verified' | 'needs_review' | 'unavailable';
  last_verified_at?: string;
  is_published: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  simulator_type?: BuiltInSimulatorId | 'custom';
  course_ids?: string[];
  is_demo?: boolean;
}

export type InventoryCategory = 'electronic' | 'glassware' | 'instrument' | 'chemical' | 'mechanical' | 'hardware';
export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryItem {
  id: string;
  institution_id: string;
  lab_id?: string;
  laboratory_name?: string;
  laboratory_code?: string;
  department_id?: string;
  department_name?: string;
  item_code: string;
  name: string;
  category: InventoryCategory;
  location: string;
  quantity_available: number;
  quantity_total: number;
  unit: string;
  min_safety_threshold: number;
  status: InventoryStatus;
  last_inspected?: string;
  mapped_experiment_ids?: string[];
}

export interface PublicQrInventoryItem {
  id: string;
  institution_id: string;
  lab_id?: string;
  laboratory_name?: string;
  laboratory_code?: string;
  department_id?: string;
  department_name?: string;
  item_code: string;
  name: string;
  category: InventoryCategory;
  location: string;
  unit: string;
  quantity_available: number;
  quantity_total: number;
  availability_status: InventoryStatus;
}

export type TransactionType = 'issue' | 'return' | 'damage_writeoff' | 'restock';

export interface InventoryTransaction {
  id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  transaction_type: TransactionType;
  quantity: number;
  borrower_id?: string;
  borrower_name?: string;
  experiment_title?: string;
  handled_by_name: string;
  timestamp: string;
  remarks: string;
}

export interface AuditLog {
  id: string;
  institution_id: string;
  user_name: string;
  user_role: Role;
  action: string;
  resource_type: string;
  resource_id?: string;
  timestamp: string;
  details: string;
}

export interface NotificationItem {
  id: string;
  institution_id?: string;
  recipient_role?: Role | 'all';
  recipient_id?: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string;
  read: boolean;
}

export type PcComputerType = 'student_computer' | 'staff_computer';
export type PcComputerStatus = 'working' | 'defective' | 'under_maintenance' | 'repaired';

export interface PcLabComputer {
  id: string;
  institution_id: string;
  lab_id: string;
  computer_code: string;
  hostname: string;
  computer_type: PcComputerType;
  processor?: string;
  ram?: string;
  storage?: string;
  operating_system?: string;
  location: string;
  assigned_staff_name?: string;
  assigned_department?: string;
  specs_summary?: string;
  status: PcComputerStatus;
  maintenance_status?: string;
  last_updated: string;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PcLabMaintenanceRecord {
  id: string;
  institution_id: string;
  lab_id: string;
  computer_id: string;
  reported_issue: string;
  defect_description?: string;
  date_reported: string;
  repair_status: PcComputerStatus;
  maintenance_remarks?: string;
  resolution_date?: string | null;
  reported_by?: string;
  updated_by?: string;
  is_demo?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PcLabSummaryStats {
  totalComputers: number;
  workingComputers: number;
  defectiveComputers: number;
  underMaintenanceComputers: number;
  staffComputers: number;
  workingStudentComputers: number;
  defectiveStudentComputers: number;
}

