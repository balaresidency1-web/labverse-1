import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Database, ShieldCheck, Copy, Check, HardDrive, CheckCircle2 } from 'lucide-react';

interface SupabaseInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseInfoModal: React.FC<SupabaseInfoModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copyingFull, setCopyingFull] = useState(false);
  const [status, setStatus] = useState<{
    supabaseUrl: string | null;
    hasAnonKey: boolean;
    hasServiceRole: boolean;
    storageBuckets: string[];
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/admin/supabase-status')
        .then((res) => res.json())
        .then((data) => setStatus(data))
        .catch(() => {
          setStatus({
            supabaseUrl: null,
            hasAnonKey: false,
            hasServiceRole: false,
            storageBuckets: ['manuals', 'diagrams'],
          });
        });
    }
  }, [isOpen]);

  const isLiveConfigured = Boolean(status?.supabaseUrl && status?.hasAnonKey);

  const handleCopyFullMigration = async () => {
    try {
      setCopyingFull(true);
      const res = await fetch('/api/admin/migration-sql');
      const sql = await res.text();
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy migration SQL:', err);
    } finally {
      setCopyingFull(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="MVIT Backend Architecture & Supabase Status"
      subtitle="PostgreSQL relational database with Public Read + Staff RLS & Cloud Storage"
      maxWidth="xl"
    >
      <div className="space-y-4">
        <div
          className={`p-3.5 rounded-xl border text-xs space-y-2 ${
            isLiveConfigured
              ? 'bg-[#EBF5EE] border-[#C6E3D0] text-[#2E6F4E]'
              : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
          }`}
        >
          <div className="font-semibold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              <span>
                {isLiveConfigured
                  ? 'Supabase Cloud Integration Active'
                  : 'Running in Local Demo Mode (Supabase Env Vars Optional)'}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/80">
              <CheckCircle2 className="w-3 h-3" />
              {isLiveConfigured ? 'Live Credentials Active' : 'Local Demo Active'}
            </span>
          </div>
          <div className="text-[11px] font-mono bg-white/80 p-2 rounded border border-black/10 space-y-1 text-[#252521]">
            <div>Project Endpoint: {status?.supabaseUrl || 'Not configured (VITE_SUPABASE_URL)'}</div>
            <div>Browser Client (Anon Key): {status?.hasAnonKey ? 'Configured' : 'Local fallback'}</div>
            <div>Service Role Key: {status?.hasServiceRole ? 'Configured on Server' : 'Local fallback'}</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#FAF6F0] border border-[#E7DDD0] text-xs space-y-2">
          <div className="font-semibold text-[#252521] flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-[#A66A43]" />
              <span>Storage Buckets & Local Fallback</span>
            </div>
            <span className="text-[10px] font-mono text-[#6E675F] font-semibold">
              {status?.storageBuckets.length ?? 2} Buckets
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-white border border-[#E7DDD0] flex items-center justify-between">
              <span className="font-mono font-medium text-[#252521]">bucket: manuals</span>
              <span className="text-[10px] text-[#2E6F4E] bg-[#EBF5EE] px-1.5 py-0.5 rounded">
                {isLiveConfigured ? 'Cloud Ready' : 'IndexedDB Ready'}
              </span>
            </div>
            <div className="p-2 rounded bg-white border border-[#E7DDD0] flex items-center justify-between">
              <span className="font-mono font-medium text-[#252521]">bucket: diagrams</span>
              <span className="text-[10px] text-[#2E6F4E] bg-[#EBF5EE] px-1.5 py-0.5 rounded">
                {isLiveConfigured ? 'Cloud Ready' : 'Local Ready'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-[#252521]">MVIT Migration SQL:</span>
          <button
            type="button"
            onClick={handleCopyFullMigration}
            disabled={copyingFull}
            className="text-[#49372E] hover:text-[#A66A43] flex items-center gap-1 font-semibold text-xs px-2.5 py-1 bg-[#FAF6F0] border border-[#D8CBB9] rounded-lg cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#2E6F4E]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Migration SQL!' : 'Copy MVIT Migration SQL'}</span>
          </button>
        </div>

        <div className="p-3 bg-[#FAF6F0] rounded-lg border border-[#E7DDD0] text-xs text-[#49372E] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#A66A43] shrink-0" />
          <span>Public read-only access for published MVIT resources; write access restricted to MVIT College Admin & assigned Lab Assistants via PostgreSQL RLS.</span>
        </div>
      </div>
    </Modal>
  );
};
