;; =============================================================================
;; contracts/blockland.clar
;; BlockLand Zimbabwe -- Core Land Registry Smart Contract
;; =============================================================================
;;
;; MODULE:  Blockchain Layer -- Ground Truth for Ownership State
;; PURPOSE: Enforces land ownership rules, transfer workflows, and dispute
;;          management immutably on the Stacks blockchain.
;;
;; ARCHITECTURE ROLE:
;;   This is the single deployable contract for BlockLand. It is the ground
;;   truth for all property ownership on the system. Every off-chain record
;;   (PostgreSQL) must be consistent with this contract's state.
;;
;;   +-----------------------------------------------------+
;;   |  Next.js 14 Frontend  (@stacks/connect wallet)      |
;;   +------------------+----------------------------------+
;;                      |  HTTP / REST
;;   +------------------?----------------------------------+
;;   |  NestJS Backend (BlockchainService)                 |
;;   |  @stacks/transactions -- makeContractCall()          |
;;   +------------------+----------------------------------+
;;                      |  Stacks blockchain RPC
;;   +------------------?----------------------------------+
;;   |  THIS CONTRACT (blockland.clar)                     |
;;   |  Deployed on Stacks Testnet                         |
;;   +-----------------------------------------------------+
;;
;; CONTRACT STRUCTURE ORDER (required by spec):
;;   1. Error constants
;;   2. Data variables
;;   3. Maps
;;   4. Private helper functions
;;   5. Read-only functions (no state change)
;;   6. Public functions (state-changing)
;;
;; CLARITY LANGUAGE NOTES (for developers new to Clarity):
;;   - Clarity is NOT Solidity. There are NO loops, NO events, NO inheritance.
;;   - All functions must return a (response ok-type err-type).
;;   - tx-sender is the wallet that signed the transaction -- use it for all auth.
;;   - Maps are NOT iterable -- design all queries around known keys.
;;   - All data written on-chain is permanent and visible to everyone.
;;   - Compile with: clarinet check
;;   - Test with:    clarinet test (Clarinet v2 / vitest)
;;
;; RELATED FILES:
;;   tests/blockland.test.ts     -- Full Clarinet v2 / vitest test suite
;;   docs/blockchain-integration-guide.md -- NestJS integration patterns
;; =============================================================================


;; =============================================================================
;; SECTION 1: ERROR CONSTANTS
;; =============================================================================
;;
;; All error codes are defined as named constants so error meaning is always
;; clear in code. Numeric error codes map to these constants in the NestJS
;; backend's BlockchainService for user-facing error messages.
;;
;; Rule: NEVER use a raw number in (err ...) -- always use a named constant.
;; =============================================================================

;; u100: The tx-sender is not the contract owner (admin action attempted by outsider)
(define-constant ERR-NOT-AUTHORIZED (err u100))

;; u101: The tx-sender is not in the authorized-registrars map
;;       Raised when a non-registrar tries to register, flag, or finalize
(define-constant ERR-NOT-REGISTRAR (err u101))

;; u102: A property with this property-id already exists in property-registry
;;       Raised to prevent duplicate on-chain registration of the same ID
(define-constant ERR-PROPERTY-EXISTS (err u102))

;; u103: No property found for the given property-id
;;       Raised by all functions that look up a property before acting on it
(define-constant ERR-PROPERTY-NOT-FOUND (err u103))

;; u104: This title-deed-hash is already indexed in title-deed-index
;;       Prevents the same physical deed from being registered for two properties
(define-constant ERR-TITLE-DEED-EXISTS (err u104))

;; u105: The tx-sender is not the current owner of the property
;;       Raised when a non-owner tries to initiate a transfer
(define-constant ERR-NOT-OWNER (err u105))

;; u106: A transfer is already pending for this property
;;       Raised to prevent opening two transfers on the same property
(define-constant ERR-TRANSFER-PENDING (err u106))

;; u107: No transfer request found for this property
;;       Raised by buyer-approve, finalize, or cancel when no transfer exists
(define-constant ERR-TRANSFER-NOT-FOUND (err u107))

;; u108: The buyer has not yet approved the transfer
;;       The registrar cannot finalize until the buyer approves
(define-constant ERR-BUYER-NOT-APPROVED (err u108))

;; u109: Reserved -- registrar approval not yet given (future use for 2-of-2 registrar flow)
(define-constant ERR-REGISTRAR-NOT-APPROVED (err u109))

;; u110: The property is currently disputed and cannot be transferred
;;       All transfer attempts on a disputed property are blocked
(define-constant ERR-PROPERTY-DISPUTED (err u110))

;; u111: No dispute record found for this property
;;       Raised if resolve-dispute is called when no dispute flag exists
(define-constant ERR-DISPUTE-NOT-FOUND (err u111))

;; u112: The property is not in the expected status for this operation
;;       e.g. resolve-dispute called on a non-disputed property
(define-constant ERR-INVALID-STATUS (err u112))

;; u113: The buyer argument is the same principal as the seller (tx-sender)
;;       A property owner cannot transfer to themselves
(define-constant ERR-INVALID-BUYER (err u113))


