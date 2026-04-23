# BlockLand Zimbabwe — Blockchain Integration Guide

**File:** `docs/blockchain-integration-guide.md`
**Module:** Documentation — Blockchain Layer ↔ NestJS Backend Integration
**Relates to:** `contracts/blockland.clar`, `src/modules/blockchain/blockchain.service.ts` (P2)

This guide explains exactly how the NestJS **BlockchainService** communicates with the
`blockland.clar` smart contract using the `@stacks/transactions` SDK.

---

## Architecture Summary

```
NestJS Service Layer
│
├── callReadOnlyFunction()  ── Free, instant, no TX needed ──► get-property-info
│                                                               verify-owner
│                                                               is-registrar
│                                                               get-transfer-request
│                                                               is-disputed
│                                                               get-ownership-history-*
│
└── makeContractCall()      ── Requires signing + broadcast ──► register-property
    broadcastTransaction()                                       initiate-transfer
    pollForConfirmation()                                        buyer-approve-transfer
                                                                 registrar-finalize-transfer
                                                                 cancel-transfer
                                                                 flag-dispute
                                                                 resolve-dispute
                                                                 initialize-registrar
                                                                 remove-registrar
```

---

## 1. Environment Variables Required

```env
# The Stacks node RPC endpoint — testnet or local devnet
STACKS_API_URL=https://api.testnet.hiro.so

# The network identifier: "testnet" | "mainnet" | "devnet"
STACKS_NETWORK=testnet

# The Stacks address of the contract deployer
CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM

# The contract name (matches Clarinet.toml [contracts.<n>] key)
CONTRACT_NAME=blockland

# The deployer's private key — used to sign initialize-registrar / remove-registrar
# NEVER commit this. Load from Vault, AWS Secrets Manager, or environment only.
DEPLOYER_PRIVATE_KEY=your-private-key-hex-here

# Registrar private key — used by the NestJS server to sign registrar actions
# In production, the registrar signs from their own wallet (not the server).
# For dissertation demo: server holds a single registrar key for simplicity.
REGISTRAR_PRIVATE_KEY=your-registrar-private-key-hex-here
```

---

## 2. Calling a Read-Only Function

Read-only functions are FREE — no transaction, no fee, no block confirmation needed.
Use `callReadOnlyFunction()` from `@stacks/transactions`.

### Example: `get-property-info`

```typescript
import {
  callReadOnlyFunction,
  uintCV,
  cvToJSON,
  StacksTestnet,
} from '@stacks/transactions';

/**
 * Retrieves on-chain property data for a given property ID.
 * Called by PropertyService before returning property details to the frontend.
 *
 * @param propertyId - The uint property ID (must match PostgreSQL properties.id)
 * @returns The Clarity tuple as a JavaScript object, or throws on not-found
 */
async function getPropertyInfo(propertyId: number) {
  const network = new StacksTestnet({ url: process.env.STACKS_API_URL });

  const result = await callReadOnlyFunction({
    network,
    contractAddress: process.env.CONTRACT_ADDRESS,
    contractName: process.env.CONTRACT_NAME,
    functionName: 'get-property-info',
    functionArgs: [
      uintCV(propertyId), // Converts JS number → Clarity uint value
    ],
    senderAddress: process.env.CONTRACT_ADDRESS, // Read-only: any principal works here
  });

  // cvToJSON converts the Clarity response value to a plain JS object.
  // For (ok { owner: principal, status: string-ascii, ... }) this returns:
  // { success: true, value: { owner: { type: 'principal', value: 'ST...' }, status: { ... } } }
  const json = cvToJSON(result);

  if (!json.success) {
    // The contract returned (err u103) — property not found
    throw new NotFoundException(`Property ${propertyId} not found on-chain`);
  }

  return json.value;
}
```

### Example: `verify-owner`

