'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ArrowLeftRight, Clock } from 'lucide-react';
import { transferService } from '@/lib/api/services';
import { useAuthStore }    from '@/stores/auth.store';
import { StatusBadge }     from '@/components/shared/status-badge';
import { formatMoney }     from '@/lib/format';
import { ROUTES }          from '@/lib/navigation';
import type { Transfer }   from '@/types';

const PENDING_STATUSES = new Set([
  'PENDING_BUYER', 'PENDING_REGISTRAR',
  'PENDING_REGISTRAR_TERMS', 'AWAITING_POP',
  'PENDING_SELLER_CONFIRMATION', 'PENDING_REGISTRAR_FINAL',
]);

function actionLabel(transfer: Transfer, userId?: string): string | null {
  const isBuyer  = transfer.buyerId  === userId;
  const isSeller = transfer.sellerId === userId;
  switch (transfer.status) {
    case 'PENDING_BUYER':                return isBuyer  ? 'Your approval needed' : null;
    case 'AWAITING_POP':                 return isBuyer  ? 'Upload proof of payment' : null;
    case 'PENDING_SELLER_CONFIRMATION':  return isSeller ? 'Confirm payment received' : null;
    default: return null;
  }
}

export default function TransfersPage() {
  const user        = useAuthStore((s) => s.user);
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const isAdmin     = useAuthStore((s) => s.isAdmin());
  const isUser      = useAuthStore((s) => s.isUser());

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const req = (isRegistrar || isAdmin)
      ? transferService.list()
      : transferService.getMine();
    req
      .then((res: any) => {
        // API client strips the `data` wrapper from paginated responses
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setTransfers(rows);
      })
      .finally(() => setLoading(false));
  }, []);

  const pending = transfers.filter((t) => PENDING_STATUSES.has(t.status));
  const done    = transfers.filter((t) => !PENDING_STATUSES.has(t.status));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-slate-800">
            {isUser ? 'My Transfers' : 'All Transfers'}
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">{transfers.length} total</p>
        </div>
        {isUser && (
          <Link href={ROUTES.NEW_TRANSFER} className="btn-primary">
            <Plus className="w-4 h-4" /> Initiate Transfer
          </Link>
        )}
      </div>

      {loading ? (
        <div className="card p-6 space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded" />)}
        </div>
      ) : transfers.length === 0 ? (
        <div className="card py-16 text-center">
          <ArrowLeftRight className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">No transfers yet</p>
          <p className="text-slate-400 text-sm mt-1">
            {isUser
              ? 'Transfers you initiate or are involved in as buyer will appear here.'
              : 'No transfers in the system yet.'}
          </p>
        </div>
      ) : (
        <>
          {/* Action-required section */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                In Progress ({pending.length})
              </h3>
              <div className="card p-0 overflow-hidden divide-y divide-slate-50">
                {pending.map((t) => {
                  const action = isUser ? actionLabel(t, user?.id) : null;
                  return (
                    <Link
                      key={t.id}
                      href={ROUTES.TRANSFER(t.id)}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {t.property?.plotNumber ?? t.propertyId.slice(0, 8)}
                          </span>
                          {t.marketplaceListingId && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                              Marketplace
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 truncate">
                          {t.property?.address ?? '—'}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {t.seller?.fullName ?? '?'} → {t.buyer?.fullName ?? '?'}
                          {t.saleValue ? ` · ${formatMoney(t.saleValue)}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusBadge status={t.status} size="sm" />
                        {action && (
                          <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            {action}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          {new Date(t.initiatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed / cancelled */}
          {done.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                Completed / Cancelled ({done.length})
              </h3>
              <div className="card p-0 overflow-hidden divide-y divide-slate-50">
                {done.map((t) => (
                  <Link
                    key={t.id}
                    href={ROUTES.TRANSFER(t.id)}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {t.property?.plotNumber ?? t.propertyId.slice(0, 8)}
                        </span>
                        <span className="text-xs text-slate-400 truncate">
                          {t.seller?.fullName ?? '?'} → {t.buyer?.fullName ?? '?'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={t.status} size="sm" />
                      <span className="text-xs text-slate-400">
                        {new Date(t.initiatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
