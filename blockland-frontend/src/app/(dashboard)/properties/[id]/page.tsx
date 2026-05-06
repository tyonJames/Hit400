'use client';

import { useEffect, useState } from 'react';
import { useParams }   from 'next/navigation';
import Link            from 'next/link';
import {
  ArrowLeft, ExternalLink, CheckCircle, XCircle, Clock, AlertCircle,
  ShieldCheck, Copy, ImageIcon, Download,
} from 'lucide-react';
import { propertyService }                from '@/lib/api/services';
import { StatusBadge, TxHashDisplay }     from '@/components/shared/status-badge';
import { useAuthStore }                   from '@/stores/auth.store';
import { ROUTES }                         from '@/lib/navigation';
import { toast }                          from 'sonner';
import type { Property, PropertyDocument } from '@/types';

const NETWORK      = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';
const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY  ?? 'https://gateway.pinata.cloud';

const DOC_LABELS: Record<string, string> = {
  TITLE_DEED:             'Title Deed',
  SURVEY_DIAGRAM:         'Survey Diagram',
  BUILDING_PLAN:          'Building Plan',
  DEED_OF_TRANSFER:       'Deed of Transfer',
  TAX_CLEARANCE:          'ZIMRA Tax Clearance',
  LAND_DISPUTE_AFFIDAVIT: 'Land Dispute Affidavit',
  PHOTO:                  'Photo',
};

