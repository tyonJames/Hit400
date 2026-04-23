// =============================================================================
// tests/blockland.test.ts
// BlockLand Zimbabwe — Clarinet v2 / Vitest Smart Contract Test Suite
// =============================================================================
//
// MODULE:  Smart Contract Testing
// PURPOSE: Verifies all public functions in contracts/blockland.clar behave
//          correctly under both happy-path and error-path scenarios.
//
// TEST FRAMEWORK: Clarinet v2 simnet + Vitest
//   - initSimnet() loads the contract into a simulated Stacks network (WASM)
//   - simnet.callPublicFn()   — calls state-changing public functions
//   - simnet.callReadOnlyFn() — calls read-only functions (no fee, instant)
//   - simnet.mineEmptyBlock() — advances the simnet block height
//   - Cl.*                   — Clarity value constructors from @stacks/transactions
//
// HOW TO RUN:
//   npm test              — runs all tests once (CI mode)
//   npm run test:watch    — re-runs on file change (dev mode)
//
// ACCOUNT ROLES IN TESTS:
//   deployer → contract owner (calls initialize-registrar, remove-registrar)
//   wallet_1 → authorized land registrar
//   wallet_2 → property owner / seller
//   wallet_3 → buyer / new owner
//   wallet_4 → unauthorized user (negative test cases)
//
// BLOCK COMMENT ON ERROR CODES:
//   ERR-NOT-AUTHORIZED     u100   wallet is not the contract-owner
//   ERR-NOT-REGISTRAR      u101   wallet is not an authorized registrar
//   ERR-PROPERTY-EXISTS    u102   property-id already registered
//   ERR-PROPERTY-NOT-FOUND u103   property-id not in registry
//   ERR-TITLE-DEED-EXISTS  u104   title deed hash already used
//   ERR-NOT-OWNER          u105   wallet is not the current property owner
//   ERR-TRANSFER-PENDING   u106   a transfer is already in progress
//   ERR-TRANSFER-NOT-FOUND u107   no pending transfer for this property
//   ERR-BUYER-NOT-APPROVED u108   buyer hasn't approved the transfer yet
//   ERR-PROPERTY-DISPUTED  u110   property is under dispute — transfer blocked
//   ERR-INVALID-STATUS     u112   property is not in expected status
//   ERR-INVALID-BUYER      u113   buyer is the same principal as the seller
// =============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { initSimnet } from "@hirosystems/clarinet-sdk";
import { Cl, ClarityType } from "@stacks/transactions";

// =============================================================================
// SIMNET INITIALIZATION
// =============================================================================
//
// initSimnet() loads Clarinet.toml and spins up a local WASM-based Stacks node.
// It reads the contracts/ directory and deploys all registered contracts.
// Top-level await is valid because package.json has "type": "module".
//
// This is done ONCE per test file. Each describe block resets relevant state
// manually using beforeEach where needed.

const simnet = await initSimnet();
const accounts = simnet.getAccounts();

// Destructure the test accounts defined in settings/Devnet.toml
const deployer = accounts.get("deployer")!;  // Contract owner — manages registrars
const wallet1 = accounts.get("wallet_1")!;  // Land registrar (will be authorized)
const wallet2 = accounts.get("wallet_2")!;  // Property owner / seller
const wallet3 = accounts.get("wallet_3")!;  // Buyer / new owner
const wallet4 = accounts.get("wallet_4")!;  // Unauthorized user (negative tests)

// The contract name must match the key in Clarinet.toml [contracts.<name>]
const CONTRACT_NAME = "blockland";

// =============================================================================
// TEST DATA HELPERS
// =============================================================================
//
// Clarity buffers must be exactly 32 bytes (buff 32 = SHA-256 hash size).
// In real usage, these would be actual SHA-256 hashes of document content.
// In tests we use distinct fill values to simulate different documents.

/** Creates a 32-byte buffer filled with a given byte value — simulates a SHA-256 hash */
function makeHash(fill: number): Uint8Array {
  return new Uint8Array(32).fill(fill);
}

