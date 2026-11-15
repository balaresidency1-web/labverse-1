import React from 'react';
import { Building2, FlaskConical, Monitor, MapPin, ArrowRight, ShieldAlert } from 'lucide-react';
import { useLabverse } from '../../context/LabverseContext';
import { Lab } from '../../types';

interface LaboratorySelectionViewProps {
  onLabSelected?: () => void;
}

export const LaboratorySelectionView: React.FC<LaboratorySelectionViewProps> = ({
  onLabSelected,
}) => {
  const { institution, currentUser, accessibleLabs, setSelectedLabId, selectedLabId } = useLabverse();

  if (accessibleLabs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#FDE68A] p-8 max-w-lg mx-auto text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-[#FFFBEB] text-[#B45309] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="font-heading font-bold text-lg text-[#252521]">
          No Laboratories Assigned Yet
        </h2>
        <p className="text-xs text-[#6E675F] leading-relaxed">
          Your Lab Assistant account (<strong>{currentUser?.email}</strong>) currently has no MVIT laboratory assignments. Please ask the MVIT College Administrator to assign you to a laboratory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-[#E7DDD0] p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A66A43]">
            <Building2 className="w-4 h-4" />
            <span>{institution.name} ({institution.code})</span>
          </div>
          <h1 className="font-heading font-bold text-xl text-[#252521] mt-1">
            My Assigned Laboratories
          </h1>
          <p className="text-xs text-[#6E675F]">
            Select an assigned MVIT laboratory to manage practical subjects, syllabi, experiments, manuals, or PC Lab workstations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {accessibleLabs.map((lab: Lab) => {
          const isCurrent = selectedLabId === lab.id;
          const isPcLab = lab.lab_type === 'pc_lab';
          return (
            <div
              key={lab.id}
              className={`bg-white rounded-2xl border p-5 space-y-4 shadow-sm ${
                isCurrent ? 'border-[#A66A43] ring-1 ring-[#A66A43]' : 'border-[#E7DDD0]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-[#FAF6F0] border border-[#D8CBB9] text-[#49372E]">
                      {lab.lab_code}
                    </span>
                    <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F5F0E8] text-[#A66A43]">
                      {isPcLab ? 'PC Lab' : 'Practical Lab'}
                    </span>
                  </div>
                  <h2 className="font-heading font-bold text-base text-[#252521] mt-2">{lab.name}</h2>
                  <p className="text-xs text-[#6E675F]">{lab.department_name}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-[#49372E] text-white flex items-center justify-center shrink-0">
                  {isPcLab ? <Monitor className="w-4 h-4" /> : <FlaskConical className="w-4 h-4" />}
                </div>
              </div>

              <div className="text-xs text-[#6E675F] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#A66A43]" />
                <span>{lab.building}, Room {lab.room_number}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedLabId(lab.id);
                  onLabSelected?.();
                }}
                className="w-full py-2 px-4 rounded-xl bg-[#49372E] hover:bg-[#A66A43] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{isCurrent ? 'Currently Selected' : 'Open Laboratory Workspace'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
