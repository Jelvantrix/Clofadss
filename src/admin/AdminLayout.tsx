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
import { AdminProductsView } from './products/AdminProductsView';
import { AdminProductEditorDrawer } from './products/AdminProductEditorDrawer';
import { AdminCollectionsView } from './collections/AdminCollectionsView';
import { AdminCategoriesView } from './categories/AdminCategoriesView';
import { AdminMediaView } from './media/AdminMediaView';
import { AdminOrdersView } from './orders/AdminOrdersView';
import { AdminInventoryView } from './inventory/AdminInventoryView';
import { AdminCustomersView } from './customers/AdminCustomersView';
import { AdminWaitlistView } from './waitlist/AdminWaitlistView';
import { AdminDiscountsView } from './discounts/AdminDiscountsView';
import { AdminContentView } from './content/AdminContentView';
import { AdminAnalyticsView } from './analytics/AdminAnalyticsView';
import { AdminAdvisorView } from './advisor/AdminAdvisorView';
import { AdminSettingsView } from './settings/AdminSettingsView';
import { AdminSecurityGate } from './security/AdminSecurityGate';
import { AdminSecurityView } from './security/AdminSecurityView';
import { AdminSystemHealthView } from './health/AdminSystemHealthView';
import { AdminAtlasView } from './atlas/AdminAtlasView';
import { AdminControlPlaneView } from './control/AdminControlPlaneView';
import { AdminSuggestionsView } from './suggestions/AdminSuggestionsView';
import { useStorefrontData } from '../context/StorefrontDataContext';
import { OperationsShell, type OpsNavGroup } from './operations/OperationsShell';
import { OpsOverview, OPS_REGIONS, type OpsRange, type OpsCurrency } from './operations/OpsOverview';
import './operations/operations.css';

