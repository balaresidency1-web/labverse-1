import React, { useState } from 'react';
import { Sliders, RotateCcw, Check, Sparkles, Box, Target } from 'lucide-react';

interface Specimen {
  id: string;
  name: string;
  nominalDimension: number; // in mm
  description: string;
}

const SPECIMENS: Specimen[] = [
  { id: 'brass-cyl', name: 'Solid Brass Cylinder (Diameter)', nominalDimension: 22.36, description: 'Machined grade 360 brass rod' },
  { id: 'steel-ball', name: 'Hardened Steel Bearing Ball', nominalDimension: 15.42, description: 'Precision chrome steel sphere' },
  { id: 'gauge-block', name: 'Rectangular Gauge Block', nominalDimension: 31.84, description: 'Hardened tool steel inspection standard' },
];

export const VernierCaliperSimulator: React.FC<{ onLogData?: (data: any) => void }> = ({ onLogData }) => {
  const [selectedSpecimen, setSelectedSpecimen] = useState<Specimen>(SPECIMENS[0]);
  const [jawPositionMm, setJawPositionMm] = useState<number>(0.0);
  const [isObjectClamped, setIsObjectClamped] = useState<boolean>(false);

  // Least Count = 0.02 mm (50 vernier divisions = 49 mm)
  const leastCount = 0.02;

  // Breakdown of jaw position
  const msr = Math.floor(jawPositionMm); // Main scale reading in mm
  const fraction = jawPositionMm - msr;
  const vernierCoincidence = Math.round(fraction / leastCount);
  const totalCalculated = Number((msr + vernierCoincidence * leastCount).toFixed(2));

  const handleClampSpecimen = (specimen: Specimen) => {
    setSelectedSpecimen(specimen);
    setJawPositionMm(specimen.nominalDimension);
    setIsObjectClamped(true);
  };

  const handleUnclamp = () => {
    setIsObjectClamped(false);
  };

  const handleReset = () => {
    setJawPositionMm(0.0);
    setIsObjectClamped(false);
  };

  return (
    <div className="bg-[#101B35] text-white rounded-xl p-5 border border-[#25304B] shadow-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#25304B] gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3155D9] flex items-center justify-center text-white shadow-sm">
            <Target className="w-4 h-4 text-[#26B9D1]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-base text-white flex items-center gap-2">
              Virtual Mitutoyo Vernier Caliper (0-150 mm)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#168A62]/30 text-[#4ECCA3] border border-[#168A62]/40">
                LC = 0.02 mm
              </span>
            </h3>
            <p className="text-xs text-[#A0AEC0]">
              50 Vernier Divisions • Sliding Jaw Micro-adjustment • Specimen Clamping & Reading Verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 text-xs text-[#CBD5E1] hover:text-white bg-[#1A2644] hover:bg-[#25355E] border border-[#25304B] rounded transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Zero
          </button>
        </div>
      </div>

      {/* Select Specimen to Measure */}
      <div className="mt-4 flex flex-wrap items-center gap-2 bg-[#0A1224] p-3 rounded-lg border border-[#1E2C4D]">
        <span className="text-xs text-[#94A3B8] font-medium flex items-center gap-1.5">
          <Box className="w-3.5 h-3.5 text-[#38BDF8]" />
          Insert Test Specimen into Measuring Jaws:
        </span>
        {SPECIMENS.map((spec) => (
          <button
            key={spec.id}
            type="button"
            onClick={() => handleClampSpecimen(spec)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              selectedSpecimen.id === spec.id && isObjectClamped
                ? 'bg-[#3155D9] text-white border-[#4F73F5]'
                : 'bg-[#14203D] text-[#CBD5E1] border-[#25304B] hover:bg-[#1E2E57]'
            }`}
          >
            {spec.name}
          </button>
        ))}
        {isObjectClamped && (
          <button
            type="button"
            onClick={handleUnclamp}
            className="text-xs text-[#F43F5E] hover:underline ml-auto"
          >
            Remove Specimen
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Vernier Graphic Canvas Stage */}
        <div className="lg:col-span-8 bg-[#070D1B] border border-[#1E2C4D] rounded-lg p-4 flex flex-col justify-between min-h-[220px]">
          <div className="text-[11px] font-mono text-[#64748B] flex justify-between">
            <span>MAIN BEAM (0 - 150 mm)</span>
            <span className="text-[#38BDF8]">
              {isObjectClamped ? `Clamped: ${selectedSpecimen.name}` : 'Free Manual Position'}
            </span>
          </div>

          {/* SVG Caliper Beam Representation */}
          <div className="relative my-3 overflow-x-auto py-2">
            <svg width="560" height="120" viewBox="0 0 560 120" className="select-none">
              {/* Main Steel Beam */}
              <rect x="10" y="20" width="540" height="42" fill="#E2E8F0" rx="3" stroke="#94A3B8" />

              {/* Fixed Left Jaw */}
              <path d="M 10 20 L 10 110 L 25 110 L 32 62 L 50 62 L 50 20 Z" fill="#CBD5E1" stroke="#64748B" />

              {/* Main Scale Markings (mm) */}
              {Array.from({ length: 50 }).map((_, i) => {
                const x = 50 + i * 9.5;
                const isTen = i % 10 === 0;
                const isFive = i % 5 === 0;
                const tickHeight = isTen ? 16 : isFive ? 11 : 6;
                return (
                  <g key={`main-${i}`}>
                    <line x1={x} y1="20" x2={x} y2={20 + tickHeight} stroke="#1E293B" strokeWidth={isTen ? '1.5' : '1'} />
                    {isTen && (
                      <text x={x} y="44" fill="#0F172A" fontSize="9" textAnchor="middle" fontFamily="monospace">
                        {i}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Specimen inside jaws */}
              {isObjectClamped && (
                <rect
                  x="50"
                  y="62"
                  width={Math.min(jawPositionMm * 9.5, 300)}
                  height="36"
                  fill="#F59E0B"
                  opacity="0.85"
                  rx="2"
                  stroke="#D97706"
                />
              )}

              {/* Sliding Vernier Jaw */}
              {(() => {
                const sliderX = 50 + jawPositionMm * 9.5;
                return (
                  <g>
                    {/* Sliding frame */}
                    <rect x={sliderX} y="15" width="120" height="52" fill="#3B82F6" opacity="0.3" rx="2" />
                    {/* Movable Lower Jaw */}
                    <path
                      d={`M ${sliderX} 62 L ${sliderX} 110 L ${sliderX + 15} 110 L ${sliderX + 22} 67 L ${sliderX + 120} 67 L ${sliderX + 120} 20 L ${sliderX} 20 Z`}
                      fill="#94A3B8"
                      stroke="#475569"
                    />
                    {/* Vernier scale zero marker */}
                    <line x1={sliderX} y1="67" x2={sliderX} y2="52" stroke="#EF4444" strokeWidth="2" />
                    <text x={sliderX} y="82" fill="#EF4444" fontSize="10" textAnchor="middle" fontWeight="bold">
                      ▲ 0
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>

          {/* Slider input for manual adjustment */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#94A3B8]">Slide Movable Jaw Position:</span>
              <span className="font-mono text-[#38BDF8] font-bold">{jawPositionMm.toFixed(2)} mm</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="0.02"
              value={jawPositionMm}
              onChange={(e) => {
                setJawPositionMm(parseFloat(e.target.value));
                setIsObjectClamped(false);
              }}
              className="w-full h-2 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#3155D9]"
            />
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setJawPositionMm((v) => Math.max(0, +(v - 0.02).toFixed(2)))}
                className="px-2 py-0.5 text-xs bg-[#1E2C4D] hover:bg-[#2A3C69] rounded"
              >
                - 0.02 mm (Fine)
              </button>
              <button
                type="button"
                onClick={() => setJawPositionMm((v) => Math.min(50, +(v + 0.02).toFixed(2)))}
                className="px-2 py-0.5 text-xs bg-[#1E2C4D] hover:bg-[#2A3C69] rounded"
              >
                + 0.02 mm (Fine)
              </button>
            </div>
          </div>
        </div>

        {/* Right: Inspection Inspector & Reading Breakdown */}
        <div className="lg:col-span-4 bg-[#0A1224] border border-[#1E2C4D] rounded-lg p-4 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
            Reading Decomposition
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 rounded bg-[#0E172E] border border-[#1E2C4D]">
              <span className="text-xs text-[#94A3B8]">1. Main Scale (MSR):</span>
              <span className="font-mono text-sm font-bold text-white">{msr} mm</span>
            </div>

            <div className="flex justify-between items-center p-2 rounded bg-[#0E172E] border border-[#1E2C4D]">
              <span className="text-xs text-[#94A3B8]">2. Vernier Coincidence (n):</span>
              <span className="font-mono text-sm font-bold text-[#38BDF8]">
                Div #{vernierCoincidence}
              </span>
            </div>

            <div className="flex justify-between items-center p-2 rounded bg-[#0E172E] border border-[#1E2C4D]">
              <span className="text-xs text-[#94A3B8]">3. Vernier Fraction (n × LC):</span>
              <span className="font-mono text-sm font-bold text-[#26B9D1]">
                {(vernierCoincidence * leastCount).toFixed(2)} mm
              </span>
            </div>

            <div className="p-3 rounded bg-[#101F42] border border-[#3155D9] text-center">
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#A0AEC0]">
                TOTAL READING (MSR + VSR)
              </span>
              <div className="font-mono text-2xl font-bold text-white mt-0.5">
                {totalCalculated.toFixed(2)}
                <span className="text-xs text-[#38BDF8] ml-1">mm</span>
              </div>
            </div>
          </div>

          {isObjectClamped && (
            <div className="text-xs text-[#34D399] bg-[#064E3B]/40 p-2.5 rounded border border-[#059669]/30 flex items-center gap-1.5">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                Standard Reference: {selectedSpecimen.nominalDimension} mm (Measurement match within ±0.02 mm)
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
