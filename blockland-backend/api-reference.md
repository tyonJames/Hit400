# BlockLand Zimbabwe — Complete API Reference v1

**Base URL:** `https://api.blockland.co.zw/api/v1` (production) | `http://localhost:3001/api/v1` (dev)  
**Interactive Docs:** `GET /api/v1/docs` (Swagger UI — dev only)  
**Auth:** Bearer JWT (RS256) — obtain via `POST /api/v1/auth/login`  
**Blockchain:** Stacks Testnet (`api.testnet.hiro.so`)  
**IPFS:** Pinata (`gateway.pinata.cloud`)

---

## Response Envelope

Every response is wrapped in a standard envelope by the global `ResponseInterceptor`.

### Success
```json
{
  "success": true,
  "data": { "...": "payload" },
  "timestamp": "2024-03-15T10:30:00.000Z"
}
```

### Paginated Success
```json
{
  "success": true,
  "data": {
    "data":       [...],
    "total":      143,
    "page":       1,
    "limit":      20
  },
  "timestamp": "2024-03-15T10:30:00.000Z"
}
```

### Error
```json
{
  "success":    false,
  "statusCode": 400,
  "error":      "Bad Request",
  "message":    "Validation failed: email must be a valid email address",
  "timestamp":  "2024-03-15T10:30:00.000Z",
  "path":       "/api/v1/auth/register"
}
```

### Blockchain Pending (202 Accepted)
```json
{
  "success": true,
  "data": {
    "propertyId":        "uuid-...",
    "status":            "PENDING",
    "blockchainTxHash":  "0xabc123...",
    "message":           "Property registration submitted. Awaiting blockchain confirmation (~10 min)."
  },
  "timestamp": "2024-03-15T10:30:00.000Z"
}
```

---

## Blockchain Endpoint Classification

| Endpoint | Method | Blockchain Category | Clarity Function |
|---|---|---|---|
| `POST /properties` | WRITE | BLOCKCHAIN WRITE | `register-property` |
| `PATCH /transfers/:id/buyer-approve` | WRITE | BLOCKCHAIN WRITE | `buyer-approve-transfer` |
| `PATCH /transfers/:id/registrar-approve` | WRITE | BLOCKCHAIN WRITE | `registrar-finalize-transfer` |
| `PATCH /transfers/:id/cancel` | WRITE | BLOCKCHAIN WRITE | `cancel-transfer` |
| `POST /disputes` | WRITE | BLOCKCHAIN WRITE | `flag-dispute` |
| `PATCH /disputes/:id/resolve` | WRITE | BLOCKCHAIN WRITE | `resolve-dispute` |
| `POST /admin/registrars` | WRITE | BLOCKCHAIN WRITE | `initialize-registrar` |
| `DELETE /admin/registrars/:userId` | WRITE | BLOCKCHAIN WRITE | `remove-registrar` |
| `GET /verify` | READ | BLOCKCHAIN READ | `verify-owner` |
| `GET /verify/:propertyId` | READ | BLOCKCHAIN READ | `verify-owner` |
| `GET /properties/:id` | READ | BLOCKCHAIN READ (optional) | `get-property-info` |
| `GET /ownership/:id/history/onchain` | READ | BLOCKCHAIN READ | `get-ownership-history-*` |
| All other endpoints | — | DB ONLY | — |

---

## Module 1 — Authentication (`/api/v1/auth`)

### POST /api/v1/auth/register
| Field | Value |
|---|---|
| **Purpose** | Register a new user account with the PUBLIC role |
| **Access** | PUBLIC — no JWT required |
| **Request Body** | `RegisterDto` |
| **Validation** | fullName: 3–100 chars, letters/spaces; email: valid format; phone: 10–15 digits; password: 8–32 chars with upper/lower/number/special |
| **Success** | `201 Created` → `{ user: { id, email, fullName, roles, walletAddress }, accessToken, refreshToken }` |
| **Errors** | `400` (validation), `409` (email or national_id already exists) |
| **Blockchain** | NO |
| **DB** | INSERT users + INSERT user_roles (PUBLIC) |
| **File Upload** | NO |
| **Pagination** | NO |
| **Rate Limit** | 10 req / 60 sec |