;; =============================================================================
;; SECTION 2: DATA VARIABLES
;; =============================================================================
;;
;; data-var stores a single mutable value on-chain.
;; Unlike maps, data-vars hold exactly one value at all times.
;; Read with (var-get var-name), write with (var-set var-name new-value).
;; =============================================================================

;; The principal that deployed this contract.
;; Set to tx-sender at deployment time -- this is the contract administrator.
;; Only this address can call initialize-registrar and remove-registrar.
;;
;; In Clarinet simnet: this will be the 'deployer' account.
;; In production: this will be the Deeds Registry authority's wallet principal.
(define-data-var contract-owner principal tx-sender)

;; Monotonically increasing count of registered properties.
;; Incremented on every successful register-property call.
;; Does NOT serve as the property-id (that is passed in from PostgreSQL).
;; Used for admin dashboard stats and integrity checking.
(define-data-var property-count uint u0)


;; =============================================================================
;; SECTION 3: MAPS
;; =============================================================================
;;
;; Maps are the primary on-chain storage mechanism.
;; Key and value types are fixed at definition -- you cannot add new fields later.
;; Maps are NOT iterable -- never attempt to loop over all map entries.
;; Read with (map-get? map key) ? returns (optional value-type).
;; Write with (map-set map key value) or delete with (map-delete map key).
;; =============================================================================

;; ---------------------------------------------------------------------------
;; authorized-registrars
;; ---------------------------------------------------------------------------
;; Tracks which wallet principals are authorized to act as Land Registrars.
;; A value of 'true' means authorized. 'false' means revoked (not deleted).
;; Key   : principal -- the registrar's Stacks wallet address
;; Value : bool      -- true = authorized, false = revoked
;;
;; Off-chain equivalent: users table with role = 'REGISTRAR' in PostgreSQL.
;; The on-chain map is the authoritative source for contract access control.
(define-map authorized-registrars principal bool)

;; ---------------------------------------------------------------------------
;; property-registry
;; ---------------------------------------------------------------------------
;; The core ownership record for every land property in the system.
;; This is the on-chain "source of truth" for who owns what.
;; Key   : uint (property-id) -- matches the 'id' column in PostgreSQL properties table
;; Value : tuple with ownership and status data
;;
;; Fields:
;;   owner          -- current owner's Stacks wallet principal
;;   title-deed-hash-- SHA-256 hash of the physical title deed (buff 32 = 32 bytes)
;;   status         -- current lifecycle status: "active" | "pending-transfer" | "disputed"
;;   ipfs-doc-hash  -- optional SHA-256 of the IPFS-stored document for tamper detection
;;   registered-at  -- Stacks block height at time of registration (used as timestamp proxy)
;;
;; Off-chain equivalent: properties table in PostgreSQL (stores full metadata).
(define-map property-registry uint {
  owner: principal,
  title-deed-hash: (buff 32),
  status: (string-ascii 20),
  ipfs-doc-hash: (optional (buff 32)),
  registered-at: uint
})

;; ---------------------------------------------------------------------------
;; title-deed-index
;; ---------------------------------------------------------------------------
;; Reverse lookup map: title-deed-hash ? property-id.
;; Purpose: prevents the same physical title deed from being registered twice
;; under two different property IDs (a critical fraud prevention measure).
;;
;; Key   : (buff 32) -- the title deed hash
;; Value : uint      -- the property-id it is associated with
;;
;; Usage: before registering, check (is-none (map-get? title-deed-index hash)).
(define-map title-deed-index (buff 32) uint)

;; ---------------------------------------------------------------------------
;; transfer-requests
;; ---------------------------------------------------------------------------
;; At most ONE active transfer request is allowed per property at any time.
;; This map stores the pending transfer workflow state.
;;
;; Key   : uint (property-id)
;; Value : tuple with transfer parties and approval flags
;;
;; Transfer workflow:
;;   1. Seller calls initiate-transfer ? creates this entry
;;   2. Buyer calls buyer-approve-transfer ? sets buyer-approved = true
;;   3. Registrar calls registrar-finalize-transfer ? completes transfer, deletes entry
;;   OR: Owner/Registrar calls cancel-transfer ? deletes entry
;;
;; Off-chain equivalent: transfer_requests table in PostgreSQL (stores timestamps,
;; notes, document hashes -- all the rich metadata the chain cannot store).
(define-map transfer-requests uint {
  seller: principal,
  buyer: principal,
  buyer-approved: bool,
  registrar-approved: bool
})

;; ---------------------------------------------------------------------------
;; disputes
;; ---------------------------------------------------------------------------
;; Simple flag map indicating whether a property is currently disputed.
;; A value of 'true' means the property is under active dispute review.
;; The entry is DELETED (not set to false) when a dispute is resolved.
;;
;; Key   : uint (property-id)
;; Value : bool -- true = disputed (entries only exist when disputed)
;;
;; Off-chain equivalent: disputes table in PostgreSQL stores description,
;; evidence files (IPFS CIDs), parties involved, resolution notes, etc.
(define-map disputes uint bool)

