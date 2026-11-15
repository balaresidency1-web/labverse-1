import React, { useState, useMemo, useEffect } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import {
  Lab,
  Course,
  PracticalSubject,
  InventoryItem,
  PublicQrInventoryItem,
  LabManualDocument,
} from '../../types';
import { labverseRepository } from '../../services/labverseRepository';
import {
  formatCountLabel,
  getCoursesForLab,
  getSubjectsForLabAndCourse,
  getSubjectsForLabCourseAndYear,
  getExperimentsForLabCourseSubject,
  getAcademicYearStats,
  formatAcademicYearLabel,
  getYearFromSemester,
  isExperimentVideoAvailable,
  isExperimentSimulationAvailable,
  classifyYouTubeResource,
  resolveExperimentSimulation,
  isPublicVisibleLab,
} from '../../utils/labRules';
import { parseInventoryQrPayload, validateQrScanAccess } from '../../utils/qrCodeService';
import { ExperimentDetailView } from '../experiment/ExperimentDetailView';
import { PdfViewerModal } from '../common/PdfViewerModal';
import { QrScannerModal } from '../qr/QrScannerModal';
import { ItemQrDetailModal } from '../qr/ItemQrDetailModal';
import {
  generateDemoSyllabusPdfDataUrl,
} from '../../utils/pdfGenerator';
import { downloadResolvedPdf } from '../../utils/pdfSource';
import mvitLabHeroImg from '../../assets/images/mvit_physics_lab_hero_1794549994785.jpg';
import electronicsLabImg from '../../assets/images/lab_electronics_devices_1794555088920.jpg';
import physicalScienceLabImg from '../../assets/images/lab_physical_science_1794555089262.jpg';
import communicationLabImg from '../../assets/images/lab_communication_hub_1794555090005.jpg';
import {
  FlaskConical,
  BookOpen,
  FileText,
  Video,
  Laptop,
  ArrowRight,
  ArrowLeft,
  Search,
  MapPin,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  Download,
  Eye,
  Menu,
  X,
  Lock,
  Layers,
  Sparkles,
  UserCheck,
  GraduationCap,
  ChevronRight,
  Calendar,
} from 'lucide-react';

type PublicPage = 'home' | 'laboratories' | 'about' | 'contact';

interface PublicPortalViewProps {
  onOpenAdminLogin: () => void;
}

function getLabImage(lab: Lab): string {
  if (lab.image_key === 'electronics' || lab.lab_code.toUpperCase().startsWith('EDL')) {
    return electronicsLabImg;
  }
  if (lab.image_key === 'physical_science' || lab.lab_code.toUpperCase().startsWith('PSL')) {
    return physicalScienceLabImg;
  }
  if (lab.image_key === 'communication' || lab.lab_code.toUpperCase().startsWith('PCL')) {
    return communicationLabImg;
  }
  return mvitLabHeroImg;
}