### POST /api/v1/auth/login
| Field | Value |
|---|---|
| **Purpose** | Authenticate with email + password, receive JWT token pair |
| **Access** | PUBLIC |
| **Request Body** | `LoginDto { email, password }` |
| **Validation** | email: valid format; password: non-empty |
| **Success** | `200 OK` → `{ user: { id, email, fullName, roles }, accessToken, refreshToken }` |
| **Errors** | `400` (validation), `401` (invalid credentials), `401` (account deactivated) |
| **Blockchain** | NO |
| **DB** | SELECT users (read); INSERT auth_tokens |
| **Rate Limit** | 10 req / 60 sec |

### POST /api/v1/auth/refresh
| Field | Value |
|---|---|
| **Purpose** | Exchange a valid refresh token for a new access + refresh token pair (rotation) |
| **Access** | PUBLIC |
| **Request Body** | `RefreshTokenDto { refreshToken }` |
| **Success** | `200 OK` → `{ accessToken, refreshToken, user }` |
| **Errors** | `401` (invalid/revoked/expired token); `401` (security violation — all tokens revoked) |
| **Security Note** | If a **revoked** token is presented, ALL user tokens are immediately invalidated |

### POST /api/v1/auth/logout
| Field | Value |
|---|---|
| **Purpose** | Invalidate all active refresh tokens for the current user |
| **Access** | Any authenticated role |
| **Success** | `200 OK` → `{ message: "Logged out successfully" }` |
| **DB** | UPDATE auth_tokens SET revoked = true WHERE user_id = $1 |

### POST /api/v1/auth/forgot-password
| Field | Value |
|---|---|
| **Purpose** | Trigger a password reset email |
| **Access** | PUBLIC |
| **Request Body** | `ForgotPasswordDto { email }` |
| **Success** | `200 OK` → `{ message: "If this email exists, a reset link has been sent." }` |
| **Security Note** | Always returns 200 regardless of email existence — prevents user enumeration |
| **DB** | INSERT password_reset_tokens (short-lived, single-use) |

### POST /api/v1/auth/reset-password
| Field | Value |
|---|---|
| **Purpose** | Reset password using the token from the emailed link |
| **Access** | PUBLIC |
| **Request Body** | `ResetPasswordDto { token, newPassword }` |
| **Validation** | token: non-empty; newPassword: same strength rules as registration |
| **Success** | `200 OK` → `{ message: "Password reset successfully. Please log in." }` |
| **Errors** | `400` (invalid/expired token), `400` (weak password) |

---

## Module 2 — User Profile (`/api/v1/users`)

### GET /api/v1/users/me
| Field | Value |
|---|---|
| **Purpose** | Get the authenticated user's own profile |
| **Access** | All authenticated roles |
| **Success** | `200 OK` → full user object (no password_hash, no national_id in response) |

### PATCH /api/v1/users/me
| Field | Value |
|---|---|
| **Purpose** | Update own mutable profile fields (fullName, phone) |
| **Access** | All authenticated roles |
| **Request Body** | `UpdateProfileDto { fullName?, phone? }` |
| **Validation** | fullName: 3–100 chars letters/spaces; phone: 10–15 digits |
| **Success** | `200 OK` → updated user profile |
| **Notes** | email and nationalId changes require admin verification — not available here |

### PATCH /api/v1/users/me/wallet
| Field | Value |
|---|---|
| **Purpose** | Link or update a Stacks wallet address on the account |
| **Access** | All authenticated roles |
| **Request Body** | `LinkWalletDto { walletAddress }` |
| **Validation** | `@Matches(/^S[PT][A-Z0-9]{38,39}$/)` — Stacks principal format |
| **Success** | `200 OK` → `{ message: "Wallet linked successfully" }` |
| **Errors** | `409` (wallet already linked to another account) |

### PATCH /api/v1/users/me/password
| Field | Value |
|---|---|
| **Purpose** | Change own password (requires current password verification) |
| **Access** | All authenticated roles |
| **Request Body** | `ChangePasswordDto { currentPassword, newPassword }` |
| **Success** | `200 OK` → `{ message: "Password changed successfully." }` |
| **Errors** | `401` (currentPassword incorrect) |

### GET /api/v1/users
| Field | Value |
|---|---|
| **Purpose** | List all system users with pagination |
| **Access** | ADMIN only |
| **Query Params** | `?page=1&limit=20` |
| **Success** | `200 OK` → paginated user list (no password_hash in any record) |
| **Pagination** | YES |

