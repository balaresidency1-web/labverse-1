import React from 'react';
import { FlaskConical, ShieldCheck } from 'lucide-react';

interface PublicLayoutProps {
  children: React.ReactNode;
}

/**
 * PublicLayout: Clean, standalone layout for staff authentication & password recovery routes.
 */
export const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#F5F0E8] flex flex-col justify-between font-sans text-[#252521] selection:bg-[#A66A43] selection:text-white">
      <header className="pt-8 pb-4 px-4 text-center">
        <div className="inline-flex items-center justify-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-2xl bg-[#49372E] text-white flex items-center justify-center shadow-sm">
            <FlaskConical className="w-5 h-5 text-[#F5F0E8]" />
          </div>
          <div className="text-left">
            <span className="font-heading font-extrabold text-xl sm:text-2xl tracking-tight text-[#252521] block leading-none">
              LABVERSE
            </span>
            <span className="text-[11px] font-medium text-[#A66A43]">
              Smart Laboratory Learning & Management Platform
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="py-5 px-4 text-center border-t border-[#E7DDD0] bg-white/60">
        <div className="max-w-md mx-auto space-y-1 text-xs text-[#5C534A]">
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#49372E]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#A66A43]" />
            <span>Authorized Staff Access • Learn. Explore. Experiment.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
