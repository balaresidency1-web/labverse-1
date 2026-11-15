import React, { useState, useMemo, useEffect } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import {
  PcLabComputer,
  PcLabMaintenanceRecord,
  PcComputerStatus,
  PcComputerType,
} from '../../types';
import {
  calculatePcLabSummaryStats,
  categorizePcComputers,
  canViewPcLabComputers,
  canManagePcLabComputers,
  formatCountLabel,
} from '../../utils/labRules';
import {
  formatPcComputerQrPayload,
  generateQrDataUrl,
  generateQrSvgString,
  downloadDataUrl,
  downloadSvgString,
} from '../../utils/qrCodeService';
import {
  Monitor,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  UserCheck,
  Plus,
  Search,
  QrCode,
  Edit3,
  Eye,
  Printer,
  Download,
  X,
  MapPin,
  Cpu,
  HardDrive,
  ShieldCheck,
  Calendar,
} from 'lucide-react';

export type PcLabCategoryTab = 'working' | 'defective' | 'staff';

interface PcLabManagementViewProps {
  initialCategory?: PcLabCategoryTab;
}

const STATUS_BADGE_MAP: Record<
  PcComputerStatus,
  { label: string; className: string }
> = {
  working: {
    label: 'Working',
    className: 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]',
  },
  repaired: {
    label: 'Repaired (Working)',
    className: 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]',
  },
  defective: {
    label: 'Defective',
    className: 'bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]',
  },
  under_maintenance: {
    label: 'Under Maintenance',
    className: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]',
  },
};

