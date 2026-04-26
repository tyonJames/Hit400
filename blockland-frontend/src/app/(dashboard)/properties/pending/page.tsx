'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { propertyService } from '@/lib/api/services';
import { StatusBadge }     from '@/components/shared/status-badge';
import { ROUTES }          from '@/lib/navigation';
import type { Property, PaginatedResponse } from '@/types';

export default function PendingQueuePage() {
  const [data, setData]       = useState<PaginatedResponse<Property> | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    propertyService.list({ status: 'PENDING_APPROVAL', limit: 50 })
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const count = data?.total ?? 0;

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="font-display text-xl text-slate-800">Pending Approvals Queue</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              {count} submission{count !== 1 ? 's' : ''} awaiting review
            </p>
          </div>
          {count > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-10 rounded" />)}
          </div>
        ) : !data?.data.length ? (
          <div className="empty-state py-20">
            <div className="empty-state-icon">
              <ClipboardList className="w-7 h-7" />
            </div>
            <p className="text-slate-600 font-medium">No pending submissions</p>
            <p className="text-slate-400 text-sm">All caught up — nothing left to review.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Plot Number</th>
                <th>Address</th>
                <th>Submitted By</th>
                <th>Submitted</th>
                <th>Zoning</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs font-medium">{p.plotNumber}</td>
                  <td className="max-w-xs truncate text-sm">{p.address}</td>
                  <td className="text-sm">{p.currentOwner?.fullName ?? '—'}</td>
                  <td className="text-xs text-slate-500 whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleDateString(undefined, {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>
                  <td className="text-xs capitalize">{p.zoningType.toLowerCase()}</td>
                  <td><StatusBadge status={p.status} size="sm" /></td>
                  <td>
                    <Link
                      href={ROUTES.PROPERTY(p.id)}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      Review →
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