// Pre-defined test hashes — each represents a unique title deed document
const DEED_HASH_1 = makeHash(0x01); // Title deed hash for property 1
const DEED_HASH_2 = makeHash(0x02); // Title deed hash for property 2
const DEED_HASH_3 = makeHash(0x03); // Title deed hash for property 3
const IPFS_HASH_1 = makeHash(0xaa); // IPFS document hash for property 1

// Property IDs — these mirror the PostgreSQL properties.id values
const PROPERTY_ID_1 = 1;
const PROPERTY_ID_2 = 2;
const PROPERTY_ID_3 = 3;


// =============================================================================
// HELPER: registerProperty
// =============================================================================
// Convenience wrapper to register a property in tests without boilerplate.
// Returns the raw simnet call result for assertion in the calling test.
function registerProperty(
  propertyId: number,
  owner: string,
  deedHash: Uint8Array,
  ipfsHash: Uint8Array | null = null,
  caller: string = wallet1
) {
  return simnet.callPublicFn(
    CONTRACT_NAME,
    "register-property",
    [
      Cl.uint(propertyId),
      Cl.principal(owner),
      Cl.buffer(deedHash),
      ipfsHash ? Cl.some(Cl.buffer(ipfsHash)) : Cl.none(),
    ],
    caller
  );
}

// =============================================================================
// HELPER: initializeRegistrar
// =============================================================================
// Convenience wrapper to authorize wallet_1 as a registrar in tests.
function authorizeWallet1() {
  return simnet.callPublicFn(
    CONTRACT_NAME,
    "initialize-registrar",
    [Cl.principal(wallet1)],
    deployer
  );
}


// =============================================================================
// DESCRIBE: Registrar Management
// =============================================================================
// Tests for initialize-registrar, remove-registrar, and is-registrar.
// Covers: authorization, successful registration, revocation.
// =============================================================================

describe("Registrar Management", () => {

  // ---------------------------------------------------------------------------
  it("initialize-registrar called by contract-owner should succeed", () => {
    // Authorize wallet_1 as a registrar using the deployer (contract-owner).
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "initialize-registrar",
      [Cl.principal(wallet1)],
      deployer // tx-sender = deployer = contract-owner ✓
    );

    // Expect (ok true) — registration was successful
    expect(result.result).toEqual(Cl.ok(Cl.bool(true)));
  });

  // ---------------------------------------------------------------------------
  it("is-registrar should return true after initialize-registrar", () => {
    // First authorize wallet_1
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initialize-registrar",
      [Cl.principal(wallet1)],
      deployer
    );

    // Now call the read-only check — should confirm wallet_1 is a registrar
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "is-registrar",
      [Cl.principal(wallet1)],
      deployer // tx-sender for read-only calls — doesn't affect auth
    );

    // Expect (ok true) — wallet_1 is confirmed as an authorized registrar
    expect(result.result).toEqual(Cl.ok(Cl.bool(true)));
  });

  // ---------------------------------------------------------------------------
  it("initialize-registrar called by non-owner should fail with ERR-NOT-AUTHORIZED (u100)", () => {
    // wallet_4 is not the contract owner — this call should be rejected
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "initialize-registrar",
      [Cl.principal(wallet1)],
      wallet4 // tx-sender = wallet_4 ≠ contract-owner ✗
    );

    // Expect (err u100) — ERR-NOT-AUTHORIZED
    expect(result.result).toEqual(Cl.error(Cl.uint(100)));
  });

  // ---------------------------------------------------------------------------
  it("remove-registrar should revoke access — subsequent register-property should fail", () => {
    // Step 1: Authorize wallet_1 as registrar
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initialize-registrar",
      [Cl.principal(wallet1)],
      deployer
    );

    // Step 2: Verify wallet_1 can register a property (sanity check)
    const beforeRevoke = registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    expect(beforeRevoke.result).toEqual(Cl.ok(Cl.uint(PROPERTY_ID_1)));

    // Step 3: Revoke wallet_1's registrar status using the deployer
    const removeResult = simnet.callPublicFn(
      CONTRACT_NAME,
      "remove-registrar",
      [Cl.principal(wallet1)],
      deployer
    );
    expect(removeResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // Step 4: Verify wallet_1 is now rejected — no longer authorized
    const afterRevoke = registerProperty(PROPERTY_ID_2, wallet2, DEED_HASH_2);
    // Expect (err u101) — ERR-NOT-REGISTRAR (wallet_1 was revoked)
    expect(afterRevoke.result).toEqual(Cl.error(Cl.uint(101)));
  });

  // ---------------------------------------------------------------------------
  it("is-registrar should return false after remove-registrar", () => {
    // Authorize then revoke
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initialize-registrar",
      [Cl.principal(wallet1)],
      deployer
    );
    simnet.callPublicFn(
      CONTRACT_NAME,
      "remove-registrar",
      [Cl.principal(wallet1)],
      deployer
    );

    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "is-registrar",
      [Cl.principal(wallet1)],
      deployer
    );

    // Expect (ok false) — wallet_1 is no longer a registrar
    expect(result.result).toEqual(Cl.ok(Cl.bool(false)));
  });

  // ---------------------------------------------------------------------------
  it("is-registrar should return false for address that was never authorized", () => {
    // wallet_4 was never authorized — should return false without error
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "is-registrar",
      [Cl.principal(wallet4)],
      deployer
    );

    // Expect (ok false) — not in the authorized-registrars map at all
    expect(result.result).toEqual(Cl.ok(Cl.bool(false)));
  });

});