;; ---------------------------------------------------------------------------
;; ownership-history
;; ---------------------------------------------------------------------------
;; Immutable record of every past and current owner for each property.
;; Clarity has NO dynamic arrays -- we use a composite key with a sequence number
;; to simulate an append-only list without unbounded loops.
;;
;; Key   : { property-id: uint, seq: uint } -- composite key (property + index)
;; Value : { owner: principal, acquired-at: uint (block height) }
;;
;; Sequence numbering:
;;   seq 0 ? first owner at registration
;;   seq 1 ? second owner after first transfer
;;   seq N ? Nth owner
;;
;; The NestJS backend reconstructs the full history by:
;;   1. Calling get-ownership-history-count to learn how many entries exist
;;   2. Calling get-ownership-history-entry(property-id, 0..count-1) for each
;;
;; Off-chain equivalent: PostgreSQL stores acquired_at timestamps as ISO dates;
;; block-height is stored as a cross-reference for blockchain verification.
(define-map ownership-history
  { property-id: uint, seq: uint }
  { owner: principal, acquired-at: uint }
)

;; ---------------------------------------------------------------------------
;; ownership-history-count
;; ---------------------------------------------------------------------------
;; Tracks the NEXT sequence number to use for each property's ownership history.
;; This is separate from property-registry to keep the registry tuple lean.
;;
;; Key   : uint (property-id)
;; Value : uint -- number of history entries recorded (equals next seq to use)
;;
;; Example: if count = 3, entries exist at seq 0, 1, 2. Next entry uses seq 3.
(define-map ownership-history-count uint uint)


;; =============================================================================
;; SECTION 4: PRIVATE HELPER FUNCTIONS
;; =============================================================================
;;
;; Private functions are ONLY callable from within this contract.
;; They cannot be called externally. Use them to DRY up repeated logic.
;; =============================================================================

;; ---------------------------------------------------------------------------
;; check-is-registrar
;; ---------------------------------------------------------------------------
;; PURPOSE : Checks whether a given principal is an authorized land registrar.
;; PARAMS  : address -- the principal to check
;; RETURNS : bool -- true if authorized, false if not found or revoked
;;
;; Uses (default-to false ...) so that principals not in the map also return false.
;; This is safer than (unwrap-panic ...) which would panic on a missing entry.
(define-private (check-is-registrar (address principal))
  ;; Look up the address in authorized-registrars.
  ;; If not found (map-get? returns none), default to false.
  ;; If found but set to false (revoked), returns false.
  (default-to false (map-get? authorized-registrars address))
)

;; ---------------------------------------------------------------------------
;; check-property-exists
;; ---------------------------------------------------------------------------
;; PURPOSE : Checks whether a property-id is already registered on-chain.
;; PARAMS  : property-id -- the uint property identifier to check
;; RETURNS : bool -- true if the property exists, false if it does not
;;
;; (is-some ...) converts (optional T) ? bool. If map-get? returns (some value),
;; the property exists. If it returns none, the property does not exist.
(define-private (check-property-exists (property-id uint))
  (is-some (map-get? property-registry property-id))
)

;; ---------------------------------------------------------------------------
;; record-ownership-history
;; ---------------------------------------------------------------------------
;; PURPOSE : Appends a new ownership history entry for a property.
;;           Called during register-property (seq 0) and registrar-finalize-transfer (seq N).
;; PARAMS  : property-id -- the property to record history for
;;           new-owner   -- the principal who now owns the property
;; RETURNS : bool -- always true (internal helper, result is discarded in callers)
;;
;; Uses the current Stacks block-height as the acquisition timestamp.
;; block-height increases by 1 approximately every 10 minutes on Stacks mainnet.
;; On testnet/devnet it advances with each mined block in simnet.
(define-private (record-ownership-history (property-id uint) (new-owner principal))
  (let (
    ;; Get the current next-seq for this property (0 if this is the first entry)
    (next-seq (default-to u0 (map-get? ownership-history-count property-id)))
  )
    ;; Write the history entry at the current sequence number
    (map-set ownership-history
      { property-id: property-id, seq: next-seq }
      { owner: new-owner, acquired-at: block-height }
    )
    ;; Increment the sequence counter -- next entry will use (next-seq + 1)
    (map-set ownership-history-count property-id (+ next-seq u1))
  )
)


;; =============================================================================
;; SECTION 5: READ-ONLY FUNCTIONS
;; =============================================================================
;;
;; Read-only functions do NOT change state and require NO transaction fee.
;; They can be called by anyone -- the NestJS backend uses callReadOnlyFunction()
;; for these, which returns results instantly without broadcasting a transaction.
;;
;; Use these for: displaying property info, verifying ownership, polling history.
;; =============================================================================

;; ---------------------------------------------------------------------------
;; get-property-info
;; ---------------------------------------------------------------------------
;; PURPOSE : Returns the complete on-chain record for a given property.
;; PARAMS  : property-id -- the uint ID of the property to look up
;; RETURNS : (ok { owner, title-deed-hash, status, ipfs-doc-hash, registered-at })
;;           (err u103) if no property found (ERR-PROPERTY-NOT-FOUND)
;;
;; NestJS usage: BlockchainService.getPropertyInfo(propertyId)
;;   const result = await callReadOnlyFunction({ contractAddress, contractName,
;;     functionName: 'get-property-info', functionArgs: [uintCV(propertyId)] });
(define-read-only (get-property-info (property-id uint))
  ;; (match (optional T) bound-var some-expr none-expr)
  ;; If the property exists, return it wrapped in ok.
  ;; If not found, return ERR-PROPERTY-NOT-FOUND.
  (match (map-get? property-registry property-id)
    property (ok property)
    ERR-PROPERTY-NOT-FOUND
  )
)

