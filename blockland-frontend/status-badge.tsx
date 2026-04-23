// =============================================================================
// src/components/shared/status-badge.tsx — BlockLand Status Badge Component
// =============================================================================
//
// PURPOSE: Renders coloured status badges for all entity states in the system.
//          Consistent across all tables, cards, and detail pages.
//
// DESIGN:
//   Badges use the status color palette defined in tailwind.config.ts.
//   The animation class 'animate-badge-pop' gives a subtle entrance effect.
//   On-chain verification badges include a teal blockchain indicator dot.
// =============================================================================

import type {
  PropertyStatus, TransferStatus, DisputeStatus,
  VerificationStatus, BlockchainTxState,
} from '@/types';

// ---------------------------------------------------------------------------
// TYPE UNION — all status values across the system
// ---------------------------------------------------------------------------

type AnyStatus =
  | PropertyStatus
  | TransferStatus
  | DisputeStatus
  | VerificationStatus
  | BlockchainTxState['status']
  | 'ACTIVE_PENDING'; // Alias for blockchain-pending display

// ---------------------------------------------------------------------------
// STATUS → DISPLAY CONFIG MAPPING
// ---------------------------------------------------------------------------

interface BadgeConfig {
  label:     string;
  className: string; // Tailwind classes for background, text, and border
  dot?:      string; // Optional dot color class for blockchain states
}

const STATUS_CONFIG: Record<string, BadgeConfig> = {
  // Property statuses
  ACTIVE:           { label: 'Active',           className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  PENDING_TRANSFER: { label: 'Pending Transfer',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  DISPUTED:         { label: 'Disputed',          className: 'bg-red-50 text-red-700 border-red-200' },
  INACTIVE:         { label: 'Inactive',          className: 'bg-slate-100 text-slate-500 border-slate-200' },

  // Transfer statuses
  PENDING_BUYER:     { label: 'Awaiting Buyer',     className: 'bg-blue-50 text-blue-700 border-blue-200' },
  PENDING_REGISTRAR: { label: 'Awaiting Registrar', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  CONFIRMED:         { label: 'Confirmed',          className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED:         { label: 'Cancelled',          className: 'bg-slate-100 text-slate-500 border-slate-200' },

  // Dispute statuses
  OPEN:         { label: 'Open',         className: 'bg-red-50 text-red-700 border-red-200' },
  UNDER_REVIEW: { label: 'Under Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  RESOLVED:     { label: 'Resolved',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  DISMISSED:    { label: 'Dismissed',    className: 'bg-slate-100 text-slate-500 border-slate-200' },

  // Verification statuses
  VERIFIED:  { label: 'Verified ✓',  className: 'bg-teal-50 text-teal-700 border-teal-200',  dot: 'bg-primary animate-chain-pulse' },
  MISMATCH:  { label: '⚠ Mismatch',  className: 'bg-red-50 text-red-700 border-red-200' },
  NOT_FOUND: { label: 'Not Found',   className: 'bg-slate-100 text-slate-500 border-slate-200' },

  // Blockchain tx states
  pending:   { label: 'Pending On-Chain', className: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-500 animate-chain-pulse' },
  confirmed: { label: 'On-Chain ✓',       className: 'bg-teal-50 text-teal-700 border-teal-200',      dot: 'bg-primary' },
  failed:    { label: 'TX Failed',        className: 'bg-red-50 text-red-700 border-red-200' },
};

// ---------------------------------------------------------------------------
// COMPONENT
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status:  AnyStatus;
  size?:   'sm' | 'md' | 'lg';
  showDot?: boolean;  // Whether to show the blockchain indicator dot
  animate?: boolean;  // Whether to animate in on mount
}

export function StatusBadge({
  status,
  size    = 'md',
  showDot = true,
  animate = false,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label:     status,
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  }[size];

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 font-medium border rounded-badge',
        sizeClasses,
        config.className,
        animate ? 'animate-badge-pop' : '',
      ].filter(Boolean).join(' ')}
    >
      {/* Blockchain indicator dot — shown for states that have on-chain meaning */}
      {showDot && config.dot && (
        <span
          className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`}
          aria-hidden="true"
        />
      )}
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// BLOCKCHAIN TX HASH DISPLAY
// ---------------------------------------------------------------------------
// A compact display component for showing a truncated tx hash with a
// clickable "View on Explorer" link. Used in property cards, transfer
// receipts, and activity logs.

interface TxHashDisplayProps {
  txHash:  string;
  network?: 'testnet' | 'mainnet';
  label?:  string;
}

export function TxHashDisplay({
  txHash,
  network = 'testnet',
  label   = 'TX',
}: TxHashDisplayProps) {
  const explorerUrl = `https://explorer.hiro.so/txid/${txHash}?chain=${network}`;
  const short = txHash.length > 16
    ? `${txHash.slice(0, 8)}...${txHash.slice(-8)}`
    : txHash;

  return (
    <div className="flex items-center gap-2">
      <span className="text-label text-slate-500 uppercase tracking-widest">{label}</span>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-hash text-primary hover:text-primary-light
                   hover:underline transition-colors inline-flex items-center gap-1"
        title={`View on Stacks Explorer: ${txHash}`}
      >
        {short}
        {/* External link indicator */}
        <svg
          className="w-3 h-3 opacity-60"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
        </svg>
      </a>
    </div>
  );
}
