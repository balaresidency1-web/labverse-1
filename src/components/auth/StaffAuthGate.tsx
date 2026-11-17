import React, { useState } from 'react';
import { Role } from '../../types';
import { getSupabaseClient } from '../../services/supabaseClient';
import { labverseRepository } from '../../services/labverseRepository';
import { useLabverse } from '../../context/LabverseContext';
import { resolveDemoSignInProfile } from '../../utils/labRules';
import { isActiveStaffStatus } from '../../utils/staffAuthRules';
import {
  Lock,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  Building2,
  Wrench,
  Mail,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Send,
  Sparkles,
} from 'lucide-react';

interface StaffAuthGateProps {
  onBackToPublic: () => void;
  onAuthenticated?: () => void;
}

export const StaffAuthGate: React.FC<StaffAuthGateProps> = ({
  onBackToPublic,
  onAuthenticated,
}) => {
  const { institution, isSupabaseActive, allProfiles, authenticateDemoUser } = useLabverse();

  const [selectedRole, setSelectedRole] = useState<Role>('college_admin');
  const [authView, setAuthView] = useState<'login' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const staffProfiles = allProfiles.filter(
    (p) => p.role === 'college_admin' || p.role === 'lab_assistant'
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setError('Please enter your MVIT staff email address.');
      return;
    }

    if (isSupabaseActive) {
      if (!password) {
        setError('Please enter your password.');
        return;
      }
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase client is not configured.');
        return;
      }

      setLoading(true);
      try {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          throw new Error(signInError.message);
        }

        if (data?.user) {
          const { data: profileData, error: profErr } = await supabase
            .from('profiles')
            .select('role, status, institution_id')
            .eq('id', data.user.id)
            .single();

          if (profErr || !profileData) {
            await supabase.auth.signOut();
            throw new Error('Staff profile not found in MVIT records.');
          }

          if (profileData.status === 'suspended') {
            await supabase.auth.signOut();
            throw new Error('Your account has been suspended by MVIT College Administration.');
          }

          if (!isActiveStaffStatus(profileData.status)) {
            await supabase.auth.signOut();
            throw new Error(
              'Your MVIT staff invitation is pending activation. Use the invitation email link to set your password before signing in.'
            );
          }

          if (profileData.role !== 'college_admin' && profileData.role !== 'lab_assistant') {
            await supabase.auth.signOut();
            throw new Error('Only authorized MVIT College Admin and Lab Assistant accounts may log in.');
          }

          let expectedInstId =
            institution.id && institution.id !== 'inst-mvit' ? institution.id : '';
          let isInstActive = institution.active !== false;
          if (!expectedInstId) {
            const instRes = await labverseRepository.getInstitutionByCode('MVIT');
            expectedInstId = instRes.data?.id || '';
            if (instRes.data) {
              isInstActive = instRes.data.active !== false;
            }
          }

          if (!isInstActive) {
            await supabase.auth.signOut();
            throw new Error('Manakula Vinayagar Institute of Technology is currently inactive.');
          }

          if (!expectedInstId || profileData.institution_id !== expectedInstId) {
            await supabase.auth.signOut();
            throw new Error(
              'Your account does not belong to Manakula Vinayagar Institute of Technology.'
            );
          }

          onAuthenticated?.();
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed.');
      } finally {
        setLoading(false);
      }
    } else {
      // Demo Local Mode
      setLoading(true);
      const result = resolveDemoSignInProfile(staffProfiles, email);
      setLoading(false);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      authenticateDemoUser(result.profile.role, result.profile.id);
      onAuthenticated?.();
    }
  };

  const handleQuickDemoSignIn = (role: Role, profileId?: string) => {
    setError(null);
    const matched = staffProfiles.find(
      (p) => (profileId ? p.id === profileId : p.role === role) && p.status !== 'suspended'
    );
    if (!matched) {
      setError(`No active ${role === 'college_admin' ? 'College Admin' : 'Lab Assistant'} account found.`);
      return;
    }
    authenticateDemoUser(matched.role, matched.id);
    onAuthenticated?.();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!resetEmail.trim()) {
      setError('Please enter your registered MVIT staff email address.');
      return;
    }

    if (isSupabaseActive) {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setError('Supabase authentication client is unavailable.');
        return;
      }
      setLoading(true);
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(
          resetEmail.trim(),
          { redirectTo: `${window.location.origin}/update-password` }
        );
        if (resetError) throw new Error(resetError.message);
        setSuccessMsg(`Password reset instructions sent to ${resetEmail.trim()}.`);
      } catch (err: any) {
        setError(err.message || 'Failed to dispatch password reset email.');
      } finally {
        setLoading(false);
      }
    } else {
      setSuccessMsg(
        `Demo Local Mode: Password reset instructions simulated for ${resetEmail.trim()}.`
      );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E7DDD0] shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-[#49372E] text-white">
        <div className="flex items-center justify-between gap-2 mb-3">
          <button
            type="button"
            onClick={onBackToPublic}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E7DDD0] hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Public Learning Portal</span>
          </button>
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-[#F5F0E8]">
            MVIT Staff Portal
          </span>
        </div>

        <h2 className="font-heading font-bold text-xl text-white">
          {authView === 'login' ? 'Staff & Admin Login' : 'Reset Staff Password'}
        </h2>
        <p className="text-xs text-[#E7DDD0] mt-1">
          Authorized access exclusively for MVIT College Admin and Lab Assistants.
        </p>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        {authView === 'login' ? (
          <>
            {/* Role Mode Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F5F0E8] border border-[#E7DDD0]">
              <button
                type="button"
                onClick={() => setSelectedRole('college_admin')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  selectedRole === 'college_admin'
                    ? 'bg-[#49372E] text-white shadow-2xs'
                    : 'text-[#49372E] hover:bg-[#E7DDD0]/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>College Admin</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedRole('lab_assistant')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  selectedRole === 'lab_assistant'
                    ? 'bg-[#A66A43] text-white shadow-2xs'
                    : 'text-[#49372E] hover:bg-[#E7DDD0]/60'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Lab Assistant</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#252521] mb-1.5">
                  MVIT Staff Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#A66A43] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      selectedRole === 'college_admin'
                        ? 'principal@mvit.edu.in'
                        : 'murugan.lab@mvit.edu.in'
                    }
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#D6C7B4] rounded-lg focus:outline-none focus:border-[#A66A43]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[#252521]">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setError(null);
                      setSuccessMsg(null);
                      setAuthView('forgot_password');
                    }}
                    className="text-[11px] font-semibold text-[#A66A43] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#A66A43] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isSupabaseActive ? 'Enter your password' : 'Demo mode: any password'}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#D6C7B4] rounded-lg focus:outline-none focus:border-[#A66A43]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#A66A43] hover:bg-[#8E5734] disabled:opacity-60 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Sign In to Staff Portal</span>
                  </>
                )}
              </button>
            </form>

            {/* Demo Quick Access (strictly omitted when Supabase Live auth is configured) */}
            {!isSupabaseActive && (
              <div className="pt-4 border-t border-[#E7DDD0] space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#5C534A]">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#A66A43]" />
                    <span>Quick Demo Access (Local Sandbox)</span>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] font-mono text-[10px]">
                    DEMO MODE
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickDemoSignIn('college_admin', 'user-mvit-admin')}
                    className="p-2.5 rounded-xl bg-[#F5F0E8] hover:bg-[#E7DDD0] border border-[#D6C7B4] text-left transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-bold text-[#252521]">College Admin</p>
                    <p className="text-[10px] text-[#5C534A] truncate">Dr. S. Malarkkan</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoSignIn('lab_assistant', 'user-mvit-labasst')}
                    className="p-2.5 rounded-xl bg-[#F5F0E8] hover:bg-[#E7DDD0] border border-[#D6C7B4] text-left transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-bold text-[#252521]">Lab Assistant</p>
                    <p className="text-[10px] text-[#5C534A] truncate">V. Murugan (EDL/PSL)</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDemoSignIn('lab_assistant', 'user-mvit-pclab-asst')}
                    className="p-2.5 rounded-xl bg-[#F5F0E8] hover:bg-[#E7DDD0] border border-[#D6C7B4] text-left transition-colors cursor-pointer"
                  >
                    <p className="text-xs font-bold text-[#252521]">PC Lab Assistant</p>
                    <p className="text-[10px] text-[#5C534A] truncate">K. Aravind (COMP-PC-01)</p>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#252521] mb-1.5">
                Registered Staff Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#A66A43] absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@mvit.edu.in"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-[#D6C7B4] rounded-lg focus:outline-none focus:border-[#A66A43]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#A66A43] hover:bg-[#8E5734] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send Password Reset Email</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setSuccessMsg(null);
                setAuthView('login');
              }}
              className="w-full py-2 text-xs font-semibold text-[#49372E] hover:underline cursor-pointer"
            >
              Back to Login
            </button>
          </form>
        )}

        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-[#5C534A]">
          <ShieldCheck className="w-3.5 h-3.5 text-[#A66A43]" />
          <span>Public learning resources remain open without login.</span>
        </div>
      </div>
    </div>
  );
};