;; ---------------------------------------------------------------------------
;; verify-owner
;; ---------------------------------------------------------------------------
;; PURPOSE : Verifies whether a claimed owner actually owns a given property.
;;           Used for third-party verification without exposing full property data.
;; PARAMS  : property-id   -- uint ID of the property
;;           claimed-owner -- the principal being verified as owner
;; RETURNS : (ok true)  if claimed-owner matches the on-chain owner
;;           (ok false) if claimed-owner does NOT match
;;           (err u103) if the property does not exist
;;
;; This is a PUBLIC VERIFICATION FUNCTION -- called by the /api/verify endpoint
;; which is accessible to unauthenticated (public viewer) users.
(define-read-only (verify-owner (property-id uint) (claimed-owner principal))
  (match (map-get? property-registry property-id)
    ;; Property found: compare the claimed owner to the actual on-chain owner
    property (ok (is-eq claimed-owner (get owner property)))
    ;; Property not found: surface the not-found error
    ERR-PROPERTY-NOT-FOUND
  )
)

;; ---------------------------------------------------------------------------
;; get-ownership-history-entry
;; ---------------------------------------------------------------------------
;; PURPOSE : Returns a specific entry in the ownership history by seq number.
;; PARAMS  : property-id -- the property to retrieve history for
;;           seq         -- the sequence number (0 = first owner, 1 = second, etc.)
;; RETURNS : (optional { owner: principal, acquired-at: uint })
;;           Returns none if no entry exists at that sequence number
;;
;; NestJS pattern to retrieve full history:
;;   1. Call get-ownership-history-count ? learn N
;;   2. Call get-ownership-history-entry(id, 0), (id, 1), ..., (id, N-1)
(define-read-only (get-ownership-history-entry (property-id uint) (seq uint))
  ;; Returns (optional ...) -- not a response type -- callers handle none themselves
  (map-get? ownership-history { property-id: property-id, seq: seq })
)

;; ---------------------------------------------------------------------------
;; get-ownership-history-count
;; ---------------------------------------------------------------------------
;; PURPOSE : Returns the number of ownership history entries recorded for a property.
;;           This is how the NestJS backend knows the upper bound for seq iteration.
;; PARAMS  : property-id -- the property to query
;; RETURNS : (ok uint) -- count of history entries (0 if property has no history)
(define-read-only (get-ownership-history-count (property-id uint))
  (ok (default-to u0 (map-get? ownership-history-count property-id)))
)

;; ---------------------------------------------------------------------------
;; get-transfer-request
;; ---------------------------------------------------------------------------
;; PURPOSE : Returns the current pending transfer request for a property.
;;           Returns none if no transfer is in progress.
;; PARAMS  : property-id -- the property to check
;; RETURNS : (optional { seller, buyer, buyer-approved, registrar-approved })
;;
;; The backend polls this to track which approval step the transfer is at.
;; If buyer-approved = false ? waiting for buyer.
;; If buyer-approved = true  ? waiting for registrar finalization.
(define-read-only (get-transfer-request (property-id uint))
  (map-get? transfer-requests property-id)
)

;; ---------------------------------------------------------------------------
;; is-disputed
;; ---------------------------------------------------------------------------
;; PURPOSE : Returns whether a property is currently under dispute.
;; PARAMS  : property-id -- the property to check
;; RETURNS : (ok true) if the property is disputed, (ok false) if not
(define-read-only (is-disputed (property-id uint))
  ;; If the disputes entry is missing, the property is not disputed (false)
  (ok (default-to false (map-get? disputes property-id)))
)

;; ---------------------------------------------------------------------------
;; is-registrar
;; ---------------------------------------------------------------------------
;; PURPOSE : Returns whether a given address is an authorized registrar.
;;           The NestJS backend calls this before submitting registrar transactions
;;           to pre-validate that the wallet will pass on-chain access control.
;; PARAMS  : address -- the principal to check
;; RETURNS : (ok true) if authorized registrar, (ok false) otherwise
(define-read-only (is-registrar (address principal))
  (ok (check-is-registrar address))
)

;; ---------------------------------------------------------------------------
;; get-property-count
;; ---------------------------------------------------------------------------
;; PURPOSE : Returns the total number of properties registered in this contract.
;; RETURNS : (ok uint) -- the current value of the property-count data-var
;;
;; Used by the admin dashboard to display system-wide registration statistics.
(define-read-only (get-property-count)
  (ok (var-get property-count))
)


