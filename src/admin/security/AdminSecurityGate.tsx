import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle2,
  Smartphone,
  Check,
} from 'lucide-react';
import { useAuth } from '../../supabase/AuthContext';

interface AdminSecurityGateProps {
  isLocked: boolean;
  onUnlock: () => void;
  onExitToStore: () => void;
}

const MAX_FAILED_ATTEMPTS = 6;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes lockout on brute-force

export const AdminSecurityGate: React.FC<AdminSecurityGateProps> = ({
  isLocked,
  onUnlock,
  onExitToStore,
}) => {
  const { user, signIn, verifyMfaCode } = useAuth();

  const [step, setStep] = useState<'key' | 'mfa'>('key');
  const [terminalKeyInput, setTerminalKeyInput] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(() => {
    const saved = localStorage.getItem('zejesh_sec_failed_attempts');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(() => {
    const saved = localStorage.getItem('zejesh_sec_lockout_until');
    return saved ? parseInt(saved, 10) : null;
  });
  const [remainingLockout, setRemainingLockout] = useState<number>(0);
  const [isVerifying, setIsVerifying] = useState(false);

  // Monitor lockout countdown
  useEffect(() => {
    const interval = setInterval(() => {
      if (lockoutUntil) {
        const remaining = Math.max(0, Math.ceil((lockoutUntil - Date.now()) / 1000));
        setRemainingLockout(remaining);
        if (remaining <= 0) {
          setLockoutUntil(null);
          setFailedAttempts(0);
          localStorage.removeItem('zejesh_sec_lockout_until');
          localStorage.removeItem('zejesh_sec_failed_attempts');
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  if (!isLocked) return null;

  const isLockoutActive = lockoutUntil !== null && lockoutUntil > Date.now();

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const activeEmail = user?.email || '';

  const handleVerifyKey = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLockoutActive || isVerifying) return;

    const password = terminalKeyInput.trim();
    if (!activeEmail) {
      setErrorMsg('No verified administrator session was found. Please sign in again.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter the password for the signed-in administrator account.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      // Re-authenticate against Supabase. There are deliberately no recovery
      // keys or client-side bypasses: the password and MFA are the only path.
      const result = await signIn(activeEmail, password);
      if (result.success && result.isAdmin) {
        setFailedAttempts(0);
        localStorage.removeItem('zejesh_sec_failed_attempts');
        localStorage.removeItem('zejesh_sec_lockout_until');
        localStorage.removeItem('zejesh_admin_terminal_key');

        if (result.requiresMfa) {
          setStep('mfa');
          setErrorMsg('');
        } else {
          setSuccessNotice(true);
          setTimeout(() => {
            setTerminalKeyInput('');
            setSuccessNotice(false);
            onUnlock();
          }, 400);
        }
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        localStorage.setItem('zejesh_sec_failed_attempts', nextAttempts.toString());

        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockTime = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
          setLockoutUntil(lockTime);
          localStorage.setItem('zejesh_sec_lockout_until', lockTime.toString());
          setErrorMsg('Maximum failed clearance attempts exceeded. Console locked for 15 minutes.');
        } else {
          setErrorMsg(
            `Invalid administrator password. (${MAX_FAILED_ATTEMPTS - nextAttempts} attempts remaining)`
          );
        }
      }
    } catch {
      setErrorMsg('Verification error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyMfa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVerifying || !mfaCode.trim()) return;

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const result = await verifyMfaCode(mfaCode.trim());
      if (result.success) {
        setTerminalKeyInput('');
        setMfaCode('');
        setStep('key');
        onUnlock();
      } else {
        setErrorMsg('Invalid verification code. Please try again.');
      }
    } catch {
      setErrorMsg('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="admin-scope admin-gate-page fixed inset-0 z-[120] flex select-none flex-col justify-between bg-white p-4 text-black animate-fadeIn sm:p-8 md:p-10">
      {/* Top security header */}
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between border-b border-black/15 pb-3">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 bg-black" />
          <span className="micro-sm text-black/70">
            CLOFADS · Atelier Security Gate
          </span>
        </div>
        <button
          type="button"
          onClick={onExitToStore}
          className="micro-sm flex cursor-pointer items-center gap-1.5 border border-black/15 px-3 py-1.5 text-black/65 transition-colors hover:border-black hover:text-black"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Return to Storefront</span>
        </button>
      </div>

      {/* Center authentication card */}
      <div className="mx-auto my-auto w-full max-w-md py-6 sm:py-8">
        <div className="relative border border-black/15 border-t-2 border-t-black bg-white p-6 sm:p-8">
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center border border-black/20 bg-[#fafafa] text-black">
            {step === 'mfa' ? (
              <Smartphone className="h-5 w-5" strokeWidth={1.5} />
            ) : (
              <Key className="h-5 w-5" strokeWidth={1.5} />
            )}
          </div>

          <div className="mb-7 text-center">
            <span className="micro-sm mb-2 block text-black/50">
              Administrative Session Verified
            </span>
            <h1 className="mb-2.5 font-display text-[28px] font-light leading-[1.1] text-black">
              {step === 'mfa' ? 'Two-Factor Verification' : 'Confirm Your Password'}
            </h1>
            <p className="mx-auto max-w-xs text-[12.5px] leading-relaxed text-black/60">
              {step === 'mfa'
                ? 'Enter the 6-digit TOTP code from your authenticator application.'
                : 'Re-enter the password for the signed-in administrator account. There is no master key or bypass.'}
            </p>
          </div>

          {/* Confirmed authenticated administrator panel */}
          <div className="mb-5 flex items-center justify-between border border-black/12 bg-[#fafafa] p-3.5 text-small">
            <div className="flex min-w-0 items-center gap-3">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#15803d]" strokeWidth={1.5} />
              <div className="truncate">
                <span className="micro-sm block text-black/45">
                  Operator Session
                </span>
                <span className="mt-0.5 block truncate font-mono text-[12px] text-black">
                  {activeEmail}
                </span>
              </div>
            </div>
            <span className="micro-sm shrink-0 bg-black px-2 py-0.5 text-white">
              Verified
            </span>
          </div>

          {isLockoutActive ? (
            <div className="p-4 border border-dashed border-paper-a18 text-[13px] space-y-3 mb-4">
              <div className="flex items-center gap-2 micro-sm text-paper">
                <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={1.4} />
                <span>Console quarantined</span>
              </div>
              <p className="text-paper-a72 font-light">
                Excessive unauthorized attempts detected. Access suspended.
              </p>
              <div className="font-display text-[40px] font-light text-center py-2 text-paper tabular-nums">
                {formatSeconds(remainingLockout)}
              </div>
            </div>
          ) : step === 'mfa' ? (
            <form onSubmit={handleVerifyMfa} className="space-y-6">
              <div>
                <label className="field-label flex items-center gap-1.5 mb-2">
                  <Key className="w-3.5 h-3.5" strokeWidth={1.4} />
                  <span>Authenticator code (TOTP)</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  maxLength={6}
                  pattern="[0-9]{6}"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  disabled={isVerifying}
                  className="field text-center font-mono text-[24px] tracking-[0.4em] text-paper placeholder:text-paper-a18"
                />
              </div>

              {errorMsg && (
                <div className="p-3 border border-dashed border-paper-a18 micro-sm text-paper flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.4} />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || mfaCode.length !== 6}
                className="btn btn-primary w-full !min-h-[48px] disabled:opacity-40"
              >
                <Lock className="w-3.5 h-3.5" strokeWidth={1.4} />
                <span>{isVerifying ? 'Verifying Code...' : 'Verify & Enter Console'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('key');
                  setErrorMsg('');
                  setMfaCode('');
                }}
                className="btn-text w-full justify-center pt-2"
              >
                ← Back to password
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyKey} className="space-y-6">
              <div>
                <label className="field-label flex items-center gap-1.5 mb-2">
                  <Key className="w-3.5 h-3.5" strokeWidth={1.4} />
                  <span>Administrator password</span>
                </label>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    autoFocus
                    required
                    autoComplete="current-password"
                    value={terminalKeyInput}
                    onChange={(e) => setTerminalKeyInput(e.target.value)}
                    placeholder="Enter your account password..."
                    disabled={isVerifying}
                    className="field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-paper-a45 hover:text-paper cursor-pointer transition-colors"
                    tabIndex={-1}
                    aria-label={showKey ? 'Hide password' : 'Show password'}
                  >
                    {showKey ? <EyeOff className="w-4 h-4" strokeWidth={1.4} /> : <Eye className="w-4 h-4" strokeWidth={1.4} />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 border border-dashed border-paper-a18 micro-sm text-paper flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.4} />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}

              {successNotice && (
                <div className="p-3 border border-paper-a18 micro-sm text-paper flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" strokeWidth={1.4} />
                  <span>Password verified. Opening the console…</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying}
                className="btn btn-primary w-full !min-h-[48px] disabled:opacity-40"
              >
                <Lock className="w-3.5 h-3.5" strokeWidth={1.4} />
                <span>{isVerifying ? 'Verifying…' : 'Unlock Console'}</span>
              </button>

              <div className="pt-2 text-center">
                <span className="micro-sm text-paper-a45 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.4} />
                  <span>Server-verified session · Inactivity autolock active</span>
                </span>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer security badges */}
      <div className="flex flex-wrap items-center justify-between micro-sm text-paper-a45 pt-4 gap-4 border-t border-paper-a18 max-w-5xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.4} />
            <span>Atelier security perimeter</span>
          </span>
          <span>·</span>
          <span>Clofads Atelier</span>
        </div>
        <div className="truncate max-w-[50%]">
          <span>Session authorized: {activeEmail}</span>
        </div>
      </div>
    </div>
  );
};
