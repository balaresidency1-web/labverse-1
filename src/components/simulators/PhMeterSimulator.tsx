import React, { useState } from 'react';
import { Droplet, RotateCcw, Check, Sparkles, AlertCircle, Beaker } from 'lucide-react';

interface ChemicalSample {
  id: string;
  name: string;
  nominalPh: number;
  type: 'acid' | 'base' | 'neutral' | 'buffer';
  color: string;
}

const CHEMICAL_SAMPLES: ChemicalSample[] = [
  { id: 'buf-7', name: 'Standard Buffer (pH 7.00)', nominalPh: 7.01, type: 'buffer', color: '#10B981' },
  { id: 'buf-4', name: 'Standard Buffer (pH 4.01)', nominalPh: 4.02, type: 'buffer', color: '#F59E0B' },
  { id: 'hcl', name: '0.1M Dilute Hydrochloric Acid (HCl)', nominalPh: 1.08, type: 'acid', color: '#EF4444' },
  { id: 'acetic', name: '0.1M Acetic Acid (CH3COOH)', nominalPh: 2.88, type: 'acid', color: '#F97316' },
  { id: 'naoh', name: '0.1M Sodium Hydroxide (NaOH)', nominalPh: 12.95, type: 'base', color: '#8B5CF6' },
  { id: 'water', name: 'Deionized Distilled Water', nominalPh: 6.94, type: 'neutral', color: '#38BDF8' },
];

