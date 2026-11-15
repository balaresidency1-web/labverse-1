import React, { useState, useEffect } from 'react';
import { InventoryItem, Lab, PublicQrInventoryItem, Role } from '../../types';
import {
  generateQrDataUrl,
  generateQrSvgString,
  downloadDataUrl,
  downloadSvgString,
  formatInventoryQrPayload,
} from '../../utils/qrCodeService';
import { StatusBadge } from '../common/StatusBadge';
import {
  QrCode,
  Download,
  Printer,
  X,
  MapPin,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
} from 'lucide-react';

export type QrInspectableItem = InventoryItem | PublicQrInventoryItem;

interface ItemQrDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: QrInspectableItem | null;
  currentLab?: Lab | null;
  userRole: Role | null;
  readOnlyPublic?: boolean;
  onOpenIssue?: (item: InventoryItem) => void;
  onOpenReturn?: (item: InventoryItem) => void;
  onOpenPrint?: (item: InventoryItem) => void;
}

export const ItemQrDetailModal: React.FC<ItemQrDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  currentLab,
  userRole,
  readOnlyPublic = false,
  onOpenIssue,
  onOpenReturn,
  onOpenPrint,
}) => {
  const [pngDataUrl, setPngDataUrl] = useState<string>('');
  const [svgString, setSvgString] = useState<string>('');

  useEffect(() => {
    if (!item || !isOpen) return;

    let isMounted = true;

    const generateAssets = async () => {
      try {
        const payloadItem: InventoryItem = {
          ...(item as any),
          min_safety_threshold: (item as InventoryItem).min_safety_threshold ?? 0,
          status:
            (item as InventoryItem).status ||
            (item as PublicQrInventoryItem).availability_status ||
            'in_stock',
        };
        const payload = formatInventoryQrPayload(payloadItem);
        const [png, svg] = await Promise.all([
          generateQrDataUrl(payload, {
            size: 360,
            margin: 2,
            errorCorrectionLevel: 'H',
            darkColor: '#252521',
          }),
          generateQrSvgString(payload, { size: 360, margin: 2, errorCorrectionLevel: 'H' }),
        ]);

        if (isMounted) {
          setPngDataUrl(png);
          setSvgString(svg);
        }
      } catch (err) {
        console.error('Error creating QR assets:', err);
      }
    };

    generateAssets();

    return () => {
      isMounted = false;
    };
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const isStaff = !readOnlyPublic && (userRole === 'lab_assistant' || userRole === 'college_admin');
  const displayStatus =
    (item as InventoryItem).status ||
    (item as PublicQrInventoryItem).availability_status ||
    'in_stock';
  const labDisplayName =
    currentLab?.name || item.laboratory_name || item.department_name || 'MVIT Laboratory';

  const handleDownloadPng = () => {
    if (pngDataUrl) {
      downloadDataUrl(pngDataUrl, `MVIT_LABVERSE_QR_${item.item_code}.png`);
    }
  };

  const handleDownloadSvg = () => {
    if (svgString) {
      downloadSvgString(svgString, `MVIT_LABVERSE_QR_${item.item_code}.svg`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#252521]/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-[#E7DDD0] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E7DDD0] bg-[#FAF6F0] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-[#49372E] text-white shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-bold text-[#252521] truncate">
                MVIT Apparatus Asset Tag
              </h2>
              <p className="text-xs text-[#6E675F] font-mono truncate">
                {item.item_code} • {item.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#6E675F] hover:text-[#252521] hover:bg-[#EFE7DC] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5">
          {readOnlyPublic && (
            <div className="p-3 rounded-xl bg-[#EBF5EE] border border-[#C6E3D0] text-xs text-[#2E6F4E] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                Verified MVIT Laboratory Apparatus Record (Public Read-Only View)
              </span>
            </div>
          )}

          {/* QR Display Card */}
          <div className="flex flex-col items-center p-5 rounded-2xl bg-[#FAF6F0] border border-[#E7DDD0]">
            <div className="w-48 h-48 bg-white p-3 rounded-xl border border-[#D8CBB9] shadow-sm flex items-center justify-center overflow-hidden">
              {pngDataUrl ? (
                <img
                  src={pngDataUrl}
                  alt={`QR for ${item.item_code}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full bg-[#F5F0E8] animate-pulse flex items-center justify-center text-xs text-[#6E675F]">
                  Generating High-Res QR...
                </div>
              )}
            </div>

            <div className="mt-3 text-center">
              <div className="font-mono font-bold text-sm text-[#252521] tracking-tight">
                {item.item_code}
              </div>
              <div className="text-xs font-semibold text-[#A66A43] mt-0.5">
                {item.name}
              </div>
              <div className="text-[11px] text-[#6E675F] flex items-center justify-center gap-1 mt-1">
                <MapPin className="w-3 h-3 text-[#A66A43]" />
                <span>
                  {item.location} ({labDisplayName})
                </span>
              </div>
            </div>

            {/* Download / Print Actions */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-3 border-t border-[#E7DDD0] w-full">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={!pngDataUrl}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#D8CBB9] text-[#252521] hover:bg-[#F5F0E8] rounded-lg flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#A66A43]" />
                <span>Download PNG</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadSvg}
                disabled={!svgString}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-[#D8CBB9] text-[#252521] hover:bg-[#F5F0E8] rounded-lg flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#2E6F4E]" />
                <span>Download SVG</span>
              </button>

              {isStaff && onOpenPrint && (
                <button
                  type="button"
                  onClick={() => onOpenPrint(item as InventoryItem)}
                  className="px-3.5 py-1.5 text-xs font-semibold bg-[#49372E] hover:bg-[#382922] text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print QR Label</span>
                </button>
              )}
            </div>
          </div>

          {/* Apparatus Specifications & Availability */}
          <div className="space-y-3">
            <h4 className="font-heading text-xs font-bold text-[#6E675F] uppercase tracking-wider">
              Apparatus Inventory & Laboratory Status
            </h4>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-[#FAF6F0] border border-[#E7DDD0]">
                <span className="text-[11px] text-[#6E675F] block">Stock Status</span>
                <div className="mt-1">
                  <StatusBadge status={displayStatus} size="sm" />
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#FAF6F0] border border-[#E7DDD0]">
                <span className="text-[11px] text-[#6E675F] block">Available / Total</span>
                <span className="font-mono font-bold text-[#252521] mt-1 block">
                  {item.quantity_available} / {item.quantity_total} {item.unit}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#FAF6F0] border border-[#E7DDD0]">
                <span className="text-[11px] text-[#6E675F] block">Category</span>
                <span className="font-medium text-[#252521] mt-1 block capitalize">
                  {item.category}
                </span>
              </div>

              {readOnlyPublic ? (
                <div className="p-2.5 rounded-lg bg-[#FAF6F0] border border-[#E7DDD0]">
                  <span className="text-[11px] text-[#6E675F] block">Laboratory</span>
                  <span className="font-medium text-[#252521] mt-1 block truncate">
                    {labDisplayName}
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-[#FAF6F0] border border-[#E7DDD0]">
                  <span className="text-[11px] text-[#6E675F] block">Min. Safety Threshold</span>
                  <span className="font-mono text-[#49372E] mt-1 block">
                    {(item as InventoryItem).min_safety_threshold ?? 0} {item.unit}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Operational Actions (Staff Only) */}
          {isStaff && (onOpenIssue || onOpenReturn) && (
            <div className="pt-2 border-t border-[#E7DDD0] flex flex-wrap gap-2">
              {onOpenIssue && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenIssue(item as InventoryItem);
                  }}
                  className="flex-1 py-2 px-3 bg-[#A66A43] hover:bg-[#8E5835] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Issue Apparatus
                </button>
              )}

              {onOpenReturn && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReturn(item as InventoryItem);
                  }}
                  className="flex-1 py-2 px-3 bg-[#2E6F4E] hover:bg-[#23583D] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  Return Apparatus
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF6F0] border-t border-[#E7DDD0] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-[#D8CBB9] text-[#252521] hover:bg-white text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
