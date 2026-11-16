import React, { useState, useEffect } from 'react';
import { Search, X, Package, Layers, FolderTree, Image, ShoppingBag, Settings, Sparkles, ArrowRight, Gauge } from 'lucide-react';
import { Product } from '../types';

interface AdminCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (p: Product) => void;
  onNavigateView: (view: string) => void;
}

export const AdminCommandPalette: React.FC<AdminCommandPaletteProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
  onNavigateView,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const quickNav = [
    { id: 'control', label: 'Control Plane', icon: Gauge },
    { id: 'products', label: 'Products & Archive', icon: Package },
    { id: 'collections', label: 'Collections & Drops', icon: Layers },
    { id: 'categories', label: 'Categories', icon: FolderTree },
    { id: 'media', label: 'Media Library', icon: Image },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'customers', label: 'Customers', icon: Package },
    { id: 'discounts', label: 'Discounts', icon: Package },
    { id: 'analytics', label: 'Analytics', icon: Package },
    { id: 'advisor', label: 'AI Advisor', icon: Sparkles },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const filteredNav = quickNav.filter((n) =>
    n.label.toLowerCase().includes(query.toLowerCase())
  );

  const filteredProducts = query.trim()
    ? products
        .filter(
          (p) =>
            p.nr?.toLowerCase().includes(query.toLowerCase()) ||
            p.name.fi.toLowerCase().includes(query.toLowerCase()) ||
            p.name.en.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 5)
    : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
      <div onClick={onClose} className="fixed inset-0 bg-ink/80" />

      <div className="relative w-full max-w-2xl bg-ink border border-paper-a18 z-10 overflow-hidden animate-fadeIn">
        {/* Search Input */}
        <div className="flex items-center px-5 py-4 bg-ink border-b border-paper-a18">
          <Search className="w-4 h-4 text-paper-a45 mr-3" strokeWidth={1.4} />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, drops or actions..."
            className="w-full text-[13px] font-light bg-transparent text-paper placeholder:text-paper-a45 outline-none tracking-[0.06em]"
          />
          <button onClick={onClose} className="p-1 text-paper-a45 hover:text-paper cursor-pointer transition-colors">
            <X className="w-4 h-4" strokeWidth={1.4} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {/* Matched Products */}
          {filteredProducts.length > 0 && (
            <div className="border-b border-paper-a18 py-2">
              <div className="px-5 py-2 micro-sm text-paper-a45">
                Products ({filteredProducts.length})
              </div>
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectProduct(p);
                    onClose();
                  }}
                  className="w-full px-5 py-3 text-left flex items-center justify-between hover:bg-paper hover:text-ink group transition-colors cursor-pointer"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="micro-sm font-mono">{p.nr || p.plateNumber}</span>
                    <span className="text-[13px] font-light">{p.name.en || p.name.fi}</span>
                    <span className="micro-sm text-paper-a45 group-hover:text-ink-a40">({p.name.fi})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="micro-sm font-mono">{p.price} €</span>
                    <ArrowRight className="w-3.5 h-3.5 text-paper-a18 group-hover:text-ink" strokeWidth={1.4} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Navigation Shortcuts */}
          <div className="py-2">
            <div className="px-5 py-2 micro-sm text-paper-a45">
              Quick Navigation
            </div>
            {filteredNav.map((n) => {
              const Icon = n.icon;
              return (
                <button
                  key={n.id}
                  onClick={() => {
                    onNavigateView(n.id);
                    onClose();
                  }}
                  className="w-full px-5 py-2.5 text-left flex items-center justify-between hover:bg-paper hover:text-ink group transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-paper-a45 group-hover:text-ink" strokeWidth={1.4} />
                    <span className="micro-sm">{n.label}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-paper-a18 group-hover:text-ink" strokeWidth={1.4} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-paper-a18 bg-ink flex items-center justify-between micro-sm text-paper-a45">
          <span>Click to select action or navigate</span>
          <button onClick={onClose} className="hover:text-paper cursor-pointer transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
