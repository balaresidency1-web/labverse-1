import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { InventoryItem, Lab, PublicQrInventoryItem } from '../../types';
import { parseInventoryQrPayload, validateQrScanAccess } from '../../utils/qrCodeService';
import { useLabverse } from '../../context/LabverseContext';
import { labverseRepository } from '../../services/labverseRepository';
import {
  Camera,
  X,
  RefreshCw,
  Search,
  AlertTriangle,
  Upload,
  SwitchCamera,
  ShieldAlert,
} from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  currentLab?: Lab | null;
  onItemDetected: (item: InventoryItem | PublicQrInventoryItem) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  inventory,
  currentLab,
  onItemDetected,
}) => {
  const { currentUser, institution } = useLabverse();
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [accessDeniedError, setAccessDeniedError] = useState<string | null>(null);
  const [unrecognizedCode, setUnrecognizedCode] = useState<string | null>(null);

  const [manualQuery, setManualQuery] = useState('');
  const [isSearchingManually, setIsSearchingManually] = useState(false);
  const [isLookingUpManual, setIsLookingUpManual] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isStoppingRef = useRef(false);

  const searchResults = manualQuery.trim()
    ? inventory.filter(
        (i) =>
          i.item_code.toLowerCase().includes(manualQuery.toLowerCase()) ||
          i.name.toLowerCase().includes(manualQuery.toLowerCase()) ||
          i.location.toLowerCase().includes(manualQuery.toLowerCase())
      )
    : [];

  const stopScanner = async () => {
    if (html5QrCodeRef.current && isScanning && !isStoppingRef.current) {
      isStoppingRef.current = true;
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      } finally {
        isStoppingRef.current = false;
        setIsScanning(false);
      }
    }
  };

  const handleSuccessfulScan = async (decodedText: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(100);
      }
    } catch {
      // ignore vibration errors
    }

    setAccessDeniedError(null);
    setUnrecognizedCode(null);

    const isPcQrPayload =
      decodedText.trim().startsWith('LABVERSE:PC:') ||
      decodedText.includes('"pc_computer"') ||
      decodedText.includes('"computerId"') ||
      decodedText.includes('"computerCode"');
    if (!currentUser && isPcQrPayload) {
      setAccessDeniedError(
        'Internal MVIT PC Laboratory workstation QR codes are restricted to authorized MVIT staff.'
      );
      return;
    }

    const parsed = parseInventoryQrPayload(decodedText);
    const targetCode = (parsed.itemCode || parsed.inventoryId || decodedText).trim();

    let matchedItem: InventoryItem | PublicQrInventoryItem | undefined;

    if (!currentUser) {
      try {
        const queryKey = parsed.inventoryId || parsed.itemCode || targetCode;
        const res = await labverseRepository.lookupPublicInventoryQr(queryKey);
        if (res.data) {
          matchedItem = res.data;
        }
      } catch (err) {
        console.warn('Public inventory QR lookup error:', err);
      }
    } else {
      matchedItem = inventory.find(
        (item) =>
          item.item_code.toUpperCase() === targetCode.toUpperCase() ||
          item.id === targetCode ||
          (parsed.inventoryId && item.id === parsed.inventoryId)
      );

      if (!matchedItem && (parsed.inventoryId || parsed.itemCode || targetCode)) {
        try {
          const queryKey = parsed.inventoryId || parsed.itemCode || targetCode;
          const res = await labverseRepository.getInventoryItemById(queryKey);
          if (res.data) {
            matchedItem = res.data;
          }
        } catch (err) {
          console.warn('Direct inventory item lookup error:', err);
        }
      }
    }

    if (!matchedItem) {
      setUnrecognizedCode(decodedText);
      return;
    }

    const access = validateQrScanAccess(parsed, currentUser, matchedItem, institution.id);
    if (!access.allowed) {
      setAccessDeniedError(
        access.reason ||
          'Access Blocked: Apparatus belongs to another institution or an unassigned MVIT laboratory.'
      );
      return;
    }

    stopScanner().then(() => {
      onItemDetected(matchedItem!);
      onClose();
    });
  };

  const startScanner = async () => {
    setScannerError(null);
    setUnrecognizedCode(null);
    setAccessDeniedError(null);

    const readerElement = document.getElementById('qr-camera-reader');
    if (!readerElement) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-camera-reader');
      }

      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        await html5QrCodeRef.current.start(
          { facingMode },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            handleSuccessfulScan(decodedText);
          },
          () => {
            // frame scan errors are expected while seeking QR code
          }
        );
        setIsScanning(true);
      } else {
        setScannerError(
          'No camera devices detected on this device. Use manual item-code lookup or upload a QR image below.'
        );
        setIsSearchingManually(true);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
        setScannerError(
          'Camera access was denied. Allow camera permissions or look up the MVIT equipment code manually below.'
        );
      } else {
        setScannerError(
          `Camera feed unavailable (${msg}). Use manual equipment lookup or upload a QR image below.`
        );
      }
      setIsSearchingManually(true);
      setIsScanning(false);
    }
  };

  const toggleFacingMode = async () => {
    await stopScanner();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-camera-reader');
      }
      const decodedResult = await html5QrCodeRef.current.scanFile(file, true);
      handleSuccessfulScan(decodedResult);
    } catch {
      setScannerError(
        'Could not decode QR code from the uploaded image. Ensure the QR barcode is sharp and unobstructed.'
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#252521]/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E7DDD0] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E7DDD0] bg-[#49372E] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15 text-white">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-white">
                Scan MVIT Laboratory QR Code
              </h2>
              <p className="text-xs text-[#E7DDD0]">
                Point your camera at an apparatus label or look up an equipment code manually.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner().then(onClose);
            }}
            className="p-2 rounded-lg text-[#E7DDD0] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4">
          {accessDeniedError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-rose-950">Laboratory Access Blocked:</span>
                  <p className="text-rose-800 mt-0.5 leading-relaxed">{accessDeniedError}</p>
                </div>
              </div>
            </div>
          )}

          {unrecognizedCode && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">QR Scanned, but no matching MVIT item found:</span>
                  <div className="font-mono text-[11px] bg-white p-1 rounded border border-amber-200 mt-1 break-all">
                    {unrecognizedCode}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setUnrecognizedCode(null)}
                  className="px-2.5 py-1 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {scannerError && (
            <div className="p-3.5 rounded-xl bg-[#FDF4EC] border border-[#E7C2A8] text-xs text-[#49372E] flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-[#A66A43] shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold">Camera Notice:</span>
                <p className="mt-0.5 leading-relaxed">{scannerError}</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={startScanner}
                    className="px-3 py-1 bg-[#49372E] hover:bg-[#382922] text-white rounded font-medium text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Camera
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSearchingManually(true)}
                    className="px-3 py-1 bg-white border border-[#D8CBB9] text-[#252521] rounded font-medium text-xs hover:bg-[#FAF6F0] cursor-pointer"
                  >
                    Manual Code Search
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Live Scanner Viewport */}
          <div className="relative rounded-xl overflow-hidden bg-[#252521] border border-[#D8CBB9] aspect-square max-w-[320px] mx-auto flex items-center justify-center shadow-inner">
            <div id="qr-camera-reader" className="w-full h-full [&>video]:object-cover" />

            {isScanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 border-2 border-[#E7C2A8] rounded-2xl relative shadow-[0_0_0_9999px_rgba(37,37,33,0.45)]">
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-[#A66A43] rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-[#A66A43] rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-[#A66A43] rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-[#A66A43] rounded-br-lg" />
                </div>
              </div>
            )}

            {!isScanning && !scannerError && (
              <div className="text-center p-4 text-[#E7DDD0] z-10">
                <Camera className="w-8 h-8 mx-auto mb-2 opacity-60 animate-pulse" />
                <p className="text-xs font-medium">Initializing camera feed...</p>
              </div>
            )}
          </div>

          {/* Camera Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F5F0E8]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFacingMode}
                className="px-3 py-1.5 text-xs font-medium text-[#252521] bg-[#FAF6F0] hover:bg-[#EFE7DC] border border-[#E7DDD0] rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <SwitchCamera className="w-3.5 h-3.5 text-[#A66A43]" />
                <span>Flip ({facingMode === 'environment' ? 'Rear' : 'Front'})</span>
              </button>

              <label className="cursor-pointer px-3 py-1.5 text-xs font-medium text-[#252521] bg-[#FAF6F0] hover:bg-[#EFE7DC] border border-[#E7DDD0] rounded-lg flex items-center gap-1.5 transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#A66A43]" />
                <span>Upload QR Image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => setIsSearchingManually(!isSearchingManually)}
              className="text-xs font-semibold text-[#A66A43] hover:text-[#49372E] transition-colors cursor-pointer"
            >
              {isSearchingManually ? 'Hide Manual Search' : 'Manual Code Search'}
            </button>
          </div>

          {/* Manual Item Code Search */}
          {isSearchingManually && (
            <div className="p-4 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#252521] flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-[#A66A43]" />
                  Equipment Code Lookup
                </span>
                <span className="text-[11px] text-[#6E675F] font-mono">e.g. MVIT-CAL-001</span>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!manualQuery.trim()) return;
                  setIsLookingUpManual(true);
                  await handleSuccessfulScan(manualQuery.trim());
                  setIsLookingUpManual(false);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={manualQuery}
                    onChange={(e) => setManualQuery(e.target.value)}
                    placeholder="Enter MVIT item code or apparatus name..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#D8CBB9] rounded-lg bg-white focus:outline-none focus:border-[#A66A43]"
                  />
                  <Search className="w-4 h-4 text-[#6E675F] absolute left-3 top-2.5" />
                </div>
                <button
                  type="submit"
                  disabled={!manualQuery.trim() || isLookingUpManual}
                  className="px-3.5 py-2 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] disabled:opacity-50 text-white rounded-lg shrink-0 cursor-pointer"
                >
                  {isLookingUpManual ? 'Checking...' : 'Look Up'}
                </button>
              </form>

              {searchResults.length > 0 && (
                <div className="max-h-36 overflow-y-auto divide-y divide-[#F5F0E8] border border-[#E7DDD0] rounded-lg bg-white">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSuccessfulScan(item.item_code || item.id)}
                      className="w-full p-2.5 text-left hover:bg-[#FAF6F0] flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div>
                        <div className="font-semibold text-xs text-[#252521]">{item.name}</div>
                        <div className="font-mono text-[10px] text-[#6E675F]">{item.item_code}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#A66A43]">
                          {item.quantity_available} {item.unit}
                        </span>
                        <div className="text-[10px] text-[#6E675F]">Inspect</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF6F0] border-t border-[#E7DDD0] flex items-center justify-between text-xs text-[#6E675F]">
          <div className="truncate max-w-[280px]">
            Laboratory:{' '}
            <span className="font-medium text-[#252521]">
              {currentLab?.name || 'All MVIT Laboratories'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              stopScanner().then(onClose);
            }}
            className="px-4 py-1.5 rounded-lg border border-[#D8CBB9] text-[#252521] hover:bg-white transition-colors cursor-pointer"
          >
            Cancel & Close
          </button>
        </div>
      </div>
    </div>
  );
};
