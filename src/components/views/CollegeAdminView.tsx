import React, { useState, useMemo } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import { ActiveTab } from '../navigation/Sidebar';
import { SupabaseInfoModal } from '../common/SupabaseInfoModal';
import { Modal } from '../common/Modal';
import {
  FlaskConical,
  Users,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Building2,
  History,
  Download,
  Database,
  Plus,
  Clock,
  ArrowRight,
  GitBranch,
  Layers,
  GraduationCap,
} from 'lucide-react';
import { isPublicVisibleLab } from '../../utils/labRules';

interface CollegeAdminViewProps {
  initialSection?: 'dashboard' | 'assignments' | 'settings';
  onSelectTab: (tab: ActiveTab) => void;
}

export const CollegeAdminView: React.FC<CollegeAdminViewProps> = ({
  initialSection = 'dashboard',
  onSelectTab,
}) => {
  const {
    institution,
    labs,
    labAssistants,
    subjects,
    experiments,
    departments,
    courses,
    laboratoryCourses,
    addDepartment,
    addCourse,
    updateCourse,
    setLabCourses,
    assignAssistantToLab,
    updateUserLabAssignments,
    auditLogs,
    exportToCsv,
  } = useLabverse();

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showSupabaseModal, setShowSupabaseModal] = useState(false);

  // Add Department Modal
  const [isAddDeptOpen, setIsAddDeptOpen] = useState(false);
  const [deptCode, setDeptCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [deptHead, setDeptHead] = useState('');
  const [deptDesc, setDeptDesc] = useState('');

  // Add Course State
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDegree, setNewCourseDegree] = useState('B.Tech');

  // KPI computations
  const totalLabs = labs.length;
  const activeLabsCount = labs.filter((l) => l.status === 'active').length;
  const publicLabsCount = labs.filter((l) => isPublicVisibleLab(l)).length;
  const internalLabsCount = Math.max(0, activeLabsCount - publicLabsCount);
  const inactiveLabsCount = labs.filter((l) => l.status === 'inactive').length;
  const totalAssistants = labAssistants.length;
  const unassignedLabsCount = labs.filter((l) => !l.assigned_assistant_id).length;

  const recentlyUpdatedLabs = useMemo(
    () =>
      [...labs]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5),
    [labs]
  );

  const showNotice = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const handleAssignAssistant = async (labId: string, assistantId: string) => {
    const res = await assignAssistantToLab(labId, assistantId || null);
    if (!res.success) {
      showNotice('error', res.error || 'Failed to update assignment.');
      return;
    }
    const targetLab = labs.find((l) => l.id === labId);
    const targetAsst = labAssistants.find((a) => a.id === assistantId);
    showNotice(
      'success',
      targetAsst
        ? `Assigned ${targetAsst.name} to ${targetLab?.name || labId}.`
        : `Cleared Lab Assistant assignment for ${targetLab?.name || labId}.`
    );
  };

  const handleToggleAssistantLabCheckbox = async (assistantId: string, labId: string, currentlyChecked: boolean) => {
    const assistant = labAssistants.find((a) => a.id === assistantId);
    if (!assistant) return;
    const currentIds = assistant.assigned_lab_ids || [];
    const nextIds = currentlyChecked
      ? currentIds.filter((id) => id !== labId)
      : Array.from(new Set([...currentIds, labId]));
    const res = await updateUserLabAssignments(assistantId, nextIds);
    if (!res.success) {
      showNotice('error', res.error || 'Failed to update assistant laboratory access.');
    } else {
      showNotice('success', `Updated laboratory access for ${assistant.name}.`);
    }
  };

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptCode.trim() || !deptName.trim()) return;
    const res = await addDepartment({
      code: deptCode.trim().toUpperCase(),
      name: deptName.trim(),
      head_faculty_name: deptHead.trim() || 'MVIT Faculty In-Charge',
      description: deptDesc.trim() || 'MVIT academic laboratory department.',
    });
    if (!res.success) {
      showNotice('error', res.error || 'Failed to create MVIT department.');
      return;
    }
    setIsAddDeptOpen(false);
    setDeptCode('');
    setDeptName('');
    setDeptHead('');
    setDeptDesc('');
    showNotice('success', 'MVIT academic department added.');
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode.trim() || !newCourseName.trim()) return;
    const res = await addCourse({
      code: newCourseCode.trim().toUpperCase(),
      name: newCourseName.trim(),
      degree: newCourseDegree.trim() || 'B.Tech',
      description: `${newCourseName.trim()} laboratory curriculum.`,
      is_active: true,
      display_order: courses.length + 1,
    });
    if (!res.success) {
      showNotice('error', res.error || 'Failed to add course.');
      return;
    }
    setNewCourseCode('');
    setNewCourseName('');
    showNotice('success', `Added course ${newCourseCode.trim().toUpperCase()}.`);
  };

  const handleToggleLabCourse = async (labId: string, courseId: string) => {
    const current = laboratoryCourses
      .filter((lc) => lc.lab_id === labId)
      .map((lc) => lc.course_id);
    const exists = current.includes(courseId);
    const next = exists ? current.filter((id) => id !== courseId) : [...current, courseId];
    const res = await setLabCourses(labId, next);
    if (!res.success) {
      showNotice('error', res.error || 'Failed to update laboratory course mapping.');
    }
  };

  const handleToggleCourseAvailability = async (courseId: string, currentlyActive: boolean) => {
    const res = await updateCourse(courseId, { is_active: !currentlyActive });
    if (!res.success) {
      showNotice('error', res.error || 'Failed to update course availability.');
    } else {
      const target = courses.find((c) => c.id === courseId);
      showNotice(
        'success',
        `${target?.code || 'Course'} is now ${!currentlyActive ? 'active on the public portal' : 'hidden from public selection'}.`
      );
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
              : 'bg-[#FEF2F2] border-[#FECACA] text-[#B91C1C]'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ==================== DASHBOARD SECTION ==================== */}
      {initialSection === 'dashboard' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-xl text-[#252521]">
                MVIT College Admin Dashboard
              </h1>
              <p className="text-xs text-[#6E675F] mt-0.5">
                Monitor all Manakula Vinayagar Institute of Technology laboratories and Lab Assistant assignments.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectTab('manage_labs')}
                className="px-3.5 py-2 rounded-xl bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Manage Laboratories</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectTab('assistants')}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#D8CBB9] hover:border-[#A66A43] text-[#49372E] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5 text-[#A66A43]" />
                <span>Lab Assistant Management</span>
              </button>
            </div>
          </div>

          {/* 5 Exact KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-[#E7DDD0] shadow-sm">
              <div className="text-xs text-[#6E675F] flex items-center justify-between">
                <span>Total Laboratories</span>
                <FlaskConical className="w-4 h-4 text-[#49372E]" />
              </div>
              <div className="font-mono font-bold text-2xl text-[#252521] mt-2">{totalLabs}</div>
              <div className="text-[11px] text-[#6E675F] mt-0.5">MVIT registered labs</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E7DDD0] shadow-sm">
              <div className="text-xs text-[#6E675F] flex items-center justify-between">
                <span>Active Laboratories</span>
                <CheckCircle2 className="w-4 h-4 text-[#2E6F4E]" />
              </div>
              <div className="font-mono font-bold text-2xl text-[#2E6F4E] mt-2">{activeLabsCount}</div>
              <div className="text-[11px] text-[#6E675F] mt-0.5">
                {publicLabsCount} public • {internalLabsCount} internal
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E7DDD0] shadow-sm">
              <div className="text-xs text-[#6E675F] flex items-center justify-between">
                <span>Inactive Laboratories</span>
                <AlertTriangle className="w-4 h-4 text-[#D99022]" />
              </div>
              <div className="font-mono font-bold text-2xl text-[#D99022] mt-2">{inactiveLabsCount}</div>
              <div className="text-[11px] text-[#6E675F] mt-0.5">Archived / maintenance</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E7DDD0] shadow-sm">
              <div className="text-xs text-[#6E675F] flex items-center justify-between">
                <span>Total Lab Assistants</span>
                <Users className="w-4 h-4 text-[#A66A43]" />
              </div>
              <div className="font-mono font-bold text-2xl text-[#A66A43] mt-2">{totalAssistants}</div>
              <div className="text-[11px] text-[#6E675F] mt-0.5">Staff operators</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-[#E7DDD0] shadow-sm col-span-2 sm:col-span-1">
              <div className="text-xs text-[#6E675F] flex items-center justify-between">
                <span>Unassigned Labs</span>
                <UserCheck className="w-4 h-4 text-[#B91C1C]" />
              </div>
              <div
                className={`font-mono font-bold text-2xl mt-2 ${
                  unassignedLabsCount > 0 ? 'text-[#B91C1C]' : 'text-[#2E6F4E]'
                }`}
              >
                {unassignedLabsCount}
              </div>
              <div className="text-[11px] text-[#6E675F] mt-0.5">Without assigned assistant</div>
            </div>
          </div>

          {/* Lab Summary Table + Recently Updated */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white rounded-2xl border border-[#E7DDD0] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E7DDD0] flex items-center justify-between">
                <div>
                  <h2 className="font-heading font-bold text-base text-[#252521]">
                    MVIT Laboratory Directory & Assistant Coverage
                  </h2>
                  <p className="text-xs text-[#6E675F]">
                    Assigned Lab Assistants, curriculum counts, and operational status.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTab('assignments')}
                  className="text-xs font-semibold text-[#A66A43] hover:text-[#49372E] inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Assign Assistants</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#6E675F] font-mono text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Laboratory</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Assigned Lab Assistant</th>
                      <th className="py-3 px-4 text-center">Resources</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F0E8]">
                    {labs.map((lab) => {
                      const isInternal = lab.is_public === false || lab.lab_type === 'pc_lab';
                      const subjCount = subjects.filter((s) => s.lab_id === lab.id).length;
                      const expCount = experiments.filter((e) => e.lab_id === lab.id).length;
                      return (
                        <tr key={lab.id} className="hover:bg-[#FAF6F0]/60">
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-[#252521] whitespace-nowrap">{lab.name}</span>
                              {isInternal && (
                                <span className="px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#D8CBB9] font-mono text-[10px] text-[#6E675F] font-semibold whitespace-nowrap">
                                  Internal Only
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-[#A66A43]">{lab.lab_code}</div>
                          </td>
                          <td className="py-3 px-4 text-[#49372E]">{lab.department_name || 'Engineering'}</td>
                          <td className="py-3 px-4">
                            {lab.assigned_assistant_name ? (
                              <span className="inline-flex items-center gap-1.5 font-medium text-[#252521] whitespace-nowrap">
                                <UserCheck className="w-3.5 h-3.5 text-[#2E6F4E] shrink-0" />
                                {lab.assigned_assistant_name}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#B91C1C] font-semibold">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-[11px] text-[#6E675F] whitespace-nowrap">
                            {isInternal ? 'Internal Lab' : `${subjCount} Subj • ${expCount} Exp`}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                lab.status === 'active'
                                  ? 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]'
                                  : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                              }`}
                            >
                              {lab.status === 'active' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-4 bg-white rounded-2xl border border-[#E7DDD0] shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-base text-[#252521] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#A66A43]" />
                  <span>Recently Updated Labs</span>
                </h2>
              </div>
              <div className="space-y-3">
                {recentlyUpdatedLabs.map((lab) => (
                  <div
                    key={lab.id}
                    className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#252521] truncate">{lab.name}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#D8CBB9] text-[#49372E]">
                        {lab.lab_code}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6E675F]">
                      Assistant: {lab.assigned_assistant_name || 'Unassigned'}
                    </div>
                    <div className="text-[10px] font-mono text-[#6E675F]">
                      Updated {new Date(lab.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== LABORATORY ASSIGNMENTS SECTION ==================== */}
      {initialSection === 'assignments' && (
        <div className="space-y-6">
          <div>
            <h1 className="font-heading font-bold text-xl text-[#252521]">
              Laboratory Assignments
            </h1>
            <p className="text-xs text-[#6E675F] mt-0.5">
              Assign specific MVIT Lab Assistants to each laboratory so they can manage practical subjects, manuals, resources, and inventory.
            </p>
          </div>

          {/* Assign Primary Assistant Per Laboratory */}
          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E7DDD0] flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#A66A43]" />
              <h2 className="font-heading font-bold text-sm text-[#252521]">
                Primary Lab Assistant by Laboratory
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#6E675F] font-mono text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Laboratory</th>
                    <th className="py-3 px-4">Department & Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Lab Assistant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F0E8]">
                  {labs.map((lab) => (
                    <tr key={lab.id} className="hover:bg-[#FAF6F0]/60">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#252521]">{lab.name}</span>
                          {(lab.is_public === false || lab.lab_type === 'pc_lab') && (
                            <span className="px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#D8CBB9] font-mono text-[10px] text-[#6E675F]">
                              Internal
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-[#A66A43]">{lab.lab_code}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[#49372E]">
                        <div>{lab.department_name}</div>
                        <div className="text-[11px] text-[#6E675F]">
                          {lab.building}, Room {lab.room_number}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            lab.status === 'active'
                              ? 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]'
                              : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                          }`}
                        >
                          {lab.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <select
                          aria-label={`Assign Lab Assistant for ${lab.name}`}
                          value={lab.assigned_assistant_id || ''}
                          onChange={(e) => handleAssignAssistant(lab.id, e.target.value)}
                          className="w-full max-w-xs px-3 py-2 text-xs bg-[#FAF6F0] border border-[#D8CBB9] rounded-lg text-[#252521]"
                        >
                          <option value="">-- Unassigned --</option>
                          {labAssistants
                            .filter((a) => a.status !== 'suspended')
                            .map((assistant) => (
                              <option key={assistant.id} value={assistant.id}>
                                {assistant.name} ({assistant.identifier})
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Multi-Lab Access Matrix per Lab Assistant */}
          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-sm p-5 space-y-4">
            <h2 className="font-heading font-bold text-sm text-[#252521]">
              Multi-Laboratory Permissions by Lab Assistant
            </h2>
            {labAssistants.length === 0 ? (
              <p className="text-xs text-[#6E675F]">
                No Lab Assistants registered yet. Add Lab Assistants in Lab Assistant Management first.
              </p>
            ) : (
              <div className="space-y-3">
                {labAssistants.map((assistant) => (
                  <div
                    key={assistant.id}
                    className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs text-[#252521]">{assistant.name}</span>
                        <span className="ml-2 font-mono text-[11px] text-[#A66A43]">
                          {assistant.identifier}
                        </span>
                        <span className="ml-2 text-[11px] text-[#6E675F]">{assistant.email}</span>
                      </div>
                      <span className="text-[11px] font-mono text-[#6E675F]">
                        {(assistant.assigned_lab_ids || []).length} assigned lab(s)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {labs.map((lab) => {
                        const checked = Boolean(assistant.assigned_lab_ids?.includes(lab.id));
                        return (
                          <label
                            key={lab.id}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${
                              checked
                                ? 'bg-white border-[#A66A43] text-[#49372E] font-semibold'
                                : 'bg-white/60 border-[#E7DDD0] text-[#6E675F]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                handleToggleAssistantLabCheckbox(assistant.id, lab.id, checked)
                              }
                            />
                            <span className="font-mono text-[11px]">{lab.lab_code}</span>
                            <span>{lab.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Courses & Lab-Course Assignment Matrix */}
          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-sm p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading font-bold text-sm text-[#252521] flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-[#A66A43]" />
                  <span>Academic Courses &amp; Laboratory Mapping ({courses.length})</span>
                </h2>
                <p className="text-xs text-[#6E675F] mt-0.5">
                  Configure which B.Tech / academic courses appear inside each laboratory on the public learning portal.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateCourse} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
              <input
                type="text"
                required
                placeholder="Course Code (e.g. AIDS)"
                value={newCourseCode}
                onChange={(e) => setNewCourseCode(e.target.value)}
                className="px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white font-mono uppercase"
              />
              <input
                type="text"
                required
                placeholder="Course Name (e.g. AI & Data Science)"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                className="sm:col-span-2 px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCourseDegree}
                  onChange={(e) => setNewCourseDegree(e.target.value)}
                  className="w-20 px-2.5 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                />
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  + Add Course
                </button>
              </div>
            </form>

            {/* Course Availability Toggles */}
            <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-2">
              <div className="text-xs font-bold text-[#252521]">
                MVIT Official Course Availability
              </div>
              <div className="flex flex-wrap gap-2">
                {courses.map((course) => {
                  const isActive = course.is_active !== false;
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => handleToggleCourseAvailability(course.id, isActive)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E] font-semibold'
                          : 'bg-white border-[#E7DDD0] text-[#6E675F]'
                      }`}
                      title={`Toggle ${course.code} availability`}
                    >
                      <span className="font-mono font-bold">{course.code}</span>
                      <span className="text-[11px]">{course.name}</span>
                      <span className="font-mono text-[10px] uppercase">
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {labs
                .filter((lab) => lab.is_public !== false && lab.lab_type !== 'pc_lab')
                .map((lab) => {
                const mappedIds = new Set(
                  laboratoryCourses.filter((lc) => lc.lab_id === lab.id).map((lc) => lc.course_id)
                );
                return (
                  <div key={lab.id} className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#252521]">
                        {lab.name} <span className="font-mono text-[#A66A43]">({lab.lab_code})</span>
                      </span>
                      <span className="font-mono text-[11px] text-[#6E675F]">
                        {mappedIds.size} course(s) linked
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {courses.map((course) => {
                        const checked = mappedIds.has(course.id);
                        return (
                          <label
                            key={course.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                              checked
                                ? 'bg-white border-[#A66A43] text-[#49372E] font-semibold'
                                : 'bg-white/60 border-[#E7DDD0] text-[#6E675F]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleLabCourse(lab.id, course.id)}
                            />
                            <span className="font-mono">{course.code}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SETTINGS SECTION ==================== */}
      {initialSection === 'settings' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-heading font-bold text-xl text-[#252521]">
                MVIT Portal Settings & Audit Trail
              </h1>
              <p className="text-xs text-[#6E675F] mt-0.5">
                Institution configuration, academic departments, database diagnostics, and activity exports.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowSupabaseModal(true)}
                className="px-3.5 py-2 rounded-xl bg-white border border-[#D8CBB9] hover:border-[#A66A43] text-[#49372E] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-[#A66A43]" />
                <span>Backend & Supabase Status</span>
              </button>
              <button
                type="button"
                onClick={() => exportToCsv('audit_logs')}
                className="px-3.5 py-2 rounded-xl bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Audit Logs (CSV)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Institution Fixed Details */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E7DDD0] p-5 space-y-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#A66A43]" />
                <h2 className="font-heading font-bold text-sm text-[#252521]">
                  Single-Institution Configuration
                </h2>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                  <div className="text-[11px] text-[#6E675F]">Institution</div>
                  <div className="font-bold text-[#252521] mt-0.5">{institution.name}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                  <div className="text-[11px] text-[#6E675F]">Institution Code & Domain</div>
                  <div className="font-mono font-bold text-[#49372E] mt-0.5">
                    {institution.code} • {institution.domain}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0]">
                  <div className="text-[11px] text-[#6E675F]">Campus Address</div>
                  <div className="text-[#252521] mt-0.5">{institution.address}</div>
                </div>
              </div>
            </div>

            {/* Departments Manager */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E7DDD0] p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-bold text-sm text-[#252521] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#A66A43]" />
                  <span>MVIT Departments ({departments.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddDeptOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Department</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {departments.map((d) => (
                  <div key={d.id} className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-1 text-xs">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-[#49372E] text-white">
                      {d.code}
                    </span>
                    <div className="font-bold text-[#252521] mt-1">{d.name}</div>
                    <div className="text-[11px] text-[#6E675F]">{d.head_faculty_name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E7DDD0] flex items-center gap-2">
              <History className="w-4 h-4 text-[#A66A43]" />
              <h2 className="font-heading font-bold text-sm text-[#252521]">
                MVIT Activity Audit Logs ({auditLogs.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#6E675F] font-mono text-[11px]">
                  <tr>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-4">Details</th>
                    <th className="py-2.5 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F0E8]">
                  {auditLogs.slice(0, 20).map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 px-4 font-mono font-bold text-[#A66A43]">{log.action}</td>
                      <td className="py-2.5 px-4 font-semibold text-[#252521]">{log.user_name}</td>
                      <td className="py-2.5 px-4 font-mono text-[10px] uppercase text-[#6E675F]">
                        {log.user_role}
                      </td>
                      <td className="py-2.5 px-4 text-[#49372E]">{log.details}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#6E675F]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <SupabaseInfoModal isOpen={showSupabaseModal} onClose={() => setShowSupabaseModal(false)} />

          <Modal
            isOpen={isAddDeptOpen}
            onClose={() => setIsAddDeptOpen(false)}
            title="Add MVIT Department"
            subtitle="Configure a department grouping for MVIT laboratories and subjects"
          >
            <form onSubmit={handleCreateDept} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">Dept Code *</label>
                  <input
                    type="text"
                    required
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="e.g. AI-DS"
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-[#252521] mb-1">Department Name *</label>
                  <input
                    type="text"
                    required
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Artificial Intelligence & Data Science"
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#252521] mb-1">Department Head</label>
                <input
                  type="text"
                  value={deptHead}
                  onChange={(e) => setDeptHead(e.target.value)}
                  placeholder="e.g. Dr. M. Sundar"
                  className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#252521] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={deptDesc}
                  onChange={(e) => setDeptDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
                <button
                  type="button"
                  onClick={() => setIsAddDeptOpen(false)}
                  className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg text-[#49372E]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs bg-[#49372E] hover:bg-[#A66A43] text-white font-semibold rounded-lg"
                >
                  Add Department
                </button>
              </div>
            </form>
          </Modal>
        </div>
      )}
    </div>
  );
};
