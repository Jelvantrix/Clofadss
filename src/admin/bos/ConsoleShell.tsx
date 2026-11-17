import React from 'react';

interface ConsoleShellProps {
  children: React.ReactNode;
  operatorName: string;
  operatorEmail: string;
  notificationCount: number;
  onOpenNotifications: () => void;
  onOpenPalette: () => void;
  onOpenTasks?: () => void;
  onLock: () => void;
  onBackToStorefront: () => void;
  previewMode?: boolean;
  toastMessage?: string;
  screenLabel?: string;
  onBack?: () => void;
}

const initialsOf = (name: string, email: string) => {
  const clean = (name || email || 'ZJ').trim();
  const parts = clean.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase() || 'ZJ';
};

/** Minimal chrome for the operator console. No navigation walls. */
export const ConsoleShell: React.FC<ConsoleShellProps> = ({
  children,
  operatorName,
  operatorEmail,
  notificationCount,
  onOpenNotifications,
  onOpenPalette,
  onOpenTasks,
  onLock,
  onBackToStorefront,
  previewMode = false,
  toastMessage,
  screenLabel,
  onBack,
}) => (
  <div className="bos-root admin-scope bos-shell-min">
    <div className="bos-min">
      <header className="bos-minbar">
        <div className="bos-minbrand">
          <div className="bos-logo">C</div>
          <div>
            <b>CLOFADS OS</b>
            <small>Operator console</small>
          </div>
        </div>

        {screenLabel && onBack && (
          <>
            <span className="bos-minsep" aria-hidden="true">
              /
            </span>
            <button type="button" className="bos-minback" onClick={onBack}>
              ← Console
            </button>
            <span className="bos-mintitle">{screenLabel}</span>
          </>
        )}

        <div className="bos-minactions">
          <span className="bos-b bos-recorded">
            ● {previewMode ? 'local preview' : 'live'}
          </span>
          <button type="button" className="bos-ghost" onClick={onOpenPalette}>
            Search · ⌘K
          </button>
          {onOpenTasks && (
            <button type="button" className="bos-ghost" onClick={onOpenTasks}>
              Tasks
            </button>
          )}
          <button type="button" className="bos-ghost" onClick={onOpenNotifications}>
            Alerts{notificationCount > 0 ? ` · ${notificationCount}` : ''}
          </button>
          <button type="button" className="bos-ghost" onClick={onLock}>
            Lock
          </button>
          <button type="button" className="bos-ghost" onClick={onBackToStorefront}>
            Store
          </button>
          <div className="bos-me bos-minme">
            <div className="bos-av">{initialsOf(operatorName, operatorEmail)}</div>
            <div style={{ minWidth: 0 }}>
              <b>{operatorName}</b>
              <small>{operatorEmail}</small>
            </div>
          </div>
        </div>
      </header>

      <main className="bos-minmain">{children}</main>
    </div>

    {toastMessage && (
      <div
        role="status"
        style={{
          position: 'fixed',
          bottom: 22,
          right: 22,
          zIndex: 130,
          background: '#000',
          color: '#fff',
          borderRadius: 99,
          padding: '11px 18px',
          fontSize: 12.5,
          fontWeight: 600,
          boxShadow: '0 16px 40px rgba(0,0,0,.28)',
        }}
      >
        {toastMessage}
      </div>
    )}
  </div>
);

export default ConsoleShell;
