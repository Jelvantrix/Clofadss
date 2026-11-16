import React from 'react';
import { X, AlertTriangle, PackageCheck, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { Product, Order, AiInsight } from '../types';

interface AdminNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  orders: Order[];
  insights: AiInsight[];
  onNavigateView: (view: string) => void;
}

export const AdminNotificationsModal: React.FC<AdminNotificationsModalProps> = ({
  isOpen,
  onClose,
  products,
  orders,
  insights,
  onNavigateView,
}) => {
  if (!isOpen) return null;

  // Derive low stock products (stock < 4)
  const lowStock = products.filter((p) => {
    const total = p.variants ? p.variants.reduce((a, v) => a + v.stock, 0) : (p.stock || 0);
    return total > 0 && total < 4;
  });

  // New pending orders
  const newOrders = orders.filter((o) => o.status === 'new' || o.status === 'paid').slice(0, 3);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end p-4 sm:p-6">
      <div onClick={onClose} className="fixed inset-0 bg-ink/80" />

      <div className="relative w-full max-w-sm bg-ink border border-paper-a18 z-10 animate-fadeIn flex flex-col max-h-[85vh] text-[13px] font-light">
        <div className="p-5 border-b border-paper-a18 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="micro-sm text-paper">Studio Notifications</span>
            <span className="micro-sm font-mono text-paper-a45">
              {lowStock.length + newOrders.length + insights.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-paper-a45 hover:text-paper cursor-pointer transition-colors">
            <X className="w-4 h-4" strokeWidth={1.4} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Low Stock Warnings */}
          {lowStock.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-paper-a18">
                <span className="flex items-center gap-2 micro-sm text-paper">
                  <AlertTriangle className="w-3.5 h-3.5" strokeWidth={1.4} />
                  <span>Low Stock Warning ({lowStock.length})</span>
                </span>
                <button
                  onClick={() => {
                    onNavigateView('inventory');
                    onClose();
                  }}
                  className="micro-sm text-paper-a72 hover:text-paper transition-colors underline underline-offset-4"
                >
                  View All
                </button>
              </div>
              {lowStock.slice(0, 3).map((p) => (
                <div key={p.id} className="py-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono micro-sm text-paper">{p.nr}</span>
                    <span className="micro-sm text-paper-a72">{p.stock} units remaining</span>
                  </div>
                  <div className="micro-sm text-paper-a45 truncate mt-1">{p.name.en || p.name.fi}</div>
                </div>
              ))}
            </div>
          )}

          {/* New Orders */}
          {newOrders.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-paper-a18">
                <span className="flex items-center gap-2 micro-sm text-paper">
                  <PackageCheck className="w-3.5 h-3.5" strokeWidth={1.4} />
                  <span>New Customer Orders</span>
                </span>
                <button
                  onClick={() => {
                    onNavigateView('orders');
                    onClose();
                  }}
                  className="micro-sm text-paper-a72 hover:text-paper transition-colors underline underline-offset-4"
                >
                  View All
                </button>
              </div>
              {newOrders.map((o) => (
                <div key={o.id} className="py-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="font-mono micro-sm text-paper">{o.number}</span>
                    <span className="font-mono micro-sm text-paper">{o.totals.total} €</span>
                  </div>
                  <div className="micro-sm text-paper-a45 truncate mt-1">{o.customer.name}</div>
                </div>
              ))}
            </div>
          )}

          {/* AI Insights */}
          {insights.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-paper-a18">
                <span className="flex items-center gap-2 micro-sm text-paper">
                  <Sparkles className="w-3.5 h-3.5" strokeWidth={1.4} />
                  <span>Advisor Recommendations</span>
                </span>
                <button
                  onClick={() => {
                    onNavigateView('advisor');
                    onClose();
                  }}
                  className="micro-sm text-paper-a72 hover:text-paper transition-colors underline underline-offset-4"
                >
                  Explore
                </button>
              </div>
              {insights.slice(0, 2).map((ins) => (
                <div key={ins.id} className="py-1.5">
                  <div className="micro-sm text-paper-a45">
                    [{ins.priority} Priority]
                  </div>
                  <div className="text-[13px] text-paper mt-1 line-clamp-1">{ins.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
