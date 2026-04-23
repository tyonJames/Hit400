'use client';

import { useEffect, useState } from 'react';
import { toast }  from 'sonner';
import { Plus, X } from 'lucide-react';
import { adminService } from '@/lib/api/services';
import type { AuthUser } from '@/types';

export default function AdminRegistrarsPage() {
  const [registrars, setRegistrars] = useState<AuthUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userId, setUserId]         = useState('');
  const [adding, setAdding]         = useState(false);

  useEffect(() => {
    adminService.getRegistrars().then(setRegistrars).finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!userId.trim()) return;
    setAdding(true);
    try {
      await adminService.addRegistrar(userId.trim());
      toast.success('Registrar added.');
      setUserId('');
      adminService.getRegistrars().then(setRegistrars);
    } catch (err: any) { toast.error(err?.message); } finally { setAdding(false); }
  }

  async function handleRemove(id: string) {
    try {
      await adminService.removeRegistrar(id);
      setRegistrars((prev) => prev.filter((r) => r.id !== id));
      toast.success('Registrar role removed.');
    } catch (err: any) { toast.error(err?.message); }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="font-display text-xl text-slate-800">Registrar Control</h2>
        <p className="text-slate-500 text-sm mt-0.5">Manage which users have the REGISTRAR role.</p>
      </div>

      {/* Add registrar */}
      <div className="card space-y-3">
        <p className="form-section">Add Registrar</p>
        <div className="flex gap-2">
          <input
            className="input flex-1 font-mono text-xs"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User UUID"
          />
          <button onClick={handleAdd} disabled={adding || !userId} className="btn-primary flex-shrink-0">
            <Plus className="w-4 h-4" /> {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Current registrars */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">{[1,2].map(i => <div key={i} className="skeleton h-10 rounded" />)}</div>
        ) : !registrars.length ? (
          <div className="empty-state py-8"><p className="text-slate-400 text-sm">No registrars assigned.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Wallet</th><th></th></tr></thead>
            <tbody>
              {registrars.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.fullName}</td>
                  <td className="text-sm text-slate-500">{r.email}</td>
                  <td className="font-mono text-xs truncate max-w-xs">{r.walletAddress ?? '—'}</td>
                  <td>
                    <button
                      onClick={() => handleRemove(r.id)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
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
