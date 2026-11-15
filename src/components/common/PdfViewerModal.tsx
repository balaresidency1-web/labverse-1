import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FileText,
  Calendar,
  User,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Lock,
  Loader2,
} from 'lucide-react';
import { useLabverse } from '../../context/LabverseContext';
import {
  resolvePdfSource,
  downloadResolvedPdf,
  ResolvedPdfResult,
} from '../../utils/pdfSource';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  pdfUrl: string;
  storagePath?: string;
  docId?: string;
  fileName: string;
  fileSize?: number;
  uploadedBy?: string;
  uploadedAt?: string;
  subjectCode?: string;
  isDemo?: boolean;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  pdfUrl,
  storagePath,
  docId,
  fileName,
  fileSize,
  uploadedBy,
  uploadedAt,
  subjectCode,
  isDemo = false,
}) => {
  const { isSupabaseActive } = useLabverse();
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<ResolvedPdfResult | null>(null);

  const activeBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      if (activeBlobUrlRef.current) {
        try {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        } catch {
          // ignore
        }
        activeBlobUrlRef.current = null;
      }
      setResolved(null);
      setDownloadError(null);
      return;
    }

    let cancelled = false;

    const cleanupPreviousBlob = () => {
      if (activeBlobUrlRef.current) {
        try {
          URL.revokeObjectURL(activeBlobUrlRef.current);
        } catch {
          // ignore
        }
        activeBlobUrlRef.current = null;
      }
    };

    const load = async () => {
      cleanupPreviousBlob();
      setIsLoading(true);
      setDownloadError(null);
      setResolved(null);

      const next = await resolvePdfSource({
        pdfUrl,
        storagePath,
        docId,
        isSupabaseActive,
      });

      if (cancelled) {
        if (next.revokeRequired && next.objectUrl) {
          try {
            URL.revokeObjectURL(next.objectUrl);
          } catch {
            // ignore
          }
        }
        return;
      }

      if (next.revokeRequired && next.objectUrl) {
        activeBlobUrlRef.current = next.objectUrl;
      }
      setResolved(next);
      setIsLoading(false);
    };

    load();

    return () => {
      cancelled = true;
      cleanupPreviousBlob();
    };
  }, [isOpen, pdfUrl, storagePath, docId, isSupabaseActive, retryToken]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 75));
  const handleResetZoom = () => setZoom(100);

  const handleDownload = async () => {
    setDownloadError(null);
    const res = await downloadResolvedPdf({
      pdfUrl,
      storagePath,
      docId,
      fileName,
      isSupabaseActive,
      resolvedObjectUrl: resolved?.status === 'ready' ? resolved.objectUrl : null,
    });
    if (!res.success && res.error) {
      setDownloadError(res.error);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Sample PDF';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const openInNewTabUrl =
    (resolved?.status === 'ready' ? resolved.objectUrl : null) ||
    resolved?.externalUrl ||
    (/^https?:\/\//i.test(pdfUrl) ? pdfUrl : null);
  const isExternalSource = Boolean(
    !storagePath &&
    /^https?:\/\//i.test(pdfUrl) &&
    !/\/storage\/v1\/object\//i.test(pdfUrl)
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#252521]/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-[#D8CBB9] flex flex-col transition-all duration-200 overflow-hidden ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[90vh]'
        }`}
      >
        {/* Top Control Bar */}
        <div className="bg-[#49372E] text-white px-5 py-3.5 flex items-center justify-between gap-4 border-b border-[#382922]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#A66A43] flex items-center justify-center text-white shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-semibold text-sm truncate text-white">
                  {title}
                </span>
                {subjectCode && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/15 text-[#FAF6F0]">
                    {subjectCode}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#E7DDD0] font-mono flex items-center gap-2 truncate">
                <span>{fileName}</span>
                <span>•</span>
                <span>{formatSize(fileSize)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden sm:flex items-center bg-white/10 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom Out"
                className="p-1.5 hover:bg-white/15 rounded text-[#FAF6F0] transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title="Reset Zoom"
                className="px-2 py-0.5 text-[11px] font-mono text-white hover:bg-white/15 rounded transition-colors cursor-pointer"
              >
                {zoom}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom In"
                className="p-1.5 hover:bg-white/15 rounded text-[#FAF6F0] transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            {openInNewTabUrl && (
              <a
                href={openInNewTabUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
                title="Open PDF in a new browser tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Open PDF in New Tab</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 bg-[#2E6F4E] hover:bg-[#23583D] text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
              title="Download original PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Download PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-[#E7DDD0] hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#E7DDD0] hover:text-white hover:bg-[#B91C1C] rounded-lg transition-colors ml-1 cursor-pointer"
              title="Close PDF Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-Header Metadata Banner */}
        <div className="bg-[#FAF6F0] border-b border-[#E7DDD0] px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6E675F]">
          <div className="flex items-center gap-4">
            {uploadedBy && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3 text-[#A66A43]" />
                Uploaded by: <strong className="text-[#252521]">{uploadedBy}</strong>
              </span>
            )}
            {uploadedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#6E675F]" />
                Date: {new Date(uploadedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {isDemo ? (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>DEMO – ILLUSTRATIVE CONTENT – NOT AN OFFICIAL COLLEGE DOCUMENT</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[#2E6F4E] font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{isExternalSource ? 'External reference PDF • hosted by source institution' : 'Uploaded LABVERSE laboratory document'}</span>
            </div>
          )}
        </div>

        {downloadError && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{downloadError}</span>
          </div>
        )}

        {/* Embedded PDF View Canvas */}
        <div className="flex-1 bg-[#49372E]/15 p-2 sm:p-4 overflow-auto flex items-center justify-center">
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-10 text-center space-y-3 max-w-md shadow-lg">
              <Loader2 className="w-8 h-8 text-[#A66A43] animate-spin mx-auto" />
              <div className="font-heading font-bold text-sm text-[#252521]">
                Preparing PDF Preview...
              </div>
              <p className="text-xs text-[#6E675F]">
                Validating document bytes and creating a secure browser Blob preview for Chrome &amp; Edge.
              </p>
            </div>
          ) : resolved?.status === 'ready' && resolved.objectUrl ? (
            <div
              style={{ width: `${zoom}%`, maxWidth: '100%', height: '100%' }}
              className="transition-all duration-150 shadow-2xl rounded-lg overflow-hidden bg-white"
            >
              <iframe
                src={`${resolved.objectUrl}#toolbar=1&navpanes=0`}
                title={title}
                className="w-full h-full min-h-[500px] border-0"
              />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E7DDD0] p-8 text-center space-y-4 max-w-lg shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] flex items-center justify-center mx-auto">
                {resolved?.status === 'access_denied' ? (
                  <Lock className="w-6 h-6 text-[#B91C1C]" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>

              <div className="space-y-1.5">
                <h3 className="font-heading font-bold text-base text-[#252521]">
                  {resolved?.status === 'access_denied'
                    ? 'PDF Access Denied'
                    : resolved?.status === 'missing'
                      ? 'PDF File Missing or Unavailable'
                      : resolved?.status === 'cors_blocked'
                        ? 'External PDF Cannot Be Embedded Inline'
                        : 'Unable to Load Inline PDF Preview'}
                </h3>
                <p className="text-xs text-[#5C534A] leading-relaxed">
                  {resolved?.errorMessage ||
                    'The requested PDF document could not be loaded for inline preview.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setRetryToken((prev) => prev + 1)}
                  className="px-4 py-2 rounded-xl bg-[#FAF6F0] border border-[#D8CBB9] hover:border-[#A66A43] text-[#49372E] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Preview</span>
                </button>

                {openInNewTabUrl && (
                  <a
                    href={openInNewTabUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-[#49372E] hover:bg-[#382922] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open PDF in New Tab</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-xl bg-[#2E6F4E] hover:bg-[#23583D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