// =============================================================================
// DESCRIBE: Property Registration
// =============================================================================
// Tests for register-property and get-property-info.
// Covers: successful registration, duplicate detection, access control.
// =============================================================================

describe("Property Registration", () => {

  // Before each test: authorize wallet_1 as a registrar.
  // This ensures each test starts with a fresh but ready registrar.
  // Note: simnet state IS NOT reset between tests — each test builds on prior state.
  // Tests in this block are ordered intentionally to build on each other.

  it("register-property by authorized registrar should return (ok property-id)", () => {
    // Setup: authorize wallet_1 as registrar
    authorizeWallet1();

    // Register property 1 with wallet_2 as owner and no IPFS hash (none)
    const result = registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // Expect (ok u1) — the function returns the property-id on success
    expect(result.result).toEqual(Cl.ok(Cl.uint(PROPERTY_ID_1)));
  });

  // ---------------------------------------------------------------------------
  it("get-property-info should return correct owner and active status after registration", () => {
    // Note: wallet_1 was authorized and property 1 was registered in the previous test.
    // Simnet state persists — we call get-property-info to verify the stored data.
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-info",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );

    // The result should be (ok { owner: wallet2, ..., status: "active" })
    expect(result.result.type).toBe(ClarityType.ResponseOk);

    // Unwrap the (ok ...) to inspect the tuple fields
    if (result.result.type === ClarityType.ResponseOk) {
      const data = result.result.value;
      // Verify the owner is wallet_2 (the principal passed to register-property)
      expect(data).toMatchObject(
        Cl.tuple({
          owner: Cl.principal(wallet2),
          status: Cl.stringAscii("active"),
        })
      );
    }
  });

  // ---------------------------------------------------------------------------
  it("register-property with duplicate property-id should fail with ERR-PROPERTY-EXISTS (u102)", () => {
    // PROPERTY_ID_1 was already registered — attempting it again should be rejected
    const result = registerProperty(PROPERTY_ID_1, wallet3, DEED_HASH_2);

    // Expect (err u102) — ERR-PROPERTY-EXISTS
    expect(result.result).toEqual(Cl.error(Cl.uint(102)));
  });

  // ---------------------------------------------------------------------------
  it("register-property with duplicate title-deed-hash should fail with ERR-TITLE-DEED-EXISTS (u104)", () => {
    // DEED_HASH_1 was already used for PROPERTY_ID_1.
    // Trying to register a NEW property-id (2) with the SAME deed hash must fail.
    // This is the critical fraud prevention check — one deed cannot title two properties.
    const result = registerProperty(PROPERTY_ID_2, wallet3, DEED_HASH_1); // Same hash, different ID

    // Expect (err u104) — ERR-TITLE-DEED-EXISTS
    expect(result.result).toEqual(Cl.error(Cl.uint(104)));
  });

  // ---------------------------------------------------------------------------
  it("register-property by non-registrar should fail with ERR-NOT-REGISTRAR (u101)", () => {
    // wallet_4 is not an authorized registrar — should be rejected immediately
    const result = registerProperty(PROPERTY_ID_2, wallet3, DEED_HASH_2, null, wallet4);

    // Expect (err u101) — ERR-NOT-REGISTRAR
    expect(result.result).toEqual(Cl.error(Cl.uint(101)));
  });

  // ---------------------------------------------------------------------------
  it("get-property-info on non-existent property should fail with ERR-PROPERTY-NOT-FOUND (u103)", () => {
    // Property ID 999 was never registered
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-info",
      [Cl.uint(999)],
      deployer
    );

    // Expect (err u103) — ERR-PROPERTY-NOT-FOUND
    expect(result.result).toEqual(Cl.error(Cl.uint(103)));
  });

  // ---------------------------------------------------------------------------
  it("register-property with IPFS hash should store it in the property record", () => {
    // Register property 2 with an IPFS document hash
    const result = registerProperty(
      PROPERTY_ID_2,
      wallet2,
      DEED_HASH_2,
      IPFS_HASH_1 // Providing an optional IPFS hash
    );

    expect(result.result).toEqual(Cl.ok(Cl.uint(PROPERTY_ID_2)));

    // Verify the IPFS hash was stored correctly
    const infoResult = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-info",
      [Cl.uint(PROPERTY_ID_2)],
      deployer
    );

    expect(infoResult.result.type).toBe(ClarityType.ResponseOk);
  });

  // ---------------------------------------------------------------------------
  it("property-count should increment after each registration", () => {
    // At this point: property 1 and property 2 have been registered above.
    // property-count data-var should reflect 2.
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-count",
      [],
      deployer
    );

    // Expect (ok u2) — two properties have been registered
    expect(result.result).toEqual(Cl.ok(Cl.uint(2)));
  });

});


