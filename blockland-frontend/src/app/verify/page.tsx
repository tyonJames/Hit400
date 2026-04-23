'use client';

// Public verification portal — no authentication required.
// Allows anyone to verify land ownership by plot number, title deed, or owner ID.

import { useState } from 'react';
import { useForm }  from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { verificationSchema, type VerificationFormData } from '@/lib/schemas';
import { verificationService }   from '@/lib/api/services';
import { StatusBadge, TxHashDisplay } from '@/components/shared/status-badge';
import type { VerificationResult }    from '@/types';
import { ROUTES } from '@/lib/navigation';

const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';

export default function VerifyPage() {
  const [result, setResult]   = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: { searchType: 'plotNumber', searchValue: '' },
  });

  const searchType = watch('searchType');

  const PLACEHOLDER: Record<string, string> = {
    plotNumber:      'e.g. HRE-12345',
    titleDeedNumber: 'e.g. TD-20240001',
    ownerId:         'UUID of the property owner',
  };

  async function onSubmit(data: VerificationFormData) {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const params = { [data.searchType]: data.searchValue } as any;
      const res = await verificationService.verify(params);
      setResult(res);
    } catch (err: any) {
      setError(err?.message ?? 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

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
        <Link href={ROUTES.LOGIN} className="btn-secondary text-xs">
          Sign in
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                            bg-primary/20 mb-4">
              <Search className="w-7 h-7 text-primary" />
            </div>
            <h1 className="font-display text-3xl text-white mb-2">Property Verification</h1>
            <p className="text-sidebar-muted">
              Verify land ownership against the Stacks blockchain — no account required.
            </p>
          </div>

          {/* Search form */}
          <div className="bg-white rounded-2xl shadow-modal p-6 mb-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Search by</label>
                <div className="flex gap-2">
                  {(['plotNumber', 'titleDeedNumber', 'ownerId'] as const).map((type) => (
                    <label key={type} className="flex-1">
                      <input type="radio" value={type} {...register('searchType')} className="sr-only" />
                      <span className={`block text-center px-3 py-2 rounded-lg border text-sm font-medium
                                       cursor-pointer transition-colors
                                       ${searchType === type
                                         ? 'bg-primary text-white border-primary'
                                         : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40'}`}>
                        {type === 'plotNumber' ? 'Plot Number'
                          : type === 'titleDeedNumber' ? 'Title Deed'
                          : 'Owner ID'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Search value</label>
                <input
                  className={`input ${errors.searchValue ? 'input-error' : ''}`}
                  placeholder={PLACEHOLDER[searchType]}
                  {...register('searchValue')}
                />
                {errors.searchValue && <p className="error-msg">{errors.searchValue.message}</p>}
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Verifying on blockchain…' : 'Verify Property'}
              </button>
            </form>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex gap-3">
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="bg-white rounded-2xl shadow-modal p-6">
              <div className="flex items-start gap-3 mb-4">
                {result.status === 'VERIFIED' && <CheckCircle className="w-6 h-6 text-emerald-500 flex-shrink-0 mt-0.5" />}
                {result.status === 'MISMATCH'  && <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />}
                {result.status === 'NOT_FOUND' && <XCircle className="w-6 h-6 text-slate-400 flex-shrink-0 mt-0.5" />}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={result.status} animate />
                  </div>
                  <p className="text-slate-600 text-sm">{result.message}</p>
                </div>
              </div>

              {result.property && (
                <div className="border-t border-slate-100 pt-4 mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">Plot Number</p>
                      <p className="text-slate-900 font-medium">{result.property.plotNumber}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">Status</p>
                      <StatusBadge status={result.property.status} size="sm" />
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">Address</p>
                      <p className="text-slate-900">{result.property.address}</p>
                    </div>
                    {result.owner && (
                      <div>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">Registered Owner</p>
                        <p className="text-slate-900 font-medium">{result.owner.fullName}</p>
                      </div>
                    )}
                    {result.onChainOwner && (
                      <div>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">On-Chain Owner</p>
                        <p className="font-mono text-xs text-slate-600 break-all">{result.onChainOwner}</p>
                      </div>
                    )}
                  </div>

                  {result.property.blockchainTxHash && (
                    <div className="pt-2">
                      <TxHashDisplay
                        txHash={result.property.blockchainTxHash}
                        network={NETWORK as 'testnet' | 'mainnet'}
                        label="Registration TX"
                      />
                    </div>
                  )}

                  <a
                    href={`https://explorer.hiro.so/txid/${result.property.blockchainTxHash}?chain=${NETWORK}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
                  >
                    View on Stacks Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
