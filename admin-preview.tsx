import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './src/index.css';
import './src/admin/operations/operations.css';
import { AdminOrdersView } from './src/admin/orders/AdminOrdersView';
import { AdminCustomersView } from './src/admin/customers/AdminCustomersView';
import { AdminInventoryView } from './src/admin/inventory/AdminInventoryView';
import { AdminProductsView } from './src/admin/products/AdminProductsView';
import { AdminDiscountsView } from './src/admin/discounts/AdminDiscountsView';
import { AdminWaitlistView } from './src/admin/waitlist/AdminWaitlistView';
import { AdminAnalyticsView } from './src/admin/analytics/AdminAnalyticsView';
import { AdminSettingsView } from './src/admin/settings/AdminSettingsView';
import { AdminSecurityView } from './src/admin/security/AdminSecurityView';
import { AdminCollectionsView } from './src/admin/collections/AdminCollectionsView';
import { AdminCategoriesView } from './src/admin/categories/AdminCategoriesView';
import { AdminMediaView } from './src/admin/media/AdminMediaView';
import { AdminSuggestionsView } from './src/admin/suggestions/AdminSuggestionsView';
import { AdminControlPlaneView } from './src/admin/control/AdminControlPlaneView';
import { AdminSystemHealthView } from './src/admin/health/AdminSystemHealthView';
import { AdminAtlasView } from './src/admin/atlas/AdminAtlasView';
import { AdminProductEditorDrawer } from './src/admin/products/AdminProductEditorDrawer';
import { AdminCommandPalette } from './src/admin/AdminCommandPalette';
import type { Product, Order, Customer, Discount, WaitlistEntry, Collection, StoreSettings, AuditLog, OrderStatus, Category } from './src/types';

const tr = (fi: string, en: string, sv = en) => ({ fi, en, sv });

const product = (i: number): Product => ({
  id: `p-${i}`,
  nr: `Nº 00${i}`,
  plateNumber: `Nº 00${i}`,
  name: tr(`Tuote ${i}`, `Piece ${i}`),
  description: tr('Kuvaus', 'Description'),
  material: tr('Villa', 'Wool'),
  origin: tr('Suomi', 'Finland'),
  care: tr('Käsinpesu', 'Hand wash'),
  price: 180 + i * 40,
  category: (['naiset', 'miehet', 'asusteet', 'kokoelmat'] as const)[i % 4],
  subcategory: 'Knitwear',
  sizes: ['S', 'M', 'L'],
  stock: [0, 4, 18, 42][i % 4],
  isLimited: i % 3 === 0,
  variants: [
    { size: 'S', sku: `SKU-${i}-S`, stock: i % 5 },
    { size: 'M', sku: `SKU-${i}-M`, stock: (i * 3) % 9 },
    { size: 'L', sku: `SKU-${i}-L`, stock: (i * 7) % 14 },
  ],
  colorName: tr('Noki', 'Charcoal'),
  colorHex: '#232323',
  cropVariation: {
    packshot: { position: '50% 50%', scale: 1, aspectRatio: '3/4' },
    onModel: { position: '50% 50%', scale: 1, aspectRatio: '3/4' },
    detail1: { position: '50% 50%', scale: 1 },
    detail2: { position: '50% 50%', scale: 1 },
    detail3: { position: '50% 50%', scale: 1 },
    detail4: { position: '50% 50%', scale: 1 },
  },
  status: i % 7 === 0 ? 'draft' : 'live',
  images: [],
  createdAt: '2026-02-02T10:00:00Z',
});

const products = Array.from({ length: 12 }, (_, i) => product(i + 1));

