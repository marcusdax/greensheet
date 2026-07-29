import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useOrders, useCatalog, useCrm, useUi, useRootStore } from '../stores/root-store';
import { OrderForm } from '../components/forms/OrderForm';
import { Modal } from '../components/ui/Modal';
import { Drawer } from '../components/ui/Drawer';
import { DataTable } from '../components/ui/DataTable';
import type { ColumnDef } from '../components/ui/DataTable';
import type { Order, OrderStatus } from '../types/api';

const sagaTimeline: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

const statusLabel = (status: OrderStatus) => {
  switch (status) {
    case 'pending': return 'Pending';
    case 'processing': return 'Processing';
    case 'shipped': return 'Shipped';
    case 'delivered': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    case 'returned': return 'Returned';
    default: return status;
  }
};

const statusBadgeClass = (status: OrderStatus) => {
  switch (status) {
    case 'pending': return 'bg-warning-bg text-warning border-warning/15';
    case 'processing': return 'bg-info-bg text-info border-info/15';
    case 'shipped': return 'bg-primary-bg text-primary border-primary/15';
    case 'delivered': return 'bg-success-bg text-success border-success/10';
    case 'cancelled':
    case 'returned': return 'bg-danger-bg text-danger border-danger/15';
    default: return 'bg-recessed text-muted border-border';
  }
};

