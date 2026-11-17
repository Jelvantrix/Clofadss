import type { CSSProperties } from 'react';
import type {
  AuditLog,
  Category,
  Collection,
  Customer,
  DailyStat,
  Discount,
  Order,
  OrderStatus,
  Product,
  WaitlistEntry,
} from '../../types';
import type { BosChartFormat, BosChartSpec, BosChartType } from './BosChart';

/* ==========================================================================
   19-system registry + real-data derivation.
   Every number is computed from records already in the workspace. When a
   system's source data is not yet recorded, the screen shows an honest empty
   state rather than invented statistics.
   ========================================================================== */

export interface BosSystemMeta {
  id: string;
  num: string;
  group: string;
  name: string;
}

export const BOS_SYSTEMS: BosSystemMeta[] = [
  { id: '01', num: '01', group: 'Command', name: 'Operator Console' },
  { id: '02', num: '02', group: 'Customers', name: 'Customer Analytics' },
  { id: '03', num: '03', group: 'Customers', name: 'CRM' },
  { id: '04', num: '04', group: 'Merchandising', name: 'Product Performance' },
  { id: '05', num: '05', group: 'Merchandising', name: 'Product Catalog' },
  { id: '06', num: '06', group: 'Operations', name: 'Inventory' },
  { id: '07', num: '07', group: 'Operations', name: 'Orders' },
  { id: '08', num: '08', group: 'Operations', name: 'Fulfillment' },
  { id: '09', num: '09', group: 'Operations', name: 'Returns & Refunds' },
  { id: '10', num: '10', group: 'Merchandising', name: 'Pricing & Promotions' },
  { id: '11', num: '11', group: 'Growth', name: 'Marketing' },
  { id: '12', num: '12', group: 'Growth', name: 'Sales Channels' },
  { id: '13', num: '13', group: 'Customers', name: 'Loyalty & Referrals' },
  { id: '14', num: '14', group: 'Customers', name: 'Support' },
  { id: '15', num: '15', group: 'Customers', name: 'Reviews & Feedback' },
  { id: '16', num: '16', group: 'Finance & Supply', name: 'Finance' },
  { id: '17', num: '17', group: 'Finance & Supply', name: 'Suppliers' },
  { id: '18', num: '18', group: 'Platform', name: 'Workforce & Access' },
  { id: '19', num: '19', group: 'Platform', name: 'Governance & Automation' },
];

export const BOS_GROUPS = [
  'Command',
  'Customers',
  'Merchandising',
  'Operations',
  'Growth',
  'Finance & Supply',
  'Platform',
];

export interface BosStat {
  label: string;
  value: string;
  hint: string;
}

export interface BosGoal {
  label: string;
  value: string;
  target: string;
  ratio: number;
}

export interface BosActivity {
  title: string;
  time: string;
  dotStyle?: CSSProperties;
}

export interface BosSystemModel {
  meta: BosSystemMeta;
  stats: BosStat[];
  charts: BosChartSpec[];
  goals?: BosGoal[];
  activity?: BosActivity[];
}

export type BosRange = 'today' | '7d' | '30d' | 'all';
export type BosRegion = 'all' | 'eu' | 'us' | 'uk' | 'other';

export interface BosData {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  collections: Collection[];
  categories: Category[];
  waitlist: WaitlistEntry[];
  discounts: Discount[];
  auditLogs: AuditLog[];
  dailyStats: DailyStat[];
  liveVisitors: number;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const REVENUE_STATUSES: OrderStatus[] = ['paid', 'packed', 'shipped', 'delivered'];

const isRevenue = (o: Order) => REVENUE_STATUSES.includes(o.status);
const orderTotal = (o: Order) => o.totals?.total || 0;

const money = (v: number) =>
  `€${Math.round(Number.isFinite(v) ? v : 0).toLocaleString('en-FI')}`;
const num = (v: number) =>
  new Intl.NumberFormat('en-FI').format(Math.round(Number.isFinite(v) ? v : 0));
const pct = (v: number, digits = 1) =>
  `${(Number.isFinite(v) ? v : 0).toFixed(digits)}%`;
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

const nameOf = (p: Product) => p.name?.en || p.name?.fi || p.plateNumber || p.id;
const stockOf = (p: Product) =>
  p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock || 0), 0) : p.stock || 0;

const revenueOf = (orders: Order[]) =>
  orders.filter(isRevenue).reduce((s, o) => s + orderTotal(o), 0);

const unitsOf = (orders: Order[]) =>
  orders
    .filter(isRevenue)
    .reduce((s, o) => s + (o.items || []).reduce((q, it) => q + (it.quantity || 0), 0), 0);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const monthlyBuckets = (n = 12) => {
  const now = new Date();
  const rows: Array<{ key: string; label: string }> = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    rows.push({ key: monthKey(d), label: MONTHS[d.getMonth()] });
  }
  return rows;
};

const dailyBuckets = (n = 7) => {
  const now = new Date();
  const rows: Array<{ key: string; label: string; date: Date }> = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    rows.push({ key: dayKey(d), label: DAYS[d.getDay()], date: d });
  }
  return rows;
};

