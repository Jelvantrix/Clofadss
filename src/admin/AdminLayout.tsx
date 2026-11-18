import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Product, Order, Customer, WaitlistEntry, Discount, AiInsight, DailyStat, AuditLog } from '../types';
import { useAuth } from '../supabase/AuthContext';
import { supabase } from '../supabase/config';
import {
  subscribeToOrders,
  subscribeToCustomers,
  subscribeToWaitlist,
  logAuditEvent,
} from '../supabase/dbService';
import { AdminCommandPalette } from './AdminCommandPalette';
import { AdminNotificationsModal } from './AdminNotificationsModal';
import { AdminProductEditorDrawer } from './products/AdminProductEditorDrawer';
import { AdminSecurityGate } from './security/AdminSecurityGate';
import { useStorefrontData } from '../context/StorefrontDataContext';
import { ConsoleShell } from './bos/ConsoleShell';
import { BosConsole, ADMIN_SCREENS, SCREEN_LABEL } from './bos/BosConsole';
import { AdminControlsView } from './bos/AdminControlsView';
import { AdminTasksView } from './tasks/AdminTasksView';
import type { BosData } from './bos/bosSystems';

import { AdminControlPlaneView } from './control/AdminControlPlaneView';
import { AdminSystemHealthView } from './health/AdminSystemHealthView';
import { AdminProductsView } from './products/AdminProductsView';
import { AdminCollectionsView } from './collections/AdminCollectionsView';
import { AdminCategoriesView } from './categories/AdminCategoriesView';
import { AdminMediaView } from './media/AdminMediaView';
import { AdminOrdersView } from './orders/AdminOrdersView';
import { AdminInventoryView } from './inventory/AdminInventoryView';
import { AdminDiscountsView } from './discounts/AdminDiscountsView';
import { AdminCustomersView } from './customers/AdminCustomersView';
import { AdminWaitlistView } from './waitlist/AdminWaitlistView';
import { AdminSuggestionsView } from './suggestions/AdminSuggestionsView';
import { AdminContentView } from './content/AdminContentView';
import { AdminAnalyticsView } from './analytics/AdminAnalyticsView';
import { AdminAdvisorView } from './advisor/AdminAdvisorView';
import { AdminAtlasView } from './atlas/AdminAtlasView';
import { AdminSecurityView } from './security/AdminSecurityView';
import { AdminSettingsView } from './settings/AdminSettingsView';

interface AdminLayoutProps {
  onBackToStorefront: () => void;
  onViewProductInStore: (product: Product) => void;
  previewMode?: boolean;
}

/** Palette / notification targets → the admin screen they should open. */
const LEGACY_TO_SCREEN: Record<string, string> = {
  dashboard: 'control',
  control: 'control',
  health: 'health',
  analytics: 'analytics',
  customers: 'customers',
  products: 'products',
  collections: 'collections',
  categories: 'categories',
  media: 'media',
  orders: 'orders',
  inventory: 'inventory',
  discounts: 'discounts',
  waitlist: 'waitlist',
  suggestions: 'suggestions',
  content: 'content',
  advisor: 'advisor',
  atlas: 'atlas',
  security: 'security',
  settings: 'settings',
  '01': 'control',
  '02': 'analytics',
  '03': 'customers',
  '04': 'analytics',
  '05': 'products',
  '06': 'inventory',
  '07': 'orders',
  '08': 'orders',
  '09': 'orders',
  '10': 'discounts',
  '11': 'analytics',
  '12': 'analytics',
  '13': 'customers',
  '14': 'customers',
  '15': 'customers',
  '16': 'analytics',
  '17': 'inventory',
  '18': 'security',
  '19': 'security',
};

