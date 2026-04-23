// =============================================================================
// src/lib/stacks/index.ts — Stacks Blockchain Wallet Integration
// =============================================================================
//
// PURPOSE: Configures and wraps @stacks/connect for BlockLand's wallet features.
//
// WHAT @stacks/connect DOES:
//   - Opens the Hiro Wallet browser extension (or web wallet on mobile)
//   - Lets users sign Stacks transactions from the frontend
//   - Returns the user's Stacks principal (wallet address) after connection
//
// BLOCKLAND WALLET FLOW:
//   1. User clicks "Connect Wallet" button
//   2. showConnect() opens the Hiro Wallet popup
//   3. On success: user.profile.stxAddress.testnet → stored via PATCH /users/me/wallet
//   4. On subsequent logins: wallet address is in user.walletAddress from JWT
//
// TRANSACTION SIGNING FROM FRONTEND (future enhancement):
//   For the dissertation, blockchain transactions are signed SERVER-SIDE by the
//   NestJS backend using the registrar's private key. The frontend calls the API
//   which calls the Clarity contract.
//
//   The full production pattern (buyer signs initiate-transfer from their wallet)
//   would use openContractCall() from @stacks/connect. This is documented here
//   as a forward-looking integration point.
//
// STACKS EXPLORER:
//   Every blockchain transaction hash shown in the UI links to the Stacks Explorer
//   at https://explorer.hiro.so/txid/{txid}?chain=testnet
// =============================================================================

import {
  AppConfig,
  UserSession,
  showConnect,
  openContractCall,
} from '@stacks/connect';
import {
  uintCV,
  standardPrincipalCV,
  makeContractCall,
  AnchorMode,
  PostConditionMode,
  StacksTestnet,
} from '@stacks/transactions';

// ---------------------------------------------------------------------------
// NETWORK CONFIGURATION
// ---------------------------------------------------------------------------