// =============================================================================
// DESCRIBE: Ownership Transfer Workflow
// =============================================================================
// Tests the complete 3-step transfer: initiate → buyer-approve → finalize.
// Also tests error paths and cancel-transfer.
// =============================================================================

describe("Ownership Transfer Workflow", () => {

  it("FULL HAPPY PATH: initiate → buyer-approve → registrar-finalize changes owner on-chain", () => {
    // ---- SETUP ----
    // Authorize registrar and register a property
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // ---- STEP 1: Seller (wallet_2) initiates transfer to buyer (wallet_3) ----
    const initiateResult = simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2 // tx-sender = seller / current owner
    );
    expect(initiateResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // Verify the property status is now "pending-transfer"
    const pendingInfo = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-info",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(pendingInfo.result.type).toBe(ClarityType.ResponseOk);

    // Verify the transfer request exists with correct parties
    const transferReq = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-transfer-request",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    // get-transfer-request returns (optional { seller, buyer, ... }) — not a response type
    expect(transferReq.result.type).toBe(ClarityType.OptionalSome);

    // ---- STEP 2: Buyer (wallet_3) approves the transfer ----
    const approveResult = simnet.callPublicFn(
      CONTRACT_NAME,
      "buyer-approve-transfer",
      [Cl.uint(PROPERTY_ID_1)],
      wallet3 // tx-sender = buyer (must match transfer-request.buyer)
    );
    expect(approveResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // ---- STEP 3: Registrar (wallet_1) finalizes the transfer ----
    const finalizeResult = simnet.callPublicFn(
      CONTRACT_NAME,
      "registrar-finalize-transfer",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1 // tx-sender = authorized registrar
    );
    expect(finalizeResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // ---- VERIFICATION: Confirm owner changed on-chain ----
    const finalInfo = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-info",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );

    expect(finalInfo.result.type).toBe(ClarityType.ResponseOk);
    if (finalInfo.result.type === ClarityType.ResponseOk) {
      // The owner must now be wallet_3 (the buyer), not wallet_2 (the seller)
      expect(finalInfo.result.value).toMatchObject(
        Cl.tuple({
          owner: Cl.principal(wallet3),
          status: Cl.stringAscii("active"), // Status returns to active after finalization
        })
      );
    }

    // ---- VERIFY OWNERSHIP HISTORY ----
    // After registration (seq 0: wallet_2) + finalization (seq 1: wallet_3)
    const histCount = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-ownership-history-count",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(histCount.result).toEqual(Cl.ok(Cl.uint(2)));

    // Seq 0 should be the original owner (wallet_2)
    const histEntry0 = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-ownership-history-entry",
      [Cl.uint(PROPERTY_ID_1), Cl.uint(0)],
      deployer
    );
    expect(histEntry0.result.type).toBe(ClarityType.OptionalSome);

    // Seq 1 should be the new owner (wallet_3)
    const histEntry1 = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-ownership-history-entry",
      [Cl.uint(PROPERTY_ID_1), Cl.uint(1)],
      deployer
    );
    expect(histEntry1.result.type).toBe(ClarityType.OptionalSome);

    // ---- VERIFY TRANSFER REQUEST IS CLEANED UP ----
    // After finalization, the transfer request should be deleted
    const noTransfer = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-transfer-request",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(noTransfer.result.type).toBe(ClarityType.OptionalNone);
  });

  // ---------------------------------------------------------------------------
  it("initiate-transfer by non-owner should fail with ERR-NOT-OWNER (u105)", () => {
    // Setup
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // wallet_3 does not own property 1 — initiate should be rejected
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet3 // tx-sender = wallet_3 ≠ owner (wallet_2)
    );

    // Expect (err u105) — ERR-NOT-OWNER
    expect(result.result).toEqual(Cl.error(Cl.uint(105)));
  });

  // ---------------------------------------------------------------------------
  it("initiate-transfer with buyer same as seller should fail with ERR-INVALID-BUYER (u113)", () => {
    // Setup
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // wallet_2 tries to transfer to themselves — should be rejected
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet2)], // buyer = seller
      wallet2 // tx-sender = wallet_2 = current owner
    );

    // Expect (err u113) — ERR-INVALID-BUYER
    expect(result.result).toEqual(Cl.error(Cl.uint(113)));
  });

  // ---------------------------------------------------------------------------
  it("initiate-transfer on disputed property should fail with ERR-PROPERTY-DISPUTED (u110)", () => {
    // Setup: register property, then flag it as disputed
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // Flag the property as disputed (by registrar wallet_1)
    simnet.callPublicFn(
      CONTRACT_NAME,
      "flag-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1 // tx-sender = authorized registrar
    );

    // Now try to initiate a transfer — should be blocked by dispute
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2 // tx-sender = owner — but dispute blocks all transfers
    );

    // Expect (err u110) — ERR-PROPERTY-DISPUTED
    expect(result.result).toEqual(Cl.error(Cl.uint(110)));
  });

  // ---------------------------------------------------------------------------
  it("second initiate-transfer while one is pending should fail with ERR-TRANSFER-PENDING (u106)", () => {
    // Setup
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // First transfer — valid
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2
    );

    // Second transfer attempt on the same property — must fail
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet4)],
      wallet2 // Still the owner
    );

    // Expect (err u106) — ERR-TRANSFER-PENDING (status is "pending-transfer")
    expect(result.result).toEqual(Cl.error(Cl.uint(106)));
  });

  // ---------------------------------------------------------------------------
  it("registrar-finalize-transfer before buyer approves should fail with ERR-BUYER-NOT-APPROVED (u108)", () => {
    // Setup: initiate transfer but SKIP buyer approval
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2
    );

    // Registrar tries to finalize without buyer approval — should be blocked
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "registrar-finalize-transfer",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1 // tx-sender = authorized registrar
    );

    // Expect (err u108) — ERR-BUYER-NOT-APPROVED
    expect(result.result).toEqual(Cl.error(Cl.uint(108)));
  });

  // ---------------------------------------------------------------------------
  it("buyer-approve-transfer by wrong principal should fail with ERR-NOT-AUTHORIZED (u100)", () => {
    // Setup: initiate a transfer to wallet_3
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2
    );

    // wallet_4 is NOT the named buyer — should be rejected
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "buyer-approve-transfer",
      [Cl.uint(PROPERTY_ID_1)],
      wallet4 // tx-sender = wallet_4 ≠ buyer (wallet_3)
    );

    // Expect (err u100) — ERR-NOT-AUTHORIZED (wallet_4 is not the buyer)
    expect(result.result).toEqual(Cl.error(Cl.uint(100)));
  });

  // ---------------------------------------------------------------------------
  it("cancel-transfer by owner should reset property status to active", () => {
    // Setup: initiate a transfer
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2
    );

    // Owner cancels the transfer
    const cancelResult = simnet.callPublicFn(
      CONTRACT_NAME,
      "cancel-transfer",
      [Cl.uint(PROPERTY_ID_1)],
      wallet2 // tx-sender = current owner
    );
    expect(cancelResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // Verify the property is back to "active" and no transfer request remains
    const info = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-info",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );

    expect(info.result.type).toBe(ClarityType.ResponseOk);
    if (info.result.type === ClarityType.ResponseOk) {
      expect(info.result.value).toMatchObject(
        Cl.tuple({ status: Cl.stringAscii("active") })
      );
    }

    // Transfer request should be gone
    const noTransfer = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-transfer-request",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(noTransfer.result.type).toBe(ClarityType.OptionalNone);
  });

  // ---------------------------------------------------------------------------
  it("cancel-transfer by registrar should also succeed (registrar can cancel any transfer)", () => {
    // Setup: initiate a transfer
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2
    );

    // Registrar cancels (e.g., due to documentation error)
    const cancelResult = simnet.callPublicFn(
      CONTRACT_NAME,
      "cancel-transfer",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1 // tx-sender = authorized registrar (not the owner)
    );
    expect(cancelResult.result).toEqual(Cl.ok(Cl.bool(true)));
  });

  // ---------------------------------------------------------------------------
  it("cancel-transfer by unauthorized user should fail with ERR-NOT-AUTHORIZED (u100)", () => {
    // Setup
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2
    );

    // wallet_4 is neither the owner nor a registrar — should be rejected
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "cancel-transfer",
      [Cl.uint(PROPERTY_ID_1)],
      wallet4
    );
    expect(result.result).toEqual(Cl.error(Cl.uint(100)));
  });

});