export default function PropertyDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const isAdmin     = useAuthStore((s) => s.isAdmin());
  const currentUser = useAuthStore((s) => s.user);

  const [property, setProperty]   = useState<Property | null>(null);
  const [loading, setLoading]     = useState(true);
  const [actioning, setActioning]   = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [declineComment, setDeclineComment]   = useState('');
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [openingDoc, setOpeningDoc] = useState<string | null>(null);

  useEffect(() => {
    propertyService.getById(id).then(setProperty).finally(() => setLoading(false));
  }, [id]);

  async function openDocument(doc: PropertyDocument) {
    setOpeningDoc(doc.id);
    try {
      await propertyService.openDocumentFile(id, doc.id, doc.fileName);
    } catch {
      toast.error('Could not load file. It may no longer be available.');
    } finally {
      setOpeningDoc(null);
    }
  }

  function copyHash(hash: string) {
    navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleResubmit() {
    if (!property) return;
    setResubmitting(true);
    try {
      const updated = await propertyService.resubmit(property.id);
      setProperty(updated as Property);
      toast.success('Property resubmitted for review.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Resubmission failed.');
    } finally {
      setResubmitting(false);
    }
  }

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
      <div className="space-y-4">
        <div className="skeleton h-8 w-48 rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="card space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-5 rounded" />)}
          </div>
          <div className="card space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-10 rounded" />)}
          </div>
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
    { label: 'Plot Number',       value: property.plotNumber,       mono: true  },
    { label: 'Title Deed Number', value: property.titleDeedNumber,  mono: true  },
    { label: 'Address',           value: property.address,          mono: false },
    { label: 'Land Size',         value: `${property.landSize} ${property.unit}`, mono: false },
    { label: 'Zoning Type',       value: property.zoningType,       mono: false },
    { label: 'Registration Date', value: new Date(property.registrationDate).toLocaleDateString(), mono: false },
    { label: 'Registered Owner',  value: property.currentOwner?.fullName ?? '—', mono: false },
    ...(property.tokenId  ? [{ label: 'Token ID',  value: property.tokenId,  mono: true }] : []),
    ...(property.ipfsHash ? [{ label: 'IPFS Hash', value: property.ipfsHash, mono: true }] : []),
  ];

  const images    = property.documents?.filter(d => d.category === 'IMAGE')    ?? [];
  const legalDocs = property.documents?.filter(d => d.category === 'DOCUMENT') ?? [];
  const hasDocs   = images.length > 0 || legalDocs.length > 0;

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
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

      {/* ── Full-width banners ── */}
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

      {isDeclined && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-800">Registration Declined</p>
            {property.registrationComment && (
              <p className="text-sm text-red-700 mt-0.5">
                <span className="font-medium">Registrar's note: </span>
                {property.registrationComment}
              </p>
            )}
            {!isRegistrar && !isAdmin && currentUser?.id === property.currentOwnerId && (
              <button
                onClick={handleResubmit}
                disabled={resubmitting}
                className="btn-primary mt-3 text-sm"
              >
                {resubmitting ? 'Resubmitting…' : 'Resubmit for Review'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* LEFT — property details (sticky) */}
        <div className="space-y-4 lg:sticky lg:top-4">

          <div className="card space-y-4">
            <p className="form-section">Property Details</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
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
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <p className="form-section mb-0">Record Integrity</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 flex items-start justify-between gap-3">
                <p className="font-mono text-xs text-slate-700 break-all leading-relaxed flex-1">
                  {property.recordHash}
                </p>
                <button
                  onClick={() => copyHash(property.recordHash!)}
                  className="shrink-0 text-slate-400 hover:text-primary transition-colors"
                  title="Copy hash"
                >
                  {copied
                    ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                    : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {isActive && property.blockchainTxHash && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Hash anchored on-chain — tamper-evident and immutable
                </div>
              )}
            </div>
          )}

          {/* Blockchain Record */}
          {isActive && property.blockchainTxHash && (
            <div className="card space-y-3">
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
                  href={`${IPFS_GATEWAY}/ipfs/${property.ipfsHash}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  View Title Deed on IPFS <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Active property actions */}
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

        {/* RIGHT — registrar panel + documents */}
        <div className="space-y-4">

          {/* Registrar action panel */}
          {isPending && (isRegistrar || isAdmin) && (
            <div className="card border-2 border-amber-200 space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <p className="font-medium text-slate-800">Pending Your Review</p>
              </div>
              <p className="text-sm text-slate-600">
                Review the property details and submitted documents, then approve to register on the blockchain or decline with a reason.
              </p>
              {!showDeclineForm ? (
                <div className="flex gap-3">
                  <button onClick={handleApprove} disabled={actioning} className="btn-primary flex items-center gap-2">
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

          {/* Submitted Documents */}
          {hasDocs && (
            <div className="card space-y-3">
              <p className="form-section">Submitted Documents</p>

              {images.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Photos</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {images.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => openDocument(doc)}
                        disabled={openingDoc === doc.id}
                        className="flex items-center gap-2 bg-slate-50 hover:bg-primary/5 border border-slate-100 hover:border-primary/20 rounded-lg px-2.5 py-2 text-left transition-colors group"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary shrink-0" />
                        <span className="text-xs text-slate-600 truncate flex-1">{doc.fileName}</span>
                        {openingDoc === doc.id
                          ? <span className="text-xs text-slate-400">…</span>
                          : <Download className="w-3 h-3 text-slate-300 group-hover:text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {legalDocs.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Legal Documents</p>
                  <div className="space-y-1.5">
                    {legalDocs.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => openDocument(doc)}
                        disabled={openingDoc === doc.id}
                        className="w-full flex items-center gap-3 bg-slate-50 hover:bg-primary/5 border border-slate-100 hover:border-primary/20 rounded-xl px-3 py-2.5 text-left transition-colors group"
                      >
                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 group-hover:text-primary leading-tight">
                            {DOC_LABELS[doc.documentType] ?? doc.documentType}
                          </p>
                          <p className="text-xs text-slate-400 truncate mt-0.5">
                            {doc.fileName} · {(doc.fileSizeBytes / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        {openingDoc === doc.id
                          ? <span className="text-xs text-slate-400 shrink-0">Loading…</span>
                          : <Download className="w-4 h-4 text-slate-300 group-hover:text-primary shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
