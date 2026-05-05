import type {
  PropertyStatus, TransferStatus, DisputeStatus,
  VerificationStatus, BlockchainTxState,
} from '@/types';

type AnyStatus =
  | PropertyStatus
  | TransferStatus
  | DisputeStatus
  | VerificationStatus
  | BlockchainTxState['status']
  | 'ACTIVE_PENDING';

interface BadgeConfig {
  label:     string;
  className: string;
  dot?:      string;
}

const STATUS_CONFIG: Record<string, BadgeConfig> = {
  PENDING_APPROVAL:  { label: 'Pending Approval',  className: 'bg-blue-50 text-blue-700 border-blue-200',         dot: 'bg-blue-400 animate-chain-pulse' },
  DECLINED:          { label: 'Declined',           className: 'bg-red-50 text-red-600 border-red-200' },
  ACTIVE:            { label: 'Active',             className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING_TRANSFER:  { label: 'Pending Transfer',   className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DISPUTED:          { label: 'Disputed',           className: 'bg-red-50 text-red-700 border-red-200' },
  INACTIVE:          { label: 'Inactive',           className: 'bg-slate-100 text-slate-500 border-slate-200' },
  PENDING_REGISTRAR:           { label: 'Pending Review',        className: 'bg-amber-50 text-amber-700 border-amber-200',  dot: 'bg-amber-400 animate-chain-pulse' },
  AWAITING_PAYMENT:            { label: 'Awaiting Payment',      className: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-400 animate-chain-pulse' },
  PENDING_SELLER_CONFIRMATION: { label: 'Awaiting Seller Confirm',className:'bg-blue-50 text-blue-700 border-blue-200',   dot: 'bg-blue-400 animate-chain-pulse' },
  PENDING_REGISTRAR_FINAL:     { label: 'Awaiting Final Sign-off',className:'bg-teal-50 text-teal-700 border-teal-200',   dot: 'bg-teal-400 animate-chain-pulse' },
  FROZEN:                      { label: 'Frozen — Dispute',      className: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-400' },
  EXPIRED:                     { label: 'Expired',               className: 'bg-slate-100 text-slate-500 border-slate-200' },
  CONFIRMED:                   { label: 'Confirmed',             className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED:                   { label: 'Cancelled',             className: 'bg-slate-100 text-slate-500 border-slate-200' },
  REJECTED:                    { label: 'Rejected',              className: 'bg-red-50 text-red-600 border-red-200' },
  // Legacy statuses
  PENDING_BUYER:               { label: 'Awaiting Buyer',        className: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENDING_REGISTRAR_TERMS:     { label: 'Awaiting Term Review',  className: 'bg-blue-50 text-blue-700 border-blue-200' },
  AWAITING_POP:                { label: 'Awaiting Payment Proof',className: 'bg-purple-50 text-purple-700 border-purple-200' },
  // Marketplace listing statuses
  SOLD:                        { label: 'Sold',                  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  OPEN:              { label: 'Open',               className: 'bg-red-50 text-red-700 border-red-200' },
  UNDER_REVIEW:      { label: 'Under Review',       className: 'bg-amber-50 text-amber-700 border-amber-200' },
  RESOLVED:          { label: 'Resolved',           className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DISMISSED:         { label: 'Dismissed',          className: 'bg-slate-100 text-slate-500 border-slate-200' },
  VERIFIED:          { label: 'Verified ✓',         className: 'bg-teal-50 text-teal-700 border-teal-200',  dot: 'bg-primary animate-chain-pulse' },
  MISMATCH:          { label: '⚠ Mismatch',         className: 'bg-red-50 text-red-700 border-red-200' },
  NOT_FOUND:         { label: 'Not Found',          className: 'bg-slate-100 text-slate-500 border-slate-200' },
  pending:           { label: 'Pending On-Chain',   className: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500 animate-chain-pulse' },
  confirmed:         { label: 'On-Chain ✓',         className: 'bg-teal-50 text-teal-700 border-teal-200',      dot: 'bg-primary' },
  failed:            { label: 'TX Failed',          className: 'bg-red-50 text-red-700 border-red-200' },
};

interface StatusBadgeProps {
  status:   AnyStatus;
  size?:    'sm' | 'md' | 'lg';
  showDot?: boolean;
  animate?: boolean;
}

export function StatusBadge({ status, size = 'md', showDot = true, animate = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status, className: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const sizeClasses = { sm: 'text-xs px-2 py-0.5', md: 'text-xs px-2.5 py-1', lg: 'text-sm px-3 py-1.5' }[size];

  return (
    <span className={[
      'inline-flex items-center gap-1.5 font-medium border rounded-badge',
      sizeClasses, config.className,
      animate ? 'animate-badge-pop' : '',
    ].filter(Boolean).join(' ')}>
      {showDot && config.dot && (
        <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} aria-hidden="true" />
      )}
      {config.label}
    </span>
  );
}

interface TxHashDisplayProps {
  txHash:   string;
  network?: 'testnet' | 'mainnet';
  label?:   string;
}

export function TxHashDisplay({ txHash, network = 'testnet', label = 'TX' }: TxHashDisplayProps) {
  const isSimulated = txHash.startsWith('sim-') || txHash.startsWith('mock-');
  const explorerUrl = `https://explorer.hiro.so/txid/${txHash}?chain=${network}`;
  const short = txHash.length > 16 ? `${txHash.slice(0, 8)}...${txHash.slice(-8)}` : txHash;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-label text-slate-500 uppercase tracking-widest">{label}</span>
      {isSimulated ? (
        <span className="inline-flex items-center gap-1.5 font-mono text-hash text-slate-400 bg-slate-100 border border-slate-200 rounded px-2 py-0.5 text-xs">
          <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Simulated — not on-chain
        </span>
      ) : (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-hash text-primary hover:text-primary-light
                     hover:underline transition-colors inline-flex items-center gap-1"
          title={`View on Stacks Explorer: ${txHash}`}
        >
          {short}
          <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
          </svg>
        </a>
      )}
    </div>
  );
}
