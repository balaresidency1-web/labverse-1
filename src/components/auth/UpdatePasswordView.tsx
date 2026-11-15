import React, { useState, useEffect } from 'react';
import { getSupabaseClient } from '../../services/supabaseClient';
import { validatePasswordStrength, validatePasswordConfirmation } from '../../utils/passwordRules';
import {
  KeyRound,
  Shield,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Lock,
  Loader2,
  LogIn,
} from 'lucide-react';

interface UpdatePasswordViewProps {
  onComplete?: () => void;
  onPasswordUpdated?: () => void;
}

export const UpdatePasswordView: React.FC<UpdatePasswordViewProps> = ({ onComplete, onPasswordUpdated }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);

  // Real-time strength calculation
  const strength = validatePasswordStrength(newPassword);
  const matchResult = validatePasswordConfirmation(newPassword, confirmPassword);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setCheckingSession(false);
      return;
    }

    // 1. Check current session & tokens from URL hash or search params
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hasRecoveryHint =
      hash.includes('type=recovery') ||
      hash.includes('access_token') ||
      search.includes('code=');

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsRecoverySession(true);
        setUserEmail(session.user.email || null);
      } else if (hasRecoveryHint) {
        // Tokens in URL are being processed by Supabase client
        setIsRecoverySession(true);
      }
      setCheckingSession(false);
    });

    // 2. Listen for Supabase Auth PASSWORD_RECOVERY event
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        event === 'PASSWORD_RECOVERY' ||
        (event === 'SIGNED_IN' && (hasRecoveryHint || hash.includes('type=recovery')))
      ) {
        setIsRecoverySession(true);
        if (session?.user?.email) {
          setUserEmail(session.user.email);
        }
        setCheckingSession(false);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  // Handle countdown for automatic redirect
  useEffect(() => {
    if (redirectCountdown === null) return;
    if (redirectCountdown <= 0) {
      handleProceedToLogin();
      return;
    }
    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [redirectCountdown]);

  const handleProceedToLogin = () => {
    // Clean URL hash and query parameters
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/');
    }
    (onPasswordUpdated || onComplete)?.();
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate strength
    if (!strength.valid) {
      setError('Please fulfill all password security requirements before proceeding.');
      return;
    }

    // Validate confirmation match
    if (!matchResult.matches) {
      setError(matchResult.error || 'Passwords do not match.');
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setError('Supabase client is not configured.');
      return;
    }

    setLoading(true);

    try {
      // Call Supabase auth.updateUser without exposing or persisting password elsewhere
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (data?.user) {
        const { data: activationRes, error: activationErr } = await supabase.rpc(
          'activate_own_invited_profile'
        );
        if (activationErr || (activationRes && activationRes.success === false)) {
          throw new Error(
            activationErr?.message ||
              activationRes?.error ||
              'Failed to activate MVIT staff profile.'
          );
        }
        // Password update and profile activation confirmed by Supabase
        setSuccess(true);
        setRedirectCountdown(3);
      } else {
        throw new Error('Supabase did not return confirmed user data.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try requesting a new recovery link.');
    } finally {
      setLoading(false);
    }
  };

  // Strength bar color indicator
  const getStrengthBarColor = () => {
    if (strength.score <= 1) return 'bg-red-500';
    if (strength.score === 2) return 'bg-orange-500';
    if (strength.score === 3) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E7DDD0] shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-[#49372E] text-white text-center">
          <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center shadow-md mb-3 bg-[#A66A43] text-white">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="font-heading font-bold text-lg text-white">
            Set New Password
          </h2>
          <p className="text-xs text-[#E7DDD0] mt-1 max-w-xs mx-auto">
            Establish a strong password to activate your MVIT LABVERSE staff account.
          </p>
          {userEmail && (
            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-mono text-[#F5F0E8]">
              <Lock className="w-3 h-3 text-[#F5F0E8]" />
              <span>{userEmail}</span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6">
          {checkingSession ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#3155D9] animate-spin" />
              <p className="text-xs text-[#64748B]">
                Verifying password recovery session credentials...
              </p>
            </div>
          ) : !isRecoverySession ? (
            /* Protected Route Guard: No active recovery session */
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center mx-auto text-[#DC2626]">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[#101B35]">
                  Access Restricted
                </h3>
                <p className="text-xs text-[#64748B] max-w-sm mx-auto leading-relaxed">
                  No active password recovery session detected. For your account security, password resets must be initiated via the verification link sent to your registered email address.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProceedToLogin}
                  className="w-full py-2.5 px-4 bg-[#3155D9] hover:bg-[#2544B8] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </button>
              </div>
            </div>
          ) : success ? (
            /* Success confirmation view */
            <div className="space-y-4 text-center py-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-center mx-auto text-[#168A62]">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[#101B35]">
                  Password Successfully Updated
                </h3>
                <p className="text-xs text-[#168A62] max-w-sm mx-auto leading-relaxed font-medium">
                  Your new credentials have been confirmed by Supabase Authentication. You can now sign in with your updated password.
                </p>
                {redirectCountdown !== null && (
                  <p className="text-[11px] text-[#64748B] pt-1">
                    Redirecting to login in {redirectCountdown}s...
                  </p>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleProceedToLogin}
                  className="w-full py-2.5 px-4 bg-[#168A62] hover:bg-[#127050] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Password Reset Form */
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {error && (
                <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#D64A55] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {/* New Password Input */}
              <div>
                <label className="block text-xs font-semibold text-[#202A3A] mb-1.5">
                  New Password:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new strong password..."
                    className="w-full pl-9 pr-10 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#3155D9] focus:ring-2 focus:ring-[#3155D9]/20 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#64748B]"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#64748B]">Password Strength:</span>
                      <span
                        className={`font-semibold ${
                          strength.strengthLabel === 'Strong'
                            ? 'text-emerald-600'
                            : strength.strengthLabel === 'Medium'
                            ? 'text-amber-600'
                            : 'text-red-500'
                        }`}
                      >
                        {strength.strengthLabel}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden flex gap-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`flex-1 h-full rounded-full transition-all duration-300 ${
                            strength.score >= step ? getStrengthBarColor() : 'bg-transparent'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-xs font-semibold text-[#202A3A] mb-1.5">
                  Confirm New Password:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password..."
                    className="w-full pl-9 pr-10 py-2 text-xs border border-[#CBD5E1] rounded-lg focus:outline-none focus:border-[#3155D9] focus:ring-2 focus:ring-[#3155D9]/20 font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#64748B]"
                    title={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <div className="mt-1 text-[11px] flex items-center gap-1.5">
                    {matchResult.matches ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Passwords match
                      </span>
                    ) : (
                      <span className="text-red-500 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Passwords do not match
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Requirements Checklist */}
              <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-[11px] space-y-1.5">
                <span className="font-semibold text-[#101B35] block">
                  Security Requirements:
                </span>
                <div className="grid grid-cols-1 gap-1">
                  {strength.requirements.map((req) => (
                    <div
                      key={req.id}
                      className={`flex items-center gap-1.5 transition-colors ${
                        req.met ? 'text-emerald-700 font-medium' : 'text-[#64748B]'
                      }`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 ${
                          req.met ? 'text-emerald-600' : 'text-slate-300'
                        }`}
                      />
                      <span>{req.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !strength.valid || !matchResult.matches}
                className="w-full py-2.5 px-4 bg-[#3155D9] hover:bg-[#2544B8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Password in Supabase...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Confirm & Update Password</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleProceedToLogin}
                  className="text-xs text-[#68758A] hover:text-[#101B35] hover:underline"
                >
                  Cancel and return to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