const byMonth = (
  orders: Order[],
  pick: (o: Order) => number,
  n = 12
): { labels: string[]; data: number[] } => {
  const buckets = monthlyBuckets(n);
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  const data = new Array(buckets.length).fill(0);
  for (const o of orders) {
    const d = new Date(o.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const i = index.get(monthKey(d));
    if (i === undefined) continue;
    data[i] += pick(o);
  }
  return { labels: buckets.map((b) => b.label), data };
};

const byDay = (
  orders: Order[],
  pick: (o: Order) => number,
  n = 7
): { labels: string[]; data: number[] } => {
  const buckets = dailyBuckets(n);
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  const data = new Array(buckets.length).fill(0);
  for (const o of orders) {
    const d = new Date(o.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const i = index.get(dayKey(d));
    if (i === undefined) continue;
    data[i] += pick(o);
  }
  return { labels: buckets.map((b) => b.label), data };
};

const productCategoryMap = (products: Product[]) => {
  const map = new Map<string, string>();
  for (const p of products) map.set(p.id, p.category || 'Other');
  return map;
};

const categoryLabel = (raw: string) =>
  raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Other';

const topEntries = (map: Map<string, number>, limit = 6) =>
  [...map.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

const chart = (
  title: string,
  type: BosChartType,
  labels: string[],
  data: number[],
  format?: BosChartFormat,
  status: BosChartSpec['status'] = 'recorded',
  emptyHint?: string
): BosChartSpec => ({ title, type, labels, data, format, status, emptyHint });

const emptyChart = (
  title: string,
  type: BosChartType,
  labels: string[],
  hint: string,
  format?: BosChartFormat
): BosChartSpec => ({
  title,
  type,
  labels,
  data: [],
  format,
  status: 'recorded',
  emptyHint: hint,
});

const stat = (label: string, value: string, hint: string): BosStat => ({ label, value, hint });

/* -------------------------------------------------------------------------- */
/* Shared derivations                                                         */
/* -------------------------------------------------------------------------- */

interface Derived {
  revenue: number;
  paidOrders: Order[];
  aov: number;
  units: number;
  totalOrders: number;
  pending: number;
  cancelled: number;
  refunded: number;
  lowStock: number;
  stockouts: number;
  unitsOnHand: number;
  inventoryValue: number;
  repeatRate: number;
  buyers: number;
  repeatBuyers: number;
  newCustomers: number;
  ltv: number;
  retention: number;
  discountsGiven: number;
  shippingRevenue: number;
  vatTotal: number;
  countries: Map<string, number>;
  sizes: Map<string, number>;
  statusCounts: Map<string, number>;
}

const derive = (data: BosData): Derived => {
  const paidOrders = data.orders.filter(isRevenue);
  const revenue = paidOrders.reduce((s, o) => s + orderTotal(o), 0);
  const units = unitsOf(data.orders);
  const buyersMap = new Map<string, { orders: number; spend: number; last: number }>();
  for (const o of paidOrders) {
    const key = o.customer?.email || o.customer?.name || 'guest';
    const prev = buyersMap.get(key) || { orders: 0, spend: 0, last: 0 };
    prev.orders += 1;
    prev.spend += orderTotal(o);
    prev.last = Math.max(prev.last, Date.parse(o.createdAt) || 0);
    buyersMap.set(key, prev);
  }
  const buyers = buyersMap.size;
  const repeatBuyers = [...buyersMap.values()].filter((b) => b.orders > 1).length;

  const countries = new Map<string, number>();
  const sizes = new Map<string, number>();
  const statusCounts = new Map<string, number>();
  let shippingRevenue = 0;
  let vatTotal = 0;
  let discountsGiven = 0;
  for (const o of data.orders) {
    statusCounts.set(o.status, (statusCounts.get(o.status) || 0) + 1);
    if (!isRevenue(o)) continue;
    shippingRevenue += o.totals?.shipping || 0;
    vatTotal += o.totals?.vat || 0;
    discountsGiven += o.totals?.discount || 0;
    const country = o.customer?.address?.country;
    if (country) countries.set(country, (countries.get(country) || 0) + orderTotal(o));
    for (const it of o.items || []) {
      if (it.size) sizes.set(it.size, (sizes.get(it.size) || 0) + (it.quantity || 0));
    }
  }

  const lowStock = data.products.filter((p) => stockOf(p) > 0 && stockOf(p) <= 4).length;
  const stockouts = data.products.filter((p) => stockOf(p) <= 0).length;
  const unitsOnHand = data.products.reduce((s, p) => s + Math.max(0, stockOf(p)), 0);
  const inventoryValue = data.products.reduce(
    (s, p) => s + Math.max(0, stockOf(p)) * (p.price || 0),
    0
  );

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newCustomers = data.customers.filter((c) => {
    const t = Date.parse(c.firstSeen || '');
    return !Number.isNaN(t) && t >= thirtyDaysAgo;
  }).length;

  return {
    revenue,
    paidOrders,
    aov: safeDiv(revenue, paidOrders.length),
    units,
    totalOrders: data.orders.length,
    pending: data.orders.filter((o) => ['new', 'paid', 'packed'].includes(o.status)).length,
    cancelled: data.orders.filter((o) => o.status === 'cancelled').length,
    refunded: data.orders.filter((o) => o.status === 'refunded').length,
    lowStock,
    stockouts,
    unitsOnHand,
    inventoryValue,
    repeatRate: safeDiv(repeatBuyers, buyers) * 100,
    buyers,
    repeatBuyers,
    newCustomers,
    ltv: safeDiv(revenue, Math.max(1, data.customers.length)),
    retention: safeDiv(repeatBuyers, buyers) * 100,
    discountsGiven,
    shippingRevenue,
    vatTotal,
    countries,
    sizes,
    statusCounts,
  };
};

/* -------------------------------------------------------------------------- */
/* System builders                                                            */
/* -------------------------------------------------------------------------- */

const build01 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[0];

  const monthlyRevenue = byMonth(data.orders.filter(isRevenue), orderTotal, 12);

  // Today's hourly revenue
  const hourLabels = ['8am', '10am', '12pm', '2pm', '4pm', '6pm'];
  const hourBuckets = [8, 10, 12, 14, 16, 18];
  const today = new Date().toDateString();
  const hourly = hourLabels.map((_, i) => {
    const hour = hourBuckets[i];
    return data.orders
      .filter((o) => isRevenue(o) && new Date(o.createdAt).toDateString() === today)
      .filter((o) => {
        const h = new Date(o.createdAt).getHours();
        return h >= hour && h < hour + 2;
      })
      .reduce((s, o) => s + orderTotal(o), 0);
  });

  const week = byDay(data.orders.filter(isRevenue), orderTotal, 7);

  const regionEntries = topEntries(d.countries, 5);
  const regionLabels = regionEntries.map(([c]) => c);
  const regionData = regionEntries.map(([, v]) => v);

  // Simple linear forecast from recorded monthly revenue (clearly labelled).
  const history = monthlyRevenue.data;
  const recent = history.slice(-6);
  const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const trend =
    recent.length >= 2
      ? (recent[recent.length - 1] - recent[0]) / Math.max(1, recent.length - 1)
      : 0;
  const futureLabels = ['M+1', 'M+2', 'M+3', 'M+4', 'M+5', 'M+6'];
  const forecast = futureLabels.map((_, i) => Math.max(0, avg + trend * (i + 1)));

  const newByMonth = byMonth(
    data.orders.filter(isRevenue),
    (o) => {
      const email = o.customer?.email;
      const c = data.customers.find((x) => x.email === email);
      if (!c?.firstSeen) return 0;
      const first = new Date(c.firstSeen);
      const created = new Date(o.createdAt);
      return monthKey(first) === monthKey(created) ? 1 : 0;
    },
    12
  );

  const catMap = productCategoryMap(data.products);
  const catValue = new Map<string, number>();
  for (const p of data.products) {
    const cat = categoryLabel(catMap.get(p.id) || 'Other');
    catValue.set(cat, (catValue.get(cat) || 0) + Math.max(0, stockOf(p)) * (p.price || 0));
  }
  const catEntries = topEntries(catValue, 6);

  const goals: BosGoal[] = [
    {
      label: 'Recorded revenue',
      value: money(d.revenue),
      target: 'no target set',
      ratio: 0,
    },
    {
      label: 'Orders settled',
      value: num(d.paidOrders.length),
      target: `${num(d.totalOrders)} total`,
      ratio: safeDiv(d.paidOrders.length, Math.max(1, d.totalOrders)),
    },
    {
      label: 'Repeat purchase rate',
      value: pct(d.repeatRate),
      target: 'of paying clients',
      ratio: d.repeatRate / 100,
    },
  ];

  const activity: BosActivity[] = data.orders
    .slice()
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))
    .slice(0, 5)
    .map((o) => {
      const t = Date.parse(o.createdAt || '');
      return {
        title: `New order ${o.number} — ${money(orderTotal(o))}`,
        time: Number.isNaN(t) ? '—' : timeAgo(t),
        dotStyle:
          o.status === 'delivered'
            ? { background: '#000' }
            : o.status === 'cancelled' || o.status === 'refunded'
              ? { background: '#999' }
              : o.status === 'new'
                ? { borderStyle: 'dashed' }
                : undefined,
      };
    });

  return {
    meta,
    stats: [
      stat('Total Revenue', money(d.revenue), '● gross of recorded orders'),
      stat('Orders', num(d.totalOrders), `● ${num(d.pending)} pending`),
      stat('Customers', num(data.customers.length), `● ${num(d.newCustomers)} new this month`),
      stat(
        'Conv. Rate',
        data.liveVisitors > 0 ? pct(safeDiv(d.totalOrders, data.liveVisitors) * 100) : '—',
        data.liveVisitors > 0 ? '● live visitor window' : '● awaiting traffic events'
      ),
    ],
    goals,
    activity,
    charts: [
      chart("Today's Statistics", 'line', hourLabels, hourly, 'money'),
      chart('Revenue — last 7 days', 'bar', week.labels, week.data, 'money'),
      chart(
        'Sales by Region',
        'hbar',
        regionLabels.length ? regionLabels : ['No region data'],
        regionData,
        'money',
        'recorded',
        'No shipping regions recorded yet.'
      ),
      chart('Revenue — 12 months', 'area', monthlyRevenue.labels, monthlyRevenue.data, 'money'),
      emptyChart(
        'Orders by Channel',
        'donut',
        ['Website', 'Mobile', 'Social', 'Market', 'Retail'],
        'Channel attribution is not recorded on orders yet.'
      ),
      chart(
        'Revenue Forecast',
        'area',
        futureLabels,
        forecast,
        'money',
        'forecast',
        'Forecast requires at least two months of recorded revenue.'
      ),
      chart(
        'Customer Acquisition',
        'bar',
        newByMonth.labels,
        newByMonth.data,
        'number'
      ),
      chart(
        'Inventory Valuation by Category',
        'hbar',
        catEntries.map(([c]) => c),
        catEntries.map(([, v]) => v),
        'money',
        'estimated',
        'Inventory valuation requires catalogue stock and price.'
      ),
    ],
  };
};