// =============================================================================
// DESCRIBE: Dispute Management
// =============================================================================
// Tests for flag-dispute, resolve-dispute, and is-disputed.
// Covers: flagging, blocking transfers, auto-cancel on flag, resolution.
// =============================================================================

describe("Dispute Management", () => {

  it("flag-dispute by registrar should set disputed status and is-disputed returns true", () => {
    // Setup
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // Registrar flags the property as disputed
    const flagResult = simnet.callPublicFn(
      CONTRACT_NAME,
      "flag-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1 // tx-sender = authorized registrar
    );
    expect(flagResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // is-disputed should now return (ok true)
    const disputedResult = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "is-disputed",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(disputedResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // get-property-info should show status as "disputed"
    const info = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-info",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(info.result.type).toBe(ClarityType.ResponseOk);
    if (info.result.type === ClarityType.ResponseOk) {
      expect(info.result.value).toMatchObject(
        Cl.tuple({ status: Cl.stringAscii("disputed") })
      );
    }
  });

  // ---------------------------------------------------------------------------
  it("flag-dispute should auto-cancel any pending transfer on the property", () => {
    // Setup: register property and initiate a transfer
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2
    );

    // Verify transfer exists before flagging
    const beforeFlag = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-transfer-request",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(beforeFlag.result.type).toBe(ClarityType.OptionalSome);

    // Flag the dispute — this should auto-cancel the pending transfer
    simnet.callPublicFn(
      CONTRACT_NAME,
      "flag-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1
    );

    // Transfer request should now be gone (auto-cancelled by flag-dispute)
    const afterFlag = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-transfer-request",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(afterFlag.result.type).toBe(ClarityType.OptionalNone);
  });

  // ---------------------------------------------------------------------------
  it("initiate-transfer on disputed property should fail with ERR-PROPERTY-DISPUTED (u110)", () => {
    // Setup: flag the property as disputed first
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "flag-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1
    );

    // Attempt to initiate a transfer on a disputed property
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "initiate-transfer",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet3)],
      wallet2 // Even the owner cannot transfer while disputed
    );

    // Expect (err u110) — ERR-PROPERTY-DISPUTED
    expect(result.result).toEqual(Cl.error(Cl.uint(110)));
  });

  // ---------------------------------------------------------------------------
  it("resolve-dispute by registrar should clear flag and restore active status", () => {
    // Setup: flag the property as disputed
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "flag-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1
    );

    // Resolve the dispute as registrar
    const resolveResult = simnet.callPublicFn(
      CONTRACT_NAME,
      "resolve-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1 // tx-sender = authorized registrar
    );
    expect(resolveResult.result).toEqual(Cl.ok(Cl.bool(true)));

    // is-disputed should now return (ok false)
    const disputedResult = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "is-disputed",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(disputedResult.result).toEqual(Cl.ok(Cl.bool(false)));

    // Property status should be back to "active"
    const info = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-property-info",
      [Cl.uint(PROPERTY_ID_1)],
      deployer
    );
    expect(info.result.type).toBe(ClarityType.ResponseOk);
    if (info.result.type === ClarityType.ResponseOk) {
      expect(info.result.value).toMatchObject(
        Cl.tuple({ status: Cl.stringAscii("active") })
      );
    }
  });

  // ---------------------------------------------------------------------------
  it("resolve-dispute by non-registrar should fail with ERR-NOT-REGISTRAR (u101)", () => {
    // Setup: flag the property as disputed
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);
    simnet.callPublicFn(
      CONTRACT_NAME,
      "flag-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1
    );

    // wallet_4 is not a registrar — cannot resolve disputes
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "resolve-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet4 // tx-sender = unauthorized user
    );

    // Expect (err u101) — ERR-NOT-REGISTRAR
    expect(result.result).toEqual(Cl.error(Cl.uint(101)));
  });

  // ---------------------------------------------------------------------------
  it("flag-dispute by non-registrar should fail with ERR-NOT-REGISTRAR (u101)", () => {
    // Setup: register a property
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // wallet_4 cannot flag disputes — only registrars can
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "flag-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet4
    );

    // Expect (err u101) — ERR-NOT-REGISTRAR
    expect(result.result).toEqual(Cl.error(Cl.uint(101)));
  });

  // ---------------------------------------------------------------------------
  it("resolve-dispute on non-disputed property should fail with ERR-INVALID-STATUS (u112)", () => {
    // Setup: register property (status = "active", no dispute)
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    // Registrar tries to resolve a dispute that was never raised
    const result = simnet.callPublicFn(
      CONTRACT_NAME,
      "resolve-dispute",
      [Cl.uint(PROPERTY_ID_1)],
      wallet1 // Authorized registrar — but property is not disputed
    );

    // Expect (err u112) — ERR-INVALID-STATUS (not in "disputed" status)
    expect(result.result).toEqual(Cl.error(Cl.uint(112)));
  });

});


