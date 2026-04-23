'use client';

import { useState }    from 'react';
import { useRouter }   from 'next/navigation';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast }       from 'sonner';
import { initiateTransferSchema, type InitiateTransferFormData } from '@/lib/schemas';
import { transferService } from '@/lib/api/services';
import { useBlockchainStore } from '@/stores/blockchain.store';
import { ROUTES }      from '@/lib/navigation';

export default function NewTransferPage() {
  const router  = useRouter();
  const addTx   = useBlockchainStore((s) => s.addTx);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h2 className="font-display text-xl text-slate-800">Initiate Transfer</h2>
        <p className="text-slate-500 text-sm mt-0.5">Start a 3-step ownership transfer workflow.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
        <div>
          <label className="label">Property ID (UUID)</label>
          <input className={`input font-mono ${errors.propertyId ? 'input-error' : ''}`} {...register('propertyId')} placeholder="00000000-0000-0000-0000-000000000000" />
          {errors.propertyId && <p className="error-msg">{errors.propertyId.message}</p>}
          <p className="field-hint">Copy the UUID from the property detail page.</p>
        </div>

        <div>
          <label className="label">Buyer ID (UUID)</label>
          <input className={`input font-mono ${errors.buyerId ? 'input-error' : ''}`} {...register('buyerId')} placeholder="00000000-0000-0000-0000-000000000000" />
          {errors.buyerId && <p className="error-msg">{errors.buyerId.message}</p>}
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
