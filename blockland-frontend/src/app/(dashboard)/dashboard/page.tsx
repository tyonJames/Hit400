'use client';

import { useEffect, useState } from 'react';
import { MapPin, ArrowLeftRight, AlertTriangle, Activity } from 'lucide-react';
import { dashboardService } from '@/lib/api/services';
import { useAuthStore }     from '@/stores/auth.store';
import type { DashboardSummary } from '@/types';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService.getSummary()
      .then(setSummary)
      .catch(() => {/* handled silently */})
      .finally(() => setLoading(false));
  }, []);

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

  const stats = [
    { label: 'Total Properties', value: summary?.totalProperties ?? 0, icon: MapPin,          color: 'text-teal-600' },
    { label: 'Pending Transfers', value: summary?.pendingTransfers ?? 0, icon: ArrowLeftRight, color: 'text-amber-600' },
    { label: 'Active Disputes',  value: summary?.activeDisputes ?? 0,  icon: AlertTriangle,   color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl text-slate-800 mb-1">
          Welcome back, {user?.fullName?.split(' ')[0]}
        </h2>
        <p className="text-slate-500 text-sm">
          Here&apos;s a summary of the BlockLand registry.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="font-display text-3xl text-slate-900">{value}</p>
          </div>
        ))}
      </div>

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