// =============================================================================
// DESCRIBE: Ownership Verification (verify-owner)
// =============================================================================

describe("Ownership Verification", () => {

  it("verify-owner with correct owner should return (ok true)", () => {
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "verify-owner",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet2)],
      deployer
    );

    // wallet_2 IS the owner — expect (ok true)
    expect(result.result).toEqual(Cl.ok(Cl.bool(true)));
  });

  // ---------------------------------------------------------------------------
  it("verify-owner with wrong principal should return (ok false)", () => {
    authorizeWallet1();
    registerProperty(PROPERTY_ID_1, wallet2, DEED_HASH_1);

    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "verify-owner",
      [Cl.uint(PROPERTY_ID_1), Cl.principal(wallet4)], // wallet_4 is NOT the owner
      deployer
    );

    // wallet_4 is NOT the owner — expect (ok false), not an error
    expect(result.result).toEqual(Cl.ok(Cl.bool(false)));
  });

  // ---------------------------------------------------------------------------
  it("verify-owner on non-existent property should fail with ERR-PROPERTY-NOT-FOUND (u103)", () => {
    const result = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "verify-owner",
      [Cl.uint(999), Cl.principal(wallet2)],
      deployer
    );

    // Expect (err u103) — the property doesn't exist
    expect(result.result).toEqual(Cl.error(Cl.uint(103)));
  });

});