;; =============================================================================
;; SECTION 6: PUBLIC FUNCTIONS -- STATE-CHANGING
;; =============================================================================
;;
;; Public functions CHANGE on-chain state and require a signed transaction.
;; They cost STX in transaction fees and must be broadcast to the Stacks network.
;;
;; The NestJS BlockchainService calls these via:
;;   makeContractCall() ? broadcastTransaction() ? poll for confirmation
;;
;; SECURITY RULE: Every public function MUST check tx-sender authorization
;; as its FIRST assertion before any other logic executes.
;; =============================================================================


;; =============================================================================
;; 6A: REGISTRAR MANAGEMENT
;; =============================================================================

;; ---------------------------------------------------------------------------
;; initialize-registrar
;; ---------------------------------------------------------------------------
;; PURPOSE : Authorizes a new wallet principal as a Land Registrar.
;;           Only the contract deployer (contract-owner) can call this.
;; PARAMS  : registrar -- the Stacks principal to authorize
;; RETURNS : (ok true) on success
;;           (err u100) ERR-NOT-AUTHORIZED if called by a non-owner
;;
;; NestJS: Called by AdminService when a system admin activates a registrar account.
;; The backend maps this to the users table role = 'REGISTRAR'.
(define-public (initialize-registrar (registrar principal))
  (begin
    ;; SECURITY: Only the deployer (contract-owner) can manage registrars.
    ;; Using (var-get contract-owner) reads the data-var set at deployment.
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)

    ;; Add the registrar to the authorized map.
    ;; If they were previously revoked (false), this re-activates them.
    (map-set authorized-registrars registrar true)
    (ok true)
  )
)

;; ---------------------------------------------------------------------------
;; remove-registrar
;; ---------------------------------------------------------------------------
;; PURPOSE : Revokes an existing registrar's authorization.
;;           Sets their entry to false rather than deleting -- preserves history.
;; PARAMS  : registrar -- the Stacks principal to revoke
;; RETURNS : (ok true) on success
;;           (err u100) ERR-NOT-AUTHORIZED if called by a non-owner
;;
;; NestJS: Called by AdminService when deactivating a registrar account.
(define-public (remove-registrar (registrar principal))
  (begin
    ;; SECURITY: Only the contract owner can revoke registrar access.
    (asserts! (is-eq tx-sender (var-get contract-owner)) ERR-NOT-AUTHORIZED)

    ;; Set to false rather than (map-delete ...) -- this way the history of
    ;; who was ever a registrar is preserved. check-is-registrar handles false.
    (map-set authorized-registrars registrar false)
    (ok true)
  )
)


;; =============================================================================
;; 6B: PROPERTY REGISTRATION
;; =============================================================================

;; ---------------------------------------------------------------------------
;; register-property
;; ---------------------------------------------------------------------------
;; PURPOSE : Registers a new land property on-chain.
;;           This is the PRIMARY on-boarding function -- it creates the immutable
;;           ownership record that all subsequent operations reference.
;;
;; PARAMS  : property-id    -- uint ID from PostgreSQL properties table (off-chain ID)
;;           owner          -- the wallet principal of the current property owner
;;           title-deed-hash-- SHA-256 hash of the physical title deed (32 bytes)
;;           ipfs-doc-hash  -- (optional) SHA-256/CID of the IPFS-stored document
;;
;; RETURNS : (ok property-id) -- the ID of the newly registered property
;;           (err u101) ERR-NOT-REGISTRAR -- caller is not an authorized registrar
;;           (err u102) ERR-PROPERTY-EXISTS -- this property-id is already on-chain
;;           (err u104) ERR-TITLE-DEED-EXISTS -- this title deed hash already exists
;;
;; PRECONDITIONS (in order):
;;   1. tx-sender must be an authorized registrar
;;   2. property-id must be unique in property-registry
;;   3. title-deed-hash must be unique in title-deed-index
;;
;; SIDE EFFECTS:
;;   - Writes to property-registry
;;   - Writes to title-deed-index (reverse lookup)
;;   - Appends seq-0 entry to ownership-history
;;   - Increments property-count
;;
;; NestJS: Called by PropertyService.registerOnChain() after off-chain validation.
;; The returned property-id is stored as token_id in the properties table.
(define-public (register-property
  (property-id uint)
  (owner principal)
  (title-deed-hash (buff 32))
  (ipfs-doc-hash (optional (buff 32)))
)
  (begin
    ;; SECURITY CHECK 1: Only authorized registrars may register properties.
    ;; This is the FIRST check -- all others are secondary to authorization.
    (asserts! (check-is-registrar tx-sender) ERR-NOT-REGISTRAR)

    ;; INTEGRITY CHECK 2: The property-id must not already exist on-chain.
    ;; This prevents overwriting an existing ownership record with a new one.
    (asserts! (not (check-property-exists property-id)) ERR-PROPERTY-EXISTS)

    ;; INTEGRITY CHECK 3: This title deed hash must not already be registered.
    ;; Prevents fraudulent double-registration of the same physical document.
    ;; (is-none (map-get? ...)) returns true if no entry exists for this hash.
    (asserts! (is-none (map-get? title-deed-index title-deed-hash)) ERR-TITLE-DEED-EXISTS)

    ;; Write the core property record to the on-chain registry.
    ;; Status starts as "active" -- ready for transfers.
    ;; block-height provides a blockchain-verifiable registration timestamp.
    (map-set property-registry property-id {
      owner: owner,
      title-deed-hash: title-deed-hash,
      status: "active",
      ipfs-doc-hash: ipfs-doc-hash,
      registered-at: block-height
    })

    ;; Write the reverse index: title-deed-hash ? property-id.
    ;; Future registration attempts with the same deed hash will fail.
    (map-set title-deed-index title-deed-hash property-id)

    ;; Record the first ownership history entry at sequence number 0.
    ;; (record-ownership-history) auto-increments the history count.
    (record-ownership-history property-id owner)

    ;; Increment the global property count for admin dashboard stats.
    (var-set property-count (+ (var-get property-count) u1))

    ;; Return the property-id so the NestJS backend can confirm which ID
    ;; was registered and store it as the token_id in PostgreSQL.
    (ok property-id)
  )
)