const build02 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[1];
  const catMap = productCategoryMap(data.products);
  const purchasesByCat = new Map<string, number>();
  for (const o of data.orders.filter(isRevenue)) {
    for (const it of o.items || []) {
      const cat = categoryLabel(catMap.get(it.productId) || 'Other');
      purchasesByCat.set(cat, (purchasesByCat.get(cat) || 0) + (it.quantity || 0));
    }
  }
  const cats = topEntries(purchasesByCat, 6);

  // Cohort retention from recorded first-seen + order months.
  const months = monthlyBuckets(4);
  const matrix: number[][] = [];
  const rowLabels: string[] = [];
  for (const bucket of months) {
    const cohort = data.customers.filter((c) => monthKey(new Date(c.firstSeen || 0)) === bucket.key);
    rowLabels.push(bucket.label);
    const row: number[] = [];
    for (let offset = 0; offset < 4; offset += 1) {
      const targetMonth = new Date(
        Number(bucket.key.slice(0, 4)),
        Number(bucket.key.slice(5, 7)) - 1 + offset,
        1
      );
      const targetKey = monthKey(targetMonth);
      const retained = cohort.filter((c) =>
        data.orders.some(
          (o) =>
            o.customer?.email === c.email &&
            monthKey(new Date(o.createdAt)) === targetKey
        )
      ).length;
      row.push(cohort.length ? retained / cohort.length : 0);
    }
    matrix.push(row);
  }

  return {
    meta,
    stats: [
      stat('Unique Visitors', num(data.liveVisitors), '● live, last 5 minutes'),
      stat('Paying Clients', num(d.buyers), '● recorded buyers'),
      stat('Repeat Purchase', pct(d.repeatRate), '● clients with 2+ orders'),
      stat('Avg Lifetime Value', money(d.ltv), '● recorded spend / client'),
    ],
    charts: [
      chart(
        'Purchases by Category',
        'bar',
        cats.map(([c]) => c),
        cats.map(([, v]) => v),
        'number',
        'recorded',
        'No purchases recorded by category yet.'
      ),
      emptyChart(
        'Conversion Funnel',
        'hbar',
        ['Views', 'Carts', 'Checkout', 'Paid'],
        'Funnel stages require ProductViewed / CartAdded events.'
      ),
      {
        title: 'Cohort Retention',
        type: 'heat',
        labels: ['M0', 'M1', 'M2', 'M3'],
        data: [],
        matrix,
        rowLabels,
        status: 'recorded',
        emptyHint: 'Cohort retention requires client first-seen dates and orders.',
      },
      emptyChart(
        'Acquisition by Channel',
        'donut',
        ['Website', 'Mobile', 'Social', 'Market', 'Retail'],
        'Acquisition channel is not recorded on customers yet.'
      ),
    ],
  };
};

