'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, AlertTriangle } from 'lucide-react';
import { disputeService } from '@/lib/api/services';
import { useAuthStore }   from '@/stores/auth.store';
import { StatusBadge }    from '@/components/shared/status-badge';
import { ROUTES }         from '@/lib/navigation';
import type { Dispute, PaginatedResponse } from '@/types';

export default function DisputesPage() {
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const isAdmin     = useAuthStore((s) => s.isAdmin());
  const isOwner     = useAuthStore((s) => s.isOwner());

  const [data, setData]       = useState<PaginatedResponse<Dispute> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isRegistrar || isAdmin) {
      disputeService.list().then(setData).finally(() => setLoading(false));
    } else {
      disputeService.getMine().then((disputes) =>
        setData({ data: disputes, total: disputes.length, page: 1, limit: 50 })
      ).finally(() => setLoading(false));
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-slate-800">Disputes</h2>
          <p className="text-slate-500 text-sm mt-0.5">{data?.total ?? 0} total disputes</p>
        </div>
        {(isOwner || isRegistrar) && (
          <Link href={ROUTES.NEW_DISPUTE} className="btn-primary">
            <Plus className="w-4 h-4" /> Raise Dispute
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
            <div className="empty-state-icon"><AlertTriangle className="w-7 h-7" /></div>
            <p className="text-slate-600 font-medium">No disputes</p>
          </div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Property</th><th>Type</th><th>Raised By</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {data.data.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono text-xs">{d.property?.plotNumber ?? d.propertyId.slice(0,8)}</td>
                  <td className="text-xs capitalize">{d.disputeType.toLowerCase().replace(/_/g, ' ')}</td>
                  <td className="text-sm">{d.raisedBy?.fullName ?? '—'}</td>
                  <td><StatusBadge status={d.status} size="sm" /></td>
                  <td className="text-xs text-slate-400">{new Date(d.raisedAt).toLocaleDateString()}</td>
                  <td><Link href={ROUTES.DISPUTE(d.id)} className="text-primary text-xs hover:underline">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
