import React, { useState, useEffect } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import { getSupabaseSession } from '../../services/supabaseClient';
import {
  Experiment,
  ExperimentComponent,
  ExperimentEquipment,
  ExperimentProcedureStep,
  ObservationColumn,
  BuiltInSimulatorId,
  ResourceLinkCheckResult,
  SimulationProvider,
  SimulationType,
} from '../../types';
import {
  validateYouTubeUrl,
  validateYouTubeSearchUrl,
  extractYouTubeVideoId,
  checkBenchTwinEmbedSupport,
  detectSimulationProviderFromUrl,
  resolveExperimentSimulation,
} from '../../utils/labRules';
import {
  X,
  Plus,
  Trash2,
  Video,
  Laptop,
  FileText,
  CheckCircle2,
  BookOpen,
  Layers,
  Wrench,
  ShieldAlert,
  Globe,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface ExperimentEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialExperiment?: Experiment | null;
  preSelectedSubjectId?: string;
}

export const ExperimentEditorModal: React.FC<ExperimentEditorModalProps> = ({
  isOpen,
  onClose,
  initialExperiment,
  preSelectedSubjectId,
}) => {
  const {
    labSubjects,
    subjects,
    courses,
    laboratoryCourses,
    experimentCourses,
    setExperimentCourses,
    documents,
    selectedLabId,
    addExperiment,
    updateExperiment,
    currentUser,
    institution,
  } = useLabverse();

  const availableSubjects = labSubjects.length > 0 ? labSubjects : subjects;

  const [activeTab, setActiveTab] = useState<
    'basics' | 'theory' | 'apparatus' | 'procedure' | 'resources'
  >('basics');

  const [expTitle, setExpTitle] = useState('');
  const [expNumber, setExpNumber] = useState(1);
  const [subjectId, setSubjectId] = useState(
    preSelectedSubjectId || availableSubjects[0]?.id || ''
  );
  const [simulatorType, setSimulatorType] = useState<
    'pn_junction' | 'pendulum' | 'calipers' | 'ph_meter' | 'custom'
  >('custom');
  const [isPublished, setIsPublished] = useState(true);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [aim, setAim] = useState('');
  const [theory, setTheory] = useState('');
  const [learningObjectives, setLearningObjectives] = useState<string[]>([
    'Understand fundamental working principles and governing physics',
    'Execute measurement protocols with calibration accuracy',
  ]);
  const [newObjective, setNewObjective] = useState('');

  const [components, setComponents] = useState<ExperimentComponent[]>([
    { name: '', quantity: '1 unit', spec: '' },
  ]);
  const [equipment, setEquipment] = useState<ExperimentEquipment[]>([
    { name: '', model: '', spec: '' },
  ]);
  const [diagramUrl, setDiagramUrl] = useState('');

  const [procedureSteps, setProcedureSteps] = useState<ExperimentProcedureStep[]>([
    {
      step: 1,
      title: 'Apparatus Inspection',
      instruction: 'Verify all instruments and zero calibrations before energizing.',
      precaution: '',
    },
    {
      step: 2,
      title: 'Measurement Protocol',
      instruction: 'Vary parameters systematically and record observations.',
      precaution: '',
    },
  ]);

  const [observationHeaders, setObservationHeaders] = useState<ObservationColumn[]>([
    { key: 'obs_1', header: 'Input Stimulus', unit: 'V' },
    { key: 'obs_2', header: 'Measured Response', unit: 'mA' },
  ]);

  const [expectedResult, setExpectedResult] = useState('');
  const [precautions, setPrecautions] = useState<string[]>([
    'Double check all electrical and mechanical connections before powering on.',
    'Do not exceed maximum instrument operating ratings.',
  ]);
  const [newPrecaution, setNewPrecaution] = useState('');

  const [manualPdfUrl, setManualPdfUrl] = useState('');
  const [manualPdfName, setManualPdfName] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [youtubeAltUrl, setYoutubeAltUrl] = useState('');
  const [youtubeSearchUrl, setYoutubeSearchUrl] = useState('');
  const [benchTwinUrl, setBenchTwinUrl] = useState('');
  const [benchTwinMode, setBenchTwinMode] = useState<'embedded' | 'external'>('external');
  const [simulationProvider, setSimulationProvider] = useState<SimulationProvider>('custom');
  const [simulationType, setSimulationType] = useState<SimulationType>('none');
  const [builtInSimulatorId, setBuiltInSimulatorId] = useState<BuiltInSimulatorId | null>(null);
  const [simulationNote, setSimulationNote] = useState('');

  const [ytChecking, setYtChecking] = useState(false);
  const [ytCheckResult, setYtCheckResult] = useState<ResourceLinkCheckResult | null>(null);
  const [simChecking, setSimChecking] = useState(false);
  const [simCheckResult, setSimCheckResult] = useState<ResourceLinkCheckResult | null>(null);

  const ytValidation = validateYouTubeUrl(youtubeUrl);
  const ytSearchValidation = validateYouTubeSearchUrl(youtubeSearchUrl);
  const benchTwinCheck = checkBenchTwinEmbedSupport(benchTwinUrl);
  const simResolution = resolveExperimentSimulation({
    simulator_type: simulatorType,
    built_in_simulator_id: builtInSimulatorId,
    bench_twin_url: benchTwinUrl,
    simulation_url: benchTwinUrl,
    bench_twin_mode: benchTwinMode,
    simulation_provider: simulationProvider,
    simulation_type: simulationType,
    simulation_note: simulationNote,
  });

  useEffect(() => {
    if (initialExperiment) {
      setExpTitle(initialExperiment.title);
      setExpNumber(initialExperiment.exp_number);
      setSubjectId(initialExperiment.subject_id);
      const initSimType = initialExperiment.simulator_type || 'custom';
      setSimulatorType(initSimType);
      setBuiltInSimulatorId(
        initialExperiment.built_in_simulator_id !== undefined
          ? initialExperiment.built_in_simulator_id
          : initSimType !== 'custom'
          ? initSimType
          : null
      );
      setIsPublished(initialExperiment.is_published !== false);
      setAim(initialExperiment.aim);
      setTheory(initialExperiment.theory);
      setLearningObjectives(initialExperiment.learning_objectives || []);
      setComponents(
        initialExperiment.components_required?.length
          ? initialExperiment.components_required
          : [{ name: '', quantity: '1', spec: '' }]
      );
      setEquipment(
        initialExperiment.equipment_required?.length
          ? initialExperiment.equipment_required
          : [{ name: '', model: '', spec: '' }]
      );
      setDiagramUrl(initialExperiment.diagram_url || '');
      setProcedureSteps(
        initialExperiment.procedure?.length
          ? initialExperiment.procedure
          : [{ step: 1, title: '', instruction: '', precaution: '' }]
      );
      setObservationHeaders(
        initialExperiment.observation_headers?.length
          ? initialExperiment.observation_headers
          : [{ key: 'col_1', header: 'Value', unit: '' }]
      );
      setExpectedResult(initialExperiment.expected_result || '');
      setPrecautions(initialExperiment.precautions || []);
      setManualPdfUrl(initialExperiment.manual_pdf_url || '');
      setManualPdfName(
        initialExperiment.manual_pdf_name || initialExperiment.manual_doc_name || ''
      );
      setYoutubeUrl(initialExperiment.youtube_url || '');
      setYoutubeTitle(initialExperiment.youtube_title || '');
      setYoutubeAltUrl(initialExperiment.youtube_alt_url || '');
      setYoutubeSearchUrl(initialExperiment.youtube_search_url || '');
      const simUrl = initialExperiment.simulation_url || initialExperiment.bench_twin_url || '';
      setBenchTwinUrl(simUrl);
      setBenchTwinMode(initialExperiment.bench_twin_mode || 'external');
      setSimulationProvider(
        initialExperiment.simulation_provider ||
          (simUrl
            ? detectSimulationProviderFromUrl(simUrl)
            : initSimType !== 'custom'
            ? 'built_in'
            : 'none')
      );
      setSimulationType(
        initialExperiment.simulation_type ||
          (initSimType !== 'custom' && simUrl
            ? 'hybrid'
            : initSimType !== 'custom'
            ? 'built_in'
            : simUrl
            ? 'external'
            : 'none')
      );
      setSimulationNote(initialExperiment.simulation_note || '');
      const existingCourseIds = experimentCourses
        .filter((ec) => ec.experiment_id === initialExperiment.id)
        .map((ec) => ec.course_id);
      setSelectedCourseIds(
        existingCourseIds.length > 0 ? existingCourseIds : initialExperiment.course_ids || []
      );
    } else {
      setExpTitle('');
      setExpNumber(1);
      setSubjectId(preSelectedSubjectId || availableSubjects[0]?.id || '');
      setSimulatorType('custom');
      setIsPublished(true);
      setSelectedCourseIds([]);
      setAim('');
      setTheory('');
      setLearningObjectives([
        'Understand operational principles and governing formulas',
        'Record experimental observations accurately',
      ]);
      setComponents([{ name: 'Standard Component', quantity: '1 unit', spec: 'Standard tolerance' }]);
      setEquipment([{ name: 'Laboratory Workstation', model: 'Benchtop Standard', spec: 'MVIT Lab' }]);
      setDiagramUrl('');
      setProcedureSteps([
        {
          step: 1,
          title: 'Apparatus Setup',
          instruction: 'Inspect connections and verify initial zero calibration.',
          precaution: '',
        },
        {
          step: 2,
          title: 'Data Acquisition',
          instruction: 'Vary parameters systematically and tabulate readings.',
          precaution: '',
        },
      ]);
      setObservationHeaders([
        { key: 'col_1', header: 'Trial / Stimulus', unit: 'unit' },
        { key: 'col_2', header: 'Observed Reading', unit: 'unit' },
      ]);
      setExpectedResult('Observed characteristics verified against theoretical predictions.');
      setPrecautions(['Follow standard electrical and laboratory safety regulations.']);
      setManualPdfUrl('');
      setManualPdfName('');
      setYoutubeUrl('');
      setYoutubeTitle('');
      setYoutubeAltUrl('');
      setYoutubeSearchUrl('');
      setBenchTwinUrl('');
      setBenchTwinMode('external');
      setSimulationProvider('none');
      setSimulationType('none');
      setBuiltInSimulatorId(null);
      setSimulationNote('');
    }
    setYtCheckResult(null);
    setSimCheckResult(null);
    setSubmitError(null);
  }, [initialExperiment, preSelectedSubjectId, isOpen]);

  const handleTestResourceLink = async (kind: 'youtube' | 'simulation', targetUrl: string) => {
    const trimmed = targetUrl.trim();
    if (!trimmed) return;
    if (kind === 'youtube') {
      setYtChecking(true);
    } else {
      setSimChecking(true);
    }
    try {
      const session = await getSupabaseSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/resources/validate-link', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: trimmed }),
      });
      const data: ResourceLinkCheckResult = await response.json();
      if (kind === 'youtube') {
        setYtCheckResult(data);
        if (data.reachable && data.title && !youtubeTitle.trim()) {
          setYoutubeTitle(data.title);
        }
      } else {
        setSimCheckResult(data);
        if (data.provider && data.provider !== 'invalid' && data.provider !== 'blocked') {
          const detected = detectSimulationProviderFromUrl(trimmed);
          if (detected !== 'none') setSimulationProvider(detected);
        }
        if (!data.embeddable && benchTwinMode === 'embedded') {
          setBenchTwinMode('external');
        }
      }
    } catch {
      const fallback: ResourceLinkCheckResult = {
        url: trimmed,
        reachable: false,
        status: null,
        embeddable: false,
        provider: 'error',
        note: 'Network error while probing URL. Ensure the dev server is active.',
        checkedAt: new Date().toISOString(),
      };
      if (kind === 'youtube') setYtCheckResult(fallback);
      else setSimCheckResult(fallback);
    } finally {
      if (kind === 'youtube') setYtChecking(false);
      else setSimChecking(false);
    }
  };

  if (!isOpen) return null;

  const handleAddObjective = () => {
    if (newObjective.trim()) {
      setLearningObjectives([...learningObjectives, newObjective.trim()]);
      setNewObjective('');
    }
  };
  const handleRemoveObjective = (index: number) => {
    setLearningObjectives(learningObjectives.filter((_, i) => i !== index));
  };

  const handleAddPrecaution = () => {
    if (newPrecaution.trim()) {
      setPrecautions([...precautions, newPrecaution.trim()]);
      setNewPrecaution('');
    }
  };
  const handleRemovePrecaution = (index: number) => {
    setPrecautions(precautions.filter((_, i) => i !== index));
  };

  const handleAddComponent = () => {
    setComponents([...components, { name: '', quantity: '1 unit', spec: '' }]);
  };
  const handleUpdateComponent = (
    index: number,
    field: keyof ExperimentComponent,
    value: string
  ) => {
    const updated = [...components];
    updated[index] = { ...updated[index], [field]: value };
    setComponents(updated);
  };
  const handleRemoveComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const handleAddEquipment = () => {
    setEquipment([...equipment, { name: '', model: '', spec: '' }]);
  };
  const handleUpdateEquipment = (
    index: number,
    field: keyof ExperimentEquipment,
    value: string
  ) => {
    const updated = [...equipment];
    updated[index] = { ...updated[index], [field]: value };
    setEquipment(updated);
  };
  const handleRemoveEquipment = (index: number) => {
    setEquipment(equipment.filter((_, i) => i !== index));
  };

  const handleAddProcedureStep = () => {
    setProcedureSteps([
      ...procedureSteps,
      { step: procedureSteps.length + 1, title: '', instruction: '', precaution: '' },
    ]);
  };
  const handleUpdateProcedureStep = (
    index: number,
    field: keyof ExperimentProcedureStep,
    value: any
  ) => {
    const updated = [...procedureSteps];
    updated[index] = { ...updated[index], [field]: value };
    setProcedureSteps(updated);
  };
  const handleRemoveProcedureStep = (index: number) => {
    const filtered = procedureSteps.filter((_, i) => i !== index);
    setProcedureSteps(filtered.map((s, idx) => ({ ...s, step: idx + 1 })));
  };

  const handleAddObservationHeader = () => {
    const nextKey = `col_${observationHeaders.length + 1}`;
    setObservationHeaders([
      ...observationHeaders,
      { key: nextKey, header: `Column ${observationHeaders.length + 1}`, unit: '' },
    ]);
  };
  const handleUpdateObservationHeader = (
    index: number,
    field: keyof ObservationColumn,
    value: string
  ) => {
    const updated = [...observationHeaders];
    updated[index] = { ...updated[index], [field]: value };
    setObservationHeaders(updated);
  };
  const handleRemoveObservationHeader = (index: number) => {
    setObservationHeaders(observationHeaders.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const subj = availableSubjects.find((s) => s.id === subjectId) || subjects[0];

    const expData = {
      institution_id: institution.id,
      lab_id: subj?.lab_id || selectedLabId || undefined,
      subject_id: subjectId || subj?.id || '',
      subject_code: subj?.code || 'LAB-101',
      subject_name: subj?.name || 'Practical Subject',
      department_id: subj?.department_id || 'dept-mvit-phy',
      department_name: subj?.department_name || 'Science & Humanities',
      exp_number: expNumber,
      title: expTitle,
      slug: expTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      aim,
      theory,
      learning_objectives: learningObjectives.filter((o) => o.trim().length > 0),
      components_required: components.filter((c) => c.name.trim().length > 0),
      equipment_required: equipment.filter((eq) => eq.name.trim().length > 0),
      diagram_url: diagramUrl,
      procedure: procedureSteps.filter(
        (p) => p.title.trim().length > 0 || p.instruction.trim().length > 0
      ),
      observation_headers: observationHeaders.filter((h) => h.header.trim().length > 0),
      expected_result: expectedResult,
      precautions: precautions.filter((p) => p.trim().length > 0),
      manual_content: `# ${expTitle}\n\n## Aim\n${aim}\n\n## Theory\n${theory}\n\n## Expected Result\n${expectedResult}`,
      manual_doc_name: manualPdfName || `${subj?.code || 'MVIT'}_Exp${expNumber}_Manual.pdf`,
      manual_pdf_url: manualPdfUrl,
      manual_pdf_name: manualPdfName,
      youtube_url: youtubeUrl.trim(),
      youtube_video_id: extractYouTubeVideoId(youtubeUrl),
      youtube_title: youtubeTitle.trim() || undefined,
      youtube_alt_url: youtubeAltUrl.trim() || undefined,
      youtube_search_url: youtubeSearchUrl.trim() || undefined,
      bench_twin_url: benchTwinUrl.trim(),
      simulation_url: benchTwinUrl.trim(),
      bench_twin_mode: benchTwinMode,
      simulation_provider: simulationProvider,
      simulation_type: simulationType,
      built_in_simulator_id: builtInSimulatorId,
      simulator_type: builtInSimulatorId || simulatorType,
      simulation_note: simulationNote.trim() || undefined,
      resource_status:
        ytCheckResult?.reachable === false || simCheckResult?.reachable === false
          ? ('needs_review' as const)
          : ('verified' as const),
      last_verified_at: (ytCheckResult || simCheckResult)?.checkedAt || initialExperiment?.last_verified_at,
      course_ids: selectedCourseIds,
      is_published: isPublished,
      created_by: currentUser?.name || 'MVIT Lab Assistant',
    };

    setSubmitError(null);
    setIsSubmitting(true);
    const res = initialExperiment
      ? await updateExperiment(initialExperiment.id, expData)
      : await addExperiment(expData);
    setIsSubmitting(false);

    if (!res.success) {
      setSubmitError(res.error || 'Failed to save experiment.');
      return;
    }
    const savedExpId = initialExperiment?.id || res.id;
    if (savedExpId) {
      await setExperimentCourses(savedExpId, selectedCourseIds);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#252521]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E7DDD0] w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#49372E] text-white flex items-center justify-between border-b border-[#382922]">
          <div>
            <h2 className="font-heading font-bold text-base text-white">
              {initialExperiment ? 'Edit MVIT Experiment Configuration' : 'Create MVIT Practical Experiment'}
            </h2>
            <p className="text-xs text-[#E7DDD0]">
              Configure protocol, theory, apparatus specifications, manual PDF, YouTube demonstration, and Bench Twin simulation.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#E7DDD0] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E7DDD0] bg-[#FAF6F0] px-6 text-xs font-semibold overflow-x-auto">
          {[
            { id: 'basics', label: '1. Title & Subject', icon: BookOpen },
            { id: 'theory', label: '2. Aim & Theory', icon: Layers },
            { id: 'apparatus', label: '3. Apparatus & Diagram', icon: Wrench },
            { id: 'procedure', label: '4. Procedure & Observations', icon: ShieldAlert },
            { id: 'resources', label: '5. Manual, YouTube & Bench Twin', icon: Laptop },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-[#A66A43] text-[#49372E] bg-white'
                    : 'border-transparent text-[#6E675F] hover:text-[#252521]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {activeTab === 'basics' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-[#252521] mb-1">
                      Experiment Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PN Junction Diode – V-I Characteristics"
                      value={expTitle}
                      onChange={(e) => setExpTitle(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#252521] mb-1">
                      Experiment No. *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={expNumber}
                      onChange={(e) => setExpNumber(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#252521] mb-1">
                      Practical Subject *
                    </label>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                    >
                      {availableSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name} ({s.department_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#252521] mb-1">
                      Built-in Virtual Simulator Engine
                    </label>
                    <select
                      value={builtInSimulatorId || simulatorType}
                      onChange={(e) => {
                        const val = e.target.value as 'pn_junction' | 'pendulum' | 'calipers' | 'ph_meter' | 'custom';
                        setSimulatorType(val);
                        setBuiltInSimulatorId(val === 'custom' ? null : val);
                        if (val !== 'custom' && simulationType === 'none') {
                          setSimulationType(benchTwinUrl.trim() ? 'hybrid' : 'built_in');
                        }
                        if (val !== 'custom' && simulationProvider === 'none') {
                          setSimulationProvider('built_in');
                        }
                      }}
                      className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                    >
                      <option value="custom">Custom / External Virtual Lab</option>
                      <option value="pn_junction">Silicon PN Diode V-I Plotter (Built-in)</option>
                      <option value="pendulum">Simple Pendulum Oscillation Rig (Built-in)</option>
                      <option value="calipers">Mitutoyo Vernier Calipers (Built-in)</option>
                      <option value="ph_meter">Electrometric pH Meter Station (Built-in)</option>
                    </select>
                  </div>
                </div>

                {courses.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-white border border-[#E7DDD0] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="block text-xs font-semibold text-[#252521]">
                        Applicable Courses (Public Learning Portal Filter)
                      </label>
                      <span
                        className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                          selectedCourseIds.length === 0
                            ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]'
                            : 'bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]'
                        }`}
                      >
                        {selectedCourseIds.length === 0
                          ? 'Unmapped (Hidden in course filters)'
                          : `${selectedCourseIds.length} course(s) mapped`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {courses.map((course) => {
                        const checked = selectedCourseIds.includes(course.id);
                        const subjectObj = availableSubjects.find((s) => s.id === subjectId);
                        const targetLabId = subjectObj?.lab_id || selectedLabId;
                        const isMappedToLab = targetLabId
                          ? laboratoryCourses.some(
                              (lc) => lc.lab_id === targetLabId && lc.course_id === course.id
                            )
                          : true;
                        return (
                          <label
                            key={course.id}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer ${
                              checked
                                ? 'bg-[#FAF6F0] border-[#A66A43] text-[#49372E] font-semibold'
                                : isMappedToLab
                                  ? 'bg-white border-[#E7DDD0] text-[#6E675F]'
                                  : 'bg-white/60 border-dashed border-[#E7DDD0] text-[#6E675F]/75'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedCourseIds((prev) =>
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
                    {selectedCourseIds.length === 0 && (
                      <p className="text-[11px] text-[#B45309]">
                        No courses selected. Unmapped experiments are NOT auto-assigned to any course and will not appear under course-specific filters until mapped.
                      </p>
                    )}
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Globe className="w-4 h-4 text-[#2E6F4E]" />
                    <div>
                      <div className="text-xs font-semibold text-[#252521]">
                        Publish to MVIT Public Learning Portal
                      </div>
                      <div className="text-[11px] text-[#6E675F]">
                        When enabled, visitors can browse manuals, videos, and simulators without login.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-4 h-4 accent-[#49372E] cursor-pointer"
                  />
                </div>
              </div>
            )}

            {activeTab === 'theory' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Aim of Experiment *
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Clearly articulate the experimental objective..."
                    value={aim}
                    onChange={(e) => setAim(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Learning Objectives
                  </label>
                  <div className="space-y-2">
                    {learningObjectives.map((obj, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded bg-[#FAF6F0] text-[#49372E] border border-[#E7DDD0] text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={obj}
                          onChange={(e) => {
                            const updated = [...learningObjectives];
                            updated[idx] = e.target.value;
                            setLearningObjectives(updated);
                          }}
                          className="flex-1 px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveObjective(idx)}
                          className="p-1.5 text-[#B91C1C] hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add another learning objective..."
                        value={newObjective}
                        onChange={(e) => setNewObjective(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddObjective();
                          }
                        }}
                        className="flex-1 px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={handleAddObjective}
                        className="px-3 py-1.5 bg-[#FAF6F0] text-[#49372E] border border-[#D8CBB9] text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Theoretical Principles & Governing Equations *
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Physical principles, equations, and derivation notes..."
                    value={theory}
                    onChange={(e) => setTheory(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono text-[11px]"
                  />
                </div>
              </div>
            )}

            {activeTab === 'apparatus' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-[#252521]">
                      Required Components & Consumables
                    </label>
                    <button
                      type="button"
                      onClick={handleAddComponent}
                      className="text-xs text-[#A66A43] font-medium flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Component
                    </button>
                  </div>
                  <div className="border border-[#E7DDD0] rounded-xl overflow-hidden divide-y divide-[#F5F0E8]">
                    {components.map((comp, idx) => (
                      <div key={idx} className="p-2.5 flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white">
                        <input
                          type="text"
                          placeholder="Component Name"
                          value={comp.name}
                          onChange={(e) => handleUpdateComponent(idx, 'name', e.target.value)}
                          className="flex-2 min-w-[140px] px-2.5 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Qty"
                          value={comp.quantity}
                          onChange={(e) => handleUpdateComponent(idx, 'quantity', e.target.value)}
                          className="w-24 px-2.5 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Specification"
                          value={comp.spec}
                          onChange={(e) => handleUpdateComponent(idx, 'spec', e.target.value)}
                          className="flex-2 min-w-[140px] px-2.5 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveComponent(idx)}
                          className="p-1.5 text-[#B91C1C] hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-[#252521]">
                      Benchtop Instruments & Equipment
                    </label>
                    <button
                      type="button"
                      onClick={handleAddEquipment}
                      className="text-xs text-[#A66A43] font-medium flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Equipment
                    </button>
                  </div>
                  <div className="border border-[#E7DDD0] rounded-xl overflow-hidden divide-y divide-[#F5F0E8]">
                    {equipment.map((eq, idx) => (
                      <div key={idx} className="p-2.5 flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white">
                        <input
                          type="text"
                          placeholder="Equipment Name"
                          value={eq.name}
                          onChange={(e) => handleUpdateEquipment(idx, 'name', e.target.value)}
                          className="flex-2 min-w-[140px] px-2.5 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Model"
                          value={eq.model}
                          onChange={(e) => handleUpdateEquipment(idx, 'model', e.target.value)}
                          className="flex-1 min-w-[100px] px-2.5 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Specification"
                          value={eq.spec}
                          onChange={(e) => handleUpdateEquipment(idx, 'spec', e.target.value)}
                          className="flex-2 min-w-[140px] px-2.5 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveEquipment(idx)}
                          className="p-1.5 text-[#B91C1C] hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Experiment Schematic / Apparatus Diagram URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={diagramUrl}
                    onChange={(e) => setDiagramUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono"
                  />
                </div>
              </div>
            )}

            {activeTab === 'procedure' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-[#252521]">
                      Step-by-Step Procedure Instructions *
                    </label>
                    <button
                      type="button"
                      onClick={handleAddProcedureStep}
                      className="text-xs text-[#A66A43] font-medium flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Step
                    </button>
                  </div>
                  <div className="space-y-3">
                    {procedureSteps.map((step, idx) => (
                      <div key={idx} className="p-3 border border-[#E7DDD0] rounded-xl bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#49372E] text-white flex items-center justify-center text-xs font-bold font-mono">
                              {step.step}
                            </span>
                            <input
                              type="text"
                              placeholder="Step Title"
                              value={step.title}
                              onChange={(e) => handleUpdateProcedureStep(idx, 'title', e.target.value)}
                              className="px-2.5 py-1 text-xs border border-[#D8CBB9] rounded-lg font-medium"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveProcedureStep(idx)}
                            className="p-1 text-[#B91C1C] hover:bg-rose-50 rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          placeholder="Detailed step instruction..."
                          value={step.instruction}
                          onChange={(e) =>
                            handleUpdateProcedureStep(idx, 'instruction', e.target.value)
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-[#D8CBB9] rounded-lg"
                        />
                        <input
                          type="text"
                          placeholder="Safety precaution for this step (optional)..."
                          value={step.precaution || ''}
                          onChange={(e) =>
                            handleUpdateProcedureStep(idx, 'precaution', e.target.value)
                          }
                          className="w-full px-2.5 py-1 text-xs border border-amber-200 bg-amber-50 rounded text-amber-900"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-[#252521]">
                      Observation Table Columns
                    </label>
                    <button
                      type="button"
                      onClick={handleAddObservationHeader}
                      className="text-xs text-[#A66A43] font-medium flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Column
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {observationHeaders.map((col, idx) => (
                      <div
                        key={idx}
                        className="p-2 border border-[#E7DDD0] rounded-lg bg-[#FAF6F0] flex items-center gap-1.5"
                      >
                        <input
                          type="text"
                          placeholder="Header"
                          value={col.header}
                          onChange={(e) =>
                            handleUpdateObservationHeader(idx, 'header', e.target.value)
                          }
                          className="flex-1 px-2 py-1 text-xs border border-[#D8CBB9] rounded bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Unit"
                          value={col.unit || ''}
                          onChange={(e) =>
                            handleUpdateObservationHeader(idx, 'unit', e.target.value)
                          }
                          className="w-14 px-1.5 py-1 text-xs border border-[#D8CBB9] rounded bg-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveObservationHeader(idx)}
                          className="p-1 text-[#B91C1C] hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#252521] mb-1">
                      Expected Result *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Expected graphical trends, reference values..."
                      value={expectedResult}
                      onChange={(e) => setExpectedResult(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#252521] mb-1">
                      Safety Precautions
                    </label>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {precautions.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs text-[#6E675F]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C] shrink-0" />
                          <span className="flex-1 truncate">{p}</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePrecaution(idx)}
                            className="p-1 text-[#B91C1C] cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <input
                        type="text"
                        placeholder="Add precaution..."
                        value={newPrecaution}
                        onChange={(e) => setNewPrecaution(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPrecaution();
                          }
                        }}
                        className="flex-1 px-2.5 py-1 text-xs border border-[#D8CBB9] rounded"
                      />
                      <button
                        type="button"
                        onClick={handleAddPrecaution}
                        className="px-2.5 py-1 text-xs bg-[#FAF6F0] text-[#49372E] border border-[#D8CBB9] rounded cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'resources' && (
              <div className="space-y-4">
                {/* Practical Manual PDF */}
                <div className="p-4 bg-[#FAF6F0] border border-[#E7DDD0] rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-[#252521] flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#A66A43]" />
                      Attach Practical Manual PDF
                    </label>
                    <span className="text-[11px] text-[#6E675F]">
                      Select from uploaded manuals or enter filename
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#6E675F] mb-1">
                        Select from Uploaded Manuals:
                      </label>
                      <select
                        value={manualPdfUrl}
                        onChange={(e) => {
                          const doc = documents.find((d) => d.file_url === e.target.value);
                          setManualPdfUrl(e.target.value);
                          if (doc) setManualPdfName(doc.file_name);
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      >
                        <option value="">-- Built-in Printable Manual Generator --</option>
                        {documents
                          .filter((d) => d.type === 'experiment_manual')
                          .map((d) => (
                            <option key={d.id} value={d.file_url}>
                              {d.title} ({d.file_name})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#6E675F] mb-1">
                        Manual Display Filename:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MVIT_PSL_Exp01_Manual.pdf"
                        value={manualPdfName}
                        onChange={(e) => setManualPdfName(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      />
                    </div>
                  </div>
                </div>

                {/* YouTube Link */}
                <div className="p-4 bg-[#FAF6F0] border border-[#E7DDD0] rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-[#252521] flex items-center gap-1.5">
                      <Video className="w-4 h-4 text-[#B91C1C]" />
                      YouTube Demonstration Link & Search Fallback
                    </label>
                    {youtubeUrl ? (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                          ytValidation.isValid
                            ? 'bg-[#EBF5EE] text-[#2E6F4E]'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {ytValidation.isValid
                          ? `Verified Video ID: ${ytValidation.videoId}`
                          : 'Not a direct video URL'}
                      </span>
                    ) : ytSearchValidation.isValid ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        Curated Search Fallback Active
                      </span>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Primary Direct Video: https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => {
                        setYoutubeUrl(e.target.value);
                        setYtCheckResult(null);
                      }}
                      className="flex-1 px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono bg-white"
                    />
                    <button
                      type="button"
                      disabled={ytChecking || (!youtubeUrl.trim() && !youtubeSearchUrl.trim())}
                      onClick={() => handleTestResourceLink('youtube', youtubeUrl.trim() || youtubeSearchUrl.trim())}
                      className="px-3 py-2 text-xs font-semibold bg-white hover:bg-[#F5F0E8] disabled:opacity-50 text-[#49372E] border border-[#D8CBB9] rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${ytChecking ? 'animate-spin' : ''}`} />
                      Test Link
                    </button>
                  </div>

                  {ytCheckResult && (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                        ytCheckResult.reachable
                          ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {ytCheckResult.reachable ? 'REACHABLE' : 'UNREACHABLE'}
                      {ytCheckResult.status ? ` (HTTP ${ytCheckResult.status})` : ''} — {ytCheckResult.note}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#6E675F] mb-1">
                        Video Demonstration Title:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Forward Bias Characteristics Demo"
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#6E675F] mb-1">
                        Alternate Video URL (Optional):
                      </label>
                      <input
                        type="url"
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={youtubeAltUrl}
                        onChange={(e) => setYoutubeAltUrl(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg font-mono bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-1">
                      Curated YouTube Search URL (Used for FIND A DEMONSTRATION button):
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/results?search_query=..."
                      value={youtubeSearchUrl}
                      onChange={(e) => setYoutubeSearchUrl(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg font-mono bg-white"
                    />
                  </div>
                </div>

                {/* Virtual Simulation & Bench Twin */}
                <div className="p-4 bg-[#FAF6F0] border border-[#E7DDD0] rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-[#252521] flex items-center gap-1.5">
                      <Laptop className="w-4 h-4 text-[#A66A43]" />
                      Virtual Simulation & External Bench Configuration
                    </label>

                    <div className="flex items-center gap-3 text-xs text-[#252521]">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="twinMode"
                          value="embedded"
                          checked={benchTwinMode === 'embedded'}
                          onChange={() => setBenchTwinMode('embedded')}
                        />
                        Embedded Iframe
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="twinMode"
                          value="external"
                          checked={benchTwinMode === 'external'}
                          onChange={() => setBenchTwinMode('external')}
                        />
                        External New Tab
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-[#6E675F] mb-1">
                        Simulation Type:
                      </label>
                      <select
                        value={simulationType}
                        onChange={(e) => setSimulationType(e.target.value as SimulationType)}
                        className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      >
                        <option value="built_in">Built-in LABVERSE Rig</option>
                        <option value="hybrid">Hybrid (Built-in + External)</option>
                        <option value="external">External Platform Only</option>
                        <option value="none">No Simulation</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#6E675F] mb-1">
                        External Provider:
                      </label>
                      <select
                        value={simulationProvider}
                        onChange={(e) => setSimulationProvider(e.target.value as SimulationProvider)}
                        className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      >
                        <option value="built_in">LABVERSE Built-in</option>
                        <option value="virtual_labs">IIT Virtual Labs (vlabs.ac.in)</option>
                        <option value="phet">PhET Interactive Simulations</option>
                        <option value="circuitverse">CircuitVerse Simulator</option>
                        <option value="benchtwin">BenchTwin Studio</option>
                        <option value="custom">Custom HTTPS Simulator</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-[#6E675F] mb-1">
                        Built-in Rig ID:
                      </label>
                      <select
                        value={builtInSimulatorId || ''}
                        onChange={(e) => {
                          const val = (e.target.value || null) as BuiltInSimulatorId | null;
                          setBuiltInSimulatorId(val);
                          setSimulatorType(val || 'custom');
                        }}
                        className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                      >
                        <option value="">None</option>
                        <option value="pn_junction">PN Junction Diode Plotter</option>
                        <option value="pendulum">Simple Pendulum Rig</option>
                        <option value="calipers">Vernier Calipers Bench</option>
                        <option value="ph_meter">Electrometric pH Meter</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://fsp1-iiith.vlabs.ac.in/... or https://phet.colorado.edu/en/simulations/..."
                      value={benchTwinUrl}
                      onChange={(e) => {
                        const nextUrl = e.target.value;
                        setBenchTwinUrl(nextUrl);
                        setSimCheckResult(null);
                        const detected = detectSimulationProviderFromUrl(nextUrl);
                        if (detected !== 'none') setSimulationProvider(detected);
                      }}
                      className="flex-1 px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg font-mono bg-white"
                    />
                    <button
                      type="button"
                      disabled={simChecking || !benchTwinUrl.trim()}
                      onClick={() => handleTestResourceLink('simulation', benchTwinUrl)}
                      className="px-3 py-2 text-xs font-semibold bg-white hover:bg-[#F5F0E8] disabled:opacity-50 text-[#49372E] border border-[#D8CBB9] rounded-lg inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${simChecking ? 'animate-spin' : ''}`} />
                      Test Link
                    </button>
                    {benchTwinCheck.isSafeUrl && benchTwinCheck.normalizedUrl && (
                      <a
                        href={benchTwinCheck.normalizedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-xs font-semibold bg-white hover:bg-[#F5F0E8] text-[#49372E] border border-[#D8CBB9] rounded-lg inline-flex items-center gap-1 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>

                  {simCheckResult && (
                    <div
                      className={`p-2.5 rounded-lg border text-[11px] font-mono ${
                        simCheckResult.reachable
                          ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      {simCheckResult.reachable ? 'REACHABLE' : 'UNREACHABLE'}
                      {simCheckResult.status ? ` (HTTP ${simCheckResult.status})` : ''} •{' '}
                      {simCheckResult.embeddable ? 'Embeddable' : 'External New Tab Only'} — {simCheckResult.note}
                    </div>
                  )}

                  {benchTwinUrl && (
                    <p className="text-[11px] text-[#6E675F] font-mono">
                      Resolved Behavior: {simResolution.canEmbedExternal ? 'Inline Embed + External Launch' : 'External New Tab Launch'} ({simResolution.providerLabel})
                    </p>
                  )}

                  <div>
                    <label className="block text-[11px] text-[#6E675F] mb-1">
                      Simulation Note / Guidance for Learners:
                    </label>
                    <input
                      type="text"
                      placeholder="Brief note explaining what learners can do in this simulator..."
                      value={simulationNote}
                      onChange={(e) => setSimulationNote(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {submitError && (
            <div className="mx-6 mb-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Footer Controls */}
          <div className="px-6 py-3.5 bg-[#FAF6F0] border-t border-[#E7DDD0] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg hover:bg-white text-[#252521] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs bg-[#49372E] hover:bg-[#382922] disabled:opacity-60 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : initialExperiment
                  ? 'Update Experiment'
                  : 'Save Experiment'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
