// =============================================================================
// src/stores/blockchain.store.ts — Blockchain Transaction State (Zustand)
// =============================================================================
//
// PURPOSE: Tracks the state of in-flight and recently completed blockchain
//          transactions. This is the "pending transaction" layer between
//          the API's 202 Accepted response and the on-chain confirmation.
//
// WHY A SEPARATE STORE?
//   Blockchain transactions are inherently asynchronous (10+ seconds on Stacks
//   testnet). Rather than locking the UI, we store the tx state globally and
//   show non-blocking progress indicators wherever the tx is relevant.
//
// UX PATTERN:
//   1. User clicks "Register Property" → API returns 202 { txid, status: PENDING }
//   2. addTx(txid, 'register-property', property.id, 'Property') is called
//   3. A toast shows "Transaction submitted — awaiting blockchain confirmation"
//   4. The property card shows a pulsing "Pending On-Chain" badge
//   5. pollTx() polls /properties/:id every 5 seconds until status ≠ ACTIVE_PENDING
//   6. On confirmation: updateTx(txid, 'confirmed') → badge changes to "Verified ✓"
//   7. On failure: updateTx(txid, 'failed') → error toast + alert banner
//
// EXPLORER LINKS:
//   Every tx entry includes a link to the Stacks Explorer for that transaction,
//   displayed in the TX receipt modal and in the activity log.
// =============================================================================

import { create }          from 'zustand';
import { devtools }        from 'zustand/middleware';
import type { BlockchainTxState } from '@/types';

interface BlockchainStore {
  transactions: BlockchainTxState[];  // All tracked txs in current session

  addTx:    (
    txid:       string,
    action:     string,
    entityId:   string,
    entityType: string,
  ) => void;

  updateTx: (txid: string, status: BlockchainTxState['status']) => void;

  removeTx: (txid: string) => void;

  /** Returns all txs for a given entity (e.g. all txs for property X) */
  getTxsForEntity: (entityId: string) => BlockchainTxState[];

  /** Returns the most recent tx for an entity */
  getLatestTxForEntity: (entityId: string) => BlockchainTxState | undefined;

  /** Returns true if any tx is pending for the given entity */
  isPending: (entityId: string) => boolean;
}

export const useBlockchainStore = create<BlockchainStore>()(
  devtools(
    (set, get) => ({
      transactions: [],

      addTx: (txid, action, entityId, entityType) => {
        const tx: BlockchainTxState = {
          txid,
          status:     'pending',
          action,
          entityId,
          entityType,
          startedAt:  new Date().toISOString(),
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

      getTxsForEntity: (entityId) =>
        get().transactions.filter((tx) => tx.entityId === entityId),

      getLatestTxForEntity: (entityId) =>
        get().transactions.find((tx) => tx.entityId === entityId),

      isPending: (entityId) =>
        get().transactions.some(
          (tx) => tx.entityId === entityId && tx.status === 'pending'
        ),
    }),
    { name: 'BlockLand:Blockchain' }
  )
);
