'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { transferService } from '@/lib/api/services';
import { useAuthStore }    from '@/stores/auth.store';
import { StatusBadge }     from '@/components/shared/status-badge';
import { ROUTES }          from '@/lib/navigation';
import type { Transfer, PaginatedResponse } from '@/types';

export default function TransfersPage() {
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const isAdmin     = useAuthStore((s) => s.isAdmin());
  const isOwner     = useAuthStore((s) => s.isOwner());
  const isBuyer     = useAuthStore((s) => s.isBuyer());

  const [data, setData]       = useState<PaginatedResponse<Transfer> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = (isRegistrar || isAdmin)
      ? transferService.list()
      : transferService.getMine();
    fetch.then(setData).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-slate-800">Transfers</h2>
          <p className="text-slate-500 text-sm mt-0.5">{data?.total ?? 0} total transfers</p>
        </div>
        {isOwner && (
          <Link href={ROUTES.NEW_TRANSFER} className="btn-primary">
            <Plus className="w-4 h-4" /> Initiate Transfer
          </Link>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded" />)}
          </div>
        ) : !data?.data.length ? (
          <div className="empty-state">
            <p className="text-slate-600 font-medium">No transfers found</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Seller</th>
                <th>Buyer</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono text-xs">{t.property?.plotNumber ?? t.propertyId.slice(0,8)}</td>
                  <td className="text-sm">{t.seller?.fullName ?? '—'}</td>
                  <td className="text-sm">{t.buyer?.fullName ?? '—'}</td>
                  <td><StatusBadge status={t.status} size="sm" /></td>
                  <td className="text-xs text-slate-400">{new Date(t.initiatedAt).toLocaleDateString()}</td>
                  <td>
                    <Link href={ROUTES.TRANSFER(t.id)} className="text-primary text-xs hover:underline">View →</Link>
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
