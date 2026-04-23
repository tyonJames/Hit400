'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { userService } from '@/lib/api/services';
import type { AuthUser, PaginatedResponse } from '@/types';

export default function AdminUsersPage() {
  const [data, setData]       = useState<PaginatedResponse<AuthUser> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userService.list().then(setData).finally(() => setLoading(false));
  }, []);

  async function toggleStatus(user: AuthUser) {
    try {
      await userService.updateStatus(user.id, !user.roles.includes('ADMIN'));
      toast.success(`User status updated.`);
    } catch (err: any) { toast.error(err?.message); }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-slate-800">User Management</h2>
        <p className="text-slate-500 text-sm mt-0.5">{data?.total ?? 0} registered users</p>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-10 rounded" />)}</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Roles</th><th>Wallet</th><th></th></tr></thead>
            <tbody>
              {data?.data.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.fullName}</td>
                  <td className="text-sm text-slate-500">{u.email}</td>
                  <td>
                    <div className="flex gap-1 flex-wrap">
                      {u.roles.map((r) => (
                        <span key={r} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {u.walletAddress
                      ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><span className="on-chain-dot w-1.5 h-1.5" />Connected</span>
                      : <span className="text-xs text-slate-400">—</span>
                    }
                  </td>
                  <td>
                    <button onClick={() => toggleStatus(u)} className="text-xs text-slate-500 hover:text-red-600 transition-colors">
                      Manage
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
