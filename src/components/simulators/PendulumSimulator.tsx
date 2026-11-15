import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Plus, Activity, Clock, Sliders } from 'lucide-react';

interface PendulumTrial {
  id: number;
  length_cm: number;
  time_20s: number;
  period_s: number;
  t_sq: number;
  calculated_g: number;
}

export const PendulumSimulator: React.FC<{ onLogData?: (data: any) => void }> = ({ onLogData }) => {
  // Configurable Parameters
  const [lengthCm, setLengthCm] = useState<number>(80);
  const [initialAngleDeg, setInitialAngleDeg] = useState<number>(6); // Small angle (< 10 deg)
  const [isRunning, setIsRunning] = useState<boolean>(false);

  // Digital Stopwatch Timer state
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);
  const [oscillationsCount, setOscillationsCount] = useState<number>(0);

  // Recorded experimental trials
  const [trials, setTrials] = useState<PendulumTrial[]>([
    { id: 1, length_cm: 60, time_20s: 31.08, period_s: 1.554, t_sq: 2.415, calculated_g: 9.808 },
    { id: 2, length_cm: 70, time_20s: 33.56, period_s: 1.678, t_sq: 2.816, calculated_g: 9.814 },
    { id: 3, length_cm: 80, time_20s: 35.88, period_s: 1.794, t_sq: 3.218, calculated_g: 9.813 },
  ]);

  // Physics animation variables
  const [currentAngle, setCurrentAngle] = useState<number>(0);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Theoretical physics
  const g_earth = 9.80665;
  const lengthMeters = lengthCm / 100;
  const theoreticalPeriod = 2 * Math.PI * Math.sqrt(lengthMeters / g_earth);

  // Animation Loop for swinging bob
  useEffect(() => {
    if (!isRunning) {
      setCurrentAngle(0);
      return;
    }

    startTimeRef.current = performance.now();
    const omega = Math.sqrt(g_earth / lengthMeters);
    const theta0Rad = (initialAngleDeg * Math.PI) / 180;

    const animate = (now: number) => {
      const elapsedSeconds = (now - startTimeRef.current) / 1000;
      // Small angle SHM with minor damping
      const damping = Math.exp(-0.012 * elapsedSeconds);
      const angle = theta0Rad * Math.cos(omega * elapsedSeconds) * damping;
      setCurrentAngle(angle);

      // Track rough full cycles
      const cycles = Math.floor(elapsedSeconds / theoreticalPeriod);
      setOscillationsCount(cycles);

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isRunning, lengthCm, initialAngleDeg, theoreticalPeriod]);

  // Stopwatch timer interval
  useEffect(() => {
    let interval: any = null;
    if (isTimerActive) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => +(prev + 0.05).toFixed(2));
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  const handleStartBoth = () => {
    setIsRunning(true);
    setIsTimerActive(true);
  };

  const handlePause = () => {
    setIsRunning(false);
    setIsTimerActive(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsTimerActive(false);
    setTimerSeconds(0);
    setOscillationsCount(0);
    setCurrentAngle(0);
  };

  const handleLogTrial = () => {
    // If timer ran for at least 5 seconds
    const timeUsed = timerSeconds > 0 ? timerSeconds : Number((20 * theoreticalPeriod).toFixed(2));
    const periodCalc = timeUsed / 20;
    const tSq = Number((periodCalc * periodCalc).toFixed(3));
    // g = 4 * pi^2 * L / T^2
    const calcG = Number(((4 * Math.PI * Math.PI * lengthMeters) / tSq).toFixed(3));

    const newTrial: PendulumTrial = {
      id: Date.now(),
      length_cm: lengthCm,
      time_20s: timeUsed,
      period_s: Number(periodCalc.toFixed(3)),
      t_sq: tSq,
      calculated_g: calcG,
    };

    const updated = [...trials, newTrial];
    setTrials(updated);
    if (onLogData) onLogData(updated);
  };

  // Graphical Bob calculation
  const pivotX = 140;
  const pivotY = 30;
  const visualLength = 110 + (lengthCm / 120) * 80;
  const bobX = pivotX + visualLength * Math.sin(currentAngle);
  const bobY = pivotY + visualLength * Math.cos(currentAngle);

  return (
    <div className="bg-[#101B35] text-white rounded-xl p-5 border border-[#25304B] shadow-lg">
      <div className="flex flex-wrap items-center justify-between pb-4 border-b border-[#25304B] gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#3155D9] flex items-center justify-center text-white shadow-sm">
            <Activity className="w-4 h-4 text-[#26B9D1]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-base text-white flex items-center gap-2">
              Virtual Simple Pendulum Dynamics Apparatus
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#168A62]/30 text-[#4ECCA3] border border-[#168A62]/40">
                Physics Simulation
              </span>
            </h3>
            <p className="text-xs text-[#A0AEC0]">
              T = 2π√(L/g) • Small Angle SHM • Stopwatch Timing & Gravitational Field Extraction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-2.5 py-1.5 text-xs text-[#CBD5E1] hover:text-white bg-[#1A2644] hover:bg-[#25355E] border border-[#25304B] rounded transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Apparatus
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mt-5">
        {/* Left: Interactive Canvas / SVG Pendulum View */}
        <div className="lg:col-span-5 bg-[#070D1B] border border-[#1E2C4D] rounded-lg p-3 flex flex-col items-center justify-center relative min-h-[300px]">
          <div className="absolute top-3 left-3 text-[10px] font-mono text-[#64748B]">
            Length: {lengthCm} cm | θ: {initialAngleDeg}°
          </div>

          <svg width="280" height="260" viewBox="0 0 280 260" className="select-none">
            {/* Rigid Suspension Clamp */}
            <rect x="90" y="15" width="100" height="12" fill="#334155" rx="3" />
            <circle cx={pivotX} cy={pivotY} r="4" fill="#94A3B8" />

            {/* Angular scale guide arc */}
            <path
              d="M 80 230 A 200 200 0 0 0 200 230"
              fill="none"
              stroke="#1E293B"
              strokeDasharray="3,3"
            />
            {/* Equilibrium Mean Position Line */}
            <line
              x1={pivotX}
              y1={pivotY}
              x2={pivotX}
              y2={pivotY + visualLength + 15}
              stroke="#1E293B"
              strokeDasharray="2,2"
            />

            {/* Inextensible Thread */}
            <line
              x1={pivotX}
              y1={pivotY}
              x2={bobX}
              y2={bobY}
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />

            {/* Brass Bob */}
            <defs>
              <radialGradient id="bobShine" cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#FDE047" />
                <stop offset="60%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#78350F" />
              </radialGradient>
            </defs>
            <circle
              cx={bobX}
              cy={bobY}
              r="14"
              fill="url(#bobShine)"
              stroke="#B45309"
              strokeWidth="1.5"
            />
            <circle cx={bobX - 3} cy={bobY - 4} r="3" fill="#FEF08A" opacity="0.8" />
          </svg>

          {/* Controls Below Stage */}
          <div className="flex items-center gap-2 mt-2 w-full max-w-xs">
            {!isRunning ? (
              <button
                type="button"
                onClick={handleStartBoth}
                className="flex-1 py-1.5 px-3 bg-[#3155D9] hover:bg-[#2544B8] text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 shadow"
              >
                <Play className="w-3.5 h-3.5" />
                Release Bob & Start Timer
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="flex-1 py-1.5 px-3 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-semibold rounded flex items-center justify-center gap-1.5 shadow"
              >
                <Pause className="w-3.5 h-3.5" />
                Stop Oscillation
              </button>
            )}
          </div>
        </div>

        {/* Right: Telemetry & Parameter Inputs */}
        <div className="lg:col-span-7 space-y-4">
          {/* Dual Precision HUD */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0A1224] border border-[#1E2C4D] rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#68758A]">
                Stopwatch
              </div>
              <div className="font-mono text-xl font-bold text-[#26B9D1] mt-1">
                {timerSeconds.toFixed(2)}s
              </div>
              <div className="text-[10px] text-[#A0AEC0]">Elapsed Time</div>
            </div>

            <div className="bg-[#0A1224] border border-[#1E2C4D] rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#68758A]">
                Theoretical T
              </div>
              <div className="font-mono text-xl font-bold text-[#38BDF8] mt-1">
                {theoreticalPeriod.toFixed(3)}s
              </div>
              <div className="text-[10px] text-[#A0AEC0]">1 Complete Cycle</div>
            </div>

            <div className="bg-[#0A1224] border border-[#1E2C4D] rounded-lg p-3 text-center">
              <div className="text-[10px] uppercase font-mono tracking-wider text-[#68758A]">
                Local Gravity
              </div>
              <div className="font-mono text-xl font-bold text-[#34D399] mt-1">
                9.81
                <span className="text-xs text-[#68758A] ml-0.5">m/s²</span>
              </div>
              <div className="text-[10px] text-[#A0AEC0]">Target Reference</div>
            </div>
          </div>

          {/* Length & Angle Slider Controls */}
          <div className="bg-[#0E172E] border border-[#1E2C4D] rounded-lg p-4 space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-[#E2E8F0] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#3155D9]" />
                  Pendulum Length (L)
                </label>
                <span className="font-mono text-xs font-bold text-[#38BDF8] bg-[#1E293B] px-2 py-0.5 rounded">
                  {lengthCm} cm
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="120"
                step="5"
                value={lengthCm}
                onChange={(e) => {
                  setLengthCm(parseInt(e.target.value));
                  handleReset();
                }}
                className="w-full h-2 bg-[#1E293B] rounded-lg appearance-none cursor-pointer accent-[#3155D9]"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                <span>50 cm</span>
                <span>80 cm</span>
                <span>120 cm</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1E2C4D]">
              <span className="text-xs text-[#94A3B8]">
                Cycles completed: <strong className="text-white font-mono">{oscillationsCount}</strong>
              </span>
              <button
                type="button"
                onClick={handleLogTrial}
                className="px-3 py-1.5 bg-[#3155D9] hover:bg-[#2544B8] text-white text-xs font-semibold rounded flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Observation Row
              </button>
            </div>
          </div>

          {/* Observations Table */}
          <div className="bg-[#0A1224] border border-[#1E2C4D] rounded-lg p-3 max-h-36 overflow-y-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="border-b border-[#1E2C4D] text-[#64748B]">
                  <th className="py-1">#</th>
                  <th className="py-1">L (cm)</th>
                  <th className="py-1">t for 20 osc (s)</th>
                  <th className="py-1">T (s)</th>
                  <th className="py-1">T² (s²)</th>
                  <th className="py-1">Deduc. g (m/s²)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A2644]">
                {trials.map((t, idx) => (
                  <tr key={t.id} className="text-[#CBD5E1]">
                    <td className="py-1">{idx + 1}</td>
                    <td className="py-1 text-[#38BDF8]">{t.length_cm}</td>
                    <td className="py-1">{t.time_20s.toFixed(2)}</td>
                    <td className="py-1">{t.period_s.toFixed(3)}</td>
                    <td className="py-1 text-[#26B9D1]">{t.t_sq.toFixed(3)}</td>
                    <td className="py-1 text-[#34D399] font-bold">{t.calculated_g.toFixed(3)}</td>
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
