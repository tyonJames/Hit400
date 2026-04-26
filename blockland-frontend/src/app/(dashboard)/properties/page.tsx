'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { MapPin, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { propertyService } from '@/lib/api/services';
import { useAuthStore }    from '@/stores/auth.store';
import { StatusBadge }     from '@/components/shared/status-badge';
import { ROUTES }          from '@/lib/navigation';
import type { Property, PaginatedResponse } from '@/types';

const STATUS_OPTIONS = [
  { value: '',                 label: 'All Statuses'     },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'ACTIVE',           label: 'Active'           },
  { value: 'DECLINED',         label: 'Declined'         },
  { value: 'DISPUTED',         label: 'Disputed'         },
];

const ZONING_OPTIONS = [
  { value: '',             label: 'All Zones'    },
  { value: 'RESIDENTIAL',  label: 'Residential'  },
  { value: 'COMMERCIAL',   label: 'Commercial'   },
  { value: 'AGRICULTURAL', label: 'Agricultural' },
  { value: 'INDUSTRIAL',   label: 'Industrial'   },
];

export default function PropertiesPage() {
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const isAdmin     = useAuthStore((s) => s.isAdmin());
  const isUser      = useAuthStore((s) => s.isUser());
  const user        = useAuthStore((s) => s.user);

  const [data, setData]       = useState<PaginatedResponse<Property> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [zoning, setZoning]   = useState('');

  const isOwnerOnly = isUser && !isRegistrar && !isAdmin;

  const fetchData = useCallback(() => {
    setLoading(true);
    if (isOwnerOnly) {
      propertyService.getByOwner(user!.id, {})
        .then(setData)
        .finally(() => setLoading(false));
    } else {
      propertyService.list({
        search:     search  || undefined,
        status:     status  || undefined,
        zoningType: zoning  || undefined,
      })
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, [search, status, zoning, isOwnerOnly, user]);

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  const canFilter = !isOwnerOnly;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-slate-800">
            {isOwnerOnly ? 'My Portfolio' : 'All Properties'}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {data?.total ?? 0} {isOwnerOnly ? 'properties owned' : 'properties registered'}
          </p>
        </div>
        {(isRegistrar || isUser) && (
          <Link href={ROUTES.NEW_PROPERTY} className="btn-primary">
            <Plus className="w-4 h-4" /> Register Property
          </Link>
        )}
      </div>

      {/* Filters */}
      {canFilter && (
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search plot number, address or title deed…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input pl-8 pr-8 appearance-none min-w-44"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Zoning filter */}
          <select
            value={zoning}
            onChange={(e) => setZoning(e.target.value)}
            className="input pr-8 appearance-none min-w-40"
          >
            {ZONING_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-10 rounded" />)}
          </div>
        ) : !data?.data.length ? (
          <div className="empty-state">
            <div className="empty-state-icon"><MapPin className="w-7 h-7" /></div>
            <p className="text-slate-600 font-medium">No properties found</p>
            <p className="text-slate-400 text-sm">
              {canFilter && (search || status || zoning)
                ? 'Try adjusting your filters.'
                : isOwnerOnly
                  ? 'You have no registered properties.'
                  : 'Register the first property to get started.'}
            </p>
            {canFilter && (search || status || zoning) && (
              <button
                onClick={() => { setSearch(''); setStatus(''); setZoning(''); }}
                className="btn-ghost text-sm mt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Plot Number</th>
                <th>Address</th>
                {!isOwnerOnly && <th>Owner</th>}
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
                  <td className="max-w-xs truncate text-sm">{p.address}</td>
                  {!isOwnerOnly && <td className="text-sm">{p.currentOwner?.fullName ?? '—'}</td>}
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
