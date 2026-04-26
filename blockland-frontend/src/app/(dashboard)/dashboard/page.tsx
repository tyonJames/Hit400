'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, ArrowLeftRight, AlertTriangle, Activity, ClipboardList, Users, ShieldCheck, Clock } from 'lucide-react';
import { dashboardService, transferService } from '@/lib/api/services';
import { useAuthStore }     from '@/stores/auth.store';
import { StatusBadge }      from '@/components/shared/status-badge';
import { ROUTES }           from '@/lib/navigation';
import type { DashboardSummary, Transfer } from '@/types';

export default function DashboardPage() {
  const user        = useAuthStore((s) => s.user);
  const isAdmin     = useAuthStore((s) => s.isAdmin());
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const isUser      = useAuthStore((s) => s.isUser());

  const [summary, setSummary]         = useState<DashboardSummary | null>(null);
  const [myTransfers, setMyTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    dashboardService.getSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isUser) return;
    transferService.getMine({ limit: 20 })
      .then((res: any) => {
        const rows: Transfer[] = Array.isArray(res) ? res : (res?.data ?? []);
        const ACTIVE = ['PENDING_BUYER','PENDING_REGISTRAR','PENDING_REGISTRAR_TERMS',
                        'AWAITING_POP','PENDING_SELLER_CONFIRMATION','PENDING_REGISTRAR_FINAL'];
        setMyTransfers(rows.filter((t) => ACTIVE.includes(t.status)));
      })
      .catch(() => {});
  }, [isUser]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton h-4 w-24 mb-2 rounded" />
              <div className="skeleton h-8 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Build stat cards based on role
  type StatCard = {
    label: string; value: number;
    icon: React.ElementType; color: string;
    href?: string; badge?: boolean;
  };

  const commonStats: StatCard[] = [
    {
      label: isUser && !isRegistrar && !isAdmin ? 'My Active Properties' : 'Active Properties',
      value: summary?.totalProperties ?? 0,
      icon:  MapPin,
      color: 'text-teal-600',
      href:  ROUTES.PROPERTIES,
    },
    {
      label: isUser && !isRegistrar && !isAdmin ? 'My Pending Transfers' : 'Pending Transfers',
      value: summary?.pendingTransfers ?? 0,
      icon:  ArrowLeftRight,
      color: 'text-amber-600',
      href:  ROUTES.TRANSFERS,
    },
    {
      label: 'Open Disputes',
      value: summary?.activeDisputes ?? 0,
      icon:  AlertTriangle,
      color: 'text-red-600',
      href:  ROUTES.DISPUTES,
    },
  ];

  const registrarStats: StatCard[] = [
    {
      label: 'Pending Approvals',
      value: summary?.pendingApprovals ?? 0,
      icon:  ClipboardList,
      color: 'text-amber-600',
      href:  ROUTES.PENDING_QUEUE,
      badge: (summary?.pendingApprovals ?? 0) > 0,
    },
  ];

  const adminStats: StatCard[] = [
    {
      label: 'Pending Approvals',
      value: summary?.pendingApprovals ?? 0,
      icon:  ClipboardList,
      color: 'text-amber-600',
      href:  ROUTES.PENDING_QUEUE,
      badge: (summary?.pendingApprovals ?? 0) > 0,
    },
  ];

  const extraStats = isAdmin ? adminStats : isRegistrar ? registrarStats : [];
  const allStats   = [...commonStats, ...extraStats];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl text-slate-800 mb-1">
          Welcome back, {user?.fullName?.split(' ')[0]}
        </h2>
        <p className="text-slate-500 text-sm">
          {isAdmin     ? 'System overview — BlockLand Registry administration.' :
           isRegistrar ? 'Registrar dashboard — review and manage property submissions.' :
                         'Here\'s a summary of your BlockLand portfolio.'}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {allStats.map(({ label, value, icon: Icon, color, href, badge }) => {
          const card = (
            <div className={`stat-card relative ${href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
              {badge && value > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                  {value > 99 ? '99+' : value}
                </span>
              )}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pr-6">{label}</p>
                <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
              </div>
              <p className="font-display text-3xl text-slate-900">{value}</p>
            </div>
          );
          return href ? (
            <Link key={label} href={href}>{card}</Link>
          ) : (
            <div key={label}>{card}</div>
          );
        })}
      </div>

      {/* Active transfers for regular user */}
      {isUser && !isRegistrar && !isAdmin && myTransfers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            Transfers requiring attention
          </h3>
          <div className="card p-0 overflow-hidden divide-y divide-slate-50">
            {myTransfers.map((t) => {
              const isBuyer  = t.buyerId  === user?.id;
              const isSeller = t.sellerId === user?.id;
              let action: string | null = null;
              if (t.status === 'PENDING_BUYER' && isBuyer)                       action = 'Your approval needed';
              if (t.status === 'AWAITING_POP' && isBuyer)                        action = 'Upload proof of payment';
              if (t.status === 'PENDING_SELLER_CONFIRMATION' && isSeller)         action = 'Confirm payment received';
              return (
                <Link
                  key={t.id}
                  href={ROUTES.TRANSFER(t.id)}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-semibold text-slate-700">
                      {t.property?.plotNumber ?? t.propertyId.slice(0, 8)}
                    </p>
                    <p className="text-sm text-slate-500 truncate mt-0.5">
                      {t.property?.address ?? '—'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isBuyer ? `Seller: ${t.seller?.fullName ?? '—'}` : `Buyer: ${t.buyer?.fullName ?? '—'}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={t.status} size="sm" />
                    {action && (
                      <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        {action}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
          <Link href={ROUTES.TRANSFERS} className="text-xs text-primary hover:underline block text-right">
            View all transfers →
          </Link>
        </div>
      )}

      {/* Quick actions for registrar/admin */}
      {(isAdmin || isRegistrar) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href={ROUTES.PENDING_QUEUE} className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
              <ClipboardList className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Pending Queue</p>
              <p className="text-sm text-slate-500">
                {(summary?.pendingApprovals ?? 0) > 0
                  ? `${summary?.pendingApprovals} submission${summary?.pendingApprovals !== 1 ? 's' : ''} awaiting review`
                  : 'No pending submissions'}
              </p>
            </div>
          </Link>
          {isAdmin && (
            <Link href="/admin/approvals" className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                <Users className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">User Approvals</p>
                <p className="text-sm text-slate-500">Review pending user registrations</p>
              </div>
            </Link>
          )}
          <Link href={ROUTES.PROPERTIES} className="card flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer group">
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">All Properties</p>
              <p className="text-sm text-slate-500">Search and manage registry entries</p>
            </div>
          </Link>
        </div>
      )}

      {/* Recent activity */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-800">Recent Activity</h3>
        </div>

        {!summary?.recentActivity?.length ? (
          <div className="empty-state py-8">
            <p className="text-slate-400 text-sm">No recent activity.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {summary.recentActivity.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-medium">{log.user?.fullName ?? 'System'}</span>{' '}
                    {log.action.toLowerCase().replace(/_/g, ' ')}{' '}
                    <span className="text-slate-500">{log.entityType}</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(log.performedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