const statuses: OrderStatus[] = ['new', 'paid', 'packed', 'shipped', 'delivered', 'refunded'];
const orders: Order[] = Array.from({ length: 9 }, (_, i) => ({
  id: `o-${i}`,
  number: `ZE-2026-00${40 + i}`,
  customer: {
    id: `c-${i}`,
    email: `client${i}@example.com`,
    name: ['Aino Virtanen', 'Lars Berg', 'Sofia Lind', 'Mikael Fors'][i % 4],
    phone: '+358 40 123 4567',
    address: { street: 'Mannerheimintie 12', postalCode: '00100', city: 'Helsinki', country: i % 3 ? 'FI' : 'SE' },
  },
  items: [
    { productId: `p-${i + 1}`, productNr: `Nº 00${i + 1}`, productName: `Piece ${i + 1}`, size: 'M', quantity: 1, price: 220 },
    { productId: `p-${i + 2}`, productNr: `Nº 00${i + 2}`, productName: `Piece ${i + 2}`, size: 'L', quantity: 2, price: 140 },
  ],
  totals: { subtotal: 500, shipping: 12, vat: 96, discount: 0, total: 512 },
  status: statuses[i % statuses.length],
  shippingMethod: 'Posti',
  tracking: i % 2 ? `JJFI${100000 + i}` : undefined,
  timeline: [
    { at: '2026-11-02T09:00:00Z', status: 'paid', by: 'system' },
    { at: '2026-11-03T11:00:00Z', status: 'packed', by: 'operator' },
  ],
  createdAt: `2026-11-${String(2 + i).padStart(2, '0')}T09:00:00Z`,
  updatedAt: `2026-11-${String(3 + i).padStart(2, '0')}T11:00:00Z`,
}));

const customers: Customer[] = Array.from({ length: 8 }, (_, i) => ({
  id: `c-${i}`,
  email: `client${i}@example.com`,
  name: ['Aino Virtanen', 'Lars Berg', 'Sofia Lind', 'Mikael Fors'][i % 4],
  marketingConsent: i % 2 === 0,
  wishlist: i % 3 === 0 ? ['p-1', 'p-2'] : [],
  totals: { orders: i + 1, spend: 240 + i * 180 },
  firstSeen: '2025-06-01T10:00:00Z',
  lastSeen: `2026-11-${String(4 + i).padStart(2, '0')}T10:00:00Z`,
}));

const discounts: Discount[] = [
  { id: 'd1', code: 'STUDIO15', type: 'percent', value: 15, minSpend: 150, usageLimit: 200, used: 64, active: true },
  { id: 'd2', code: 'WINTER50', type: 'fixed', value: 50, minSpend: 300, usageLimit: 100, used: 100, active: false },
];

const collections: Collection[] = [
  { id: 'col1', name: tr('Talvi', 'Winter'), slug: 'winter', type: 'drop', status: 'live', startAt: '2026-11-20T10:00:00Z' },
  { id: 'col2', name: tr('Kevät', 'Spring'), slug: 'spring', type: 'season', status: 'scheduled', startAt: '2027-02-01T10:00:00Z' },
];

const waitlist: WaitlistEntry[] = Array.from({ length: 6 }, (_, i) => ({
  id: `w-${i}`,
  email: `wait${i}@example.com`,
  source: 'drop',
  dropId: 'col1',
  createdAt: `2026-11-${String(5 + i).padStart(2, '0')}T12:00:00Z`,
  invited: i % 3 === 0,
}));

const settings: StoreSettings = {
  id: 's1',
  storeInfo: {
    name: 'ZEJESH',
    email: 'studio@zejesh.fi',
    phone: '+358 40 000 0000',
    address: 'Helsinki, Finland',
    currency: 'EUR',
  },
  shippingRates: [
    { id: 'sr1', method: 'posti', name: { fi: 'Posti', en: 'Posti' }, price: 9.9, eta: '2–4 days', freeOver: 200 },
  ],
  freeShippingThreshold: 200,
  vatRate: 24,
  consentText: { fi: 'Suostumus', en: 'Consent' },
  lowStockThreshold: 6,
  updatedAt: '2026-11-01T10:00:00Z',
};

