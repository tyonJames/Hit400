'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, ExternalLink, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { TxHashDisplay } from '@/components/shared/status-badge';
import { ROUTES } from '@/lib/navigation';

const NETWORK  = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface PublicTransfer {
  id:                string;
  plotNumber:        string;
  titleDeedNumber:   string;
  address:           string;
  sellerName:        string;
  buyerName:         string;
  confirmedAt:       string;
  certificateNumber: string | null;
  blockchainTxHash:  string | null;
}

export default function PublicTransfersPage() {
  const [transfers, setTransfers] = useState<PublicTransfer[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [query, setQuery]         = useState('');
  const [loading, setLoading]     = useState(true);

  const limit = 20;

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) });
      if (q) params.set('search', q);
      const res  = await fetch(`${BASE_URL}/transfers/public?${params}`);
      const json = await res.json();
      setTransfers(json.data ?? []);
      setTotal(json.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, query); }, [page, query, load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-sidebar flex flex-col">
      {/* Header */}
      <header className="border-b border-sidebar-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="font-display text-white font-bold">B</span>
          </div>
          <span className="font-display text-white text-lg">BlockLand Zimbabwe</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/verify" className="text-sidebar-muted hover:text-white text-sm transition-colors">
            Property Verification
          </Link>
          <Link href={ROUTES.LOGIN} className="btn-secondary text-xs">
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        {/* Title */}
        <div className="mb-6">
          <Link href="/verify" className="inline-flex items-center gap-1.5 text-sidebar-muted hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Verification
          </Link>
          <h1 className="font-display text-3xl text-white mb-1">Public Land Transfer Records</h1>
          <p className="text-sidebar-muted text-sm">
            All confirmed property transfers — publicly recorded on the Stacks blockchain. No account required.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by plot number, address, seller or buyer name…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>
          <button type="submit" className="btn-primary text-sm px-5">Search</button>
          {query && (
            <button type="button" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}
              className="btn-ghost text-sm text-slate-500">Clear</button>
          )}
        </form>

        {/* Stats */}
        <p className="text-sidebar-muted text-xs mb-4">
          {loading ? 'Loading…' : `${total.toLocaleString()} confirmed transfer${total !== 1 ? 's' : ''}${query ? ` matching "${query}"` : ''}`}
        </p>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-modal overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-12 rounded-lg" />)}
            </div>
          ) : transfers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <p className="font-medium">No transfers found</p>
              {query && <p className="text-sm mt-1">Try a different search term.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plot</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Address</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Seller → Buyer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">On-Chain TX</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {transfers.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-slate-800">{t.plotNumber}</span>
                        {t.certificateNumber && (
                          <p className="text-xs text-slate-400 mt-0.5">{t.certificateNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate" title={t.address}>
                        {t.address}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-slate-700">{t.sellerName}</span>
                        <span className="text-slate-400 mx-1.5">→</span>
                        <span className="font-medium text-slate-800">{t.buyerName}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {t.confirmedAt ? new Date(t.confirmedAt).toLocaleDateString('en-ZA', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {t.blockchainTxHash
                          ? <TxHashDisplay txHash={t.blockchainTxHash} network={NETWORK as 'testnet' | 'mainnet'} label="" />
                          : <span className="text-slate-400 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sidebar-muted text-sm">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      <footer className="border-t border-sidebar-border px-6 py-4 text-center text-sidebar-muted text-xs">
        BlockLand Zimbabwe — Public Land Registry — All records are immutably anchored on the Stacks blockchain
      </footer>
    </div>
  );
}