### PATCH /api/v1/users/:id/role
| Field | Value |
|---|---|
| **Purpose** | Assign a role to a user. Assigning REGISTRAR also calls `initialize-registrar` on-chain |
| **Access** | ADMIN only |
| **Request Body** | `AssignRoleDto { role: UserRole }` |
| **Blockchain** | YES (only for REGISTRAR role) — `initialize-registrar` |
| **Errors** | `409` (user already has role), `400` (no wallet for REGISTRAR assignment) |

### PATCH /api/v1/users/:id/status
| Field | Value |
|---|---|
| **Purpose** | Activate or deactivate a user account |
| **Access** | ADMIN only |
| **Request Body** | `{ isActive: boolean }` |
| **Success** | `200 OK` → `{ message: "User account activated/deactivated." }` |

---

## Module 3 — Property Registration (`/api/v1/properties`)

### POST /api/v1/properties ⚡ BLOCKCHAIN WRITE
| Field | Value |
|---|---|
| **Purpose** | Register a new land property: DB insert + IPFS upload + on-chain minting |
| **Access** | REGISTRAR only |
| **Content-Type** | `multipart/form-data` |
| **Request Body** | `CreatePropertyDto` fields + `titleDeedFile` (PDF/JPG/PNG ≤ 5MB) |
| **Validation** | plotNumber: 3–20 chars; titleDeedNumber: 5–30 chars; address: 5–150 chars; landSize > 0; registrationDate ≤ today; ownerNationalId must match an existing user |
| **Success** | `202 Accepted` → `{ property, blockchainTxHash, status: "PENDING" }` |
| **Errors** | `400` (validation), `409` (duplicate plotNumber or titleDeedNumber), `404` (owner not found), `400` (owner has no wallet address) |
| **Blockchain** | YES — `register-property(propertyId, ownerPrincipal, titleDeedHash, ipfsDocHash)` |
| **DB** | INSERT properties (status=ACTIVE, blockchain_tx_hash=txid), INSERT ownership_records |
| **File Upload** | YES — uploaded to IPFS via Pinata; CID stored as `ipfs_hash` |
| **Async Flow** | Returns `202` immediately with txid; background polling updates `activity_logs` on confirmation |
| **Pagination** | NO |

**Property Registration Sequence:**
```
Client → POST /properties (form-data)
       → DTO validation (ValidationPipe)
       → title_deed_number uniqueness check (DB)
       → owner lookup by national_id (DB)
       → File → SHA-256 hash → Pinata IPFS → CID
       → titleDeedNumber → SHA-256 → 32-byte buffer
       → BlockchainService.registerProperty() → txid
       → DB INSERT properties { status=ACTIVE, blockchain_tx_hash=txid, token_id=N, ipfs_hash=CID }
       → DB INSERT ownership_records { acquisition_type=INITIAL_REGISTRATION }
       → Return 202 { property, txid }
       → [background] pollForConfirmation(txid)
             → success: activityLog BLOCKCHAIN_TX_CONFIRMED
             → abort:   property.status = INACTIVE + alert
```

### GET /api/v1/properties
| Field | Value |
|---|---|
| **Purpose** | List all registered properties with filtering |
| **Access** | REGISTRAR / ADMIN |
| **Query Params** | `?page=1&limit=20&status=ACTIVE&zoningType=RESIDENTIAL&search=Harare` |
| **Success** | `200 OK` → paginated property list |
| **Pagination** | YES |

### GET /api/v1/properties/:id 🔍 BLOCKCHAIN READ
| Field | Value |
|---|---|
| **Purpose** | Get full property details including optional on-chain enrichment |
| **Access** | REGISTRAR / ADMIN / OWNER (own properties) |
| **Success** | `200 OK` → `{ ...property, onChainState: { owner, status, registeredAt } }` |
| **Blockchain** | YES (read-only) — `get-property-info(tokenId)` |
| **Notes** | On-chain state is included for cross-verification. A mismatch between DB status and on-chain status is surfaced here. |

### GET /api/v1/properties/owner/:userId
| Field | Value |
|---|---|
| **Purpose** | List all properties owned by a specific user |
| **Access** | REGISTRAR / ADMIN / OWNER (own only) |
| **Query Params** | `?page=1&limit=20` |
| **Pagination** | YES |

