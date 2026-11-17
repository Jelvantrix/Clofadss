import React, { useMemo } from 'react';
import { TASK_COUNT } from '../tasks/taskCatalog';
import { BOS_SYSTEMS, type BosData } from './bosSystems';

/* ==========================================================================
   Operator Console — the admin panel. One minimal control surface over every
   screen this platform actually ships. Counts come from recorded records;
   anything not connected is labelled plainly instead of being filled in.
   ========================================================================== */

export interface AdminScreen {
  id: string;
  label: string;
  group: string;
}

export const ADMIN_SCREENS: AdminScreen[] = [
  { id: 'control', label: 'Control plane', group: 'Command' },
  { id: 'health', label: 'System health', group: 'Command' },
  { id: 'products', label: 'Products', group: 'Catalogue' },
  { id: 'collections', label: 'Collections', group: 'Catalogue' },
  { id: 'categories', label: 'Categories', group: 'Catalogue' },
  { id: 'media', label: 'Media library', group: 'Catalogue' },
  { id: 'orders', label: 'Orders', group: 'Operations' },
  { id: 'inventory', label: 'Inventory', group: 'Operations' },
  { id: 'discounts', label: 'Discounts', group: 'Commerce' },
  { id: 'customers', label: 'Customers', group: 'Customers' },
  { id: 'waitlist', label: 'Waitlist', group: 'Customers' },
  { id: 'suggestions', label: 'Suggestions', group: 'Customers' },
  { id: 'content', label: 'Content', group: 'Growth' },
  { id: 'analytics', label: 'Analytics', group: 'Growth' },
  { id: 'advisor', label: 'Advisor', group: 'Growth' },
  { id: 'atlas', label: 'Atlas', group: 'Platform' },
  { id: 'security', label: 'Security & access', group: 'Platform' },
  { id: 'settings', label: 'Settings', group: 'Platform' },
];

export const SCREEN_LABEL: Record<string, string> = Object.fromEntries(
  ADMIN_SCREENS.map((s) => [s.id, s.label])
);

const STOREFRONT_PAGES = [
  'Home',
  'Archive',
  'Product',
  'Journal',
  'Lookbook',
  'Story',
  'Suggest',
  'About',
  'Service',
  'Legal',
  'Gift cards',
  'Cart',
  'Checkout',
  'Wishlist',
  'Account',
  'Sitemap',
];

const PLATFORM_SERVICES = [
  'BOS dispatcher · 19 systems',
  'Checkout API',
  'Events API',
  'Account API',
  'Supabase realtime',
  'Audit log',
  'CSV export',
];

interface BosConsoleProps {
  data: BosData;
  onOpenScreen: (viewId: string) => void;
  onOpenTasks: () => void;
  onCreateProduct: () => void;
  onExportOrders: () => void;
  onLock: () => void;
  operatorName: string;
}

const REVENUE_STATUSES = ['paid', 'packed', 'shipped', 'delivered'];
const money = (v: number) => `€${Math.round(v || 0).toLocaleString('en-FI')}`;
const num = (v: number) => new Intl.NumberFormat('en-FI').format(Math.round(v || 0));
const shortDate = (value?: string) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const stockOf = (p: BosData['products'][number]) =>
  p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock || 0), 0) : p.stock || 0;

const Kpi: React.FC<{ label: string; value: string; hint: string }> = ({ label, value, hint }) => (
  <div className="bos-kpi">
    <small>{label}</small>
    <b>{value}</b>
    <em>{hint}</em>
  </div>
);

const StatePill: React.FC<{ state: string }> = ({ state }) => (
  <span className={`bos-pill bos-${state.replace(/\s+/g, '-')}`}>{state}</span>
);

