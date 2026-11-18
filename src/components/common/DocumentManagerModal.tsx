import React, { useState, useEffect } from 'react';
import { useLabverse } from '../../context/LabverseContext';
import { LabManualDocument } from '../../types';
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  X,
  FileCheck,
  Database,
  HardDrive,
} from 'lucide-react';
import { validatePdfFile } from '../../utils/pdfGenerator';
import { storePdfBlob, deletePdfBlob } from '../../utils/indexedDbStorage';
import {
  makeIdbUrl,
  isIdbPdfUrl,
  extractIdbKey,
  downloadResolvedPdf,
} from '../../utils/pdfSource';

interface DocumentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreviewPdf: (doc: LabManualDocument) => void;
  preSelectedSubjectId?: string;
  preSelectedExperimentId?: string;
  preSelectedType?: 'syllabus' | 'experiment_manual';
}

export const DocumentManagerModal: React.FC<DocumentManagerModalProps> = ({
  isOpen,
  onClose,
  onPreviewPdf,
  preSelectedSubjectId,
  preSelectedExperimentId,
  preSelectedType,
}) => {
  const {
    labSubjects,
    labExperiments,
    documents,
    selectedLabId,
    selectedLab,
    addOrUpdateDocument,
    deleteDocument,
    currentUser,
    institution,
    isSupabaseActive,
  } = useLabverse();

  const [docType, setDocType] = useState<'syllabus' | 'experiment_manual'>(
    preSelectedType || 'experiment_manual'
  );
  const [docTitle, setDocTitle] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [subjectId, setSubjectId] = useState(preSelectedSubjectId || labSubjects[0]?.id || '');
  const [experimentId, setExperimentId] = useState(
    preSelectedExperimentId || labExperiments[0]?.id || ''
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error';
    message: string;
    targetStorage?: string;
  } | null>(null);

  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);

  useEffect(() => {
    if (preSelectedType) setDocType(preSelectedType);
  }, [preSelectedType, isOpen]);

  useEffect(() => {
    const validSubj = labSubjects.some((s) => s.id === subjectId);
    const nextSubj = preSelectedSubjectId || (validSubj ? subjectId : labSubjects[0]?.id || '');
    if (nextSubj !== subjectId) {
      setSubjectId(nextSubj);
    }
  }, [preSelectedSubjectId, labSubjects]);

  useEffect(() => {
    const matchingExps = labExperiments.filter((e) => e.subject_id === subjectId);
    const validExp = matchingExps.some((e) => e.id === experimentId);
    if (preSelectedExperimentId && matchingExps.some((e) => e.id === preSelectedExperimentId)) {
      if (experimentId !== preSelectedExperimentId) setExperimentId(preSelectedExperimentId);
    } else if (!validExp) {
      setExperimentId(matchingExps[0]?.id || '');
    }
  }, [subjectId, preSelectedExperimentId, labExperiments]);

  if (!isOpen) return null;

  const visibleDocuments = selectedLabId
    ? documents.filter((d) => !d.lab_id || d.lab_id === selectedLabId)
    : documents;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files || e.target.files.length === 0) {
      setSelectedFile(null);
      return;
    }

    const file = e.target.files[0];
    const validation = await validatePdfFile(file, 15);
    if (!validation.isValid) {
      setFileError(validation.error || 'Invalid file');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!docTitle) {
      setDocTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setFileError('Please select a PDF document file to upload.');
      return;
    }

    setIsUploading(true);
    setFileError(null);
    setUploadStatus(null);

    try {
      const subj = labSubjects.find((s) => s.id === subjectId);
      const exp = labExperiments.find((e) => e.id === experimentId);
      const persistentIdbKey = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

      let finalUrl = '';
      let persistentStoragePath: string | undefined;
      let storageLocationNotice = '';

      if (!isSupabaseActive) {
        const stored = await storePdfBlob(persistentIdbKey, selectedFile.name, selectedFile);
        try {
          URL.revokeObjectURL(stored.objectUrl);
        } catch {
          // ignore
        }
        finalUrl = makeIdbUrl(persistentIdbKey);
        persistentStoragePath = finalUrl;
        storageLocationNotice =
          'Stored locally in Browser IndexedDB and published to the MVIT Public Learning Portal.';
      } else {
        storageLocationNotice =
          'Uploaded to Supabase Storage (manuals bucket) and published to the MVIT Public Learning Portal.';
      }

      const res = await addOrUpdateDocument(
        {
          institution_id: institution.id,
          lab_id: subj?.lab_id || selectedLabId || undefined,
          subject_id: subjectId || undefined,
          subject_code: subj?.code,
          experiment_id: docType === 'experiment_manual' ? experimentId || undefined : undefined,
          experiment_title: docType === 'experiment_manual' ? exp?.title : undefined,
          type: docType,
          title: docTitle || selectedFile.name,
          description: docDescription,
          file_name: selectedFile.name,
          file_size: selectedFile.size,
          file_url: finalUrl,
          storage_path: persistentStoragePath,
          is_published: true,
          uploaded_by_id: currentUser?.id || 'staff-mvit',
          uploaded_by_name: currentUser?.name || 'MVIT Lab Assistant',
        },
        isSupabaseActive ? selectedFile : undefined
      );

      if (!res.success) {
        throw new Error(res.error || 'Failed to save PDF manual document.');
      }

      setUploadStatus({
        type: 'success',
        message: 'PDF document uploaded and linked successfully!',
        targetStorage: storageLocationNotice,
      });
      setSelectedFile(null);
      setDocTitle('');
      setDocDescription('');
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (err: any) {
      setFileError(err.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirmDelete = async (id: string) => {
    const existingDoc = documents.find((d) => d.id === id);
    const res = await deleteDocument(id);
    if (!res.success) {
      setUploadStatus({
        type: 'error',
        message: res.error || 'Failed to delete document.',
      });
      setDeletingDocId(null);
      return;
    }
    setDeletingDocId(null);
    const idbKeyToRemove =
      extractIdbKey(existingDoc?.storage_path) || extractIdbKey(existingDoc?.file_url) || id;
    try {
      await deletePdfBlob(idbKeyToRemove);
    } catch {
      // ignore if absent in IndexedDB
    }
    setUploadStatus({
      type: 'success',
      message: 'Document removed successfully.',
    });
    setTimeout(() => setUploadStatus(null), 4000);
  };

  const handleReplaceDocument = async (doc: LabManualDocument) => {
    if (!replacementFile) return;

    const validation = await validatePdfFile(replacementFile, 15);
    if (!validation.isValid) {
      setUploadStatus({
        type: 'error',
        message: validation.error || 'Invalid PDF replacement file.',
      });
      return;
    }

    try {
      let finalUrl = doc.file_url;
      let persistentStoragePath = doc.storage_path;
      if (!isSupabaseActive) {
        const replacementKey =
          extractIdbKey(doc.storage_path) || extractIdbKey(doc.file_url) || doc.id;
        const stored = await storePdfBlob(replacementKey, replacementFile.name, replacementFile);
        try {
          URL.revokeObjectURL(stored.objectUrl);
        } catch {
          // ignore
        }
        finalUrl = makeIdbUrl(replacementKey);
        persistentStoragePath = finalUrl;
      }

      const res = await addOrUpdateDocument(
        {
          institution_id: doc.institution_id || institution.id,
          lab_id: doc.lab_id || selectedLabId || undefined,
          subject_id: doc.subject_id,
          subject_code: doc.subject_code,
          experiment_id: doc.experiment_id,
          experiment_title: doc.experiment_title,
          type: doc.type,
          title: doc.title,
          description: doc.description,
          file_name: replacementFile.name,
          file_size: replacementFile.size,
          file_url: finalUrl,
          storage_path: persistentStoragePath,
          is_published: doc.is_published,
          uploaded_by_id: currentUser?.id || doc.uploaded_by_id,
          uploaded_by_name: currentUser?.name || doc.uploaded_by_name,
        },
        isSupabaseActive ? replacementFile : undefined,
        doc.id
      );

      if (!res.success) {
        throw new Error(res.error || 'Replacement failed');
      }

      setReplacingDocId(null);
      setReplacementFile(null);
      setUploadStatus({
        type: 'success',
        message: `Replaced PDF for "${doc.title}" with ${replacementFile.name}.`,
      });
      setTimeout(() => setUploadStatus(null), 4000);
    } catch (err: any) {
      setUploadStatus({
        type: 'error',
        message: err.message || 'Replacement failed',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#252521]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-[#E7DDD0] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#49372E] text-white flex items-center justify-between border-b border-[#382922]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#A66A43] flex items-center justify-center text-white">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading font-bold text-base text-white">
                  MVIT Laboratory Manual & Syllabus PDF Manager
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/15 text-[#FAF6F0]">
                  {isSupabaseActive ? 'Supabase Storage Active' : 'IndexedDB Local Engine'}
                </span>
              </div>
              <p className="text-xs text-[#E7DDD0]">
                {selectedLab
                  ? `Active Lab: ${selectedLab.name} (${selectedLab.lab_code})`
                  : 'Upload, replace, and publish official syllabus and practical manuals.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#E7DDD0] hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {uploadStatus && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                uploadStatus.type === 'success'
                  ? 'bg-[#EBF5EE] border border-[#C6E3D0] text-[#2E6F4E]'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{uploadStatus.message}</p>
                {uploadStatus.targetStorage && (
                  <p className="text-[11px] mt-0.5 font-mono opacity-90">
                    Storage: {uploadStatus.targetStorage}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* UPLOAD FORM */}
          <div className="bg-[#FAF6F0] border border-[#E7DDD0] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-sm text-[#252521] flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#A66A43]" />
                Upload New PDF Document
              </h3>
              <span className="text-[11px] text-[#6E675F]">
                Backend:{' '}
                <strong className="text-[#252521]">
                  {isSupabaseActive ? 'Supabase Storage Bucket' : 'Browser IndexedDB'}
                </strong>
              </span>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Document Category *
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                  >
                    <option value="experiment_manual">Experiment Manual PDF</option>
                    <option value="syllabus">Practical Syllabus PDF</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Practical Subject *
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                  >
                    {labSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {docType === 'experiment_manual' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#252521] mb-1">
                      Target Experiment *
                    </label>
                    <select
                      value={experimentId}
                      onChange={(e) => setExperimentId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                    >
                      {labExperiments
                        .filter((e) => e.subject_id === subjectId)
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            Exp #{e.exp_number}: {e.title}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PN Junction Diode Complete Manual"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#252521] mb-1">
                    Description & Learning Scope
                  </label>
                  <input
                    type="text"
                    placeholder="Circuit schematics, formula derivation, and procedure"
                    value={docDescription}
                    onChange={(e) => setDocDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252521] mb-1">
                  Select PDF File (Max 15MB) *
                </label>
                <div className="border-2 border-dashed border-[#D8CBB9] hover:border-[#A66A43] rounded-xl p-4 text-center bg-white transition-colors">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="w-full text-xs text-[#6E675F] file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#FAF6F0] file:text-[#49372E] hover:file:bg-[#EFE7DC] cursor-pointer"
                  />
                  {selectedFile && (
                    <div className="mt-2 text-xs font-mono text-[#2E6F4E] flex items-center justify-center gap-1.5">
                      <FileCheck className="w-4 h-4" />
                      <span>
                        {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  )}
                </div>
                {fileError && (
                  <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{fileError}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="px-4 py-2 bg-[#49372E] hover:bg-[#382922] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? 'Uploading & Processing...' : 'Upload & Publish PDF'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* DOCUMENT LIST */}
          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm text-[#252521] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2E6F4E]" />
              Published Manuals & Syllabi ({visibleDocuments.length})
            </h3>

            {visibleDocuments.length === 0 ? (
              <div className="p-6 text-center bg-[#FAF6F0] border border-[#E7DDD0] rounded-xl text-xs text-[#6E675F]">
                No PDF manuals uploaded yet for this laboratory.
              </div>
            ) : (
              <div className="border border-[#E7DDD0] rounded-xl overflow-hidden divide-y divide-[#F5F0E8]">
                {visibleDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FAF6F0] transition-colors"
                  >
                    <div className="space-y-1 max-w-lg">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FDF4EC] text-[#A66A43] border border-[#E7C2A8] font-semibold">
                          {doc.type === 'syllabus' ? 'Syllabus PDF' : 'Lab Manual'}
                        </span>
                        {doc.subject_code && (
                          <span className="text-xs font-mono font-semibold text-[#252521]">
                            {doc.subject_code}
                          </span>
                        )}
                        <span className="text-[11px] font-mono text-[#6E675F]">
                          • {(doc.file_size / 1024).toFixed(1)} KB
                        </span>

                        {doc.file_url?.startsWith('http') || (doc.storage_path && !isIdbPdfUrl(doc.storage_path)) ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EBF5EE] text-[#2E6F4E] border border-[#C6E3D0] inline-flex items-center gap-1">
                            <Database className="w-2.5 h-2.5" />
                            Cloud Storage
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FAF6F0] text-[#6E675F] border border-[#E7DDD0] inline-flex items-center gap-1">
                            <HardDrive className="w-2.5 h-2.5" />
                            {isIdbPdfUrl(doc.file_url) || isIdbPdfUrl(doc.storage_path) ? 'IndexedDB PDF' : 'Local PDF'}
                          </span>
                        )}
                      </div>

                      <h4 className="font-semibold text-xs text-[#252521]">{doc.title}</h4>
                      {doc.description && (
                        <p className="text-[11px] text-[#6E675F]">{doc.description}</p>
                      )}

                      <div className="text-[10px] text-[#6E675F] font-mono flex items-center gap-2">
                        <span>Uploaded by {doc.uploaded_by_name}</span>
                        <span>•</span>
                        <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onPreviewPdf(doc)}
                        className="px-3 py-1.5 text-xs text-[#49372E] bg-[#FAF6F0] hover:bg-[#EFE7DC] border border-[#D8CBB9] rounded-lg font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#A66A43]" />
                        <span>Preview</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          void downloadResolvedPdf({
                            pdfUrl: doc.file_url,
                            storagePath: doc.storage_path,
                            docId: doc.id,
                            fileName: doc.file_name,
                            isSupabaseActive,
                          });
                        }}
                        className="p-2 text-[#6E675F] hover:text-[#252521] bg-white border border-[#D8CBB9] rounded-lg transition-colors cursor-pointer"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {replacingDocId === doc.id ? (
                        <div className="flex items-center gap-1.5 bg-[#FAF6F0] p-1 rounded-lg border border-[#E7DDD0]">
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            onChange={(e) => setReplacementFile(e.target.files?.[0] || null)}
                            className="text-[10px] w-36"
                          />
                          <button
                            type="button"
                            onClick={() => handleReplaceDocument(doc)}
                            disabled={!replacementFile}
                            className="px-2 py-1 text-[11px] bg-[#49372E] hover:bg-[#382922] disabled:opacity-50 text-white rounded font-medium cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReplacingDocId(null);
                              setReplacementFile(null);
                            }}
                            className="px-1.5 py-1 text-[11px] text-[#6E675F] hover:text-[#252521] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setReplacingDocId(doc.id)}
                          className="p-2 text-[#6E675F] hover:text-[#252521] bg-white border border-[#D8CBB9] rounded-lg transition-colors cursor-pointer"
                          title="Replace PDF revision"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {deletingDocId === doc.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(doc.id)}
                            className="px-2.5 py-1 text-xs bg-[#B91C1C] text-white font-semibold rounded-lg hover:bg-rose-800 cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingDocId(null)}
                            className="px-2 py-1 text-xs border border-[#D8CBB9] rounded-lg text-[#6E675F] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingDocId(doc.id)}
                          className="p-2 text-[#B91C1C] hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                          title="Delete PDF Document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#FAF6F0] border-t border-[#E7DDD0] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs border border-[#D8CBB9] rounded-lg hover:bg-white text-[#252521] font-medium cursor-pointer"
          >
            Close Document Manager
          </button>
        </div>
      </div>
    </div>
  );
};