;; =============================================================================
;; 6C: OWNERSHIP TRANSFER -- THREE SEPARATE FUNCTIONS
;; =============================================================================
;;
;; The transfer workflow requires THREE separate on-chain transactions:
;;   Step 1: initiate-transfer   (called by SELLER / current owner)
;;   Step 2: buyer-approve-transfer (called by BUYER)
;;   Step 3: registrar-finalize-transfer (called by REGISTRAR)
;;
;; This three-step model enforces the legal requirement that:
;;   - The seller must explicitly agree to sell to a specific buyer
;;   - The buyer must explicitly consent to the purchase
;;   - A government registrar must officially authorize the ownership change
;;
;; This maps to Zimbabwe's Deeds Registries Act [Chapter 20:05] which requires
;; registrar sign-off for property title transfers.
;; =============================================================================

;; ---------------------------------------------------------------------------
;; initiate-transfer
;; ---------------------------------------------------------------------------
;; PURPOSE : The current property owner (seller) initiates a transfer to a buyer.
;;           This locks the property into "pending-transfer" status.
;;
;; PARAMS  : property-id -- the property to transfer
;;           buyer       -- the wallet principal of the intended new owner
;;
;; RETURNS : (ok true) on success
;;           (err u103) ERR-PROPERTY-NOT-FOUND -- property does not exist
;;           (err u105) ERR-NOT-OWNER -- tx-sender is not the current owner
;;           (err u113) ERR-INVALID-BUYER -- buyer is the same as seller
;;           (err u110) ERR-PROPERTY-DISPUTED -- property is under dispute
;;           (err u106) ERR-TRANSFER-PENDING -- a transfer is already in progress
;;
;; NestJS: Called by TransferService.initiateTransfer() when owner submits form.
;; The txid from broadcastTransaction() is stored as blockchain_tx_hash in DB.
(define-public (initiate-transfer (property-id uint) (buyer principal))
  (let (
    ;; Retrieve the property record -- (unwrap! ...) fails with err if not found.
    ;; This is the Clarity equivalent of "fetch or throw 404".
    (property (unwrap! (map-get? property-registry property-id) ERR-PROPERTY-NOT-FOUND))
  )
    ;; SECURITY CHECK 1: Only the current on-chain owner may initiate.
    ;; We read the owner from the map -- never trust an argument for ownership proof.
    (asserts! (is-eq tx-sender (get owner property)) ERR-NOT-OWNER)

    ;; VALIDATION CHECK 2: The buyer cannot be the same wallet as the seller.
    ;; Prevents circular self-transfers that would waste gas and clog the registry.
    (asserts! (not (is-eq buyer tx-sender)) ERR-INVALID-BUYER)

    ;; STATUS CHECK 3: Block transfers on disputed properties.
    ;; A property under formal dispute cannot be transferred until resolved.
    (asserts! (not (is-eq (get status property) "disputed")) ERR-PROPERTY-DISPUTED)

    ;; STATUS CHECK 4: The property must be in "active" status (not pending-transfer).
    ;; Prevents opening a second transfer while one is already in progress.
    (asserts! (is-eq (get status property) "active") ERR-TRANSFER-PENDING)

    ;; DOUBLE-GUARD 5: Belt-and-suspenders check -- ensure no orphaned transfer record.
    ;; This catches edge cases where the status map and transfer-requests map diverge.
    (asserts! (is-none (map-get? transfer-requests property-id)) ERR-TRANSFER-PENDING)

    ;; Create the transfer request with both approval flags initialised to false.
    ;; buyer-approved and registrar-approved start false -- each party must act.
    (map-set transfer-requests property-id {
      seller: tx-sender,
      buyer: buyer,
      buyer-approved: false,
      registrar-approved: false
    })

    ;; Lock the property by changing its status to "pending-transfer".
    ;; (merge property { status: "active" }) creates a new tuple with one field changed.
    ;; All other fields (owner, title-deed-hash, etc.) are preserved unchanged.
    (map-set property-registry property-id (merge property { status: "pending-transfer" }))

    (ok true)
  )
)

