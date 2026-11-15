import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface ItemQrCodeProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  className?: string;
}

/**
 * Standard-compliant, high-resolution QR code renderer using 'qrcode'.
 * Produces crisp SVG with Level M error correction and proper quiet zone.
 */
export const ItemQrCode: React.FC<ItemQrCodeProps> = ({
  value,
  size = 140,
  label,
  sublabel,
  className = '',
}) => {
  const [svgString, setSvgString] = useState<string>('');

  useEffect(() => {
    let isCurrent = true;
    QRCode.toString(value, {
      type: 'svg',
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#101B35',
        light: '#FFFFFF',
      },
    })
      .then((svg) => {
        if (isCurrent) setSvgString(svg);
      })
      .catch((err) => {
        console.error('Error generating QR code:', err);
      });

    return () => {
      isCurrent = false;
    };
  }, [value, size]);

  return (
    <div
      className={`flex flex-col items-center bg-white p-3 rounded-lg border border-[#E2E8F0] shadow-sm select-none ${className}`}
    >
      <div
        className="flex items-center justify-center overflow-hidden bg-white rounded"
        style={{ width: size, height: size }}
      >
        {svgString ? (
          <div
            dangerouslySetInnerHTML={{ __html: svgString }}
            className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
          />
        ) : (
          <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center text-[10px] text-slate-400">
            Rendering QR...
          </div>
        )}
      </div>

      {label && (
        <span className="mt-2 text-xs font-semibold font-mono text-[#101B35] tracking-tight text-center">
          {label}
        </span>
      )}
      {sublabel && (
        <span className="text-[10px] text-[#68758A] truncate max-w-[180px] text-center">
          {sublabel}
        </span>
      )}
    </div>
  );
};
