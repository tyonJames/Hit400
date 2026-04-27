'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link  from 'next/link';
import {
  ArrowLeft, CheckCircle, XCircle, Upload, Download,
  AlertTriangle, FileText, Clock, CreditCard, Snowflake,
} from 'lucide-react';
import { toast } from 'sonner';
import { transferService } from '@/lib/api/services';
import { formatMoney, formatRange } from '@/lib/format';
import { useAuthStore }    from '@/stores/auth.store';
import { useBlockchainStore } from '@/stores/blockchain.store';
import { StatusBadge, TxHashDisplay } from '@/components/shared/status-badge';
import { ROUTES }          from '@/lib/navigation';
import type { Transfer }   from '@/types';

const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';

const UNIFIED_STEPS = [
  { status: 'PENDING_REGISTRAR',           label: 'Registrar Review' },
  { status: 'AWAITING_PAYMENT',            label: 'Buyer Pays' },
  { status: 'PENDING_SELLER_CONFIRMATION', label: 'Seller Confirms' },
  { status: 'PENDING_REGISTRAR_FINAL',     label: 'Final Sign-off' },
  { status: 'CONFIRMED',                   label: 'Confirmed' },
];

const PAYMENT_LABELS: Record<string, string> = {
  ECOCASH: 'EcoCash', EcoCash: 'EcoCash',
  ZIPIT: 'ZIPIT', 'Bank Transfer': 'Bank Transfer', Cash: 'Cash',
};

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export default function TransferDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const router      = useRouter();
  const user        = useAuthStore((s) => s.user);
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const addTx       = useBlockchainStore((s) => s.addTx);

  const [transfer, setTransfer]     = useState<Transfer | null>(null);
  const [loading, setLoading]       = useState(true);
  const [actioning, setActioning]   = useState(false);

  const [cancelModal, setCancelModal]     = useState(false);
  const [cancelNote, setCancelNote]       = useState('');
  const [rejectModal, setRejectModal]     = useState(false);
  const [rejectNote, setRejectNote]       = useState('');
  const [sellerDispute, setSellerDispute] = useState(false);
  const [sellerNote, setSellerNote]       = useState('');
  const [registrarNote, setRegistrarNote] = useState('');

  const popInputRef = useRef<HTMLInputElement>(null);
  const [popFile, setPopFile]       = useState<File | null>(null);
  const [uploadingPop, setUploadingPop] = useState(false);

  async function reload() {
    const t = await transferService.getById(id);
    setTransfer(t);
  }

  useEffect(() => {
    transferService.getById(id).then(setTransfer).finally(() => setLoading(false));
  }, [id]);

  /* ── Action handlers ── */

  async function handleRegistrarReview(action: 'APPROVE' | 'REJECT') {
    if (action === 'REJECT' && !rejectNote.trim()) return toast.error('A rejection note is required.');
    setActioning(true);
    try {
      const updated = await transferService.registrarReview(id, action, action === 'REJECT' ? rejectNote.trim() : '');
      setTransfer(updated);
      setRejectModal(false);
      setRejectNote('');
      toast.success(
        action === 'APPROVE'
          ? 'Transfer approved. Buyer will receive payment instructions.'
          : 'Transfer rejected. Property restored to active.',
      );
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  async function handleUploadPop() {
    if (!popFile) return toast.error('Select a file first.');
    setUploadingPop(true);
    try {
      const updated = await transferService.uploadPop(id, popFile);
      setTransfer(updated);
      setPopFile(null);
      toast.success('Payment proof uploaded. Awaiting seller confirmation.');
    } catch (err: any) { toast.error(err?.message); } finally { setUploadingPop(false); }
  }

  async function handleSellerConfirm(confirmed: boolean) {
    if (!confirmed && !sellerNote.trim()) return toast.error('Please provide a note explaining the issue.');
    setActioning(true);
    try {
      const updated = await transferService.sellerConfirm(id, confirmed, confirmed ? 'Payment confirmed.' : sellerNote.trim());
      setTransfer(updated);
      setSellerDispute(false);
      setSellerNote('');
      toast.success(confirmed ? 'Payment confirmed. Awaiting final registrar sign-off.' : 'Disputed — buyer will re-upload proof of payment.');
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  async function handleRegistrarComplete() {
    setActioning(true);
    try {
      const { transfer: updated, blockchainTxHash } = await transferService.registrarComplete(id, registrarNote || undefined);
      addTx(blockchainTxHash, 'finalize-transfer', id, 'Transfer');
      setTransfer(updated);
      setRegistrarNote('');
      toast.success('Transfer finalised on blockchain!');
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  async function handleCancel() {
    if (!cancelNote.trim()) return toast.error('A cancellation note is required.');
    setActioning(true);
    try {
      const updated = await transferService.cancel(id, cancelNote.trim());
      setTransfer(updated);
      setCancelModal(false);
      setCancelNote('');
      toast.success('Transfer cancelled.');
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  function downloadCertificate() {
    const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('accessToken') ?? sessionStorage.getItem('accessToken')
      : null;
    fetch(`${BASE_URL}/transfers/${id}/certificate`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `transfer-certificate-${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      })
      .catch(() => toast.error('Could not download certificate.'));
  }

  /* ── Derived state ── */
  if (loading) return <div className="skeleton h-64 rounded-card" />;
  if (!transfer) return <div className="empty-state"><p>Transfer not found</p></div>;

  const currentStepIdx = UNIFIED_STEPS.findIndex((s) => s.status === transfer.status);
  const isTerminal  = ['CONFIRMED', 'CANCELLED', 'REJECTED', 'EXPIRED'].includes(transfer.status);
  const isFrozen    = transfer.status === 'FROZEN';
  const stepProgress = (isTerminal && transfer.status === 'CONFIRMED') ? UNIFIED_STEPS.length : currentStepIdx;

  const isSeller = user?.id === transfer.sellerId;
  const isBuyer  = user?.id === transfer.buyerId;

  const canRegistrarReview = transfer.status === 'PENDING_REGISTRAR' && isRegistrar;
  const canUploadPop       = transfer.status === 'AWAITING_PAYMENT' && isBuyer;
  const canSellerConfirm   = transfer.status === 'PENDING_SELLER_CONFIRMATION' && isSeller;
  const canRegistrarComplete = transfer.status === 'PENDING_REGISTRAR_FINAL' && isRegistrar;

  const canCancel = (() => {
    switch (transfer.status) {
      case 'PENDING_REGISTRAR':           return isSeller || isRegistrar;
      case 'AWAITING_PAYMENT':            return isBuyer  || isSeller;
      case 'PENDING_SELLER_CONFIRMATION': return isSeller;
      case 'PENDING_REGISTRAR_FINAL':     return isRegistrar;
      default: return false;
    }
  })();

  const daysLeft   = daysUntil(transfer.expiresAt);
  const showExpiry = !isTerminal && !isFrozen && daysLeft !== null && daysLeft <= 3 && daysLeft > 0;
  const popUrl     = transfer.popFileName ? transferService.getPopUrl(id) : null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={ROUTES.TRANSFERS} className="btn-ghost px-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl text-slate-800">Transfer Details</h2>
          </div>
          <p className="text-slate-500 text-sm">{transfer.property?.plotNumber ?? transfer.propertyId}</p>
        </div>
        <StatusBadge status={transfer.status} animate />
      </div>

      {/* Expiry warning */}
      {showExpiry && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">Transfer expiring in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
            <p className="text-sm text-amber-700 mt-0.5">
              This transfer will be automatically cancelled if no action is taken.
            </p>
          </div>
        </div>
      )}

      {/* Frozen banner */}
      {isFrozen && (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl p-4">
          <Snowflake className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-indigo-800">Transfer Frozen — Active Dispute</p>
            <p className="text-sm text-indigo-700 mt-0.5">
              This transfer has been frozen because a dispute has been raised on this property.
              It will resume automatically once the dispute is resolved.
            </p>
            {transfer.frozenReason && (
              <p className="text-xs text-indigo-600 mt-1 font-medium">Reason: {transfer.frozenReason}</p>
            )}
          </div>
        </div>
      )}

      {/* Expired banner */}
      {transfer.status === 'EXPIRED' && (
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-700">Transfer Expired</p>
            <p className="text-sm text-slate-600 mt-0.5">
              This transfer was automatically cancelled after 10 days of inactivity.
            </p>
          </div>
        </div>
      )}

      {/* Cancellation / rejection banners */}
      {transfer.status === 'CANCELLED' && transfer.cancellationNote && (
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
          <XCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-700">Transfer Cancelled</p>
            <p className="text-sm text-slate-600 mt-0.5">Reason: {transfer.cancellationNote}</p>
          </div>
        </div>
      )}
      {transfer.status === 'REJECTED' && transfer.rejectionNote && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">Rejected by Registrar</p>
            <p className="text-sm text-red-600 mt-0.5">Reason: {transfer.rejectionNote}</p>
          </div>
        </div>
      )}

      {/* Step indicator — only for active (non-frozen) transfers */}
      {!isFrozen && currentStepIdx >= 0 && (
        <div className="card">
          <p className="form-section">Transfer Progress</p>
          <div className="flex items-center gap-1">
            {UNIFIED_STEPS.map((step, i) => {
              const done   = stepProgress > i || transfer.status === 'CONFIRMED';
              const active = currentStepIdx === i && !isTerminal;
              return (
                <div key={step.status} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1 gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                      ${done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {done ? '✓' : i + 1}
                    </div>
                    <span className="text-xs text-slate-500 text-center leading-tight hidden sm:block">
                      {step.label}
                    </span>
                  </div>
                  {i < UNIFIED_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Certificate download (CONFIRMED) */}
      {transfer.status === 'CONFIRMED' && transfer.certificateNumber && (
        <div className="card flex items-center gap-3 bg-emerald-50 border border-emerald-200">
          <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-emerald-800 text-sm">Transfer Certificate</p>
            <p className="text-emerald-700 text-xs font-mono mt-0.5">{transfer.certificateNumber}</p>
          </div>
          <button
            onClick={downloadCertificate}
            className="btn-secondary text-xs flex items-center gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </button>
        </div>
      )}

      {/* Details card */}
      <div className="card">
        <p className="form-section">Parties & Details</p>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Seller</dt>
            <dd>{transfer.seller?.fullName ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Buyer</dt>
            <dd>{transfer.buyer?.fullName ?? '—'}</dd>
          </div>
          {transfer.saleValue && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Sale Value</dt>
              <dd className="font-semibold">{formatMoney(transfer.saleValue)}</dd>
            </div>
          )}
          {transfer.paymentMethod && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Payment Method</dt>
              <dd>{PAYMENT_LABELS[transfer.paymentMethod] ?? transfer.paymentMethod}</dd>
            </div>
          )}
          {(transfer.minPrice || transfer.maxPrice) && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Price Range</dt>
              <dd>{formatRange(transfer.minPrice!, transfer.maxPrice!)}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Initiated</dt>
            <dd>{new Date(transfer.initiatedAt).toLocaleDateString()}</dd>
          </div>
          {transfer.expiresAt && !isTerminal && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Expires</dt>
              <dd className={daysLeft !== null && daysLeft <= 3 ? 'text-amber-600 font-semibold' : ''}>
                {new Date(transfer.expiresAt).toLocaleDateString()}
              </dd>
            </div>
          )}
          {transfer.confirmedAt && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Confirmed</dt>
              <dd>{new Date(transfer.confirmedAt).toLocaleDateString()}</dd>
            </div>
          )}
        </dl>
        {transfer.blockchainTxHash && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <TxHashDisplay txHash={transfer.blockchainTxHash} network={NETWORK as 'testnet' | 'mainnet'} label="On-Chain TX" />
          </div>
        )}
      </div>

      {/* POP display — visible to seller + registrar once uploaded */}
      {popUrl && (isSeller || isRegistrar) && (
        <div className="card flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-slate-800 text-sm">Proof of Payment</p>
            <p className="text-slate-500 text-xs">{transfer.popFileName}</p>
          </div>
          <a href={popUrl} target="_blank" rel="noopener noreferrer"
            className="btn-secondary text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />Download
          </a>
        </div>
      )}

      {/* ── Step 1: Registrar review ── */}
      {canRegistrarReview && (
        <div className="card border-2 border-amber-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <p className="font-medium text-slate-800">Action Required: Review Transfer Application</p>
          </div>
          <p className="text-sm text-slate-600">
            Review the transfer details. Approve to proceed — the buyer will receive payment instructions.
            Reject with a mandatory reason to cancel the application.
          </p>
          {!rejectModal ? (
            <div className="flex gap-3">
              <button onClick={() => handleRegistrarReview('APPROVE')} disabled={actioning} className="btn-primary">
                <CheckCircle className="w-4 h-4" />
                {actioning ? 'Approving…' : 'Approve Transfer'}
              </button>
              <button onClick={() => setRejectModal(true)} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  className="input" rows={3}
                  value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Explain the issue with this transfer application…"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRegistrarReview('REJECT')}
                  disabled={actioning || !rejectNote.trim()}
                  className="btn-primary bg-red-600 hover:bg-red-700"
                >
                  {actioning ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
                <button onClick={() => { setRejectModal(false); setRejectNote(''); }} className="btn-ghost">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment instructions — shown to buyer at AWAITING_PAYMENT */}
      {transfer.paymentInstructions && transfer.status === 'AWAITING_PAYMENT' && isBuyer && (
        <div className="card border border-blue-200 bg-blue-50 space-y-2">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
            <p className="font-medium text-blue-800 text-sm">Payment Instructions from Seller</p>
          </div>
          <p className="text-sm text-blue-900 whitespace-pre-wrap leading-relaxed bg-white border border-blue-100 rounded-lg px-3 py-2.5">
            {transfer.paymentInstructions}
          </p>
          <p className="text-xs text-blue-600">
            Pay via{' '}
            <span className="font-semibold">{PAYMENT_LABELS[transfer.paymentMethod ?? ''] ?? transfer.paymentMethod}</span>,
            then upload your proof of payment below.
          </p>
        </div>
      )}

      {/* ── Step 2: Buyer uploads POP ── */}
      {canUploadPop && (
        <div className="card border-2 border-purple-200 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-500" />
            <p className="font-medium text-slate-800">Action Required: Upload Proof of Payment</p>
          </div>
          <p className="text-sm text-slate-600">
            Upload your payment confirmation (PDF, JPG, or PNG). The seller will review it.
          </p>
          <input
            ref={popInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => setPopFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-3">
            <button onClick={() => popInputRef.current?.click()} type="button" className="btn-secondary text-sm">
              <FileText className="w-4 h-4" />
              {popFile ? popFile.name : 'Choose File…'}
            </button>
            {popFile && (
              <button onClick={handleUploadPop} disabled={uploadingPop} className="btn-primary text-sm">
                <Upload className="w-4 h-4" />
                {uploadingPop ? 'Uploading…' : 'Upload'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Seller confirms payment ── */}
      {canSellerConfirm && (
        <div className="card border-2 border-blue-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <p className="font-medium text-slate-800">Action Required: Confirm Payment Received</p>
          </div>
          <p className="text-sm text-slate-600">
            Review the proof of payment above. Confirm if received, or dispute if there&apos;s an issue.
          </p>
          {!sellerDispute ? (
            <div className="flex gap-3">
              <button onClick={() => handleSellerConfirm(true)} disabled={actioning} className="btn-primary">
                <CheckCircle className="w-4 h-4" />
                {actioning ? 'Confirming…' : 'Confirm Payment Received'}
              </button>
              <button onClick={() => setSellerDispute(true)} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
                <AlertTriangle className="w-4 h-4" />
                Dispute Payment
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Dispute Note <span className="text-red-500">*</span></label>
                <textarea
                  className="input" rows={3}
                  value={sellerNote} onChange={(e) => setSellerNote(e.target.value)}
                  placeholder="Explain the payment issue — incorrect amount, wrong reference, etc…"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSellerConfirm(false)}
                  disabled={actioning || !sellerNote.trim()}
                  className="btn-primary bg-red-600 hover:bg-red-700"
                >
                  {actioning ? 'Disputing…' : 'Confirm Dispute'}
                </button>
                <button onClick={() => { setSellerDispute(false); setSellerNote(''); }} className="btn-ghost">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Registrar final sign-off ── */}
      {canRegistrarComplete && (
        <div className="card border-2 border-teal-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-500" />
            <p className="font-medium text-slate-800">Action Required: Final Sign-off & Blockchain</p>
          </div>
          <p className="text-sm text-slate-600">
            Seller confirmed payment. Review the proof of payment above, then complete the transfer on the blockchain.
          </p>
          {transfer.paymentInstructions && (
            <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <p className="text-xs font-medium text-slate-600 mb-1">Declared payment instructions:</p>
              <p className="text-xs text-slate-700 whitespace-pre-wrap">{transfer.paymentInstructions}</p>
            </div>
          )}
          <div>
            <label className="label">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="text" className="input"
              placeholder="Any final remarks…"
              value={registrarNote} onChange={(e) => setRegistrarNote(e.target.value)}
              maxLength={300}
            />
          </div>
          <button onClick={handleRegistrarComplete} disabled={actioning} className="btn-primary">
            <CheckCircle className="w-4 h-4" />
            {actioning ? 'Finalising on blockchain…' : 'Complete Transfer on Blockchain'}
          </button>
        </div>
      )}

      {/* Cancel */}
      {canCancel && (
        <div>
          {!cancelModal ? (
            <button onClick={() => setCancelModal(true)} className="btn-ghost text-red-600 border-red-200 hover:bg-red-50">
              <XCircle className="w-4 h-4" />
              Cancel Transfer
            </button>
          ) : (
            <div className="card border border-red-200 space-y-3">
              <p className="font-medium text-slate-800">Cancel this transfer?</p>
              <div>
                <label className="label">Reason <span className="text-red-500">*</span></label>
                <textarea
                  className="input" rows={3}
                  value={cancelNote} onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="Explain why this transfer is being cancelled…"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={actioning || !cancelNote.trim()}
                  className="btn-primary bg-red-600 hover:bg-red-700"
                >
                  {actioning ? 'Cancelling…' : 'Confirm Cancellation'}
                </button>
                <button onClick={() => { setCancelModal(false); setCancelNote(''); }} className="btn-ghost">Back</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
