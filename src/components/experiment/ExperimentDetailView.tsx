import React, { useState } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import {
  classifyYouTubeResource,
  resolveExperimentSimulation,
  getYearFromSemester,
  formatAcademicYearLabel,
} from '../../utils/labRules';
import { PnJunctionSimulator } from '../simulators/PnJunctionSimulator';
import { PendulumSimulator } from '../simulators/PendulumSimulator';
import { VernierCaliperSimulator } from '../simulators/VernierCaliperSimulator';
import { PhMeterSimulator } from '../simulators/PhMeterSimulator';
import { PdfViewerModal } from '../common/PdfViewerModal';
import { downloadResolvedPdf } from '../../utils/pdfSource';
import {
  ArrowLeft,
  FileText,
  Youtube,
  MonitorPlay,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  Download,
  BookOpen,
  ListOrdered,
  Sparkles,
  Wrench,
  Eye,
  X,
} from 'lucide-react';

interface ExperimentDetailViewProps {
  experimentId: string;
  onBack: () => void;
  isPublic?: boolean;
  breadcrumbContext?: {
    labName?: string;
    courseCode?: string;
    yearLabel?: string;
    subjectCode?: string;
  };
}

export const ExperimentDetailView: React.FC<ExperimentDetailViewProps> = ({
  experimentId,
  onBack,
  isPublic = true,
  breadcrumbContext,
}) => {
  const { experiments, documents, activeLabs, subjects, isSupabaseActive } = useLabverse();

  const experiment = experiments.find((e) => e.id === experimentId);
  const [activeSubTab, setActiveSubTab] = useState<
    'theory' | 'procedure' | 'manual' | 'video' | 'simulator'
  >('theory');
  const [showInstructionsDrawer, setShowInstructionsDrawer] = useState(true);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [diagramError, setDiagramError] = useState(false);
  const [useAltVideo, setUseAltVideo] = useState(false);

  if (!experiment) {
    return (
      <div className="bg-white rounded-2xl border border-[#E7DDD0] p-10 text-center max-w-lg mx-auto my-8">
        <p className="text-sm font-medium text-[#5C534A]">Experiment details could not be found.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-[#A66A43] text-white text-xs font-semibold rounded-lg cursor-pointer"
        >
          Back to Laboratory
        </button>
      </div>
    );
  }

  const subject = subjects.find((s) => s.id === experiment.subject_id);
  const lab = activeLabs.find((l) => l.id === (experiment.lab_id || subject?.lab_id));

  // Linked PDF manual document
  const linkedDoc =
    documents.find(
      (d) =>
        (d.experiment_id === experiment.id || d.id === experiment.manual_pdf_id) &&
        (d.is_published || !isPublic)
    ) || null;

  const pdfUrl = linkedDoc?.file_url || experiment.manual_pdf_url || '';
  const pdfFileName =
    linkedDoc?.file_name ||
    experiment.manual_pdf_name ||
    experiment.manual_doc_name ||
    `${experiment.subject_code}_Exp${experiment.exp_number}_Manual.pdf`;

  const ytInfo = classifyYouTubeResource(experiment);
  const simInfo = resolveExperimentSimulation(experiment);
  const activeVideoId =
    useAltVideo && ytInfo.altVideoId ? ytInfo.altVideoId : ytInfo.videoId;
  const activeWatchUrl =
    useAltVideo && ytInfo.altWatchUrl ? ytInfo.altWatchUrl : ytInfo.watchUrl;

  const isDemoManual = linkedDoc
    ? Boolean(linkedDoc.is_demo)
    : experiment.manual_pdf_url
      ? Boolean(experiment.is_demo) && experiment.manual_pdf_url.startsWith('data:')
      : !isSupabaseActive;

  const yearDisplay =
    breadcrumbContext?.yearLabel ||
    (subject ? formatAcademicYearLabel(getYearFromSemester(subject.semester)) : undefined);

  const handleDownloadManual = () => {
    if (pdfUrl || linkedDoc?.storage_path) {
      void downloadResolvedPdf({
        pdfUrl,
        storagePath: linkedDoc?.storage_path,
        docId: linkedDoc?.id,
        fileName: pdfFileName,
        isSupabaseActive,
      });
    } else {
      setActiveSubTab('manual');
    }
  };

  const handleWatchVideo = () => {
    setActiveSubTab('video');
  };

  const handleLaunchSimulation = () => {
    setActiveSubTab('simulator');
  };

  const renderBuiltInSimulator = () => {
    switch (simInfo.builtInSimulatorId) {
      case 'pn_junction':
        return <PnJunctionSimulator />;
      case 'pendulum':
        return <PendulumSimulator />;
      case 'calipers':
        return <VernierCaliperSimulator />;
      case 'ph_meter':
        return <PhMeterSimulator />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Back Breadcrumb & Header Card */}
      <div className="bg-white rounded-2xl border border-[#E7DDD0] p-5 sm:p-7 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 font-semibold text-[#49372E] hover:text-[#A66A43] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to {subject ? subject.code : 'Laboratory'}</span>
            </button>
            {breadcrumbContext?.labName && (
              <span className="text-[#6E675F] hidden sm:inline">
                • {breadcrumbContext.labName}
                {breadcrumbContext.courseCode ? ` / ${breadcrumbContext.courseCode}` : ''}
                {yearDisplay ? ` / ${yearDisplay}` : ''}
                {breadcrumbContext.subjectCode ? ` / ${breadcrumbContext.subjectCode}` : ''}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#5C534A]">
            {lab && (
              <span className="px-2.5 py-1 rounded-md bg-[#F5F0E8] border border-[#E7DDD0] text-[#49372E] font-semibold">
                {lab.name} ({lab.lab_code})
              </span>
            )}
            {yearDisplay && (
              <span className="px-2.5 py-1 rounded-md bg-[#FAF6F0] border border-[#E7DDD0] text-[#49372E] font-semibold">
                {yearDisplay}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md bg-[#FBF4EE] border border-[#E7DDD0] text-[#A66A43] font-semibold">
              {experiment.subject_code} • Exp #{String(experiment.exp_number).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#252521] tracking-tight">
              {experiment.title}
            </h1>
            <p className="text-sm text-[#5C534A] leading-relaxed">{experiment.aim}</p>
          </div>

          {/* 3 Primary Learning Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDownloadManual}
              disabled={!pdfUrl}
              title={pdfUrl ? 'Download experiment manual PDF' : 'Manual PDF is not available yet.'}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-[#D6C7B4] hover:border-[#A66A43] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold tracking-wide text-[#252521] hover:text-[#A66A43] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#A66A43]" />
              <span>DOWNLOAD MANUAL</span>
            </button>

            <button
              type="button"
              onClick={handleWatchVideo}
              disabled={ytInfo.mode === 'unavailable'}
              title={
                ytInfo.mode === 'direct_video'
                  ? 'Watch embedded YouTube experiment demonstration'
                  : ytInfo.mode === 'search_only'
                  ? 'Find practical video demonstrations on YouTube'
                  : 'Video demonstration is not available yet.'
              }
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-[#D6C7B4] hover:border-[#49372E] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold tracking-wide text-[#252521] hover:text-[#49372E] transition-colors cursor-pointer"
            >
              <Youtube className="w-3.5 h-3.5 text-[#A66A43]" />
              <span>{ytInfo.ctaLabel}</span>
            </button>

            <button
              type="button"
              onClick={handleLaunchSimulation}
              disabled={!simInfo.isAvailable}
              title={
                simInfo.isAvailable
                  ? `Open ${simInfo.providerLabel}`
                  : 'Virtual simulation is not available yet.'
              }
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A66A43] hover:bg-[#8E5734] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold tracking-wide shadow-sm transition-colors cursor-pointer"
            >
              <MonitorPlay className="w-4 h-4" />
              <span>{simInfo.isAvailable ? 'PERFORM VIRTUAL EXPERIMENT' : 'SIMULATION UNAVAILABLE'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-6 pt-4 border-t border-[#E7DDD0] flex flex-wrap gap-2">
          {[
            { id: 'theory', label: 'Overview & Theory', icon: <BookOpen className="w-3.5 h-3.5" /> },
            { id: 'procedure', label: 'Procedure & Observations', icon: <ListOrdered className="w-3.5 h-3.5" /> },
            { id: 'manual', label: 'Manual PDF', icon: <FileText className="w-3.5 h-3.5" /> },
            { id: 'video', label: 'Video Learning', icon: <Youtube className="w-3.5 h-3.5" /> },
            { id: 'simulator', label: 'Virtual Simulation', icon: <MonitorPlay className="w-3.5 h-3.5" /> },
          ].map((tab) => {
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#49372E] text-white'
                    : 'bg-[#F5F0E8] text-[#49372E] hover:bg-[#E7DDD0]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: OVERVIEW & THEORY */}
      {activeSubTab === 'theory' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            {/* Theory Card */}
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-4">
              <h2 className="font-heading font-bold text-lg text-[#252521]">Theoretical Principle</h2>
              <div className="text-sm text-[#49372E] leading-relaxed whitespace-pre-line">
                {experiment.theory}
              </div>

              {experiment.diagram_url && !diagramError && (
                <div className="pt-4 border-t border-[#E7DDD0]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#5C534A] mb-3">
                    Circuit / Apparatus Diagram
                  </h3>
                  <div className="rounded-xl overflow-hidden border border-[#E7DDD0] bg-[#F5F0E8] p-3">
                    <img
                      src={experiment.diagram_url}
                      alt={`${experiment.title} apparatus diagram`}
                      referrerPolicy="no-referrer"
                      onError={() => setDiagramError(true)}
                      className="max-h-72 mx-auto object-contain rounded"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Required Components & Equipment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border border-[#E7DDD0] p-5 space-y-3">
                <h3 className="font-heading font-bold text-sm text-[#252521] flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-[#A66A43]" />
                  <span>Required Components</span>
                </h3>
                <ul className="divide-y divide-[#F5F0E8]">
                  {experiment.components_required.map((comp, idx) => (
                    <li key={idx} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <p className="font-semibold text-[#252521]">{comp.name}</p>
                        <p className="text-[#5C534A] text-[11px]">{comp.spec}</p>
                      </div>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#F5F0E8] text-[#49372E] shrink-0">
                        {comp.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white rounded-2xl border border-[#E7DDD0] p-5 space-y-3">
                <h3 className="font-heading font-bold text-sm text-[#252521] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#A66A43]" />
                  <span>Laboratory Instruments</span>
                </h3>
                <ul className="divide-y divide-[#F5F0E8]">
                  {experiment.equipment_required.map((eq, idx) => (
                    <li key={idx} className="py-2.5 text-xs space-y-0.5">
                      <p className="font-semibold text-[#252521]">{eq.name}</p>
                      <p className="text-[11px] font-mono text-[#A66A43]">{eq.model}</p>
                      <p className="text-[11px] text-[#5C534A]">{eq.spec}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-5">
            {/* Learning Objectives */}
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-5 space-y-3">
              <h3 className="font-heading font-bold text-sm text-[#252521]">Learning Objectives</h3>
              <ul className="space-y-2.5">
                {experiment.learning_objectives.map((obj, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-[#49372E] leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-[#A66A43] shrink-0 mt-0.5" />
                    <span>{obj}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Expected Result */}
            <div className="bg-[#FBF4EE] rounded-2xl border border-[#E7DDD0] p-5 space-y-2">
              <h3 className="font-heading font-bold text-sm text-[#49372E]">Expected Result</h3>
              <p className="text-xs text-[#49372E] leading-relaxed whitespace-pre-line">
                {experiment.expected_result}
              </p>
            </div>

            {/* Precautions */}
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-5 space-y-3">
              <h3 className="font-heading font-bold text-sm text-[#252521] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#A66A43]" />
                <span>Safety & Precautions</span>
              </h3>
              <ul className="space-y-2">
                {experiment.precautions.map((prec, idx) => (
                  <li key={idx} className="text-xs text-[#5C534A] flex items-start gap-2 leading-relaxed">
                    <span className="font-mono font-bold text-[#A66A43]">{idx + 1}.</span>
                    <span>{prec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROCEDURE & OBSERVATION TABLE */}
      {activeSubTab === 'procedure' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-4">
            <h2 className="font-heading font-bold text-lg text-[#252521]">Step-by-Step Procedure</h2>
            <div className="space-y-4">
              {experiment.procedure.map((step) => (
                <div
                  key={step.step}
                  className="p-4 rounded-xl bg-[#F5F0E8]/60 border border-[#E7DDD0] space-y-1.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[#49372E] text-white text-xs font-mono font-bold flex items-center justify-center shrink-0">
                      {step.step}
                    </span>
                    <h3 className="font-heading font-bold text-sm text-[#252521]">{step.title}</h3>
                  </div>
                  <p className="text-xs text-[#49372E] leading-relaxed pl-8">{step.instruction}</p>
                  {step.precaution && (
                    <p className="text-[11px] text-[#A66A43] font-medium pl-8 flex items-start gap-1.5 pt-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{step.precaution}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-4">
              <h2 className="font-heading font-bold text-base text-[#252521]">
                Observation Table Format
              </h2>
              <div className="overflow-x-auto border border-[#E7DDD0] rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F5F0E8] border-b border-[#E7DDD0]">
                      {experiment.observation_headers.map((col) => (
                        <th key={col.key} className="px-3 py-2.5 font-semibold text-[#49372E] whitespace-nowrap">
                          {col.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5F0E8] font-mono-numbers">
                    {(experiment.sample_observations && experiment.sample_observations.length > 0
                      ? experiment.sample_observations
                      : [{}]
                    ).map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF7F2]">
                        {experiment.observation_headers.map((col) => (
                          <td key={col.key} className="px-3 py-2 text-[#252521] whitespace-nowrap">
                            {row[col.key] !== undefined ? String(row[col.key]) : '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#5C534A]">
                Sample reference readings shown above illustrate standard MVIT practical observation formatting.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRACTICAL MANUAL PDF */}
      {activeSubTab === 'manual' && (
        <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-5 shadow-2xs">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F5F0E8] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FBF4EE] border border-[#E7DDD0] flex items-center justify-center text-[#A66A43]">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-heading font-bold text-lg text-[#252521]">
                    Practical Manual (PDF)
                  </h2>
                  {pdfUrl && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isDemoManual
                          ? 'bg-[#FFFBEB] border-[#FDE68A] text-[#B45309]'
                          : 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
                      }`}
                    >
                      {isDemoManual
                        ? 'DEMO – ILLUSTRATIVE CONTENT – NOT AN OFFICIAL COLLEGE DOCUMENT'
                        : 'UPLOADED DOCUMENT'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#5C534A] font-mono">{pdfFileName}</p>
              </div>
            </div>

            {pdfUrl && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#49372E] hover:bg-[#382922] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview Manual PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadManual}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#A66A43] hover:bg-[#8E5734] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
              </div>
            )}
          </div>

          {linkedDoc?.description && (
            <p className="text-xs text-[#5C534A] leading-relaxed">{linkedDoc.description}</p>
          )}

          {experiment.manual_content && (
            <div className="p-4 rounded-xl bg-[#F5F0E8] border border-[#E7DDD0] text-xs text-[#49372E] whitespace-pre-line font-mono max-h-80 overflow-y-auto">
              {experiment.manual_content}
            </div>
          )}

          {!pdfUrl && (
            <div className="p-4 rounded-xl bg-[#F5F0E8] border border-[#E7DDD0] text-xs text-[#5C534A] flex items-center gap-2">
              <Info className="w-4 h-4 text-[#A66A43] shrink-0" />
              <span>Practical manual PDF has not been uploaded for this experiment yet.</span>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: VIDEO LEARNING */}
      {activeSubTab === 'video' && (
        <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-5 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F5F0E8] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FBF4EE] border border-[#E7DDD0] flex items-center justify-center text-[#A66A43]">
                <Youtube className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-heading font-bold text-lg text-[#252521]">
                  Experiment Video Demonstration
                </h2>
                <p className="text-xs text-[#5C534A]">
                  {experiment.youtube_title || 'Curated MVIT Laboratory Video Resource'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ytInfo.mode === 'direct_video' && ytInfo.altVideoId && (
                <button
                  type="button"
                  onClick={() => setUseAltVideo((prev) => !prev)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#D8CBB9] hover:border-[#A66A43] text-[#49372E] text-xs font-semibold cursor-pointer"
                >
                  <span>{useAltVideo ? 'Switch to Primary Video' : 'Try Alternate Video'}</span>
                </button>
              )}

              {ytInfo.mode === 'direct_video' && activeWatchUrl && (
                <a
                  href={activeWatchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#A66A43] hover:bg-[#8E5734] text-white text-xs font-semibold transition-colors"
                >
                  <Youtube className="w-4 h-4" />
                  <span>Open on YouTube</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {ytInfo.searchUrl && (
                <a
                  href={ytInfo.searchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                    ytInfo.mode === 'search_only'
                      ? 'bg-[#A66A43] hover:bg-[#8E5734] text-white'
                      : 'bg-[#FAF6F0] border border-[#D8CBB9] hover:border-[#49372E] text-[#49372E]'
                  }`}
                >
                  <Youtube className="w-4 h-4" />
                  <span>{ytInfo.mode === 'search_only' ? 'FIND A DEMONSTRATION' : 'Search More Demos'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {ytInfo.mode === 'direct_video' && activeVideoId ? (
            <div className="max-w-4xl mx-auto space-y-2.5">
              <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#E7DDD0] bg-[#252521]">
                <iframe
                  key={activeVideoId}
                  src={`https://www.youtube.com/embed/${activeVideoId}`}
                  title={experiment.youtube_title || experiment.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <p className="text-[11px] text-[#6E675F] flex flex-wrap items-center justify-between gap-2">
                <span>
                  Verified video ID <code className="font-mono text-[#49372E]">{activeVideoId}</code> — watch inline or open directly on YouTube.
                </span>
                {ytInfo.altVideoId && (
                  <span>Alternate curated video is available above if needed.</span>
                )}
              </p>
            </div>
          ) : ytInfo.mode === 'search_only' && ytInfo.searchUrl ? (
            <div className="p-8 rounded-xl border border-[#E7DDD0] bg-[#FAF6F0] flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FBF4EE] border border-[#E7DDD0] flex items-center justify-center text-[#A66A43]">
                <Youtube className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-lg">
                <h3 className="font-heading font-bold text-base text-[#252521]">
                  Find a Verified Lab Demonstration on YouTube
                </h3>
                <p className="text-xs text-[#5C534A] leading-relaxed">
                  YouTube search results open securely in a new browser tab rather than an inline frame. Click below to browse lab demonstrations for{' '}
                  <strong className="text-[#49372E]">{ytInfo.searchQuery || experiment.title}</strong>.
                </p>
              </div>
              <a
                href={ytInfo.searchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#A66A43] hover:bg-[#8E5734] text-white text-xs font-bold tracking-wide transition-colors shadow-xs"
              >
                <Youtube className="w-4 h-4" />
                <span>FIND A DEMONSTRATION</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : (
            <div className="aspect-video w-full rounded-xl border border-dashed border-[#D6C7B4] bg-[#F5F0E8] flex flex-col items-center justify-center p-6 text-center space-y-2">
              <Youtube className="w-8 h-8 text-[#A66A43]/60" />
              <p className="text-xs font-semibold text-[#49372E]">
                Video demonstration is not available yet.
              </p>
              <p className="text-[11px] text-[#5C534A] max-w-xs">
                No YouTube video or search link is attached to this experiment yet. Refer to the practical manual and procedure tabs.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PERFORM VIRTUAL EXPERIMENT (BUILT-IN RIGS + VERIFIED EXTERNAL SIMULATIONS) */}
      {activeSubTab === 'simulator' && (
        <div className="space-y-5">
          {/* Controls Header */}
          <div className="bg-white rounded-2xl border border-[#E7DDD0] p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading font-bold text-base text-[#252521]">
                  Virtual Laboratory Workbench
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]">
                  {simInfo.providerLabel}
                </span>
              </div>
              <p className="text-xs text-[#5C534A] mt-0.5">
                {simInfo.note || `Interactive virtual simulation environment for ${experiment.title}.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowInstructionsDrawer((v) => !v)}
                className="px-3 py-1.5 rounded-lg border border-[#D6C7B4] bg-[#F5F0E8] hover:bg-[#E7DDD0] text-xs font-semibold text-[#49372E] cursor-pointer"
              >
                {showInstructionsDrawer ? 'Hide Lab Reference' : 'Show Lab Reference Alongside'}
              </button>
              {simInfo.hasExternal && simInfo.externalUrl && (
                <a
                  href={simInfo.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#49372E] hover:bg-[#382922] text-white text-xs font-semibold"
                >
                  <span>OPEN SIMULATION IN NEW TAB</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className={showInstructionsDrawer ? 'xl:col-span-8 space-y-5' : 'xl:col-span-12 space-y-5'}>
              {/* Built-in Interactive Virtual Experiment Simulator (Primary when present) */}
              {simInfo.hasBuiltin && renderBuiltInSimulator()}

              {/* Configured External Simulation Target */}
              {simInfo.hasExternal && simInfo.externalUrl && (
                <div className="bg-white rounded-2xl border border-[#E7DDD0] p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-bold text-sm text-[#252521]">
                          {simInfo.providerLabel}
                        </h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#E7DDD0] text-[#49372E]">
                          {simInfo.canEmbedExternal ? 'Embedded + External' : 'External New Tab'}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-[#5C534A] truncate max-w-xl mt-0.5">
                        {simInfo.externalUrl}
                      </p>
                    </div>
                    <a
                      href={simInfo.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#A66A43] hover:bg-[#8E5734] text-white text-xs font-bold"
                    >
                      <span>OPEN SIMULATION IN NEW TAB</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {simInfo.canEmbedExternal ? (
                    <div className="space-y-2">
                      <div className="aspect-video w-full rounded-xl overflow-hidden border border-[#E7DDD0] bg-[#F5F0E8]">
                        <iframe
                          src={simInfo.externalUrl}
                          title={`${experiment.title} Virtual Simulation`}
                          className="w-full h-full"
                          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        />
                      </div>
                      <p className="text-[11px] text-[#6E675F]">
                        If your campus firewall or browser blocks embedded scripts, use{' '}
                        <strong className="text-[#49372E]">OPEN SIMULATION IN NEW TAB</strong> above.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] text-xs text-[#49372E] flex flex-wrap items-center justify-between gap-3">
                      <span className="max-w-xl leading-relaxed">
                        {simInfo.note ||
                          'This external simulator enforces same-origin framing headers and launches reliably in a dedicated browser tab.'}
                      </span>
                      <a
                        href={simInfo.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-bold text-[#A66A43] underline shrink-0"
                      >
                        <span>Launch {simInfo.providerLabel}</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {!simInfo.isAvailable && (
                <div className="bg-white rounded-2xl border border-[#E7DDD0] p-10 text-center space-y-2">
                  <MonitorPlay className="w-10 h-10 text-[#A66A43]/60 mx-auto" />
                  <h3 className="font-heading font-bold text-sm text-[#252521]">
                    Virtual simulation is not applicable or not configured yet.
                  </h3>
                  <p className="text-xs text-[#5C534A] max-w-md mx-auto">
                    {simInfo.note ||
                      'Neither a built-in simulator nor an external simulation link is attached to this practical module.'}
                  </p>
                </div>
              )}
            </div>

            {/* Adjacent Protocol Instructions Drawer */}
            {showInstructionsDrawer && (
              <aside className="xl:col-span-4 bg-white rounded-2xl border border-[#E7DDD0] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E7DDD0] pb-3">
                  <h3 className="font-heading font-bold text-sm text-[#252521]">
                    Bench Reference Protocol
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowInstructionsDrawer(false)}
                    className="p-1 rounded-md text-[#5C534A] hover:bg-[#F5F0E8] cursor-pointer"
                    aria-label="Close reference"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                  {experiment.procedure.map((step) => (
                    <div key={step.step} className="text-xs space-y-1 pb-3 border-b border-[#F5F0E8] last:border-b-0">
                      <p className="font-bold text-[#49372E]">
                        Step {step.step}: {step.title}
                      </p>
                      <p className="text-[#5C534A] leading-relaxed">{step.instruction}</p>
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      )}

      {/* Embedded PDF Manual Preview Modal */}
      {showPdfPreview && (pdfUrl || linkedDoc?.storage_path) && (
        <PdfViewerModal
          isOpen={showPdfPreview}
          onClose={() => setShowPdfPreview(false)}
          title={experiment.title}
          pdfUrl={pdfUrl}
          storagePath={linkedDoc?.storage_path}
          docId={linkedDoc?.id}
          fileName={pdfFileName}
          fileSize={linkedDoc?.file_size}
          subjectCode={experiment.subject_code}
          uploadedBy={linkedDoc?.uploaded_by_name}
          uploadedAt={linkedDoc?.created_at}
          isDemo={isDemoManual}
        />
      )}
    </div>
  );
};
