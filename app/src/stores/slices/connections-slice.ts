import type { TipTransaction, MobileMoneyRail } from '../../types/lotspace';

export interface ConnectionsState {
  tips: TipTransaction[];
  pendingTipFarmerSpaceId: string | null;
  totalTippedCents: number;
  loading: boolean;
  error: string | null;
}

export type SendTipParams = {
  fromSpaceId: string;
  fromName: string;
  toFarmerSpaceId: string;
  toFarmerName: string;
  grossAmountCents: number;
  rail: MobileMoneyRail;
  message?: string;
  referencedPostId?: string;
  referencedLotId?: string;
};

export interface ConnectionsActions {
  openTipModal: (farmerSpaceId: string) => void;
  closeTipModal: () => void;
  sendTip: (params: SendTipParams) => TipTransaction;
  getTipsByFarmer: (farmerSpaceId: string) => TipTransaction[];
}

export type ConnectionsSlice = ConnectionsState & ConnectionsActions;

export const initialConnectionsState: ConnectionsState = {
  tips: [],
  pendingTipFarmerSpaceId: null,
  totalTippedCents: 0,
  loading: false,
  error: null,
};

// Platform fee: 5% of gross tip, minimum 10 cents
function calcPlatformFee(grossCents: number): number {
  return Math.max(10, Math.round(grossCents * 0.05));
}

export const createConnectionsSlice = (set: any, get: any) => ({
  ...initialConnectionsState,

  openTipModal: (farmerSpaceId: string) => {
    set(
      (s: any) => { s.connections.pendingTipFarmerSpaceId = farmerSpaceId; },
      false,
      'connections/openTip',
    );
  },

  closeTipModal: () => {
    set(
      (s: any) => { s.connections.pendingTipFarmerSpaceId = null; },
      false,
      'connections/closeTip',
    );
  },

  sendTip: (params: SendTipParams) => {
    const platformFeeCents = calcPlatformFee(params.grossAmountCents);
    const netAmountCents = params.grossAmountCents - platformFeeCents;

    const tip: TipTransaction = {
      id: `tip_${Date.now()}`,
      fromSpaceId: params.fromSpaceId,
      fromName: params.fromName,
      toFarmerSpaceId: params.toFarmerSpaceId,
      toFarmerName: params.toFarmerName,
      grossAmountCents: params.grossAmountCents,
      platformFeeCents,
      netAmountCents,
      rail: params.rail,
      status: 'pending',
      referencedPostId: params.referencedPostId ?? null,
      referencedLotId: params.referencedLotId ?? null,
      message: params.message ?? null,
      createdAt: new Date().toISOString(),
      settledAt: null,
    };

    set(
      (s: any) => {
        s.connections.tips = [tip, ...s.connections.tips];
        s.connections.totalTippedCents += params.grossAmountCents;
        s.connections.pendingTipFarmerSpaceId = null;
        // Simulate settlement after 2s
        setTimeout(() => {
          set(
            (st: any) => {
              const idx = st.connections.tips.findIndex((t: TipTransaction) => t.id === tip.id);
              if (idx >= 0) {
                st.connections.tips[idx] = {
                  ...st.connections.tips[idx],
                  status: 'settled',
                  settledAt: new Date().toISOString(),
                };
              }
            },
            false,
            'connections/tip/settled',
          );
        }, 2000);
      },
      false,
      'connections/sendTip',
    );

    return tip;
  },

  getTipsByFarmer: (farmerSpaceId: string) => {
    return get().connections.tips.filter((t: TipTransaction) => t.toFarmerSpaceId === farmerSpaceId);
  },
});
