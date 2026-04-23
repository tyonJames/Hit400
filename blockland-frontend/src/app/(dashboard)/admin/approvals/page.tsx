'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { adminService, type PendingUser } from '@/lib/api/services';

const ALL_ROLES = ['USER', 'REGISTRAR', 'ADMIN'] as const;
type RoleName = typeof ALL_ROLES[number];

export default function PendingApprovalsPage() {
  const [users, setUsers]         = useState<PendingUser[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<PendingUser | null>(null);
  const [chosenRoles, setChosen]  = useState<RoleName[]>([]);
  const [approving, setApproving] = useState(false);

  function load() {
    setLoading(true);
    adminService.getPendingUsers()
      .then(setUsers)
      .catch(() => toast.error('Failed to load pending users.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function openModal(user: PendingUser) {
    setSelected(user);
    setChosen([]);
  }

  function toggleRole(role: RoleName) {
    setChosen((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleApprove() {
    if (!selected) return;
    if (chosenRoles.length === 0) {
      toast.error('Select at least one role before approving.');
      return;
    }
    setApproving(true);
    try {
      await adminService.approveUser(selected.id, chosenRoles);
      toast.success(`${selected.fullName} approved successfully.`);
      setSelected(null);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Approval failed.');
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl text-slate-800">Pending Approvals</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          {loading ? 'Loading…' : `${users.length} user${users.length !== 1 ? 's' : ''} awaiting approval`}
        </p>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton h-10 rounded" />)}
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-4xl mb-3">✓</p>
            <p className="font-medium">No pending approvals</p>
            <p className="text-sm mt-1">All registered users have been reviewed.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>National ID</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">{u.fullName}</td>
                  <td className="text-sm text-slate-500 font-mono">{u.nationalId}</td>
                  <td className="text-sm text-slate-500">{u.email}</td>
                  <td className="text-sm text-slate-500">{u.phone}</td>
                  <td className="text-sm text-slate-400">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      onClick={() => openModal(u)}
                      className="btn-primary text-xs py-1 px-3"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approval Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="font-display text-lg text-slate-900">Approve User</h3>
              <p className="text-slate-500 text-sm mt-0.5">
                Assign roles for <span className="font-semibold text-slate-700">{selected.fullName}</span>
              </p>
            </div>

            {/* User summary */}
            <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Email</span>
                <span className="text-slate-800">{selected.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">National ID</span>
                <span className="text-slate-800 font-mono">{selected.nationalId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Phone</span>
                <span className="text-slate-800">{selected.phone}</span>
              </div>
            </div>

            {/* Role selector */}
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Assign roles</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_ROLES.map((role) => {
                  const active = chosenRoles.includes(role);
                  return (
                    <button
                      key={role}
                      onClick={() => toggleRole(role)}
                      className={`rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {active ? '✓ ' : ''}{role}
                    </button>
                  );
                })}
              </div>
              {chosenRoles.length === 0 && (
                <p className="text-xs text-amber-600 mt-2">Select at least one role.</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setSelected(null)}
                className="btn-secondary flex-1"
                disabled={approving}
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={approving || chosenRoles.length === 0}
                className="btn-primary flex-1"
              >
                {approving ? 'Approving…' : 'Approve User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