export const PcLabManagementView: React.FC<PcLabManagementViewProps> = ({
  initialCategory = 'working',
}) => {
  const {
    institution,
    isSupabaseActive,
    currentUser,
    labs,
    allProfiles,
    selectedLab,
    pcComputers,
    pcMaintenanceRecords,
    addPcComputer,
    updatePcComputer,
    reportPcDefect,
    updatePcRepairStatus,
  } = useLabverse();

  const pcLabs = useMemo(() => {
    if (currentUser?.role !== 'lab_assistant') return [];
    const onlyPc = labs.filter((l) => l.lab_type === 'pc_lab' && l.status === 'active');
    return onlyPc.filter((l) => canViewPcLabComputers(currentUser, l));
  }, [labs, currentUser]);

  const [activePcLabId, setActivePcLabId] = useState<string>(() => {
    if (selectedLab?.lab_type === 'pc_lab') return selectedLab.id;
    return pcLabs[0]?.id || '';
  });

  useEffect(() => {
    if (selectedLab?.lab_type === 'pc_lab') {
      setActivePcLabId(selectedLab.id);
    } else if ((!activePcLabId || !pcLabs.some((l) => l.id === activePcLabId)) && pcLabs[0]?.id) {
      setActivePcLabId(pcLabs[0].id);
    }
  }, [selectedLab, pcLabs, activePcLabId]);

  const [activeCategory, setActiveCategory] = useState<PcLabCategoryTab>(initialCategory);
  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Scoped computers & maintenance records for the active PC Lab
  const scopedComputers = useMemo(() => {
    const base = activePcLabId
      ? pcComputers.filter((c) => c.lab_id === activePcLabId)
      : pcComputers;
    return base;
  }, [pcComputers, activePcLabId]);

  const scopedMaintenance = useMemo(() => {
    return activePcLabId
      ? pcMaintenanceRecords.filter((r) => r.lab_id === activePcLabId)
      : pcMaintenanceRecords;
  }, [pcMaintenanceRecords, activePcLabId]);

  const stats = useMemo(
    () => calculatePcLabSummaryStats(scopedComputers),
    [scopedComputers]
  );

  const categorized = useMemo(
    () => categorizePcComputers(scopedComputers),
    [scopedComputers]
  );

  const latestMaintenanceByComputer = useMemo(() => {
    const map = new Map<string, PcLabMaintenanceRecord>();
    const sorted = [...scopedMaintenance].sort((a, b) =>
      b.date_reported.localeCompare(a.date_reported)
    );
    for (const rec of sorted) {
      if (!map.has(rec.computer_id)) {
        map.set(rec.computer_id, rec);
      }
    }
    return map;
  }, [scopedMaintenance]);

  const sortedMaintenanceHistory = useMemo(
    () =>
      [...scopedMaintenance].sort((a, b) => b.date_reported.localeCompare(a.date_reported)),
    [scopedMaintenance]
  );

  // Resolved list for active tab + search/filter
  const displayedComputers = useMemo(() => {
    let list: PcLabComputer[] = [];
    if (activeCategory === 'working') {
      list = categorized.workingStudent;
    } else if (activeCategory === 'defective') {
      list = categorized.defectiveOrMaintenanceStudent;
    } else {
      list = categorized.staffComputers;
    }

    const q = searchQuery.trim().toLowerCase();
    return list.filter((pc) => {
      const maint = latestMaintenanceByComputer.get(pc.id);
      const matchesQuery =
        !q ||
        pc.computer_code.toLowerCase().includes(q) ||
        pc.hostname.toLowerCase().includes(q) ||
        (pc.operating_system || '').toLowerCase().includes(q) ||
        pc.location.toLowerCase().includes(q) ||
        (pc.assigned_staff_name || '').toLowerCase().includes(q) ||
        (pc.assigned_department || '').toLowerCase().includes(q) ||
        (maint?.reported_issue || '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || pc.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [
    activeCategory,
    categorized,
    latestMaintenanceByComputer,
    searchQuery,
    statusFilter,
  ]);

  // Modal states
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingPc, setEditingPc] = useState<PcLabComputer | null>(null);
  const [formState, setFormState] = useState<{
    computer_code: string;
    hostname: string;
    computer_type: PcComputerType;
    processor: string;
    ram: string;
    storage: string;
    operating_system: string;
    location: string;
    assigned_staff_name: string;
    assigned_department: string;
    specs_summary: string;
    status: PcComputerStatus;
    maintenance_status: string;
  }>({
    computer_code: '',
    hostname: '',
    computer_type: 'student_computer',
    processor: '',
    ram: '',
    storage: '',
    operating_system: 'Ubuntu 24.04 LTS / Windows 11',
    location: 'Center 401',
    assigned_staff_name: '',
    assigned_department: '',
    specs_summary: '',
    status: 'working',
    maintenance_status: 'operational',
  });

  const [defectTargetPc, setDefectTargetPc] = useState<PcLabComputer | null>(null);
  const [defectForm, setDefectForm] = useState<{
    reportedIssue: string;
    defectDescription: string;
    repairStatus: 'defective' | 'under_maintenance';
    maintenanceRemarks: string;
  }>({
    reportedIssue: '',
    defectDescription: '',
    repairStatus: 'defective',
    maintenanceRemarks: '',
  });

  const [repairTarget, setRepairTarget] = useState<{
    pc: PcLabComputer;
    record?: PcLabMaintenanceRecord;
  } | null>(null);
  const [repairForm, setRepairForm] = useState<{
    repairStatus: PcComputerStatus;
    maintenanceRemarks: string;
    resolutionDate: string;
  }>({
    repairStatus: 'under_maintenance',
    maintenanceRemarks: '',
    resolutionDate: '',
  });

  const [detailTargetPc, setDetailTargetPc] = useState<PcLabComputer | null>(null);
  const [qrTargetPc, setQrTargetPc] = useState<PcLabComputer | null>(null);
  const [qrPngUrl, setQrPngUrl] = useState('');
  const [qrSvgStr, setQrSvgStr] = useState('');

  useEffect(() => {
    if (!qrTargetPc) {
      setQrPngUrl('');
      setQrSvgStr('');
      return;
    }
    let cancelled = false;
    const payload = formatPcComputerQrPayload(qrTargetPc);
    Promise.all([
      generateQrDataUrl(payload, { size: 320, margin: 2, errorCorrectionLevel: 'H' }),
      generateQrSvgString(payload, { size: 320, margin: 2, errorCorrectionLevel: 'H' }),
    ]).then(([png, svg]) => {
      if (!cancelled) {
        setQrPngUrl(png);
        setQrSvgStr(svg);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [qrTargetPc]);

  const openAddModal = (defaultType: PcComputerType) => {
    setEditingPc(null);
    setFormState({
      computer_code: '',
      hostname: '',
      computer_type: defaultType,
      processor: 'Intel Core i5-12400',
      ram: '16 GB DDR4',
      storage: '512 GB NVMe SSD',
      operating_system: defaultType === 'staff_computer' ? 'Windows 11 Pro' : 'Ubuntu 24.04 LTS / Windows 11',
      location: defaultType === 'staff_computer' ? 'Faculty Workstation Cabin' : 'Center 401',
      assigned_staff_name: '',
      assigned_department: '',
      specs_summary: '',
      status: 'working',
      maintenance_status: 'operational',
    });
    setIsAddEditOpen(true);
  };

  const openEditModal = (pc: PcLabComputer) => {
    setEditingPc(pc);
    setFormState({
      computer_code: pc.computer_code,
      hostname: pc.hostname,
      computer_type: pc.computer_type,
      processor: pc.processor || '',
      ram: pc.ram || '',
      storage: pc.storage || '',
      operating_system: pc.operating_system || '',
      location: pc.location,
      assigned_staff_name: pc.assigned_staff_name || '',
      assigned_department: pc.assigned_department || '',
      specs_summary: pc.specs_summary || '',
      status: pc.status,
      maintenance_status: pc.maintenance_status || 'operational',
    });
    setIsAddEditOpen(true);
  };

  const handleSaveComputer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerMsg(null);
    const targetLabId = activePcLabId || pcLabs[0]?.id;
    if (!targetLabId) {
      setBannerMsg({ type: 'error', text: 'No PC Laboratory record found in MVIT configuration.' });
      return;
    }

    const specsCombined =
      formState.specs_summary.trim() ||
      [formState.processor, formState.ram, formState.storage, formState.operating_system]
        .filter(Boolean)
        .join(' · ');

    if (editingPc) {
      const res = await updatePcComputer(editingPc.id, {
        ...formState,
        specs_summary: specsCombined,
      });
      if (res.success) {
        setBannerMsg({ type: 'success', text: `Updated workstation ${formState.computer_code.toUpperCase()}.` });
        setIsAddEditOpen(false);
      } else {
        setBannerMsg({ type: 'error', text: res.error || 'Failed to update computer.' });
      }
    } else {
      const res = await addPcComputer({
        ...formState,
        lab_id: targetLabId,
        specs_summary: specsCombined,
        last_updated: new Date().toISOString().slice(0, 10),
      });
      if (res.success) {
        setBannerMsg({ type: 'success', text: `Added ${formState.computer_code.toUpperCase()} to MVIT PC Lab.` });
        setIsAddEditOpen(false);
      } else {
        setBannerMsg({ type: 'error', text: res.error || 'Failed to add computer.' });
      }
    }
  };

  const openReportDefect = (pc: PcLabComputer) => {
    setDefectTargetPc(pc);
    setDefectForm({
      reportedIssue: '',
      defectDescription: '',
      repairStatus: 'defective',
      maintenanceRemarks: '',
    });
  };

  const handleSubmitDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defectTargetPc) return;
    const res = await reportPcDefect({
      computerId: defectTargetPc.id,
      reportedIssue: defectForm.reportedIssue,
      defectDescription: defectForm.defectDescription,
      repairStatus: defectForm.repairStatus,
      maintenanceRemarks: defectForm.maintenanceRemarks,
    });
    if (res.success) {
      setBannerMsg({
        type: 'success',
        text: `Logged defect for ${defectTargetPc.computer_code} and updated workstation status.`,
      });
      setDefectTargetPc(null);
      setActiveCategory('defective');
    } else {
      setBannerMsg({ type: 'error', text: res.error || 'Could not report defect.' });
    }
  };

  const openUpdateRepair = (pc: PcLabComputer) => {
    const rec =
      sortedMaintenanceHistory.find(
        (r) =>
          r.computer_id === pc.id &&
          (!r.resolution_date || r.repair_status === 'defective' || r.repair_status === 'under_maintenance')
      ) || latestMaintenanceByComputer.get(pc.id);
    setRepairTarget({ pc, record: rec });
    setRepairForm({
      repairStatus: pc.status === 'defective' ? 'under_maintenance' : pc.status,
      maintenanceRemarks: rec?.maintenance_remarks || '',
      resolutionDate: rec?.resolution_date || new Date().toISOString().slice(0, 10),
    });
  };

  const handleSubmitRepairUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairTarget) return;
    const isResolved = repairForm.repairStatus === 'repaired' || repairForm.repairStatus === 'working';
    const res = await updatePcRepairStatus({
      computerId: repairTarget.pc.id,
      repairStatus: repairForm.repairStatus,
      maintenanceRemarks: repairForm.maintenanceRemarks,
      recordId: repairTarget.record?.id,
      resolutionDate: isResolved ? repairForm.resolutionDate || new Date().toISOString().slice(0, 10) : null,
    });
    if (res.success) {
      setBannerMsg({
        type: 'success',
        text: `Updated ${repairTarget.pc.computer_code} status to "${repairForm.repairStatus.replace('_', ' ')}".`,
      });
      setRepairTarget(null);
    } else {
      setBannerMsg({ type: 'error', text: res.error || 'Failed to update repair status.' });
    }
  };

  const activeLabObj = pcLabs.find((l) => l.id === activePcLabId) || pcLabs[0] || selectedLab;
  const canViewPcLab = canViewPcLabComputers(currentUser, activeLabObj);
  const canMutatePcLab = canManagePcLabComputers(currentUser, activeLabObj);
  const assignedAssistantProfile = useMemo(() => {
    if (!activeLabObj) return null;
    return (
      allProfiles.find(
        (p) =>
          p.role === 'lab_assistant' &&
          (p.id === activeLabObj.assigned_assistant_id ||
            p.assigned_lab_ids?.includes(activeLabObj.id))
      ) || null
    );
  }, [allProfiles, activeLabObj]);

  if (!canViewPcLab) {
    return (
      <div className="bg-white rounded-2xl border border-[#FECACA] p-8 max-w-lg mx-auto my-8 text-center space-y-3 shadow-xs">
        <div className="w-11 h-11 rounded-xl bg-[#FEF2F2] text-[#B91C1C] flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="font-heading font-bold text-lg text-[#252521]">
          PC Laboratory Computer Registry Restricted
        </h2>
        <p className="text-xs text-[#6E675F] leading-relaxed">
          Individual computer records, specifications, hostnames, defect logs, and repair history are strictly restricted to the assigned MVIT PC Lab Assistant.
        </p>
      </div>
    );
  }

  const operationalPct =
    stats.totalComputers > 0
      ? Math.round((stats.workingComputers / stats.totalComputers) * 100)
      : 100;
  const overallStatusLabel =
    stats.totalComputers === 0
      ? 'No Computers Registered'
      : stats.defectiveComputers + stats.underMaintenanceComputers === 0
        ? 'Operational'
        : 'Attention Needed';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 shadow-xs flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#A66A43] font-semibold">
            <span>{institution.code} PC LABORATORY INFRASTRUCTURE</span>
            {activeLabObj && (
              <>
                <span className="text-[#D8CBB9]">·</span>
                <span className="text-[#49372E]">{activeLabObj.lab_code}</span>
              </>
            )}
            {!isSupabaseActive && (
              <span className="px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-bold">
                DEMO DATA
              </span>
            )}
          </div>
          <h1 className="font-heading font-bold text-2xl text-[#252521]">
            {activeLabObj?.name || 'PC Lab Workstation & Maintenance Registry'}
          </h1>
          <p className="text-xs text-[#6E675F] max-w-2xl">
            Manage student-use working computers, report defects, track repairs with full incident history, manage staff workstations, and print PC QR labels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pcLabs.length > 1 && (
            <select
              aria-label="Select PC Laboratory"
              value={activePcLabId}
              onChange={(e) => setActivePcLabId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#D8CBB9] text-xs font-semibold text-[#252521]"
            >
              {pcLabs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.lab_code})
                </option>
              ))}
            </select>
          )}
          {canMutatePcLab && (
            <button
              type="button"
              onClick={() => openAddModal(activeCategory === 'staff' ? 'staff_computer' : 'student_computer')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{activeCategory === 'staff' ? 'Add Staff Computer' : 'Add Computer'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Overall PC Lab Status & Assistant Assignment Summary */}
      <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#6E675F] font-medium">Overall PC Lab Status:</span>
            <span
              className={`px-2.5 py-1 rounded-lg font-mono font-bold ${
                overallStatusLabel === 'Operational'
                  ? 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]'
                  : overallStatusLabel === 'Attention Needed'
                    ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                    : 'bg-[#FAF6F0] text-[#49372E] border border-[#E7DDD0]'
              }`}
            >
              {overallStatusLabel} ({operationalPct}% Working)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[#49372E]">
            <UserCheck className="w-4 h-4 text-[#A66A43]" />
            <span>
              Assigned PC Lab Assistant:{' '}
              <strong>
                {assignedAssistantProfile?.name ||
                  activeLabObj?.assigned_assistant_name ||
                  'Unassigned'}
              </strong>
              {assignedAssistantProfile?.email ? ` (${assignedAssistantProfile.email})` : ''}
            </span>
          </div>
        </div>
      </div>

      {bannerMsg && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
            bannerMsg.type === 'success'
              ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
          }`}
        >
          <span>{bannerMsg.text}</span>
          <button type="button" onClick={() => setBannerMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dynamic Summary KPI Cards (Calculated directly from Supabase / Context records) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#6E675F]">
            <span>Total Computers</span>
            <Monitor className="w-4 h-4 text-[#49372E]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#252521] tabular-nums">
            {stats.totalComputers}
          </div>
          <div className="text-[11px] text-[#6E675F]">Student + Staff Fleet</div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#6E675F]">
            <span>Working Computers</span>
            <CheckCircle2 className="w-4 h-4 text-[#2E6F4E]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#2E6F4E] tabular-nums">
            {stats.workingComputers}
          </div>
          <div className="text-[11px] text-[#6E675F]">Operational Systems</div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#6E675F]">
            <span>Defective Computers</span>
            <AlertTriangle className="w-4 h-4 text-[#B91C1C]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#B91C1C] tabular-nums">
            {stats.defectiveComputers}
          </div>
          <div className="text-[11px] text-[#6E675F]">Reported Faults</div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#6E675F]">
            <span>Under Maintenance</span>
            <Wrench className="w-4 h-4 text-[#B45309]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#B45309] tabular-nums">
            {stats.underMaintenanceComputers}
          </div>
          <div className="text-[11px] text-[#6E675F]">In Hardware Service</div>
        </div>

        <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 space-y-1.5 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-xs text-[#6E675F]">
            <span>Staff Computers</span>
            <UserCheck className="w-4 h-4 text-[#A66A43]" />
          </div>
          <div className="font-mono font-bold text-2xl text-[#A66A43] tabular-nums">
            {stats.staffComputers}
          </div>
          <div className="text-[11px] text-[#6E675F]">Faculty &amp; Lab Staff</div>
        </div>
      </div>

      {/* Category Switcher + Search/Filter */}
      <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveCategory('working');
                setStatusFilter('all');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                activeCategory === 'working'
                  ? 'bg-[#49372E] text-white'
                  : 'bg-[#FAF6F0] text-[#49372E] hover:bg-[#E7DDD0]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Working Computers ({categorized.workingStudent.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCategory('defective');
                setStatusFilter('all');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                activeCategory === 'defective'
                  ? 'bg-[#49372E] text-white'
                  : 'bg-[#FAF6F0] text-[#49372E] hover:bg-[#E7DDD0]'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                Defective &amp; Maintenance ({categorized.defectiveOrMaintenanceStudent.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCategory('staff');
                setStatusFilter('all');
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                activeCategory === 'staff'
                  ? 'bg-[#49372E] text-white'
                  : 'bg-[#FAF6F0] text-[#49372E] hover:bg-[#E7DDD0]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Staff Computers ({categorized.staffComputers.length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1 sm:flex-initial justify-end">
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, hostname, room, staff..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF6F0] border border-[#D8CBB9] rounded-xl focus:outline-none focus:border-[#A66A43]"
              />
            </div>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-[#FAF6F0] border border-[#D8CBB9] rounded-xl text-[#252521]"
            >
              <option value="all">All Statuses</option>
              <option value="working">Working</option>
              <option value="defective">Defective</option>
              <option value="under_maintenance">Under Maintenance</option>
              <option value="repaired">Repaired</option>
            </select>
          </div>
        </div>

        {/* Category Data Table */}
        {displayedComputers.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed border-[#E7DDD0] rounded-xl bg-[#FAF6F0]/50">
            <Monitor className="w-9 h-9 text-[#A66A43]/60 mx-auto" />
            <h3 className="font-heading font-bold text-sm text-[#252521]">
              No computers found in this category
            </h3>
            <p className="text-xs text-[#6E675F]">
              {searchQuery
                ? 'Adjust your search query or status filter to view workstations.'
                : 'Use the Add Computer button above to register a workstation.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E7DDD0] rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#49372E]">
                  <th className="px-4 py-3 font-bold">Computer ID</th>
                  {activeCategory === 'staff' ? (
                    <>
                      <th className="px-4 py-3 font-bold">Assigned Staff / Dept</th>
                      <th className="px-4 py-3 font-bold">Specifications</th>
                      <th className="px-4 py-3 font-bold">Working Condition</th>
                      <th className="px-4 py-3 font-bold">Maintenance Status</th>
                    </>
                  ) : activeCategory === 'defective' ? (
                    <>
                      <th className="px-4 py-3 font-bold">Reported Issue &amp; Remarks</th>
                      <th className="px-4 py-3 font-bold">Reported Date</th>
                      <th className="px-4 py-3 font-bold">Repair Status</th>
                      <th className="px-4 py-3 font-bold">Resolution Date</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 font-bold">Hostname &amp; Specs</th>
                      <th className="px-4 py-3 font-bold">Operating System</th>
                      <th className="px-4 py-3 font-bold">Location / Room</th>
                      <th className="px-4 py-3 font-bold">Status &amp; Updated</th>
                    </>
                  )}
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F0E8]">
                {displayedComputers.map((pc) => {
                  const maint = latestMaintenanceByComputer.get(pc.id);
                  const statusMeta = STATUS_BADGE_MAP[pc.status] || STATUS_BADGE_MAP.working;

                  return (
                    <tr key={pc.id} className="hover:bg-[#FAF6F0]/60 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="font-mono font-bold text-[#252521]">{pc.computer_code}</div>
                        <div className="text-[11px] text-[#6E675F]">{pc.hostname || 'Unassigned Host'}</div>
                      </td>

                      {activeCategory === 'staff' ? (
                        <>
                          <td className="px-4 py-3 align-top">
                            <div className="font-semibold text-[#252521]">
                              {pc.assigned_staff_name || 'Unassigned Staff Member'}
                            </div>
                            <div className="text-[11px] text-[#6E675F]">
                              {pc.assigned_department || 'MVIT Department'} · {pc.location}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top max-w-xs">
                            <div className="text-[#49372E]">
                              {pc.specs_summary ||
                                [pc.processor, pc.ram, pc.operating_system].filter(Boolean).join(' · ') ||
                                'Standard Desktop'}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-[#49372E] capitalize">
                            {(pc.maintenance_status || 'operational').replace(/_/g, ' ')}
                          </td>
                        </>
                      ) : activeCategory === 'defective' ? (
                        <>
                          <td className="px-4 py-3 align-top max-w-xs">
                            <div className="font-semibold text-[#252521]">
                              {maint?.reported_issue || 'Hardware / Software Fault'}
                            </div>
                            <div className="text-[11px] text-[#6E675F] line-clamp-2 mt-0.5">
                              {maint?.maintenance_remarks || maint?.defect_description || 'No remarks logged yet.'}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top font-mono text-[#49372E] whitespace-nowrap">
                            {maint?.date_reported || pc.last_updated}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top font-mono text-[#6E675F] whitespace-nowrap">
                            {maint?.resolution_date || 'Pending'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 align-top">
                            <div className="font-medium text-[#252521]">
                              {[pc.processor, pc.ram].filter(Boolean).join(' · ') || pc.specs_summary || 'Standard Lab PC'}
                            </div>
                            <div className="text-[11px] text-[#6E675F]">{pc.storage || 'SSD Storage'}</div>
                          </td>
                          <td className="px-4 py-3 align-top text-[#49372E]">
                            {pc.operating_system || 'Ubuntu / Windows'}
                          </td>
                          <td className="px-4 py-3 align-top text-[#49372E]">
                            {pc.location}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                            <div className="text-[10px] font-mono text-[#6E675F] mt-1">
                              Updated {pc.last_updated}
                            </div>
                          </td>
                        </>
                      )}

                      <td className="px-4 py-3 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailTargetPc(pc)}
                            className="p-1.5 rounded-lg border border-[#E7DDD0] text-[#49372E] hover:bg-[#F5F0E8] cursor-pointer"
                            title="View Computer Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {canMutatePcLab && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(pc)}
                                className="p-1.5 rounded-lg border border-[#E7DDD0] text-[#49372E] hover:bg-[#F5F0E8] cursor-pointer"
                                title="Edit Computer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {pc.status === 'working' || pc.status === 'repaired' ? (
                                <button
                                  type="button"
                                  onClick={() => openReportDefect(pc)}
                                  className="px-2 py-1 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] text-[11px] font-semibold hover:bg-[#FEE2E2] cursor-pointer"
                                >
                                  Report Defect
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openUpdateRepair(pc)}
                                  className="px-2 py-1 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] text-[11px] font-semibold hover:bg-[#FEF3C7] cursor-pointer"
                                >
                                  Update Repair
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setQrTargetPc(pc)}
                                className="p-1.5 rounded-lg bg-[#49372E] hover:bg-[#A66A43] text-white cursor-pointer"
                                title="Generate PC QR Code"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Preserved Complete Maintenance & Defect History (Never Overwritten on Repair) */}
        {activeCategory === 'defective' && (
          <div className="pt-4 border-t border-[#E7DDD0] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-heading font-bold text-sm text-[#252521]">
                  Preserved Maintenance &amp; Defect History ({sortedMaintenanceHistory.length})
                </h3>
                <p className="text-[11px] text-[#6E675F]">
                  Complete chronological defect and repair audit trail. Previous defect incidents remain permanently logged after workstations return to working state.
                </p>
              </div>
            </div>

            {sortedMaintenanceHistory.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] text-xs text-[#6E675F]">
                No defect or maintenance history logged for this PC Laboratory yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-[#E7DDD0] rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#49372E]">
                      <th className="px-4 py-2.5 font-bold">Computer ID</th>
                      <th className="px-4 py-2.5 font-bold">Reported Issue &amp; Remarks</th>
                      <th className="px-4 py-2.5 font-bold">Reported Date</th>
                      <th className="px-4 py-2.5 font-bold">Repair Status</th>
                      <th className="px-4 py-2.5 font-bold">Resolution Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F0E8]">
                    {sortedMaintenanceHistory.map((rec) => {
                      const targetPc = scopedComputers.find((c) => c.id === rec.computer_id);
                      const recMeta = STATUS_BADGE_MAP[rec.repair_status] || STATUS_BADGE_MAP.defective;
                      return (
                        <tr key={rec.id} className="hover:bg-[#FAF6F0]/60">
                          <td className="px-4 py-2.5 font-mono font-bold text-[#252521]">
                            {targetPc?.computer_code || rec.computer_id}
                          </td>
                          <td className="px-4 py-2.5 max-w-md">
                            <div className="font-semibold text-[#252521]">{rec.reported_issue}</div>
                            {(rec.maintenance_remarks || rec.defect_description) && (
                              <div className="text-[11px] text-[#6E675F] mt-0.5">
                                {rec.maintenance_remarks || rec.defect_description}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[#49372E] whitespace-nowrap">
                            {rec.date_reported}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${recMeta.className}`}>
                              {recMeta.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[#6E675F] whitespace-nowrap">
                            {rec.resolution_date || 'Pending'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD / EDIT COMPUTER MODAL */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252521]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-[#E7DDD0] shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 bg-[#49372E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Monitor className="w-5 h-5" />
                <h2 className="font-heading font-bold text-base">
                  {editingPc ? `Edit Computer ${editingPc.computer_code}` : 'Register MVIT PC Lab Workstation'}
                </h2>
              </div>
              <button type="button" aria-label="Close computer form" onClick={() => setIsAddEditOpen(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveComputer} className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#252521] mb-1">
                    Computer Category *
                  </label>
                  <select
                    value={formState.computer_type}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, computer_type: e.target.value as PcComputerType }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9] bg-[#FAF6F0]"
                  >
                    <option value="student_computer">Student-Use Lab Computer</option>
                    <option value="staff_computer">Staff / Faculty Computer (Separate)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#252521] mb-1">
                    Current Status *
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, status: e.target.value as PcComputerStatus }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9] bg-[#FAF6F0]"
                  >
                    <option value="working">Working</option>
                    <option value="defective">Defective</option>
                    <option value="under_maintenance">Under Maintenance</option>
                    <option value="repaired">Repaired</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#252521] mb-1">
                    Computer Identification Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.computer_code}
                    onChange={(e) => setFormState((s) => ({ ...s, computer_code: e.target.value }))}
                    placeholder="e.g. MVIT-PCLAB-06"
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9] font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#252521] mb-1">
                    Computer Name / Hostname
                  </label>
                  <input
                    type="text"
                    value={formState.hostname}
                    onChange={(e) => setFormState((s) => ({ ...s, hostname: e.target.value }))}
                    placeholder="e.g. MVIT-PC06-CSE"
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#252521] mb-1">Processor (Optional)</label>
                  <input
                    type="text"
                    value={formState.processor}
                    onChange={(e) => setFormState((s) => ({ ...s, processor: e.target.value }))}
                    placeholder="e.g. Intel Core i5-12400"
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#252521] mb-1">RAM &amp; Storage (Optional)</label>
                  <input
                    type="text"
                    value={formState.ram}
                    onChange={(e) => setFormState((s) => ({ ...s, ram: e.target.value }))}
                    placeholder="e.g. 16 GB DDR4"
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#252521] mb-1">Operating System</label>
                  <input
                    type="text"
                    value={formState.operating_system}
                    onChange={(e) => setFormState((s) => ({ ...s, operating_system: e.target.value }))}
                    placeholder="Ubuntu 24.04 LTS / Windows 11"
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#252521] mb-1">Location / Room Number *</label>
                  <input
                    type="text"
                    required
                    value={formState.location}
                    onChange={(e) => setFormState((s) => ({ ...s, location: e.target.value }))}
                    placeholder="e.g. Center 401 — Row C, Desk 01"
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                  />
                </div>
              </div>

              {formState.computer_type === 'staff_computer' && (
                <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#252521] mb-1">
                      Assigned Staff Member *
                    </label>
                    <input
                      type="text"
                      required
                      value={formState.assigned_staff_name}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, assigned_staff_name: e.target.value }))
                      }
                      placeholder="e.g. Prof. S. Balasubramanian"
                      className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#252521] mb-1">
                      Assigned Department
                    </label>
                    <input
                      type="text"
                      value={formState.assigned_department}
                      onChange={(e) =>
                        setFormState((s) => ({ ...s, assigned_department: e.target.value }))
                      }
                      placeholder="e.g. Computer Science & Engineering"
                      className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9] bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E7DDD0]">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#D8CBB9] text-[#252521] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#49372E] hover:bg-[#A66A43] text-white font-bold cursor-pointer"
                >
                  {editingPc ? 'Save Workstation Changes' : 'Register Computer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT DEFECT MODAL */}
      {defectTargetPc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252521]/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#E7DDD0] shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 bg-[#B91C1C] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5" />
                <h2 className="font-heading font-bold text-base">
                  Report Defect: {defectTargetPc.computer_code}
                </h2>
              </div>
              <button type="button" aria-label="Close defect report modal" onClick={() => setDefectTargetPc(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDefect} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#252521] mb-1">Reported Issue *</label>
                <input
                  type="text"
                  required
                  value={defectForm.reportedIssue}
                  onChange={(e) => setDefectForm((f) => ({ ...f, reportedIssue: e.target.value }))}
                  placeholder="e.g. Ethernet NIC port failure / Blue screen on boot"
                  className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#252521] mb-1">Defect Description</label>
                <textarea
                  rows={3}
                  value={defectForm.defectDescription}
                  onChange={(e) =>
                    setDefectForm((f) => ({ ...f, defectDescription: e.target.value }))
                  }
                  placeholder="Observed hardware/software symptoms..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#252521] mb-1">Initial Repair Status</label>
                  <select
                    value={defectForm.repairStatus}
                    onChange={(e) =>
                      setDefectForm((f) => ({
                        ...f,
                        repairStatus: e.target.value as 'defective' | 'under_maintenance',
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9] bg-[#FAF6F0]"
                  >
                    <option value="defective">Defective</option>
                    <option value="under_maintenance">Under Maintenance</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#252521] mb-1">Maintenance Remarks</label>
                  <input
                    type="text"
                    value={defectForm.maintenanceRemarks}
                    onChange={(e) =>
                      setDefectForm((f) => ({ ...f, maintenanceRemarks: e.target.value }))
                    }
                    placeholder="Initial triage notes..."
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E7DDD0]">
                <button
                  type="button"
                  onClick={() => setDefectTargetPc(null)}
                  className="px-4 py-2 rounded-xl border border-[#D8CBB9] text-[#252521] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold cursor-pointer"
                >
                  Log Defect Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE REPAIR STATUS MODAL */}
      {repairTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252521]/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#E7DDD0] shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 bg-[#49372E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wrench className="w-5 h-5" />
                <h2 className="font-heading font-bold text-base">
                  Update Repair Status: {repairTarget.pc.computer_code}
                </h2>
              </div>
              <button type="button" aria-label="Close repair update modal" onClick={() => setRepairTarget(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitRepairUpdate} className="p-5 space-y-4 text-xs">
              {repairTarget.record && (
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-1">
                  <div className="font-bold text-[#252521]">{repairTarget.record.reported_issue}</div>
                  <div className="text-[11px] text-[#6E675F]">
                    Reported on {repairTarget.record.date_reported}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#252521] mb-1">Repair Status *</label>
                <select
                  value={repairForm.repairStatus}
                  onChange={(e) =>
                    setRepairForm((f) => ({ ...f, repairStatus: e.target.value as PcComputerStatus }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9] bg-[#FAF6F0]"
                >
                  <option value="defective">Defective</option>
                  <option value="under_maintenance">Under Maintenance</option>
                  <option value="repaired">Repaired (Return to Working)</option>
                  <option value="working">Working</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#252521] mb-1">Maintenance Remarks</label>
                <textarea
                  rows={3}
                  value={repairForm.maintenanceRemarks}
                  onChange={(e) =>
                    setRepairForm((f) => ({ ...f, maintenanceRemarks: e.target.value }))
                  }
                  placeholder="Parts replaced, diagnostics run, or service vendor update..."
                  className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9]"
                />
              </div>

              {(repairForm.repairStatus === 'repaired' || repairForm.repairStatus === 'working') && (
                <div>
                  <label className="block font-semibold text-[#252521] mb-1">Resolution Date</label>
                  <input
                    type="date"
                    value={repairForm.resolutionDate}
                    onChange={(e) =>
                      setRepairForm((f) => ({ ...f, resolutionDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-[#D8CBB9] font-mono"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E7DDD0]">
                <button
                  type="button"
                  onClick={() => setRepairTarget(null)}
                  className="px-4 py-2 rounded-xl border border-[#D8CBB9] text-[#252521] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#2E6F4E] hover:bg-[#23583D] text-white font-bold cursor-pointer"
                >
                  Save Repair Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW COMPUTER DETAILS MODAL */}
      {detailTargetPc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252521]/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-[#E7DDD0] shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 bg-[#FAF6F0] border-b border-[#E7DDD0] flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-[#A66A43]">
                  {detailTargetPc.computer_code}
                </span>
                <h2 className="font-heading font-bold text-lg text-[#252521]">
                  {detailTargetPc.hostname || detailTargetPc.computer_code}
                </h2>
              </div>
              <button type="button" aria-label="Close computer details modal" onClick={() => setDetailTargetPc(null)} className="cursor-pointer">
                <X className="w-5 h-5 text-[#6E675F]" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                  <span className="text-[11px] text-[#6E675F] flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> Processor
                  </span>
                  <div className="font-semibold text-[#252521] mt-1">
                    {detailTargetPc.processor || 'Standard Configuration'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                  <span className="text-[11px] text-[#6E675F] flex items-center gap-1">
                    <HardDrive className="w-3 h-3" /> Memory &amp; Storage
                  </span>
                  <div className="font-semibold text-[#252521] mt-1">
                    {[detailTargetPc.ram, detailTargetPc.storage].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                  <span className="text-[11px] text-[#6E675F] flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Location
                  </span>
                  <div className="font-semibold text-[#252521] mt-1">{detailTargetPc.location}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                  <span className="text-[11px] text-[#6E675F] flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Last Updated
                  </span>
                  <div className="font-mono font-semibold text-[#252521] mt-1">
                    {detailTargetPc.last_updated}
                  </div>
                </div>
              </div>

              {detailTargetPc.computer_type === 'staff_computer' && (
                <div className="p-3.5 rounded-xl bg-[#FBF4EE] border border-[#E7DDD0] space-y-1">
                  <div className="font-bold text-[#49372E]">Staff Assignment</div>
                  <div className="text-[#252521]">
                    {detailTargetPc.assigned_staff_name || 'Assigned Staff'} —{' '}
                    {detailTargetPc.assigned_department || 'MVIT'}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="font-heading font-bold text-xs uppercase tracking-wider text-[#6E675F]">
                  Maintenance &amp; Defect History (
                  {formatCountLabel(
                    scopedMaintenance.filter((r) => r.computer_id === detailTargetPc.id).length,
                    'Record'
                  )}
                  )
                </div>
                {scopedMaintenance.filter((r) => r.computer_id === detailTargetPc.id).length === 0 ? (
                  <p className="text-[#6E675F] p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                    No defects or maintenance incidents recorded for this workstation.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {scopedMaintenance
                      .filter((r) => r.computer_id === detailTargetPc.id)
                      .map((r) => (
                        <div key={r.id} className="p-3 rounded-xl border border-[#E7DDD0] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-[#252521]">{r.reported_issue}</span>
                            <span className="font-mono text-[10px] text-[#6E675F]">{r.date_reported}</span>
                          </div>
                          {r.defect_description && (
                            <p className="text-[#49372E]">{r.defect_description}</p>
                          )}
                          {r.maintenance_remarks && (
                            <p className="text-[11px] text-[#6E675F]">
                              Remarks: {r.maintenance_remarks}
                            </p>
                          )}
                          {r.resolution_date && (
                            <p className="text-[11px] font-mono text-[#2E6F4E]">
                              Resolved: {r.resolution_date}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL PC QR CODE & PRINT MODAL */}
      {qrTargetPc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252521]/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl border border-[#E7DDD0] shadow-2xl overflow-hidden">
            <div className="no-print p-4 bg-[#49372E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                <h2 className="font-heading font-bold text-base">PC Workstation QR Tag</h2>
              </div>
              <button type="button" aria-label="Close QR modal" onClick={() => setQrTargetPc(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-center">
              <div className="p-3 rounded-xl bg-[#EBF5EE] border border-[#C6E3D0] text-xs text-[#2E6F4E] flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Staff-Scoped MVIT Workstation QR Identifier</span>
              </div>

              <div className="p-5 rounded-2xl bg-[#FAF6F0] border border-[#E7DDD0] flex flex-col items-center">
                <div className="w-48 h-48 bg-white p-3 rounded-xl border border-[#D8CBB9] flex items-center justify-center">
                  {qrPngUrl ? (
                    <img
                      src={qrPngUrl}
                      alt={`QR Code for ${qrTargetPc.computer_code}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-[#6E675F]">Generating QR...</span>
                  )}
                </div>
                <div className="mt-3 font-mono font-bold text-sm text-[#252521]">
                  {qrTargetPc.computer_code}
                </div>
                <div className="text-xs font-semibold text-[#A66A43]">{qrTargetPc.hostname}</div>
                <div className="text-[11px] text-[#6E675F] mt-1">{qrTargetPc.location}</div>
              </div>

              <div className="no-print flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  disabled={!qrPngUrl}
                  onClick={() => downloadDataUrl(qrPngUrl, `MVIT_PC_QR_${qrTargetPc.computer_code}.png`)}
                  className="px-3 py-1.5 rounded-lg border border-[#D8CBB9] text-xs font-semibold text-[#252521] hover:bg-[#FAF6F0] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#A66A43]" />
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  disabled={!qrSvgStr}
                  onClick={() => downloadSvgString(qrSvgStr, `MVIT_PC_QR_${qrTargetPc.computer_code}.svg`)}
                  className="px-3 py-1.5 rounded-lg border border-[#D8CBB9] text-xs font-semibold text-[#252521] hover:bg-[#FAF6F0] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#2E6F4E]" />
                  <span>SVG</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Sticker</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
