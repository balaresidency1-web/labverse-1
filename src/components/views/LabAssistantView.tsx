import React, { useState, useEffect, useMemo } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import {
  InventoryItem,
  InventoryCategory,
  Experiment,
  LabManualDocument,
  SubjectSyllabus,
  BuiltInSimulatorId,
  ResourceLinkCheckResult,
  SimulationProvider,
  SimulationType,
} from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { ActiveTab } from '../navigation/Sidebar';
import { LaboratorySelectionView } from '../laboratory/LaboratorySelectionView';
import { SubjectsListView } from './SubjectsListView';
import { ExperimentEditorModal } from '../experiment/ExperimentEditorModal';
import { PcLabManagementView } from '../pclab/PcLabManagementView';
import { DocumentManagerModal } from '../common/DocumentManagerModal';
import { PdfViewerModal } from '../common/PdfViewerModal';
import { ItemQrDetailModal } from '../qr/ItemQrDetailModal';
import { QrScannerModal } from '../qr/QrScannerModal';
import { PrintQrModal } from '../qr/PrintQrModal';
import {
  validateYouTubeUrl,
  validateYouTubeSearchUrl,
  classifyYouTubeResource,
  checkBenchTwinEmbedSupport,
  detectSimulationProviderFromUrl,
  resolveExperimentSimulation,
  getMappedCourseIdsForExperiment,
} from '../../utils/labRules';
import { validatePdfFile } from '../../utils/pdfGenerator';
import { storePdfBlob } from '../../utils/indexedDbStorage';
import { downloadResolvedPdf, makeIdbUrl } from '../../utils/pdfSource';
import {
  Wrench,
  Plus,
  ArrowUpRight,
  AlertTriangle,
  QrCode,
  Search,
  History,
  AlertCircle,
  FileSpreadsheet,
  Camera,
  Printer,
  FlaskConical,
  CheckCircle2,
  Layers,
  BookOpen,
  FileText,
  Video,
  Laptop,
  Settings,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  ExternalLink,
  Save,
  ShieldAlert,
  KeyRound,
  Building2,
  Monitor,
  UserCheck,
  RefreshCw,
} from 'lucide-react';

type LabAssistantSection =
  | 'dashboard'
  | 'my_labs'
  | 'subjects'
  | 'experiments'
  | 'syllabus'
  | 'manuals'
  | 'youtube'
  | 'bench_twin'
  | 'inventory'
  | 'pc_working'
  | 'pc_defective'
  | 'pc_staff'
  | 'qr_codes'
  | 'settings';

interface LabAssistantViewProps {
  initialSection?: LabAssistantSection;
  onSelectExperiment: (expId: string) => void;
  onSelectTab: (tab: ActiveTab) => void;
}

