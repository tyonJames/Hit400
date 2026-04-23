'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Plus, Search } from 'lucide-react';
import { propertyService } from '@/lib/api/services';
import { useAuthStore }    from '@/stores/auth.store';
import { StatusBadge }     from '@/components/shared/status-badge';
import { ROUTES }          from '@/lib/navigation';
import type { Property, PaginatedResponse } from '@/types';

export default function PropertiesPage() {
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const isOwner     = useAuthStore((s) => s.isOwner());
  const user        = useAuthStore((s) => s.user);

  const [data, setData]       = useState<PaginatedResponse<Property> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    if (isOwner && !isRegistrar) {
      propertyService.getByOwner(user!.id)
        .then(setData)
        .finally(() => setLoading(false));
    } else {
      propertyService.list({ search: search || undefined })
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, [search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-slate-800">
            {isOwner && !isRegistrar ? 'My Portfolio' : 'All Properties'}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {data?.total ?? 0} properties registered
          </p>
        </div>
        {isRegistrar && (
          <Link href={ROUTES.NEW_PROPERTY} className="btn-primary">
            <Plus className="w-4 h-4" /> Register Property
          </Link>
        )}
      </div>

      {/* Search */}
      {!isOwner && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search by plot number or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-10 rounded" />)}
          </div>
        ) : !data?.data.length ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MapPin className="w-7 h-7" /></div>
            <p className="text-slate-600 font-medium">No properties found</p>
            <p className="text-slate-400 text-sm">
              {isRegistrar ? 'Register the first property to get started.' : 'No properties are assigned to you.'}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Plot Number</th>
                <th>Address</th>
                <th>Zoning</th>
                <th>Size</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium font-mono text-xs">{p.plotNumber}</td>
                  <td className="max-w-xs truncate">{p.address}</td>
                  <td className="capitalize text-xs">{p.zoningType.toLowerCase()}</td>
                  <td className="text-xs">{p.landSize} {p.unit}</td>
                  <td><StatusBadge status={p.status} size="sm" /></td>
                  <td>
                    <Link href={ROUTES.PROPERTY(p.id)} className="text-primary text-xs hover:underline">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
