'use client';

import { useEffect, useState } from 'react';
import { useParams }   from 'next/navigation';
import Link            from 'next/link';
import { ArrowLeft, ExternalLink, CheckCircle, XCircle, Clock, AlertCircle, ShieldCheck, Copy } from 'lucide-react';
import { propertyService }                       from '@/lib/api/services';
import { StatusBadge, TxHashDisplay }            from '@/components/shared/status-badge';
import { useAuthStore }                          from '@/stores/auth.store';
import { ROUTES }                                from '@/lib/navigation';
import { toast }                                 from 'sonner';
import type { Property } from '@/types';

const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';

export default function PropertyDetailPage() {
  const { id }        = useParams<{ id: string }>();
  const isRegistrar   = useAuthStore((s) => s.isRegistrar());
  const isAdmin       = useAuthStore((s) => s.isAdmin());

  const [property, setProperty]   = useState<Property | null>(null);
  const [loading, setLoading]     = useState(true);
  const [actioning, setActioning] = useState(false);
  const [declineComment, setDeclineComment] = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyHash(hash: string) {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    propertyService.getById(id).then(setProperty).finally(() => setLoading(false));
  }, [id]);

  async function handleApprove() {
    if (!property) return;
    setActioning(true);
    try {
      const updated = await propertyService.approve(property.id);
      setProperty(updated as Property);
      toast.success('Property approved and registered on the blockchain.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Approval failed.');
    } finally {
      setActioning(false);
    }
  }

  async function handleDecline() {
    if (!property || !declineComment.trim()) {
      toast.error('Please provide a reason for declining.');
      return;
    }
    setActioning(true);
    try {
      const updated = await propertyService.decline(property.id, declineComment.trim());
      setProperty(updated as Property);
      setShowDeclineForm(false);
      toast.success('Property registration declined.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Decline failed.');
    } finally {
      setActioning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="card space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-5 rounded" />)}
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="empty-state">
        <p className="text-slate-600 font-medium">Property not found</p>
        <Link href={ROUTES.PROPERTIES} className="btn-ghost">Back to Properties</Link>
      </div>
    );
  }

  const isPending  = property.status === 'PENDING_APPROVAL';
  const isDeclined = property.status === 'DECLINED';
  const isActive   = property.status === 'ACTIVE';

  const fields = [
    { label: 'Plot Number',       value: property.plotNumber,       mono: true },
    { label: 'Title Deed Number', value: property.titleDeedNumber,  mono: true },
    { label: 'Address',           value: property.address },
    { label: 'Land Size',         value: `${property.landSize} ${property.unit}` },
    { label: 'Zoning Type',       value: property.zoningType },
    { label: 'Registration Date', value: new Date(property.registrationDate).toLocaleDateString() },
    { label: 'Registered Owner',  value: property.currentOwner?.fullName ?? '—' },
    ...(property.tokenId   ? [{ label: 'Token ID',    value: property.tokenId,    mono: true }] : []),
    ...(property.ipfsHash  ? [{ label: 'IPFS Hash',   value: property.ipfsHash,   mono: true }] : []),
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={ROUTES.PROPERTIES} className="btn-ghost px-2">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="font-display text-xl text-slate-800">{property.plotNumber}</h2>
          <p className="text-slate-500 text-sm">{property.address}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge status={property.status} animate />
        </div>
      </div>

      {/* Pending approval banner */}
      {isPending && !isRegistrar && !isAdmin && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Awaiting Registrar Review</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Your property registration has been submitted and is pending verification by a registrar.
              You will be notified once it is reviewed.
            </p>
          </div>
        </div>
      )}

      {/* Declined banner */}
      {isDeclined && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">Registration Declined</p>
            {property.registrationComment && (
              <p className="text-sm text-red-700 mt-0.5">
                <span className="font-medium">Registrar's note: </span>
                {property.registrationComment}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Registrar action panel */}
      {isPending && (isRegistrar || isAdmin) && (
        <div className="card border-2 border-amber-200 space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <p className="font-medium text-slate-800">Pending Your Review</p>
          </div>
          <p className="text-sm text-slate-600">
            Review the property details below and either approve to register it on the blockchain, or decline with a reason.
          </p>

          {!showDeclineForm ? (
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={actioning}
                className="btn-primary flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {actioning ? 'Approving…' : 'Approve & Register'}
              </button>
              <button
                onClick={() => setShowDeclineForm(true)}
                disabled={actioning}
                className="btn-secondary flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Decline
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Reason for declining</label>
                <textarea
                  className="input"
                  rows={3}
                  value={declineComment}
                  onChange={(e) => setDeclineComment(e.target.value)}
                  placeholder="Explain why this registration is being declined…"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDecline}
                  disabled={actioning || !declineComment.trim()}
                  className="btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-2"
                >
                  {actioning ? 'Declining…' : 'Confirm Decline'}
                </button>
                <button
                  onClick={() => { setShowDeclineForm(false); setDeclineComment(''); }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Property Details */}
      <div className="card space-y-4">
        <p className="form-section">Property Details</p>
        <dl className="grid grid-cols-2 gap-4">
          {fields.map(({ label, value, mono }) => (
            <div key={label}>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-0.5">{label}</dt>
              <dd className={`text-sm text-slate-900 ${mono ? 'font-mono break-all' : ''}`}>{value}</dd>
            </div>
          ))}
        </dl>
        {property.notes && (
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-0.5">Notes</dt>
            <dd className="text-sm text-slate-900">{property.notes}</dd>
          </div>
        )}
      </div>

      {/* Record Integrity Hash */}
      {property.recordHash && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <p className="form-section mb-0">Record Integrity Hash</p>
          </div>

          <p className="text-sm text-slate-500">
            A SHA-256 fingerprint of all property fields and uploaded documents, computed at submission.
            {isActive
              ? ' This hash is permanently anchored to the Stacks blockchain and cannot be altered.'
              : ' This hash will be anchored to the blockchain upon registrar approval.'}
          </p>

          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-xs text-slate-700 break-all leading-relaxed flex-1">
                {property.recordHash}
              </p>
              <button
                onClick={() => copyHash(property.recordHash!)}
                className="shrink-0 text-slate-400 hover:text-primary transition-colors"
                title="Copy hash"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-500 font-medium mb-1.5">Hash covers:</p>
              <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside">
                <li>Plot number, title deed number, address</li>
                <li>Land size, unit, zoning type, registration date</li>
                <li>GPS coordinates and notes (if provided)</li>
                <li>SHA-256 fingerprint of each uploaded document</li>
                <li>Submitter identity</li>
              </ul>
            </div>
          </div>

          {isActive && property.blockchainTxHash && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Hash anchored on-chain — tamper-evident and immutable
            </div>
          )}
        </div>
      )}

      {/* Blockchain info — only for active properties */}
      {isActive && property.blockchainTxHash && (
        <div className="card space-y-4">
          <p className="form-section">Blockchain Record</p>
          <TxHashDisplay txHash={property.blockchainTxHash} network={NETWORK as 'testnet' | 'mainnet'} label="Registration TX" />
          {(property as any).onChainState && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">On-Chain Owner</p>
                <p className="font-mono text-xs text-slate-700 break-all">{(property as any).onChainState.owner}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">On-Chain Status</p>
                <p className="text-sm text-slate-700">{(property as any).onChainState.status}</p>
              </div>
            </div>
          )}
          {property.ipfsHash && (
            <a
              href={`https://gateway.pinata.cloud/ipfs/${property.ipfsHash}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              View Title Deed on IPFS <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {isActive && (
        <div className="flex gap-3">
          <Link href={ROUTES.OWNERSHIP(property.id)} className="btn-secondary text-sm">
            View Ownership History
          </Link>
          <Link href={ROUTES.NEW_TRANSFER} className="btn-ghost text-sm">
            Initiate Transfer
          </Link>
        </div>
      )}
    </div>
  );
}