const build03 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[2];
  const monthly = byMonth(data.orders.filter(isRevenue), orderTotal, 12);
  const newSeries = byMonth(
    data.orders.filter(isRevenue),
    (o) => {
      const c = data.customers.find((x) => x.email === o.customer?.email);
      return c?.firstSeen && monthKey(new Date(c.firstSeen)) === monthKey(new Date(o.createdAt)) ? 1 : 0;
    },
    12
  );
  const returningSeries = newSeries.data.map((v, i) => Math.max(0, monthly.data.length - v));

  // RFM buckets from recorded buyers.
  const buyers = new Map<string, { orders: number; spend: number; last: number }>();
  for (const o of data.orders.filter(isRevenue)) {
    const key = o.customer?.email || o.customer?.name || 'guest';
    const prev = buyers.get(key) || { orders: 0, spend: 0, last: 0 };
    prev.orders += 1;
    prev.spend += orderTotal(o);
    prev.last = Math.max(prev.last, Date.parse(o.createdAt) || 0);
    buyers.set(key, prev);
  }
  const now = Date.now();
  const rfm = { Champions: 0, Loyal: 0, 'At risk': 0, Lost: 0, New: 0 };
  for (const b of buyers.values()) {
    const days = (now - b.last) / (24 * 60 * 60 * 1000);
    if (b.orders >= 3) rfm.Champions += 1;
    else if (b.orders === 2) rfm.Loyal += 1;
    else if (days > 180) rfm.Lost += 1;
    else if (days > 90) rfm['At risk'] += 1;
    else rfm.New += 1;
  }

  const ltvBuckets = [0, 0, 0, 0, 0];
  for (const b of buyers.values()) {
    if (b.spend < 50) ltvBuckets[0] += 1;
    else if (b.spend < 100) ltvBuckets[1] += 1;
    else if (b.spend < 250) ltvBuckets[2] += 1;
    else if (b.spend < 500) ltvBuckets[3] += 1;
    else ltvBuckets[4] += 1;
  }

  return {
    meta,
    stats: [
      stat('Customers', num(data.customers.length), '● recorded profiles'),
      stat('Avg Lifetime Value', money(d.ltv), '● spend / profile'),
      stat('Avg Order Value', money(d.aov), '● settled orders'),
      stat('Retention Rate', pct(d.retention), '● repeat buyers'),
    ],
    charts: [
      chart('New vs Returning', 'area', monthly.labels, newSeries.data, 'number'),
      {
        title: 'RFM Segments',
        type: 'donut',
        labels: Object.keys(rfm),
        data: Object.values(rfm),
        status: 'recorded',
        emptyHint: 'RFM segmentation requires recorded buyers.',
      },
      chart(
        'Lifetime Value Distribution',
        'bar',
        ['<50', '50–100', '100–250', '250–500', '500+'],
        ltvBuckets,
        'number'
      ),
    ],
  };
};