const AdminLayoutContent: React.FC<AdminLayoutProps & { onLock: () => void }> = ({
  onBackToStorefront,
  onViewProductInStore,
  previewMode = false,
  onLock,
}) => {
  const { adminProfile } = useAuth();
  const {
    products,
    collections,
    categories,
    content,
    settings,
    deleteProduct,
    deleteProducts,
    saveProduct,
    refreshProducts,
  } = useStorefrontData();

  const [activeScreen, setActiveScreen] = useState<string>('console');
  const [controlsContext, setControlsContext] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string>('');
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
    }, 2800);
  }, []);

  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('zejesh_sec_autolock_mins');
    return saved ? parseInt(saved, 10) : 15;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const refreshAuditLogs = useCallback(async () => {
    if (previewMode) return;
    try {
      const { data, error } = await supabase
        .from('auditLog')
        .select('*')
        .order('at', { ascending: false })
        .limit(100);
      if (!error && data) {
        setAuditLogs(data as AuditLog[]);
      }
    } catch (err) {
      console.warn('Audit log load failed:', err);
    }
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return;
    void refreshAuditLogs();
    try {
      const channel = supabase
        .channel('admin-audit-logs-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auditLog' }, () => {
          void refreshAuditLogs();
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Audit log subscription failed:', err);
      return () => {};
    }
  }, [previewMode, refreshAuditLogs]);

  const handleUpdateAutoLock = (mins: number) => {
    setAutoLockMinutes(mins);
    localStorage.setItem('zejesh_sec_autolock_mins', mins.toString());
  };

  const handleLockConsoleNow = useCallback(() => {
    if (!previewMode) {
      void logAuditEvent(adminProfile?.email || 'admin', 'TERMINAL_LOCKED', 'Console Manual Lockout').finally(() =>
        refreshAuditLogs()
      );
    }
    onLock();
  }, [adminProfile?.email, onLock, previewMode, refreshAuditLogs]);

  // Inactivity Auto-Lock Detector
  const lastActivityRef = useRef<number>(Date.now());
  useEffect(() => {
    if (autoLockMinutes === 0 || previewMode) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const checkInterval = setInterval(() => {
      const elapsedMinutes = (Date.now() - lastActivityRef.current) / (1000 * 60);
      if (elapsedMinutes >= autoLockMinutes) {
        handleLockConsoleNow();
      }
    }, 15000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      clearInterval(checkInterval);
    };
  }, [autoLockMinutes, previewMode, handleLockConsoleNow]);

  // Real production datasets
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [discounts] = useState<Discount[]>(() => {
    try {
      const saved = localStorage.getItem('zejesh_discounts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [insights] = useState<AiInsight[]>([]);

  const realDailyStats: DailyStat[] = useMemo(() => {
    if (orders.length === 0) return [];
    const map: Record<string, DailyStat> = {};
    for (const o of orders) {
      const d = (o.createdAt || new Date().toISOString()).slice(0, 10);
      if (!map[d]) {
        map[d] = {
          id: `stat-${d}`,
          date: d,
          revenue: 0,
          orders: 0,
          visitors: 0,
          sessions: 0,
          addToBags: 0,
          pageViews: 0,
        };
      }
      map[d].revenue += o.totals?.total || 0;
      map[d].orders += 1;
      map[d].addToBags += (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  useEffect(() => {
    if (previewMode) return;
    const unsubOrders = subscribeToOrders((liveOrders) => setOrders(liveOrders));
    const unsubCust = subscribeToCustomers((liveCust) => setCustomers(liveCust));
    const unsubWait = subscribeToWaitlist((liveWait) => setWaitlist(liveWait));

    return () => {
      unsubOrders();
      unsubCust();
      unsubWait();
    };
  }, [previewMode]);

  const [controlOverview, setControlOverview] = useState<{
    overallStatus?: string;
  } | null>(null);

  useEffect(() => {
    if (previewMode) return;
    let cancelled = false;
    const loadControl = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/control/overview', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json && typeof json === 'object') {
          setControlOverview({ overallStatus: json.overallStatus || json.status });
        }
      } catch {
        // Silently degrade if control plane endpoint is offline
      }
    };

    void loadControl();
    const iv = window.setInterval(loadControl, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [previewMode]);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditorDrawerOpen, setIsEditorDrawerOpen] = useState(false);
  const [liveVisitors, setLiveVisitors] = useState(0);

  useEffect(() => {
    if (previewMode) return;
    let cancelled = false;

    const loadLiveVisitors = async () => {
      try {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const { count, error } = await supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .gte('timestamp', fiveMinutesAgo);
        if (!cancelled) {
          setLiveVisitors(!error && typeof count === 'number' ? count : 0);
        }
      } catch (err) {
        console.warn('Live visitor count failed:', err);
        if (!cancelled) setLiveVisitors(0);
      }
    };

    void loadLiveVisitors();
    const timer = window.setInterval(loadLiveVisitors, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [previewMode]);

  const openOrdersBadge = orders.filter(
    (o) => !['delivered', 'cancelled', 'refunded'].includes(o.status)
  ).length;

  const lowStockBadge = products.filter((p) => {
    const stk = p.variants?.length
      ? p.variants.reduce((s, v) => s + (v.stock || 0), 0)
      : p.stock || 0;
    return stk <= 4;
  }).length;

  const openScreen = useCallback((id: string) => {
    const mapped = ADMIN_SCREENS.some((s) => s.id === id)
      ? id
      : LEGACY_TO_SCREEN[id] || 'console';
    setActiveScreen(mapped);
  }, []);

  const openTasks = useCallback(() => setActiveScreen('tasks'), []);

  const openControls = useCallback((screenId?: string) => {
    setControlsContext(
      screenId && screenId !== 'console' && screenId !== 'controls' ? screenId : undefined
    );
    setActiveScreen('controls');
  }, []);

  const backToConsole = useCallback(() => setActiveScreen('console'), []);

  const bosData: BosData = useMemo(
    () => ({
      products,
      orders,
      customers,
      collections,
      categories,
      waitlist,
      discounts,
      auditLogs,
      dailyStats: realDailyStats,
      liveVisitors,
    }),
    [
      products,
      orders,
      customers,
      collections,
      categories,
      waitlist,
      discounts,
      auditLogs,
      realDailyStats,
      liveVisitors,
    ]
  );

  const handleExportOrdersCsv = useCallback(() => {
    const headers = ['Order_Ref', 'Date', 'Client', 'Email', 'Status', 'Total_EUR'];
    const rows = orders.map((o) => [
      o.number,
      (o.createdAt || '').slice(0, 10),
      `"${(o.customer?.name || 'Guest').replaceAll('"', '""')}"`,
      o.customer?.email || '',
      o.status,
      String(o.totals?.total || 0),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zejesh-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${orders.length} orders to CSV`);
  }, [orders, showToast]);

  const operatorName = adminProfile?.name || (previewMode ? 'Atelier Preview' : 'Operator');
  const operatorEmail = adminProfile?.email || 'operator@clofads.fi';

  const renderLegacyView = (viewId: string) => {
    switch (viewId) {
      case 'control':
        return <AdminControlPlaneView />;
      case 'health':
        return <AdminSystemHealthView />;
      case 'products':
        return (
          <AdminProductsView
            products={products}
            onEditProduct={(p) => {
              setEditingProduct(p);
              setIsEditorDrawerOpen(true);
            }}
            onCreateProduct={() => {
              setEditingProduct(null);
              setIsEditorDrawerOpen(true);
            }}
            onViewProductInStore={onViewProductInStore}
            onRefresh={refreshProducts}
            onDeleteProduct={deleteProduct}
            onDeleteProducts={deleteProducts}
          />
        );
      case 'collections':
        return (
          <AdminCollectionsView
            collections={collections}
            products={products}
            onRefresh={refreshProducts}
          />
        );
      case 'categories':
        return (
          <AdminCategoriesView categories={categories} onRefresh={refreshProducts} />
        );
      case 'media':
        return <AdminMediaView products={products} />;
      case 'orders':
        return <AdminOrdersView orders={orders} onRefresh={refreshProducts} />;
      case 'inventory':
        return <AdminInventoryView products={products} onRefresh={refreshProducts} />;
      case 'discounts':
        return <AdminDiscountsView discounts={discounts} onRefresh={refreshProducts} />;
      case 'customers':
        return <AdminCustomersView customers={customers} />;
      case 'waitlist':
        return (
          <AdminWaitlistView
            waitlist={waitlist}
            collections={collections}
            onRefresh={refreshProducts}
          />
        );
      case 'suggestions':
        return <AdminSuggestionsView />;
      case 'content':
        return content ? (
          <AdminContentView content={content} onRefresh={refreshProducts} />
        ) : (
          <div className="border border-paper-a18 p-6 text-[13px] text-paper-a45">
            Loading storefront editorial slots…
          </div>
        );
      case 'analytics':
        return (
          <AdminAnalyticsView products={products} dailyStats={realDailyStats} orders={orders} />
        );
      case 'advisor':
        return (
          <AdminAdvisorView
            products={products}
            dailyStats={realDailyStats}
            insights={insights}
            onRefresh={refreshProducts}
            onNavigateView={openScreen}
          />
        );
      case 'atlas':
        return (
          <AdminAtlasView
            products={products}
            orders={orders}
            customers={customers}
            waitlist={waitlist}
            collections={collections}
            onNavigateView={openScreen}
          />
        );
      case 'security':
        return (
          <AdminSecurityView
            autoLockMinutes={autoLockMinutes}
            onUpdateAutoLock={handleUpdateAutoLock}
            onLockTerminalNow={handleLockConsoleNow}
            auditLogs={auditLogs}
          />
        );
      case 'settings':
        return settings ? (
          <AdminSettingsView settings={settings} onRefresh={refreshProducts} />
        ) : (
          <div className="border border-paper-a18 p-6 text-[13px] text-paper-a45">
            Loading store settings…
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ConsoleShell
        operatorName={operatorName}
        operatorEmail={operatorEmail}
        notificationCount={openOrdersBadge + lowStockBadge}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenPalette={() => setIsCommandPaletteOpen(true)}
        onLock={handleLockConsoleNow}
        onBackToStorefront={onBackToStorefront}
        previewMode={previewMode}
        toastMessage={toastMessage}
        screenLabel={
          activeScreen === 'console'
            ? undefined
            : activeScreen === 'tasks'
              ? 'Everyday tasks'
              : activeScreen === 'controls'
                ? 'Advanced controls'
                : SCREEN_LABEL[activeScreen] || activeScreen
        }
        onBack={activeScreen === 'console' ? undefined : backToConsole}
        onOpenTasks={() => openTasks()}
      >
        {activeScreen === 'console' ? (
          <BosConsole
            data={bosData}
            onOpenScreen={openScreen}
            onOpenTasks={() => openTasks()}
            onCreateProduct={() => {
              setEditingProduct(null);
              setIsEditorDrawerOpen(true);
            }}
            onExportOrders={handleExportOrdersCsv}
            onLock={handleLockConsoleNow}
            operatorName={operatorName}
          />
        ) : activeScreen === 'tasks' ? (
          <AdminTasksView
            data={bosData}
            previewMode={previewMode}
            onOpenAdvanced={() => openControls()}
            onSaved={() => {
              refreshProducts();
              showToast('Saved.');
            }}
          />
        ) : activeScreen === 'controls' ? (
          <AdminControlsView
            key={controlsContext || 'all'}
            onOpenScreen={openScreen}
            onOpenTasks={openTasks}
            contextScreen={controlsContext}
            previewMode={previewMode}
          />
        ) : (
          <div className="bos-legacy">{renderLegacyView(activeScreen)}</div>
        )}
      </ConsoleShell>

      <div className="admin-scope">
        <div className="bos-legacy">
          <AdminCommandPalette
            isOpen={isCommandPaletteOpen}
            onClose={() => setIsCommandPaletteOpen(false)}
            products={products}
            onSelectProduct={(p) => {
              setEditingProduct(p);
              setIsEditorDrawerOpen(true);
            }}
            onNavigateView={openScreen}
          />

          <AdminNotificationsModal
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            products={products}
            orders={orders}
            insights={insights}
            onNavigateView={openScreen}
          />

          <AdminProductEditorDrawer
            isOpen={isEditorDrawerOpen}
            product={editingProduct}
            onClose={() => setIsEditorDrawerOpen(false)}
            onSaveSuccess={(updated) => {
              void saveProduct(updated);
            }}
            onDeleteProduct={deleteProduct}
            categories={categories}
            collections={collections}
          />
        </div>
      </div>
    </>
  );
};

/**
 * The security gate sits outside the console tree. Nothing inside the console —
 * data subscriptions, lists, or admin views — is mounted until the operator has
 * re-entered their password. Locking unmounts the console again.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = (props) => {
  const [isUnlocked, setIsUnlocked] = useState(Boolean(props.previewMode));

  const handleLock = useCallback(() => setIsUnlocked(false), []);

  if (!props.previewMode && !isUnlocked) {
    return (
      <AdminSecurityGate
        isLocked
        onUnlock={() => setIsUnlocked(true)}
        onExitToStore={props.onBackToStorefront}
      />
    );
  }

  return <AdminLayoutContent {...props} onLock={handleLock} />;
};