### POST /api/v1/properties/:id/documents
| Field | Value |
|---|---|
| **Purpose** | Upload a supporting document for a property to IPFS |
| **Access** | REGISTRAR only |
| **Content-Type** | `multipart/form-data` |
| **Request** | `documentFile` (PDF/JPG/PNG ≤ 5MB) |
| **Success** | `201 Created` → `{ id, propertyId, fileName, fileType, ipfsHash, fileHash, fileSizeBytes, uploadedAt }` |
| **DB** | INSERT property_documents |
| **File Upload** | YES — IPFS via Pinata |

### GET /api/v1/properties/:id/documents
| Field | Value |
|---|---|
| **Purpose** | List all documents attached to a property |
| **Access** | REGISTRAR / OWNER (own) |
| **Success** | `200 OK` → array of document metadata (no file content — use ipfsHash to retrieve from IPFS) |

---

## Module 4 — Dashboard (`/api/v1/dashboard`)

### GET /api/v1/dashboard/summary
| Field | Value |
|---|---|
| **Purpose** | Returns role-specific dashboard summary counts and recent activity |
| **Access** | All authenticated roles |
| **Success** | `200 OK` → `{ role, totalProperties, pendingTransfers, activeDisputes, recentActivity[] }` |
| **Role Differences** | REGISTRAR/ADMIN: system-wide totals + pending queues. OWNER: own portfolio counts. BUYER: incoming approvals count. |

### GET /api/v1/dashboard/activity
| Field | Value |
|---|---|
| **Purpose** | Paginated activity feed showing the caller's recent actions |
| **Access** | All authenticated roles |
| **Query Params** | `?page=1&limit=20` |
| **Success** | `200 OK` → paginated `ActivityLog[]` |
| **Pagination** | YES |

---

## Module 5 — Ownership Transfer (`/api/v1/transfers`)

### POST /api/v1/transfers
| Field | Value |
|---|---|
| **Purpose** | Initiate an ownership transfer from seller to buyer (Step 1 of 3) |
| **Access** | OWNER only |
| **Request Body** | `InitiateTransferDto { propertyId, buyerId, saleValue?, notes? }` |
| **Validation** | propertyId: valid UUID; buyerId: valid UUID ≠ seller; saleValue > 0 if provided |
| **Business Rules** | Seller must be current owner; property must be ACTIVE; no pending transfer; buyer must exist and have a wallet address |
| **Success** | `201 Created` → transfer record (status: `PENDING_BUYER`) |
| **Errors** | `403` (not the owner), `409` (property disputed or transfer already pending), `404` (buyer not found) |
| **Blockchain** | YES — `initiate-transfer(propertyId, buyerAddress)` |
| **DB** | INSERT transfers; UPDATE properties SET status = PENDING_TRANSFER |

### GET /api/v1/transfers
| Field | Value |
|---|---|
| **Purpose** | List all transfers in the system |
| **Access** | REGISTRAR / ADMIN |
| **Query Params** | `?page=1&limit=20&status=PENDING_REGISTRAR` |
| **Pagination** | YES |

### GET /api/v1/transfers/mine
| Field | Value |
|---|---|
| **Purpose** | List transfers where the caller is the seller or the buyer |
| **Access** | OWNER / BUYER |
| **Query Params** | `?page=1&limit=20` |
| **Pagination** | YES |

### GET /api/v1/transfers/:id
| Field | Value |
|---|---|
| **Purpose** | Get full detail of a specific transfer including approval history |
| **Access** | REGISTRAR / ADMIN / OWNER or BUYER (involved parties only) |
| **Success** | `200 OK` → `{ ...transfer, seller, buyer, approvals[] }` |

### PATCH /api/v1/transfers/:id/buyer-approve ⚡ BLOCKCHAIN WRITE
| Field | Value |
|---|---|
| **Purpose** | Buyer consents to receive the property (Step 2 of 3) |
| **Access** | BUYER only |
| **Request Body** | `ApproveTransferDto { notes? }` |
| **Business Rules** | Caller must be the named buyer; transfer must be in PENDING_BUYER status |
| **Success** | `200 OK` → updated transfer (status: `PENDING_REGISTRAR`) |
| **Errors** | `403` (not the buyer), `409` (wrong status) |
| **Blockchain** | YES — `buyer-approve-transfer(propertyId)` |
| **DB** | UPDATE transfers; INSERT transfer_approvals (role=BUYER, action=APPROVED) |