interface AdminLayoutProps {
  onBackToStorefront: () => void;
  onViewProductInStore: (product: Product) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  onBackToStorefront,
  onViewProductInStore,
}) => {
  const { role, adminProfile, signOut } = useAuth();
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

  // Active Admin Subview
  const [currentView, setCurrentView] = useState<string>('dashboard');

  // Operations console filters
  const [opsRange, setOpsRange] = useState<OpsRange>('30D');
  const [opsRegion, setOpsRegion] = useState<string>('Global');
  const [opsCurrency, setOpsCurrency] = useState<OpsCurrency>('EUR');

  // Security & Terminal Gate State.
  const [isTerminalLocked, setIsTerminalLocked] = useState<boolean>(() => {
    const unlockedTs = sessionStorage.getItem('zejesh_sec_unlocked_ts');
    if (unlockedTs) {
      const elapsed = (Date.now() - parseInt(unlockedTs, 10)) / 1000 / 60;
      if (elapsed < 15) return false;
    }
    return true;
  });

  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('zejesh_sec_autolock_mins');
    return saved ? parseInt(saved, 10) : 15;
  });

  // Security Audit Logs — real activity only
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const refreshAuditLogs = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    refreshAuditLogs();
    try {
      const channel = supabase
        .channel('admin-audit-logs-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auditLog' }, () => {
          refreshAuditLogs();
        })
        .subscribe();
      return () => {
        supabase.removeChannel(channel);
      };
    } catch (err) {
      console.warn('Audit log subscription failed:', err);
      return () => {};
    }
  }, [refreshAuditLogs]);

  const handleUpdateAutoLock = (mins: number) => {
    setAutoLockMinutes(mins);
    localStorage.setItem('zejesh_sec_autolock_mins', mins.toString());
  };

  const handleLockTerminalNow = useCallback(() => {
    setIsTerminalLocked(true);
    sessionStorage.removeItem('zejesh_sec_unlocked_ts');
    void logAuditEvent(adminProfile?.email || 'admin', 'TERMINAL_LOCKED', 'Console Manual Lockout').finally(() =>
      refreshAuditLogs()
    );
  }, [adminProfile?.email, refreshAuditLogs]);

  const handleUnlockTerminal = () => {
    setIsTerminalLocked(false);
    sessionStorage.setItem('zejesh_sec_unlocked_ts', Date.now().toString());
    void logAuditEvent(adminProfile?.email || 'admin', 'TERMINAL_UNLOCKED', 'Security Gate Clearance').finally(() =>
      refreshAuditLogs()
    );
  };

  // Inactivity Auto-Lock Detector
  const lastActivityRef = useRef<number>(Date.now());
  useEffect(() => {
    if (autoLockMinutes === 0) return;

    const resetTimer = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const checkInterval = setInterval(() => {
      if (!isTerminalLocked) {
        const elapsedMinutes = (Date.now() - lastActivityRef.current) / (1000 * 60);
        if (elapsedMinutes >= autoLockMinutes) {
          handleLockTerminalNow();
        }
      }
    }, 15000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      clearInterval(checkInterval);
    };
  }, [autoLockMinutes, isTerminalLocked, handleLockTerminalNow]);

  // Real production datasets
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [discounts, setDiscounts] = useState<Discount[]>(() => {
    try {
      const saved = localStorage.getItem('zejesh_discounts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [insights, setInsights] = useState<AiInsight[]>([]);

  // Daily statistics computed from real orders only.
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
      map[d].revenue += (o.totals?.total || 0);
      map[d].orders += 1;
      map[d].addToBags += (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0);
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [orders]);

  useEffect(() => {
    const unsubOrders = subscribeToOrders((liveOrders) => setOrders(liveOrders));
    const unsubCust = subscribeToCustomers((liveCust) => setCustomers(liveCust));
    const unsubWait = subscribeToWaitlist((liveWait) => setWaitlist(liveWait));

    return () => {
      unsubOrders();
      unsubCust();
      unsubWait();
    };
  }, []);

  // Command palette & notifications state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Product Editor Drawer State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditorDrawerOpen, setIsEditorDrawerOpen] = useState(false);

  // Live operator presence
  const [liveVisitors, setLiveVisitors] = useState(0);

  useEffect(() => {
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

    loadLiveVisitors();
    const timer = window.setInterval(loadLiveVisitors, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const navItems = [
    { id: 'dashboard', group: 'Command', label: 'Overview', description: 'The house at a glance' },
    { id: 'control', group: 'Command', label: 'Control Plane', description: 'Infrastructure and intelligence' },
    { id: 'health', group: 'Command', label: 'System Health', description: 'Live service probes' },
    { id: 'products', group: 'Product', label: 'Products & Archive', badge: products.length, description: 'The catalogue' },
    { id: 'collections', group: 'Product', label: 'Collections & Drops', badge: collections.length, description: 'Seasons and releases' },
    { id: 'categories', group: 'Product', label: 'Categories', description: 'Catalogue structure' },
    { id: 'media', group: 'Product', label: 'Media Library', description: 'Cinematic assets' },
    { id: 'orders', group: 'Product', label: 'Order Book', badge: orders.filter((o) => !['delivered', 'cancelled', 'refunded'].includes(o.status)).length, description: 'Fulfilment and settlement' },
    { id: 'inventory', group: 'Product', label: 'Inventory Control', badge: products.filter((p) => (p.stock || 0) <= 4).length || undefined, description: 'Stock and allocations' },
    { id: 'discounts', group: 'Product', label: 'Discounts', description: 'Client privileges' },
    { id: 'customers', group: 'Growth', label: 'Clients', badge: customers.length, description: 'The address book' },
    { id: 'waitlist', group: 'Growth', label: 'Waitlists', badge: 'VIP', description: 'Private demand' },
    { id: 'suggestions', group: 'Growth', label: 'Suggestions & Votes', description: 'Client counsel' },
    { id: 'content', group: 'Studio', label: 'Hero Slides & CMS', badge: content?.heroSlides?.length, description: 'Storefront storytelling' },
    { id: 'analytics', group: 'Studio', label: 'Analytics', description: 'Commercial reading' },
    { id: 'advisor', group: 'Studio', label: 'AI Advisor', description: 'Decision support' },
    { id: 'atlas', group: 'Control', label: 'System Atlas', description: 'Every operating surface' },
    { id: 'security', group: 'Control', label: 'Security & Audit', description: 'Access and accountability' },
    { id: 'settings', group: 'Control', label: 'Settings', description: 'House configuration' },
  ];

  const navGroups: OpsNavGroup[] = ['Command', 'Product', 'Growth', 'Studio', 'Control']
    .map((group) => ({
      group,
      items: navItems
        .filter((item) => item.group === group)
        .map(({ id, label, badge }) => ({ id, label, badge })),
    }))
    .filter((group) => group.items.length > 0);

  const operatorInitials = (adminProfile?.name || adminProfile?.email || 'ZJ')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const activeOrderCount = orders.filter(
    (order) => !['delivered', 'cancelled', 'refunded'].includes(order.status)
  ).length;

  const legacy = (node: React.ReactNode) => <div className="admin-scope">{node}</div>;

  return (
    <>
      <AdminSecurityGate
        isLocked={isTerminalLocked}
        onUnlock={handleUnlockTerminal}
        onExitToStore={onBackToStorefront}
      />

      <div className="ops-ui">
        <OperationsShell
          groups={navGroups}
          currentView={currentView}
          onNavigate={setCurrentView}
          range={opsRange}
          onRangeChange={setOpsRange}
          region={opsRegion}
          regions={[...OPS_REGIONS]}
          onRegionChange={setOpsRegion}
          currency={opsCurrency}
          onCurrencyChange={setOpsCurrency}
          onOpenPalette={() => setIsCommandPaletteOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onLock={handleLockTerminalNow}
          onBackToStorefront={onBackToStorefront}
          operatorName={adminProfile?.name || adminProfile?.email || 'Operator'}
          role={adminProfile?.role || role || 'Administrator'}
          initials={operatorInitials}
          notificationCount={activeOrderCount}
        >
          {currentView === 'dashboard' && (
            <OpsOverview
              orders={orders}
              products={products}
              customers={customers}
              waitlist={waitlist}
              collections={collections}
              range={opsRange}
              region={opsRegion}
              currency={opsCurrency}
              liveVisitors={liveVisitors}
              onNavigate={setCurrentView}
            />
          )}

          {currentView === 'products' && legacy(
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
          )}

          {currentView === 'collections' && legacy(
            <AdminCollectionsView collections={collections} products={products} onRefresh={() => {}} />
          )}

          {currentView === 'categories' && legacy(
            <AdminCategoriesView categories={categories} onRefresh={() => {}} />
          )}

          {currentView === 'media' && legacy(<AdminMediaView products={products} />)}

          {currentView === 'orders' && legacy(
            <AdminOrdersView orders={orders} onRefresh={() => {}} />
          )}

          {currentView === 'inventory' && legacy(
            <AdminInventoryView products={products} onRefresh={() => {}} />
          )}

          {currentView === 'customers' && legacy(<AdminCustomersView customers={customers} />)}

          {currentView === 'waitlist' && legacy(
            <AdminWaitlistView waitlist={waitlist} collections={collections} onRefresh={() => {}} />
          )}

          {currentView === 'discounts' && legacy(
            <AdminDiscountsView discounts={discounts} onRefresh={() => {}} />
          )}

          {currentView === 'suggestions' && legacy(<AdminSuggestionsView />)}

          {currentView === 'content' && legacy(
            <AdminContentView content={content} onRefresh={() => {}} />
          )}

          {currentView === 'analytics' && legacy(
            <AdminAnalyticsView products={products} dailyStats={realDailyStats} orders={orders} />
          )}

          {currentView === 'advisor' && legacy(
            <AdminAdvisorView
              products={products}
              dailyStats={realDailyStats}
              insights={insights}
              onRefresh={() => {}}
              onNavigateView={(v) => setCurrentView(v)}
            />
          )}

          {currentView === 'control' && legacy(<AdminControlPlaneView />)}

          {currentView === 'health' && legacy(<AdminSystemHealthView />)}

          {currentView === 'atlas' && legacy(
            <AdminAtlasView
              products={products}
              orders={orders}
              customers={customers}
              waitlist={waitlist}
              collections={collections}
              onNavigateView={setCurrentView}
            />
          )}

          {currentView === 'security' && legacy(
            <AdminSecurityView
              autoLockMinutes={autoLockMinutes}
              onUpdateAutoLock={handleUpdateAutoLock}
              onLockTerminalNow={handleLockTerminalNow}
              auditLogs={auditLogs}
            />
          )}

          {currentView === 'settings' && legacy(
            <AdminSettingsView settings={settings} onRefresh={() => {}} />
          )}
        </OperationsShell>
      </div>

      {/* Global Command Palette (Cmd+K) */}
      <div className="admin-scope">
      <AdminCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        products={products}
        onSelectProduct={(p) => {
          setEditingProduct(p);
          setIsEditorDrawerOpen(true);
        }}
        onNavigateView={(v) => setCurrentView(v)}
      />

      {/* Notifications Drawer */}
      <AdminNotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        products={products}
        orders={orders}
        insights={insights}
        onNavigateView={(v) => setCurrentView(v)}
      />

      {/* Product Slide-over Editor Drawer */}
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
    </>
  );
};