;; ---------------------------------------------------------------------------
;; buyer-approve-transfer
;; ---------------------------------------------------------------------------
;; PURPOSE : The buyer named in a pending transfer confirms they consent to purchase.
;;           This is REQUIRED before the registrar can finalize.
;;           It does NOT complete the transfer -- only signals buyer consent.
;;
;; PARAMS  : property-id -- the property whose transfer the buyer is approving
;;
;; RETURNS : (ok true) on success
;;           (err u107) ERR-TRANSFER-NOT-FOUND -- no pending transfer for this property
;;           (err u100) ERR-NOT-AUTHORIZED -- tx-sender is not the named buyer
;;
;; NestJS: Called by TransferService.buyerApprove() when buyer clicks "Accept Transfer".
(define-public (buyer-approve-transfer (property-id uint))
  (let (
    ;; Retrieve the pending transfer -- must exist before the buyer can approve.
    (transfer (unwrap! (map-get? transfer-requests property-id) ERR-TRANSFER-NOT-FOUND))
  )
    ;; SECURITY CHECK: Only the buyer named in the transfer request can approve.
    ;; The buyer is whoever the seller designated in initiate-transfer.
    ;; A third party cannot approve on the buyer's behalf.
    (asserts! (is-eq tx-sender (get buyer transfer)) ERR-NOT-AUTHORIZED)

    ;; Update the transfer request: set buyer-approved to true.
    ;; (merge transfer { buyer-approved: true }) preserves seller, buyer, registrar-approved.
    (map-set transfer-requests property-id (merge transfer { buyer-approved: true }))

    (ok true)
  )
)

;; ---------------------------------------------------------------------------
;; registrar-finalize-transfer
;; ---------------------------------------------------------------------------
;; PURPOSE : An authorized registrar completes the ownership transfer.
;;           This is the CRITICAL step that permanently changes the on-chain owner.
;;           The buyer-approved flag MUST be true before this can execute.
;;
;; PARAMS  : property-id -- the property to finalize ownership transfer for
;;
;; RETURNS : (ok true) on success
;;           (err u107) ERR-TRANSFER-NOT-FOUND -- no pending transfer
;;           (err u103) ERR-PROPERTY-NOT-FOUND -- property doesn't exist
;;           (err u101) ERR-NOT-REGISTRAR -- caller is not an authorized registrar
;;           (err u108) ERR-BUYER-NOT-APPROVED -- buyer hasn't approved yet
;;
;; SIDE EFFECTS:
;;   - Updates property-registry.owner to the buyer
;;   - Resets property status to "active"
;;   - Appends a new ownership-history entry for the buyer
;;   - Deletes the transfer-requests entry (transfer complete)
;;
;; NestJS: Called by TransferService.finalizeTransfer() when registrar approves.
;; The new owner's wallet address is then synced back to PostgreSQL.
(define-public (registrar-finalize-transfer (property-id uint))
  (let (
    ;; Retrieve the transfer request -- must exist to finalize.
    (transfer (unwrap! (map-get? transfer-requests property-id) ERR-TRANSFER-NOT-FOUND))
    ;; Retrieve the property record -- needed for the merge update.
    (property (unwrap! (map-get? property-registry property-id) ERR-PROPERTY-NOT-FOUND))
  )
    ;; SECURITY CHECK 1: Only an authorized registrar can finalize a transfer.
    ;; This enforces the government-backed authority requirement.
    (asserts! (check-is-registrar tx-sender) ERR-NOT-REGISTRAR)

    ;; WORKFLOW CHECK 2: The buyer must have already approved.
    ;; A registrar cannot override buyer consent -- both must agree.
    (asserts! (get buyer-approved transfer) ERR-BUYER-NOT-APPROVED)

    ;; OWNERSHIP CHANGE: Update the property record with the buyer as the new owner.
    ;; Status returns to "active" -- the property is now freely transferable again.
    ;; (merge ...) preserves title-deed-hash, ipfs-doc-hash, registered-at unchanged.
    (map-set property-registry property-id (merge property {
      owner: (get buyer transfer),
      status: "active"
    }))

    ;; HISTORY: Record the new ownership entry for the buyer.
    ;; The seq number is auto-incremented by record-ownership-history.
    ;; This creates the immutable audit trail of all ownership changes.
    (record-ownership-history property-id (get buyer transfer))

    ;; CLEANUP: Delete the transfer request -- it has been fulfilled.
    ;; (map-delete ...) removes the entry entirely from the map.
    ;; The off-chain PostgreSQL record retains the full transfer history.
    (map-delete transfer-requests property-id)

    (ok true)
  )
)

