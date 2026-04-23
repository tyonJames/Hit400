'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminService } from '@/lib/api/services';
import { ROUTES }       from '@/lib/navigation';

export default function AdminPage() {
  const [stats, setStats]           = useState<any>(null);
  const [pendingCount, setPending]  = useState<number | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      adminService.getStats(),
      adminService.getPendingUsers(),
    ]).then(([s, pending]) => {
      setStats(s);
      setPending(pending.length);
    }).finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: 'Total Users',       value: stats.totalUsers },
    { label: 'Total Properties',  value: stats.totalProperties },
    { label: 'Total Transfers',   value: stats.totalTransfers },
    { label: 'Confirmed Transfers', value: stats.confirmedTransfers },
    { label: 'Open Disputes',     value: stats.openDisputes },
    { label: 'Verifications',     value: stats.verificationCount },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl text-slate-800">Admin Overview</h2>
        <p className="text-slate-500 text-sm mt-0.5">System-wide statistics and management.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {loading
          ? [1,2,3,4,5,6].map(i => <div key={i} className="stat-card"><div className="skeleton h-8 rounded" /></div>)
          : cards.map(({ label, value }) => (
            <div key={label} className="stat-card">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
              <p className="font-display text-3xl text-slate-900 mt-1">{value}</p>
            </div>
          ))
        }
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href={ROUTES.ADMIN_APPROVALS} className="card-hover text-center relative">
          {pendingCount !== null && pendingCount > 0 && (
            <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {pendingCount}
            </span>
          )}
          <p className="font-semibold text-slate-800">Pending Approvals</p>
          <p className="text-slate-400 text-sm mt-1">Review and approve new registrations</p>
        </Link>
        <Link href={ROUTES.ADMIN_USERS}      className="card-hover text-center">
          <p className="font-semibold text-slate-800">User Management</p>
          <p className="text-slate-400 text-sm mt-1">Manage user accounts and roles</p>
        </Link>
        <Link href={ROUTES.ADMIN_REGISTRARS} className="card-hover text-center">
          <p className="font-semibold text-slate-800">Registrar Control</p>
          <p className="text-slate-400 text-sm mt-1">Assign and remove registrar roles</p>
        </Link>
        <Link href={ROUTES.ADMIN_LOGS}       className="card-hover text-center">
          <p className="font-semibold text-slate-800">Activity Logs</p>
          <p className="text-slate-400 text-sm mt-1">Full audit trail of all actions</p>
        </Link>
      </div>
    </div>
  );
}
