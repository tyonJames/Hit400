'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, MapPin, Edit2, Trash2, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { marketplaceService } from '@/lib/api/services';
import { ROUTES } from '@/lib/navigation';
import type { MarketplaceListing } from '@/types';

const PAYMENT_LABELS: Record<string, string> = {
  ECOCASH: 'EcoCash', ZIPIT: 'ZIPIT',
  BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash',
};

export default function MyListingsPage() {
  const [listings, setListings]       = useState<MarketplaceListing[]>([]);
  const [loading, setLoading]         = useState(true);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [delistingId, setDelistingId] = useState<string | null>(null);
  const [editForm, setEditForm]       = useState({ minPrice: '', maxPrice: '', description: '' });

  async function load() {
    setLoading(true);
    try {
      const data = await marketplaceService.getMy();
      setListings(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function startEdit(listing: MarketplaceListing) {
    setEditingId(listing.id);
    setEditForm({
      minPrice:    String(listing.minPrice),
      maxPrice:    String(listing.maxPrice),
      description: listing.description,
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      await marketplaceService.update(editingId, {
        minPrice:    Number(editForm.minPrice),
        maxPrice:    Number(editForm.maxPrice),
        description: editForm.description.trim(),
      });
      toast.success('Listing updated.');
      setEditingId(null);
      await load();
    } catch (err: any) { toast.error(err?.message); }
  }

  async function handleDelist(id: string) {
    if (!window.confirm('Are you sure you want to remove this listing from the marketplace?')) return;
    setDelistingId(id);
    try {
      await marketplaceService.delist(id);
      toast.success('Listing removed.');
      await load();
    } catch (err: any) { toast.error(err?.message); } finally { setDelistingId(null); }
  }

  if (loading) return <div className="skeleton h-64 rounded-card" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-slate-800">My Listings</h2>
          <p className="text-slate-500 text-sm mt-0.5">{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href={ROUTES.MARKETPLACE_NEW} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          New Listing
        </Link>
      </div>

      {listings.length === 0 ? (
        <div className="empty-state">
          <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No listings yet</p>
          <p className="text-slate-400 text-sm mb-4">Create a listing to advertise your property for sale</p>
          <Link href={ROUTES.MARKETPLACE_NEW} className="btn-primary text-sm">Create First Listing</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => (
            <div key={listing.id} className="card space-y-4">
              {editingId === listing.id ? (
                /* Edit form */
                <div className="space-y-3">
                  <p className="font-medium text-slate-800">
                    Editing: {listing.property?.plotNumber ?? listing.propertyId}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Min Price (USD)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        value={editForm.minPrice}
                        onChange={(e) => setEditForm((f) => ({ ...f, minPrice: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label">Max Price (USD)</label>
                      <input
                        type="number"
                        className="input"
                        min="0"
                        value={editForm.maxPrice}
                        onChange={(e) => setEditForm((f) => ({ ...f, maxPrice: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea
                      className="input"
                      rows={3}
                      maxLength={1000}
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="btn-primary text-sm">Save Changes</button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost text-sm">Cancel</button>
                  </div>
                </div>
              ) : (
                /* Listing row */
                <div className="flex items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">
                        {listing.property?.plotNumber ?? listing.propertyId}
                      </p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                        ${listing.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          listing.status === 'SOLD'   ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          'bg-red-50 text-red-600 border-red-200'}`}>
                        {listing.status}
                      </span>
                    </div>
                    {listing.property?.address && (
                      <p className="text-slate-500 text-sm flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{listing.property.address}
                      </p>
                    )}
                    <p className="text-sm font-semibold text-emerald-700">
                      ${listing.minPrice.toLocaleString()} – ${listing.maxPrice.toLocaleString()}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {listing.paymentMethods.map((m) => (
                        <span key={m} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {PAYMENT_LABELS[m] ?? m}
                        </span>
                      ))}
                    </div>
                    {listing.description && (
                      <p className="text-sm text-slate-600 line-clamp-2">{listing.description}</p>
                    )}
                  </div>

                  {listing.status === 'ACTIVE' && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Link
                        href={ROUTES.MARKETPLACE_ITEM(listing.id)}
                        className="btn-ghost text-xs py-1.5"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => startEdit(listing)}
                        className="btn-secondary text-xs py-1.5 flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelist(listing.id)}
                        disabled={delistingId === listing.id}
                        className="btn-ghost text-xs py-1.5 text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        {delistingId === listing.id ? '…' : 'Delist'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs text-slate-400">
                <span>Created {new Date(listing.createdAt).toLocaleDateString()}</span>
                {listing.status !== 'ACTIVE' && (
                  <span>Updated {new Date(listing.updatedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
