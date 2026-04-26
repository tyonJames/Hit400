'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast }   from 'sonner';
import { Plus, X, Search } from 'lucide-react';
import { adminService } from '@/lib/api/services';
import type { AuthUser } from '@/types';

export default function AdminRegistrarsPage() {
  const [registrars, setRegistrars] = useState<AuthUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [adding, setAdding]         = useState(false);

  // Search state for the user picker
  const [searchQuery, setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState<AuthUser[]>([]);
  const [searching, setSearching]       = useState(false);
  const [selected, setSelected]         = useState<AuthUser | null>(null);

  useEffect(() => {
    adminService.getRegistrars().then(setRegistrars).finally(() => setLoading(false));
  }, []);

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    adminService.listUsers({ search: q, limit: 10 })
      .then((res) => setSearchResults(res.data.filter((u) => !u.roles?.includes('REGISTRAR'))))
      .finally(() => setSearching(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  async function handleAdd() {
    if (!selected) return;
    setAdding(true);
    try {
      await adminService.addRegistrar(selected.id);
      toast.success(`${selected.fullName} added as registrar.`);
      setSelected(null);
      setSearchQuery('');
      setSearchResults([]);
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

      {/* Add registrar via user search */}
      <div className="card space-y-3">
        <p className="form-section">Add Registrar</p>

        {selected ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 text-sm">{selected.fullName}</p>
              <p className="text-xs text-slate-500">{selected.email}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
            <button onClick={handleAdd} disabled={adding} className="btn-primary text-sm py-1.5 px-4 flex-shrink-0">
              {adding ? 'Adding…' : <><Plus className="w-4 h-4 inline -mt-0.5" /> Add</>}
            </button>
          </div>
        ) : (
          <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                className="input pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name or email…"
              />
            </div>
            {searchQuery && (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                {searching ? (
                  <div className="p-3 text-sm text-slate-400 text-center">Searching…</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-sm text-slate-400 text-center">No users found.</div>
                ) : (
                  searchResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelected(u); setSearchQuery(''); setSearchResults([]); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">{u.fullName}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {(u.roles ?? []).map((r) => (
                          <span key={r} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r}</span>
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
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