export const BosConsole: React.FC<BosConsoleProps> = ({
  data,
  onOpenScreen,
  onOpenTasks,
  onCreateProduct,
  onExportOrders,
  onLock,
  operatorName,
}) => {
  const m = useMemo(() => {
    const settled = data.orders.filter((o) => REVENUE_STATUSES.includes(o.status));
    const revenue = settled.reduce((s, o) => s + (o.totals?.total || 0), 0);
    const units = data.products.reduce((s, p) => s + Math.max(0, stockOf(p)), 0);
    const low = data.products.filter((p) => {
      const n = stockOf(p);
      return n > 0 && n <= 4;
    });
    const out = data.products.filter((p) => stockOf(p) <= 0);
    const pending = data.orders.filter((o) => o.status === 'new');
    const refunds = data.orders.filter((o) => o.status === 'refunded');
    const currentYear = new Date().getFullYear();
    const newClients = data.customers.filter((c) => {
      const d = new Date(c.firstSeen || '');
      return !Number.isNaN(d.getTime()) && d.getFullYear() === currentYear;
    });
    const waitlistOpen = data.waitlist.filter((w) => !w.invited);
    const activeDiscounts = data.discounts.filter((d) => d.active);
    const unitsSold = settled.reduce(
      (s, o) => s + (o.items || []).reduce((q, it) => q + (it.quantity || 0), 0),
      0
    );
    return {
      settled,
      revenue,
      aov: settled.length ? revenue / settled.length : 0,
      units,
      low,
      out,
      pending,
      refunds,
      newClients,
      waitlistOpen,
      activeDiscounts,
      unitsSold,
    };
  }, [data]);

  const screenMetric = (id: string): { metric: string; state: string } => {
    switch (id) {
      case 'control':
        return {
          metric: `${num(m.pending.length + m.low.length + m.out.length + m.refunds.length)} open actions`,
          state: 'Live',
        };
      case 'health':
        return { metric: 'recorded sources · 3 live', state: 'Live' };
      case 'products':
        return { metric: `${num(data.products.length)} products`, state: data.products.length ? 'Live' : 'Empty' };
      case 'collections':
        return { metric: `${num(data.collections.length)} collections`, state: data.collections.length ? 'Live' : 'Empty' };
      case 'categories':
        return { metric: `${num(data.categories.length)} categories`, state: data.categories.length ? 'Live' : 'Empty' };
      case 'media':
        return {
          metric: `${num(data.products.filter((p) => p.images?.length || p.image).length)} with imagery`,
          state: data.products.length ? 'Live' : 'Empty',
        };
      case 'orders':
        return { metric: `${num(data.orders.length)} orders`, state: data.orders.length ? 'Live' : 'Empty' };
      case 'inventory':
        return { metric: `${num(m.units)} units · ${m.low.length} low`, state: data.products.length ? 'Live' : 'Empty' };
      case 'discounts':
        return { metric: `${num(data.discounts.length)} codes`, state: data.discounts.length ? 'Live' : 'Empty' };
      case 'customers':
        return { metric: `${num(data.customers.length)} clients`, state: data.customers.length ? 'Live' : 'Empty' };
      case 'waitlist':
        return { metric: `${num(data.waitlist.length)} entries`, state: data.waitlist.length ? 'Live' : 'Empty' };
      case 'analytics':
        return {
          metric: `${num(data.dailyStats.length)} daily records`,
          state: data.dailyStats.length ? 'Live' : 'Empty',
        };
      case 'security':
        return { metric: `${num(data.auditLogs.length)} audit events`, state: data.auditLogs.length ? 'Live' : 'Empty' };
      case 'suggestions':
        return { metric: 'customer proposals', state: 'Open' };
      case 'content':
        return { metric: 'editorial slots', state: 'Open' };
      case 'advisor':
        return { metric: 'recorded insights', state: 'Open' };
      case 'atlas':
        return { metric: 'platform map', state: 'Open' };
      case 'settings':
        return { metric: 'store configuration', state: 'Open' };
      default:
        return { metric: '—', state: 'Open' };
    }
  };

  const queue = [
    { label: 'Orders awaiting payment', count: m.pending.length, target: 'orders' },
    { label: 'SKUs low on stock', count: m.low.length, target: 'inventory' },
    { label: 'SKUs out of stock', count: m.out.length, target: 'inventory' },
    { label: 'Refunded orders', count: m.refunds.length, target: 'orders' },
    { label: 'Waitlist not invited', count: m.waitlistOpen.length, target: 'waitlist' },
    { label: 'Active promotion codes', count: m.activeDiscounts.length, target: 'discounts' },
  ];

  const groups = useMemo(() => {
    const map = new Map<string, AdminScreen[]>();
    for (const screen of ADMIN_SCREENS) {
      map.set(screen.group, [...(map.get(screen.group) || []), screen]);
    }
    return [...map.entries()];
  }, []);

  return (
    <div className="bos-console">
      <div className="bos-console-head">
        <div>
          <div className="bos-kicker">Command · platform overview</div>
          <h2>Everything, one panel</h2>
          <p>
            {ADMIN_SCREENS.length} screens · {BOS_SYSTEMS.length} business systems ·{' '}
            {TASK_COUNT} everyday tasks · {STOREFRONT_PAGES.length} storefront pages
          </p>
        </div>
        <div className="bos-console-live">
          <span>Operator · {operatorName}</span>
          <span>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
      </div>

      <section className="bos-card bos-controls-banner">
        <div>
          <h3>
            Things you can do
            <span className="bos-b bos-recorded">{TASK_COUNT} tasks</span>
          </h3>
          <p className="bos-sub">
            Plain-language tasks for orders, stock, customers, catalogue, money, content, and the
            team. Choose a task, fill in a normal form, and save. The technical action registry is
            still there for advanced operators.
          </p>
        </div>
        <button type="button" className="bos-btn bos-btn-dark" onClick={onOpenTasks}>
          Open everyday tasks →
        </button>
      </section>

      <div className="bos-kpis">
        <Kpi label="Settled revenue" value={money(m.revenue)} hint={`${m.settled.length} settled orders`} />
        <Kpi label="Orders" value={num(data.orders.length)} hint={`${m.pending.length} awaiting payment`} />
        <Kpi label="Average order" value={money(m.aov)} hint="settled revenue ÷ orders" />
        <Kpi label="Clients" value={num(data.customers.length)} hint={`${m.newClients.length} first seen this year`} />
        <Kpi label="Catalogue" value={num(data.products.length)} hint={`${num(m.units)} units on hand`} />
        <Kpi label="Live visitors" value={num(data.liveVisitors)} hint="recorded sessions now" />
      </div>

      <div className="bos-console-body">
        <section className="bos-card bos-console-systems">
          <h3>
            Admin screens
            <span className="bos-b bos-estimated">{ADMIN_SCREENS.length}</span>
          </h3>
          <div className="bos-syslist">
            {ADMIN_SCREENS.map((screen) => {
              const { metric, state } = screenMetric(screen.id);
              return (
                <button
                  key={screen.id}
                  type="button"
                  className="bos-sysrow"
                  onClick={() => onOpenScreen(screen.id)}
                >
                  <span className="bos-sysname">
                    <b>{screen.label}</b>
                    <small>{screen.group}</small>
                  </span>
                  <span className="bos-sysmetric">{metric}</span>
                  <StatePill state={state} />
                  <span className="bos-sysarrow" aria-hidden="true">
                    →
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="bos-stack">
          <section className="bos-card">
            <h3>
              Action queue
              <span className="bos-b bos-estimated">
                {queue.reduce((s, q) => s + q.count, 0)}
              </span>
            </h3>
            {queue.every((q) => q.count === 0) ? (
              <div className="bos-empty">Queue clear. Nothing needs action.</div>
            ) : (
              <div className="bos-plist">
                {queue.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    className="bos-pitem bos-qrow"
                    onClick={() => onOpenScreen(q.target)}
                    disabled={q.count === 0}
                  >
                    <div>
                      <b>{q.label}</b>
                      <small>{q.count === 0 ? 'clear' : 'open screen to review'}</small>
                    </div>
                    <em>{num(q.count)}</em>
                    <span className="bos-sysarrow" aria-hidden="true">
                      →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="bos-card">
            <h3>
              Data sources
              <span className="bos-b bos-estimated">honest</span>
            </h3>
            <div className="bos-plist">
              <div className="bos-pitem">
                <div>
                  <b>Orders, clients, catalogue</b>
                  <small>recorded in the live database</small>
                </div>
                <StatePill state="Recorded" />
              </div>
              <div className="bos-pitem">
                <div>
                  <b>Business events</b>
                  <small>product views, carts, funnel</small>
                </div>
                <StatePill state="Pending" />
              </div>
              <div className="bos-pitem">
                <div>
                  <b>Inventory ledger</b>
                  <small>movements and reservations</small>
                </div>
                <StatePill state="Pending" />
              </div>
            </div>
          </section>

          <section className="bos-card">
            <h3>
              Recent activity
              <span className="bos-b bos-estimated">audit</span>
            </h3>
            {data.auditLogs.length === 0 ? (
              <div className="bos-empty">No audit events recorded yet.</div>
            ) : (
              <div className="bos-plist">
                {data.auditLogs.slice(0, 5).map((a) => (
                  <div className="bos-pitem" key={a.id}>
                    <div>
                      <b>{a.action}</b>
                      <small>
                        {a.who} · {a.target}
                      </small>
                    </div>
                    <em>{shortDate(a.at)}</em>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="bos-card bos-console-map">
        <h3>
          Platform map
          <span className="bos-b bos-recorded">shipped surfaces</span>
        </h3>
        <p className="bos-sub">
          Every screen and service currently wired into the platform. Admin screens open directly;
          storefront pages are the customer-facing surface and stay untouched.
        </p>
        <div className="bos-mapgrid">
          <div className="bos-mapgroup">
            <h4>Admin screens · {ADMIN_SCREENS.length}</h4>
            <div className="bos-chips">
              {groups.map(([group, items]) => (
                <React.Fragment key={group}>
                  {items.map((screen) => (
                    <button
                      key={screen.id}
                      type="button"
                      className="bos-chip"
                      onClick={() => onOpenScreen(screen.id)}
                      title={`${group} · ${screen.label}`}
                    >
                      {screen.label}
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="bos-mapgroup">
            <h4>Business coverage · {BOS_SYSTEMS.length} systems</h4>
            <div className="bos-chips">
              {BOS_SYSTEMS.map((system) => (
                <span key={system.id} className="bos-chip bos-chip-static">
                  {system.num} · {system.name}
                </span>
              ))}
            </div>
          </div>
          <div className="bos-mapgroup">
            <h4>Storefront pages · {STOREFRONT_PAGES.length}</h4>
            <div className="bos-chips">
              {STOREFRONT_PAGES.map((page) => (
                <span key={page} className="bos-chip bos-chip-static">
                  {page}
                </span>
              ))}
            </div>
          </div>
          <div className="bos-mapgroup">
            <h4>Platform services · {PLATFORM_SERVICES.length}</h4>
            <div className="bos-chips">
              {PLATFORM_SERVICES.map((service) => (
                <span key={service} className="bos-chip bos-chip-static">
                  {service}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="bos-console-actions">
          <button type="button" className="bos-btn" onClick={onCreateProduct}>
            New product
          </button>
          <button type="button" className="bos-btn" onClick={onExportOrders}>
            Export orders CSV
          </button>
          <button type="button" className="bos-btn" onClick={onOpenTasks}>
            Everyday tasks · {TASK_COUNT}
          </button>
          <button type="button" className="bos-btn" onClick={() => onOpenScreen('control')}>
            Control plane
          </button>
          <button type="button" className="bos-btn" onClick={onLock}>
            Lock console
          </button>
        </div>
      </section>
    </div>
  );
};

export default BosConsole;