const auditLogs: AuditLog[] = Array.from({ length: 6 }, (_, i) => ({
  id: `a-${i}`,
  who: 'operator@zejesh.fi',
  action: ['order.update', 'product.edit', 'settings.update'][i % 3],
  target: `object-${i}`,
  at: `2026-11-${String(5 + i).padStart(2, '0')}T08:00:00Z`,
}));

const categories: Category[] = [
  { id: 'cat1', name: tr('Naiset', 'Women'), slug: 'naiset', order: 1, visible: true },
  { id: 'cat2', name: tr('Miehet', 'Men'), slug: 'miehet', order: 2, visible: true },
];

const TABS = ['orders', 'customers', 'inventory', 'products', 'collections', 'categories', 'media', 'discounts', 'waitlist', 'suggestions', 'analytics', 'advisor', 'control', 'health', 'atlas', 'settings', 'security', 'drawer', 'palette'] as const;

const App = () => {
  const [tab, setTab] = useState<(typeof TABS)[number]>('orders');
  const noop = () => {};
  return (
    <div style={{ background: '#f6f6f6', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: 6, padding: '12px 28px', flexWrap: 'wrap', borderBottom: '1px solid #ececec' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: '1px solid ' + (tab === t ? '#000' : '#dcdcdc'),
              background: tab === t ? '#000' : '#fff',
              color: tab === t ? '#fff' : '#000',
              borderRadius: 99,
              padding: '6px 14px',
              font: '400 13px "Instrument Sans", sans-serif',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ padding: 28, maxWidth: 1440, margin: '0 auto' }}>
        <div className="admin-scope">
          {tab === 'orders' && <AdminOrdersView orders={orders} onRefresh={noop} />}
          {tab === 'customers' && <AdminCustomersView customers={customers} />}
          {tab === 'inventory' && <AdminInventoryView products={products} onRefresh={noop} />}
          {tab === 'collections' && <AdminCollectionsView collections={collections} products={products} onRefresh={noop} />}
          {tab === 'categories' && <AdminCategoriesView categories={categories} onRefresh={noop} />}
          {tab === 'media' && <AdminMediaView products={products} />}
          {tab === 'suggestions' && <AdminSuggestionsView />}
          {tab === 'control' && <AdminControlPlaneView />}
          {tab === 'health' && <AdminSystemHealthView />}
          {tab === 'atlas' && (
            <AdminAtlasView
              products={products}
              orders={orders}
              customers={customers}
              waitlist={waitlist}
              collections={collections}
              onNavigateView={noop}
            />
          )}
          {tab === 'products' && (
            <AdminProductsView
              products={products}
              onEditProduct={noop}
              onCreateProduct={noop}
              onViewProductInStore={noop}
            />
          )}
          {tab === 'discounts' && <AdminDiscountsView discounts={discounts} onRefresh={noop} />}
          {tab === 'waitlist' && <AdminWaitlistView waitlist={waitlist} collections={collections} onRefresh={noop} />}
          {tab === 'analytics' && <AdminAnalyticsView products={products} dailyStats={[]} orders={orders} />}
          {tab === 'advisor' && <AdminAnalyticsView products={products} dailyStats={[]} orders={orders} />}
          {tab === 'settings' && <AdminSettingsView settings={settings} onRefresh={noop} />}
          {tab === 'drawer' && (
            <AdminProductEditorDrawer
              isOpen
              product={products[0]}
              onClose={noop}
              onSaveSuccess={noop}
              onDeleteProduct={async () => true}
              categories={categories}
              collections={collections}
            />
          )}
          {tab === 'palette' && (
            <AdminCommandPalette
              isOpen
              onClose={noop}
              products={products}
              onSelectProduct={noop}
              onNavigateView={noop}
            />
          )}
          {tab === 'security' && (
            <AdminSecurityView autoLockMinutes={15} onUpdateAutoLock={noop} onLockTerminalNow={noop} auditLogs={auditLogs} />
          )}
        </div>
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')!).render(<App />);