;; ---------------------------------------------------------------------------
;; cancel-transfer
;; ---------------------------------------------------------------------------
;; PURPOSE : Cancels an in-progress transfer and resets the property to "active".
;;           Can be called by the current owner OR an authorized registrar.
;;           Registrars can cancel to resolve disputes or correct errors.
;;
;; PARAMS  : property-id -- the property whose transfer to cancel
;;
;; RETURNS : (ok true) on success
;;           (err u103) ERR-PROPERTY-NOT-FOUND -- property does not exist
;;           (err u107) ERR-TRANSFER-NOT-FOUND -- no pending transfer to cancel
;;           (err u100) ERR-NOT-AUTHORIZED -- caller is neither owner nor registrar
;;
;; NestJS: Called by TransferService.cancelTransfer() from either role.
;; DB status for the transfer record is updated to CANCELLED.
(define-public (cancel-transfer (property-id uint))
  (let (
    ;; Retrieve property record -- needed for ownership check and status reset.
    (property (unwrap! (map-get? property-registry property-id) ERR-PROPERTY-NOT-FOUND))
    ;; Retrieve transfer record -- must exist to cancel.
    (transfer (unwrap! (map-get? transfer-requests property-id) ERR-TRANSFER-NOT-FOUND))
  )
    ;; SECURITY CHECK: Only the current owner OR a registrar may cancel.
    ;; Note: the "owner" here is from the property map -- still the seller,
    ;; since ownership hasn't changed during pending-transfer status.
    (asserts!
      (or
        (is-eq tx-sender (get owner property))
        (check-is-registrar tx-sender)
      )
      ERR-NOT-AUTHORIZED
    )

    ;; Remove the transfer request from the map -- transfer is cancelled.
    (map-delete transfer-requests property-id)

    ;; Reset property status to "active" -- it can now accept new transfers.
    (map-set property-registry property-id (merge property { status: "active" }))

    (ok true)
  )
)


;; =============================================================================
;; 6D: DISPUTE MANAGEMENT
;; =============================================================================

;; ---------------------------------------------------------------------------
;; flag-dispute
;; ---------------------------------------------------------------------------
;; PURPOSE : Formally flags a property as disputed on-chain.
;;           Only an authorized registrar can raise a formal on-chain dispute.
;;           If a transfer is in progress, it is automatically cancelled.
;;
;; PARAMS  : property-id -- the property to flag as disputed
;;
;; RETURNS : (ok true) on success
;;           (err u103) ERR-PROPERTY-NOT-FOUND -- property does not exist
;;           (err u101) ERR-NOT-REGISTRAR -- caller is not a registrar
;;
;; SIDE EFFECTS:
;;   - Sets disputes[property-id] = true
;;   - Updates property status to "disputed"
;;   - Deletes any pending transfer-request (auto-cancel on dispute)
;;
;; NestJS: Called by DisputeService.flagOnChain() when a registrar escalates a dispute.
;; The dispute is created in PostgreSQL BEFORE calling this function -- the on-chain
;; flag is a secondary lock, not the primary dispute record.
(define-public (flag-dispute (property-id uint))
  (let (
    ;; Retrieve the property record -- must exist to dispute it.
    (property (unwrap! (map-get? property-registry property-id) ERR-PROPERTY-NOT-FOUND))
  )
    ;; SECURITY CHECK: Only authorized registrars can formally flag disputes on-chain.
    ;; Users cannot flag their own property as disputed -- only the authority can.
    (asserts! (check-is-registrar tx-sender) ERR-NOT-REGISTRAR)

    ;; Set the dispute flag for this property -- true means "currently disputed".
    (map-set disputes property-id true)

    ;; Update the property status to "disputed" -- blocks all transfer attempts.
    (map-set property-registry property-id (merge property { status: "disputed" }))

    ;; If a pending transfer exists, cancel it automatically.
    ;; A disputed property cannot complete an in-progress transfer.
    ;; (match (optional T) bound some-expr none-expr)
    ;; Both branches must return the same type -- (map-delete ...) returns bool.
    (if (is-some (map-get? transfer-requests property-id))
      (map-delete transfer-requests property-id)
      true
    )

    (ok true)
  )
)

;; ---------------------------------------------------------------------------
;; resolve-dispute
;; ---------------------------------------------------------------------------
;; PURPOSE : Resolves an active dispute and restores the property to "active" status.
;;           After resolution, the property can accept new transfer requests.
;;
;; PARAMS  : property-id -- the property whose dispute to resolve
;;
;; RETURNS : (ok true) on success
;;           (err u103) ERR-PROPERTY-NOT-FOUND -- property does not exist
;;           (err u101) ERR-NOT-REGISTRAR -- caller is not a registrar
;;           (err u112) ERR-INVALID-STATUS -- property is not in "disputed" status
;;
;; NestJS: Called by DisputeService.resolveOnChain() when a registrar closes a dispute.
;; The PostgreSQL dispute record is updated to status = 'RESOLVED' separately.
(define-public (resolve-dispute (property-id uint))
  (let (
    ;; Retrieve the property record -- must exist.
    (property (unwrap! (map-get? property-registry property-id) ERR-PROPERTY-NOT-FOUND))
  )
    ;; SECURITY CHECK 1: Only authorized registrars can resolve disputes.
    (asserts! (check-is-registrar tx-sender) ERR-NOT-REGISTRAR)

    ;; STATUS CHECK 2: The property must currently be in "disputed" status.
    ;; Prevents accidentally resolving a non-disputed property.
    (asserts! (is-eq (get status property) "disputed") ERR-INVALID-STATUS)

    ;; Remove the dispute flag entirely from the disputes map.
    ;; (map-delete ...) removes the entry -- subsequent is-disputed calls return false.
    (map-delete disputes property-id)

    ;; Restore the property status to "active".
    (map-set property-registry property-id (merge property { status: "active" }))

    (ok true)
  )
)