const build04 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[3];
  const byProduct = new Map<string, { revenue: number; units: number }>();
  for (const o of data.orders.filter(isRevenue)) {
    for (const it of o.items || []) {
      const prev = byProduct.get(it.productName) || { revenue: 0, units: 0 };
      prev.revenue += (it.price || 0) * (it.quantity || 0);
      prev.units += it.quantity || 0;
      byProduct.set(it.productName, prev);
    }
  }
  const top = [...byProduct.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5);
  const sizes = topEntries(d.sizes, 5);

  return {
    meta,
    stats: [
      stat('Active Products', num(data.products.length), '● in catalogue'),
      stat('Units Sold', num(d.units), '● settled orders'),
      stat('Product Revenue', money(d.revenue), '● settled orders'),
      stat('Avg Price', money(safeDiv(d.revenue, Math.max(1, d.units))), '● per unit'),
    ],
    charts: [
      chart(
        'Top Products by Revenue',
        'hbar',
        top.map(([n]) => n),
        top.map(([, v]) => v.revenue),
        'money',
        'recorded',
        'No product revenue recorded yet.'
      ),
      emptyChart(
        'Attention vs Sales',
        'scatter',
        ['Product views →'],
        'Requires ProductViewed events joined to purchases.'
      ),
      chart(
        'Variant Performance by Size',
        'bar',
        sizes.map(([s]) => s),
        sizes.map(([, v]) => v),
        'number',
        'recorded',
        'No size-level sales recorded yet.'
      ),
      emptyChart(
        'Return Rate by Product',
        'bar',
        ['Jacket', 'Coat', 'Denim', 'Polo', 'Shirt'],
        'Return reasons are not recorded per product yet.'
      ),
    ],
  };
};

const build05 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[4];
  const statusCounts = new Map<string, number>();
  for (const p of data.products) {
    const s = String(p.status || 'live');
    statusCounts.set(s, (statusCounts.get(s) || 0) + 1);
  }
  const statusLabels = [...statusCounts.keys()].map((s) =>
    s.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())
  );
  const statusData = [...statusCounts.values()];

  const monthlyCreated = byMonth(
    data.products.map(
      (p) =>
        ({
          createdAt: p.createdAt || new Date().toISOString(),
          status: 'paid',
          totals: { total: 1 },
        }) as unknown as Order
    ),
    () => 1,
    12
  );

  const byCategory = new Map<string, number>();
  for (const p of data.products) {
    const c = categoryLabel(p.category || 'Other');
    byCategory.set(c, (byCategory.get(c) || 0) + 1);
  }
  const cats = topEntries(byCategory, 6);

  const skuCount = data.products.reduce(
    (s, p) => s + (p.variants?.length || (p.sizes?.length || 1)),
    0
  );
  const drafts = data.products.filter((p) => p.status === 'draft').length;
  const scheduled = data.products.filter((p) => p.status === 'coming_soon').length;

  return {
    meta,
    stats: [
      stat('Active Products', num(data.products.length - drafts), '● live catalogue'),
      stat('Active SKUs', num(skuCount), '● product × variant'),
      stat('Drafts', num(drafts), '● unpublished'),
      stat('Scheduled', num(scheduled), '● coming soon'),
    ],
    charts: [
      {
        title: 'Products by Status',
        type: 'donut',
        labels: statusLabels,
        data: statusData,
        status: 'recorded',
        emptyHint: 'No products recorded yet.',
      },
      chart('SKUs Created per Month', 'bar', monthlyCreated.labels, monthlyCreated.data, 'number'),
      chart(
        'Products per Category',
        'hbar',
        cats.map(([c]) => c),
        cats.map(([, v]) => v),
        'number'
      ),
    ],
  };
};