export const OrdersPage: React.FC = () => {
  const { orders, loading, loadOrders, processOrder, shipOrder, deliverOrder, cancelOrder, returnOrder } = useOrders();
  const { lots, loadLots } = useCatalog();
  const { roasters, loadRoasters } = useCrm();
  const { pushToast } = useUi();

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  useEffect(() => {
    void loadRoasters();
  }, [loadRoasters]);

  const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedOrderId) ?? null, [orders, selectedOrderId]);

  const accountOptions = useMemo(
    () => roasters.map((r) => ({ value: r.id, label: r.roasterName })),
    [roasters],
  );

  const lotOptions = useMemo(
    () => lots.map((l) => ({ value: l.id, label: `${l.origin} — ${l.varietal ?? 'Unknown'}` })),
    [lots],
  );

  const clearError = () => {
    useRootStore.setState((state) => ({ orders: { ...state.orders, error: null } }));
  };

  const handleCreate = async (data: { accountId: string; lineItems: { lotId: string; quantityLbs: number; unitPriceCents: number }[] }) => {
    clearError();
    const created = await useRootStore.getState().orders.createOrder(data);
    if (created) {
      pushToast({ kind: 'success', message: 'Order created' });
      setCreateOpen(false);
    } else {
      const error = useRootStore.getState().orders.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? 'Failed to create order' });
    }
  };

  const lifecycleAction = async (label: string, action: () => Promise<Order | null>) => {
    clearError();
    const updated = await action();
    if (updated) {
      pushToast({ kind: 'success', message: `Order ${label.toLowerCase()}` });
    } else {
      const error = useRootStore.getState().orders.error;
      pushToast({ kind: 'error', message: error?.detail ?? error?.title ?? `Failed to ${label.toLowerCase()} order` });
    }
  };

  const currentStatusIndex = (status: OrderStatus) => sagaTimeline.findIndex((s) => s === status);

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        key: 'account',
        header: 'Account',
        accessor: (row) => {
          const account = roasters.find((r) => r.id === row.accountId);
          return <span className="font-semibold text-ink">{account?.roasterName ?? row.accountId}</span>;
        },
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        accessor: (row) => (
          <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full font-sans font-bold uppercase tracking-wider border ${statusBadgeClass(row.status)}`}>
            {statusLabel(row.status)}
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        align: 'right',
        accessor: (row) => <span className="font-mono figure">${(row.finalTotalCents / 100).toFixed(2)}</span>,
      },
      {
        key: 'created',
        header: 'Created',
        accessor: (row) => <span className="font-mono text-xs text-muted">{new Date(row.createdAt).toLocaleDateString()}</span>,
      },
    ],
    [roasters],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="overline text-xs text-muted tracking-wider">ORDERS</span>
          <h1 className="text-3xl font-display font-medium text-ink">Orders</h1>
          <p className="text-sm text-muted font-sans max-w-2xl">
            Create and manage customer orders. Orders reserve inventory and progress through a fulfillment saga.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-navy hover:bg-navy-800 text-white rounded-md text-sm font-semibold shadow-e1 transition-all"
        >
          <Plus size={16} />
          Create Order
        </button>
      </div>

      <div className="bg-surface rounded-lg border border-border-strong shadow-e1 overflow-hidden">
        <DataTable
          data={orders}
          columns={columns}
          keyExtractor={(row) => row.id}
          onRowClick={(row) => setSelectedOrderId(row.id)}
          emptyMessage={
            <div className="text-center">
              <p className="text-muted font-sans">No orders yet.</p>
            </div>
          }
        />
        {orders.length === 0 && !loading && (
          <div className="p-8 text-center text-muted font-sans">No orders yet.</div>
        )}
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create Order" size="xl">
        <OrderForm onSubmit={handleCreate} accountOptions={accountOptions} lotOptions={lotOptions} />
      </Modal>

      <Drawer
        isOpen={selectedOrder != null}
        onClose={() => setSelectedOrderId(null)}
        title={selectedOrder ? `Order ${selectedOrder.id.slice(-8)}` : 'Order Detail'}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">Account</span>
                <span className="text-sm font-semibold text-ink">
                  {roasters.find((r) => r.id === selectedOrder.accountId)?.roasterName ?? selectedOrder.accountId}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">Total</span>
                <span className="text-sm font-mono">${(selectedOrder.finalTotalCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-sans font-semibold text-muted uppercase tracking-wider">Status</span>
                <span className={`inline-flex px-2 py-0.5 text-[10px] rounded-full font-sans font-bold uppercase tracking-wider border ${statusBadgeClass(selectedOrder.status)}`}>
                  {statusLabel(selectedOrder.status)}
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-sans font-semibold text-muted uppercase tracking-wider mb-2">Line Items</h3>
              <div className="divide-y divide-border border border-border rounded-md overflow-hidden">
                {selectedOrder.lineItems.map((item, idx) => {
                  const lot = lots.find((l) => l.id === item.lotId);
                  return (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 bg-recessed/15">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-ink">{lot?.origin ?? item.lotId}</span>
                        <span className="text-xs text-muted font-mono">{item.quantityLbs.toLocaleString()} lb @ {item.unitPriceCents}¢</span>
                      </div>
                      <span className="text-sm font-mono">${((item.quantityLbs * item.unitPriceCents) / 100).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-sans font-semibold text-muted uppercase tracking-wider mb-3">Saga Timeline</h3>
              <div className="flex items-center gap-1 overflow-x-auto pb-2">
                {sagaTimeline.map((status, index) => {
                  const activeIndex = currentStatusIndex(selectedOrder.status);
                  const isActive = index <= activeIndex;
                  return (
                    <React.Fragment key={status}>
                      <div className={`flex flex-col items-center min-w-[80px] text-center ${isActive ? 'text-teal' : 'text-muted'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${isActive ? 'bg-teal border-teal text-white' : 'bg-surface border-border text-muted'}`}>
                          {index + 1}
                        </div>
                        <span className="text-[10px] font-sans mt-1 leading-tight">{statusLabel(status)}</span>
                      </div>
                      {index < sagaTimeline.length - 1 && (
                        <div className={`flex-1 h-0.5 min-w-[16px] ${index < activeIndex ? 'bg-teal' : 'bg-border'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {selectedOrder.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => lifecycleAction('Process', () => processOrder(selectedOrder.id))}
                  className="px-3 py-1.5 bg-navy text-white rounded-md text-xs font-semibold"
                >
                  Process
                </button>
              )}
              {selectedOrder.status === 'processing' && (
                <button
                  type="button"
                  onClick={() => lifecycleAction('Ship', () => shipOrder(selectedOrder.id))}
                  className="px-3 py-1.5 bg-navy text-white rounded-md text-xs font-semibold"
                >
                  Ship
                </button>
              )}
              {selectedOrder.status === 'shipped' && (
                <button
                  type="button"
                  onClick={() => lifecycleAction('Deliver', () => deliverOrder(selectedOrder.id))}
                  className="px-3 py-1.5 bg-navy text-white rounded-md text-xs font-semibold"
                >
                  Deliver
                </button>
              )}
              {['pending', 'processing'].includes(selectedOrder.status) && (
                <button
                  type="button"
                  onClick={() => lifecycleAction('Cancel', () => cancelOrder(selectedOrder.id))}
                  className="px-3 py-1.5 border border-danger text-danger hover:bg-danger-bg rounded-md text-xs font-semibold"
                >
                  Cancel
                </button>
              )}
              {selectedOrder.status === 'delivered' && (
                <button
                  type="button"
                  onClick={() => lifecycleAction('Return', () => returnOrder(selectedOrder.id))}
                  className="px-3 py-1.5 border border-danger text-danger hover:bg-danger-bg rounded-md text-xs font-semibold"
                >
                  Return
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
