import React, { useState, useMemo } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Power,
  ArrowLeft,
  X,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useLabverse } from '../../context/LabverseContext';
import { Lab, LabType, PracticalSubject, Experiment } from '../../types';

interface ManageLaboratoriesViewProps {
  onBackToSelection: () => void;
}

export const ManageLaboratoriesView: React.FC<ManageLaboratoriesViewProps> = ({ onBackToSelection }) => {
  const {
    institution,
    currentRole,
    labs,
    labAssistants,
    subjects,
    experiments,
    departments,
    courses,
    laboratoryCourses,
    createNewLab,
    updateExistingLab,
    deactivateExistingLab,
    activateExistingLab,
    setLabCourses,
  } = useLabverse();

  const isAuthorized = currentRole === 'college_admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingLab, setEditingLab] = useState<Lab | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formLabType, setFormLabType] = useState<LabType>('practical');
  const [formCourseIds, setFormCourseIds] = useState<string[]>([]);
  const [formBuilding, setFormBuilding] = useState('');
  const [formRoomNumber, setFormRoomNumber] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formCapacity, setFormCapacity] = useState<number | ''>(40);
  const [formDescription, setFormDescription] = useState('');
  const [formAssistantId, setFormAssistantId] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [confirmDeactivateLab, setConfirmDeactivateLab] = useState<Lab | null>(null);

  const filteredLabs = useMemo(() => {
    return labs.filter((lab) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        lab.name.toLowerCase().includes(q) ||
        lab.lab_code.toLowerCase().includes(q) ||
        (lab.department_name || '').toLowerCase().includes(q) ||
        lab.building.toLowerCase().includes(q) ||
        lab.room_number.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || lab.status === statusFilter;
      const matchesDept = deptFilter === 'all' || lab.department_id === deptFilter;
      return matchesSearch && matchesStatus && matchesDept;
    });
  }, [labs, searchQuery, statusFilter, deptFilter]);

  const getLabStats = (labId: string) => {
    const labSubjects = subjects.filter((s: PracticalSubject) => s.lab_id === labId);
    const subjectIds = new Set(labSubjects.map((s: PracticalSubject) => s.id));
    const labExperiments = experiments.filter(
      (e: Experiment) => e.lab_id === labId || subjectIds.has(e.subject_id)
    );
    return {
      subjectsCount: labSubjects.length,
      experimentsCount: labExperiments.length,
    };
  };

  const openAddModal = () => {
    setFormName('');
    setFormCode('');
    setFormDeptId(departments[0]?.id || '');
    setFormLabType('practical');
    setFormCourseIds(courses.map((c) => c.id));
    setFormBuilding('Science & Engineering Block');
    setFormRoomNumber('');
    setFormLocation('');
    setFormCapacity(40);
    setFormDescription('');
    setFormAssistantId('');
    setFormStatus('active');
    setFormError(null);
    setEditingLab(null);
    setModalMode('add');
  };

  const openEditModal = (lab: Lab) => {
    setFormName(lab.name);
    setFormCode(lab.lab_code);
    setFormDeptId(lab.department_id || departments[0]?.id || '');
    setFormLabType(lab.lab_type || 'practical');
    const existingCourses = laboratoryCourses
      .filter((lc) => lc.lab_id === lab.id)
      .map((lc) => lc.course_id);
    setFormCourseIds(existingCourses.length > 0 ? existingCourses : lab.course_ids || []);
    setFormBuilding(lab.building || '');
    setFormRoomNumber(lab.room_number || '');
    setFormLocation(lab.location || '');
    setFormCapacity(lab.capacity ?? 40);
    setFormDescription(lab.description || '');
    setFormAssistantId(lab.assigned_assistant_id || '');
    setFormStatus(lab.status);
    setFormError(null);
    setEditingLab(lab);
    setModalMode('edit');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = formName.trim();
    const cleanCode = formCode.trim().toUpperCase();
    const cleanBuilding = formBuilding.trim();
    const cleanRoom = formRoomNumber.trim();

    if (!cleanName || !cleanCode || !cleanBuilding || !cleanRoom) {
      setFormError('Laboratory name, code, building, and room number are required.');
      return;
    }

    const deptObj = departments.find((d) => d.id === formDeptId);
    const assistantObj = labAssistants.find((a) => a.id === formAssistantId);

    setIsSubmitting(true);
    try {
      if (modalMode === 'add') {
        const res = await createNewLab({
          department_id: formDeptId || undefined,
          department_name: deptObj?.name || 'Engineering & Applied Sciences',
          lab_code: cleanCode,
          name: cleanName,
          description: formDescription.trim(),
          building: cleanBuilding,
          room_number: cleanRoom,
          location: formLocation.trim() || `${cleanBuilding}, Room ${cleanRoom}`,
          capacity: formCapacity ? Number(formCapacity) : undefined,
          status: formStatus,
          lab_type: formLabType,
          is_public: formLabType !== 'pc_lab',
          image_key: formLabType === 'pc_lab' ? 'pc_lab' : 'electronics',
          course_ids: formLabType === 'pc_lab' ? [] : formCourseIds,
          display_order: labs.length + 1,
          assigned_assistant_id: assistantObj?.id || null,
          assigned_assistant_name: assistantObj?.name || null,
        });

        if (!res.success) {
          setFormError(res.error || 'Failed to register laboratory.');
          return;
        }
        if (res.lab?.id && formCourseIds.length > 0) {
          await setLabCourses(res.lab.id, formCourseIds);
        }
        setSuccessToast(`Laboratory "${cleanName}" (${cleanCode}) registered and published!`);
      } else if (modalMode === 'edit' && editingLab) {
        const res = await updateExistingLab(editingLab.id, {
          name: cleanName,
          lab_code: cleanCode,
          department_id: formDeptId || undefined,
          department_name: deptObj?.name || editingLab.department_name,
          building: cleanBuilding,
          room_number: cleanRoom,
          location: formLocation.trim() || `${cleanBuilding}, Room ${cleanRoom}`,
          capacity: formCapacity ? Number(formCapacity) : undefined,
          description: formDescription.trim(),
          status: formStatus,
          lab_type: formLabType,
          is_public: formLabType !== 'pc_lab',
          course_ids: formLabType === 'pc_lab' ? [] : formCourseIds,
          assigned_assistant_id: assistantObj?.id || null,
          assigned_assistant_name: assistantObj?.name || null,
        });

        if (!res.success) {
          setFormError(res.error || 'Failed to update laboratory.');
          return;
        }
        await setLabCourses(editingLab.id, formCourseIds);
        setSuccessToast(`Laboratory "${cleanName}" updated successfully!`);
      }

      setModalMode(null);
      setTimeout(() => setSuccessToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (lab: Lab) => {
    if (lab.status === 'active') {
      setConfirmDeactivateLab(lab);
      return;
    }
    await activateExistingLab(lab.id);
    setSuccessToast(`Laboratory "${lab.name}" activated and visible on the Public Learning Portal.`);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivateLab) return;
    setIsSubmitting(true);
    try {
      await deactivateExistingLab(confirmDeactivateLab.id);
      setSuccessToast(`Laboratory "${confirmDeactivateLab.name}" deactivated cleanly (records preserved).`);
      setConfirmDeactivateLab(null);
      setTimeout(() => setSuccessToast(null), 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 max-w-md mx-auto text-center shadow-sm">
        <ShieldCheck className="w-8 h-8 text-rose-600 mx-auto mb-3" />
        <h2 className="font-heading text-base font-bold text-[#252521]">Access Restricted</h2>
        <p className="text-xs text-[#6E675F] mt-1">
          Only MVIT College Administrators can create, edit, or deactivate campus laboratories.
        </p>
        <button
          type="button"
          onClick={onBackToSelection}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#49372E] text-white text-xs font-semibold rounded-lg"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToSelection}
            aria-label="Back to Dashboard"
            className="p-2 rounded-lg bg-white border border-[#E7DDD0] text-[#49372E] hover:bg-[#FAF6F0] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-heading font-bold text-xl text-[#252521]">
              Manage MVIT Laboratories
            </h1>
            <p className="text-xs text-[#6E675F]">
              Add, edit, activate, or deactivate laboratories for {institution.name}. Public practical labs appear in the Public Portal; PC Labs remain internal.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-bold shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Laboratory</span>
        </button>
      </div>

      {successToast && (
        <div className="p-3.5 rounded-xl bg-[#EBF5EE] border border-[#C6E3D0] text-[#2E6F4E] text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button type="button" onClick={() => setSuccessToast(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E675F]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by lab name, code, building, room..."
            className="w-full pl-9 pr-3 py-2 bg-[#FAF6F0] border border-[#D8CBB9] rounded-xl text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by Department"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="bg-[#FAF6F0] border border-[#D8CBB9] text-xs rounded-xl px-3 py-2 text-[#252521]"
          >
            <option value="all">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#FAF6F0] border border-[#D8CBB9] text-xs rounded-xl px-3 py-2 text-[#252521]"
          >
            <option value="all">All Statuses ({labs.length})</option>
            <option value="active">Active ({labs.filter((l) => l.status === 'active').length})</option>
            <option value="inactive">Inactive ({labs.filter((l) => l.status === 'inactive').length})</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF6F0] border-b border-[#E7DDD0] text-[#6E675F] font-mono text-[11px] uppercase">
              <tr>
                <th className="py-3.5 px-4">Laboratory</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Department & Location</th>
                <th className="py-3.5 px-4">Assigned Assistant</th>
                <th className="py-3.5 px-4 text-center">Content</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F0E8]">
              {filteredLabs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#6E675F]">
                    No MVIT laboratories match the current filters.
                  </td>
                </tr>
              ) : (
                filteredLabs.map((lab) => {
                  const { subjectsCount, experimentsCount } = getLabStats(lab.id);
                  return (
                    <tr key={lab.id} className="hover:bg-[#FAF6F0]/60">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#252521]">{lab.name}</span>
                          {(lab.lab_type === 'pc_lab' || lab.is_public === false) && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#D8CBB9] text-[#A66A43] font-semibold">
                              Internal Only
                            </span>
                          )}
                        </div>
                        {lab.description && (
                          <div className="text-[11px] text-[#6E675F] line-clamp-1 max-w-xs">
                            {lab.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-[#49372E] whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#D8CBB9] whitespace-nowrap">
                          {lab.lab_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-[#252521] font-medium">{lab.department_name}</div>
                        <div className="text-[11px] text-[#6E675F]">
                          {lab.building}, Room {lab.room_number}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {lab.assigned_assistant_name ? (
                          <span className="inline-flex items-center gap-1 text-[#252521] font-medium">
                            <UserCheck className="w-3.5 h-3.5 text-[#2E6F4E] shrink-0" />
                            {lab.assigned_assistant_name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#B91C1C]">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono text-[11px] text-[#6E675F] whitespace-nowrap">
                        {lab.lab_type === 'pc_lab' || lab.is_public === false
                          ? 'Internal Lab'
                          : `${subjectsCount} Subj • ${experimentsCount} Exp`}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            lab.status === 'active'
                              ? 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]'
                              : 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                          }`}
                        >
                          {lab.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(lab)}
                            aria-label={`Edit ${lab.name}`}
                            className="p-1.5 rounded-lg border border-[#E7DDD0] text-[#49372E] hover:bg-[#FAF6F0] cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(lab)}
                            aria-label={lab.status === 'active' ? `Deactivate ${lab.name}` : `Activate ${lab.name}`}
                            className={`p-1.5 rounded-lg border cursor-pointer ${
                              lab.status === 'active'
                                ? 'border-[#FDE68A] text-[#B45309] hover:bg-[#FFFBEB]'
                                : 'border-[#C6E3D0] text-[#2E6F4E] hover:bg-[#EBF5EE]'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 bg-[#252521]/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-2xl max-w-lg w-full overflow-hidden my-8">
            <div className="p-5 border-b border-[#E7DDD0] bg-[#FAF6F0] flex items-center justify-between">
              <div>
                <h2 className="font-heading text-base font-bold text-[#252521]">
                  {modalMode === 'add' ? 'Register New MVIT Laboratory' : `Edit Laboratory: ${editingLab?.lab_code}`}
                </h2>
                <p className="text-xs text-[#6E675F] mt-0.5">
                  Configure lab details and optional primary Lab Assistant assignment.
                </p>
              </div>
              <button type="button" onClick={() => setModalMode(null)} className="p-1 text-[#6E675F] hover:text-[#252521]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#252521] mb-1">
                  Laboratory Name *
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Electronic Devices Lab"
                  className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Laboratory Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EDL-01"
                    className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Department
                  </label>
                  <select
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs bg-white"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Building / Block *
                  </label>
                  <input
                    type="text"
                    required
                    value={formBuilding}
                    onChange={(e) => setFormBuilding(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={formRoomNumber}
                    onChange={(e) => setFormRoomNumber(e.target.value)}
                    placeholder="e.g. ECE-204"
                    className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Laboratory Type
                  </label>
                  <select
                    value={formLabType}
                    onChange={(e) => setFormLabType(e.target.value as LabType)}
                    className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs bg-white"
                  >
                    <option value="practical">Practical Teaching Lab</option>
                    <option value="pc_lab">PC / Computer Laboratory</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Capacity (Seats / Systems)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252521] mb-1">
                  Assign Lab Assistant
                </label>
                <select
                  value={formAssistantId}
                  onChange={(e) => setFormAssistantId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs bg-white"
                >
                  <option value="">-- Unassigned --</option>
                  {labAssistants.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.identifier})
                    </option>
                  ))}
                </select>
              </div>

              {formLabType === 'pc_lab' ? (
                <div className="p-3 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] text-xs text-[#49372E]">
                  PC / Computer Laboratories are internal staff-managed labs. They are hidden from the Public Learning Portal and their workstation records are accessible only to the assigned PC Lab Assistant.
                </div>
              ) : (
                courses.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-[#252521] mb-1.5">
                      Applicable Courses (Public Learning Portal)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {courses.map((course) => {
                        const checked = formCourseIds.includes(course.id);
                        return (
                          <label
                            key={course.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                              checked
                                ? 'bg-[#FAF6F0] border-[#A66A43] text-[#49372E] font-semibold'
                                : 'bg-white border-[#E7DDD0] text-[#6E675F]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setFormCourseIds((prev) =>
                                  prev.includes(course.id)
                                    ? prev.filter((id) => id !== course.id)
                                    : [...prev, course.id]
                                )
                              }
                            />
                            <span className="font-mono">{course.code}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              <div>
                <label className="block text-xs font-semibold text-[#252521] mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Practical scope and key instrumentation..."
                  className="w-full px-3 py-2 border border-[#D8CBB9] rounded-lg text-xs"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-[#252521] cursor-pointer">
                <input
                  type="checkbox"
                  checked={formStatus === 'active'}
                  onChange={(e) => setFormStatus(e.target.checked ? 'active' : 'inactive')}
                />
                <span>
                  {formLabType === 'pc_lab'
                    ? 'Active Internal Laboratory (Assignable to PC Lab Assistant)'
                    : 'Publish laboratory as Active in MVIT Public Learning Portal'}
                </span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-lg border border-[#D8CBB9] text-xs font-semibold text-[#49372E]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#49372E] hover:bg-[#A66A43] text-xs font-semibold text-white cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : modalMode === 'add' ? 'Register Laboratory' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Confirmation */}
      {confirmDeactivateLab && (
        <div className="fixed inset-0 z-50 bg-[#252521]/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-[#E7DDD0] bg-[#FFFBEB] flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-[#B45309] shrink-0" />
              <div>
                <h2 className="font-heading text-sm font-bold text-[#252521]">Deactivate Laboratory?</h2>
                <p className="text-[11px] font-mono text-[#6E675F]">
                  {confirmDeactivateLab.lab_code} • {confirmDeactivateLab.name}
                </p>
              </div>
            </div>
            <div className="p-5 space-y-3 text-xs text-[#49372E]">
              <p>
                Deactivating <strong>{confirmDeactivateLab.name}</strong> hides it from the Public User Learning Portal without deleting existing subjects, experiments, PDFs, or inventory records.
              </p>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
                <button
                  type="button"
                  onClick={() => setConfirmDeactivateLab(null)}
                  className="px-4 py-2 rounded-lg border border-[#D8CBB9] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeactivate}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#B45309] hover:bg-[#92400E] text-white text-xs font-semibold"
                >
                  {isSubmitting ? 'Deactivating...' : 'Confirm Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
