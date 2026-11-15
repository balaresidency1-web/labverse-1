import React, { useState, useEffect } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import {
  formatCountLabel,
  getYearFromSemester,
  formatAcademicYearLabel,
} from '../../utils/labRules';
import { PracticalSubject } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import {
  FlaskConical,
  Plus,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Search,
  Edit3,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';

interface SubjectsListViewProps {
  onSelectExperiment: (experimentId: string) => void;
  selectedSubjectId?: string;
}

export const SubjectsListView: React.FC<SubjectsListViewProps> = ({
  onSelectExperiment,
  selectedSubjectId,
}) => {
  const {
    labSubjects,
    labExperiments,
    departments,
    courses,
    selectedLab,
    selectedLabId,
    currentUser,
    currentRole,
    addSubject,
    updateSubject,
    deleteSubject,
  } = useLabverse();

  const [activeDepartmentId, setActiveDepartmentId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubjectId, setActiveSubjectId] = useState<string>(
    selectedSubjectId || labSubjects[0]?.id || ''
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add / Edit Subject Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<PracticalSubject | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [deptId, setDeptId] = useState(departments[0]?.id || '');
  const [courseId, setCourseId] = useState('');
  const [credits, setCredits] = useState(2);
  const [semester, setSemester] = useState(1);
  const [desc, setDesc] = useState('');
  const [location, setLocation] = useState(selectedLab?.location || 'MVIT Academic Block');
  const [scheduleInfo, setScheduleInfo] = useState('Mon – Fri Laboratory Batches');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedSubjectId) {
      setActiveSubjectId(selectedSubjectId);
    } else if (labSubjects.length > 0 && !labSubjects.some((s) => s.id === activeSubjectId)) {
      setActiveSubjectId(labSubjects[0].id);
    }
  }, [selectedSubjectId, labSubjects, activeSubjectId]);

  useEffect(() => {
    setDeptId(selectedLab?.department_id || departments[0]?.id || '');
    setLocation(selectedLab?.location || 'MVIT Academic Block');
  }, [departments, selectedLab]);

  const filteredSubjects = labSubjects.filter((s) => {
    const matchesDept =
      activeDepartmentId === 'all' || s.department_id === activeDepartmentId;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDept && matchesSearch;
  });

  const activeSubject =
    labSubjects.find((s) => s.id === activeSubjectId) || filteredSubjects[0];
  const subjectExperiments = activeSubject
    ? labExperiments.filter((e) => e.subject_id === activeSubject.id)
    : [];

  const canModify = currentRole === 'lab_assistant' || currentRole === 'college_admin';

  const openCreateModal = () => {
    setEditingSubject(null);
    setCode('');
    setName('');
    setDeptId(selectedLab?.department_id || departments[0]?.id || '');
    setCourseId('');
    setCredits(2);
    setSemester(1);
    setDesc('');
    setLocation(selectedLab?.location || 'MVIT Academic Block');
    setScheduleInfo('Mon – Fri Practical Schedule');
    setIsModalOpen(true);
  };

  const openEditModal = (subj: PracticalSubject) => {
    setEditingSubject(subj);
    setCode(subj.code);
    setName(subj.name);
    setDeptId(subj.department_id);
    setCourseId(subj.course_id || '');
    setCredits(subj.credits);
    setSemester(subj.semester);
    setDesc(subj.description);
    setLocation(subj.location);
    setScheduleInfo(subj.schedule_info);
    setIsModalOpen(true);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const dept = departments.find((d) => d.id === deptId);

    if (editingSubject) {
      const res = await updateSubject(editingSubject.id, {
        department_id: deptId,
        department_name: dept?.name || editingSubject.department_name,
        course_id: courseId || undefined,
        code: code.toUpperCase(),
        name,
        credits,
        semester,
        description: desc,
        location,
        schedule_info: scheduleInfo,
      });
      if (!res.success) {
        setFeedback({ type: 'error', text: res.error || 'Failed to update subject.' });
      } else {
        setFeedback({ type: 'success', text: `Updated practical subject ${code.toUpperCase()}.` });
      }
    } else {
      const res = await addSubject({
        lab_id: selectedLabId || undefined,
        department_id: deptId,
        department_name: dept?.name || 'Science & Humanities',
        course_id: courseId || undefined,
        code: code.toUpperCase(),
        name,
        credits,
        semester,
        lab_assistant_id: currentUser?.id,
        lab_assistant_name: currentUser?.name,
        description: desc,
        schedule_info: scheduleInfo,
        location: location || selectedLab?.location || 'MVIT Laboratory Block',
        is_active: true,
        syllabus: [
          {
            id: `syl-${Date.now()}-1`,
            subject_id: '',
            unit_number: 1,
            title: 'Foundational Laboratory Experiments',
            description: 'Core apparatus calibration, safety protocol, and baseline measurements.',
            learning_outcomes: [
              'Operate laboratory apparatus safely',
              'Record observations and compute experimental errors',
            ],
          },
        ],
      });
      if (!res.success) {
        setFeedback({ type: 'error', text: res.error || 'Failed to create practical subject.' });
      } else {
        if (res.id) setActiveSubjectId(res.id);
        setFeedback({ type: 'success', text: `Created practical subject ${code.toUpperCase()}.` });
      }
    }
    setIsModalOpen(false);
  };

  const handleToggleActive = async (subj: PracticalSubject) => {
    const nextActive = subj.is_active === false;
    const res = await updateSubject(subj.id, { is_active: nextActive });
    if (!res.success) {
      setFeedback({ type: 'error', text: res.error || 'Could not update visibility.' });
    } else {
      setFeedback({
        type: 'success',
        text: `${subj.code} is now ${nextActive ? 'visible on the Public Portal' : 'hidden from Public Portal'}.`,
      });
    }
  };

  const handleDelete = async (subjId: string) => {
    const res = await deleteSubject(subjId);
    setConfirmDeleteId(null);
    if (!res.success) {
      setFeedback({ type: 'error', text: res.error || 'Could not delete subject.' });
    } else {
      setFeedback({ type: 'success', text: 'Practical subject deleted.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading font-bold text-xl text-[#252521]">
            Practical Subjects{selectedLab ? ` — ${selectedLab.name}` : ''}
          </h1>
          <p className="text-xs text-[#6E675F] mt-0.5">
            Manage practical subjects, unit syllabus curriculum, and mapped MVIT experiments.
          </p>
        </div>

        {canModify && (
          <button
            type="button"
            onClick={openCreateModal}
            className="px-3.5 py-2 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Practical Subject
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            feedback.type === 'success'
              ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E7DDD0] shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveDepartmentId('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              activeDepartmentId === 'all'
                ? 'bg-[#49372E] text-white'
                : 'bg-[#FAF6F0] text-[#6E675F] hover:bg-[#EFE7DC] hover:text-[#252521]'
            }`}
          >
            All Departments
          </button>
          {departments.map((dept) => (
            <button
              type="button"
              key={dept.id}
              onClick={() => setActiveDepartmentId(dept.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                activeDepartmentId === dept.id
                  ? 'bg-[#A66A43] text-white'
                  : 'bg-[#FAF6F0] text-[#6E675F] hover:bg-[#EFE7DC] hover:text-[#252521]'
              }`}
            >
              {dept.code}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search subject by code or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg focus:outline-none focus:border-[#A66A43]"
          />
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs font-mono font-semibold text-[#6E675F] uppercase tracking-wider px-1">
            Subjects ({filteredSubjects.length})
          </div>

          <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
            {filteredSubjects.length === 0 ? (
              <div className="p-6 text-center bg-white rounded-xl border border-[#E7DDD0] text-xs text-[#6E675F]">
                No practical subjects found in this laboratory yet.
              </div>
            ) : (
              filteredSubjects.map((subject) => {
                const isSelected = activeSubject?.id === subject.id;
                const expCount = labExperiments.filter((e) => e.subject_id === subject.id).length;
                return (
                  <button
                    type="button"
                    key={subject.id}
                    onClick={() => setActiveSubjectId(subject.id)}
                    className={`w-full p-4 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white border-[#A66A43] shadow-md ring-1 ring-[#A66A43]'
                        : 'bg-white border-[#E7DDD0] hover:border-[#D8CBB9] shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#49372E] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#E7DDD0]">
                        {subject.code}
                      </span>
                      <span className="text-[11px] text-[#6E675F] font-mono">
                        {formatAcademicYearLabel(getYearFromSemester(subject.semester))} · Sem {subject.semester}
                      </span>
                    </div>

                    <h3 className="font-heading font-semibold text-sm text-[#252521] mt-2">
                      {subject.name}
                    </h3>
                    <p className="text-xs text-[#6E675F] mt-1 line-clamp-1">
                      {subject.description}
                    </p>

                    <div className="mt-3 pt-2 border-t border-[#F5F0E8] flex items-center justify-between text-[11px] text-[#6E675F]">
                      <span className="truncate max-w-[160px]">
                        {subject.is_active === false ? 'Hidden from Public' : 'Published on Portal'}
                      </span>
                      <span className="font-mono font-semibold text-[#252521]">
                        {formatCountLabel(expCount, 'Experiment')}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          {activeSubject ? (
            <>
              <div className="bg-white rounded-xl p-6 border border-[#E7DDD0] shadow-xs space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#FAF6F0] text-[#49372E] border border-[#E7DDD0]">
                        {activeSubject.code}
                      </span>
                      <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F5F0E8] text-[#A66A43] border border-[#E7DDD0]">
                        {formatAcademicYearLabel(getYearFromSemester(activeSubject.semester))} • Sem {activeSubject.semester}
                      </span>
                      <span className="text-xs text-[#6E675F]">{activeSubject.department_name}</span>
                      <StatusBadge
                        status={activeSubject.is_active === false ? 'draft' : 'published'}
                        size="sm"
                      />
                    </div>
                    <h2 className="font-heading font-bold text-xl text-[#252521] mt-1.5">
                      {activeSubject.name}
                    </h2>
                  </div>

                  {canModify && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(activeSubject)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-[#FAF6F0] hover:bg-[#EFE7DC] text-[#49372E] border border-[#D8CBB9] rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(activeSubject)}
                        className="px-2.5 py-1.5 text-xs font-semibold bg-white hover:bg-[#FAF6F0] text-[#252521] border border-[#D8CBB9] rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        {activeSubject.is_active === false ? (
                          <>
                            <Eye className="w-3.5 h-3.5 text-[#2E6F4E]" />
                            Publish
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5 text-[#6E675F]" />
                            Hide
                          </>
                        )}
                      </button>
                      {confirmDeleteId === activeSubject.id ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(activeSubject.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-[#B91C1C] text-white rounded-lg cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(activeSubject.id)}
                          className="p-1.5 text-[#B91C1C] hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer"
                          title="Delete Subject"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-[#252521] leading-relaxed">{activeSubject.description}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[#F5F0E8] text-xs">
                  <div className="bg-[#FAF6F0] p-2.5 rounded-lg border border-[#E7DDD0]">
                    <span className="text-[10px] text-[#6E675F] uppercase font-mono block">
                      Laboratory Location
                    </span>
                    <span className="font-semibold text-[#252521] truncate block mt-0.5">
                      {activeSubject.location}
                    </span>
                  </div>
                  <div className="bg-[#FAF6F0] p-2.5 rounded-lg border border-[#E7DDD0]">
                    <span className="text-[10px] text-[#6E675F] uppercase font-mono block">
                      Schedule
                    </span>
                    <span className="font-semibold text-[#252521] truncate block mt-0.5">
                      {activeSubject.schedule_info}
                    </span>
                  </div>
                  <div className="bg-[#FAF6F0] p-2.5 rounded-lg border border-[#E7DDD0]">
                    <span className="text-[10px] text-[#6E675F] uppercase font-mono block">
                      Lab Assistant
                    </span>
                    <span className="font-semibold text-[#252521] truncate block mt-0.5">
                      {activeSubject.lab_assistant_name || selectedLab?.assigned_assistant_name || 'MVIT Lab Staff'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Syllabus Units */}
              <div className="bg-white rounded-xl p-6 border border-[#E7DDD0] shadow-xs space-y-4">
                <h3 className="font-heading font-semibold text-base text-[#252521] flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#A66A43]" />
                  Curriculum Syllabus Units
                </h3>

                {activeSubject.syllabus.length === 0 ? (
                  <p className="text-xs text-[#6E675F]">
                    No syllabus units added yet. Open Syllabus Management to configure units and outcomes.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {activeSubject.syllabus.map((unit) => (
                      <div
                        key={unit.id}
                        className="p-4 rounded-xl border border-[#E7DDD0] bg-[#FAF6F0] space-y-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#49372E] text-white">
                            Unit {unit.unit_number}
                          </span>
                          <h4 className="font-semibold text-xs text-[#252521]">{unit.title}</h4>
                        </div>
                        <p className="text-xs text-[#252521] leading-relaxed">{unit.description}</p>

                        <div className="pt-2 border-t border-[#E7DDD0]">
                          <span className="text-[10px] uppercase font-mono font-semibold text-[#6E675F] block mb-1">
                            Key Learning Outcomes:
                          </span>
                          <ul className="space-y-1 text-xs text-[#49372E]">
                            {unit.learning_outcomes.map((out, idx) => (
                              <li key={idx} className="flex items-start gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#2E6F4E] shrink-0 mt-0.5" />
                                <span>{out}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mapped Practical Experiments */}
              <div className="bg-white rounded-xl p-6 border border-[#E7DDD0] shadow-xs space-y-4">
                <h3 className="font-heading font-semibold text-base text-[#252521] flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-[#A66A43]" />
                  Practical Experiments in this Subject
                </h3>

                {subjectExperiments.length === 0 ? (
                  <p className="text-xs text-[#6E675F] py-4 text-center">
                    No experiments configured for this subject yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#F5F0E8] border border-[#E7DDD0] rounded-xl overflow-hidden">
                    {subjectExperiments.map((exp) => (
                      <div
                        key={exp.id}
                        className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF6F0] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-[#FAF6F0] border border-[#E7DDD0] text-[#49372E] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                            #{exp.exp_number}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-xs text-[#252521] truncate">
                                {exp.title}
                              </h4>
                              <StatusBadge
                                status={exp.is_published ? 'published' : 'draft'}
                                size="sm"
                              />
                            </div>
                            <p className="text-[11px] text-[#6E675F] line-clamp-1 mt-0.5">
                              {exp.aim}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onSelectExperiment(exp.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center bg-white rounded-xl border border-[#E7DDD0]">
              <p className="text-xs text-[#6E675F]">Select a practical subject to view details.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Subject Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSubject ? 'Edit Practical Subject' : 'Add Practical Subject'}
        subtitle="Configure MVIT laboratory course and syllabus metadata"
      >
        <form onSubmit={handleSaveSubject} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Subject Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. PH102L"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Department *
              </label>
              <select
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Subject Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Engineering Physics Practical"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Primary Course (Optional)
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
              >
                <option value="">All Applicable Lab Courses</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">Credits</label>
              <input
                type="number"
                min="1"
                max="6"
                value={credits}
                onChange={(e) => setCredits(parseInt(e.target.value) || 2)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">Semester</label>
              <input
                type="number"
                min="1"
                max="8"
                value={semester}
                onChange={(e) => setSemester(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
              <p className="text-[10px] font-mono text-[#A66A43] mt-1">
                Maps to {formatAcademicYearLabel(getYearFromSemester(semester))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Location / Room
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1">
                Schedule Info
              </label>
              <input
                type="text"
                value={scheduleInfo}
                onChange={(e) => setScheduleInfo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252521] mb-1">Description</label>
            <textarea
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Practical course overview, apparatus covered, and learning scope..."
              className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E7DDD0]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg hover:bg-[#FAF6F0] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs bg-[#49372E] hover:bg-[#382922] text-white font-semibold rounded-lg shadow-xs cursor-pointer"
            >
              {editingSubject ? 'Save Changes' : 'Create Subject'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
