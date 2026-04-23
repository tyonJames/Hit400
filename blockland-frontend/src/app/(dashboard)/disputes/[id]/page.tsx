'use client';

import { useEffect, useState } from 'react';
import { useParams }   from 'next/navigation';
import Link            from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast }       from 'sonner';
import { resolveDisputeSchema, type ResolveDisputeFormData } from '@/lib/schemas';
import { disputeService } from '@/lib/api/services';
import { useAuthStore }   from '@/stores/auth.store';
import { useBlockchainStore } from '@/stores/blockchain.store';
import { StatusBadge, TxHashDisplay } from '@/components/shared/status-badge';
import { ROUTES }         from '@/lib/navigation';
import type { Dispute }   from '@/types';

const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';

export default function DisputeDetailPage() {
  const { id }       = useParams<{ id: string }>();
  const isRegistrar  = useAuthStore((s) => s.isRegistrar());
  const addTx        = useBlockchainStore((s) => s.addTx);
  const [dispute, setDispute]   = useState<Dispute | null>(null);
  const [loading, setLoading]   = useState(true);
  const [resolving, setResolving] = useState(false);
  const [showResolve, setShowResolve] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResolveDisputeFormData>({
    resolver: zodResolver(resolveDisputeSchema),
  });

  useEffect(() => {
    disputeService.getById(id).then(setDispute).finally(() => setLoading(false));
  }, [id]);

  async function onResolve(data: ResolveDisputeFormData) {
    setResolving(true);
    try {
      const { dispute: updated, blockchainTxHash } = await disputeService.resolve(id, data.resolutionNotes);
      addTx(blockchainTxHash, 'resolve-dispute', id, 'Dispute');
      setDispute(updated);
      setShowResolve(false);
      toast.success('Dispute resolved on blockchain.');
    } catch (err: any) { toast.error(err?.message); } finally { setResolving(false); }
  }

  if (loading) return <div className="skeleton h-64 rounded-card" />;
  if (!dispute) return <div className="empty-state"><p>Dispute not found</p></div>;

  const canResolve = isRegistrar && ['OPEN', 'UNDER_REVIEW'].includes(dispute.status);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.DISPUTES} className="btn-ghost px-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h2 className="font-display text-xl text-slate-800">Dispute Details</h2>
          <p className="text-slate-500 text-sm capitalize">{dispute.disputeType.toLowerCase().replace(/_/g, ' ')}</p>
        </div>
        <div className="ml-auto"><StatusBadge status={dispute.status} animate /></div>
      </div>

      <div className="card space-y-4">
        <p className="form-section">Details</p>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Property</dt><dd className="font-mono text-xs">{dispute.property?.plotNumber ?? dispute.propertyId}</dd></div>
          <div><dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Raised By</dt><dd>{dispute.raisedBy?.fullName ?? '—'}</dd></div>
          <div><dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Date Raised</dt><dd>{new Date(dispute.raisedAt).toLocaleDateString()}</dd></div>
          <div><dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Resolved</dt><dd>{dispute.resolvedAt ? new Date(dispute.resolvedAt).toLocaleDateString() : '—'}</dd></div>
        </dl>
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-1">Description</p>
          <p className="text-sm text-slate-700 leading-relaxed">{dispute.description}</p>
        </div>
        {dispute.blockchainTxHash && (
          <TxHashDisplay txHash={dispute.blockchainTxHash} network={NETWORK as 'testnet' | 'mainnet'} label="Dispute TX" />
        )}
      </div>

      {dispute.resolution && (
        <div className="card space-y-3 border-emerald-200">
          <p className="form-section text-emerald-700">Resolution</p>
          <p className="text-sm text-slate-700">{dispute.resolution.resolutionNotes}</p>
          <p className="text-xs text-slate-500">Resolved by {dispute.resolution.resolvedBy?.fullName} on {new Date(dispute.resolution.resolvedAt).toLocaleDateString()}</p>
          {dispute.resolution.blockchainTxHash && (
            <TxHashDisplay txHash={dispute.resolution.blockchainTxHash} network={NETWORK as 'testnet' | 'mainnet'} label="Resolution TX" />
          )}
        </div>
      )}

      {canResolve && !showResolve && (
        <button onClick={() => setShowResolve(true)} className="btn-primary">
          <CheckCircle className="w-4 h-4" /> Resolve Dispute
        </button>
      )}

      {showResolve && (
        <form onSubmit={handleSubmit(onResolve)} className="card space-y-4">
          <p className="form-section">Resolve Dispute</p>
          <div>
            <label className="label">Resolution Notes</label>
            <textarea
              className={`input ${errors.resolutionNotes ? 'input-error' : ''}`}
              rows={5}
              {...register('resolutionNotes')}
              placeholder="Document the resolution decision (minimum 20 characters)…"
            />
            {errors.resolutionNotes && <p className="error-msg">{errors.resolutionNotes.message}</p>}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowResolve(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={resolving} className="btn-primary">
              {resolving ? 'Resolving on blockchain…' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
