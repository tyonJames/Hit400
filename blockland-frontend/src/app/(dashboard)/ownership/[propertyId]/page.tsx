'use client';

import { useEffect, useState } from 'react';
import { useParams }   from 'next/navigation';
import Link            from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { ownershipService } from '@/lib/api/services';
import { TxHashDisplay }    from '@/components/shared/status-badge';
import type { OwnershipRecord } from '@/types';

const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';

export default function OwnershipHistoryPage() {
  const { propertyId } = useParams<{ propertyId: string }>();

  const [dbHistory, setDbHistory]   = useState<OwnershipRecord[]>([]);
  const [onChain, setOnChain]       = useState<any>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      ownershipService.getHistory(propertyId),
      ownershipService.getOnChainHistory(propertyId),
    ]).then(([dbRes, chain]) => {
      setDbHistory(dbRes.data);
      setOnChain(chain);
    }).finally(() => setLoading(false));
  }, [propertyId]);

  if (loading) return <div className="skeleton h-64 rounded-card" />;

  const hasMismatch = onChain?.mismatch;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/properties/${propertyId}`} className="btn-ghost px-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h2 className="font-display text-xl text-slate-800">Ownership History</h2>
      </div>

      {hasMismatch && (
        <div className="tx-pending-banner bg-amber-50 border-amber-200 text-amber-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>
            <strong>Mismatch detected:</strong> The on-chain owner differs from the database record.
            Contact a registrar.
          </span>
        </div>
      )}

      {/* DB history */}
      <div className="card">
        <p className="form-section">Database Ownership Chain</p>
        {!dbHistory.length ? (
          <p className="text-slate-400 text-sm">No ownership records found.</p>
        ) : (
          <div className="space-y-4">
            {dbHistory.map((record, i) => (
              <div key={record.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${i === 0 ? 'bg-primary' : 'bg-slate-300'}`} />
                  {i < dbHistory.length - 1 && <div className="w-0.5 bg-slate-200 flex-1 mt-1" />}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-slate-900">{record.owner?.fullName ?? '—'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {record.acquisitionType.replace(/_/g, ' ')} ·{' '}
                    {new Date(record.acquiredAt).toLocaleDateString()}
                    {record.releasedAt ? ` → ${new Date(record.releasedAt).toLocaleDateString()}` : ' (current)'}
                  </p>
                  {record.blockchainTxHash && (
                    <div className="mt-1">
                      <TxHashDisplay txHash={record.blockchainTxHash} network={NETWORK as 'testnet' | 'mainnet'} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* On-chain history */}
      {onChain && (
        <div className="card">
          <p className="form-section">On-Chain History (Clarity Contract)</p>
          <p className="text-xs text-slate-500 mb-4">Token ID: <span className="font-mono">{onChain.tokenId}</span> · {onChain.count} record(s)</p>
          {!onChain.history.length ? (
            <p className="text-slate-400 text-sm">No on-chain records found.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Seq</th><th>Owner (Stacks Address)</th><th>Block Height</th></tr></thead>
              <tbody>
                {onChain.history.map((h: any) => (
                  <tr key={h.seq}>
                    <td className="text-xs">{h.seq}</td>
                    <td className="font-mono text-xs break-all">{h.owner}</td>
                    <td className="text-xs text-slate-400">{h.acquiredAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
