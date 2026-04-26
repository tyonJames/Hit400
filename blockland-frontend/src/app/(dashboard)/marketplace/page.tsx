'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, MapPin, DollarSign, Tag } from 'lucide-react';
import { marketplaceService } from '@/lib/api/services';
import { formatRange } from '@/lib/format';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/lib/navigation';
import type { MarketplaceListing } from '@/types';

const PAYMENT_LABELS: Record<string, string> = {
  ECOCASH: 'EcoCash', ZIPIT: 'ZIPIT',
  BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash',
};

export default function MarketplacePage() {
  const user = useAuthStore((s) => s.user);
  const [listings, setListings]     = useState<MarketplaceListing[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [minPrice, setMinPrice]     = useState('');
  const [maxPrice, setMaxPrice]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await marketplaceService.list({
        page, limit: 12,
        search: debouncedSearch || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
      });
      setListings(res.data);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, minPrice, maxPrice]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, minPrice, maxPrice]);

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-slate-800">Property Marketplace</h2>
          <p className="text-slate-500 text-sm mt-0.5">{total} active listing{total !== 1 ? 's' : ''}</p>
        </div>
        {user && (
          <Link href={ROUTES.MARKETPLACE_MY} className="btn-secondary text-sm">My Listings</Link>
        )}
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by address or plot number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="number"
            className="input w-32"
            placeholder="Min price"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            min="0"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="number"
            className="input w-32"
            placeholder="Max price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            min="0"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 w-3/4 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-9 rounded" />
            </div>
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="empty-state">
          <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No listings found</p>
          <p className="text-slate-400 text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-ghost text-sm"
          >
            Previous
          </button>
          <span className="text-slate-500 text-sm">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn-ghost text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const prop = listing.property;
  return (
    <Link
      href={ROUTES.MARKETPLACE_ITEM(listing.id)}
      className="card hover:border-primary/30 hover:shadow-md transition-all group block"
    >
      <div className="space-y-3">
        <div>
          <p className="font-display text-slate-800 font-medium group-hover:text-primary transition-colors truncate">
            {prop?.plotNumber ?? 'Property'}
          </p>
          {prop?.address && (
            <p className="text-slate-500 text-sm flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {prop.address}
            </p>
          )}
        </div>

        {prop && (
          <div className="flex gap-3 text-xs text-slate-500">
            <span>{prop.zoningType}</span>
            <span>·</span>
            <span>{prop.landSize} {prop.unit}</span>
          </div>
        )}

        <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Asking Price</p>
          <p className="text-emerald-800 font-semibold text-sm mt-0.5">
            {formatRange(listing.minPrice, listing.maxPrice)}
          </p>
        </div>

        {listing.paymentMethods?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {listing.paymentMethods.map((m) => (
              <span key={m} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs
                                       bg-slate-100 text-slate-600 border border-slate-200">
                {PAYMENT_LABELS[m] ?? m}
              </span>
            ))}
          </div>
        )}

        <p className="text-slate-500 text-xs">
          Listed by {listing.seller?.fullName ?? 'Seller'} · {new Date(listing.createdAt).toLocaleDateString()}
        </p>
      </div>
    </Link>
  );
}
