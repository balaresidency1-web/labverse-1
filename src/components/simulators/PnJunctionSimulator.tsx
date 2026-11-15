import React, { useState, useMemo } from 'react';
import { Play, RotateCcw, Plus, Activity, Zap, CheckCircle2, Sliders } from 'lucide-react';

interface Reading {
  id: number;
  vf: number;
  if_ma: number;
  rd?: number;
}

export const PnJunctionSimulator: React.FC<{ onLogData?: (data: any) => void }> = ({ onLogData }) => {
  // Supply Voltage dial (0 to 1.50V)
  const [supplyVoltage, setSupplyVoltage] = useState<number>(0.0);
  const [readings, setReadings] = useState<Reading[]>([
    { id: 1, vf: 0.1, if_ma: 0.01 },
    { id: 2, vf: 0.3, if_ma: 0.03 },
    { id: 3, vf: 0.5, if_ma: 0.22 },
    { id: 4, vf: 0.65, if_ma: 2.50 },
    { id: 5, vf: 0.72, if_ma: 12.80 },
  ]);

  // Diode model parameters (Silicon 1N4007)
  // Knee voltage ~ 0.68V
  const is = 1e-9; // Saturation current ~ 1 nA
  const vt = 0.026; // Thermal voltage at 300K ~ 26 mV
  const eta = 1.6; // Ideality factor for Si
  const rSeries = 1000; // 1k series resistor in circuit

  // Compute forward voltage across diode (Vf) and current (If in mA)
  const { vf, if_ma } = useMemo(() => {
    if (supplyVoltage <= 0) return { vf: 0, if_ma: 0 };

    // Numerical solution for loop: Vs = I * R + Vf, where I = Is * (exp(Vf / (eta*Vt)) - 1)
    let v_d = 0;
    for (let iter = 0; iter < 40; iter++) {
      const expTerm = Math.exp(Math.min(v_d / (eta * vt), 35));
      const i_d = is * (expTerm - 1);
      const f = v_d + i_d * rSeries - supplyVoltage;
      const df = 1 + (is * expTerm / (eta * vt)) * rSeries;
      const delta = f / df;
      v_d -= delta;
      if (Math.abs(delta) < 1e-5) break;
    }

    v_d = Math.max(0, Math.min(supplyVoltage, v_d));
    const current_amp = Math.max(0, (supplyVoltage - v_d) / rSeries);
    const current_ma = current_amp * 1000;

    return {
      vf: Number(v_d.toFixed(3)),
      if_ma: Number(current_ma.toFixed(2)),
    };
  }, [supplyVoltage]);

  // Log current reading into table
  const handleLogReading = () => {
    const last = readings[readings.length - 1];
    let rd: number | undefined = undefined;
    if (last && Math.abs(if_ma - last.if_ma) > 0.05) {
      const deltaV = Math.abs(vf - last.vf);
      const deltaI = Math.abs(if_ma - last.if_ma) / 1000;
      rd = Number((deltaV / deltaI).toFixed(1));
    }

    const newReading: Reading = {
      id: Date.now(),
      vf,
      if_ma,
      rd,
    };
    const updated = [...readings, newReading].sort((a, b) => a.vf - b.vf);
    setReadings(updated);
    if (onLogData) {
      onLogData(updated);
    }
  };

  const handleClearReadings = () => {
    setReadings([]);
    setSupplyVoltage(0);
  };

  // SVG dimensions for real-time V-I graph
  const width = 440;
  const height = 240;
  const padding = 36;
  const maxV = 1.0;
  const maxI = 35.0;

  const points = readings
    .map((r) => {
      const x = padding + (r.vf / maxV) * (width - 2 * padding);
      const y = height - padding - (r.if_ma / maxI) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(' ');

  // Current live point on graph
  const liveX = padding + (Math.min(vf, maxV) / maxV) * (width - 2 * padding);
  const liveY = height - padding - (Math.min(if_ma, maxI) / maxI) * (height - 2 * padding);

  return (
    <div className="bg-[#101B35] text-white rounded-xl p-5 border border-[#25304B] shadow-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#25304B] gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3155D9] flex items-center justify-center text-white shadow-sm">
            <Zap className="w-4 h-4 text-[#26B9D1]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-base text-white flex items-center gap-2">
              Interactive Silicon Diode Testbench
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#168A62]/30 text-[#4ECCA3] border border-[#168A62]/40">
                Live Simulation
              </span>
            </h3>
            <p className="text-xs text-[#A0AEC0]">
              Silicon 1N4007 • 1kΩ Series Protection • Real-time V-I Telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClearReadings}
            className="px-2.5 py-1.5 text-xs text-[#CBD5E1] hover:text-white bg-[#1A2644] hover:bg-[#25355E] border border-[#25304B] rounded transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Workbench
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Left: Controls & Digital Readouts */}
        <div className="lg:col-span-5 space-y-4">
          {/* Dual Digital Meters HUD */}
          <div className="grid grid-cols-2 gap-3">
            {/* Voltmeter Display */}
            <div className="bg-[#0A1224] border border-[#1E2C4D] rounded-lg p-3 text-center relative overflow-hidden">
              <div className="absolute top-1 left-2 text-[10px] uppercase font-mono tracking-wider text-[#68758A]">
                Digital Voltmeter (Vf)
              </div>
              <div className="mt-3 font-mono text-2xl font-bold text-[#26B9D1] tracking-tight">
                {vf.toFixed(3)}
                <span className="text-xs text-[#68758A] ml-1">V</span>
              </div>
              <div className="text-[10px] text-[#A0AEC0] mt-1 flex justify-center items-center gap-1">
                Across 1N4007 Diode
              </div>
            </div>

            {/* Milliammeter Display */}
            <div className="bg-[#0A1224] border border-[#1E2C4D] rounded-lg p-3 text-center relative overflow-hidden">
              <div className="absolute top-1 left-2 text-[10px] uppercase font-mono tracking-wider text-[#68758A]">
                Milliammeter (If)
              </div>
              <div className="mt-3 font-mono text-2xl font-bold text-[#38BDF8] tracking-tight">
                {if_ma.toFixed(2)}
                <span className="text-xs text-[#68758A] ml-1">mA</span>
              </div>
              <div className="text-[10px] text-[#A0AEC0] mt-1 flex justify-center items-center gap-1">
                Forward Current
              </div>
            </div>
          </div>

          {/* Voltage Dial Slider */}
          <div className="bg-[#0E172E] border border-[#1E2C4D] rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-[#E2E8F0] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#3155D9]" />
                Regulated DC Supply (Vs)
              </label>
              <span className="font-mono text-sm font-bold text-[#F1F5F9] bg-[#1E293B] px-2 py-0.5 rounded border border-[#334155]">
                {supplyVoltage.toFixed(2)} V
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="15.0"
              step="0.05"
              value={supplyVoltage}
              onChange={(e) => setSupplyVoltage(parseFloat(e.target.value))}
              className="w-full h-2 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#3155D9]"
            />

            <div className="flex justify-between text-[10px] font-mono text-[#64748B] mt-1.5">
              <span>0.00 V</span>
              <span className="text-[#38BDF8]">Knee Zone ~0.7V</span>
              <span>15.00 V</span>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => setSupplyVoltage((v) => Math.max(0, Number((v - 0.05).toFixed(2))))}
                className="flex-1 py-1 text-xs bg-[#1A2644] hover:bg-[#25355E] text-white rounded border border-[#25304B]"
              >
                - 0.05 V
              </button>
              <button
                type="button"
                onClick={() => setSupplyVoltage((v) => Math.min(15, Number((v + 0.05).toFixed(2))))}
                className="flex-1 py-1 text-xs bg-[#1A2644] hover:bg-[#25355E] text-white rounded border border-[#25304B]"
              >
                + 0.05 V
              </button>
              <button
                type="button"
                onClick={handleLogReading}
                className="flex-2 py-1.5 px-3 text-xs font-medium bg-[#3155D9] hover:bg-[#2544B8] text-white rounded shadow-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Log Point
              </button>
            </div>
          </div>

          {/* Diode State Diagnosis */}
          <div className="p-3 rounded-lg bg-[#0E172E] border border-[#1E2C4D] text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1">
              Conduction State Diagnosis
            </div>
            {vf < 0.55 ? (
              <p className="text-[#94A3B8]">
                Below Barrier Potential: Diode is in high-resistance non-conducting state. Current is near zero.
              </p>
            ) : vf < 0.72 ? (
              <p className="text-[#FBBF24]">
                Knee / Transition Region: Barrier potential counteracted. Exponential turn-on begins!
              </p>
            ) : (
              <p className="text-[#34D399]">
                Linear Forward Conduction: Barrier overcome. Internal forward dynamic resistance dominates (~12-16 Ω).
              </p>
            )}
          </div>
        </div>

        {/* Right: Dynamic Characteristic Curve */}
        <div className="lg:col-span-7 bg-[#0A1224] border border-[#1E2C4D] rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#A0AEC0] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-[#26B9D1]" />
                Dynamic Forward V-I Characteristic Plot
              </span>
              <span className="text-[10px] font-mono text-[#64748B]">
                {readings.length} Recorded Points
              </span>
            </div>

            {/* SVG Plotter */}
            <div className="relative bg-[#070D1B] rounded border border-[#1A2644] overflow-hidden">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-auto select-none"
              >
                {/* Grid Lines */}
                {[0.2, 0.4, 0.6, 0.8].map((v) => {
                  const gx = padding + (v / maxV) * (width - 2 * padding);
                  return (
                    <g key={`grid-x-${v}`}>
                      <line
                        x1={gx}
                        y1={padding}
                        x2={gx}
                        y2={height - padding}
                        stroke="#1E293B"
                        strokeDasharray="2,2"
                      />
                      <text
                        x={gx}
                        y={height - padding + 14}
                        fill="#64748B"
                        fontSize="9"
                        textAnchor="middle"
                        fontFamily="monospace"
                      >
                        {v.toFixed(1)}V
                      </text>
                    </g>
                  );
                })}

                {[10, 20, 30].map((curr) => {
                  const gy = height - padding - (curr / maxI) * (height - 2 * padding);
                  return (
                    <g key={`grid-y-${curr}`}>
                      <line
                        x1={padding}
                        y1={gy}
                        x2={width - padding}
                        y2={gy}
                        stroke="#1E293B"
                        strokeDasharray="2,2"
                      />
                      <text
                        x={padding - 6}
                        y={gy + 3}
                        fill="#64748B"
                        fontSize="9"
                        textAnchor="end"
                        fontFamily="monospace"
                      >
                        {curr}mA
                      </text>
                    </g>
                  );
                })}

                {/* Knee reference vertical line at 0.68V */}
                <line
                  x1={padding + (0.68 / maxV) * (width - 2 * padding)}
                  y1={padding}
                  x2={padding + (0.68 / maxV) * (width - 2 * padding)}
                  y2={height - padding}
                  stroke="#3B82F6"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                />

                {/* Plot line through recorded points */}
                {readings.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#26B9D1"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                )}

                {/* Points */}
                {readings.map((r, i) => {
                  const cx = padding + (r.vf / maxV) * (width - 2 * padding);
                  const cy = height - padding - (r.if_ma / maxI) * (height - 2 * padding);
                  return (
                    <circle
                      key={i}
                      cx={cx}
                      cy={cy}
                      r="3.5"
                      fill="#38BDF8"
                      stroke="#0A1224"
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* Live Position Marker */}
                <circle
                  cx={liveX}
                  cy={liveY}
                  r="5"
                  fill="#F43F5E"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  className="animate-pulse"
                />

                {/* Axis Labels */}
                <text
                  x={width / 2}
                  y={height - 6}
                  fill="#94A3B8"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  Forward Voltage Vf (Volts)
                </text>
                <text
                  x={12}
                  y={height / 2}
                  fill="#94A3B8"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="sans-serif"
                  transform={`rotate(-90 12 ${height / 2})`}
                >
                  Current If (mA)
                </text>
              </svg>
            </div>
          </div>

          {/* Table summary of logged data */}
          <div className="mt-3 max-h-32 overflow-y-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="border-b border-[#1E2C4D] text-[#64748B]">
                  <th className="py-1">Pt</th>
                  <th className="py-1">Vf (V)</th>
                  <th className="py-1">If (mA)</th>
                  <th className="py-1">rd (Ω)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2644]">
                {readings.map((r, idx) => (
                  <tr key={r.id} className="text-[#CBD5E1]">
                    <td className="py-1">{idx + 1}</td>
                    <td className="py-1 text-[#26B9D1]">{r.vf.toFixed(2)}</td>
                    <td className="py-1 text-[#38BDF8]">{r.if_ma.toFixed(2)}</td>
                    <td className="py-1">{r.rd ? `${r.rd} Ω` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
