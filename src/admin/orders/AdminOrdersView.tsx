import React, { useState } from 'react';
import { Order, OrderStatus } from '../../types';
import { Search, Printer, FileText, CheckCircle, RefreshCw, Truck, ArrowRight, X, Clock, ShoppingBag } from 'lucide-react';
import { useAuth } from '../../supabase/AuthContext';
import { supabase } from '../../supabase/config';
import { logAuditEvent } from '../../supabase/dbService';

interface AdminOrdersViewProps {
  orders: Order[];
  onRefresh: () => void;
}

export const AdminOrdersView: React.FC<AdminOrdersViewProps> = ({ orders, onRefresh }) => {
  const { isEditor, adminProfile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(orders[0] || null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Sync selected order if list changes
  React.useEffect(() => {
    if (!selectedOrder && orders.length > 0) {
      setSelectedOrder(orders[0]);
    } else if (selectedOrder && !orders.some((o) => o.id === selectedOrder.id)) {
      setSelectedOrder(orders[0] || null);
    }
  }, [orders, selectedOrder]);

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = o.number.toLowerCase().includes(q);
      const matchCust = o.customer.name.toLowerCase().includes(q) || o.customer.email.toLowerCase().includes(q);
      if (!matchNum && !matchCust) return false;
    }
    return true;
  });

  const handleUpdateStatus = async (newStatus: OrderStatus) => {
    if (!isEditor || !selectedOrder) return;
    setIsUpdating(true);
    try {
      const newTimelineItem = {
        at: new Date().toISOString(),
        status: newStatus,
        by: adminProfile?.name || 'Huxaifa Official',
        note: `Status updated to ${newStatus}`,
      };

      const updatedTimeline = [...(selectedOrder.timeline || []), newTimelineItem];

      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          timeline: updatedTimeline,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);
      if (error) throw error;

      await logAuditEvent(adminProfile?.name || 'admin', 'update_order_status', selectedOrder.id, {
        previous: selectedOrder.status,
        next: newStatus,
      });

      setSelectedOrder({
        ...selectedOrder,
        status: newStatus,
        timeline: updatedTimeline,
      });

      onRefresh();
    } catch (err) {
      console.warn('Order status update failed:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSaveTracking = async () => {
    if (!isEditor || !selectedOrder || !trackingNumber.trim()) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          tracking: trackingNumber,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      setSelectedOrder({ ...selectedOrder, tracking: trackingNumber });
      setTrackingNumber('');
      onRefresh();
    } catch (err) {
      console.warn('Tracking save failed:', err);
    }
  };

  const handleAddNote = async () => {
    if (!isEditor || !selectedOrder || !internalNote.trim()) return;
    try {
      const newTimelineItem = {
        at: new Date().toISOString(),
        status: selectedOrder.status,
        by: adminProfile?.name || 'Huxaifa Official',
        note: internalNote,
      };
      const updatedTimeline = [...(selectedOrder.timeline || []), newTimelineItem];
      const { error } = await supabase
        .from('orders')
        .update({
          timeline: updatedTimeline,
          notes: internalNote,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);
      if (error) throw error;
      setSelectedOrder({ ...selectedOrder, timeline: updatedTimeline, notes: internalNote });
      setInternalNote('');
      onRefresh();
    } catch (err) {
      console.warn('Note save failed:', err);
    }
  };

  const printDocument = () => {
    window.print();
  };

  const renderStatusBadge = (st: OrderStatus) => {
    switch (st) {
      case 'paid':
      case 'delivered':
        return <span className="micro-sm px-2 py-1 bg-paper text-ink">● {st}</span>;
      case 'packed':
      case 'shipped':
        return <span className="micro-sm border border-paper-a18 text-paper px-2 py-1">◐ {st}</span>;
      case 'new':
        return <span className="micro-sm text-paper-a72">○ {st}</span>;
      case 'cancelled':
      case 'refunded':
        return <span className="micro-sm text-paper-a45 line-through">{st}</span>;
      default:
        return <span className="micro-sm">{st}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-paper-a18 pb-4">
        <div>
          <h1 className="font-display text-[38px] font-light leading-[1.05] tracking-[-0.01em] text-paper">Real Customer Orders</h1>
          <p className="text-[13px] font-light text-paper-a45 mt-1 max-w-2xl leading-relaxed">
            Verified checkout orders, fulfillment status, dispatch tracking, and audit trail.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedOrder && (
            <button
              type="button"
              onClick={printDocument}
              className="btn btn-secondary !min-h-[40px] !px-5"
            >
              <Printer className="w-3.5 h-3.5" strokeWidth={1.4} />
              <span>Print Slip</span>
            </button>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="p-16 border border-paper-a18 text-center space-y-5">
          <div className="w-12 h-12 mx-auto flex items-center justify-center text-paper-a45">
            <ShoppingBag className="w-6 h-6" strokeWidth={1.4} />
          </div>
          <div>
            <h3 className="font-display text-[24px] font-light text-paper mb-2">No customer orders yet</h3>
            <p className="text-[13px] font-light text-paper-a45 max-w-md mx-auto leading-relaxed">
              Real customer orders placed through the storefront checkout will immediately sync here in real-time.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-b border-paper-a18 pb-3 text-[13px]">
            <div className="relative sm:col-span-2">
              <Search className="w-3.5 h-3.5 absolute left-0 top-1/2 -translate-y-1/2 text-paper-a45" strokeWidth={1.4} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order number or customer name/email..."
                className="field pl-7 !border-0"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="field cursor-pointer !border-0"
              >
                <option value="all">All statuses ({orders.length})</option>
                <option value="new">New</option>
                <option value="paid">Paid</option>
                <option value="packed">Packed</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-2">
            {/* Left Column: Order List */}
            <div className="lg:col-span-5 border border-paper-a18 overflow-y-auto max-h-[700px]">
              {filteredOrders.length === 0 ? (
                <div className="p-10 text-center micro-sm text-paper-a45">No orders match criteria.</div>
              ) : (
                filteredOrders.map((ord) => {
                  const isSelected = selectedOrder?.id === ord.id;
                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrder(ord)}
                      className={`p-5 border-b border-paper-a18 last:border-b-0 transition-colors cursor-pointer text-[13px] ${ isSelected ? 'bg-paper text-ink' : 'hover:bg-paper-a06'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[12px] tracking-[0.08em]">{ord.number}</span>
                        <span className={isSelected ? '[&_span]:!bg-ink [&_span]:!text-paper' : ''}>{renderStatusBadge(ord.status)}</span>
                      </div>
                      <div className={`font-light ${isSelected ? 'text-ink' : 'text-paper'}`}>{ord.customer.name}</div>
                      <div className={`micro-sm mt-2 flex justify-between ${isSelected ? 'text-ink-a40' : 'text-paper-a45'}`}>
                        <span>{ord.items.length} items</span>
                        <span className="font-mono">{ord.totals.total} €</span>
                      </div>
                      <div className={`micro-sm mt-1.5 ${isSelected ? 'text-ink-a40' : 'text-paper-a45'}`}>
                        {new Date(ord.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Order Detail & Timeline */}
            {selectedOrder && (
              <div className="lg:col-span-7 space-y-8 text-[13px]">
                {/* Order Header */}
                <div className="flex items-start justify-between border-b border-paper-a18 pb-5">
                  <div>
                    <span className="micro-sm text-paper-a45">Order Details</span>
                    <h2 className="font-mono text-[28px] font-light text-paper mt-1.5">{selectedOrder.number}</h2>
                    <div className="text-paper-a45 micro-sm mt-2">
                      Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-US')}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-[14px] text-paper">{selectedOrder.totals.total} €</div>
                    <div className="mt-2">{renderStatusBadge(selectedOrder.status)}</div>
                  </div>
                </div>

                {/* Status Switcher */}
                <div>
                  <div className="micro-sm text-paper-a45 mb-3">Update Fulfillment Status</div>
                  <div className="flex flex-wrap gap-2">
                    {(['new', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'] as OrderStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleUpdateStatus(st)}
                          disabled={isUpdating || selectedOrder.status === st}
                          className={`px-3 py-1.5 micro-sm border transition-colors cursor-pointer disabled:cursor-not-allowed ${ selectedOrder.status === st ? 'bg-paper text-ink border-paper'
                              : 'border-paper-a18 text-paper-a72 hover:text-paper hover:border-paper'
                          }`}
                        >
                          {st}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Tracking Number */}
                <div className="py-4 border-y border-paper-a18 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="micro-sm text-paper-a45 flex items-center gap-2">
                      <Truck className="w-3.5 h-3.5" strokeWidth={1.4} />
                      <span>Tracking & Dispatch</span>
                    </span>
                    {selectedOrder.tracking && (
                      <span className="font-mono text-[12px] text-paper">{selectedOrder.tracking}</span>
                    )}
                  </div>

                  <div className="flex gap-4 items-end">
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder={selectedOrder.tracking ? 'Update tracking code...' : 'Enter carrier tracking code...'}
                      className="field flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTracking}
                      className="btn btn-primary !min-h-[42px] !px-6"
                    >
                      Save
                    </button>
                  </div>
                </div>

                {/* Customer and Shipping Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div>
                    <span className="micro-sm text-paper-a45 block mb-2">Customer Info</span>
                    <div className="text-paper font-light">{selectedOrder.customer.name}</div>
                    <div className="text-paper-a72 text-[12px] font-light mt-1">{selectedOrder.customer.email}</div>
                    {selectedOrder.customer.phone && <div className="text-paper-a45 text-[12px] mt-1 font-mono">{selectedOrder.customer.phone}</div>}
                  </div>

                  <div>
                    <span className="micro-sm text-paper-a45 block mb-2">Delivery Address</span>
                    {selectedOrder.customer.address ? (
                      <div className="text-paper-a72 text-[12px] font-light space-y-0.5">
                        <div>{selectedOrder.customer.address.street}</div>
                        <div>
                          {selectedOrder.customer.address.postalCode} {selectedOrder.customer.address.city}
                        </div>
                        <div>{selectedOrder.customer.address.country}</div>
                      </div>
                    ) : (
                      <div className="text-paper-a45 italic text-[12px]">Digital / In-store collection</div>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <div className="micro-sm text-paper-a45 mb-2">Order Line Items</div>
                  <div className="border-t border-paper-a18">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="p-3 border-b border-paper-a18 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-paper-a45 micro-sm font-mono">{item.productNr}</span>
                          <div>
                            <div className="font-light text-paper">{item.productName}</div>
                            <div className="text-paper-a45 micro-sm mt-1">Size: {item.size} · Qty: {item.quantity}</div>
                          </div>
                        </div>
                        <span className="font-mono text-[12px] text-paper">{item.price * item.quantity} €</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 mt-1 space-y-1.5 text-right text-[12px] font-mono">
                    <div className="text-paper-a45">Subtotal: {selectedOrder.totals.subtotal} €</div>
                    <div className="text-paper-a45">Shipping: {selectedOrder.totals.shipping} €</div>
                    <div className="text-paper text-[14px]">Total: {selectedOrder.totals.total} €</div>
                  </div>
                </div>

                {/* Order Timeline */}
                <div>
                  <div className="micro-sm text-paper-a45 mb-4">Timeline Audit</div>
                  <div className="space-y-4 pl-4 ml-1 border-l border-paper-a18">
                    {(selectedOrder.timeline || []).map((tl, i) => (
                      <div key={i} className="relative">
                        <span className="w-1.5 h-1.5 bg-paper absolute -left-[20.5px] top-1" />
                        <div className="flex items-center justify-between">
                          <span className="micro-sm text-paper">{tl.status}</span>
                          <span className="micro-sm text-paper-a45 font-mono">
                            {new Date(tl.at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        {tl.note && <div className="text-[12px] text-paper-a72 font-light mt-1">{tl.note}</div>}
                        {tl.by && <div className="micro-sm text-paper-a45 mt-1">by {tl.by}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
