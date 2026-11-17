import React, { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Ellipsis,
  LayoutGrid,
  Package,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  Collection,
  Customer,
  Order,
  OrderStatus,
  Product,
  WaitlistEntry,
} from '../../types';

interface JobgioDashboardViewProps {
  adminName: string;
  role: string;
  products: Product[];
  orders: Order[];
  customers: Customer[];
  waitlist: WaitlistEntry[];
  collections: Collection[];
  liveVisitors: number;
  onNavigateView: (view: string) => void;
  onExportOrdersCsv?: () => void;
}

const money = (value: number) =>
  new Intl.NumberFormat('en-FI', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const compact = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value || 0));
};

const number = (value: number) => new Intl.NumberFormat('en-FI').format(value || 0);

const shortDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const stamp = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} · ${date.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' }
  )}`;
};

const REVENUE_STATUSES: OrderStatus[] = ['paid', 'packed', 'shipped', 'delivered'];
const OPEN_STATUSES: OrderStatus[] = ['new', 'paid', 'packed'];

const STATUS_TONE: Record<string, string> = {
  new: '',
  paid: 'jg-blue',
  packed: 'jg-amber',
  shipped: 'jg-blue',
  delivered: 'jg-green',
  cancelled: 'jg-red',
  refunded: 'jg-red',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'Pending',
  paid: 'Paid',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const JobgioDashboardView: React.FC<JobgioDashboardViewProps> = ({
  adminName,
  products,
  orders,
  customers,
  waitlist,
  liveVisitors,
  onNavigateView,
  onExportOrdersCsv,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const stats = useMemo(() => {
    const revenueOrders = orders.filter((o) => REVENUE_STATUSES.includes(o.status));
    const totalRevenue = revenueOrders.reduce((sum, o) => sum + (o.totals?.total || 0), 0);
    const aov = revenueOrders.length ? totalRevenue / revenueOrders.length : 0;
    const openOrders = orders.filter((o) => OPEN_STATUSES.includes(o.status));
    const lowStock = products.filter((p) => {
      const stock = p.variants?.length
        ? p.variants.reduce((s, v) => s + (v.stock || 0), 0)
        : p.stock || 0;
      return stock <= 4;
    }).length;
    const liveProducts = products.filter((p) =>
      ['live', 'sold_out', 'coming_soon'].includes(String(p.status || 'live'))
    ).length;

    return {
      totalRevenue,
      totalOrders: orders.length,
      revenueOrders: revenueOrders.length,
      aov,
      openOrders: openOrders.length,
      customers: customers.length,
      products: products.length,
      liveProducts,
      lowStock,
      waitlist: waitlist.length,
      liveVisitors,
    };
  }, [orders, products, customers, waitlist, liveVisitors]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets: Array<{ key: string; label: string; revenue: number; orders: number }> = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: monthKey(d),
        label: d.toLocaleDateString('en-GB', { month: 'short' }),
        revenue: 0,
        orders: 0,
      });
    }
    const index = new Map(buckets.map((b) => [b.key, b]));
    for (const order of orders) {
      const d = new Date(order.createdAt);
      if (Number.isNaN(d.getTime())) continue;
      const bucket = index.get(monthKey(d));
      if (!bucket) continue;
      bucket.orders += 1;
      if (REVENUE_STATUSES.includes(order.status)) {
        bucket.revenue += order.totals?.total || 0;
      }
    }
    return buckets;
  }, [orders]);

  const hasChartData = monthly.some((m) => m.orders > 0 || m.revenue > 0);

  const pendingOrders = useMemo(
    () =>
      orders
        .filter((o) => OPEN_STATUSES.includes(o.status))
        .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
        .slice(0, 4),
    [orders]
  );

  const tableOrders = useMemo(() => {
    const filtered =
      statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);
    return filtered
      .slice()
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
      .slice(0, 7);
  }, [orders, statusFilter]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = tableOrders.length > 0 && tableOrders.every((o) => selected.has(o.id));

  const statCards = [
    {
      id: 'revenue',
      icon: Wallet,
      value: money(stats.totalRevenue),
      label: 'Recorded Revenue',
      onClick: () => onNavigateView('analytics'),
    },
    {
      id: 'orders',
      icon: ShoppingBag,
      value: compact(stats.totalOrders),
      label: 'Total Orders',
      onClick: () => onNavigateView('orders'),
    },
    {
      id: 'open',
      icon: Clock3,
      value: compact(stats.openOrders),
      label: 'Open Orders',
      featured: true,
      onClick: () => onNavigateView('orders'),
    },
    {
      id: 'customers',
      icon: Users,
      value: compact(stats.customers),
      label: 'Clients',
      onClick: () => onNavigateView('customers'),
    },
    {
      id: 'products',
      icon: Package,
      value: compact(stats.products),
      label: 'Catalogue Pieces',
      onClick: () => onNavigateView('products'),
    },
    {
      id: 'aov',
      icon: CircleDollarSign,
      value: money(stats.aov),
      label: 'Avg Order Value',
      onClick: () => onNavigateView('analytics'),
    },
  ];

  const renderTooltip = (props: any) => {
    const { active, payload, label } = props || {};
    if (!active || !payload?.length) return null;
    const revenue = payload.find((p: any) => p.name === 'Revenue')?.value || 0;
    const count = payload.find((p: any) => p.name === 'Orders')?.value || 0;
    return (
      <div className="jg-tip">
        <div className="mb-1 text-[11px] font-medium text-white/70">{label}</div>
        <div>{money(revenue)}</div>
        <div className="text-[11px] font-medium text-white/70">
          {number(count)} {count === 1 ? 'order' : 'orders'}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Quick stats */}
      <section className="flex flex-col gap-6 xl:flex-row xl:items-center">
        <div className="shrink-0 xl:w-[210px]">
          <div className="jg-heading">Quick Stats</div>
          <div className="jg-sub">
            {adminName ? `Welcome back, ${adminName.split(' ')[0]}. ` : ''}Your live numbers across
            the operating system.
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                type="button"
                onClick={card.onClick}
                className={`jg-stat ${card.featured ? 'jg-featured' : ''}`}
              >
                <span className="jg-stat-icon">
                  <Icon className="h-[19px] w-[19px]" strokeWidth={2} />
                </span>
                <span className="jg-stat-value">{card.value}</span>
                <span className="jg-stat-label">{card.label}</span>
                {card.featured && (
                  <span className="jg-stat-arrow">
                    <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Statistics + pending approvals */}
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.9fr_1fr]">
        <div className="jg-card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="jg-heading-sm">Statistics</div>
            <div className="jg-legend">
              <span>
                <span className="jg-legend-dot" style={{ background: '#0a0a0a' }} />
                Revenue
              </span>
              <span>
                <span className="jg-legend-dot" style={{ background: '#d9d9d9' }} />
                Orders
              </span>
            </div>
          </div>

          <div className="h-[268px] w-full">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} barGap={4} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9a9a9a', fontSize: 12 }}
                    dy={8}
                  />
                  <YAxis
                    yAxisId="revenue"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9a9a9a', fontSize: 11 }}
                    width={44}
                    tickFormatter={(v: number) => `${compact(v)}`}
                  />
                  <YAxis yAxisId="orders" orientation="right" hide />
                  <Tooltip content={renderTooltip} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar
                    yAxisId="revenue"
                    dataKey="revenue"
                    name="Revenue"
                    fill="#0a0a0a"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={16}
                  />
                  <Bar
                    yAxisId="orders"
                    dataKey="orders"
                    name="Orders"
                    fill="#d9d9d9"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="jg-empty">
                <TrendingUp className="h-6 w-6" strokeWidth={1.6} />
                <span>No recorded orders yet. The chart will populate as commerce events arrive.</span>
              </div>
            )}
          </div>
        </div>

        <div className="jg-card">
          <div className="mb-2 flex items-center justify-between">
            <div className="jg-heading-sm">Pending Approvals</div>
            <button
              type="button"
              className="jg-ellipsis"
              aria-label="Pending approvals options"
              onClick={() => onNavigateView('orders')}
            >
              <Ellipsis className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="jg-empty">
              <Check className="h-6 w-6" strokeWidth={1.8} />
              <span>Nothing awaiting action. Every order is settled.</span>
            </div>
          ) : (
            <div>
              {pendingOrders.map((order) => {
                const name = order.customer?.name || order.customer?.email || 'Guest';
                const initial = name.trim().charAt(0).toUpperCase() || '?';
                return (
                  <div key={order.id} className="jg-list-row">
                    <div className="jg-list-logo">{initial}</div>
                    <div className="min-w-0 flex-1">
                      <div className="jg-list-title">{name}</div>
                      <div className="jg-list-sub">
                        {order.number} · {stamp(order.createdAt)}
                      </div>
                    </div>
                    <span className={`jg-pill ${STATUS_TONE[order.status] || ''}`}>
                      {STATUS_LABEL[order.status] || order.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Manage orders */}
      <section className="jg-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="jg-heading-sm">Manage Orders</div>
          <div className="flex items-center gap-2">
            <div className="jg-select-wrap">
              <select
                className="jg-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | OrderStatus)}
                aria-label="Filter orders by status"
              >
                <option value="all">Status</option>
                <option value="new">Pending</option>
                <option value="paid">Paid</option>
                <option value="packed">Packed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
              <ChevronDown className="jg-select-caret h-4 w-4" strokeWidth={2} />
            </div>

            <button type="button" className="jg-btn jg-btn-dark" onClick={onExportOrdersCsv}>
              <Receipt className="h-4 w-4" strokeWidth={1.9} />
              Export
            </button>
          </div>
        </div>

        {tableOrders.length === 0 ? (
          <div className="jg-empty">
            <LayoutGrid className="h-6 w-6" strokeWidth={1.6} />
            <span>No orders match this view.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div
                className="jg-table-head"
                style={{ gridTemplateColumns: '2.3fr 1.7fr 1fr 1.3fr 40px' }}
              >
                <div className="flex items-center gap-3 pl-1">
                  <button
                    type="button"
                    className={`jg-check ${allSelected ? 'jg-on' : ''}`}
                    aria-label="Select all orders"
                    onClick={() =>
                      setSelected(allSelected ? new Set() : new Set(tableOrders.map((o) => o.id)))
                    }
                  >
                    {allSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <span>Order</span>
                </div>
                <span>Client</span>
                <span>Status</span>
                <span>Placed</span>
                <span />
              </div>

              {tableOrders.map((order, index) => {
                const isSelected = selected.has(order.id);
                const name = order.customer?.name || order.customer?.email || 'Guest';
                return (
                  <div
                    key={order.id}
                    className={`jg-row ${index % 2 === 1 ? 'jg-alt' : ''}`}
                    style={{ gridTemplateColumns: '2.3fr 1.7fr 1fr 1.3fr 40px' }}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className={`jg-check ${isSelected ? 'jg-on' : ''}`}
                        aria-label={`Select order ${order.number}`}
                        onClick={() => toggleRow(order.id)}
                      >
                        {isSelected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </button>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="jg-list-logo h-9 w-9 text-[12px]">
                          {(name.charAt(0) || '?').toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div className="jg-cell-strong truncate">{order.number}</div>
                          <div className="jg-cell-muted">
                            {order.items?.length || 0} item
                            {(order.items?.length || 0) === 1 ? '' : 's'} · {money(order.totals?.total || 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="jg-cell truncate">{name}</div>

                    <div>
                      <span className={`jg-pill ${STATUS_TONE[order.status] || ''}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </div>

                    <div className="jg-cell-muted">{stamp(order.createdAt)}</div>

                    <button
                      type="button"
                      className="jg-ellipsis"
                      aria-label={`Open order ${order.number}`}
                      onClick={() => onNavigateView('orders')}
                    >
                      <Ellipsis className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export { JobgioDashboardView };
export default JobgioDashboardView;
