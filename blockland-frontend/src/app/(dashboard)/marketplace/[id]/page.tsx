'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, DollarSign, MessageSquare, CheckCircle,
  Trash2, Users, Clock, AlertCircle, Edit2,
} from 'lucide-react';
import { toast } from 'sonner';
import { marketplaceService } from '@/lib/api/services';
import { formatRange } from '@/lib/format';
import { useAuthStore } from '@/stores/auth.store';
import { ROUTES } from '@/lib/navigation';
import type { MarketplaceListing, BuyerInterest } from '@/types';

const PAYMENT_LABELS: Record<string, string> = {
  ECOCASH: 'EcoCash', ZIPIT: 'ZIPIT',
  BANK_TRANSFER: 'Bank Transfer', CASH: 'Cash',
};

export default function ListingDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const router      = useRouter();
  const user        = useAuthStore((s) => s.user);

  const [listing, setListing]   = useState<(MarketplaceListing & { myInterest: BuyerInterest | null }) | null>(null);
  const [interests, setInterests] = useState<BuyerInterest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [actioning, setActioning] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [interestMsg, setInterestMsg] = useState('');
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [selectModal, setSelectModal] = useState<{ interestId: string; buyerName: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await marketplaceService.getById(id);
      setListing(data);
      if (user && data.sellerId === user.id) {
        const ints = await marketplaceService.getInterests(id);
        setInterests(ints);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id, user?.id]);

  async function handleExpressInterest() {
    setActioning(true);
    try {
      await marketplaceService.expressInterest(id, interestMsg || undefined);
      toast.success('Interest expressed! The seller will be notified.');
      setShowInterestForm(false);
      setInterestMsg('');
      await load();
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  async function handleWithdraw() {
    setActioning(true);
    try {
      await marketplaceService.withdrawInterest(id);
      toast.success('Interest withdrawn.');
      await load();
    } catch (err: any) { toast.error(err?.message); } finally { setActioning(false); }
  }

  async function handleSelectBuyer() {
    if (!selectModal || !paymentMethod) return;
    setSelectingId(selectModal.interestId);
    try {
      const transfer = await marketplaceService.selectBuyer(id, selectModal.interestId, paymentMethod);
      toast.success('Buyer selected! Transfer initiated — awaiting registrar review of terms.');
      router.push(ROUTES.TRANSFER(transfer.id));
    } catch (err: any) { toast.error(err?.message); } finally { setSelectingId(null); setSelectModal(null); }
  }

  if (loading) return <div className="skeleton h-96 rounded-card" />;
  if (!listing) return <div className="empty-state"><p>Listing not found</p></div>;

  const prop         = listing.property;
  const isSeller     = user?.id === listing.sellerId;
  const myInterest   = listing.myInterest;
  const canInterest  = !isSeller && listing.status === 'ACTIVE' && !myInterest;
  const canWithdraw  = !isSeller && myInterest?.status === 'PENDING';

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={ROUTES.MARKETPLACE} className="btn-ghost px-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex-1">
          <h2 className="font-display text-xl text-slate-800">
            {prop?.plotNumber ?? 'Property Listing'}
          </h2>
          {prop?.address && (
            <p className="text-slate-500 text-sm flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3" />{prop.address}
            </p>
          )}
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border
          ${listing.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            listing.status === 'SOLD'   ? 'bg-slate-100 text-slate-600 border-slate-200' :
            'bg-red-50 text-red-600 border-red-200'}`}>
          {listing.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left — Listing Details */}
        <div className="space-y-4">
          <div className="card space-y-4">
            <p className="form-section">Asking Price</p>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span className="text-2xl font-bold text-emerald-800">
                  {formatRange(listing.minPrice, listing.maxPrice)}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Accepted Payment Methods
              </p>
              <div className="flex flex-wrap gap-1.5">
                {listing.paymentMethods.map((m) => (
                  <span key={m} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs
                                           bg-blue-50 text-blue-700 border border-blue-200 font-medium">
                    {PAYMENT_LABELS[m] ?? m}
                  </span>
                ))}
              </div>
            </div>

            {listing.description && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-slate-700 leading-relaxed">{listing.description}</p>
              </div>
            )}
          </div>

          {prop && (
            <div className="card space-y-3">
              <p className="form-section">Property Details</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Zoning</dt>
                  <dd className="text-slate-800">{prop.zoningType}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Land Size</dt>
                  <dd className="text-slate-800">{prop.landSize} {prop.unit}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Title Deed</dt>
                  <dd className="font-mono text-xs text-slate-700">{prop.titleDeedNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Status</dt>
                  <dd className="text-slate-800">{prop.status}</dd>
                </div>
              </dl>
              <Link href={ROUTES.PROPERTY(prop.id)} className="text-xs text-primary hover:underline">
                View full property details →
              </Link>
            </div>
          )}

          <div className="card">
            <p className="text-xs text-slate-500">
              Listed by <span className="font-medium text-slate-700">{listing.seller?.fullName ?? 'Seller'}</span>
              {' · '}{new Date(listing.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Right — Interest / Buyer actions */}
        <div className="space-y-4">
          {/* Buyer: express / withdraw interest */}
          {!isSeller && listing.status === 'ACTIVE' && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <p className="font-medium text-slate-800">Your Interest</p>
              </div>

              {myInterest ? (
                <div>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-3
                    ${myInterest.status === 'SELECTED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      myInterest.status === 'NOT_SELECTED' ? 'bg-slate-100 text-slate-600' :
                      myInterest.status === 'WITHDRAWN' ? 'bg-slate-100 text-slate-500' :
                      'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                    {myInterest.status === 'SELECTED' && <CheckCircle className="w-4 h-4 shrink-0" />}
                    {myInterest.status === 'PENDING' && <Clock className="w-4 h-4 shrink-0" />}
                    {myInterest.status === 'NOT_SELECTED' && <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>
                      {myInterest.status === 'SELECTED' ? 'You have been selected as the buyer!' :
                       myInterest.status === 'NOT_SELECTED' ? 'Another buyer was selected for this listing.' :
                       myInterest.status === 'WITHDRAWN' ? 'You have withdrawn your interest.' :
                       'Interest submitted — awaiting seller decision.'}
                    </span>
                  </div>
                  {myInterest.status === 'SELECTED' && (
                    <p className="text-xs text-slate-500">
                      The seller has initiated a transfer. Check the Transfers section for the next steps.
                    </p>
                  )}
                  {canWithdraw && (
                    <button onClick={handleWithdraw} disabled={actioning} className="btn-ghost text-sm text-red-600 border-red-200 hover:bg-red-50">
                      <Trash2 className="w-3.5 h-3.5" />
                      Withdraw Interest
                    </button>
                  )}
                </div>
              ) : showInterestForm ? (
                <div className="space-y-3">
                  <div>
                    <label className="label">Message to seller (optional)</label>
                    <textarea
                      className="input"
                      rows={3}
                      value={interestMsg}
                      onChange={(e) => setInterestMsg(e.target.value)}
                      placeholder="Introduce yourself or ask questions about the property…"
                      maxLength={500}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleExpressInterest} disabled={actioning} className="btn-primary text-sm">
                      {actioning ? 'Submitting…' : 'Express Interest'}
                    </button>
                    <button onClick={() => setShowInterestForm(false)} className="btn-ghost text-sm">Cancel</button>
                  </div>
                </div>
              ) : canInterest ? (
                <div>
                  <p className="text-sm text-slate-600 mb-3">
                    Show the seller you're interested in buying this property.
                    They will then choose a buyer and initiate a transfer.
                  </p>
                  <button onClick={() => setShowInterestForm(true)} className="btn-primary">
                    <MessageSquare className="w-4 h-4" />
                    Express Interest
                  </button>
                </div>
              ) : !user ? (
                <p className="text-sm text-slate-500">
                  <Link href={ROUTES.LOGIN} className="text-primary hover:underline">Sign in</Link> to express interest.
                </p>
              ) : null}
            </div>
          )}

          {/* Seller: manage listing + select buyer */}
          {isSeller && (
            <div className="space-y-4">
              {listing.status === 'ACTIVE' && (
                <div className="flex gap-2">
                  <Link href={`${ROUTES.MARKETPLACE_MY}`} className="btn-secondary text-sm flex items-center gap-2">
                    <Edit2 className="w-3.5 h-3.5" />
                    Manage Listing
                  </Link>
                </div>
              )}

              <div className="card space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <p className="font-medium text-slate-800">
                    Interested Buyers ({interests.filter(i => i.status === 'PENDING').length})
                  </p>
                </div>

                {interests.length === 0 ? (
                  <p className="text-sm text-slate-500">No buyers have expressed interest yet.</p>
                ) : (
                  <div className="space-y-2">
                    {interests.map((interest) => (
                      <div key={interest.id} className={`border rounded-xl p-3 space-y-2
                        ${interest.status === 'SELECTED' ? 'border-emerald-200 bg-emerald-50' :
                          interest.status === 'PENDING' ? 'border-slate-200 bg-white' :
                          'border-slate-100 bg-slate-50 opacity-60'}`}>
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm text-slate-800">
                            {interest.buyer?.fullName ?? 'Buyer'}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border
                            ${interest.status === 'SELECTED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                              interest.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-500 border-slate-200'}`}>
                            {interest.status}
                          </span>
                        </div>
                        {interest.message && (
                          <p className="text-xs text-slate-600 italic">"{interest.message}"</p>
                        )}
                        <p className="text-xs text-slate-400">
                          {new Date(interest.createdAt).toLocaleDateString()}
                        </p>
                        {interest.status === 'PENDING' && listing.status === 'ACTIVE' && (
                          <button
                            onClick={() => setSelectModal({ interestId: interest.id, buyerName: interest.buyer?.fullName ?? 'this buyer' })}
                            disabled={!!selectingId}
                            className="btn-primary text-xs py-1.5"
                          >
                            Select as Buyer
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Select Buyer Modal */}
      {selectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg text-slate-800">Confirm Buyer Selection</h3>
            <p className="text-sm text-slate-600">
              You're selecting <span className="font-semibold">{selectModal.buyerName}</span> as the buyer.
              This will lock the listing and initiate a transfer pending registrar review.
            </p>
            <div>
              <label className="label">Payment Method <span className="text-red-500">*</span></label>
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="">Select payment method…</option>
                {listing.paymentMethods.map((m) => (
                  <option key={m} value={m}>{PAYMENT_LABELS[m] ?? m}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSelectBuyer}
                disabled={!paymentMethod || !!selectingId}
                className="btn-primary flex-1"
              >
                {selectingId ? 'Processing…' : 'Confirm & Initiate Transfer'}
              </button>
              <button onClick={() => { setSelectModal(null); setPaymentMethod(''); }} className="btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
