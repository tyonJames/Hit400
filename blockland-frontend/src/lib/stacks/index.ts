// =============================================================================
// src/lib/stacks/index.ts — Stacks Blockchain Wallet Integration
// =============================================================================

import {
  AppConfig,
  UserSession,
  showConnect,
  openContractCall,
  isStacksWalletInstalled,
} from '@stacks/connect';
import {
  uintCV,
  AnchorMode,
  PostConditionMode,
} from '@stacks/transactions';
import { STACKS_TESTNET } from '@stacks/network';

const NETWORK_NAME     = (process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '';
const CONTRACT_NAME    = process.env.NEXT_PUBLIC_CONTRACT_NAME ?? 'blockland';
const STACKS_EXPLORER  = process.env.NEXT_PUBLIC_STACKS_EXPLORER ?? 'https://explorer.hiro.so';

// Lazy singleton — UserSession reads localStorage on construction which
// throws during Next.js SSR. Only created on first browser-side call.
let _session: UserSession | null = null;
function getSession(): UserSession {
  if (!_session) {
    const appConfig = new AppConfig(['store_write', 'publish_data']);
    _session = new UserSession({ appConfig });
  }
  return _session;
}

export function isWalletInstalled(): boolean {
  return typeof window !== 'undefined' && isStacksWalletInstalled();
}

export function connectWallet(options: {
  onSuccess:       (address: string) => void;
  onCancel?:       () => void;
  onNotInstalled?: () => void;
}): void {
  if (!isWalletInstalled()) {
    options.onNotInstalled?.();
    return;
  }
  showConnect({
    appDetails: {
      name: 'BlockLand Zimbabwe',
      icon: `${window.location.origin}/logo.png`,
    },
    userSession: getSession(),
    redirectTo: '/',
    onFinish: (data) => {
      const addr = NETWORK_NAME === 'mainnet'
        ? data.userSession.loadUserData().profile.stxAddress.mainnet
        : data.userSession.loadUserData().profile.stxAddress.testnet;
      options.onSuccess(addr);
    },
    onCancel: options.onCancel,
  });
}

export function disconnectWallet(): void {
  const s = getSession();
  if (s.isUserSignedIn()) s.signUserOut();
}

export function getConnectedWalletAddress(): string | null {
  const s = getSession();
  if (!s.isUserSignedIn()) return null;
  const data = s.loadUserData();
  return NETWORK_NAME === 'mainnet'
    ? data.profile.stxAddress.mainnet
    : data.profile.stxAddress.testnet;
}

export function txExplorerUrl(txid: string): string {
  return `${STACKS_EXPLORER}/txid/${txid}?chain=${NETWORK_NAME}`;
}

export function addressExplorerUrl(address: string): string {
  return `${STACKS_EXPLORER}/address/${address}?chain=${NETWORK_NAME}`;
}

export function formatTxHash(txid: string, chars = 8): string {
  if (!txid || txid.length <= chars * 2) return txid;
  const clean = txid.startsWith('0x') ? txid.slice(2) : txid;
  return `0x${clean.slice(0, chars)}...${clean.slice(-chars)}`;
}

export function formatWalletAddress(address: string, chars = 5): string {
  if (!address || address.length <= chars * 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export async function signBuyerApproveTransfer(
  propertyId: number,
  onSuccess: (txid: string) => void,
  onCancel?: () => void,
): Promise<void> {
  await openContractCall({
    network:           NETWORK_NAME === 'mainnet' ? undefined : STACKS_TESTNET,
    contractAddress:   CONTRACT_ADDRESS,
    contractName:      CONTRACT_NAME,
    functionName:      'buyer-approve-transfer',
    functionArgs:      [uintCV(propertyId)],
    anchorMode:        AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    appDetails: {
      name: 'BlockLand Zimbabwe',
      icon: `${window.location.origin}/logo.png`,
    },
    userSession: getSession(),
    onFinish: (data) => onSuccess(data.txId),
    onCancel,
  });
}

export { NETWORK_NAME, CONTRACT_ADDRESS, CONTRACT_NAME, STACKS_EXPLORER };