### PATCH /api/v1/transfers/:id/registrar-approve ⚡ BLOCKCHAIN WRITE
| Field | Value |
|---|---|
| **Purpose** | Registrar finalizes the transfer — permanently changes on-chain owner (Step 3 of 3) |
| **Access** | REGISTRAR only |
| **Request Body** | `FinalizeTransferDto { notes? }` |
| **Business Rules** | Transfer must be in PENDING_REGISTRAR status (buyer must have approved) |
| **Success** | `200 OK` → `{ transfer, blockchainTxHash }` (status: `CONFIRMED`) |
| **Errors** | `409` (buyer not yet approved), `409` (wrong status) |
| **Blockchain** | YES — `registrar-finalize-transfer(propertyId)` |
| **DB** | UPDATE transfers (CONFIRMED, txHash); UPDATE properties (currentOwner); UPDATE ownership_records (released_at); INSERT ownership_records (new owner); INSERT transfer_approvals |
| **Async** | Optimistic DB update + background polling; rollback on chain abort |

### PATCH /api/v1/transfers/:id/cancel ⚡ BLOCKCHAIN WRITE
| Field | Value |
|---|---|
| **Purpose** | Cancel an in-progress transfer at any step |
| **Access** | OWNER (seller) or REGISTRAR |
| **Request Body** | `CancelTransferDto { notes? }` |
| **Business Rules** | Transfer must not be CONFIRMED or already CANCELLED |
| **Blockchain** | YES — `cancel-transfer(propertyId)` |
| **DB** | UPDATE transfers (CANCELLED); UPDATE properties (status=ACTIVE) |

### GET /api/v1/transfers/property/:propertyId/history
| Field | Value |
|---|---|
| **Purpose** | Full transfer history for a specific property |
| **Access** | REGISTRAR / ADMIN / OWNER (own) |
| **Success** | `200 OK` → `Transfer[]` ordered newest first |

---

## Module 6 — Ownership History (`/api/v1/ownership`)

### GET /api/v1/ownership/:propertyId/history
| Field | Value |
|---|---|
| **Purpose** | Get paginated ownership history from the PostgreSQL database |
| **Access** | All authenticated roles |
| **Query Params** | `?page=1&limit=20` |
| **Success** | `200 OK` → `{ data: OwnershipRecord[], total, page, limit }` |
| **Pagination** | YES |

### GET /api/v1/ownership/:propertyId/history/onchain 🔍 BLOCKCHAIN READ
| Field | Value |
|---|---|
| **Purpose** | Fetches ownership history directly from the Clarity contract |
| **Access** | REGISTRAR / ADMIN |
| **Success** | `200 OK` → `{ propertyId, tokenId, count, history: [{ seq, owner, acquiredAt }], mismatch: bool }` |
| **Blockchain** | YES (read-only) — N+1 calls: `get-ownership-history-count` + `get-ownership-history-entry` × N |
| **Notes** | `mismatch: true` means DB and on-chain have different ownership counts — a data integrity alert |

---

## Module 7 — Title Verification (`/api/v1/verify`)

### GET /api/v1/verify 🔍 BLOCKCHAIN READ
| Field | Value |
|---|---|
| **Purpose** | Verify property ownership cross-referencing DB and on-chain state |
| **Access** | PUBLIC — no JWT required |
| **Query Params** | `?plotNumber=HARARE-NW-01234` OR `?titleDeedNumber=TD2024/00345/H` OR `?ownerId=uuid` |
| **Success** | `200 OK` → `{ status: VERIFIED|MISMATCH|NOT_FOUND, property: {...publicFields}, onChainOwner }` |
| **Public Fields** | plotNumber, address, zoningType, status, registrationDate, tokenId, blockchainTxHash — no personal data |
| **Blockchain** | YES (read-only) — `verify-owner(tokenId, ownerWalletAddress)` |
| **DB** | SELECT property; INSERT verification_logs |
| **MISMATCH handling** | A MISMATCH result is logged as a severity-warning event and should alert an admin |

