import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Bell,
  Boxes,
  Clock3,
  Command,
  Download,
  FileText,
  FolderTree,
  Gauge,
  Image as ImageIcon,
  Layers,
  Lock,
  Menu,
  Network,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
  Vote,
  X,
} from 'lucide-react';

export interface JobgioNavItem {
  id: string;
  group: 'Command' | 'Catalogue' | 'Commerce' | 'Clientele' | 'House';
  label: string;
  description: string;
  badge?: number;
}

interface JobgioShellProps {
  activeViewId: string;
  navItems: JobgioNavItem[];
  onNavigateView: (viewId: string) => void;
  onOpenPalette: () => void;
  onOpenNotifications: () => void;
  onCreateProduct: () => void;
  onExportOrdersCsv: () => void;
  onRefreshStore: () => void;
  onLockConsole: () => void;
  onBackToStorefront: () => void;
  notificationCount: number;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  liveVisitors: number;
  controlStatus?: string;
  previewMode?: boolean;
  toastMessage?: string;
  children: React.ReactNode;
}

const VIEW_ICONS: Record<string, React.ElementType> = {
  dashboard: Gauge,
  control: Activity,
  health: Network,
  products: Package,
  collections: Layers,
  categories: FolderTree,
  media: ImageIcon,
  orders: ShoppingBag,
  inventory: Boxes,
  discounts: Percent,
  customers: Users,
  waitlist: Clock3,
  suggestions: Vote,
  content: FileText,
  analytics: TrendingUp,
  advisor: Sparkles,
  atlas: Network,
  security: ShieldCheck,
  settings: Settings,
};

const GROUPS: Array<JobgioNavItem['group']> = [
  'Command',
  'Catalogue',
  'Commerce',
  'Clientele',
  'House',
];

