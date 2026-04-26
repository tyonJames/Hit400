'use client';

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import { useForm }             from 'react-hook-form';
import { zodResolver }         from '@hookform/resolvers/zod';
import { toast }               from 'sonner';
import { Copy, CheckCircle }   from 'lucide-react';
import { initiateTransferSchema, type InitiateTransferFormData } from '@/lib/schemas';
import { transferService, propertyService } from '@/lib/api/services';
import { useAuthStore }        from '@/stores/auth.store';
import { useBlockchainStore }  from '@/stores/blockchain.store';
import { ROUTES }              from '@/lib/navigation';
import type { Property }       from '@/types';

export default function NewTransferPage() {
  const router  = useRouter();
  const addTx   = useBlockchainStore((s) => s.addTx);
  const user    = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [copied, setCopied]         = useState(false);

  useEffect(() => {
    if (!user) return;
    propertyService.getByOwner(user.id, {})
      .then((res) => setProperties(res.data.filter((p) => p.status === 'ACTIVE')))
      .catch(() => {});
  }, [user]);

  const { register, handleSubmit, formState: { errors } } = useForm<InitiateTransferFormData>({
    resolver: zodResolver(initiateTransferSchema),
  });

  async function onSubmit(data: InitiateTransferFormData) {
    setLoading(true);
    try {
      const transfer = await transferService.initiate({
        propertyId: data.propertyId,
        buyerId:    data.buyerId,
        saleValue:  data.saleValue as number | undefined,
        notes:      data.notes,
      });
      toast.success('Transfer initiated. Awaiting buyer approval.');
      router.replace(ROUTES.TRANSFER(transfer.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to initiate transfer.');
    } finally {
      setLoading(false);
    }
  }

  function copyId() {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h2 className="font-display text-xl text-slate-800">Initiate Transfer</h2>
        <p className="text-slate-500 text-sm mt-0.5">Start a 3-step ownership transfer workflow.</p>
      </div>

      {/* Your ID hint */}
      <div className="card mb-4 bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600">Your User ID (share this with the seller if you&apos;re a buyer)</p>
          <p className="font-mono text-xs text-slate-700 truncate mt-0.5">{user?.id}</p>
        </div>
        <button onClick={copyId} className="btn-ghost flex items-center gap-1.5 text-xs flex-shrink-0">
          {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
        <div>
          <label className="label">Select Property</label>
          {properties.length > 0 ? (
            <select
              className={`input ${errors.propertyId ? 'input-error' : ''}`}
              {...register('propertyId')}
            >
              <option value="">— Choose an active property —</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plotNumber} — {p.address}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                className={`input font-mono ${errors.propertyId ? 'input-error' : ''}`}
                {...register('propertyId')}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
              <p className="field-hint text-amber-600">No active properties found. Enter UUID manually.</p>
            </>
          )}
          {errors.propertyId && <p className="error-msg">{errors.propertyId.message}</p>}
        </div>

        <div>
          <label className="label">Buyer ID (UUID)</label>
          <input
            className={`input font-mono ${errors.buyerId ? 'input-error' : ''}`}
            {...register('buyerId')}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
          {errors.buyerId && <p className="error-msg">{errors.buyerId.message}</p>}
          <p className="field-hint">Ask the buyer to copy their User ID from their Profile page.</p>
        </div>

        <div>
          <label className="label">Sale Value (USD) <span className="text-slate-400 font-normal">(optional)</span></label>
          <input type="number" step="0.01" className="input" {...register('saleValue')} placeholder="50000" />
        </div>

        <div>
          <label className="label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea className="input" rows={3} {...register('notes')} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Initiating…' : 'Initiate Transfer'}
          </button>
        </div>
      </form>
    </div>
  );
}
