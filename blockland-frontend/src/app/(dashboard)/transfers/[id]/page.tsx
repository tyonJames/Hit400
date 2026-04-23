'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link  from 'next/link';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { transferService } from '@/lib/api/services';
import { useAuthStore }    from '@/stores/auth.store';
import { useBlockchainStore } from '@/stores/blockchain.store';
import { StatusBadge, TxHashDisplay } from '@/components/shared/status-badge';
import { ROUTES }          from '@/lib/navigation';
import type { Transfer }   from '@/types';

const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';

const STEPS = ['PENDING_BUYER', 'PENDING_REGISTRAR', 'CONFIRMED'] as const;

export default function TransferDetailPage() {
  const { id }        = useParams<{ id: string }>();
  const router        = useRouter();
  const user          = useAuthStore((s) => s.user);
  const isRegistrar   = useAuthStore((s) => s.isRegistrar());
  const addTx         = useBlockchainStore((s) => s.addTx);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading]   = useState(true);
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    transferService.getById(id).then(setTransfer).finally(() => setLoading(false));
  }, [id]);

  async function handleBuyerApprove() {
    setActioning(true);
    try {
      const updated = await transferService.buyerApprove(id);
      setTransfer(updated);
      toast.success('Transfer approved. Awaiting registrar finalisation.');
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  async function handleRegistrarApprove() {
    setActioning(true);
    try {
      const { transfer: updated, blockchainTxHash } = await transferService.registrarApprove(id);
      addTx(blockchainTxHash, 'finalize-transfer', id, 'Transfer');
      setTransfer(updated);
      toast.success('Transfer finalised on blockchain!');
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  async function handleCancel() {
    setActioning(true);
    try {
      const updated = await transferService.cancel(id);
      setTransfer(updated);
      toast.success('Transfer cancelled.');
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  if (loading) return <div className="skeleton h-64 rounded-card" />;
  if (!transfer) return <div className="empty-state"><p>Transfer not found</p></div>;

  const stepIdx = STEPS.indexOf(transfer.status as any);

  const canBuyerApprove  = transfer.status === 'PENDING_BUYER' && user?.id === transfer.buyerId;
  const canRegistrarApprove = transfer.status === 'PENDING_REGISTRAR' && isRegistrar;
  const canCancel = ['PENDING_BUYER', 'PENDING_REGISTRAR'].includes(transfer.status) &&
    (user?.id === transfer.sellerId || isRegistrar);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.TRANSFERS} className="btn-ghost px-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h2 className="font-display text-xl text-slate-800">Transfer Details</h2>
          <p className="text-slate-500 text-sm">{transfer.property?.plotNumber ?? transfer.propertyId}</p>
        </div>
        <div className="ml-auto"><StatusBadge status={transfer.status} animate /></div>
      </div>

      {/* Step indicator */}
      <div className="card">
        <p className="form-section">Transfer Progress</p>
        <div className="step-indicator">
          {STEPS.map((step, i) => {
            const done   = stepIdx > i || transfer.status === 'CONFIRMED';
            const active = stepIdx === i && transfer.status !== 'CANCELLED';
            const label  = step === 'PENDING_BUYER' ? '1. Buyer Approves'
              : step === 'PENDING_REGISTRAR' ? '2. Registrar Finalises'
              : '3. Confirmed';
            return (
              <>
                <div key={step} className="step-item flex-col items-center gap-1">
                  <div className={`step-circle ${done ? 'step-circle-done' : active ? 'step-circle-active' : 'step-circle-pending'}`}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span className="text-xs text-slate-500 mt-1">{label.split('. ')[1]}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`step-connector ${done ? 'step-connector-done' : 'step-connector-pending'}`} />
                )}
              </>
            );
          })}
        </div>
      </div>

      {/* Details */}
      <div className="card">
        <p className="form-section">Parties</p>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Seller</dt><dd>{transfer.seller?.fullName ?? '—'}</dd></div>
          <div><dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Buyer</dt><dd>{transfer.buyer?.fullName ?? '—'}</dd></div>
          <div><dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Sale Value</dt><dd>{transfer.saleValue ? `$${transfer.saleValue.toLocaleString()}` : '—'}</dd></div>
          <div><dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Initiated</dt><dd>{new Date(transfer.initiatedAt).toLocaleDateString()}</dd></div>
        </dl>
        {transfer.blockchainTxHash && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <TxHashDisplay txHash={transfer.blockchainTxHash} network={NETWORK as 'testnet' | 'mainnet'} label="On-Chain TX" />
          </div>
        )}
      </div>

      {/* Actions */}
      {(canBuyerApprove || canRegistrarApprove || canCancel) && (
        <div className="flex gap-3">
          {canBuyerApprove && (
            <button onClick={handleBuyerApprove} disabled={actioning} className="btn-primary">
              <CheckCircle className="w-4 h-4" />
              {actioning ? 'Approving…' : 'Approve Transfer'}
            </button>
          )}
          {canRegistrarApprove && (
            <button onClick={handleRegistrarApprove} disabled={actioning} className="btn-primary">
              <CheckCircle className="w-4 h-4" />
              {actioning ? 'Finalising on blockchain…' : 'Finalise Transfer'}
            </button>
          )}
          {canCancel && (
            <button onClick={handleCancel} disabled={actioning} className="btn-danger">
              <XCircle className="w-4 h-4" />
              {actioning ? 'Cancelling…' : 'Cancel Transfer'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