const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M16 3.5 28.5 10 16 16.5 3.5 10 16 3.5Z"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinejoin="round"
    />
    <path
      d="M3.5 16 16 22.5 28.5 16"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3.5 22 16 28.5 28.5 22"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const JobgioShell: React.FC<JobgioShellProps> = ({
  activeViewId,
  navItems,
  onNavigateView,
  onOpenPalette,
  onOpenNotifications,
  onCreateProduct,
  onExportOrdersCsv,
  onRefreshStore,
  onLockConsole,
  onBackToStorefront,
  notificationCount,
  adminName,
  adminEmail,
  adminRole,
  liveVisitors,
  controlStatus,
  previewMode = false,
  toastMessage,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeItem = useMemo(
    () => navItems.find((item) => item.id === activeViewId) || navItems[0],
    [activeViewId, navItems]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenPalette();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenPalette]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    onRefreshStore();
    window.setTimeout(() => setIsRefreshing(false), 600);
  };

  const initials = useMemo(() => {
    const clean = (adminName || adminEmail || 'ZJ').trim();
    if (!clean) return 'ZJ';
    const parts = clean.split(/[\s@._-]+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }, [adminName, adminEmail]);

  const renderSidebarContent = (isMobile = false) => {
    const compact = !isMobile && sidebarCollapsed;
    return (
      <div className="flex h-full flex-col">
        {/* Brand */}
        <div className={`jg-brand ${compact ? 'justify-center' : ''}`}>
          <div className="jg-brand-mark">
            <BrandMark className="h-8 w-8" />
          </div>
          {!compact && (
            <div className="min-w-0">
              <div className="jg-brand-name">CLOFADS</div>
              <div className="jg-brand-tag">Brand OS</div>
            </div>
          )}
          {isMobile && (
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="ml-auto flex h-8 w-8 items-center justify-center text-black/50 hover:text-black"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          )}
          {!isMobile && !compact && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              className="ml-auto hidden h-8 w-8 items-center justify-center text-black/35 transition-colors hover:text-black lg:flex"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.8} />
            </button>
          )}
          {!isMobile && compact && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="mt-2 hidden h-8 w-8 items-center justify-center text-black/40 transition-colors hover:text-black lg:flex"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="jg-nav" aria-label="Admin modules">
          {GROUPS.map((group) => {
            const items = navItems.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group}>
                {!compact ? (
                  <div className="jg-group-label">{group}</div>
                ) : (
                  <div className="jg-group-label">·</div>
                )}
                <div className="jg-nav-list">
                  {items.map((item) => {
                    const Icon = VIEW_ICONS[item.id] || Layers;
                    const active = item.id === activeViewId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onNavigateView(item.id);
                          if (isMobile) setMobileNavOpen(false);
                        }}
                        title={compact ? item.label : undefined}
                        className={`jg-nav-item ${active ? 'jg-active' : ''}`}
                      >
                        <span className="jg-nav-icon">
                          <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
                        </span>
                        {!compact && (
                          <>
                            <span className="jg-nav-label">{item.label}</span>
                            {typeof item.badge === 'number' && item.badge > 0 && (
                              <span className="jg-nav-badge">{item.badge}</span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Operator profile */}
        <div className="jg-profile">
          <div className="jg-avatar-wrap">
            <div className="jg-avatar">{initials}</div>
            {notificationCount > 0 && (
              <span className="jg-avatar-badge">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </div>
          {!compact && (
            <div className="min-w-0 flex-1">
              <div className="jg-profile-name">{adminName}</div>
              <div className="jg-profile-email">{adminEmail}</div>
            </div>
          )}
        </div>

        {!compact && (
          <div className="jg-profile-actions">
            <button type="button" onClick={onLockConsole} className="jg-mini-btn">
              <Lock className="h-3 w-3" strokeWidth={1.8} />
              Lock
            </button>
            <button type="button" onClick={onBackToStorefront} className="jg-mini-btn">
              <ArrowLeft className="h-3 w-3" strokeWidth={1.8} />
              Store
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="jobgio-root admin-scope">
      <div className="jg-app">
        {/* Desktop sidebar */}
        <aside
          className={`jg-sidebar hidden lg:flex ${sidebarCollapsed ? 'jg-collapsed' : ''}`}
        >
          {renderSidebarContent(false)}
        </aside>

        {/* Mobile drawer */}
        {mobileNavOpen && (
          <div className="jg-mobile-overlay lg:hidden">
            <div
              className="jg-mobile-backdrop"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="jg-mobile-panel">
              <div className="flex h-full flex-col p-5">{renderSidebarContent(true)}</div>
            </aside>
          </div>
        )}

        {/* Main */}
        <div className="jg-main">
          <header className="jg-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileNavOpen(true)}
                className="jg-btn jg-icon-btn lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" strokeWidth={1.9} />
              </button>
              <div className="min-w-0">
                <div className="jg-topbar-title">{activeItem?.label || 'Overview'}</div>
                <div className="jg-topbar-sub truncate">
                  {activeItem?.description || 'Brand operating system'}
                  {previewMode ? ' · Local workspace' : ''}
                </div>
              </div>
            </div>

            <div className="jg-actions">
              <button
                type="button"
                onClick={onOpenPalette}
                className="jg-btn hidden md:inline-flex"
                aria-label="Search modules and SKUs"
              >
                <Search className="h-4 w-4" strokeWidth={1.9} />
                <span className="hidden xl:inline">Search</span>
                <kbd className="ml-1 hidden rounded-md border border-black/10 px-1.5 py-0.5 text-[10px] text-black/45 xl:inline">
                  ⌘K
                </kbd>
              </button>

              <button
                type="button"
                onClick={onOpenPalette}
                className="jg-btn jg-icon-btn md:hidden"
                aria-label="Search"
              >
                <Command className="h-4 w-4" strokeWidth={1.9} />
              </button>

              <button
                type="button"
                onClick={handleRefresh}
                className="jg-btn jg-icon-btn"
                title="Refresh data"
                aria-label="Refresh data"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                  strokeWidth={1.9}
                />
              </button>

              <button
                type="button"
                onClick={onOpenNotifications}
                className="jg-btn jg-icon-btn"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="h-4 w-4" strokeWidth={1.9} />
                {notificationCount > 0 && <span className="jg-dot" />}
              </button>

              <button
                type="button"
                onClick={onCreateProduct}
                className="jg-btn jg-btn-dark hidden sm:inline-flex"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                <span>New</span>
              </button>

              <button
                type="button"
                onClick={onExportOrdersCsv}
                className="jg-btn jg-icon-btn"
                title="Export orders CSV"
                aria-label="Export orders CSV"
              >
                <Download className="h-4 w-4" strokeWidth={1.9} />
              </button>
            </div>
          </header>

          <main className="jg-content">{children}</main>
        </div>
      </div>

      {toastMessage && <div className="jg-toast">{toastMessage}</div>}
    </div>
  );
};
