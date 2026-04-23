'use client';

import { useEffect, useState } from 'react';
import { useParams }   from 'next/navigation';
import Link            from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { propertyService, ownershipService } from '@/lib/api/services';
import { StatusBadge, TxHashDisplay }        from '@/components/shared/status-badge';
import { ROUTES }      from '@/lib/navigation';
import type { Property } from '@/types';

const NETWORK = process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet';

export default function PropertyDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    propertyService.getById(id).then(setProperty).finally(() => setLoading(false));
  }, [id]);

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
        <Link href={ROUTES.PROPERTIES} className="btn-ghost">← Back to Properties</Link>
      </div>
    );
  }

  const fields = [
    { label: 'Plot Number',       value: property.plotNumber,       mono: true },
    { label: 'Title Deed Number', value: property.titleDeedNumber,  mono: true },
    { label: 'Address',           value: property.address },
    { label: 'Land Size',         value: `${property.landSize} ${property.unit}` },
    { label: 'Zoning Type',       value: property.zoningType },
    { label: 'Registration Date', value: new Date(property.registrationDate).toLocaleDateString() },
    { label: 'Registered Owner',  value: property.currentOwner?.fullName ?? '—' },
    { label: 'Token ID',          value: property.tokenId, mono: true },
    { label: 'IPFS Hash',         value: property.ipfsHash, mono: true },
  ];

  return (
    <div className="max-w-2xl space-y-6">
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
      </div>

      {/* Blockchain info */}
      <div className="card space-y-4">
        <p className="form-section">Blockchain Record</p>
        <TxHashDisplay txHash={property.blockchainTxHash} network={NETWORK as 'testnet' | 'mainnet'} label="Registration TX" />
        {property.onChainState && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">On-Chain Owner</p>
              <p className="font-mono text-xs text-slate-700 break-all">{property.onChainState.owner}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs font-medium uppercase tracking-wider mb-0.5">On-Chain Status</p>
              <p className="text-sm text-slate-700">{property.onChainState.status}</p>
            </div>
          </div>
        )}
        <a
          href={`https://gateway.pinata.cloud/ipfs/${property.ipfsHash}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          View Title Deed on IPFS <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="flex gap-3">
        <Link href={ROUTES.OWNERSHIP(property.id)} className="btn-secondary text-sm">
          View Ownership History
        </Link>
        <Link href={ROUTES.NEW_TRANSFER} className="btn-ghost text-sm">
          Initiate Transfer
        </Link>
      </div>
    </div>
  );
}
