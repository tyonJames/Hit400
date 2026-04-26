'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { marketplaceService, propertyService } from '@/lib/api/services';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/lib/navigation';
import type { Property } from '@/types';

const PAYMENT_OPTIONS = [
  { value: 'ECOCASH',       label: 'EcoCash' },
  { value: 'ZIPIT',         label: 'ZIPIT' },
  { value: 'BANK_TRANSFER', label: 'USD Bank Transfer' },
  { value: 'CASH',          label: 'Cash' },
];

export default function CreateListingPage() {
  const router = useRouter();
  const user   = useAuthStore((s) => s.user);

  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProps, setLoadingProps] = useState(true);
  const [submitting, setSubmitting]     = useState(false);

  const [propertyId, setPropertyId]       = useState('');
  const [minPrice, setMinPrice]           = useState('');
  const [maxPrice, setMaxPrice]           = useState('');
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [description, setDescription]     = useState('');

  useEffect(() => {
    if (!user) return;
    propertyService.getByOwner(user.id)
      .then((res) => setProperties(res.data.filter((p) => p.status === 'ACTIVE')))
      .finally(() => setLoadingProps(false));
  }, [user?.id]);

  function togglePayment(val: string) {
    setPaymentMethods((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId)             return toast.error('Select a property.');
    if (!minPrice || !maxPrice)  return toast.error('Enter the asking price range.');
    if (Number(minPrice) > Number(maxPrice)) return toast.error('Minimum price cannot exceed maximum price.');
    if (paymentMethods.length === 0) return toast.error('Select at least one payment method.');
    if (!description.trim())     return toast.error('Add a description.');

    setSubmitting(true);
    try {
      const listing = await marketplaceService.create({
        propertyId,
        minPrice:       Number(minPrice),
        maxPrice:       Number(maxPrice),
        paymentMethods,
        description:    description.trim(),
      });
      toast.success('Listing created successfully!');
      router.push(ROUTES.MARKETPLACE_ITEM(listing.id));
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create listing.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.MARKETPLACE} className="btn-ghost px-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="font-display text-xl text-slate-800">Create Listing</h2>
          <p className="text-slate-500 text-sm">Advertise your property on the marketplace</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Property Selector */}
        <div>
          <label className="label">Property <span className="text-red-500">*</span></label>
          {loadingProps ? (
            <div className="skeleton h-10 rounded" />
          ) : properties.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
              No active properties available for listing.
              <Link href={ROUTES.PROPERTIES} className="ml-1 underline">View your properties</Link>
            </div>
          ) : (
            <select
              className="input"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
            >
              <option value="">Select a property…</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.plotNumber} — {p.address}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Price Range */}
        <div>
          <label className="label">Asking Price Range (USD) <span className="text-red-500">*</span></label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="number"
                className="input"
                placeholder="Minimum"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                required
              />
            </div>
            <span className="text-slate-400">—</span>
            <div className="flex-1">
              <input
                type="number"
                className="input"
                placeholder="Maximum"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                required
              />
            </div>
          </div>
          {minPrice && maxPrice && Number(minPrice) > Number(maxPrice) && (
            <p className="text-red-500 text-xs mt-1">Minimum cannot exceed maximum</p>
          )}
        </div>

        {/* Payment Methods */}
        <div>
          <label className="label">Accepted Payment Methods <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_OPTIONS.map(({ value, label }) => (
              <label
                key={value}
                className={`flex items-center gap-2.5 border rounded-xl px-3 py-2.5 cursor-pointer transition-colors
                  ${paymentMethods.includes(value)
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary"
                  checked={paymentMethods.includes(value)}
                  onChange={() => togglePayment(value)}
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="label">Description <span className="text-red-500">*</span></label>
          <textarea
            className="input"
            rows={4}
            placeholder="Describe the property — location highlights, unique features, reason for selling…"
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{description.length}/1000</p>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting || properties.length === 0}
            className="btn-primary flex-1"
          >
            {submitting ? 'Creating…' : 'Create Listing'}
          </button>
          <Link href={ROUTES.MARKETPLACE} className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
