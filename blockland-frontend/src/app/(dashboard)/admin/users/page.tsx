'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Search, RefreshCw } from 'lucide-react';
import { adminService } from '@/lib/api/services';
import type { AuthUser, PaginatedResponse } from '@/types';

export default function AdminUsersPage() {
  const [data, setData]       = useState<PaginatedResponse<AuthUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const load = useCallback((q = search) => {
    setLoading(true);
    adminService.listUsers({ search: q || undefined, limit: 50 })
      .then(setData)
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => load(), search ? 350 : 0);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStatus(user: AuthUser) {
    const next = !user.isActive;
    try {
      await adminService.updateStatus(user.id, next);
      toast.success(`User ${next ? 'activated' : 'deactivated'}.`);
      load();
    } catch (err: any) { toast.error(err?.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl text-slate-800">User Management</h2>
          <p className="text-slate-500 text-sm mt-0.5">{data?.total ?? 0} registered users</p>
        </div>
        <button onClick={() => load()} disabled={loading} className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-10 rounded" />)}</div>
        ) : !data?.data.length ? (
          <div className="empty-state py-10">
            <p className="text-slate-400 text-sm">No users found.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Approval</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.fullName}</td>
                  <td className="text-sm text-slate-500">{u.email}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {(u.roles ?? []).map((r) => (
                        <span key={r} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {u.isActive !== false ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td>
                    {u.isApproved ? (
                      <span className="text-xs text-slate-400">Approved</span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium">Pending</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => toggleStatus(u)}
                      className={`text-xs font-medium transition-colors ${
                        u.isActive !== false
                          ? 'text-red-500 hover:text-red-700'
                          : 'text-emerald-600 hover:text-emerald-800'
                      }`}
                    >
                      {u.isActive !== false ? 'Deactivate' : 'Activate'}
                    </button>
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
