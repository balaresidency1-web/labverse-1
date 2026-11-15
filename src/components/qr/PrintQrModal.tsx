import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { InventoryItem, Lab } from '../../types';
import { formatInventoryQrPayload } from '../../utils/qrCodeService';
import {
  Printer,
  X,
  CheckSquare,
  Square,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface PrintQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  selectedItem?: InventoryItem | null;
  currentLab?: Lab | null;
  institutionName: string;
}

export const PrintQrModal: React.FC<PrintQrModalProps> = ({
  isOpen,
  onClose,
  inventory,
  selectedItem,
  currentLab,
  institutionName,
}) => {
  const [printMode, setPrintMode] = useState<'single' | 'batch' | 'a4_sheet'>(
    selectedItem ? 'single' : 'batch'
  );

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => {
    if (selectedItem) return new Set([selectedItem.id]);
    return new Set(inventory.slice(0, 8).map((i) => i.id));
  });

  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedItem) {
      setSelectedItemIds(new Set([selectedItem.id]));
      setPrintMode('single');
    } else if (isOpen && selectedItemIds.size === 0 && inventory.length > 0) {
      setSelectedItemIds(new Set(inventory.slice(0, 8).map((i) => i.id)));
      setPrintMode('batch');
    }
  }, [selectedItem, isOpen]);

  const itemsToPrint = inventory.filter((item) =>
    printMode === 'single' && selectedItem
      ? item.id === selectedItem.id
      : selectedItemIds.has(item.id)
  );

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsGenerating(true);

    const generateBatchUrls = async () => {
      const urls: Record<string, string> = {};
      for (const item of itemsToPrint) {
        try {
          const payload = formatInventoryQrPayload(item);
          const url = await QRCode.toDataURL(payload, {
            width: 260,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#252521', light: '#FFFFFF' },
          });
          urls[item.id] = url;
        } catch (err) {
          console.error(`Failed to generate QR for ${item.item_code}:`, err);
        }
      }
      if (isMounted) {
        setQrDataUrls(urls);
        setIsGenerating(false);
      }
    };

    generateBatchUrls();

    return () => {
      isMounted = false;
    };
  }, [isOpen, printMode, selectedItemIds, selectedItem, inventory]);

  if (!isOpen) return null;

  const toggleSelectAll = () => {
    if (selectedItemIds.size === inventory.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(inventory.map((i) => i.id)));
    }
  };

  const toggleItem = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
  };

  const handleTriggerPrint = () => {
    setPrintError(null);
    try {
      window.print();
    } catch {
      setPrintError('Browser print dialog could not be opened automatically. Press Ctrl+P (or Cmd+P) to print.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#252521]/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-[#E7DDD0] overflow-hidden flex flex-col max-h-[92vh] print-modal-wrapper">
        {/* Header */}
        <div className="no-print p-4 sm:p-5 border-b border-[#E7DDD0] bg-[#49372E] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/15 text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-white">
                Print MVIT Laboratory QR Asset Labels
              </h2>
              <p className="text-xs text-[#E7DDD0]">
                High-DPI scannable equipment labels with MVIT credentials and storage cabinet details.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#E7DDD0] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Print Configuration Controls */}
        <div className="no-print p-4 bg-white border-b border-[#E7DDD0] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#252521]">Print Format:</span>
              <div className="inline-flex rounded-lg border border-[#E7DDD0] bg-[#FAF6F0] p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setPrintMode('single')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    printMode === 'single'
                      ? 'bg-white text-[#49372E] font-semibold shadow-xs'
                      : 'text-[#6E675F] hover:text-[#252521]'
                  }`}
                >
                  Single Asset Tag
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('batch')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    printMode === 'batch'
                      ? 'bg-white text-[#49372E] font-semibold shadow-xs'
                      : 'text-[#6E675F] hover:text-[#252521]'
                  }`}
                >
                  Selected Labels ({itemsToPrint.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('a4_sheet')}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                    printMode === 'a4_sheet'
                      ? 'bg-white text-[#49372E] font-semibold shadow-xs'
                      : 'text-[#6E675F] hover:text-[#252521]'
                  }`}
                >
                  A4 Printable Sheet (10-up)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {printMode !== 'single' && (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#252521] bg-[#FAF6F0] hover:bg-[#EFE7DC] border border-[#E7DDD0] rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {selectedItemIds.size === inventory.length ? (
                    <CheckSquare className="w-3.5 h-3.5 text-[#A66A43]" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-[#6E675F]" />
                  )}
                  <span>
                    {selectedItemIds.size === inventory.length ? 'Deselect All' : 'Select All Items'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleTriggerPrint}
                disabled={itemsToPrint.length === 0 || isGenerating}
                className="px-4 py-2 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg shadow-xs flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print QR Labels ({itemsToPrint.length})</span>
              </button>
            </div>
          </div>

          {printError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{printError}</span>
            </div>
          )}

          {printMode !== 'single' && (
            <div className="pt-2 border-t border-[#F5F0E8]">
              <div className="text-[11px] font-semibold text-[#6E675F] uppercase tracking-wider mb-2">
                Choose Items to Include in Sheet:
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 border border-[#E7DDD0] rounded-lg bg-[#FAF6F0]">
                {inventory.map((item) => {
                  const isChecked = selectedItemIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border cursor-pointer ${
                        isChecked
                          ? 'bg-[#FDF4EC] border-[#E7C2A8] text-[#49372E]'
                          : 'bg-white border-[#E7DDD0] text-[#6E675F] hover:bg-[#F5F0E8]'
                      }`}
                    >
                      {isChecked ? (
                        <CheckSquare className="w-3 h-3 text-[#A66A43]" />
                      ) : (
                        <Square className="w-3 h-3 text-[#6E675F]" />
                      )}
                      <span className="font-mono text-[11px]">{item.item_code}</span>
                      <span className="max-w-[120px] truncate text-[11px]">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Printable Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F5F0E8]" id="printable-qr-content">
          {itemsToPrint.length === 0 ? (
            <div className="text-center py-12 text-[#6E675F]">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No inventory items selected for printing.</p>
              <p className="text-xs text-[#6E675F] mt-1">Select items above to generate printable labels.</p>
            </div>
          ) : printMode === 'a4_sheet' ? (
            <div className="bg-white p-6 rounded-xl border border-[#D8CBB9] shadow-sm a4-print-sheet mx-auto max-w-3xl">
              <div className="no-print pb-3 mb-4 border-b border-dashed border-[#E7DDD0] flex justify-between items-center text-xs text-[#6E675F]">
                <span>A4 Sheet Preview (Standard 10-Label Layout)</span>
                <span className="font-mono">{itemsToPrint.length} Labels</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 a4-grid">
                {itemsToPrint.map((item) => (
                  <div
                    key={item.id}
                    className="qr-label-card p-3.5 rounded-lg border-2 border-dashed border-[#D8CBB9] bg-white flex items-center gap-3.5 break-inside-avoid"
                  >
                    <div className="w-24 h-24 shrink-0 bg-white p-1 rounded border border-[#E7DDD0] flex items-center justify-center">
                      {qrDataUrls[item.id] ? (
                        <img
                          src={qrDataUrls[item.id]}
                          alt={item.item_code}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#FAF6F0] animate-pulse" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between h-24">
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#A66A43] truncate">
                          {institutionName}
                        </div>
                        <h4 className="font-heading text-xs font-bold text-[#252521] truncate leading-snug">
                          {item.name}
                        </h4>
                        <div className="font-mono text-xs font-bold text-[#49372E] tracking-tight mt-0.5">
                          {item.item_code}
                        </div>
                      </div>

                      <div className="text-[10px] text-[#6E675F] border-t border-[#F5F0E8] pt-1 flex flex-col">
                        <span className="truncate">
                          {currentLab?.name || item.department_name || 'MVIT Laboratory'}
                        </span>
                        <span className="text-[#6E675F] font-mono text-[9px] truncate">
                          Loc: {item.location}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              {itemsToPrint.map((item) => (
                <div
                  key={item.id}
                  className="qr-label-card p-4 rounded-xl border border-[#E7DDD0] bg-white flex items-center gap-4 break-inside-avoid shadow-xs"
                >
                  <div className="w-28 h-28 shrink-0 bg-white p-1.5 rounded-lg border border-[#D8CBB9] flex items-center justify-center">
                    {qrDataUrls[item.id] ? (
                      <img
                        src={qrDataUrls[item.id]}
                        alt={item.item_code}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#FAF6F0] animate-pulse" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="inline-block text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#FAF6F0] text-[#A66A43] border border-[#E7DDD0] mb-1">
                      {institutionName}
                    </span>
                    <h4 className="font-heading text-sm font-bold text-[#252521] truncate">
                      {item.name}
                    </h4>
                    <div className="font-mono text-xs font-bold text-[#49372E] tracking-tight mt-0.5">
                      {item.item_code}
                    </div>
                    <div className="mt-2 text-xs text-[#6E675F]">
                      <div>{currentLab?.name || item.department_name || 'MVIT Laboratory'}</div>
                      <div className="text-[11px] text-[#6E675F]">Loc: {item.location}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="no-print p-4 bg-[#FAF6F0] border-t border-[#E7DDD0] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E675F]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#A66A43]" />
            <span>High-DPI QR encoding with Level M error correction for instant camera autofocus.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[#D8CBB9] text-[#252521] hover:bg-white transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleTriggerPrint}
              disabled={itemsToPrint.length === 0 || isGenerating}
              className="px-4 py-1.5 rounded-lg bg-[#49372E] hover:bg-[#382922] text-white font-semibold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Labels</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
