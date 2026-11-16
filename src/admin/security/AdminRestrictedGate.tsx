import React from 'react';
import { ShieldAlert, Lock, ArrowLeft, ArrowRight, UserCheck, LogOut } from 'lucide-react';
import { useAuth, DESIGNATED_ADMIN_EMAIL } from '../../supabase/AuthContext';

interface AdminRestrictedGateProps {
  onGoToAuth: () => void;
  onBackToStorefront: () => void;
}

export const AdminRestrictedGate: React.FC<AdminRestrictedGateProps> = ({
  onGoToAuth,
  onBackToStorefront,
}) => {
  const { user, signOut } = useAuth();

  const handleSignOutAndAuth = async () => {
    try {
      await signOut();
    } catch {
      // Ignore
    }
    onGoToAuth();
  };

  return (
    <div className="admin-scope min-h-screen bg-ink text-paper flex flex-col justify-between p-6 sm:p-12 selection:bg-paper selection:text-ink animate-fadeIn">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-paper-a18 max-w-4xl w-full mx-auto">
        <div className="flex items-center gap-3">
          <span className="w-1.5 h-1.5 bg-paper" />
          <span className="micro-sm text-paper-a72">
            Zejesh · Atelier Security Perimeter
          </span>
        </div>
        <button
          type="button"
          onClick={onBackToStorefront}
          className="micro-sm text-paper-a45 hover:text-paper flex items-center gap-1.5 transition-colors cursor-pointer py-1 px-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.4} />
          <span>Return to Storefront</span>
        </button>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-auto py-10">
        <div className="border border-paper-a18 p-8 sm:p-10 relative text-center">
          {/* Top lock icon */}
          <div className="w-14 h-14 border border-paper-a18 text-paper mx-auto flex items-center justify-center mb-6">
            <Lock className="w-6 h-6" strokeWidth={1.4} />
          </div>

          <span className="micro-sm text-paper-a45 block mb-3">
            Restricted terminal link
          </span>

          <h1 className="font-display text-[34px] font-light leading-[1.05] tracking-[-0.01em] text-paper mb-3">
            Administrative access denied
          </h1>

          <p className="text-[13px] font-light text-paper-a72 leading-relaxed mb-8">
            This management terminal link cannot be opened without an active executive administrator session.
            Only the designated administrator (<span className="text-paper select-all font-mono text-[11px]">{DESIGNATED_ADMIN_EMAIL}</span>) is permitted to access this panel.
          </p>

          {user ? (
            <div className="p-4 border border-paper-a18 text-left text-small space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <span className="micro-sm text-paper-a45">
                  Current session
                </span>
                <span className="micro-sm border border-paper-a18 text-paper-a72 px-2 py-0.5">
                  Patron account
                </span>
              </div>
              <p className="text-paper text-[12px] break-all font-mono">
                {user.email}
              </p>
              <p className="micro-sm text-paper-a45 leading-relaxed normal-case tracking-[0.04em]">
                This account does not have executive clearance. Please sign out and log in with{' '}
                <span className="text-paper">{DESIGNATED_ADMIN_EMAIL}</span> on the main website.
              </p>
            </div>
          ) : (
            <div className="p-4 border border-dashed border-paper-a18 text-left text-small space-y-3 mb-6">
              <div className="flex items-center gap-2 text-paper micro-sm">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" strokeWidth={1.4} />
                <span>No active admin session detected</span>
              </div>
              <p className="text-[12px] font-light text-paper-a72 leading-relaxed">
                You must first log in with{' '}
                <span className="text-paper">{DESIGNATED_ADMIN_EMAIL}</span> on the main website.
                Once logged in, revisit this link to enter your terminal keys.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3 pt-2">
            {user ? (
              <button
                type="button"
                onClick={handleSignOutAndAuth}
                className="btn btn-primary w-full !min-h-[48px]"
              >
                <LogOut className="w-3.5 h-3.5" strokeWidth={1.4} />
                <span>Sign Out & Log In as Admin</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onGoToAuth}
                className="btn btn-primary w-full !min-h-[48px] group"
              >
                <UserCheck className="w-3.5 h-3.5" strokeWidth={1.4} />
                <span>Log In on Website First</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" strokeWidth={1.4} />
              </button>
            )}

            <button
              type="button"
              onClick={onBackToStorefront}
              className="btn-text w-full justify-center"
            >
              Return to Storefront
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-paper-a18 max-w-4xl w-full mx-auto flex items-center justify-between micro-sm text-paper-a45">
        <span>Security enforcement protocol: strict owner validation</span>
        <span className="hidden sm:inline">Zejesh enterprise perimeter</span>
      </div>
    </div>
  );
};