const NETWORK_NAME = (process.env.NEXT_PUBLIC_STACKS_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '';
const CONTRACT_NAME    = process.env.NEXT_PUBLIC_CONTRACT_NAME ?? 'blockland';
const STACKS_EXPLORER  = process.env.NEXT_PUBLIC_STACKS_EXPLORER ?? 'https://explorer.hiro.so';

// ---------------------------------------------------------------------------
// USER SESSION
// ---------------------------------------------------------------------------

/**
 * appConfig — the @stacks/connect app configuration.
 * scopes: ['store_write', 'publish_data'] are standard for dApps.
 */
const appConfig = new AppConfig(['store_write', 'publish_data']);

/**
 * userSession — manages Stacks authentication state.
 * Stores the user's Gaia storage hub URL and profile data.
 */
export const userSession = new UserSession({ appConfig });

// ---------------------------------------------------------------------------
// WALLET CONNECTION
// ---------------------------------------------------------------------------

/**
 * connectWallet — opens the Hiro Wallet popup for wallet connection.
 *
 * @param onSuccess — called with the user's Stacks address after connection
 * @param onCancel  — called if the user closes the wallet without connecting
 *
 * USAGE:
 *   connectWallet({
 *     onSuccess: (address) => {
 *       patchWallet(address); // PATCH /users/me/wallet
 *     },
 *     onCancel: () => toast.error('Wallet connection cancelled'),
 *   });
 */
export function connectWallet(options: {
  onSuccess: (address: string) => void;
  onCancel?: () => void;
}): void {
  showConnect({
    appDetails: {
      name: 'BlockLand Zimbabwe',
      icon: `${window.location.origin}/logo.png`,
    },
    userSession,
    redirectTo: '/',
    onFinish: (data) => {
      // Extract the Stacks address for the current network
      const address = NETWORK_NAME === 'mainnet'
        ? data.userSession.loadUserData().profile.stxAddress.mainnet
        : data.userSession.loadUserData().profile.stxAddress.testnet;

      options.onSuccess(address);
    },
    onCancel: options.onCancel,
  });
}

/**
 * disconnectWallet — signs out of the Hiro Wallet session.
 * This does NOT clear the BlockLand JWT session — only the Stacks wallet.
 */
export function disconnectWallet(): void {
  if (userSession.isUserSignedIn()) {
    userSession.signUserOut();
  }
}

/**
 * getConnectedWalletAddress — returns the Stacks address if wallet is connected.
 * Returns null if no wallet is connected.
 */
export function getConnectedWalletAddress(): string | null {
  if (!userSession.isUserSignedIn()) return null;
  const userData = userSession.loadUserData();
  return NETWORK_NAME === 'mainnet'
    ? userData.profile.stxAddress.mainnet
    : userData.profile.stxAddress.testnet;
}

// ---------------------------------------------------------------------------
// STACKS EXPLORER HELPERS
// ---------------------------------------------------------------------------

/**
 * txExplorerUrl — returns the Stacks Explorer URL for a given transaction ID.
 * Used for "View on Explorer" links in the TX receipt modal and activity log.
 *
 * @param txid — the Stacks transaction hash (hex string, e.g. "0xabc123...")
 */
export function txExplorerUrl(txid: string): string {
  return `${STACKS_EXPLORER}/txid/${txid}?chain=${NETWORK_NAME}`;
}

/**
 * addressExplorerUrl — returns the Stacks Explorer URL for a wallet address.
 * Used for "View on Explorer" links next to wallet addresses.
 *
 * @param address — the Stacks principal (e.g. "ST1PQHQKV0...")
 */
export function addressExplorerUrl(address: string): string {
  return `${STACKS_EXPLORER}/address/${address}?chain=${NETWORK_NAME}`;
}

/**
 * formatTxHash — shortens a tx hash for display (first 8 + last 8 chars).
 * Example: "0xabc123...def456"
 *
 * @param txid    — full tx hash
 * @param chars   — characters to show on each end (default 8)
 */
export function formatTxHash(txid: string, chars = 8): string {
  if (!txid || txid.length <= chars * 2) return txid;
  const clean = txid.startsWith('0x') ? txid.slice(2) : txid;
  return `0x${clean.slice(0, chars)}...${clean.slice(-chars)}`;
}

/**
 * formatWalletAddress — shortens a Stacks principal for display.
 * Example: "ST1PQ...PGZGM"
 *
 * @param address — full Stacks address
 * @param chars   — characters to show on each end (default 5)
 */
export function formatWalletAddress(address: string, chars = 5): string {
  if (!address || address.length <= chars * 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// FORWARD-LOOKING: CLIENT-SIDE CONTRACT CALLS
// ---------------------------------------------------------------------------
// The dissertation backend signs all Clarity contract calls server-side.
// The pattern below documents how a buyer would sign `buyer-approve-transfer`
// directly from their own wallet in a full production deployment.
//
// NOT USED in the dissertation demo — provided for academic completeness.

/**
 * signBuyerApproveTransfer — opens the Hiro Wallet for the buyer to sign
 * the buyer-approve-transfer Clarity call directly from their wallet.
 *
 * @param propertyId — the uint on-chain property ID (token_id)
 * @param onSuccess  — called with the broadcast txid on success
 *
 * CLARITY FUNCTION CALLED: (buyer-approve-transfer property-id)
 */
export async function signBuyerApproveTransfer(
  propertyId: number,
  onSuccess: (txid: string) => void,
  onCancel?: () => void,
): Promise<void> {
  await openContractCall({
    network:         NETWORK_NAME === 'mainnet' ? undefined : new StacksTestnet(),
    contractAddress: CONTRACT_ADDRESS,
    contractName:    CONTRACT_NAME,
    functionName:    'buyer-approve-transfer',
    functionArgs:    [uintCV(propertyId)],
    anchorMode:      AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    appDetails: {
      name: 'BlockLand Zimbabwe',
      icon: `${window.location.origin}/logo.png`,
    },
    userSession,
    onFinish: (data) => onSuccess(data.txId),
    onCancel,
  });
}

// Export network info for use in UI components
export { NETWORK_NAME, CONTRACT_ADDRESS, CONTRACT_NAME, STACKS_EXPLORER };
