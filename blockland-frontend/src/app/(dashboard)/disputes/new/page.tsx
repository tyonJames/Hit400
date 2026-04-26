'use client';

import { useState, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import { useForm }             from 'react-hook-form';
import { zodResolver }         from '@hookform/resolvers/zod';
import { toast }               from 'sonner';
import { createDisputeSchema, type CreateDisputeFormData, DISPUTE_TYPES } from '@/lib/schemas';
import { disputeService, propertyService } from '@/lib/api/services';
import { useAuthStore }        from '@/stores/auth.store';
import { useBlockchainStore }  from '@/stores/blockchain.store';
import { ROUTES }              from '@/lib/navigation';
import type { Property }       from '@/types';

export default function NewDisputePage() {
  const router  = useRouter();
  const addTx   = useBlockchainStore((s) => s.addTx);
  const user    = useAuthStore((s) => s.user);
  const [loading, setLoading]   = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);

  useEffect(() => {
    if (!user) return;
    propertyService.getByOwner(user.id, {})
      .then((res) => setProperties(res.data.filter((p) => p.status === 'ACTIVE')))
      .catch(() => {});
  }, [user]);

  const { register, handleSubmit, formState: { errors } } = useForm<CreateDisputeFormData>({
    resolver: zodResolver(createDisputeSchema),
  });

  async function onSubmit(data: CreateDisputeFormData) {
    setLoading(true);
    try {
      const { dispute, blockchainTxHash } = await disputeService.create(data as any);
      addTx(blockchainTxHash, 'flag-dispute', dispute.id, 'Dispute');
      toast.success('Dispute raised and flagged on blockchain.');
      router.replace(ROUTES.DISPUTE(dispute.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to raise dispute.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h2 className="font-display text-xl text-slate-800">Raise Dispute</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          This will flag the property as disputed on the Stacks blockchain.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-4">
        <div>
          <label className="label">Property</label>
          {properties.length > 0 ? (
            <select
              className={`input ${errors.propertyId ? 'input-error' : ''}`}
              {...register('propertyId')}
            >
              <option value="">— Select a property to dispute —</option>
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
              <p className="field-hint">No active properties found. Enter UUID manually.</p>
            </>
          )}
          {errors.propertyId && <p className="error-msg">{errors.propertyId.message}</p>}
        </div>

        <div>
          <label className="label">Dispute Type</label>
          <select className={`input ${errors.disputeType ? 'input-error' : ''}`} {...register('disputeType')}>
            <option value="">Select type…</option>
            {DISPUTE_TYPES.map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
          {errors.disputeType && <p className="error-msg">{errors.disputeType.message}</p>}
        </div>

        <div>
          <label className="label">Description</label>
          <textarea
            className={`input ${errors.description ? 'input-error' : ''}`}
            rows={5}
            {...register('description')}
            placeholder="Describe the dispute in detail (minimum 20 characters)…"
          />
          {errors.description && <p className="error-msg">{errors.description.message}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Submitting to blockchain…' : 'Raise Dispute'}
          </button>
        </div>
      </form>
    </div>
  );
}