### GET /api/v1/verify/:propertyId 🔍 BLOCKCHAIN READ
| Field | Value |
|---|---|
| **Purpose** | Verify a specific property by its DB UUID |
| **Access** | PUBLIC |
| **Success** | Same shape as `GET /verify` |

---

## Module 8 — Dispute Management (`/api/v1/disputes`)

### POST /api/v1/disputes ⚡ BLOCKCHAIN WRITE
| Field | Value |
|---|---|
| **Purpose** | Raise a formal land dispute — locks the property on-chain |
| **Access** | OWNER / REGISTRAR |
| **Request Body** | `CreateDisputeDto { propertyId, disputeType, description }` |
| **Validation** | description: 20–1000 chars; disputeType: valid enum |
| **Success** | `201 Created` → `{ dispute, blockchainTxHash }` |
| **Errors** | `409` (property already disputed), `404` (property not found) |
| **Blockchain** | YES — `flag-dispute(propertyId)` — sets dispute flag, locks property, cancels pending transfer |
| **DB** | INSERT disputes; UPDATE properties (status=DISPUTED) |

### GET /api/v1/disputes
| Field | Value |
|---|---|
| **Purpose** | List all disputes |
| **Access** | REGISTRAR / ADMIN |
| **Query Params** | `?page=1&limit=20&status=OPEN` |
| **Pagination** | YES |

### GET /api/v1/disputes/mine
| Field | Value |
|---|---|
| **Purpose** | List disputes raised by the current user |
| **Access** | OWNER |

### GET /api/v1/disputes/:id
| Field | Value |
|---|---|
| **Purpose** | Get dispute detail including evidence and resolution |
| **Access** | REGISTRAR / ADMIN / OWNER (own disputes) |

### POST /api/v1/disputes/:id/evidence
| Field | Value |
|---|---|
| **Purpose** | Upload evidence file for a dispute |
| **Access** | OWNER / REGISTRAR |
| **Content-Type** | `multipart/form-data` |
| **Request** | `evidenceFile` (PDF/JPG/PNG ≤ 5MB) |
| **Success** | `201 Created` → `{ id, disputeId, ipfsHash, fileHash, fileName, uploadedAt }` |
| **DB** | INSERT dispute_evidence |
| **File Upload** | YES — IPFS via Pinata |

### PATCH /api/v1/disputes/:id/resolve ⚡ BLOCKCHAIN WRITE
| Field | Value |
|---|---|
| **Purpose** | Formally resolve a dispute — unlocks the property on-chain |
| **Access** | REGISTRAR only |
| **Request Body** | `ResolveDisputeDto { resolutionNotes }` (20–2000 chars) |
| **Success** | `200 OK` → `{ dispute, resolution, blockchainTxHash }` |
| **Blockchain** | YES — `resolve-dispute(propertyId)` — removes dispute flag, restores property to "active" |
| **DB** | UPDATE disputes (RESOLVED); INSERT dispute_resolutions; UPDATE properties (ACTIVE) |

---

## Module 9 — Admin (`/api/v1/admin`)

### GET /api/v1/admin/registrars
| Field | Value |
|---|---|
| **Purpose** | List all users with the REGISTRAR role |
| **Access** | ADMIN only |

### POST /api/v1/admin/registrars ⚡ BLOCKCHAIN WRITE
| Field | Value |
|---|---|
| **Purpose** | Authorize a user as a Land Registrar on-chain and in DB |
| **Access** | ADMIN only |
| **Request Body** | `{ userId: uuid }` |
| **Business Rules** | User must have a linked wallet address |
| **Blockchain** | YES — `initialize-registrar(walletAddress)` |
| **DB** | INSERT user_roles (REGISTRAR) |

### DELETE /api/v1/admin/registrars/:userId ⚡ BLOCKCHAIN WRITE
| Field | Value |
|---|---|
| **Purpose** | Revoke a registrar's authorization on-chain and in DB |
| **Access** | ADMIN only |
| **Blockchain** | YES — `remove-registrar(walletAddress)` |
| **DB** | DELETE user_roles WHERE role=REGISTRAR |

### GET /api/v1/admin/logs
| Field | Value |
|---|---|
| **Purpose** | Paginated system-wide activity log viewer |
| **Access** | ADMIN only |
| **Query Params** | `?page=1&limit=50&userId=uuid&entityType=Property&from=2024-01-01&to=2024-12-31` |
| **Pagination** | YES |

