'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link  from 'next/link';
import {
  ArrowLeft, CheckCircle, XCircle, Upload, Download,
  AlertTriangle, FileText, Clock,
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

/* ── Step definitions ── */
const DIRECT_STEPS = [
  { status: 'PENDING_BUYER',     label: 'Buyer Approves' },
  { status: 'PENDING_REGISTRAR', label: 'Registrar Finalises' },
  { status: 'CONFIRMED',         label: 'Confirmed' },
];

const MARKET_STEPS = [
  { status: 'PENDING_REGISTRAR_TERMS',      label: 'Terms Review' },
  { status: 'AWAITING_POP',                 label: 'Payment Proof' },
  { status: 'PENDING_SELLER_CONFIRMATION',  label: 'Seller Confirms' },
  { status: 'PENDING_REGISTRAR_FINAL',      label: 'Final Sign-off' },
  { status: 'CONFIRMED',                    label: 'Confirmed' },
];

const PAYMENT_LABELS: Record<string, string> = {
  ECOCASH: 'EcoCash', ZIPIT: 'ZIPIT',
  BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash',
};

export default function TransferDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const router      = useRouter();
  const user        = useAuthStore((s) => s.user);
  const isRegistrar = useAuthStore((s) => s.isRegistrar());
  const addTx       = useBlockchainStore((s) => s.addTx);

  const [transfer, setTransfer]       = useState<Transfer | null>(null);
  const [loading, setLoading]         = useState(true);
  const [actioning, setActioning]     = useState(false);

  /* modal states */
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelNote, setCancelNote]   = useState('');
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectNote, setRejectNote]   = useState('');
  const [sellerDispute, setSellerDispute] = useState(false);
  const [sellerNote, setSellerNote]   = useState('');
  const [registrarNote, setRegistrarNote] = useState('');

  /* POP upload */
  const popInputRef = useRef<HTMLInputElement>(null);
  const [popFile, setPopFile]         = useState<File | null>(null);
  const [uploadingPop, setUploadingPop] = useState(false);

  async function reload() {
    const t = await transferService.getById(id);
    setTransfer(t);
  }

  useEffect(() => {
    transferService.getById(id).then(setTransfer).finally(() => setLoading(false));
  }, [id]);

  /* ── Action handlers ── */
  async function handleBuyerApprove() {
    setActioning(true);
    try {
      const updated = await transferService.buyerApprove(id);
      setTransfer(updated);
      toast.success('Transfer approved. Awaiting registrar finalisation.');
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  async function handleRegistrarApprove() {
    setActioning(true);
    try {
      const { transfer: updated, blockchainTxHash } = await transferService.registrarApprove(id);
      addTx(blockchainTxHash, 'finalize-transfer', id, 'Transfer');
      setTransfer(updated);
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

  /* Marketplace actions */
  async function handleReviewTerms(action: 'APPROVE' | 'REJECT') {
    if (action === 'REJECT' && !rejectNote.trim()) return toast.error('A rejection note is required.');
    setActioning(true);
    try {
      const updated = await transferService.reviewTerms(id, action, action === 'REJECT' ? rejectNote.trim() : '');
      setTransfer(updated);
      setRejectModal(false);
      setRejectNote('');
      toast.success(action === 'APPROVE' ? 'Terms approved. Buyer can now upload proof of payment.' : 'Terms rejected. The listing is restored for the seller to review.');
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
      toast.success(confirmed ? 'Payment confirmed. Awaiting final registrar sign-off.' : 'Disputed — buyer will need to re-upload payment proof.');
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

  /* ── Derived state ── */
  if (loading) return <div className="skeleton h-64 rounded-card" />;
  if (!transfer) return <div className="empty-state"><p>Transfer not found</p></div>;

  const isMarketplace = !!transfer.marketplaceListingId;
  const steps         = isMarketplace ? MARKET_STEPS : DIRECT_STEPS;
  const currentStep   = steps.findIndex((s) => s.status === transfer.status);
  const isTerminal    = ['CONFIRMED', 'CANCELLED', 'REJECTED'].includes(transfer.status);
  const stepProgress  = isTerminal && transfer.status === 'CONFIRMED'
    ? steps.length : currentStep;

  const isSeller    = user?.id === transfer.sellerId;
  const isBuyer     = user?.id === transfer.buyerId;

  /* Per-step permissions */
  const canBuyerApprove     = transfer.status === 'PENDING_BUYER' && isBuyer;
  const canRegistrarApprove = transfer.status === 'PENDING_REGISTRAR' && isRegistrar;
  const canReviewTerms      = transfer.status === 'PENDING_REGISTRAR_TERMS' && isRegistrar;
  const canUploadPop        = transfer.status === 'AWAITING_POP' && isBuyer;
  const canSellerConfirm    = transfer.status === 'PENDING_SELLER_CONFIRMATION' && isSeller;
  const canRegistrarComplete = transfer.status === 'PENDING_REGISTRAR_FINAL' && isRegistrar;

  const canCancel = (() => {
    switch (transfer.status) {
      case 'PENDING_BUYER':                return isSeller || isRegistrar;
      case 'PENDING_REGISTRAR':            return isSeller || isRegistrar;
      case 'AWAITING_POP':                 return isBuyer || isSeller;
      case 'PENDING_SELLER_CONFIRMATION':  return isSeller;
      case 'PENDING_REGISTRAR_FINAL':      return isRegistrar;
      default: return false;
    }
  })();

  const popUrl = transfer.popFileName ? transferService.getPopUrl(id) : null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={ROUTES.TRANSFERS} className="btn-ghost px-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl text-slate-800">Transfer Details</h2>
            {isMarketplace && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                Marketplace
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">{transfer.property?.plotNumber ?? transfer.propertyId}</p>
        </div>
        <StatusBadge status={transfer.status} animate />
      </div>

      {/* Step indicator */}
      <div className="card">
        <p className="form-section">Transfer Progress</p>
        <div className="flex items-center gap-1">
          {steps.map((step, i) => {
            const done   = stepProgress > i || transfer.status === 'CONFIRMED';
            const active = currentStep === i && !isTerminal;
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
                {i < steps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

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
            <p className="font-medium text-red-700">Terms Rejected by Registrar</p>
            <p className="text-sm text-red-600 mt-0.5">Reason: {transfer.rejectionNote}</p>
            {isSeller && (
              <p className="text-xs text-red-500 mt-1">
                The listing has been restored. Please review the reason and update your listing.
              </p>
            )}
          </div>
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
          {isMarketplace && (transfer.minPrice || transfer.maxPrice) && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Agreed Price Range</dt>
              <dd>{formatRange(transfer.minPrice!, transfer.maxPrice!)}</dd>
            </div>
          )}
          {isMarketplace && transfer.paymentMethod && (
            <div>
              <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Payment Method</dt>
              <dd>{PAYMENT_LABELS[transfer.paymentMethod] ?? transfer.paymentMethod}</dd>
            </div>
          )}
          <div>
            <dt className="text-slate-500 text-xs uppercase tracking-wider mb-0.5">Initiated</dt>
            <dd>{new Date(transfer.initiatedAt).toLocaleDateString()}</dd>
          </div>
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

      {/* POP display (visible to seller + registrar once uploaded) */}
      {popUrl && (isSeller || isRegistrar) && (
        <div className="card flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-slate-800 text-sm">Proof of Payment</p>
            <p className="text-slate-500 text-xs">{transfer.popFileName}</p>
          </div>
          <a
            href={popUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </a>
        </div>
      )}

      {/* ── Action panels ── */}

      {/* Direct flow: buyer approve */}
      {canBuyerApprove && (
        <div className="card border-2 border-blue-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <p className="font-medium text-slate-800">Action Required: Approve Transfer</p>
          </div>
          <p className="text-sm text-slate-600">
            Review the transfer details above. If everything is correct, approve to proceed to registrar sign-off.
          </p>
          <button onClick={handleBuyerApprove} disabled={actioning} className="btn-primary">
            <CheckCircle className="w-4 h-4" />
            {actioning ? 'Approving…' : 'Approve Transfer'}
          </button>
        </div>
      )}

      {/* Direct flow: registrar approve */}
      {canRegistrarApprove && (
        <div className="card border-2 border-teal-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-500" />
            <p className="font-medium text-slate-800">Action Required: Finalise Transfer</p>
          </div>
          <p className="text-sm text-slate-600">
            Both parties have approved. Finalise this transfer to write ownership to the blockchain.
          </p>
          <button onClick={handleRegistrarApprove} disabled={actioning} className="btn-primary">
            <CheckCircle className="w-4 h-4" />
            {actioning ? 'Finalising on blockchain…' : 'Finalise Transfer'}
          </button>
        </div>
      )}

      {/* Marketplace: registrar review terms */}
      {canReviewTerms && (
        <div className="card border-2 border-amber-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <p className="font-medium text-slate-800">Action Required: Review Transfer Terms</p>
          </div>
          <p className="text-sm text-slate-600">
            Review the payment terms agreed between the buyer and seller. Approve to proceed, or reject with a mandatory reason.
          </p>
          {!rejectModal ? (
            <div className="flex gap-3">
              <button onClick={() => handleReviewTerms('APPROVE')} disabled={actioning} className="btn-primary">
                <CheckCircle className="w-4 h-4" />
                {actioning ? 'Approving…' : 'Approve Terms'}
              </button>
              <button onClick={() => setRejectModal(true)} className="btn-secondary text-red-600 border-red-200 hover:bg-red-50">
                <XCircle className="w-4 h-4" />
                Reject Terms
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="label">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  className="input"
                  rows={3}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  placeholder="Explain the issue with these transfer terms…"
                  maxLength={500}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleReviewTerms('REJECT')}
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

      {/* Marketplace: buyer upload POP */}
      {canUploadPop && (
        <div className="card border-2 border-purple-200 space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-500" />
            <p className="font-medium text-slate-800">Action Required: Upload Proof of Payment</p>
          </div>
          <p className="text-sm text-slate-600">
            Upload your payment confirmation (PDF, JPG, or PNG). The seller will review it before the registrar finalises on-chain.
          </p>
          <input
            ref={popInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => setPopFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => popInputRef.current?.click()}
              type="button"
              className="btn-secondary text-sm"
            >
              <FileText className="w-4 h-4" />
              {popFile ? popFile.name : 'Choose File…'}
            </button>
            {popFile && (
              <button
                onClick={handleUploadPop}
                disabled={uploadingPop}
                className="btn-primary text-sm"
              >
                <Upload className="w-4 h-4" />
                {uploadingPop ? 'Uploading…' : 'Upload'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Marketplace: seller confirmation */}
      {canSellerConfirm && (
        <div className="card border-2 border-amber-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            <p className="font-medium text-slate-800">Action Required: Confirm Payment Received</p>
          </div>
          <p className="text-sm text-slate-600">
            Review the proof of payment above. Confirm if the payment has been received, or dispute it if there's an issue.
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
                  className="input"
                  rows={3}
                  value={sellerNote}
                  onChange={(e) => setSellerNote(e.target.value)}
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

      {/* Marketplace: registrar final sign-off */}
      {canRegistrarComplete && (
        <div className="card border-2 border-teal-200 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-500" />
            <p className="font-medium text-slate-800">Action Required: Final Sign-off & Blockchain</p>
          </div>
          <p className="text-sm text-slate-600">
            The seller has confirmed payment. Review the proof of payment above, then complete the transfer to record ownership on the blockchain.
          </p>
          <div>
            <label className="label">Notes (optional)</label>
            <input
              type="text"
              className="input"
              placeholder="Any final remarks…"
              value={registrarNote}
              onChange={(e) => setRegistrarNote(e.target.value)}
              maxLength={300}
            />
          </div>
          <button onClick={handleRegistrarComplete} disabled={actioning} className="btn-primary">
            <CheckCircle className="w-4 h-4" />
            {actioning ? 'Finalising on blockchain…' : 'Complete Transfer on Blockchain'}
          </button>
        </div>
      )}

      {/* Cancel button */}
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
                <label className="label">Reason for cancellation <span className="text-red-500">*</span></label>
                <textarea
                  className="input"
                  rows={3}
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
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