export const LabAssistantView: React.FC<LabAssistantViewProps> = ({
  initialSection = 'dashboard',
  onSelectExperiment,
  onSelectTab,
}) => {
  const {
    institution,
    isSupabaseActive,
    currentUser,
    currentRole,
    accessibleLabs,
    selectedLab,
    selectedLabId,
    departments,
    labSubjects,
    labExperiments,
    courses,
    experimentCourses,
    documents,
    labInventory,
    transactions,
    pcLabStats,
    saveSubjectSyllabus,
    addExperiment,
    updateExperiment,
    deleteExperiment,
    addOrUpdateDocument,
    deleteDocument,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    issueEquipment,
    returnEquipment,
    logDamageWriteOff,
    restockEquipment,
    sendAssistantPasswordReset,
    exportToCsv,
  } = useLabverse();

  const [section, setSection] = useState<LabAssistantSection>(initialSection);
  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    setTimeout(() => setBanner(null), 5000);
  };

  // Lab-scoped documents
  const labDocuments = useMemo(
    () =>
      selectedLabId
        ? documents.filter((d) => !d.lab_id || d.lab_id === selectedLabId)
        : documents,
    [documents, selectedLabId]
  );

  const lowStockItems = useMemo(
    () => labInventory.filter((i) => i.status === 'low_stock' || i.status === 'out_of_stock'),
    [labInventory]
  );

  // Shared PDF & Document Manager modals
  const [previewDoc, setPreviewDoc] = useState<LabManualDocument | null>(null);
  const [isDocManagerOpen, setIsDocManagerOpen] = useState(false);
  const [docManagerPreset, setDocManagerPreset] = useState<{
    subjectId?: string;
    experimentId?: string;
    type?: 'syllabus' | 'experiment_manual';
  }>({});

  // Experiment Editor Modal
  const [isExpEditorOpen, setIsExpEditorOpen] = useState(false);
  const [editingExperiment, setEditingExperiment] = useState<Experiment | null>(null);
  const [expSearch, setExpSearch] = useState('');
  const [confirmDeleteExpId, setConfirmDeleteExpId] = useState<string | null>(null);

  // Syllabus Management State
  const [syllabusSubjectId, setSyllabusSubjectId] = useState<string>(labSubjects[0]?.id || '');
  useEffect(() => {
    if (labSubjects.length > 0 && !labSubjects.some((s) => s.id === syllabusSubjectId)) {
      setSyllabusSubjectId(labSubjects[0].id);
    }
  }, [labSubjects, syllabusSubjectId]);
  const syllabusSubject = labSubjects.find((s) => s.id === syllabusSubjectId) || null;
  const [syllabusDraftUnits, setSyllabusDraftUnits] = useState<SubjectSyllabus[]>([]);
  useEffect(() => {
    setSyllabusDraftUnits(
      syllabusSubject?.syllabus ? JSON.parse(JSON.stringify(syllabusSubject.syllabus)) : []
    );
  }, [syllabusSubject?.id, syllabusSubject?.syllabus]);
  const [isUploadingSyllabusPdf, setIsUploadingSyllabusPdf] = useState(false);

  // YouTube & Bench Twin inline editors keyed by experiment id
  const [ytEdits, setYtEdits] = useState<
    Record<string, { url: string; title: string; altUrl: string; searchUrl: string }>
  >({});
  const [btEdits, setBtEdits] = useState<
    Record<
      string,
      {
        simulator_type: 'pn_junction' | 'pendulum' | 'calipers' | 'ph_meter' | 'custom';
        url: string;
        mode: 'embedded' | 'external';
        provider: SimulationProvider;
        sim_type: SimulationType;
        note: string;
      }
    >
  >({});
  const [ytTestStatus, setYtTestStatus] = useState<
    Record<string, { loading?: boolean; result?: ResourceLinkCheckResult }>
  >({});
  const [simTestStatus, setSimTestStatus] = useState<
    Record<string, { loading?: boolean; result?: ResourceLinkCheckResult }>
  >({});

  useEffect(() => {
    const nextYt: Record<string, { url: string; title: string; altUrl: string; searchUrl: string }> = {};
    const nextBt: Record<
      string,
      {
        simulator_type: 'pn_junction' | 'pendulum' | 'calipers' | 'ph_meter' | 'custom';
        url: string;
        mode: 'embedded' | 'external';
        provider: SimulationProvider;
        sim_type: SimulationType;
        note: string;
      }
    > = {};
    labExperiments.forEach((e) => {
      nextYt[e.id] = {
        url: e.youtube_url || '',
        title: e.youtube_title || '',
        altUrl: e.youtube_alt_url || '',
        searchUrl: e.youtube_search_url || '',
      };
      const simUrl = e.simulation_url || e.bench_twin_url || '';
      const simType = e.simulator_type || 'custom';
      nextBt[e.id] = {
        simulator_type: simType,
        url: simUrl,
        mode: e.bench_twin_mode || 'external',
        provider:
          e.simulation_provider ||
          (simUrl ? detectSimulationProviderFromUrl(simUrl) : simType !== 'custom' ? 'built_in' : 'none'),
        sim_type:
          e.simulation_type ||
          (simType !== 'custom' && simUrl
            ? 'hybrid'
            : simType !== 'custom'
            ? 'built_in'
            : simUrl
            ? 'external'
            : 'none'),
        note: e.simulation_note || '',
      };
    });
    setYtEdits(nextYt);
    setBtEdits(nextBt);
  }, [labExperiments]);

  const handleValidateResourceLink = async (
    kind: 'youtube' | 'simulation',
    expId: string,
    targetUrl: string
  ) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    if (kind === 'youtube') {
      setYtTestStatus((prev) => ({ ...prev, [expId]: { loading: true } }));
    } else {
      setSimTestStatus((prev) => ({ ...prev, [expId]: { loading: true } }));
    }
    try {
      const response = await fetch('/api/resources/validate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const result: ResourceLinkCheckResult = await response.json();
      if (kind === 'youtube') {
        setYtTestStatus((prev) => ({ ...prev, [expId]: { loading: false, result } }));
        if (result.reachable && result.title) {
          setYtEdits((prev) => {
            const cur = prev[expId];
            if (!cur || cur.title.trim()) return prev;
            return { ...prev, [expId]: { ...cur, title: result.title! } };
          });
        }
      } else {
        setSimTestStatus((prev) => ({ ...prev, [expId]: { loading: false, result } }));
        if (!result.embeddable) {
          setBtEdits((prev) => {
            const cur = prev[expId];
            if (!cur || cur.mode !== 'embedded') return prev;
            return { ...prev, [expId]: { ...cur, mode: 'external' } };
          });
        }
      }
    } catch {
      const fallback: ResourceLinkCheckResult = {
        url: trimmed,
        reachable: false,
        status: null,
        embeddable: false,
        provider: 'error',
        note: 'Network error probing resource link.',
        checkedAt: new Date().toISOString(),
      };
      if (kind === 'youtube') {
        setYtTestStatus((prev) => ({ ...prev, [expId]: { loading: false, result: fallback } }));
      } else {
        setSimTestStatus((prev) => ({ ...prev, [expId]: { loading: false, result: fallback } }));
      }
    }
  };

  // Inventory & QR State
  const [inventorySubTab, setInventorySubTab] = useState<'stock' | 'mapping' | 'transactions'>('stock');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [invSearchQuery, setInvSearchQuery] = useState('');
  const [txTypeFilter, setTxTypeFilter] = useState<
    'all' | 'issue' | 'return' | 'damage_writeoff' | 'restock'
  >('all');

  const [selectedItemId, setSelectedItemId] = useState<string>(labInventory[0]?.id || '');
  useEffect(() => {
    if (labInventory.length > 0 && !labInventory.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(labInventory[0].id);
    }
  }, [labInventory, selectedItemId]);
  const selectedItem = labInventory.find((i) => i.id === selectedItemId) || null;

  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [editingInvItem, setEditingInvItem] = useState<InventoryItem | null>(null);
  const [confirmDeleteInvId, setConfirmDeleteInvId] = useState<string | null>(null);
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [qrModalItem, setQrModalItem] = useState<InventoryItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalItem, setPrintModalItem] = useState<InventoryItem | null>(null);

  // Issue Form
  const [issueQty, setIssueQty] = useState(1);
  const [issueBorrowerId, setIssueBorrowerId] = useState('');
  const [issueBorrowerName, setIssueBorrowerName] = useState('');
  const [issueExperiment, setIssueExperiment] = useState(labExperiments[0]?.title || '');
  const [issueRemarks, setIssueRemarks] = useState('');
  const [issueError, setIssueError] = useState<string | null>(null);

  // Return Form
  const [returnQty, setReturnQty] = useState(1);
  const [returnBorrowerName, setReturnBorrowerName] = useState('');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);

  // Damage & Restock Forms
  const [damageQty, setDamageQty] = useState(1);
  const [damageReason, setDamageReason] = useState('');
  const [damageError, setDamageError] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState(10);
  const [restockRemarks, setRestockRemarks] = useState('MVIT Central Store replenishment');
  const [restockError, setRestockError] = useState<string | null>(null);

  // Add/Edit Inventory Form
  const [invCode, setInvCode] = useState('');
  const [invName, setInvName] = useState('');
  const [invDeptId, setInvDeptId] = useState(departments[0]?.id || '');
  const [invCategory, setInvCategory] = useState<InventoryCategory>('instrument');
  const [invLocation, setInvLocation] = useState(selectedLab?.name || 'MVIT Lab Rack');
  const [invAvailable, setInvAvailable] = useState(10);
  const [invTotal, setInvTotal] = useState(10);
  const [invUnit, setInvUnit] = useState('pcs');
  const [invThreshold, setInvThreshold] = useState(3);
  const [invFormError, setInvFormError] = useState<string | null>(null);

  // No Assigned Labs Guard
  if (accessibleLabs.length === 0 && section !== 'settings') {
    return (
      <div className="max-w-xl mx-auto my-8 bg-white rounded-2xl border border-[#E7DDD0] shadow-sm p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#FDF4EC] text-[#A66A43] border border-[#E7C2A8] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="font-heading font-bold text-lg text-[#252521]">
          No Assigned MVIT Laboratories
        </h2>
        <p className="text-xs text-[#6E675F] leading-relaxed">
          Your Lab Assistant account (<strong>{currentUser?.email}</strong>) currently has no active
          MVIT laboratory assignments. Contact the MVIT College Admin to assign one or more
          laboratories to your account.
        </p>
      </div>
    );
  }

  // Syllabus Handlers
  const handleAddUnit = () => {
    if (!syllabusSubject) return;
    const nextNum =
      syllabusDraftUnits.length > 0
        ? Math.max(...syllabusDraftUnits.map((u) => u.unit_number)) + 1
        : 1;
    setSyllabusDraftUnits([
      ...syllabusDraftUnits,
      {
        id: `syl-${Date.now().toString(36)}`,
        subject_id: syllabusSubject.id,
        unit_number: nextNum,
        title: `Unit ${nextNum} — Laboratory Topic`,
        description: '',
        learning_outcomes: ['Perform experimental procedure accurately'],
      },
    ]);
  };

  const handleSaveSyllabusUnits = async () => {
    if (!syllabusSubject) return;
    const res = await saveSubjectSyllabus(syllabusSubject.id, syllabusDraftUnits);
    if (!res.success) {
      showBanner('error', res.error || 'Failed to save syllabus units.');
    } else {
      showBanner('success', `Saved ${syllabusDraftUnits.length} syllabus unit(s) for ${syllabusSubject.code}.`);
    }
  };

  const handleUploadSyllabusPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !syllabusSubject) return;
    const check = await validatePdfFile(file, 15);
    if (!check.isValid) {
      showBanner('error', check.error || 'Invalid PDF file.');
      return;
    }

    setIsUploadingSyllabusPdf(true);
    try {
      const idbKey = `syl-${syllabusSubject.id}`;
      let fileUrl = '';
      let storagePath: string | undefined;
      if (!isSupabaseActive) {
        const stored = await storePdfBlob(idbKey, file.name, file);
        URL.revokeObjectURL(stored.objectUrl);
        fileUrl = makeIdbUrl(idbKey);
        storagePath = fileUrl;
      }
      const res = await addOrUpdateDocument(
        {
          institution_id: institution.id,
          lab_id: syllabusSubject.lab_id || selectedLabId || undefined,
          subject_id: syllabusSubject.id,
          subject_code: syllabusSubject.code,
          type: 'syllabus',
          title: `${syllabusSubject.code} — Official Syllabus PDF`,
          description: `MVIT syllabus document for ${syllabusSubject.name}`,
          file_name: file.name,
          file_size: file.size,
          file_url: fileUrl,
          storage_path: storagePath,
          is_published: true,
          uploaded_by_id: currentUser?.id || 'staff-mvit',
          uploaded_by_name: currentUser?.name || 'MVIT Lab Assistant',
        },
        isSupabaseActive ? file : undefined,
        syllabusSubject.syllabus_pdf_id
      );
      if (!res.success) throw new Error(res.error || 'Failed to upload syllabus PDF.');
      showBanner('success', `Uploaded syllabus PDF "${file.name}" for ${syllabusSubject.code}.`);
    } catch (err: any) {
      showBanner('error', err.message || 'Syllabus upload failed.');
    } finally {
      setIsUploadingSyllabusPdf(false);
    }
  };

  // Inventory CRUD & Transaction Handlers
  const openAddInventoryModal = () => {
    setEditingInvItem(null);
    setInvCode('');
    setInvName('');
    setInvDeptId(selectedLab?.department_id || departments[0]?.id || '');
    setInvCategory('instrument');
    setInvLocation(selectedLab?.name || 'MVIT Lab');
    setInvAvailable(10);
    setInvTotal(10);
    setInvUnit('pcs');
    setInvThreshold(3);
    setInvFormError(null);
    setIsAddItemModalOpen(true);
  };

  const openEditInventoryModal = (item: InventoryItem) => {
    setEditingInvItem(item);
    setInvCode(item.item_code);
    setInvName(item.name);
    setInvDeptId(item.department_id || departments[0]?.id || '');
    setInvCategory(item.category);
    setInvLocation(item.location);
    setInvAvailable(item.quantity_available);
    setInvTotal(item.quantity_total);
    setInvUnit(item.unit);
    setInvThreshold(item.min_safety_threshold);
    setInvFormError(null);
    setIsAddItemModalOpen(true);
  };

  const handleSaveInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvFormError(null);
    const dept = departments.find((d) => d.id === invDeptId);

    if (invAvailable > invTotal) {
      setInvFormError('Available quantity cannot exceed total inventory quantity.');
      return;
    }

    if (editingInvItem) {
      const res = await updateInventoryItem(editingInvItem.id, {
        item_code: invCode.toUpperCase(),
        name: invName,
        department_id: invDeptId,
        department_name: dept?.name || editingInvItem.department_name,
        category: invCategory,
        location: invLocation,
        quantity_available: invAvailable,
        quantity_total: invTotal,
        unit: invUnit,
        min_safety_threshold: invThreshold,
      });
      if (!res.success) {
        setInvFormError(res.error || 'Failed to update equipment.');
        return;
      }
      showBanner('success', `Updated apparatus ${invCode.toUpperCase()}.`);
    } else {
      const res = await addInventoryItem({
        lab_id: selectedLabId || undefined,
        department_id: invDeptId,
        department_name: dept?.name || 'Science & Humanities',
        item_code: invCode.toUpperCase(),
        name: invName,
        category: invCategory,
        location: invLocation,
        quantity_available: invAvailable,
        quantity_total: invTotal,
        unit: invUnit,
        min_safety_threshold: invThreshold,
        last_inspected: new Date().toISOString().slice(0, 10),
      });
      if (!res.success) {
        setInvFormError(res.error || 'Failed to register equipment.');
        return;
      }
      showBanner('success', `Added apparatus ${invCode.toUpperCase()} to inventory.`);
    }
    setIsAddItemModalOpen(false);
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueError(null);
    const res = await issueEquipment(
      selectedItemId,
      issueQty,
      issueBorrowerId.trim(),
      issueBorrowerName.trim(),
      issueExperiment.trim(),
      issueRemarks.trim()
    );
    if (!res.success) {
      setIssueError(res.error || 'Failed to issue apparatus.');
      return;
    }
    setIsIssueModalOpen(false);
    setIssueRemarks('');
    showBanner('success', 'Apparatus issue recorded successfully.');
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError(null);
    const res = await returnEquipment(
      selectedItemId,
      returnQty,
      returnBorrowerName.trim() || 'Lab Batch',
      returnRemarks.trim()
    );
    if (!res.success) {
      setReturnError(res.error || 'Failed to record apparatus return.');
      return;
    }
    setIsReturnModalOpen(false);
    setReturnRemarks('');
    showBanner('success', 'Apparatus return logged and stock restored.');
  };

  const handleDamageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDamageError(null);
    const res = await logDamageWriteOff(selectedItemId, damageQty, damageReason);
    if (!res.success) {
      setDamageError(res.error || 'Failed to record damaged apparatus.');
      return;
    }
    setIsDamageModalOpen(false);
    setDamageReason('');
    showBanner('success', 'Damage write-off recorded with audit entry.');
  };

  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestockError(null);
    const res = await restockEquipment(selectedItemId, restockQty, restockRemarks);
    if (!res.success) {
      setRestockError(res.error || 'Failed to restock item.');
      return;
    }
    setIsRestockModalOpen(false);
    showBanner('success', 'Inventory restocked successfully.');
  };

  const filteredInventory = labInventory.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const q = invSearchQuery.toLowerCase();
    const matchesSearch =
      item.name.toLowerCase().includes(q) ||
      item.item_code.toLowerCase().includes(q) ||
      item.location.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const filteredExperiments = labExperiments.filter((exp) => {
    const q = expSearch.toLowerCase();
    return (
      exp.title.toLowerCase().includes(q) ||
      exp.subject_code.toLowerCase().includes(q) ||
      exp.aim.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            banner.type === 'success'
              ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span className="font-medium">{banner.text}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. DASHBOARD */}
      {/* ===================================================================== */}
      {section === 'dashboard' && selectedLab?.lab_type === 'pc_lab' && (
        <div className="space-y-6">
          <div className="bg-[#49372E] text-white rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#E7C2A8]">
                <Monitor className="w-3.5 h-3.5" />
                <span>MVIT PC Laboratory Infrastructure</span>
              </div>
              <h1 className="font-heading text-2xl font-bold text-white">
                {selectedLab.name}
              </h1>
              <p className="text-xs text-[#E7DDD0]">
                {selectedLab.lab_code} • {selectedLab.location} • Managed by {currentUser?.name}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {accessibleLabs.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSelectTab('my_labs')}
                  className="px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors cursor-pointer"
                >
                  Switch Assigned Lab
                </button>
              )}
              <button
                type="button"
                onClick={() => onSelectTab('pc_working')}
                className="px-3.5 py-2 text-xs font-semibold bg-[#A66A43] hover:bg-[#8E5835] text-white rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Monitor className="w-4 h-4" />
                Manage Computers
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              {
                label: 'Total Computers',
                value: pcLabStats.totalComputers,
                sub: 'Student + Staff Fleet',
                tab: 'pc_working' as ActiveTab,
              },
              {
                label: 'Working Computers',
                value: pcLabStats.workingComputers,
                sub: 'Operational systems',
                tab: 'pc_working' as ActiveTab,
              },
              {
                label: 'Defective Computers',
                value: pcLabStats.defectiveComputers,
                sub: 'Reported faults',
                tab: 'pc_defective' as ActiveTab,
              },
              {
                label: 'Under Maintenance',
                value: pcLabStats.underMaintenanceComputers,
                sub: 'In service queue',
                tab: 'pc_defective' as ActiveTab,
              },
              {
                label: 'Staff Computers',
                value: pcLabStats.staffComputers,
                sub: 'Separated faculty systems',
                tab: 'pc_staff' as ActiveTab,
              },
            ].map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                onClick={() => onSelectTab(kpi.tab)}
                className="bg-white p-5 rounded-2xl border border-[#E7DDD0] shadow-xs text-left hover:border-[#A66A43] transition-colors cursor-pointer"
              >
                <div className="text-xs font-medium text-[#6E675F]">{kpi.label}</div>
                <div className="font-heading text-2xl font-bold text-[#252521] mt-1 tabular-nums">
                  {kpi.value}
                </div>
                <div className="text-[11px] font-mono text-[#A66A43] mt-1">{kpi.sub}</div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                tab: 'pc_working' as ActiveTab,
                title: 'Working Computers',
                desc: 'Register student workstations, inspect hardware specs, OS, and locations.',
                icon: CheckCircle2,
              },
              {
                tab: 'pc_defective' as ActiveTab,
                title: 'Defective & Maintenance',
                desc: 'Report hardware faults, log maintenance remarks, and track repair resolutions.',
                icon: AlertTriangle,
              },
              {
                tab: 'pc_staff' as ActiveTab,
                title: 'Staff Computers',
                desc: 'Maintain faculty and staff machines separately from student lab workstations.',
                icon: UserCheck,
              },
              {
                tab: 'qr_codes' as ActiveTab,
                title: 'PC QR Code Labels',
                desc: 'Generate and print individual QR stickers for campus workstations.',
                icon: QrCode,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.tab}
                  type="button"
                  onClick={() => onSelectTab(card.tab)}
                  className="bg-white p-5 rounded-2xl border border-[#E7DDD0] hover:border-[#A66A43] text-left transition-all shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] text-[#49372E] border border-[#E7DDD0] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#A66A43]" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#6E675F] group-hover:text-[#A66A43]" />
                  </div>
                  <h3 className="font-heading font-bold text-sm text-[#252521] mt-3">{card.title}</h3>
                  <p className="text-xs text-[#6E675F] mt-1 leading-relaxed">{card.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {section === 'dashboard' && selectedLab?.lab_type !== 'pc_lab' && (
        <div className="space-y-6">
          <div className="bg-[#49372E] text-white rounded-2xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#E7C2A8]">
                <FlaskConical className="w-3.5 h-3.5" />
                <span>MVIT Lab Assistant Workbench</span>
              </div>
              <h1 className="font-heading text-2xl font-bold text-white">
                {selectedLab ? selectedLab.name : 'Assigned MVIT Laboratories'}
              </h1>
              <p className="text-xs text-[#E7DDD0]">
                {selectedLab
                  ? `${selectedLab.lab_code} • ${selectedLab.location} • ${selectedLab.department_name || 'MVIT'}`
                  : `Signed in as ${currentUser?.name} (${accessibleLabs.length} assigned laboratory)`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {accessibleLabs.length > 1 && (
                <button
                  type="button"
                  onClick={() => onSelectTab('my_labs')}
                  className="px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white rounded-xl transition-colors cursor-pointer"
                >
                  Switch Assigned Lab
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingExperiment(null);
                  setIsExpEditorOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-[#A66A43] hover:bg-[#8E5835] text-white rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                New Experiment
              </button>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Practical Subjects',
                value: labSubjects.length,
                sub: 'In assigned lab',
                tab: 'subjects' as ActiveTab,
              },
              {
                label: 'Experiments',
                value: labExperiments.length,
                sub: `${labExperiments.filter((e) => e.is_published).length} published publicly`,
                tab: 'experiments' as ActiveTab,
              },
              {
                label: 'Manuals & Syllabi',
                value: labDocuments.length,
                sub: 'PDF learning resources',
                tab: 'manuals' as ActiveTab,
              },
              {
                label: 'Inventory Apparatus',
                value: labInventory.length,
                sub: lowStockItems.length > 0 ? `${lowStockItems.length} low-stock alert` : 'All healthy',
                tab: 'inventory' as ActiveTab,
              },
            ].map((kpi) => (
              <button
                key={kpi.label}
                type="button"
                onClick={() => onSelectTab(kpi.tab)}
                className="bg-white p-5 rounded-2xl border border-[#E7DDD0] shadow-xs text-left hover:border-[#A66A43] transition-colors cursor-pointer"
              >
                <div className="text-xs font-medium text-[#6E675F]">{kpi.label}</div>
                <div className="font-heading text-2xl font-bold text-[#252521] mt-1">{kpi.value}</div>
                <div className="text-[11px] font-mono text-[#A66A43] mt-1">{kpi.sub}</div>
              </button>
            ))}
          </div>

          {/* Quick Operations */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                tab: 'syllabus' as ActiveTab,
                title: 'Syllabus Management',
                desc: 'Edit unit-wise outcomes and upload official MVIT syllabus PDFs.',
                icon: BookOpen,
              },
              {
                tab: 'manuals' as ActiveTab,
                title: 'Manual Management',
                desc: 'Upload, replace, and attach practical PDF manuals to experiments.',
                icon: FileText,
              },
              {
                tab: 'youtube' as ActiveTab,
                title: 'YouTube Resources',
                desc: 'Configure verified YouTube video demonstrations for experiments.',
                icon: Video,
              },
              {
                tab: 'bench_twin' as ActiveTab,
                title: 'Bench Twin Simulations',
                desc: 'Link built-in virtual apparatus rigs or external Bench Twin URLs.',
                icon: Laptop,
              },
              {
                tab: 'inventory' as ActiveTab,
                title: 'Inventory & Issue Desk',
                desc: 'Log equipment checkouts, returns, damage write-offs, and restocking.',
                icon: Wrench,
              },
              {
                tab: 'qr_codes' as ActiveTab,
                title: 'QR Code Management',
                desc: 'Scan apparatus asset tags and print A4 QR sticker sheets.',
                icon: QrCode,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.tab}
                  type="button"
                  onClick={() => onSelectTab(card.tab)}
                  className="bg-white p-5 rounded-2xl border border-[#E7DDD0] hover:border-[#A66A43] text-left transition-all shadow-xs group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6F0] text-[#49372E] border border-[#E7DDD0] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#A66A43]" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-[#6E675F] group-hover:text-[#A66A43]" />
                  </div>
                  <h3 className="font-heading font-bold text-sm text-[#252521] mt-3">{card.title}</h3>
                  <p className="text-xs text-[#6E675F] mt-1 leading-relaxed">{card.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Recent Transactions Snapshot */}
          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-xs p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-sm text-[#252521] flex items-center gap-2">
                <History className="w-4 h-4 text-[#A66A43]" />
                Recent Equipment Ledger Activity
              </h2>
              <button
                type="button"
                onClick={() => onSelectTab('inventory')}
                className="text-xs font-semibold text-[#A66A43] hover:text-[#49372E] cursor-pointer"
              >
                Open Full Inventory
              </button>
            </div>
            <div className="divide-y divide-[#F5F0E8] text-xs">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-mono font-bold text-[#49372E] mr-2 uppercase">
                      [{tx.transaction_type}]
                    </span>
                    <span className="font-semibold text-[#252521]">{tx.item_name}</span>
                    {tx.borrower_name && (
                      <span className="text-[#6E675F]"> — {tx.borrower_name}</span>
                    )}
                  </div>
                  <div className="font-mono text-[#6E675F]">
                    Qty {tx.quantity} • {new Date(tx.timestamp).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. MY ASSIGNED LABORATORIES */}
      {/* ===================================================================== */}
      {section === 'my_labs' && (
        <LaboratorySelectionView onLabSelected={() => onSelectTab('dashboard')} />
      )}

      {/* ===================================================================== */}
      {/* 3. PRACTICAL SUBJECTS */}
      {/* ===================================================================== */}
      {section === 'subjects' && (
        <SubjectsListView onSelectExperiment={onSelectExperiment} />
      )}

      {/* ===================================================================== */}
      {/* 4. EXPERIMENTS MANAGEMENT */}
      {/* ===================================================================== */}
      {section === 'experiments' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-xl text-[#252521]">
                Experiments{selectedLab ? ` — ${selectedLab.name}` : ''}
              </h1>
              <p className="text-xs text-[#6E675F] mt-0.5">
                Create, edit, publish, or preview experiments in your assigned MVIT laboratories.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingExperiment(null);
                setIsExpEditorOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Experiment
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl border border-[#E7DDD0] flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search experiments by title, subject code, or aim..."
                value={expSearch}
                onChange={(e) => setExpSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <span className="text-xs font-mono text-[#6E675F]">
              {filteredExperiments.length} Experiment(s)
            </span>
          </div>

          <div className="space-y-3">
            {filteredExperiments.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-[#E7DDD0] text-center text-xs text-[#6E675F]">
                No experiments match your filter in this laboratory.
              </div>
            ) : (
              filteredExperiments.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-white p-5 rounded-xl border border-[#E7DDD0] shadow-xs flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E7DDD0] text-[#49372E]">
                        {exp.subject_code} • Exp #{exp.exp_number}
                      </span>
                      <StatusBadge status={exp.is_published ? 'published' : 'draft'} size="sm" />
                      {exp.simulator_type && exp.simulator_type !== 'custom' && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FDF4EC] text-[#A66A43] border border-[#E7C2A8]">
                          Built-in Rig: {exp.simulator_type}
                        </span>
                      )}
                      {(() => {
                        const mappedIds = getMappedCourseIdsForExperiment(exp, experimentCourses);
                        const mappedCodes = mappedIds
                          .map((cid) => courses.find((c) => c.id === cid)?.code)
                          .filter(Boolean);
                        return mappedCodes.length > 0 ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]">
                            Courses: {mappedCodes.join(', ')}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                            Unmapped (Excluded from course filters)
                          </span>
                        );
                      })()}
                    </div>
                    <h3 className="font-heading font-bold text-sm text-[#252521]">{exp.title}</h3>
                    <p className="text-xs text-[#6E675F] line-clamp-2">{exp.aim}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectExperiment(exp.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] text-[#49372E] border border-[#D8CBB9] rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingExperiment(exp);
                        setIsExpEditorOpen(true);
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#FAF6F0] text-[#252521] border border-[#D8CBB9] rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await updateExperiment(exp.id, {
                          is_published: !exp.is_published,
                        });
                        if (!res.success) {
                          showBanner('error', res.error || 'Failed to update publish status.');
                        } else {
                          showBanner(
                            'success',
                            `${!exp.is_published ? 'Published' : 'Unpublished'} "${exp.title}".`
                          );
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#FAF6F0] text-[#252521] border border-[#D8CBB9] rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      {exp.is_published ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-[#6E675F]" />
                          Unpublish
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#2E6F4E]" />
                          Publish
                        </>
                      )}
                    </button>
                    {confirmDeleteExpId === exp.id ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await deleteExperiment(exp.id);
                          setConfirmDeleteExpId(null);
                          if (!res.success) {
                            showBanner('error', res.error || 'Failed to delete experiment.');
                          } else {
                            showBanner('success', `Deleted "${exp.title}".`);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#B91C1C] text-white rounded-lg cursor-pointer"
                      >
                        Confirm Delete
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteExpId(exp.id)}
                        className="p-1.5 text-[#B91C1C] hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer"
                        title="Delete Experiment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. SYLLABUS MANAGEMENT */}
      {/* ===================================================================== */}
      {section === 'syllabus' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-xl text-[#252521]">
                Syllabus Management
              </h1>
              <p className="text-xs text-[#6E675F] mt-0.5">
                Configure curriculum syllabus units, learning outcomes, and official MVIT Syllabus PDFs.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={syllabusSubjectId}
                onChange={(e) => setSyllabusSubjectId(e.target.value)}
                className="px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white font-semibold text-[#252521]"
              >
                {labSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!syllabusSubject ? (
            <div className="bg-white p-8 rounded-xl border border-[#E7DDD0] text-center text-xs text-[#6E675F]">
              Create a Practical Subject first to manage its unit syllabus.
            </div>
          ) : (
            <>
              {/* Official Syllabus PDF Card */}
              <div className="bg-white p-5 rounded-2xl border border-[#E7DDD0] shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-[#252521] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#A66A43]" />
                    <span>Official Syllabus PDF — {syllabusSubject.code}</span>
                  </div>
                  <p className="text-xs text-[#6E675F]">
                    {syllabusSubject.syllabus_pdf_name
                      ? `Attached File: ${syllabusSubject.syllabus_pdf_name}`
                      : 'No Syllabus PDF uploaded yet for this practical subject.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {syllabusSubject.syllabus_pdf_url && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc({
                          id: syllabusSubject.syllabus_pdf_id || `syl-${syllabusSubject.id}`,
                          institution_id: institution.id,
                          subject_id: syllabusSubject.id,
                          subject_code: syllabusSubject.code,
                          type: 'syllabus',
                          title: `${syllabusSubject.code} Official Syllabus`,
                          description: syllabusSubject.name,
                          file_name: syllabusSubject.syllabus_pdf_name || `${syllabusSubject.code}_Syllabus.pdf`,
                          file_size: 420000,
                          file_url: syllabusSubject.syllabus_pdf_url!,
                          is_published: true,
                          uploaded_by_id: currentUser?.id || '',
                          uploaded_by_name: currentUser?.name || 'MVIT Lab Assistant',
                          created_at: new Date().toISOString(),
                          updated_at: new Date().toISOString(),
                        })
                      }
                      className="px-3 py-1.5 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] text-[#49372E] border border-[#D8CBB9] rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview PDF
                    </button>
                  )}

                  <label className="px-3.5 py-1.5 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isUploadingSyllabusPdf
                        ? 'Uploading...'
                        : syllabusSubject.syllabus_pdf_url
                        ? 'Replace Syllabus PDF'
                        : 'Upload Syllabus PDF'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleUploadSyllabusPdf}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Unit-Wise Editor */}
              <div className="bg-white p-6 rounded-2xl border border-[#E7DDD0] shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-heading font-semibold text-base text-[#252521]">
                    Curriculum Units ({syllabusDraftUnits.length})
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddUnit}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] text-[#49372E] border border-[#D8CBB9] rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Unit
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSyllabusUnits}
                      className="px-4 py-1.5 text-xs font-semibold bg-[#2E6F4E] hover:bg-[#23583D] text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Syllabus
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {syllabusDraftUnits.map((unit, uIdx) => (
                    <div
                      key={unit.id}
                      className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                          <span className="px-2.5 py-1 rounded bg-[#49372E] text-white font-mono text-xs font-bold">
                            Unit {unit.unit_number}
                          </span>
                          <input
                            type="text"
                            value={unit.title}
                            onChange={(e) => {
                              const next = [...syllabusDraftUnits];
                              next[uIdx] = { ...next[uIdx], title: e.target.value };
                              setSyllabusDraftUnits(next);
                            }}
                            className="flex-1 px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white font-semibold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSyllabusDraftUnits(
                              syllabusDraftUnits
                                .filter((_, i) => i !== uIdx)
                                .map((u, i) => ({ ...u, unit_number: i + 1 }))
                            )
                          }
                          className="p-1.5 text-[#B91C1C] hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Remove Unit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <textarea
                        rows={2}
                        placeholder="Unit description & covered laboratory topics..."
                        value={unit.description}
                        onChange={(e) => {
                          const next = [...syllabusDraftUnits];
                          next[uIdx] = { ...next[uIdx], description: e.target.value };
                          setSyllabusDraftUnits(next);
                        }}
                        className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      />

                      <div>
                        <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                          Learning Outcomes (one per line)
                        </label>
                        <textarea
                          rows={2}
                          value={unit.learning_outcomes.join('\n')}
                          onChange={(e) => {
                            const next = [...syllabusDraftUnits];
                            next[uIdx] = {
                              ...next[uIdx],
                              learning_outcomes: e.target.value.split('\n'),
                            };
                            setSyllabusDraftUnits(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. MANUAL MANAGEMENT */}
      {/* ===================================================================== */}
      {section === 'manuals' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-xl text-[#252521]">
                Manual Management
              </h1>
              <p className="text-xs text-[#6E675F] mt-0.5">
                Upload, replace, preview, and map practical experiment PDF manuals for MVIT visitors.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDocManagerPreset({ type: 'experiment_manual' });
                setIsDocManagerOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload / Manage PDFs
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E7DDD0] bg-[#FAF6F0] flex items-center justify-between">
              <h2 className="font-heading font-semibold text-sm text-[#252521]">
                Published Practical PDF Documents ({labDocuments.length})
              </h2>
            </div>
            {labDocuments.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6E675F]">
                No PDF documents uploaded yet. Click &ldquo;Upload / Manage PDFs&rdquo; to add manuals.
              </div>
            ) : (
              <div className="divide-y divide-[#F5F0E8]">
                {labDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF6F0]"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FDF4EC] text-[#A66A43] border border-[#E7C2A8] font-bold">
                          {doc.type === 'syllabus' ? 'Syllabus PDF' : 'Experiment Manual'}
                        </span>
                        {doc.subject_code && (
                          <span className="text-xs font-mono font-semibold text-[#252521]">
                            {doc.subject_code}
                          </span>
                        )}
                      </div>
                      <div className="font-semibold text-xs text-[#252521]">{doc.title}</div>
                      <div className="text-[11px] font-mono text-[#6E675F]">
                        {doc.file_name} • {(doc.file_size / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] text-[#49372E] border border-[#D8CBB9] rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadResolvedPdf({
                            pdfUrl: doc.file_url,
                            storagePath: doc.storage_path,
                            docId: doc.id,
                            fileName: doc.file_name,
                            isSupabaseActive,
                          })
                        }
                        className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-[#FAF6F0] text-[#252521] border border-[#D8CBB9] rounded-lg cursor-pointer"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await deleteDocument(doc.id);
                          if (!res.success) {
                            showBanner('error', res.error || 'Failed to delete document.');
                          } else {
                            showBanner('success', `Removed "${doc.title}".`);
                          }
                        }}
                        className="p-1.5 text-[#B91C1C] hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. YOUTUBE RESOURCES */}
      {/* ===================================================================== */}
      {section === 'youtube' && (
        <div className="space-y-6">
          <div>
            <h1 className="font-heading font-bold text-xl text-[#252521]">
              YouTube Demonstration Resources
            </h1>
            <p className="text-xs text-[#6E675F] mt-0.5">
              Attach, validate via oEmbed, or configure curated demonstration searches for experiments in{' '}
              {selectedLab?.name || 'your laboratory'}.
            </p>
          </div>

          <div className="space-y-4">
            {labExperiments.map((exp) => {
              const draft = ytEdits[exp.id] || {
                url: exp.youtube_url || '',
                title: exp.youtube_title || '',
                altUrl: exp.youtube_alt_url || '',
                searchUrl: exp.youtube_search_url || '',
              };
              const check = validateYouTubeUrl(draft.url);
              const searchCheck = validateYouTubeSearchUrl(draft.searchUrl);
              const classified = classifyYouTubeResource({
                youtube_url: draft.url,
                youtube_alt_url: draft.altUrl,
                youtube_search_url: draft.searchUrl,
              });
              const probeState = ytTestStatus[exp.id];

              return (
                <div
                  key={exp.id}
                  className="bg-white p-5 rounded-2xl border border-[#E7DDD0] shadow-xs space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-[#A66A43] mr-2">
                        {exp.subject_code} • Exp #{exp.exp_number}
                      </span>
                      <span className="font-heading font-bold text-sm text-[#252521]">
                        {exp.title}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold ${
                          classified.mode === 'direct_video'
                            ? 'bg-[#EBF5EE] text-[#2E6F4E]'
                            : classified.mode === 'search_only'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {classified.mode === 'direct_video'
                          ? `Direct Video (${classified.videoId})`
                          : classified.mode === 'search_only'
                          ? 'Search Fallback Active'
                          : 'No Video / Search Configured'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectExperiment(exp.id)}
                        className="text-xs font-semibold text-[#A66A43] hover:text-[#49372E] inline-flex items-center gap-1 cursor-pointer"
                      >
                        Preview as Public User <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                        Primary YouTube Video URL
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={draft.url}
                          onChange={(e) =>
                            setYtEdits({
                              ...ytEdits,
                              [exp.id]: { ...draft, url: e.target.value },
                            })
                          }
                          className="flex-1 px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono"
                        />
                        <button
                          type="button"
                          disabled={probeState?.loading || (!draft.url.trim() && !draft.searchUrl.trim())}
                          onClick={() =>
                            handleValidateResourceLink(
                              'youtube',
                              exp.id,
                              draft.url.trim() || draft.searchUrl.trim()
                            )
                          }
                          className="px-2.5 py-2 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] disabled:opacity-50 text-[#49372E] border border-[#D8CBB9] rounded-lg inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${probeState?.loading ? 'animate-spin' : ''}`} />
                          Test Link
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                        Video Demonstration Title
                      </label>
                      <input
                        type="text"
                        placeholder="Video title (optional)"
                        value={draft.title}
                        onChange={(e) =>
                          setYtEdits({
                            ...ytEdits,
                            [exp.id]: { ...draft, title: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                        Alternate Video URL (Optional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={draft.altUrl}
                        onChange={(e) =>
                          setYtEdits({
                            ...ytEdits,
                            [exp.id]: { ...draft, altUrl: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                        Curated YouTube Search URL (FIND A DEMONSTRATION)
                      </label>
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/results?search_query=..."
                        value={draft.searchUrl}
                        onChange={(e) =>
                          setYtEdits({
                            ...ytEdits,
                            [exp.id]: { ...draft, searchUrl: e.target.value },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono"
                      />
                    </div>
                  </div>

                  {probeState?.result && (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                        probeState.result.reachable
                          ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {probeState.result.reachable ? 'REACHABLE' : 'UNREACHABLE'}
                      {probeState.result.status ? ` (HTTP ${probeState.result.status})` : ''} —{' '}
                      {probeState.result.note}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {(classified.watchUrl || classified.searchUrl) && (
                      <a
                        href={classified.watchUrl || classified.searchUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] text-[#49372E] border border-[#D8CBB9] rounded-lg inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {classified.watchUrl ? 'Watch on YouTube' : 'Open Search'}
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (draft.url.trim() && !check.isValid) {
                          showBanner('error', check.error || 'Enter a valid direct YouTube video URL.');
                          return;
                        }
                        if (draft.searchUrl.trim() && !searchCheck.isValid) {
                          showBanner('error', 'Search URL must start with https://www.youtube.com/results?search_query=...');
                          return;
                        }
                        const res = await updateExperiment(exp.id, {
                          youtube_url: draft.url.trim(),
                          youtube_video_id: check.videoId,
                          youtube_title: draft.title.trim() || undefined,
                          youtube_alt_url: draft.altUrl.trim() || undefined,
                          youtube_search_url: draft.searchUrl.trim() || undefined,
                          resource_status: probeState?.result?.reachable === false ? 'needs_review' : 'verified',
                          last_verified_at: probeState?.result?.checkedAt,
                        });
                        if (!res.success) {
                          showBanner('error', res.error || 'Failed to save YouTube link.');
                        } else {
                          showBanner('success', `Saved YouTube resource configuration for "${exp.title}".`);
                        }
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Video Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. BENCH TWIN SIMULATIONS */}
      {/* ===================================================================== */}
      {section === 'bench_twin' && (
        <div className="space-y-6">
          <div>
            <h1 className="font-heading font-bold text-xl text-[#252521]">
              Virtual Simulations & Bench Twin
            </h1>
            <p className="text-xs text-[#6E675F] mt-0.5">
              Assign built-in LABVERSE rigs or external simulators (IIT Virtual Labs, PhET, CircuitVerse, BenchTwin) and verify launch modes.
            </p>
          </div>

          <div className="space-y-4">
            {labExperiments.map((exp) => {
              const draft = btEdits[exp.id] || {
                simulator_type: exp.simulator_type || 'custom',
                url: exp.simulation_url || exp.bench_twin_url || '',
                mode: exp.bench_twin_mode || 'external',
                provider: exp.simulation_provider || 'custom',
                sim_type: exp.simulation_type || 'none',
                note: exp.simulation_note || '',
              };
              const simResolved = resolveExperimentSimulation({
                simulator_type: draft.simulator_type,
                built_in_simulator_id: draft.simulator_type === 'custom' ? null : draft.simulator_type,
                bench_twin_url: draft.url,
                simulation_url: draft.url,
                bench_twin_mode: draft.mode,
                simulation_provider: draft.provider,
                simulation_type: draft.sim_type,
                simulation_note: draft.note,
              });
              const probeState = simTestStatus[exp.id];

              return (
                <div
                  key={exp.id}
                  className="bg-white p-5 rounded-2xl border border-[#E7DDD0] shadow-xs space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-[#A66A43] mr-2">
                        {exp.subject_code} • Exp #{exp.exp_number}
                      </span>
                      <span className="font-heading font-bold text-sm text-[#252521]">
                        {exp.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#FAF6F0] border border-[#E7DDD0] text-[#49372E] font-semibold">
                        {simResolved.providerLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectExperiment(exp.id)}
                        className="text-xs font-semibold text-[#A66A43] hover:text-[#49372E] flex items-center gap-1 cursor-pointer"
                      >
                        Preview as Public User <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                        Built-in Rig Engine
                      </label>
                      <select
                        value={draft.simulator_type}
                        onChange={(e) => {
                          const val = e.target.value as 'pn_junction' | 'pendulum' | 'calipers' | 'ph_meter' | 'custom';
                          setBtEdits({
                            ...btEdits,
                            [exp.id]: {
                              ...draft,
                              simulator_type: val,
                              sim_type:
                                val !== 'custom'
                                  ? draft.url.trim()
                                    ? 'hybrid'
                                    : 'built_in'
                                  : draft.url.trim()
                                  ? 'external'
                                  : 'none',
                            },
                          });
                        }}
                        className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      >
                        <option value="custom">None / External Only</option>
                        <option value="pn_junction">PN Junction Diode Plotter</option>
                        <option value="pendulum">Simple Pendulum Simulator</option>
                        <option value="calipers">Vernier Caliper Simulator</option>
                        <option value="ph_meter">Electrometric pH Meter</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                        Simulation Provider
                      </label>
                      <select
                        value={draft.provider}
                        onChange={(e) =>
                          setBtEdits({
                            ...btEdits,
                            [exp.id]: { ...draft, provider: e.target.value as SimulationProvider },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      >
                        <option value="built_in">LABVERSE Built-in</option>
                        <option value="virtual_labs">IIT Virtual Labs</option>
                        <option value="phet">PhET Interactive</option>
                        <option value="circuitverse">CircuitVerse</option>
                        <option value="benchtwin">BenchTwin</option>
                        <option value="custom">Custom HTTPS</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                        External Simulation URL
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="url"
                          placeholder="https://fsp1-iiith.vlabs.ac.in/..."
                          value={draft.url}
                          onChange={(e) => {
                            const nextUrl = e.target.value;
                            const detected = detectSimulationProviderFromUrl(nextUrl);
                            setBtEdits({
                              ...btEdits,
                              [exp.id]: {
                                ...draft,
                                url: nextUrl,
                                provider: detected !== 'none' ? detected : draft.provider,
                              },
                            });
                          }}
                          className="flex-1 px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono"
                        />
                        <button
                          type="button"
                          disabled={probeState?.loading || !draft.url.trim()}
                          onClick={() => handleValidateResourceLink('simulation', exp.id, draft.url)}
                          className="px-2.5 py-2 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] disabled:opacity-50 text-[#49372E] border border-[#D8CBB9] rounded-lg inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${probeState?.loading ? 'animate-spin' : ''}`} />
                          Test
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-[#6E675F] mb-1">
                        Launch Mode
                      </label>
                      <select
                        value={draft.mode}
                        onChange={(e) =>
                          setBtEdits({
                            ...btEdits,
                            [exp.id]: { ...draft, mode: e.target.value as 'embedded' | 'external' },
                          })
                        }
                        className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      >
                        <option value="embedded">Embedded Iframe (if host allows)</option>
                        <option value="external">External New Tab</option>
                      </select>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Learner note (e.g. Opens externally in CircuitVerse...)"
                    value={draft.note}
                    onChange={(e) =>
                      setBtEdits({
                        ...btEdits,
                        [exp.id]: { ...draft, note: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                  />

                  {probeState?.result && (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                        probeState.result.reachable
                          ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {probeState.result.reachable ? 'REACHABLE' : 'UNREACHABLE'}
                      {probeState.result.status ? ` (HTTP ${probeState.result.status})` : ''} •{' '}
                      {probeState.result.embeddable ? 'Embeddable' : 'External New Tab Only'} — {probeState.result.note}
                    </div>
                  )}

                  {draft.url && (
                    <div className="text-[11px] font-mono text-[#6E675F]">
                      Resolved: {simResolved.canEmbedExternal ? 'Inline Iframe + External Button' : 'Safe External New Tab Card'} • {simResolved.note}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        const trimmedUrl = draft.url.trim();
                        const builtInId: BuiltInSimulatorId | null =
                          draft.simulator_type === 'custom' ? null : draft.simulator_type;
                        const resolvedType: SimulationType =
                          builtInId && trimmedUrl
                            ? 'hybrid'
                            : builtInId
                            ? 'built_in'
                            : trimmedUrl
                            ? 'external'
                            : 'none';
                        const res = await updateExperiment(exp.id, {
                          simulator_type: draft.simulator_type,
                          built_in_simulator_id: builtInId,
                          bench_twin_url: trimmedUrl,
                          simulation_url: trimmedUrl,
                          bench_twin_mode: draft.mode,
                          simulation_provider: draft.provider,
                          simulation_type: resolvedType,
                          simulation_note: draft.note.trim() || undefined,
                          resource_status: probeState?.result?.reachable === false ? 'needs_review' : 'verified',
                          last_verified_at: probeState?.result?.checkedAt,
                        });
                        if (!res.success) {
                          showBanner('error', res.error || 'Failed to save simulation config.');
                        } else {
                          showBanner('success', `Saved simulation configuration for "${exp.title}".`);
                        }
                      }}
                      className="px-3.5 py-1.5 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Save Simulation Config
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 9. INVENTORY & TRANSACTIONS */}
      {/* ===================================================================== */}
      {section === 'inventory' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-xl text-[#252521]">
                Equipment Inventory{selectedLab ? ` — ${selectedLab.name}` : ''}
              </h1>
              <p className="text-xs text-[#6E675F] mt-0.5">
                Track apparatus quantities, issue & return checkouts, safety thresholds, and QR tags.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-[#A66A43] hover:bg-[#8E5835] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Scan QR
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintModalItem(null);
                  setIsPrintModalOpen(true);
                }}
                className="px-3 py-2 text-xs font-semibold bg-white text-[#252521] border border-[#D8CBB9] rounded-lg hover:bg-[#FAF6F0] flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-[#A66A43]" />
                Print Labels
              </button>
              <button
                type="button"
                onClick={() => exportToCsv('inventory')}
                className="px-3 py-2 text-xs font-semibold bg-white text-[#252521] border border-[#D8CBB9] rounded-lg hover:bg-[#FAF6F0] flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4 text-[#2E6F4E]" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={openAddInventoryModal}
                className="px-3.5 py-2 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Apparatus
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-[#E7DDD0] pb-3">
            {[
              { id: 'stock', label: `Stock Register (${labInventory.length})`, icon: Wrench },
              { id: 'mapping', label: `Experiment Readiness (${labExperiments.length})`, icon: FlaskConical },
              { id: 'transactions', label: `Checkout Ledger (${transactions.length})`, icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = inventorySubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInventorySubTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#49372E] text-white shadow-xs'
                      : 'bg-white text-[#6E675F] border border-[#E7DDD0] hover:bg-[#FAF6F0]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {lowStockItems.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <span className="font-bold text-sm">
                    Safety Stock Alert: {lowStockItems.length} item(s) below threshold
                  </span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {lowStockItems.map((i) => `${i.name} (${i.quantity_available} ${i.unit})`).join(' • ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedItemId(lowStockItems[0]?.id || '');
                  setRestockError(null);
                  setIsRestockModalOpen(true);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Restock Low Item
              </button>
            </div>
          )}

          {inventorySubTab === 'stock' && (
            <>
              <div className="bg-white p-4 rounded-xl border border-[#E7DDD0] shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {['all', 'electronic', 'instrument', 'chemical', 'hardware', 'glassware'].map(
                    (cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors cursor-pointer ${
                          activeCategory === cat
                            ? 'bg-[#49372E] text-white'
                            : 'bg-[#FAF6F0] text-[#6E675F] hover:bg-[#EFE7DC]'
                        }`}
                      >
                        {cat === 'all' ? 'All Apparatus' : cat}
                      </button>
                    )
                  )}
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search code, name, or cabinet..."
                    value={invSearchQuery}
                    onChange={(e) => setInvSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[#E7DDD0] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#6E675F] font-mono text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Item Code</th>
                        <th className="py-3 px-4">Name & Category</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4">Available / Total</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F5F0E8]">
                      {filteredInventory.map((item) => (
                        <tr key={item.id} className="hover:bg-[#FAF6F0]">
                          <td className="py-3.5 px-4 font-mono font-bold text-[#A66A43] whitespace-nowrap">
                            {item.item_code}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-[#252521]">{item.name}</div>
                            <div className="text-[10px] text-[#6E675F] uppercase font-mono">
                              {item.category}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#6E675F]">{item.location}</td>
                          <td className="py-3.5 px-4 font-mono">
                            <span className="font-bold text-[#252521]">
                              {item.quantity_available}
                            </span>{' '}
                            <span className="text-[#6E675F]">
                              / {item.quantity_total} {item.unit}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={item.status} size="sm" />
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setQrModalItem(item)}
                                className="p-1.5 text-[#49372E] hover:bg-[#FAF6F0] border border-[#D8CBB9] rounded cursor-pointer"
                                title="View QR Code"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditInventoryModal(item)}
                                className="p-1.5 text-[#6E675F] hover:text-[#252521] border border-[#D8CBB9] rounded cursor-pointer"
                                title="Edit Apparatus"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemId(item.id);
                                  setIssueError(null);
                                  setIsIssueModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded cursor-pointer"
                              >
                                Issue
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemId(item.id);
                                  setReturnError(null);
                                  setIsReturnModalOpen(true);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold bg-[#2E6F4E] hover:bg-[#23583D] text-white rounded cursor-pointer"
                              >
                                Return
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItemId(item.id);
                                  setDamageError(null);
                                  setIsDamageModalOpen(true);
                                }}
                                className="p-1.5 text-[#B91C1C] hover:bg-rose-50 border border-rose-200 rounded cursor-pointer"
                                title="Log Damage Write-off"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                              </button>
                              {confirmDeleteInvId === item.id ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const res = await deleteInventoryItem(item.id);
                                    setConfirmDeleteInvId(null);
                                    if (!res.success) {
                                      showBanner('error', res.error || 'Failed to delete item.');
                                    } else {
                                      showBanner('success', `Deleted ${item.item_code}.`);
                                    }
                                  }}
                                  className="px-2 py-1 text-[11px] bg-[#B91C1C] text-white rounded font-semibold cursor-pointer"
                                >
                                  Delete
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteInvId(item.id)}
                                  className="p-1.5 text-[#B91C1C] hover:bg-rose-50 border border-rose-200 rounded cursor-pointer"
                                  title="Delete Item"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {inventorySubTab === 'mapping' && (
            <div className="bg-white rounded-xl border border-[#E7DDD0] shadow-xs p-5 space-y-4">
              <h2 className="font-heading font-semibold text-base text-[#252521] flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-[#A66A43]" />
                Experiment Apparatus Readiness Check
              </h2>
              <div className="space-y-3">
                {labExperiments.map((exp) => {
                  const entries = [
                    ...(exp.components_required || []).map((c) => ({
                      label: c.name,
                      detail: `${c.quantity} • ${c.spec}`,
                    })),
                    ...(exp.equipment_required || []).map((eq) => ({
                      label: eq.name,
                      detail: `${eq.model} • ${eq.spec}`,
                    })),
                  ];
                  return (
                    <div
                      key={exp.id}
                      className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-[#252521]">
                          {exp.subject_code} Exp #{exp.exp_number} — {exp.title}
                        </span>
                        <span className="text-[11px] font-mono text-[#6E675F]">
                          {entries.length} Apparatus
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {entries.map((entry, idx) => {
                          const needle = entry.label.toLowerCase().split('(')[0].trim();
                          const matched = labInventory.find((inv) =>
                            inv.name.toLowerCase().includes(needle)
                          );
                          return (
                            <div
                              key={idx}
                              className="p-2.5 rounded-lg bg-white border border-[#E7DDD0] flex items-center justify-between text-xs"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-medium text-[#252521] truncate">{entry.label}</div>
                                <div className="text-[10px] font-mono text-[#6E675F] truncate">
                                  {entry.detail}
                                </div>
                              </div>
                              {matched ? (
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[#EBF5EE] text-[#2E6F4E] shrink-0">
                                  {matched.quantity_available} {matched.unit}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#6E675F] shrink-0">
                                  Unlinked
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {inventorySubTab === 'transactions' && (
            <div className="bg-white rounded-xl border border-[#E7DDD0] shadow-xs p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading font-semibold text-base text-[#252521]">
                  Equipment Checkout & Stock Ledger
                </h2>
                <div className="flex flex-wrap gap-1">
                  {(['all', 'issue', 'return', 'damage_writeoff', 'restock'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTxTypeFilter(t)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold uppercase cursor-pointer ${
                        txTypeFilter === t
                          ? 'bg-[#49372E] text-white'
                          : 'bg-[#FAF6F0] text-[#6E675F] hover:bg-[#EFE7DC]'
                      }`}
                    >
                      {t === 'all' ? 'All' : t.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto border border-[#E7DDD0] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#6E675F] font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Apparatus</th>
                      <th className="py-2.5 px-4">Qty</th>
                      <th className="py-2.5 px-4">Issued To / Batch</th>
                      <th className="py-2.5 px-4">Handled By</th>
                      <th className="py-2.5 px-4">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F0E8]">
                    {transactions
                      .filter((tx) => txTypeFilter === 'all' || tx.transaction_type === txTypeFilter)
                      .map((tx) => (
                        <tr key={tx.id} className="hover:bg-[#FAF6F0]">
                          <td className="py-3 px-4 font-mono font-bold uppercase text-[#49372E]">
                            {tx.transaction_type}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-[#252521]">{tx.item_name}</div>
                            <div className="font-mono text-[10px] text-[#6E675F]">{tx.item_code}</div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-[#252521]">
                            {tx.quantity}
                          </td>
                          <td className="py-3 px-4">
                            {tx.borrower_name ? (
                              <div>
                                <div className="font-medium text-[#252521]">{tx.borrower_name}</div>
                                {tx.borrower_id && (
                                  <div className="font-mono text-[10px] text-[#6E675F]">
                                    {tx.borrower_id}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#6E675F]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#6E675F]">{tx.handled_by_name}</td>
                          <td className="py-3 px-4 text-[#6E675F] max-w-xs truncate">{tx.remarks}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* PC LABORATORY WORKSTATION CATEGORIES */}
      {/* ===================================================================== */}
      {section === 'pc_working' && <PcLabManagementView initialCategory="working" />}
      {section === 'pc_defective' && <PcLabManagementView initialCategory="defective" />}
      {section === 'pc_staff' && <PcLabManagementView initialCategory="staff" />}

      {/* ===================================================================== */}
      {/* 10. QR CODE MANAGEMENT */}
      {/* ===================================================================== */}
      {section === 'qr_codes' && selectedLab?.lab_type === 'pc_lab' && (
        <PcLabManagementView initialCategory="working" />
      )}
      {section === 'qr_codes' && selectedLab?.lab_type !== 'pc_lab' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-xl text-[#252521]">
                QR Code Management
              </h1>
              <p className="text-xs text-[#6E675F] mt-0.5">
                Generate, download, scan, and batch-print QR asset labels for{' '}
                {selectedLab?.name || 'your laboratory'}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold bg-[#A66A43] hover:bg-[#8E5835] text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                Scan Apparatus QR
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrintModalItem(null);
                  setIsPrintModalOpen(true);
                }}
                className="px-3.5 py-2 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Batch / A4 Print Sheet
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {labInventory.map((item) => (
              <div
                key={item.id}
                className="bg-white p-5 rounded-2xl border border-[#E7DDD0] shadow-xs flex flex-col justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#A66A43] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#E7DDD0]">
                      {item.item_code}
                    </span>
                    <StatusBadge status={item.status} size="sm" />
                  </div>
                  <h3 className="font-heading font-bold text-sm text-[#252521]">{item.name}</h3>
                  <p className="text-xs text-[#6E675F]">
                    {item.location} • {item.quantity_available}/{item.quantity_total} {item.unit}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[#F5F0E8]">
                  <button
                    type="button"
                    onClick={() => setQrModalItem(item)}
                    className="flex-1 py-2 px-3 bg-[#49372E] hover:bg-[#382922] text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Inspect & Download QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintModalItem(item);
                      setIsPrintModalOpen(true);
                    }}
                    className="p-2 bg-[#FAF6F0] hover:bg-[#EFE7DC] text-[#49372E] border border-[#D8CBB9] rounded-lg cursor-pointer"
                    title="Print Single Tag"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 11. SETTINGS */}
      {/* ===================================================================== */}
      {section === 'settings' && (
        <div className="max-w-3xl space-y-6">
          <div>
            <h1 className="font-heading font-bold text-xl text-[#252521]">
              Lab Assistant Account Settings
            </h1>
            <p className="text-xs text-[#6E675F] mt-0.5">
              Manakula Vinayagar Institute of Technology staff credentials and assigned laboratories.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-xs p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#49372E] text-white flex items-center justify-center font-heading font-bold text-lg">
                {(currentUser?.name || 'LA').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-heading font-bold text-base text-[#252521]">
                  {currentUser?.name}
                </h2>
                <p className="text-xs font-mono text-[#6E675F]">
                  {currentUser?.email} • {currentUser?.identifier}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#F5F0E8] text-xs">
              <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                <span className="text-[11px] text-[#6E675F] block">Institution</span>
                <span className="font-semibold text-[#252521] flex items-center gap-1.5 mt-1">
                  <Building2 className="w-3.5 h-3.5 text-[#A66A43]" />
                  {institution.name}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                <span className="text-[11px] text-[#6E675F] block">Assigned MVIT Laboratories</span>
                <span className="font-semibold text-[#252521] mt-1 block">
                  {accessibleLabs.map((l) => `${l.name} (${l.lab_code})`).join(', ') || 'None'}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  if (!currentUser?.email) return;
                  const res = await sendAssistantPasswordReset(currentUser.email);
                  if (res.success) {
                    showBanner('success', `Password reset link dispatched to ${currentUser.email}.`);
                  } else {
                    showBanner('error', res.error || 'Could not dispatch password reset.');
                  }
                }}
                className="px-4 py-2 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] text-[#49372E] border border-[#D8CBB9] rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#A66A43]" />
                Send Password Reset Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODALS */}
      {/* ===================================================================== */}
      <ExperimentEditorModal
        isOpen={isExpEditorOpen}
        onClose={() => {
          setIsExpEditorOpen(false);
          setEditingExperiment(null);
        }}
        initialExperiment={editingExperiment}
      />

      <DocumentManagerModal
        isOpen={isDocManagerOpen}
        onClose={() => setIsDocManagerOpen(false)}
        onPreviewPdf={(doc) => setPreviewDoc(doc)}
        preSelectedSubjectId={docManagerPreset.subjectId}
        preSelectedExperimentId={docManagerPreset.experimentId}
        preSelectedType={docManagerPreset.type}
      />

      {previewDoc && (
        <PdfViewerModal
          isOpen={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc.title}
          pdfUrl={previewDoc.file_url}
          storagePath={previewDoc.storage_path}
          docId={previewDoc.id}
          fileName={previewDoc.file_name}
          fileSize={previewDoc.file_size}
          uploadedBy={previewDoc.uploaded_by_name}
          uploadedAt={previewDoc.created_at}
          subjectCode={previewDoc.subject_code}
          isDemo={Boolean(previewDoc.is_demo) || (!isSupabaseActive && previewDoc.file_url.startsWith('data:'))}
        />
      )}

      <ItemQrDetailModal
        isOpen={!!qrModalItem}
        onClose={() => setQrModalItem(null)}
        item={qrModalItem}
        currentLab={selectedLab}
        userRole={currentRole}
        onOpenIssue={(item) => {
          setSelectedItemId(item.id);
          setIssueError(null);
          setIsIssueModalOpen(true);
        }}
        onOpenReturn={(item) => {
          setSelectedItemId(item.id);
          setReturnError(null);
          setIsReturnModalOpen(true);
        }}
        onOpenPrint={(item) => {
          setPrintModalItem(item);
          setIsPrintModalOpen(true);
        }}
      />

      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        inventory={labInventory}
        currentLab={selectedLab}
        onItemDetected={(detectedItem) => {
          if ('min_safety_threshold' in detectedItem) {
            setQrModalItem(detectedItem);
          }
        }}
      />

      <PrintQrModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          setPrintModalItem(null);
        }}
        inventory={labInventory}
        selectedItem={printModalItem}
        currentLab={selectedLab}
        institutionName={institution.name}
      />

      {/* Issue Equipment Modal */}
      <Modal
        isOpen={isIssueModalOpen}
        onClose={() => setIsIssueModalOpen(false)}
        title="Issue Laboratory Apparatus"
        subtitle="Logs apparatus checkout and enforces non-negative stock balance"
      >
        <form onSubmit={handleIssueSubmit} className="space-y-4">
          {issueError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{issueError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">
              Select Apparatus *
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
            >
              {labInventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_code} - {i.name} ({i.quantity_available} {i.unit} available)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                required
                value={issueQty}
                onChange={(e) => setIssueQty(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
              {selectedItem && (
                <span className="text-[10px] text-[#6E675F] mt-0.5 block">
                  Available: {selectedItem.quantity_available} {selectedItem.unit}
                </span>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Practical Experiment
              </label>
              <input
                type="text"
                value={issueExperiment}
                onChange={(e) => setIssueExperiment(e.target.value)}
                placeholder="e.g. PN Junction Diode"
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Batch / Register ID *
              </label>
              <input
                type="text"
                required
                value={issueBorrowerId}
                onChange={(e) => setIssueBorrowerId(e.target.value)}
                placeholder="e.g. I-ECE-BATCH-A"
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Borrower / Bench Label *
              </label>
              <input
                type="text"
                required
                value={issueBorrowerName}
                onChange={(e) => setIssueBorrowerName(e.target.value)}
                placeholder="e.g. Bench 3 — I Year Batch A"
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">Remarks</label>
            <input
              type="text"
              value={issueRemarks}
              onChange={(e) => setIssueRemarks(e.target.value)}
              placeholder="e.g. Verified zero calibration prior to issue"
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
            <button
              type="button"
              onClick={() => setIsIssueModalOpen(false)}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg hover:bg-[#FAF6F0] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs bg-[#49372E] hover:bg-[#382922] text-white font-semibold rounded-lg cursor-pointer"
            >
              Confirm Issue
            </button>
          </div>
        </form>
      </Modal>

      {/* Return Apparatus Modal */}
      <Modal
        isOpen={isReturnModalOpen}
        onClose={() => setIsReturnModalOpen(false)}
        title="Return Laboratory Apparatus"
        subtitle="Restores available stock balance"
      >
        <form onSubmit={handleReturnSubmit} className="space-y-4">
          {returnError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{returnError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">
              Apparatus Returning *
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
            >
              {labInventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_code} - {i.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Quantity Returned *
              </label>
              <input
                type="number"
                min="1"
                required
                value={returnQty}
                onChange={(e) => setReturnQty(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Returned By / Batch
              </label>
              <input
                type="text"
                value={returnBorrowerName}
                onChange={(e) => setReturnBorrowerName(e.target.value)}
                placeholder="e.g. I Year Batch A"
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">Condition Remarks</label>
            <input
              type="text"
              value={returnRemarks}
              onChange={(e) => setReturnRemarks(e.target.value)}
              placeholder="e.g. Inspected and placed back in cabinet"
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
            <button
              type="button"
              onClick={() => setIsReturnModalOpen(false)}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg hover:bg-[#FAF6F0] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs bg-[#2E6F4E] hover:bg-[#23583D] text-white font-semibold rounded-lg cursor-pointer"
            >
              Confirm Return
            </button>
          </div>
        </form>
      </Modal>

      {/* Damage Write-off Modal */}
      <Modal
        isOpen={isDamageModalOpen}
        onClose={() => setIsDamageModalOpen(false)}
        title="Record Damaged / Scrapped Apparatus"
        subtitle="Deducts from available and total inventory with audit reason"
      >
        <form onSubmit={handleDamageSubmit} className="space-y-4">
          {damageError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{damageError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">Item *</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
            >
              {labInventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_code} - {i.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Quantity Damaged *
              </label>
              <input
                type="number"
                min="1"
                required
                value={damageQty}
                onChange={(e) => setDamageQty(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">Reason *</label>
              <input
                type="text"
                required
                value={damageReason}
                onChange={(e) => setDamageReason(e.target.value)}
                placeholder="e.g. Glass electrode cracked"
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
            <button
              type="button"
              onClick={() => setIsDamageModalOpen(false)}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg hover:bg-[#FAF6F0] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs bg-[#B91C1C] hover:bg-rose-800 text-white font-semibold rounded-lg cursor-pointer"
            >
              Confirm Write-off
            </button>
          </div>
        </form>
      </Modal>

      {/* Restock Modal */}
      <Modal
        isOpen={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        title="Restock Apparatus Inventory"
        subtitle="Add newly procured stock to MVIT laboratory inventory"
      >
        <form onSubmit={handleRestockSubmit} className="space-y-4">
          {restockError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {restockError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">Item *</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
            >
              {labInventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_code} - {i.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Quantity Received *
              </label>
              <input
                type="number"
                min="1"
                required
                value={restockQty}
                onChange={(e) => setRestockQty(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Supplier / PO Notes
              </label>
              <input
                type="text"
                value={restockRemarks}
                onChange={(e) => setRestockRemarks(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
            <button
              type="button"
              onClick={() => setIsRestockModalOpen(false)}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg hover:bg-[#FAF6F0] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs bg-[#49372E] hover:bg-[#382922] text-white font-semibold rounded-lg cursor-pointer"
            >
              Add to Stock
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Inventory Item Modal */}
      <Modal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        title={editingInvItem ? 'Edit Apparatus Record' : 'Add MVIT Apparatus Item'}
        subtitle="Register equipment or instrument in your assigned laboratory"
      >
        <form onSubmit={handleSaveInventoryItem} className="space-y-4">
          {invFormError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {invFormError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">Item Code *</label>
              <input
                type="text"
                required
                disabled={!!editingInvItem}
                placeholder="e.g. MVIT-OSC-004"
                value={invCode}
                onChange={(e) => setInvCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono disabled:bg-[#FAF6F0]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">Category</label>
              <select
                value={invCategory}
                onChange={(e) => setInvCategory(e.target.value as InventoryCategory)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
              >
                <option value="instrument">Instrument</option>
                <option value="electronic">Electronic</option>
                <option value="glassware">Glassware</option>
                <option value="chemical">Chemical</option>
                <option value="mechanical">Mechanical</option>
                <option value="hardware">Hardware</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">
              Apparatus Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cathode Ray Oscilloscope (30 MHz)"
              value={invName}
              onChange={(e) => setInvName(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">Department</label>
              <select
                value={invDeptId}
                onChange={(e) => setInvDeptId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Cabinet / Shelf Location *
              </label>
              <input
                type="text"
                required
                value={invLocation}
                onChange={(e) => setInvLocation(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#252521] mb-1">Available</label>
              <input
                type="number"
                min="0"
                required
                value={invAvailable}
                onChange={(e) => setInvAvailable(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#252521] mb-1">Total</label>
              <input
                type="number"
                min="1"
                required
                value={invTotal}
                onChange={(e) => setInvTotal(parseInt(e.target.value) || 1)}
                className="w-full px-2.5 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#252521] mb-1">Min Alert</label>
              <input
                type="number"
                min="0"
                required
                value={invThreshold}
                onChange={(e) => setInvThreshold(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#252521] mb-1">Unit</label>
              <input
                type="text"
                required
                value={invUnit}
                onChange={(e) => setInvUnit(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
            <button
              type="button"
              onClick={() => setIsAddItemModalOpen(false)}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg hover:bg-[#FAF6F0] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs bg-[#49372E] hover:bg-[#382922] text-white font-semibold rounded-lg cursor-pointer"
            >
              {editingInvItem ? 'Update Item' : 'Save Apparatus'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