```typescript
import { callReadOnlyFunction, uintCV, standardPrincipalCV, cvToJSON } from '@stacks/transactions';

/**
 * Verifies whether a given principal is the current on-chain owner of a property.
 *
 * @param propertyId   - The property to check
 * @param claimedOwner - The Stacks address claiming ownership
 * @returns true if the claimed owner is the real on-chain owner
 */
async function verifyOwner(propertyId: number, claimedOwner: string): Promise<boolean> {
  const network = new StacksTestnet({ url: process.env.STACKS_API_URL });

  const result = await callReadOnlyFunction({
    network,
    contractAddress: process.env.CONTRACT_ADDRESS,
    contractName: process.env.CONTRACT_NAME,
    functionName: 'verify-owner',
    functionArgs: [
      uintCV(propertyId),
      standardPrincipalCV(claimedOwner), // Converts 'ST...' Stacks address → Clarity principal
    ],
    senderAddress: process.env.CONTRACT_ADDRESS,
  });

  const json = cvToJSON(result);
  // json.value will be true or false (Clarity bool wrapped in ok)
  return json.success && json.value === true;
}
```

---

## 3. Calling a State-Changing Public Function

Public functions require a signed transaction broadcast to the Stacks network.
There are three steps: **build → broadcast → poll**.

### Step 1: Build the Transaction

```typescript
import {
  makeContractCall,
  uintCV,
  standardPrincipalCV,
  bufferCV,
  noneCV,
  someCV,
  AnchorMode,
  PostConditionMode,
  StacksTestnet,
} from '@stacks/transactions';

/**
 * Builds a signed transaction to call register-property on the blockland contract.
 *
 * @param propertyId    - uint ID from PostgreSQL
 * @param ownerAddress  - Stacks address of the property owner
 * @param titleDeedHash - Buffer (32 bytes) — SHA-256 of the physical title deed
 * @param ipfsDocHash   - Optional buffer (32 bytes) — IPFS document hash or null
 * @param signerKey     - Private key of the authorized registrar signing this TX
 */
async function buildRegisterPropertyTx(
  propertyId: number,
  ownerAddress: string,
  titleDeedHash: Buffer,     // Must be exactly 32 bytes — SHA-256 output
  ipfsDocHash: Buffer | null,
  signerKey: string,         // Hex private key of the registrar
) {
  const network = new StacksTestnet({ url: process.env.STACKS_API_URL });

  // Convert the 32-byte Buffer to a Clarity (buff 32) value
  const titleDeedClarityBuff = bufferCV(titleDeedHash);

  // Clarity optional: if ipfsDocHash is provided, wrap it in someCV(); else noneCV()
  const ipfsOptional = ipfsDocHash
    ? someCV(bufferCV(ipfsDocHash))  // (some (buff 32))
    : noneCV();                       // none

  const tx = await makeContractCall({
    network,
    contractAddress: process.env.CONTRACT_ADDRESS,
    contractName: process.env.CONTRACT_NAME,
    functionName: 'register-property',
    functionArgs: [
      uintCV(propertyId),               // (property-id uint)
      standardPrincipalCV(ownerAddress), // (owner principal)
      titleDeedClarityBuff,              // (title-deed-hash (buff 32))
      ipfsOptional,                      // (ipfs-doc-hash (optional (buff 32)))
    ],
    senderKey: signerKey,
    // AnchorMode.Any: the transaction can be included in a microblock or anchor block.
    // For a dissertation demo, this is fine. Production should prefer AnchorMode.OnChainOnly.
    anchorMode: AnchorMode.Any,
    // PostConditionMode.Allow: we are not using STX post-conditions in this contract.
    // No STX or tokens are transferred in register-property.
    postConditionMode: PostConditionMode.Allow,
  });

  return tx;
}
```

### Step 2: Broadcast the Transaction