export const PublicPortalView: React.FC<PublicPortalViewProps> = ({ onOpenAdminLogin }) => {
  const {
    institution,
    isSupabaseActive,
    authLoading,
    publicLabs,
    courses,
    laboratoryCourses,
    experimentCourses,
    subjects,
    experiments,
    documents,
    inventory,
  } = useLabverse();

  const [activePage, setActivePage] = useState<PublicPage>('home');
  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [subjectViewStage, setSubjectViewStage] = useState<'syllabus' | 'experiments'>('syllabus');
  const [selectedExperimentId, setSelectedExperimentId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [
    activePage,
    selectedLabId,
    selectedCourseId,
    selectedYear,
    selectedSubjectId,
    subjectViewStage,
    selectedExperimentId,
  ]);

  // Filters
  const [labSearch, setLabSearch] = useState('');
  const [labDeptFilter, setLabDeptFilter] = useState('all');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [expSearch, setExpSearch] = useState('');

  // Public PDF & QR Modals
  const [pdfModalDoc, setPdfModalDoc] = useState<{
    title: string;
    url: string;
    storagePath?: string;
    docId?: string;
    fileName: string;
    fileSize?: number;
    subjectCode?: string;
    uploadedBy?: string;
    uploadedAt?: string;
    isDemo?: boolean;
  } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedItem, setScannedItem] = useState<InventoryItem | PublicQrInventoryItem | null>(null);

  // Support deep link ?qr=<item_code_or_id> via sanitized public QR RPC (equipment only; never PC Lab internals)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isSupabaseActive && (!institution.id || institution.id === 'inst-mvit')) return;

    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr');
    if (!qrParam) return;

    let cancelled = false;
    const resolvePublicQr = async () => {
      const trimmedQr = qrParam.trim();
      if (
        trimmedQr.startsWith('LABVERSE:PC:') ||
        trimmedQr.includes('"pc_computer"') ||
        trimmedQr.includes('"computerId"') ||
        trimmedQr.includes('"computerCode"')
      ) {
        return;
      }
      const parsed = parseInventoryQrPayload(trimmedQr);
      const codeOrId = (parsed.inventoryId || parsed.itemCode || trimmedQr).trim();
      if (!codeOrId) return;

      const res = await labverseRepository.lookupPublicInventoryQr(codeOrId);
      if (cancelled || !res.data) return;

      const access = validateQrScanAccess(parsed, null, res.data, institution.id);
      if (access.allowed) {
        setScannedItem(res.data);
      }
    };

    resolvePublicQr();
    return () => {
      cancelled = true;
    };
  }, [institution.id, isSupabaseActive]);

  // Publicly visible active laboratories (strictly excludes PC Lab & non-public labs)
  const visiblePublicLabs = useMemo(
    () => publicLabs.filter((l) => isPublicVisibleLab(l)),
    [publicLabs]
  );

  // Published subjects & experiments belonging to active public MVIT labs
  const activeLabIds = useMemo(
    () => new Set(visiblePublicLabs.map((l) => l.id)),
    [visiblePublicLabs]
  );

  const publicSubjects = useMemo(
    () =>
      subjects.filter(
        (s) => s.is_active !== false && Boolean(s.lab_id && activeLabIds.has(s.lab_id))
      ),
    [subjects, activeLabIds]
  );

  const publicExperiments = useMemo(() => {
    const subjIds = new Set(publicSubjects.map((s) => s.id));
    return experiments.filter((e) => e.is_published && subjIds.has(e.subject_id));
  }, [experiments, publicSubjects]);

  const departmentsAvailable = useMemo(() => {
    const set = new Set<string>();
    visiblePublicLabs.forEach((l) => {
      if (l.department_name) set.add(l.department_name);
    });
    return Array.from(set);
  }, [visiblePublicLabs]);

  const filteredLabs = useMemo(() => {
    return visiblePublicLabs.filter((lab) => {
      const q = labSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        lab.name.toLowerCase().includes(q) ||
        lab.lab_code.toLowerCase().includes(q) ||
        (lab.department_name || '').toLowerCase().includes(q) ||
        lab.building.toLowerCase().includes(q);
      const matchesDept = labDeptFilter === 'all' || lab.department_name === labDeptFilter;
      return matchesSearch && matchesDept;
    });
  }, [visiblePublicLabs, labSearch, labDeptFilter]);

  const selectedLab = useMemo(
    () => visiblePublicLabs.find((l) => l.id === selectedLabId) || null,
    [visiblePublicLabs, selectedLabId]
  );

  const labCoursesAvailable: Course[] = useMemo(() => {
    if (!selectedLab) return [];
    return getCoursesForLab(selectedLab.id, courses, laboratoryCourses);
  }, [selectedLab, courses, laboratoryCourses]);

  const selectedCourse: Course | null = useMemo(() => {
    if (!selectedCourseId) return null;
    return labCoursesAvailable.find((c) => c.id === selectedCourseId) || null;
  }, [labCoursesAvailable, selectedCourseId]);

  const effectiveCourseFilterId = selectedCourse ? selectedCourse.id : null;

  const yearStatsForCourse = useMemo(() => {
    if (!selectedLab || !selectedCourse) return [];
    return getAcademicYearStats(
      selectedLab.id,
      selectedCourse.id,
      publicSubjects,
      publicExperiments,
      experimentCourses,
      documents,
      selectedCourse
    );
  }, [selectedLab, selectedCourse, publicSubjects, publicExperiments, experimentCourses, documents]);

  const subjectsForSelectedCourseAndYear = useMemo(() => {
    if (!selectedLab || !selectedCourse || !selectedYear) return [];
    return getSubjectsForLabCourseAndYear(
      selectedLab.id,
      selectedCourse.id,
      selectedYear,
      publicSubjects,
      publicExperiments,
      experimentCourses,
      selectedCourse
    );
  }, [
    selectedLab,
    selectedCourse,
    selectedYear,
    publicSubjects,
    publicExperiments,
    experimentCourses,
  ]);

  const filteredSubjectsForCourse = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    if (!q) return subjectsForSelectedCourseAndYear;
    return subjectsForSelectedCourseAndYear.filter((subj) => {
      const subjMatches =
        subj.name.toLowerCase().includes(q) ||
        subj.code.toLowerCase().includes(q) ||
        subj.description.toLowerCase().includes(q);
      const hasMatchingExp = getExperimentsForLabCourseSubject(
        effectiveCourseFilterId,
        subj.id,
        publicExperiments,
        experimentCourses
      ).some((e) => e.title.toLowerCase().includes(q) || e.aim.toLowerCase().includes(q));
      return subjMatches || hasMatchingExp;
    });
  }, [
    subjectsForSelectedCourseAndYear,
    subjectSearch,
    effectiveCourseFilterId,
    publicExperiments,
    experimentCourses,
  ]);

  const activeSubject: PracticalSubject | null = useMemo(() => {
    if (!selectedLab || !selectedCourse || !selectedYear || !selectedSubjectId) return null;
    return subjectsForSelectedCourseAndYear.find((s) => s.id === selectedSubjectId) || null;
  }, [
    selectedLab,
    selectedCourse,
    selectedYear,
    selectedSubjectId,
    subjectsForSelectedCourseAndYear,
  ]);

  const allSubjectExperiments = useMemo(() => {
    return getExperimentsForLabCourseSubject(
      effectiveCourseFilterId,
      activeSubject?.id || null,
      publicExperiments,
      experimentCourses
    );
  }, [effectiveCourseFilterId, activeSubject, publicExperiments, experimentCourses]);

  const subjectExperiments = useMemo(() => {
    const q = expSearch.trim().toLowerCase();
    if (!q) return allSubjectExperiments;
    return allSubjectExperiments.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.aim.toLowerCase().includes(q) ||
        e.subject_code.toLowerCase().includes(q)
    );
  }, [allSubjectExperiments, expSearch]);

  const getLabCardSummary = (lab: Lab) => {
    const labSubjs = publicSubjects.filter((s) => s.lab_id === lab.id);
    const labCourses = getCoursesForLab(lab.id, courses, laboratoryCourses);
    return {
      subjects: labSubjs,
      courses: labCourses,
    };
  };

  const navigateTop = (page: PublicPage) => {
    setActivePage(page);
    setSelectedLabId(null);
    setSelectedCourseId(null);
    setSelectedYear(null);
    setSelectedSubjectId(null);
    setSubjectViewStage('syllabus');
    setSelectedExperimentId(null);
    setSubjectSearch('');
    setExpSearch('');
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLaboratory = (lab: Lab) => {
    setActivePage('laboratories');
    setSelectedLabId(lab.id);
    setSelectedCourseId(null);
    setSelectedYear(null);
    setSelectedSubjectId(null);
    setSubjectViewStage('syllabus');
    setSelectedExperimentId(null);
    setSubjectSearch('');
    setExpSearch('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadSyllabusPdf = (subj: PracticalSubject) => {
    const uploadedDoc: LabManualDocument | undefined =
      documents.find((d) => d.id === subj.syllabus_pdf_id) ||
      documents.find((d) => d.type === 'syllabus' && d.subject_id === subj.id && d.is_published);

    if (uploadedDoc?.file_url || uploadedDoc?.storage_path) {
      void downloadResolvedPdf({
        pdfUrl: uploadedDoc.file_url,
        storagePath: uploadedDoc.storage_path,
        docId: uploadedDoc.id,
        fileName: uploadedDoc.file_name,
        isSupabaseActive,
      });
      return;
    }
    if (subj.syllabus_pdf_url) {
      void downloadResolvedPdf({
        pdfUrl: subj.syllabus_pdf_url,
        fileName: subj.syllabus_pdf_name || `${subj.code}_Syllabus.pdf`,
        isSupabaseActive,
      });
      return;
    }

    const demoUrl = generateDemoSyllabusPdfDataUrl({
      subjectCode: subj.code,
      subjectName: subj.name,
      semester: subj.semester,
      year: getYearFromSemester(subj.semester, selectedCourse?.semesters_per_year ?? 2),
      description: subj.description,
      institutionName: institution.name,
      units: subj.syllabus.map((u) => ({
        unit_number: u.unit_number,
        title: u.title,
        description: u.description,
        learning_outcomes: u.learning_outcomes,
      })),
    });
    void downloadResolvedPdf({
      pdfUrl: demoUrl,
      fileName: `${subj.code}_Demo_Syllabus.pdf`,
      isSupabaseActive,
    });
  };

  const handlePreviewSyllabusPdf = (subj: PracticalSubject) => {
    const uploadedDoc: LabManualDocument | undefined =
      documents.find((d) => d.id === subj.syllabus_pdf_id) ||
      documents.find((d) => d.type === 'syllabus' && d.subject_id === subj.id && d.is_published);

    const isDemoDoc = uploadedDoc
      ? Boolean(uploadedDoc.is_demo)
      : subj.syllabus_pdf_url
        ? Boolean(subj.is_demo) && subj.syllabus_pdf_url.startsWith('data:')
        : !isSupabaseActive || Boolean(subj.is_demo);

    if (uploadedDoc?.file_url || uploadedDoc?.storage_path) {
      setPdfModalDoc({
        title: uploadedDoc.title,
        url: uploadedDoc.file_url,
        storagePath: uploadedDoc.storage_path,
        docId: uploadedDoc.id,
        fileName: uploadedDoc.file_name,
        fileSize: uploadedDoc.file_size,
        subjectCode: subj.code,
        uploadedBy: uploadedDoc.uploaded_by_name,
        uploadedAt: uploadedDoc.created_at,
        isDemo: isDemoDoc,
      });
      return;
    }
    if (subj.syllabus_pdf_url) {
      setPdfModalDoc({
        title: `${subj.code} — ${subj.name} Syllabus`,
        url: subj.syllabus_pdf_url,
        fileName: subj.syllabus_pdf_name || `${subj.code}_Syllabus.pdf`,
        subjectCode: subj.code,
        isDemo: isDemoDoc,
      });
      return;
    }

    const demoUrl = generateDemoSyllabusPdfDataUrl({
      subjectCode: subj.code,
      subjectName: subj.name,
      semester: subj.semester,
      year: getYearFromSemester(subj.semester, selectedCourse?.semesters_per_year ?? 2),
      description: subj.description,
      institutionName: institution.name,
      units: subj.syllabus.map((u) => ({
        unit_number: u.unit_number,
        title: u.title,
        description: u.description,
        learning_outcomes: u.learning_outcomes,
      })),
    });
    setPdfModalDoc({
      title: `${subj.code} - Illustrative Syllabus`,
      url: demoUrl,
      fileName: `${subj.code}_Demo_Syllabus.pdf`,
      subjectCode: subj.code,
      isDemo: true,
    });
  };

  const renderNavbar = () => (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E7DDD0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand */}
        <button
          type="button"
          onClick={() => navigateTop('home')}
          className="flex items-center gap-3 text-left shrink-0 cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-[#49372E] flex items-center justify-center text-[#F5F0E8] shadow-sm">
            <FlaskConical className="w-5 h-5 text-[#F5F0E8]" />
          </div>
          <div className="whitespace-nowrap">
            <div className="font-heading font-bold text-base text-[#252521] tracking-tight leading-none">
              LABVERSE
            </div>
            <div className="text-[11px] text-[#6E675F] mt-0.5 hidden sm:block">
              Smart Laboratory Learning and Management Platform
            </div>
          </div>
        </button>

        {/* Zone 2: Simple Navigation */}
        <nav aria-label="Public navigation" className="hidden md:flex items-center gap-1">
          {[
            { id: 'home', label: 'Home' },
            { id: 'laboratories', label: 'Laboratories' },
            { id: 'about', label: 'About LABVERSE' },
            { id: 'contact', label: 'Contact' },
          ].map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTop(item.id as PublicPage)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#E7DDD0] text-[#49372E]'
                    : 'text-[#49372E]/80 hover:text-[#252521] hover:bg-[#F5F0E8]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isSupabaseActive && (
            <span className="hidden lg:inline-flex items-center px-2 py-1 rounded-md bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-mono text-[10px] font-bold">
              DEMO MODE
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D8CBB9] bg-[#FAF6F0] hover:bg-[#E7DDD0] text-[#49372E] text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
            title="Inspect Laboratory Apparatus via QR"
          >
            <QrCode className="w-3.5 h-3.5 text-[#A66A43]" />
            <span>QR Lookup</span>
          </button>

          <button
            type="button"
            onClick={onOpenAdminLogin}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#49372E] hover:bg-[#382922] text-white text-xs font-semibold whitespace-nowrap shadow-sm transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin Login</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="md:hidden p-2 rounded-lg border border-[#E7DDD0] text-[#49372E] hover:bg-[#F5F0E8] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E7DDD0] bg-white px-4 py-3 space-y-1.5">
          {[
            { id: 'home', label: 'Home' },
            { id: 'laboratories', label: 'Laboratories' },
            { id: 'about', label: 'About LABVERSE' },
            { id: 'contact', label: 'Contact' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTop(item.id as PublicPage)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold ${
                activePage === item.id
                  ? 'bg-[#E7DDD0] text-[#49372E]'
                  : 'text-[#252521] hover:bg-[#F5F0E8]'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              setIsScannerOpen(true);
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold text-[#A66A43] hover:bg-[#F5F0E8] flex items-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Equipment QR Lookup</span>
          </button>
        </div>
      )}
    </header>
  );

  // Sub-view: Experiment Workspace when browsing publicly
  if (selectedExperimentId) {
    return (
      <div className="min-h-screen bg-[#F5F0E8] text-[#252521] flex flex-col">
        {renderNavbar()}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <ExperimentDetailView
            experimentId={selectedExperimentId}
            onBack={() => setSelectedExperimentId(null)}
            isPublic={true}
            breadcrumbContext={{
              labName: selectedLab?.name,
              courseCode: selectedCourse?.code,
              yearLabel: selectedYear ? formatAcademicYearLabel(selectedYear) : undefined,
              subjectCode: activeSubject?.code,
            }}
          />
        </main>
        {renderFooter()}
        {renderModals()}
      </div>
    );
  }

  function renderFooter() {
    return (
      <footer className="bg-[#49372E] text-[#F5F0E8] border-t border-[#382922] mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="space-y-2">
            <div className="font-heading font-bold text-sm text-white">LABVERSE</div>
            <p className="text-[#E7DDD0]/90 leading-relaxed">
              Smart Laboratory Learning and Management Platform of Laboratory Learning Support, Puducherry.
            </p>
            <p className="font-mono text-[11px] text-[#E7DDD0]/75">Learn. Explore. Experiment.</p>
          </div>
          <div className="space-y-1.5">
            <div className="font-heading font-semibold text-white">Quick Links</div>
            <div className="flex flex-col items-start gap-1 text-[#E7DDD0]">
              <button type="button" onClick={() => navigateTop('home')} className="hover:text-white cursor-pointer">
                Home
              </button>
              <button type="button" onClick={() => navigateTop('laboratories')} className="hover:text-white cursor-pointer">
                Select Laboratory
              </button>
              <button type="button" onClick={() => navigateTop('about')} className="hover:text-white cursor-pointer">
                About LABVERSE
              </button>
              <button type="button" onClick={() => navigateTop('contact')} className="hover:text-white cursor-pointer">
                Contact the laboratory administrator
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="font-heading font-semibold text-white">Campus Address</div>
            <p className="text-[#E7DDD0]/90">{institution.address}</p>
            <p className="text-[#E7DDD0]/90 font-mono">{institution.contact_email || 'principal@mvit.edu.in'}</p>
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#A66A43] hover:bg-[#8E5734] text-white font-semibold cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Staff &amp; Admin Portal</span>
            </button>
          </div>
        </div>
      </footer>
    );
  }

  function renderModals() {
    return (
      <>
        <PdfViewerModal
          isOpen={!!pdfModalDoc}
          onClose={() => setPdfModalDoc(null)}
          title={pdfModalDoc?.title || ''}
          pdfUrl={pdfModalDoc?.url || ''}
          storagePath={pdfModalDoc?.storagePath}
          docId={pdfModalDoc?.docId}
          fileName={pdfModalDoc?.fileName || 'manual.pdf'}
          fileSize={pdfModalDoc?.fileSize}
          subjectCode={pdfModalDoc?.subjectCode}
          uploadedBy={pdfModalDoc?.uploadedBy}
          uploadedAt={pdfModalDoc?.uploadedAt}
          isDemo={pdfModalDoc?.isDemo}
        />

        <QrScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          inventory={isSupabaseActive ? [] : inventory}
          currentLab={selectedLab}
          onItemDetected={(item) => setScannedItem(item)}
        />

        <ItemQrDetailModal
          isOpen={!!scannedItem}
          onClose={() => setScannedItem(null)}
          item={scannedItem}
          currentLab={visiblePublicLabs.find((l) => l.id === scannedItem?.lab_id) || null}
          userRole={null}
          readOnlyPublic={true}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8] text-[#252521] flex flex-col">
      {renderNavbar()}

      <main className="flex-1">
        {/* ==================== 1. CLEAN MODERN HOMEPAGE ==================== */}
        {activePage === 'home' && (
          <>
            <section className="border-b border-[#E7DDD0] bg-gradient-to-b from-[#FAF6F0] to-[#F5F0E8]">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-6 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E7DDD0] text-[#49372E] text-xs font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-[#A66A43]" />
                    <span>Laboratory Learning Support, Puducherry</span>
                  </div>

                  <h1 className="font-heading font-extrabold text-3xl sm:text-5xl text-[#252521] tracking-tight leading-tight">
                    Virtual &amp; Practical Laboratory Learning
                  </h1>

                  <p className="text-sm sm:text-base text-[#49372E]/90 leading-relaxed max-w-xl">
                    Welcome to LABVERSE. Select your campus laboratory, choose your engineering course and academic year, explore practical syllabi and PDF manuals, watch curated video demonstrations, and launch interactive Bench Twin simulations—all without login barriers.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => navigateTop('laboratories')}
                      className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#A66A43] hover:bg-[#8E5734] text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
                    >
                      <span>Start Learning</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateTop('about')}
                      className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white border border-[#D8CBB9] hover:bg-[#FAF6F0] text-[#49372E] text-sm font-semibold transition-colors cursor-pointer"
                    >
                      <span>How It Works</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-5 border-t border-[#E7DDD0]">
                    <div>
                      <div className="font-mono font-bold text-xl text-[#49372E] tabular-nums">
                        {visiblePublicLabs.length}
                      </div>
                      <div className="text-xs text-[#6E675F]">Laboratories</div>
                    </div>
                    <div>
                      <div className="font-mono font-bold text-xl text-[#49372E] tabular-nums">
                        {courses.filter((c) => c.is_active !== false).length}
                      </div>
                      <div className="text-xs text-[#6E675F]">Engineering Courses</div>
                    </div>
                    <div>
                      <div className="font-mono font-bold text-xl text-[#A66A43] tabular-nums">
                        {publicExperiments.length}
                      </div>
                      <div className="text-xs text-[#6E675F]">Published Experiments</div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6">
                  <div className="relative rounded-2xl overflow-hidden border border-[#D8CBB9] shadow-lg bg-white">
                    <img
                      src={mvitLabHeroImg}
                      alt="Digital Science & Electronics Laboratory"
                      className="w-full h-72 sm:h-96 object-cover"
                    />
                    <div className="p-4 bg-white border-t border-[#E7DDD0] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-[#49372E] font-semibold">
                        <Sparkles className="w-4 h-4 text-[#A66A43]" />
                        <span>Step-by-Step Guided Laboratory Portal</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#6E675F]">
                        Open Public Access
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Concise 3-Pillar Platform Overview */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-2xl bg-white border border-[#E7DDD0] space-y-2.5 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-[#49372E] text-white flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h2 className="font-heading font-bold text-base text-[#252521]">
                    Syllabi &amp; Practical Manuals
                  </h2>
                  <p className="text-xs text-[#49372E]/85 leading-relaxed">
                    Browse structured aims, theory, apparatus specifications, procedures, and preview or download multi-page laboratory manuals.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-[#E7DDD0] space-y-2.5 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-[#A66A43] text-white flex items-center justify-center">
                    <Video className="w-5 h-5" />
                  </div>
                  <h2 className="font-heading font-bold text-base text-[#252521]">
                    Video Learning Demonstrations
                  </h2>
                  <p className="text-xs text-[#49372E]/85 leading-relaxed">
                    Watch faculty-vetted YouTube experiment walkthroughs alongside your practical procedure steps.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-white border border-[#E7DDD0] space-y-2.5 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-[#2E6F4E] text-white flex items-center justify-center">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <h2 className="font-heading font-bold text-base text-[#252521]">
                    Bench Twin Virtual Simulators
                  </h2>
                  <p className="text-xs text-[#49372E]/85 leading-relaxed">
                    Practice measurements and circuit characteristics on interactive virtual rigs before entering the physical bench.
                  </p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ==================== 2. CENTERED LABORATORY SELECTION ==================== */}
        {activePage === 'laboratories' && !selectedLab && (
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
            <div className="text-center space-y-2 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#A66A43]">
                <FlaskConical className="w-3.5 h-3.5" />
                <span>LABVERSE Learning Portal • Step 1 of 7</span>
              </div>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#252521]">
                Choose Your Laboratory
              </h1>
              <p className="text-xs sm:text-sm text-[#6E675F]">
                Select an active Laboratory Learning Support laboratory below to choose your course, academic year, practical subject, and experiments.
              </p>
            </div>

            {/* Centered Search & Department Filter */}
            <div className="bg-white p-3.5 rounded-2xl border border-[#E7DDD0] shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 max-w-3xl mx-auto">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  placeholder="Search laboratories by name, code, or block..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF6F0] border border-[#D8CBB9] rounded-xl focus:outline-none focus:border-[#A66A43]"
                />
              </div>

              {departmentsAvailable.length > 0 && (
                <select
                  aria-label="Filter by Department"
                  value={labDeptFilter}
                  onChange={(e) => setLabDeptFilter(e.target.value)}
                  className="px-3 py-2 text-xs bg-[#FAF6F0] border border-[#D8CBB9] rounded-xl text-[#252521]"
                >
                  <option value="all">All Departments ({visiblePublicLabs.length})</option>
                  {departmentsAvailable.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Centered Laboratory Cards Grid */}
            {authLoading ? (
              <div className="bg-white rounded-2xl border border-[#E7DDD0] p-12 text-center space-y-2 max-w-xl mx-auto">
                <FlaskConical className="w-10 h-10 text-[#A66A43]/60 mx-auto" />
                <h2 className="font-heading font-bold text-base text-[#252521]">
                  Loading Laboratories...
                </h2>
                <p className="text-xs text-[#6E675F]">
                  Preparing active practical and computing laboratories.
                </p>
              </div>
            ) : filteredLabs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E7DDD0] p-12 text-center space-y-2 max-w-xl mx-auto">
                <FlaskConical className="w-10 h-10 text-[#A66A43]/60 mx-auto" />
                <h2 className="font-heading font-bold text-base text-[#252521]">
                  No active laboratories match your filter
                </h2>
                <p className="text-xs text-[#6E675F]">
                  Clear your search query or select All Departments to view laboratories.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredLabs.map((lab) => {
                  const { subjects: labSubjs } = getLabCardSummary(lab);
                  const imgSrc = getLabImage(lab);

                  return (
                    <article
                      key={lab.id}
                      className="bg-white rounded-2xl border border-[#E7DDD0] shadow-sm hover:shadow-md hover:border-[#A66A43] transition-all flex flex-col overflow-hidden"
                    >
                      <div className="relative h-44 bg-[#FAF6F0] overflow-hidden border-b border-[#E7DDD0]">
                        <img
                          src={imgSrc}
                          alt={lab.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-[#252521]/85 text-white font-mono text-[11px] font-bold">
                          {lab.lab_code}
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h2 className="font-heading font-bold text-lg text-[#252521]">
                                {lab.name}
                              </h2>
                              <p className="text-xs text-[#6E675F] mt-0.5">
                                {lab.building}, {lab.room_number}
                              </p>
                            </div>
                            <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] text-[#49372E] flex items-center justify-center shrink-0">
                              <FlaskConical className="w-4 h-4 text-[#A66A43]" />
                            </div>
                          </div>

                          <p className="text-xs text-[#49372E]/90 leading-relaxed line-clamp-2">
                            {lab.description ||
                              'Structured laboratory experiments, official manuals, and virtual simulations.'}
                          </p>
                        </div>

                        <div className="space-y-2.5 pt-2 border-t border-[#F5F0E8]">
                          <div className="text-[11px] text-[#6E675F]">
                            <span className="font-semibold text-[#49372E]">
                              Available Subjects:{' '}
                            </span>
                            {labSubjs.length > 0 ? (
                              <span>
                                {labSubjs.map((s) => `${s.code} (${s.name})`).join(', ')}
                              </span>
                            ) : (
                              <span>Configured by Lab Assistant</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => openLaboratory(lab)}
                            className="w-full py-2.5 px-4 rounded-xl bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <span>Enter Laboratory</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ==================== 3. INSIDE SELECTED LABORATORY ==================== */}
        {activePage === 'laboratories' && selectedLab && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Persistent Breadcrumb Trail */}
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-[#6E675F]">
              <button
                type="button"
                onClick={() => navigateTop('home')}
                className="hover:text-[#49372E] font-medium cursor-pointer"
              >
                Home
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <button
                type="button"
                onClick={() => {
                  setSelectedLabId(null);
                  setSelectedCourseId(null);
                  setSelectedYear(null);
                  setSelectedSubjectId(null);
                  setSubjectViewStage('syllabus');
                  setSubjectSearch('');
                  setExpSearch('');
                }}
                className="hover:text-[#49372E] font-medium cursor-pointer"
              >
                Laboratories
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <button
                type="button"
                onClick={() => {
                  setSelectedCourseId(null);
                  setSelectedYear(null);
                  setSelectedSubjectId(null);
                  setSubjectViewStage('syllabus');
                  setSubjectSearch('');
                  setExpSearch('');
                }}
                className={`font-semibold cursor-pointer ${
                  !selectedCourse ? 'text-[#49372E]' : 'hover:text-[#49372E]'
                }`}
              >
                {selectedLab.name}
              </button>
              {selectedCourse && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedYear(null);
                      setSelectedSubjectId(null);
                      setSubjectViewStage('syllabus');
                      setSubjectSearch('');
                      setExpSearch('');
                    }}
                    className={`font-semibold cursor-pointer ${
                      !selectedYear ? 'text-[#A66A43]' : 'hover:text-[#49372E]'
                    }`}
                  >
                    {selectedCourse.code}
                  </button>
                </>
              )}
              {selectedYear && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubjectId(null);
                      setSubjectViewStage('syllabus');
                      setExpSearch('');
                    }}
                    className={`font-semibold cursor-pointer ${
                      !activeSubject ? 'text-[#A66A43]' : 'hover:text-[#49372E]'
                    }`}
                  >
                    {formatAcademicYearLabel(selectedYear)}
                  </button>
                </>
              )}
              {activeSubject && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectViewStage('syllabus');
                      setExpSearch('');
                    }}
                    className={`font-semibold cursor-pointer ${
                      subjectViewStage === 'syllabus' ? 'text-[#A66A43]' : 'hover:text-[#49372E]'
                    }`}
                  >
                    {activeSubject.code} (Syllabus)
                  </button>
                </>
              )}
              {activeSubject && subjectViewStage === 'experiments' && (
                <>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-semibold text-[#A66A43]">Experiments</span>
                </>
              )}
            </nav>

            {/* Laboratory Banner Header */}
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 shadow-xs flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <button
                  type="button"
                  onClick={() => {
                    if (activeSubject && subjectViewStage === 'experiments') {
                      setSubjectViewStage('syllabus');
                      setExpSearch('');
                    } else if (activeSubject) {
                      setSelectedSubjectId(null);
                      setSubjectViewStage('syllabus');
                      setExpSearch('');
                    } else if (selectedYear) {
                      setSelectedYear(null);
                      setSelectedSubjectId(null);
                      setSubjectSearch('');
                    } else if (selectedCourse) {
                      setSelectedCourseId(null);
                      setSelectedYear(null);
                      setSelectedSubjectId(null);
                      setSubjectSearch('');
                    } else {
                      setSelectedLabId(null);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A66A43] hover:text-[#49372E] cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>
                    {activeSubject && subjectViewStage === 'experiments'
                      ? `Back to Syllabus (${activeSubject.code})`
                      : activeSubject && selectedYear
                        ? `Back to ${formatAcademicYearLabel(selectedYear)} Subjects`
                        : selectedYear && selectedCourse
                          ? `Back to Academic Year Selection (${selectedCourse.code})`
                          : selectedCourse
                            ? `Back to Course Selection in ${selectedLab.name}`
                            : 'Back to Laboratory Selection'}
                  </span>
                </button>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#49372E] text-white">
                    {selectedLab.lab_code}
                  </span>
                  <span className="text-xs font-medium text-[#6E675F]">
                    {selectedLab.department_name}
                  </span>
                  {selectedCourse && (
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#FAF6F0] border border-[#D8CBB9] text-[#A66A43]">
                      Course: {selectedCourse.code}
                    </span>
                  )}
                  {selectedYear && (
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#E7DDD0] text-[#49372E]">
                      {formatAcademicYearLabel(selectedYear)}
                    </span>
                  )}
                </div>
                <h1 className="font-heading font-bold text-2xl text-[#252521]">{selectedLab.name}</h1>
                {selectedLab.description && (
                  <p className="text-xs text-[#49372E]/85 leading-relaxed">
                    {selectedLab.description}
                  </p>
                )}
              </div>

              <div className="bg-[#FAF6F0] border border-[#E7DDD0] rounded-xl p-3.5 text-xs space-y-1.5 min-w-[230px]">
                <div className="flex items-center gap-1.5 text-[#49372E]">
                  <MapPin className="w-3.5 h-3.5 text-[#A66A43]" />
                  <span>
                    {selectedLab.building}, {selectedLab.room_number}
                  </span>
                </div>
                {selectedLab.assigned_assistant_name && (
                  <div className="flex items-center gap-1.5 text-[#49372E]">
                    <UserCheck className="w-3.5 h-3.5 text-[#2E6F4E]" />
                    <span>In-charge: {selectedLab.assigned_assistant_name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2 OF 7: DEDICATED COURSE SELECTION SCREEN */}
            {!selectedCourse ? (
              /* STEP 2 OF 7: DEDICATED COURSE SELECTION SCREEN */
              <div className="max-w-5xl mx-auto space-y-6 py-2">
                <div className="text-center space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#A66A43]">
                    <GraduationCap className="w-4 h-4" />
                    <span>Step 2 of 7 • Course Selection</span>
                  </div>
                  <h2 className="font-heading font-bold text-xl sm:text-2xl text-[#252521]">
                    Select Your Course in {selectedLab.name}
                  </h2>
                  <p className="text-xs text-[#6E675F]">
                    Only available engineering courses explicitly mapped to {selectedLab.name} are shown below.
                  </p>
                </div>

                {labCoursesAvailable.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#E7DDD0] p-12 text-center space-y-2 max-w-xl mx-auto">
                    <GraduationCap className="w-10 h-10 text-[#A66A43]/60 mx-auto" />
                    <h3 className="font-heading font-bold text-base text-[#252521]">
                      No Courses Configured for {selectedLab.name}
                    </h3>
                    <p className="text-xs text-[#6E675F]">
                      College Administration has not mapped any active courses to this laboratory yet.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {labCoursesAvailable.map((course) => {
                      const matchingSubjs = getSubjectsForLabAndCourse(
                        selectedLab.id,
                        course.id,
                        publicSubjects,
                        publicExperiments,
                        experimentCourses
                      );
                      return (
                        <div
                          key={course.id}
                          className="bg-white rounded-2xl border border-[#E7DDD0] hover:border-[#A66A43] p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#49372E] text-white">
                                {course.code}
                              </span>
                              <span className="text-[11px] font-mono text-[#6E675F]">
                                {course.degree}
                              </span>
                            </div>
                            <h3 className="font-heading font-bold text-base text-[#252521]">
                              {course.name}
                            </h3>
                            {course.description && (
                              <p className="text-xs text-[#6E675F] leading-relaxed line-clamp-2">
                                {course.description}
                              </p>
                            )}
                          </div>

                          <div className="space-y-3 pt-2 border-t border-[#F5F0E8]">
                            <div className="text-[11px] font-mono text-[#49372E]">
                              {formatCountLabel(matchingSubjs.length, 'Practical Subject')}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourseId(course.id);
                                setSelectedYear(null);
                                setSelectedSubjectId(null);
                                setSubjectViewStage('syllabus');
                                setSubjectSearch('');
                                setExpSearch('');
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-[#A66A43] hover:bg-[#8E5734] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                              <span>Select Course</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : !selectedYear ? (
              /* STEP 3 OF 7: DEDICATED ACADEMIC YEAR SELECTION SCREEN */
              <div className="max-w-5xl mx-auto space-y-6 py-2">
                <div className="text-center space-y-1.5 max-w-2xl mx-auto">
                  <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#A66A43]">
                    <Calendar className="w-4 h-4" />
                    <span>Step 3 of 7 • Academic Year Selection</span>
                  </div>
                  <h2 className="font-heading font-bold text-xl sm:text-2xl text-[#252521]">
                    Select Academic Year for {selectedCourse.code}
                  </h2>
                  <p className="text-xs text-[#6E675F]">
                    Choose your year of study in {selectedLab.name}. Each card summarizes configured practical subjects, experiments, and available manuals.
                  </p>
                </div>

                {authLoading ? (
                  <div className="bg-white rounded-2xl border border-[#E7DDD0] p-12 text-center space-y-2 max-w-xl mx-auto">
                    <Calendar className="w-10 h-10 text-[#A66A43]/60 mx-auto" />
                    <h3 className="font-heading font-bold text-base text-[#252521]">
                      Loading Academic Year Catalog...
                    </h3>
                    <p className="text-xs text-[#6E675F]">
                      Computing year-wise practical subjects and available manuals.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
                    {yearStatsForCourse.map((yr) => {
                      const hasContent = yr.subjectCount > 0;
                      return (
                        <button
                          key={yr.year}
                          type="button"
                          onClick={() => {
                            setSelectedYear(yr.year);
                            setSelectedSubjectId(null);
                            setSubjectViewStage('syllabus');
                            setSubjectSearch('');
                            setExpSearch('');
                          }}
                          className={`text-left rounded-2xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all cursor-pointer ${
                            hasContent
                              ? 'bg-white border-[#E7DDD0] hover:border-[#A66A43] hover:shadow-md'
                              : 'bg-[#FAF6F0]/80 border-[#E7DDD0] hover:border-[#D8CBB9]'
                          }`}
                        >
                          <div className="space-y-2.5 w-full">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-[#49372E] text-white">
                                Year {yr.year}
                              </span>
                              {!isSupabaseActive && hasContent ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-semibold">
                                  DEMO CONTENT
                                </span>
                              ) : !hasContent ? (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F5F0E8] border border-[#E7DDD0] text-[#6E675F]">
                                  Not Configured
                                </span>
                              ) : null}
                            </div>

                            <div>
                              <h3 className="font-heading font-extrabold text-lg text-[#252521]">
                                {yr.label}
                              </h3>
                              <p className="text-xs font-mono text-[#A66A43] mt-0.5">
                                {yr.semesterLabel}
                              </p>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-[#F5F0E8] text-xs">
                              <div className="flex items-center justify-between text-[#49372E]">
                                <span className="text-[#6E675F]">Practical Subjects</span>
                                <span className="font-mono font-bold tabular-nums">{yr.subjectCount}</span>
                              </div>
                              <div className="flex items-center justify-between text-[#49372E]">
                                <span className="text-[#6E675F]">Experiments</span>
                                <span className="font-mono font-bold tabular-nums">{yr.experimentCount}</span>
                              </div>
                              <div className="flex items-center justify-between text-[#49372E]">
                                <span className="text-[#6E675F]">Available Manuals</span>
                                <span className="font-mono font-bold text-[#2E6F4E] tabular-nums">
                                  {yr.manualCount}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="w-full py-2 px-3 rounded-xl bg-[#FAF6F0] border border-[#D8CBB9] text-[#49372E] text-xs font-bold flex items-center justify-center gap-1.5">
                            <span>Explore {yr.label}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-[#A66A43]" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : !activeSubject ? (
              /* STEP 4 OF 7: DEDICATED PRACTICAL SUBJECT SELECTION SCREEN */
              <div className="max-w-5xl mx-auto space-y-6 py-2">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#A66A43]">
                      <BookOpen className="w-4 h-4" />
                      <span>Step 4 of 7 • Practical Subject Selection</span>
                    </div>
                    <h2 className="font-heading font-bold text-xl sm:text-2xl text-[#252521]">
                      {formatAcademicYearLabel(selectedYear)} Subjects — {selectedCourse.code}
                    </h2>
                    <p className="text-xs text-[#6E675F]">
                      Showing published practical subjects in {selectedLab.name} for {formatAcademicYearLabel(selectedYear)} ({selectedCourse.name}).
                    </p>
                  </div>

                  <div className="relative min-w-[240px] w-full sm:w-auto">
                    <Search className="w-3.5 h-3.5 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      placeholder="Search practical subjects..."
                      className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#D8CBB9] rounded-xl focus:outline-none focus:border-[#A66A43]"
                    />
                  </div>
                </div>

                {authLoading ? (
                  <div className="bg-white rounded-2xl border border-[#E7DDD0] p-12 text-center space-y-2">
                    <BookOpen className="w-10 h-10 text-[#A66A43]/60 mx-auto" />
                    <h3 className="font-heading font-bold text-base text-[#252521]">
                      Loading Practical Subjects...
                    </h3>
                  </div>
                ) : filteredSubjectsForCourse.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-[#E7DDD0] p-12 text-center space-y-3">
                    <BookOpen className="w-10 h-10 text-[#A66A43]/60 mx-auto" />
                    <h3 className="font-heading font-bold text-base text-[#252521]">
                      {subjectSearch
                        ? `No Subjects Match "${subjectSearch}"`
                        : `Resources Not Yet Configured for ${formatAcademicYearLabel(selectedYear)}`}
                    </h3>
                    <p className="text-xs text-[#6E675F] max-w-md mx-auto">
                      {subjectSearch
                        ? 'Clear your search query or select a different academic year.'
                        : `No active practical subjects are configured yet in ${selectedLab.name} for ${selectedCourse.code} (${formatAcademicYearLabel(selectedYear)}).`}
                    </p>
                    <div className="pt-2 flex flex-wrap justify-center gap-2">
                      {subjectSearch ? (
                        <button
                          type="button"
                          onClick={() => setSubjectSearch('')}
                          className="px-4 py-2 rounded-xl bg-[#49372E] text-white text-xs font-semibold cursor-pointer"
                        >
                          Clear Search
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedYear(null)}
                          className="px-4 py-2 rounded-xl bg-[#49372E] text-white text-xs font-semibold cursor-pointer"
                        >
                          Choose Another Academic Year
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {filteredSubjectsForCourse.map((subj) => {
                      const matchingExps = getExperimentsForLabCourseSubject(
                        effectiveCourseFilterId,
                        subj.id,
                        publicExperiments,
                        experimentCourses
                      );
                      const subjYear = getYearFromSemester(subj.semester, selectedCourse.semesters_per_year ?? 2);
                      return (
                        <div
                          key={subj.id}
                          className="bg-white rounded-2xl border border-[#E7DDD0] hover:border-[#A66A43] p-5 shadow-xs flex flex-col justify-between space-y-4 transition-all"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-[#E7DDD0] text-[#49372E]">
                                  {subj.code}
                                </span>
                                {(subj.is_demo || !isSupabaseActive) && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-semibold">
                                    DEMO
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[11px] text-[#6E675F]">
                                {formatAcademicYearLabel(subjYear)} · Sem {subj.semester} · {subj.credits} Credits
                              </span>
                            </div>
                            <h3 className="font-heading font-bold text-base text-[#252521]">
                              {subj.name}
                            </h3>
                            <p className="text-xs text-[#6E675F] leading-relaxed line-clamp-2">
                              {subj.description}
                            </p>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-[#F5F0E8]">
                            <div className="flex items-center justify-between text-[11px] font-mono text-[#49372E]">
                              <span>{formatCountLabel(subj.syllabus.length, 'Syllabus Unit')}</span>
                              <span className="font-bold text-[#A66A43]">
                                {formatCountLabel(matchingExps.length, 'Mapped Experiment')}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSubjectId(subj.id);
                                setSubjectViewStage('syllabus');
                                setExpSearch('');
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                            >
                              <span>View Syllabus &amp; Experiments</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : subjectViewStage === 'syllabus' ? (
              /* STEP 5 OF 7: DEDICATED SYLLABUS VIEW SCREEN */
              <div className="max-w-5xl mx-auto space-y-6 py-2">
                <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#F5F0E8] pb-4">
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A66A43]">
                        Step 5 of 7 • Subject Syllabus
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#E7DDD0] text-[#49372E]">
                          {activeSubject.code}
                        </span>
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#D8CBB9] text-[#A66A43]">
                          {selectedCourse.code}
                        </span>
                        <span className="text-xs text-[#6E675F]">
                          {formatAcademicYearLabel(selectedYear)} · Sem {activeSubject.semester} · {activeSubject.credits} Credits
                        </span>
                        {(activeSubject.is_demo || !isSupabaseActive) && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-semibold">
                            DEMO SYLLABUS — SAMPLE CONTENT
                          </span>
                        )}
                      </div>
                      <h2 className="font-heading font-bold text-xl sm:text-2xl text-[#252521]">
                        {activeSubject.name}
                      </h2>
                      <p className="text-xs text-[#49372E]/90 leading-relaxed max-w-3xl">
                        {activeSubject.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePreviewSyllabusPdf(activeSubject)}
                        className="px-3 py-2 rounded-lg bg-[#FAF6F0] border border-[#D8CBB9] hover:border-[#A66A43] text-[#49372E] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#A66A43]" />
                        <span>Preview Syllabus PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSyllabusPdf(activeSubject)}
                        className="px-3 py-2 rounded-lg bg-[#49372E] hover:bg-[#382922] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download Syllabus PDF</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-heading font-semibold text-sm text-[#252521] flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#A66A43]" />
                      <span>Practical Syllabus Units ({activeSubject.syllabus.length})</span>
                    </h3>
                    {activeSubject.syllabus.length === 0 ? (
                      <p className="text-xs text-[#6E675F]">No unit breakdown entered yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeSubject.syllabus.map((unit) => (
                          <div
                            key={unit.id}
                            className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#49372E] text-white">
                                Unit {unit.unit_number}
                              </span>
                              <h4 className="font-semibold text-xs text-[#252521]">
                                {unit.title}
                              </h4>
                            </div>
                            <p className="text-xs text-[#49372E]/85">{unit.description}</p>
                            {unit.learning_outcomes.length > 0 && (
                              <ul className="space-y-1 pt-1">
                                {unit.learning_outcomes.map((out, i) => (
                                  <li
                                    key={i}
                                    className="text-xs text-[#49372E] flex items-start gap-1.5"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2E6F4E] shrink-0 mt-0.5" />
                                    <span>{out}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#F5F0E8] flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubjectId(null);
                        setExpSearch('');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#D8CBB9] hover:bg-[#E7DDD0] text-[#49372E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Subjects</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubjectViewStage('experiments')}
                      className="px-6 py-2.5 rounded-xl bg-[#A66A43] hover:bg-[#8E5734] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                    >
                      <span>
                        Proceed to Experiments ({allSubjectExperiments.length})
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* STEP 6 OF 7: DEDICATED EXPERIMENT LIST SCREEN */
              <div className="max-w-5xl mx-auto space-y-6 py-2">
                <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F5F0E8] pb-4">
                    <div>
                      <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A66A43]">
                        Step 6 of 7 • Experiment Selection
                      </div>
                      <h2 className="font-heading font-bold text-xl text-[#252521] flex flex-wrap items-center gap-2 mt-1">
                        <FlaskConical className="w-5 h-5 text-[#A66A43]" />
                        <span>
                          {activeSubject.code} Experiments for {selectedCourse.code} ({formatAcademicYearLabel(selectedYear)})
                        </span>
                      </h2>
                      <p className="text-xs text-[#6E675F] mt-0.5">
                        {activeSubject.name} • Showing {subjectExperiments.length} mapped experiment{subjectExperiments.length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                        <Search className="w-3.5 h-3.5 text-[#6E675F] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={expSearch}
                          onChange={(e) => setExpSearch(e.target.value)}
                          placeholder="Search experiments in this subject..."
                          className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF6F0] border border-[#D8CBB9] rounded-xl focus:outline-none focus:border-[#A66A43]"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSubjectViewStage('syllabus')}
                        className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#D8CBB9] hover:border-[#A66A43] text-[#49372E] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[#A66A43]" />
                        <span>View Syllabus</span>
                      </button>
                    </div>
                  </div>

                  {subjectExperiments.length === 0 ? (
                    <div className="py-10 text-center space-y-2 border border-dashed border-[#E7DDD0] rounded-xl bg-[#FAF6F0]/50">
                      <FlaskConical className="w-8 h-8 text-[#A66A43]/60 mx-auto" />
                      <p className="text-xs font-semibold text-[#252521]">
                        No published experiments mapped to {selectedCourse.code} under {activeSubject.code}
                      </p>
                      <p className="text-[11px] text-[#6E675F]">
                        {expSearch
                          ? 'Try clearing your experiment search filter.'
                          : 'Unmapped experiments are hidden from course-specific views until mapped by the Lab Assistant.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F5F0E8] border border-[#E7DDD0] rounded-xl overflow-hidden">
                      {subjectExperiments.map((exp) => {
                        const ytInfo = classifyYouTubeResource(exp);
                        const simInfo = resolveExperimentSimulation(exp);
                        const hasVideo = isExperimentVideoAvailable(exp);
                        const hasSim = isExperimentSimulationAvailable(exp);
                        const linkedDoc = documents.find(
                          (d) => (d.experiment_id === exp.id || d.id === exp.manual_pdf_id) && d.is_published
                        );
                        const hasManual = Boolean(exp.manual_pdf_url || exp.manual_pdf_id || linkedDoc);
                        const isDemoExpManual = linkedDoc
                          ? Boolean(linkedDoc.is_demo)
                          : Boolean(exp.is_demo || !isSupabaseActive);

                        return (
                          <div
                            key={exp.id}
                            className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF6F0]/60 transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <span className="w-8 h-8 rounded-lg bg-[#E7DDD0] text-[#49372E] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                                #{exp.exp_number}
                              </span>
                              <div className="min-w-0">
                                <h4 className="font-heading font-bold text-sm text-[#252521]">
                                  {exp.title}
                                </h4>
                                <p className="text-xs text-[#6E675F] line-clamp-2 mt-0.5">
                                  {exp.aim}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] font-mono text-[#6E675F]">
                                  {hasManual && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded border ${
                                        isDemoExpManual
                                          ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                                          : 'bg-[#FAF6F0] text-[#49372E] border-[#E7DDD0]'
                                      }`}
                                    >
                                      {isDemoExpManual ? 'Demo Manual PDF' : 'Uploaded Manual PDF'}
                                    </span>
                                  )}
                                  {hasVideo ? (
                                    <span className="px-1.5 py-0.5 rounded bg-[#FAF6F0] border border-[#E7DDD0] text-[#49372E]">
                                      {ytInfo.mode === 'direct_video' ? 'Video Demo' : 'Video Search'}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-[#F5F0E8] border border-[#E7DDD0] text-[#6E675F]">
                                      Video Unavailable
                                    </span>
                                  )}
                                  {hasSim ? (
                                    <span className="px-1.5 py-0.5 rounded bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0]">
                                      {simInfo.hasBuiltin
                                        ? simInfo.hasExternal
                                          ? `Built-in + ${simInfo.providerLabel}`
                                          : 'Built-in Simulator'
                                        : simInfo.providerLabel}
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-[#F5F0E8] border border-[#E7DDD0] text-[#6E675F]">
                                      Sim Unavailable
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedExperimentId(exp.id)}
                              className="px-4 py-2 rounded-xl bg-[#A66A43] hover:bg-[#8E5734] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              <span>Open Experiment</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ==================== ABOUT LABVERSE ==================== */}
        {activePage === 'about' && (
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-8 shadow-sm space-y-4">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A66A43]">
                About LABVERSE
              </span>
              <h1 className="font-heading font-bold text-3xl text-[#252521]">
                Structured Digital &amp; Practical Laboratory Learning
              </h1>
              <p className="text-sm text-[#49372E]/90 leading-relaxed">
                LABVERSE provides a guided practical-learning journey: choose a laboratory, course, academic year, and subject, then explore experiment manuals, demonstrations, and virtual simulations. Learners follow a clean guided flow—starting from Laboratory selection, choosing their engineering course, inspecting subject syllabi, and launching experiment manuals, videos, and Bench Twin simulations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-2">
                <ShieldCheck className="w-6 h-6 text-[#A66A43]" />
                <h2 className="font-heading font-bold text-lg text-[#252521]">
                  Open Public Learning Portal
                </h2>
                <p className="text-xs text-[#49372E]/85 leading-relaxed">
                  Visitors browse active laboratories, filter by course stream, preview syllabi and manuals, watch YouTube demonstrations, and run interactive simulations immediately—with zero login required.
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 space-y-2">
                <FlaskConical className="w-6 h-6 text-[#49372E]" />
                <h2 className="font-heading font-bold text-lg text-[#252521]">
                  Campus Laboratory Governance
                </h2>
                <p className="text-xs text-[#49372E]/85 leading-relaxed">
                  College Administration manages laboratories, course mappings, and Lab Assistant assignments, while assigned assistants maintain manuals, equipment stock, PC Lab workstations, and QR tags.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ==================== CONTACT ==================== */}
        {activePage === 'contact' && (
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-8 shadow-sm space-y-6">
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A66A43]">
                  Campus Contact &amp; Laboratory Support
                </span>
                <h1 className="font-heading font-bold text-3xl text-[#252521] mt-1">
                  Laboratory Learning Support
                </h1>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-1.5">
                  <MapPin className="w-5 h-5 text-[#A66A43]" />
                  <div className="font-heading font-bold text-sm text-[#252521]">Campus Location</div>
                  <p className="text-[#49372E]/85 leading-relaxed">{institution.address}</p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-1.5">
                  <Mail className="w-5 h-5 text-[#A66A43]" />
                  <div className="font-heading font-bold text-sm text-[#252521]">Institutional Email</div>
                  <p className="font-mono text-[#49372E]">
                    {institution.contact_email || 'principal@mvit.edu.in'}
                  </p>
                  <p className="text-[#6E675F]">Office of the Principal &amp; Lab Governance</p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-1.5">
                  <Phone className="w-5 h-5 text-[#A66A43]" />
                  <div className="font-heading font-bold text-sm text-[#252521]">Portal Administration</div>
                  <p className="text-[#49372E]/85">
                    College Admins and Lab Assistants can sign in through Admin Login to manage labs, PC workstations, manuals, and QR labels.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {renderFooter()}
      {renderModals()}
    </div>
  );
};