const build06 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[5];
  const byCategory = new Map<string, number>();
  const byCategoryValue = new Map<string, number>();
  for (const p of data.products) {
    const c = categoryLabel(p.category || 'Other');
    byCategory.set(c, (byCategory.get(c) || 0) + Math.max(0, stockOf(p)));
    byCategoryValue.set(
      c,
      (byCategoryValue.get(c) || 0) + Math.max(0, stockOf(p)) * (p.price || 0)
    );
  }
  const cats = topEntries(byCategory, 6);
  const values = topEntries(byCategoryValue, 6);
  const sizes = topEntries(d.sizes, 5);

  return {
    meta,
    stats: [
      stat('Units on Hand', num(d.unitsOnHand), '● across variants'),
      stat('Inventory Value', money(d.inventoryValue), '● stock × price'),
      stat('Low-stock SKUs', num(d.lowStock), '● 1–4 units'),
      stat('Stockouts', num(d.stockouts), '● zero available'),
    ],
    charts: [
      chart(
        'Stock on Hand by Category',
        'bar',
        cats.map(([c]) => c),
        cats.map(([, v]) => v),
        'number'
      ),
      emptyChart(
        'Stockouts per Week',
        'line',
        ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
        'Stockout history requires the inventory movement ledger.'
      ),
      chart(
        'Inventory Valuation',
        'hbar',
        values.map(([c]) => c),
        values.map(([, v]) => v),
        'money',
        'estimated'
      ),
      chart(
        'Sell-out by Size',
        'bar',
        sizes.map(([s]) => s),
        sizes.map(([, v]) => v),
        'number',
        'recorded',
        'No size-level sales recorded yet.'
      ),
    ],
  };
};

const build07 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[6];
  const perDay = byDay(data.orders, () => 1, 7);
  const statusLabels = [...d.statusCounts.keys()].map(
    (s) => s.charAt(0).toUpperCase() + s.slice(1)
  );
  const statusData = [...d.statusCounts.values()];

  const valBuckets = [0, 0, 0, 0, 0];
  for (const o of data.orders.filter(isRevenue)) {
    const t = orderTotal(o);
    if (t < 50) valBuckets[0] += 1;
    else if (t < 100) valBuckets[1] += 1;
    else if (t < 200) valBuckets[2] += 1;
    else if (t < 400) valBuckets[3] += 1;
    else valBuckets[4] += 1;
  }

  return {
    meta,
    stats: [
      stat('Orders', num(d.totalOrders), '● all recorded'),
      stat('Pending Payment', num(data.orders.filter((o) => o.status === 'new').length), '● status new'),
      stat('Avg Order Value', money(d.aov), '● settled orders'),
      stat('Cancel Rate', pct(safeDiv(d.cancelled, Math.max(1, d.totalOrders)) * 100), '● of all orders'),
    ],
    charts: [
      chart('Orders per Day', 'line', perDay.labels, perDay.data, 'number'),
      {
        title: 'Orders by Status',
        type: 'donut',
        labels: statusLabels,
        data: statusData,
        status: 'recorded',
        emptyHint: 'No orders recorded yet.',
      },
      chart(
        'Order Value Distribution',
        'bar',
        ['<50', '50–100', '100–200', '200–400', '400+'],
        valBuckets,
        'number'
      ),
    ],
  };
};

const build08 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[7];
  const shipments = data.orders.filter((o) => ['shipped', 'delivered'].includes(o.status));
  const courier = new Map<string, number>();
  for (const o of data.orders) {
    const m = o.shippingMethod || 'Unspecified';
    courier.set(m, (courier.get(m) || 0) + (o.totals?.shipping || 0));
  }
  const couriers = topEntries(courier, 6);

  return {
    meta,
    stats: [
      stat('Shipments', num(shipments.length), '● shipped or delivered'),
      stat('On-time Rate', '—', '● delivery SLA not recorded'),
      stat('Delayed', '—', '● delay events not recorded'),
      stat('Shipping Cost', money(d.shippingRevenue), '● charged to clients'),
    ],
    charts: [
      emptyChart(
        'Delivery Time (days)',
        'line',
        ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
        'Delivery timestamps require the shipment ledger.'
      ),
      emptyChart(
        'On-time vs Late',
        'donut',
        ['On time', 'Late', 'Failed'],
        'Delivery outcomes are not recorded yet.'
      ),
      chart(
        'Shipping Cost by Method',
        'hbar',
        couriers.map(([c]) => c),
        couriers.map(([, v]) => v),
        'money'
      ),
      emptyChart(
        'Shipments by Warehouse',
        'bar',
        ['North', 'South', 'East', 'West'],
        'Warehouse assignments are not recorded yet.'
      ),
    ],
  };
};

const build09 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[8];
  const refunds = data.orders.filter((o) => o.status === 'refunded');
  const refundedValue = refunds.reduce((s, o) => s + orderTotal(o), 0);
  const year = monthlyBuckets(12);
  const refundSeries = byMonth(
    data.orders,
    (o) => (o.status === 'refunded' ? orderTotal(o) : 0),
    12
  );
  const rateSeries = year.map((_, i) => {
    const total = byMonth(data.orders, () => 1, 12).data[i];
    const refunded = byMonth(
      data.orders,
      (o) => (o.status === 'refunded' ? 1 : 0),
      12
    ).data[i];
    return safeDiv(refunded, Math.max(1, total)) * 100;
  });

  const week = byDay(
    data.orders,
    (o) => (o.status === 'refunded' ? orderTotal(o) : 0),
    7
  );

  return {
    meta,
    stats: [
      stat('Return Requests', num(refunds.length), '● recorded refunds'),
      stat('Refunds Issued', money(refundedValue), '● refunded order value'),
      stat('Return Rate', pct(safeDiv(refunds.length, Math.max(1, d.totalOrders)) * 100), '● refunds / orders'),
      stat('Restock Rate', '—', '● inspection not recorded'),
    ],
    charts: [
      chart('Return Rate', 'line', year.map((b) => b.label), rateSeries, 'percent'),
      emptyChart(
        'Return Reasons',
        'hbar',
        ['Too small', 'Too large', 'Defect', 'Not as pictured', 'Changed mind'],
        'Return reasons require the returns ledger.'
      ),
      chart('Refunds Issued', 'bar', week.labels, week.data, 'money'),
    ],
  };
};