```typescript
import { broadcastTransaction } from '@stacks/transactions';

/**
 * Broadcasts a signed transaction to the Stacks testnet.
 * Returns the transaction ID (txid) to store in PostgreSQL as blockchain_tx_hash.
 *
 * @param tx - The signed StacksTransaction object from makeContractCall()
 * @returns txid — the hex string transaction ID
 */
async function broadcastTx(tx: StacksTransaction): Promise<string> {
  const network = new StacksTestnet({ url: process.env.STACKS_API_URL });

  const broadcastResponse = await broadcastTransaction(tx, network);

  // broadcastResponse.txid is the transaction hash — store this in PostgreSQL
  if ('error' in broadcastResponse) {
    // The node rejected the transaction (e.g., insufficient funds, bad nonce)
    // This is a network-level rejection, NOT a contract-level abort
    throw new Error(`Broadcast failed: ${broadcastResponse.error}`);
  }

  return broadcastResponse.txid; // e.g. "0xabc123..."
}
```

### Step 3: Poll for Confirmation

```typescript
/**
 * Polls the Stacks API until a transaction is confirmed (success or abort).
 *
 * IMPORTANT: Stacks transactions are NOT instant. On testnet, a block is mined
 * roughly every 10 minutes. The NestJS backend should:
 *   1. Immediately save the txid and set DB status to 'PENDING'
 *   2. Return the txid to the frontend (so the user can see it's processing)
 *   3. Poll in the background (or use a queue job) until confirmed
 *   4. Update the DB record to 'CONFIRMED' or 'FAILED' based on result
 *
 * @param txid    - The transaction ID returned from broadcastTransaction()
 * @param maxWait - Maximum time to wait in milliseconds (default: 20 minutes)
 * @returns 'success' | 'abort_by_response' | 'abort_by_post_condition'
 */
async function pollForConfirmation(
  txid: string,
  maxWait = 20 * 60 * 1000 // 20 minutes
): Promise<string> {
  const apiUrl = process.env.STACKS_API_URL;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    // Query the Stacks blockchain API for this transaction's status
    const response = await fetch(`${apiUrl}/extended/v1/tx/${txid}`);
    const data = await response.json();

    if (data.tx_status === 'success') {
      // Transaction was included in a block and the contract executed without error
      return 'success';
    }

    if (data.tx_status === 'abort_by_response') {
      // The transaction was included in a block BUT the contract returned an (err ...).
      // This means an (asserts!) check failed. The state was NOT changed.
      // The backend must roll back any DB changes it made optimistically.
      const errorCode = data.tx_result?.repr;
      throw new Error(`Contract aborted on-chain: ${errorCode}`);
    }

    if (data.tx_status === 'abort_by_post_condition') {
      // Post-condition check failed — not expected in this contract (no post-conditions)
      throw new Error('Transaction aborted by post-condition');
    }

    // tx_status is 'pending' or 'microblock_success' — keep waiting
    await new Promise(resolve => setTimeout(resolve, 10_000)); // Wait 10 seconds before retry
  }

  throw new Error(`Transaction ${txid} timed out after ${maxWait}ms`);
}
```

---

## 4. Clarity Value Type Mapping

| TypeScript / JS Type | Clarity Type       | Constructor Function           |
|----------------------|--------------------|--------------------------------|
| `number`             | `uint`             | `uintCV(n)`                    |
| `string` (address)   | `principal`        | `standardPrincipalCV(addr)`    |
| `Buffer` (32 bytes)  | `(buff 32)`        | `bufferCV(buffer)`             |
| `null`               | `none`             | `noneCV()`                     |
| `Buffer \| null`     | `(optional (buff 32))` | `ipfsHash ? someCV(bufferCV(ipfsHash)) : noneCV()` |
| `boolean`            | `bool`             | `trueCV()` / `falseCV()`       |

---

## 5. Reading Results Back from Clarity