export const PhMeterSimulator: React.FC<{ onLogData?: (data: any) => void }> = ({ onLogData }) => {
  const [selectedSample, setSelectedSample] = useState<ChemicalSample>(CHEMICAL_SAMPLES[0]);
  const [isElectrodeSubmerged, setIsElectrodeSubmerged] = useState<boolean>(true);
  const [isCalibrated7, setIsCalibrated7] = useState<boolean>(true);
  const [isCalibrated4, setIsCalibrated4] = useState<boolean>(true);

  // Digital Display output
  const displayedPh = isElectrodeSubmerged
    ? selectedSample.nominalPh
    : 7.0; // Air / rinse state
  const temperature = 25.0;

  const handleSubmergeToggle = () => {
    setIsElectrodeSubmerged(!isElectrodeSubmerged);
  };

  const handleCalibrate7 = () => {
    setIsCalibrated7(true);
  };

  const handleCalibrate4 = () => {
    setIsCalibrated4(true);
  };

  const handleReset = () => {
    setSelectedSample(CHEMICAL_SAMPLES[0]);
    setIsElectrodeSubmerged(true);
  };

  return (
    <div className="bg-[#101B35] text-white rounded-xl p-5 border border-[#25304B] shadow-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#25304B] gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3155D9] flex items-center justify-center text-white shadow-sm">
            <Droplet className="w-4 h-4 text-[#26B9D1]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-base text-white flex items-center gap-2">
              Virtual Mettler Toledo Glass Electrode pH Station
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#168A62]/30 text-[#4ECCA3] border border-[#168A62]/40">
                Resolution 0.01 pH
              </span>
            </h3>
            <p className="text-xs text-[#A0AEC0]">
              Combination Ag/AgCl Glass Electrode • Two-Point Buffer Calibration • Automatic Temp Compensation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 text-xs text-[#CBD5E1] hover:text-white bg-[#1A2644] hover:bg-[#25355E] border border-[#25304B] rounded transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Station
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Left: Chemical Sample Selection & Beaker View */}
        <div className="lg:col-span-5 bg-[#070D1B] border border-[#1E2C4D] rounded-lg p-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
              <Beaker className="w-3.5 h-3.5 text-[#38BDF8]" />
              Select Solution in Beaker:
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {CHEMICAL_SAMPLES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => setSelectedSample(sample)}
                  className={`px-2.5 py-1.5 text-xs rounded text-left flex items-center justify-between border transition-all ${
                    selectedSample.id === sample.id
                      ? 'bg-[#1E2C4D] text-white border-[#38BDF8]'
                      : 'bg-[#0E172E] text-[#94A3B8] border-[#1E2C4D] hover:bg-[#14203D]'
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: sample.color }}
                    />
                    {sample.name}
                  </span>
                  <span className="text-[10px] font-mono opacity-80 uppercase">
                    {sample.type}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Graphical Beaker and Probe Representation */}
          <div className="mt-4 pt-3 border-t border-[#1E2C4D] flex items-center justify-center">
            <div className="relative w-48 h-40 flex items-end justify-center">
              {/* Glass Beaker */}
              <div
                className="w-32 h-28 border-2 border-[#64748B] border-t-0 rounded-b-xl relative overflow-hidden backdrop-blur-sm"
                style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
              >
                {/* Liquid Level */}
                <div
                  className="absolute bottom-0 inset-x-0 h-20 transition-all duration-300 opacity-60"
                  style={{ backgroundColor: selectedSample.color }}
                />
                {/* Graduations */}
                <div className="absolute left-1 top-2 space-y-2">
                  <div className="w-3 h-0.5 bg-[#94A3B8]" />
                  <div className="w-2 h-0.5 bg-[#94A3B8]" />
                  <div className="w-3 h-0.5 bg-[#94A3B8]" />
                  <div className="w-2 h-0.5 bg-[#94A3B8]" />
                </div>
              </div>

              {/* Combination Glass Electrode Probe */}
              <div
                className={`absolute w-4 transition-all duration-300 flex flex-col items-center ${
                  isElectrodeSubmerged ? 'top-6' : '-top-2'
                }`}
              >
                <div className="w-3 h-24 bg-[#334155] rounded-t border border-[#475569]" />
                <div className="w-3.5 h-4 bg-[#0EA5E9] rounded-b-full border border-[#38BDF8] shadow-sm animate-pulse" />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmergeToggle}
            className="mt-3 w-full py-1.5 text-xs font-medium rounded border border-[#25304B] bg-[#14203D] hover:bg-[#1E2E57] text-[#CBD5E1]"
          >
            {isElectrodeSubmerged ? '▲ Lift Electrode to Rinse' : '▼ Submerge Electrode into Solution'}
          </button>
        </div>

        {/* Right: Digital pH Meter Console & Telemetry */}
        <div className="lg:col-span-7 space-y-4">
          {/* LCD Digital Meter Display */}
          <div className="bg-[#0A1224] border-2 border-[#1E2C4D] rounded-xl p-5 relative overflow-hidden shadow-inner">
            <div className="flex justify-between items-center text-[11px] font-mono text-[#64748B] border-b border-[#1E2C4D] pb-2">
              <span>METTLER TOLEDO F20</span>
              <span className="text-[#34D399] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
                STABLE ATC 25°C
              </span>
            </div>

            <div className="py-4 text-center">
              <div className="font-mono text-5xl font-bold tracking-tight text-[#26B9D1]">
                {displayedPh.toFixed(2)}
              </div>
              <div className="text-xs font-mono uppercase tracking-widest text-[#64748B] mt-1">
                ELECTROCHEMICAL pH UNIT
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1E2C4D] text-center text-xs font-mono">
              <div className="bg-[#070D1B] p-2 rounded">
                <div className="text-[#64748B] text-[10px]">TEMP</div>
                <div className="text-white font-bold">{temperature.toFixed(1)} °C</div>
              </div>
              <div className="bg-[#070D1B] p-2 rounded">
                <div className="text-[#64748B] text-[10px]">SLOPE</div>
                <div className="text-[#34D399] font-bold">98.4 %</div>
              </div>
              <div className="bg-[#070D1B] p-2 rounded">
                <div className="text-[#64748B] text-[10px]">mV SIGNAL</div>
                <div className="text-[#38BDF8] font-bold">
                  {((7 - displayedPh) * 59.16).toFixed(1)} mV
                </div>
              </div>
            </div>
          </div>

          {/* Two Point Calibration Actions */}
          <div className="bg-[#0E172E] border border-[#1E2C4D] rounded-lg p-4 space-y-3">
            <div className="text-xs font-semibold text-[#E2E8F0]">
              Two-Point Calibration Status (Nernstian Validation):
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleCalibrate7}
                className="p-2.5 rounded bg-[#1A2644] hover:bg-[#25355E] border border-[#25304B] text-xs flex items-center justify-between"
              >
                <span>Zero Point: pH 7.00</span>
                <Check className="w-4 h-4 text-[#10B981]" />
              </button>
              <button
                type="button"
                onClick={handleCalibrate4}
                className="p-2.5 rounded bg-[#1A2644] hover:bg-[#25355E] border border-[#25304B] text-xs flex items-center justify-between"
              >
                <span>Slope Point: pH 4.01</span>
                <Check className="w-4 h-4 text-[#10B981]" />
              </button>
            </div>
          </div>

          {/* Nature interpretation */}
          <div className="p-3 rounded-lg bg-[#0E172E] border border-[#1E2C4D] text-xs flex items-center gap-2">
            <span className="font-semibold text-[#CBD5E1]">Sample Nature:</span>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-mono font-bold"
              style={{
                backgroundColor: `${selectedSample.color}20`,
                color: selectedSample.color,
                border: `1px solid ${selectedSample.color}40`,
              }}
            >
              {displayedPh < 6.8 ? 'ACIDIC SOLUTION' : displayedPh > 7.2 ? 'BASIC / ALKALINE SOLUTION' : 'NEUTRAL BUFFER'}
            </span>
            <span className="text-[#64748B] ml-auto text-[11px] font-mono">
              [H₃O⁺] = 10^(-{displayedPh.toFixed(1)}) M
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
