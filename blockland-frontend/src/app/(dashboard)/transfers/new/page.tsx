'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm }             from 'react-hook-form';
import { zodResolver }         from '@hookform/resolvers/zod';
import { z }                   from 'zod';
import { toast }               from 'sonner';
import { Search, CheckCircle, Copy, UserCheck } from 'lucide-react';
import { transferService, propertyService, userService } from '@/lib/api/services';
import { useAuthStore }        from '@/stores/auth.store';
import { ROUTES }              from '@/lib/navigation';
import type { Property }       from '@/types';

const PAYMENT_METHODS = ['EcoCash', 'ZIPIT', 'Bank Transfer', 'Cash'];

const schema = z.object({
  propertyId:          z.string().uuid('Select a property'),
  saleValue:           z.coerce.number().min(0.01).optional().or(z.literal('')),
  paymentMethod:       z.string().min(1, 'Select a payment method'),
  paymentInstructions: z.string().max(1000).optional().or(z.literal('')),
  notes:               z.string().max(500).optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

interface BuyerResult { id: string; fullName: string; blocklandId: string; roles: string[] }

export default function NewTransferPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const user         = useAuthStore((s) => s.user);

  const [loading, setLoading]         = useState(false);
  const [properties, setProperties]   = useState<Property[]>([]);
  const [blIdInput, setBlIdInput]     = useState('');
  const [searching, setSearching]     = useState(false);
  const [foundBuyer, setFoundBuyer]   = useState<BuyerResult | null>(null);
  const [buyerError, setBuyerError]   = useState('');
  const [copied, setCopied]           = useState(false);

  // Pre-fill from marketplace redirect: ?buyerId=<id>&buyerName=<name>&buyerBlId=<blid>
  useEffect(() => {
    const buyerId   = searchParams.get('buyerId');
    const buyerName = searchParams.get('buyerName');
    const buyerBlId = searchParams.get('buyerBlId');
    const propId    = searchParams.get('propertyId');

    if (buyerId && buyerName && buyerBlId) {
      setFoundBuyer({ id: buyerId, fullName: buyerName, blocklandId: buyerBlId, roles: [] });
      setBlIdInput(buyerBlId);
    }
    if (propId) {
      setValue('propertyId', propId);
    }
  }, [searchParams]); // eslint-disable-line

  useEffect(() => {
    if (!user) return;
    propertyService.getByOwner(user.id, {})
      .then((res) => {
        const items = Array.isArray(res) ? res : (res?.data ?? []);
        setProperties(items.filter((p) => p.status === 'ACTIVE'));
      })
      .catch(() => {});
  }, [user]);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function searchBuyer() {
    const val = blIdInput.trim().toUpperCase();
    if (!val.startsWith('BL-')) return setBuyerError('Enter a valid Blockland ID starting with BL-');
    setSearching(true);
    setBuyerError('');
    setFoundBuyer(null);
    try {
      const result = await userService.searchByBlocklandId(val);
      if (!result) {
        setBuyerError('No active user found with that Blockland ID.');
      } else if (result.id === user?.id) {
        setBuyerError('You cannot transfer to yourself.');
      } else {
        setFoundBuyer(result);
      }
    } catch {
      setBuyerError('Search failed. Try again.');
    } finally {
      setSearching(false);
    }
  }

  async function onSubmit(data: FormData) {
    if (!foundBuyer) return toast.error('Search for the buyer by their Blockland ID first.');
    setLoading(true);
    try {
      const transfer = await transferService.initiate({
        propertyId:          data.propertyId,
        buyerId:             foundBuyer.id,
        saleValue:           data.saleValue ? Number(data.saleValue) : undefined,
        paymentMethod:       data.paymentMethod,
        paymentInstructions: data.paymentInstructions || undefined,
        notes:               data.notes || undefined,
      });
      toast.success('Transfer submitted for registrar review.');
      router.replace(ROUTES.TRANSFER(transfer.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to initiate transfer.');
    } finally {
      setLoading(false);
    }
  }

  function copyBlId() {
    if (!user?.blocklandId) return;
    navigator.clipboard.writeText(user.blocklandId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h2 className="font-display text-xl text-slate-800">Initiate Transfer</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Submit a transfer for registrar review. You&apos;ll provide payment details so the buyer knows how to pay.
        </p>
      </div>

      {/* Your BL-ID hint */}
      {user?.blocklandId && (
        <div className="card mb-4 bg-slate-50 border border-slate-200 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-600">Your Blockland ID (share with sellers if you&apos;re buying)</p>
            <p className="font-mono text-sm text-slate-800 mt-0.5">{user.blocklandId}</p>
          </div>
          <button onClick={copyBlId} className="btn-ghost flex items-center gap-1.5 text-xs flex-shrink-0">
            {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5">
        {/* Property */}
        <div>
          <label className="label">Select Property <span className="text-red-500">*</span></label>
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
            <p className="text-sm text-amber-600">No active properties found. You must own an active property to initiate a transfer.</p>
          )}
          {errors.propertyId && <p className="error-msg">{errors.propertyId.message}</p>}
        </div>

        {/* Buyer search by BL-ID */}
        <div>
          <label className="label">Buyer Blockland ID <span className="text-red-500">*</span></label>
          <div className="flex gap-2">
            <input
              className={`input font-mono flex-1 ${buyerError ? 'input-error' : ''}`}
              value={blIdInput}
              onChange={(e) => { setBlIdInput(e.target.value.toUpperCase()); setFoundBuyer(null); setBuyerError(''); }}
              placeholder="BL-XXXXXX"
              maxLength={12}
            />
            <button
              type="button"
              onClick={searchBuyer}
              disabled={searching || blIdInput.length < 8}
              className="btn-secondary flex items-center gap-1.5 text-sm flex-shrink-0"
            >
              <Search className="w-4 h-4" />
              {searching ? 'Searching…' : 'Search'}
            </button>
          </div>
          {buyerError && <p className="error-msg">{buyerError}</p>}
          <p className="field-hint">Ask the buyer to share their Blockland ID from their Profile page.</p>
          {foundBuyer && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-emerald-800">{foundBuyer.fullName}</span>
                <span className="text-emerald-600 ml-2 font-mono text-xs">{foundBuyer.blocklandId}</span>
              </div>
            </div>
          )}
        </div>

        {/* Sale value */}
        <div>
          <label className="label">Sale Value (ZWL) <span className="text-slate-400 font-normal">(optional)</span></label>
          <input type="number" step="0.01" className="input" {...register('saleValue')} placeholder="50000" />
        </div>

        {/* Payment method */}
        <div>
          <label className="label">Payment Method <span className="text-red-500">*</span></label>
          <select className={`input ${errors.paymentMethod ? 'input-error' : ''}`} {...register('paymentMethod')}>
            <option value="">— Select —</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {errors.paymentMethod && <p className="error-msg">{errors.paymentMethod.message}</p>}
        </div>

        {/* Payment instructions */}
        <div>
          <label className="label">Payment Instructions <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea
            className="input"
            rows={3}
            {...register('paymentInstructions')}
            placeholder="e.g. EcoCash number: 0771234567, Name: John Doe. Reference: Plot 123 transfer."
          />
          <p className="field-hint">These will be shared with the buyer after registrar approval.</p>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Additional Notes <span className="text-slate-400 font-normal">(optional)</span></label>
          <textarea className="input" rows={2} {...register('notes')} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={loading || !foundBuyer || properties.length === 0} className="btn-primary">
            {loading ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
