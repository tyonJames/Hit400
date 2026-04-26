'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Send, Paperclip, X, MessageSquare, Inbox, ChevronLeft,
  Download, Clock, CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { messageService, transferService } from '@/lib/api/services';
import { useAuthStore }  from '@/stores/auth.store';
import type { Message, Transfer } from '@/types';

type Tab = 'inbox' | 'sent';
type View = 'list' | 'detail' | 'compose';

export default function MessagesPage() {
  const user = useAuthStore((s) => s.user);

  const [tab, setTab]         = useState<Tab>('inbox');
  const [view, setView]       = useState<View>('list');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);

  // Compose state
  const [transfers, setTransfers]   = useState<Transfer[]>([]);
  const [transferId, setTransferId] = useState('');
  const [subject, setSubject]       = useState('');
  const [body, setBody]             = useState('');
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [sending, setSending]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = tab === 'inbox'
        ? await messageService.getInbox()
        : await messageService.getSent();
      setMessages(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setSelected(null); setView('list'); }, [tab]);

  // Load user's transfers for the compose dropdown
  useEffect(() => {
    if (!user) return;
    transferService.getMine({ limit: 50 })
      .then((res) => setTransfers(res.data))
      .catch(() => {});
  }, [user?.id]);

  async function openMessage(msg: Message) {
    const full = await messageService.getById(msg.id);
    setSelected(full);
    setView('detail');
    // Refresh list to update unread state
    load();
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return toast.error('Subject is required.');
    if (!body.trim())    return toast.error('Message body is required.');
    setSending(true);
    try {
      await messageService.send(
        { transferId: transferId || undefined, subject: subject.trim(), body: body.trim() },
        attachFile ?? undefined,
      );
      toast.success('Message sent.');
      setSubject(''); setBody(''); setTransferId(''); setAttachFile(null);
      setView('list');
      setTab('sent');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }


  return (
    <div className="max-w-3xl space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-display text-xl text-slate-800">Messages</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Secure communication between transfer parties and registrars
          </p>
        </div>
        {view !== 'compose' && (
          <button
            onClick={() => setView('compose')}
            className="btn-primary"
          >
            <Send className="w-4 h-4" />
            Compose
          </button>
        )}
      </div>

      {/* Compose form */}
      {view === 'compose' && (
        <div className="card space-y-4 mb-5">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-slate-800">New Message</h3>
            <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            <div>
              <label className="label">Regarding Transfer (optional)</label>
              <select
                className="input"
                value={transferId}
                onChange={(e) => setTransferId(e.target.value)}
              >
                <option value="">General message (sent to all registrars)</option>
                {transfers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.property?.plotNumber ?? t.propertyId} — {t.status} (
                    {t.seller?.fullName ?? 'Seller'} → {t.buyer?.fullName ?? 'Buyer'})
                  </option>
                ))}
              </select>
              {transferId && (
                <p className="text-xs text-slate-400 mt-1">
                  All parties on this transfer (buyer, seller, and registrars) will receive this message.
                </p>
              )}
              {!transferId && (
                <p className="text-xs text-slate-400 mt-1">
                  No transfer selected — message will be sent to all registrars.
                </p>
              )}
            </div>

            <div>
              <label className="label">Subject <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Payment confirmation for Plot HRE-1234"
                maxLength={200}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Message <span className="text-red-500">*</span></label>
              <textarea
                className="input"
                rows={5}
                placeholder="Write your message here…"
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
              <p className="text-xs text-slate-400 mt-1 text-right">{body.length}/2000</p>
            </div>

            <div>
              <label className="label">Attachment (optional)</label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Paperclip className="w-4 h-4" />
                  {attachFile ? attachFile.name : 'Attach File'}
                </button>
                {attachFile && (
                  <button type="button" onClick={() => setAttachFile(null)} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">PDF, JPG or PNG — max 5 MB</p>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={sending} className="btn-primary">
                <Send className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send Message'}
              </button>
              <button type="button" onClick={() => setView('list')} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Message detail */}
      {view === 'detail' && selected && (
        <div className="card space-y-4 mb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setView('list'); setSelected(null); }}
              className="btn-ghost px-2 py-1"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-medium text-slate-800 flex-1">{selected.subject}</h3>
          </div>

          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="space-y-0.5">
              <p className="text-sm text-slate-700">
                <span className="font-medium">From:</span> {selected.sender?.fullName ?? 'Unknown'}
                {selected.senderId === user?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
              </p>
              {selected.transfer?.property && (
                <p className="text-sm text-slate-500">
                  <span className="font-medium">Re:</span>{' '}
                  Transfer — {selected.transfer.property.plotNumber}, {selected.transfer.property.address}
                </p>
              )}
            </div>
            <p className="text-xs text-slate-400 shrink-0">
              {new Date(selected.createdAt).toLocaleString()}
            </p>
          </div>

          <p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">{selected.body}</p>

          {selected.attachmentFileName && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
              <Paperclip className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-sm text-slate-700 flex-1 truncate">{selected.attachmentFileName}</span>
              <a
                href={messageService.getAttachmentUrl(selected.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
            </div>
          )}

          {selected.recipients && selected.recipients.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1.5">Recipients</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.recipients.map((r) => (
                  <span key={r.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border
                    ${r.readAt ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {r.readAt ? <CheckCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {r.recipient?.fullName ?? 'User'}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              onClick={() => {
                setSubject(`Re: ${selected.subject}`);
                setTransferId(selected.transferId ?? '');
                setView('compose');
              }}
              className="btn-secondary text-sm"
            >
              Reply
            </button>
          </div>
        </div>
      )}

      {/* Inbox / Sent list */}
      {view !== 'compose' && (
        <div className="card overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(['inbox', 'sent'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium capitalize border-b-2 transition-colors
                  ${tab === t
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'inbox' ? <Inbox className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'inbox' && messages.length > 0 && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{messages.length}</span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3 px-5 py-4 border-b border-slate-50">
                  <div className="skeleton h-4 w-4 rounded-full mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-48 rounded" />
                    <div className="skeleton h-3 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center">
              <MessageSquare className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No messages yet</p>
              <p className="text-slate-400 text-sm mt-1">
                {tab === 'inbox' ? 'Messages from other parties will appear here.' : 'Messages you send will appear here.'}
              </p>
            </div>
          ) : (
            <div>
              {messages.map((msg) => {
                const isUnread = tab === 'inbox' && !(msg as any).readAt;
                const isActive = selected?.id === msg.id;
                return (
                  <button
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className={`w-full flex items-start gap-4 px-5 py-4 border-b border-slate-50 text-left
                      transition-colors hover:bg-slate-50
                      ${isActive ? 'bg-primary/5 border-l-2 border-l-primary' : ''}
                      ${isUnread ? 'bg-blue-50/40' : ''}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isUnread ? 'bg-primary' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className={`text-sm truncate ${isUnread ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                          {tab === 'inbox' ? (msg.sender?.fullName ?? 'Unknown') : `To: all parties`}
                        </p>
                        <p className="text-xs text-slate-400 shrink-0">
                          {new Date(msg.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className={`text-sm truncate ${isUnread ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                        {msg.subject}
                      </p>
                      {msg.transfer?.property && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">
                          Re: {msg.transfer.property.plotNumber} — {msg.transfer.property.address}
                        </p>
                      )}
                    </div>
                    {msg.attachmentFileName && (
                      <Paperclip className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
