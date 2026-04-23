// =============================================================================
// src/stores/blockchain.store.ts — Blockchain Transaction State (Zustand)
// =============================================================================

import { create }             from 'zustand';
import { devtools }           from 'zustand/middleware';
import type { BlockchainTxState } from '@/types';

interface BlockchainStore {
  transactions: BlockchainTxState[];

  addTx:    (txid: string, action: string, entityId: string, entityType: string) => void;
  updateTx: (txid: string, status: BlockchainTxState['status']) => void;
  removeTx: (txid: string) => void;
  getTxsForEntity:      (entityId: string) => BlockchainTxState[];
  getLatestTxForEntity: (entityId: string) => BlockchainTxState | undefined;
  isPending:            (entityId: string) => boolean;
}

export const useBlockchainStore = create<BlockchainStore>()(
  devtools(
    (set, get) => ({
      transactions: [],

      addTx: (txid, action, entityId, entityType) => {
        const tx: BlockchainTxState = {
          txid, status: 'pending', action, entityId, entityType,
          startedAt: new Date().toISOString(),
        };
        set((state) => ({ transactions: [tx, ...state.transactions] }));
      },

      updateTx: (txid, status) => {
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.txid === txid ? { ...tx, status } : tx
          ),
        }));
      },

      removeTx: (txid) => {
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.txid !== txid),
        }));
      },

      getTxsForEntity:      (entityId) => get().transactions.filter((tx) => tx.entityId === entityId),
      getLatestTxForEntity: (entityId) => get().transactions.find((tx) => tx.entityId === entityId),
      isPending:            (entityId) => get().transactions.some(
        (tx) => tx.entityId === entityId && tx.status === 'pending'
      ),
    }),
    { name: 'BlockLand:Blockchain' }
  )
);