const build10 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[9];
  const discountMonthly = byMonth(
    data.orders.filter(isRevenue),
    (o) => o.totals?.discount || 0,
    12
  );
  const redemptionsWeekly = byDay(
    data.orders.filter(isRevenue),
    (o) => ((o.totals?.discount || 0) > 0 ? 1 : 0),
    7
  );
  const redemptionCount = data.orders.filter(
    (o) => isRevenue(o) && (o.totals?.discount || 0) > 0
  ).length;

  return {
    meta,
    stats: [
      stat('Active Promotions', num(data.discounts.length), '● configured codes'),
      stat('Discount Given', money(d.discountsGiven), '● settled orders'),
      stat('Redemptions', num(redemptionCount), '● orders with discount'),
      stat('Margin After Discount', '—', '● product cost not recorded'),
    ],
    charts: [
      chart('Discount Impact on Revenue', 'bar', discountMonthly.labels, discountMonthly.data, 'money'),
      chart('Promo Redemptions', 'line', redemptionsWeekly.labels, redemptionsWeekly.data, 'number'),
      emptyChart(
        'Revenue by Discount Code',
        'hbar',
        ['WELCOME10', 'SUMMER20', 'VIP15', 'FREESHIP', 'BUNDLE'],
        'Discount codes are not stored on orders yet.'
      ),
    ],
  };
};

const build11 = (data: BosData): BosSystemModel => {
  const meta = BOS_SYSTEMS[10];
  return {
    meta,
    stats: [
      stat('Ad Spend', '—', '● campaigns not recorded'),
      stat('ROAS', '—', '● campaigns not recorded'),
      stat('CAC', '—', '● campaigns not recorded'),
      stat('Campaigns Live', '—', '● campaigns not recorded'),
    ],
    charts: [
      emptyChart('Ad Spend vs Revenue', 'line', MONTHS, 'Marketing campaign expenditure is not recorded yet.'),
      emptyChart('CAC by Channel', 'bar', ['Website', 'Mobile', 'Social', 'Market', 'Retail'], 'Acquisition cost requires campaign data.'),
      emptyChart('ROAS by Campaign', 'hbar', ['Search', 'Retarget', 'Influencer', 'Email', 'Display'], 'ROAS requires campaign spend and attribution.'),
      emptyChart('Attribution Models', 'bar', ['First touch', 'Last touch', 'Linear'], 'Attribution has no recorded touchpoints yet.'),
    ],
  };
};

const build12 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[11];
  const regions = topEntries(d.countries, 6);
  return {
    meta,
    stats: [
      stat('Channel Revenue', money(d.revenue), '● settled orders'),
      stat('Best Conversion', '—', '● traffic events required'),
      stat('Refund Rate', pct(safeDiv(d.refunded, Math.max(1, d.totalOrders)) * 100), '● refunds / orders'),
      stat('Orders', num(d.totalOrders), '● all channels'),
    ],
    charts: [
      chart(
        'Revenue by Region',
        'bar',
        regions.map(([c]) => c),
        regions.map(([, v]) => v),
        'money',
        'recorded',
        'No shipping regions recorded yet.'
      ),
      emptyChart('Channel Conversion', 'line', ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'], 'Conversion by channel requires traffic events.'),
      emptyChart('Refund Rate by Channel', 'hbar', ['Website', 'Mobile', 'Social', 'Market', 'Retail'], 'Channel is not recorded on orders yet.'),
    ],
  };
};

const buildEmpty = (index: number, hint: string, labels: string[], charts: Array<[string, BosChartType]>): BosSystemModel => {
  const meta = BOS_SYSTEMS[index];
  return {
    meta,
    stats: [
      stat('—', '—', '● awaiting records'),
      stat('—', '—', '● awaiting records'),
      stat('—', '—', '● awaiting records'),
      stat('—', '—', '● awaiting records'),
    ],
    charts: charts.map(([title, type]) => emptyChart(title, type, labels, hint)),
  };
};

const build16 = (data: BosData, d: Derived): BosSystemModel => {
  const meta = BOS_SYSTEMS[15];
  const monthly = byMonth(data.orders.filter(isRevenue), orderTotal, 12);
  const cash = byMonth(data.orders.filter(isRevenue), orderTotal, 12);

  return {
    meta,
    stats: [
      stat('Net Revenue', money(d.revenue - d.vatTotal), '● excl. VAT'),
      stat('Gross Margin', '—', '● product cost not recorded'),
      stat('Cash Received', money(d.revenue), '● settled order value'),
      stat('Outstanding Payables', '—', '● supplier ledger not recorded'),
    ],
    charts: [
      chart('Revenue — 12 months', 'line', monthly.labels, monthly.data, 'money'),
      chart('Cash Inflow', 'bar', cash.labels, cash.data, 'money'),
      {
        title: 'Order Value Composition',
        type: 'donut',
        labels: ['Subtotal', 'Shipping', 'VAT', 'Discount'],
        data: [
          Math.max(0, d.revenue - d.vatTotal - d.shippingRevenue + d.discountsGiven),
          d.shippingRevenue,
          d.vatTotal,
          d.discountsGiven,
        ],
        status: 'recorded',
        emptyHint: 'No settled orders recorded yet.',
      },
      emptyChart('Gross Margin', 'area', MONTHS, 'Product cost is required to compute gross margin.'),
    ],
  };
};