### GET /api/v1/admin/stats
| Field | Value |
|---|---|
| **Purpose** | System-wide aggregate statistics |
| **Access** | ADMIN only |
| **Success** | `200 OK` → `{ totalUsers, totalProperties, totalTransfers, confirmedTransfers, openDisputes, verificationCount }` |

---

## Transaction Confirmation Flow (Async Pattern)

```
1. Client → POST /api/v1/transfers/:id/registrar-approve
   (HTTP request — synchronous from client perspective)

2. NestJS TransferService:
   a. Load transfer from DB — validate status = PENDING_REGISTRAR
   b. Call BlockchainService.finalizeTransfer(tokenId)
      → makeContractCall() + broadcastTransaction() → txid returned in ~2 seconds
   c. Optimistic DB update (transaction):
      - transfers.status        = CONFIRMED
      - transfers.blockchain_tx_hash = txid
      - ownership_records (old) released_at = now
      - ownership_records (new) owner = buyer
      - properties.current_owner_id = buyer
      - properties.status       = ACTIVE
      - INSERT transfer_approvals (REGISTRAR, APPROVED)
   d. Return 200 { transfer, blockchainTxHash: txid }  ← HTTP response sent here

3. [Background, no await]:
   pollAndConfirmFinalization(txid)
   → polls GET /extended/v1/tx/{txid} every 10 seconds
   → status = 'success':
        ActivityLog: BLOCKCHAIN_TX_CONFIRMED
        (DB is already correct from step 2c)
   → status = 'abort_by_response':
        ROLLBACK all changes from step 2c:
          transfers.status           → PENDING_REGISTRAR
          ownership_records (new)    → DELETE
          ownership_records (old)    → released_at = NULL
          properties.current_owner_id → seller
          properties.status          → PENDING_TRANSFER
        ActivityLog: BLOCKCHAIN_TX_FAILED
        (Admin alert should be triggered here in production)
```

---

## Security Summary

| Concern | Implementation |
|---|---|
| Authentication | RS256 JWT, 15-min access tokens, 7-day refresh tokens stored as bcrypt hashes |
| Authorisation | `@Roles()` + `RolesGuard` on every route; global `APP_GUARD` in AppModule |
| Public routes | `@Public()` decorator bypasses JwtAuthGuard; used on `/verify/*` and `/auth/*` |
| Rate limiting | ThrottlerGuard globally (100 req/min); `@Throttle({ default: { limit: 10 } })` on login/register |
| Input validation | `ValidationPipe` globally with `whitelist: true, forbidNonWhitelisted: true` |
| HTTP headers | Helmet middleware — sets CSP, X-Frame-Options, HSTS, X-XSS-Protection |
| CORS | Restricted to `FRONTEND_URL` env var only; credentials allowed |
| File uploads | MIME type checked by Multer `fileFilter`; size limit 5MB; stored only in memory (no disk) |
| Private keys | Never in source code; only from env vars via ConfigService; never logged or returned |
| Sensitive field exclusion | `password_hash`, `national_id`, `email`, `phone` never returned in public API responses |
| Audit trail | Every state-changing endpoint writes to `activity_logs` via `ActivityLogService.log()` |
| Ownership checks | Service layer verifies `currentOwnerId === caller.sub` before any mutation |
| SQL injection | TypeORM parameterised queries — never string interpolation in WHERE clauses |
| Replay attack detection | Revoked refresh token reuse → all user tokens immediately invalidated |

---

## Standard HTTP Status Code Usage

| Code | When Used |
|---|---|
| `200 OK` | Successful read or state-neutral update |
| `201 Created` | New resource successfully created |
| `202 Accepted` | Blockchain transaction broadcast — confirmation pending |
| `400 Bad Request` | Validation failure or malformed request |
| `401 Unauthorized` | Missing/expired/invalid JWT token |
| `403 Forbidden` | Authenticated but wrong role or ownership violation |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate resource (title deed, plot number, email) or business rule violated (disputed property, active transfer) |
| `422 Unprocessable Entity` | Business rule violation that passes validation but fails logical constraints |
| `500 Internal Server Error` | Unhandled exception — logged, generic message returned to client |