```typescript
import { cvToJSON, ClarityType } from '@stacks/transactions';

// After callReadOnlyFunction() returns a ClarityValue:
const json = cvToJSON(result);

// For a (response ok err) type:
// json.success === true  → the contract returned (ok value)
// json.success === false → the contract returned (err uint)
// json.value  → the inner value (either ok-value or err-code)

// For a (ok { owner: principal, status: string-ascii }) tuple:
// json.value.owner.value  → "ST1PQHQ..."   (the Stacks address string)
// json.value.status.value → "active"        (the status string)
// json.value.registered-at.value → "123"   (block height as decimal string)

// For (optional { owner: principal, acquired-at: uint }):
// json.value === null                     → none (no entry at this seq)
// json.value.owner.value → "ST1..."       → some value was present
```

---

## 6. Error Code Handling in NestJS

```typescript
/**
 * Maps a Clarity contract error code (uint) to a human-readable message.
 * Used by BlockchainService to translate on-chain errors into HTTP responses.
 */
const CLARITY_ERROR_MAP: Record<number, string> = {
  100: 'Not authorized — only the contract owner can perform this action',
  101: 'Not a registrar — your wallet is not authorized as a Land Registrar',
  102: 'Property already exists — this property ID is already registered on-chain',
  103: 'Property not found — no on-chain record for this property ID',
  104: 'Title deed already registered — this deed hash is linked to another property',
  105: 'Not the owner — you do not own this property on-chain',
  106: 'Transfer already pending — this property has an active transfer in progress',
  107: 'Transfer not found — no pending transfer exists for this property',
  108: 'Buyer approval required — the buyer has not yet approved this transfer',
  109: 'Registrar approval required',
  110: 'Property disputed — transfers are blocked while this property is under dispute',
  111: 'Dispute not found',
  112: 'Invalid status — the property is not in the expected state for this operation',
  113: 'Invalid buyer — you cannot transfer a property to yourself',
};

function handleClarityError(errorCode: number): never {
  const message = CLARITY_ERROR_MAP[errorCode] ?? `Unknown contract error: u${errorCode}`;
  throw new BadRequestException(message);
}
```

---

## 7. Complete Flow: Register Property

```
1. Registrar submits form on frontend (Next.js)
2. POST /api/properties → NestJS PropertyController
3. PropertyService.create():
   a. Validate DTO (class-validator)
   b. Check registrar role (JwtAuthGuard + RolesGuard)
   c. Hash title deed file → SHA-256 → Buffer (32 bytes)
   d. Upload document to IPFS → get CID → hash CID → Buffer (32 bytes)
   e. INSERT into PostgreSQL (status = PENDING, blockchain_tx_hash = null)
   f. Call BlockchainService.registerProperty(dbRecord.id, owner, deedHash, ipfsHash)
      - buildRegisterPropertyTx()
      - broadcastTransaction() → txid
      - UPDATE properties SET blockchain_tx_hash = txid WHERE id = dbRecord.id
   g. Return { propertyId: dbRecord.id, txid } to frontend (202 Accepted)
4. Background job polls for confirmation:
   - pollForConfirmation(txid)
   - On 'success': UPDATE properties SET status = ACTIVE, token_id = propertyId WHERE id = dbRecord.id
   - On abort: UPDATE properties SET status = FAILED; notify registrar
```

---

## 8. Implementation Order Recommendation

Build and test in this order to avoid integration bottlenecks:

1. **`blockland.clar`** (complete — this file)
2. **`clarinet check`** — verify contract compiles
3. **`npm test`** — run the full test suite
4. **Deploy to Clarinet devnet** — `clarinet deploy --network devnet`
5. **Implement `BlockchainModule` in NestJS** (P2) — `BlockchainService` wraps all calls
6. **Integrate `BlockchainService` into `PropertyService`** — call after DB insert
7. **Integrate into `TransferService`** — call for each transfer step
8. **Deploy contract to Stacks Testnet** (P10) — `clarinet deploy --network testnet`
9. **Run end-to-end tests with frontend wallet** (P9) — test the full user flow

---

*This guide is part of the BlockLand Zimbabwe dissertation project (P4 output).*
*Cross-referenced with: P2 (NestJS Backend), P3 (PostgreSQL Schema), P5 (API docs).*