const build18 = (data: BosData): BosSystemModel => {
  const meta = BOS_SYSTEMS[17];
  return {
    meta,
    stats: [
      stat('Employees', '—', '● workforce directory not recorded'),
      stat('Active Sessions', '—', '● session ledger not recorded'),
      stat('Roles', '—', '● role registry not recorded'),
      stat('Permission Changes', num(data.auditLogs.length), '● audit events'),
    ],
    charts: [
      emptyChart('Active Sessions', 'line', ['8am', '10am', '12pm', '2pm', '4pm', '6pm'], 'Session activity requires the workforce directory.'),
      emptyChart('Actions by Role', 'donut', ['Admin', 'Ops', 'Finance', 'Support'], 'Role assignments are not recorded yet.'),
      chart(
        'Audit Events per Day',
        'bar',
        byDay(data.auditLogs.map((a) => ({ createdAt: a.at, status: 'paid', totals: { total: 1 } }) as unknown as Order), () => 1, 7).labels,
        byDay(data.auditLogs.map((a) => ({ createdAt: a.at, status: 'paid', totals: { total: 1 } }) as unknown as Order), () => 1, 7).data,
        'number'
      ),
    ],
  };
};

const build19 = (data: BosData): BosSystemModel => {
  const meta = BOS_SYSTEMS[18];
  const byType = new Map<string, number>();
  for (const a of data.auditLogs) byType.set(a.action, (byType.get(a.action) || 0) + 1);
  const types = topEntries(byType, 6);
  const perDay = byDay(
    data.auditLogs.map((a) => ({ createdAt: a.at, status: 'paid', totals: { total: 1 } }) as unknown as Order),
    () => 1,
    7
  );

  return {
    meta,
    stats: [
      stat('Automation Runs', num(data.auditLogs.length), '● recorded audit events'),
      stat('Failed Jobs', '—', '● job runner not recorded'),
      stat('Audit Events', num(data.auditLogs.length), '● last 100 loaded'),
      stat('Uptime', '—', '● health probes required'),
    ],
    charts: [
      chart('Automation / Audit Runs', 'bar', perDay.labels, perDay.data, 'number'),
      emptyChart('Job Failures', 'line', ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'], 'Background job execution is not recorded yet.'),
      chart('Audit Events by Type', 'hbar', types.map(([t]) => t), types.map(([, v]) => v), 'number'),
      emptyChart('System Latency p95 (ms)', 'area', ['8am', '10am', '12pm', '2pm', '4pm', '6pm'], 'Latency requires the system health probe.'),
    ],
  };
};

const timeAgo = (ts: number): string => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/* -------------------------------------------------------------------------- */
/* Public entry                                                               */
/* -------------------------------------------------------------------------- */

export const buildBosSystem = (systemId: string, data: BosData): BosSystemModel => {
  const d = derive(data);
  switch (systemId) {
    case '01':
      return build01(data, d);
    case '02':
      return build02(data, d);
    case '03':
      return build03(data, d);
    case '04':
      return build04(data, d);
    case '05':
      return build05(data, d);
    case '06':
      return build06(data, d);
    case '07':
      return build07(data, d);
    case '08':
      return build08(data, d);
    case '09':
      return build09(data, d);
    case '10':
      return build10(data, d);
    case '11':
      return build11(data);
    case '12':
      return build12(data, d);
    case '13':
      return buildEmpty(
        12,
        'Loyalty points and referrals require the loyalty ledger.',
        ['Bronze', 'Silver', 'Gold', 'Platinum'],
        [
          ['Points Earned vs Redeemed', 'line'],
          ['Members by Tier', 'donut'],
          ['Referrals per Week', 'bar'],
        ]
      );
    case '14':
      return buildEmpty(
        13,
        'Support tickets require the service desk tables.',
        ['Delivery', 'Sizing', 'Refund', 'Payment', 'Other'],
        [
          ['Tickets Opened', 'area'],
          ['Tickets by Category', 'hbar'],
          ['First Response Time (h)', 'line'],
        ]
      );
    case '15':
      return buildEmpty(
        14,
        'Reviews require the customer feedback table.',
        ['1★', '2★', '3★', '4★', '5★'],
        [
          ['Average Rating', 'line'],
          ['Rating Distribution', 'bar'],
          ['Complaint Themes', 'hbar'],
        ]
      );
    case '16':
      return build16(data, d);
    case '17':
      return buildEmpty(
        16,
        'Suppliers and purchase orders require the procurement tables.',
        ['Lisbon', 'Porto', 'Dhaka', 'Izmir', 'Hanoi'],
        [
          ['Lead Time by Supplier (d)', 'hbar'],
          ['PO Spend', 'bar'],
          ['Defect Rate by Supplier', 'bar'],
        ]
      );
    case '18':
      return build18(data);
    case '19':
      return build19(data);
    default:
      return build01(data, d);
  }
};
