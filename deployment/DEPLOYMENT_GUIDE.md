# BlockLand Zimbabwe — Deployment Guide
# One afternoon from zero to live. Follow phases in order.

---

## Prerequisites

```bash
node --version      # must be 18+
npm --version       # 9+
git --version       # any recent
clarinet --version  # must be 2.x

# Install Clarinet v2 if not installed
npm install -g @hirosystems/clarinet@latest
```

Create accounts before starting:
- **Railway** — railway.app (free)
- **Vercel** — vercel.com (free)
- **Pinata** — pinata.cloud (free, 1GB)
- **Hiro Wallet** — wallet.hiro.so (browser extension)

---

## Phase 1 — Deploy Clarity Smart Contract to Stacks Testnet

### 1.1 — Get testnet STX (free)

```bash
# Open your Hiro Wallet, copy your testnet address (starts with ST)
# Visit: https://faucet.stacks.co
# Paste your address → Request STX → wait ~30 seconds
# You need ~0.1 STX to cover deployment fees
```

### 1.2 — Configure Clarinet for testnet

```bash
cd blockland-contracts

# Add your deployer wallet mnemonic to Clarinet.toml
# Edit the [accounts.deployer] section:
nano Clarinet.toml
```

**Clarinet.toml deployer section:**
```toml
[accounts.deployer]
mnemonic = "your 24-word mnemonic phrase here"
balance = 1000000000  # simnet only, ignored on testnet
```

### 1.3 — Verify and test before deploying

```bash
# Check the contract compiles clean
clarinet check

# Run the full test suite — ALL 43 tests must pass
npm run test:contracts

# Expected output:
# ✓ Group 1: Registrar Authorization (6)
# ✓ Group 2: Property Registration (10)
# ✓ Group 3: Transfer Workflow (15)
# ✓ Group 4: Dispute Management (8)
# ✓ Group 5: Public Verification (4)
# Tests 43 passed (43)
```

### 1.4 — Generate and review deployment plan

```bash
clarinet deployments generate --testnet

# Review the generated plan
cat deployments/default.testnet-plan.yaml
```

### 1.5 — Deploy to testnet

```bash
clarinet deployments apply --testnet

# Expected output:
# Deploying contract blockland...
# Contract deployed: ST1PQHQKV0RJ...PGZGM.blockland
# Transaction: 0xabc123...
```

**Record the deployed contract address — you need it for all subsequent steps.**

```bash
# Example format: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.blockland
export CLARITY_CONTRACT_ADDRESS="ST_YOUR_ADDRESS.blockland"
```

### 1.6 — Verify on Stacks Explorer

```
https://explorer.hiro.so/address/ST_YOUR_ADDRESS?chain=testnet
```

You should see the `blockland` contract under "Contracts".

### 1.7 — Initialize registrar and register sample property

```bash
# Set environment variables
export DEPLOYER_MNEMONIC="your 24-word deployer mnemonic"
export REGISTRAR_MNEMONIC="your 24-word registrar mnemonic"
# (Can be the same wallet for dissertation demo)

# Run the seed script
cd blockland-backend
npx ts-node ../scripts/seed.ts

# Expected output:
# ✓ Registrar initialized on-chain
# ✓ Sample property #1 registered
# ✓ TX viewable at: https://explorer.hiro.so/txid/0x...?chain=testnet
```

---

## Phase 2 — PostgreSQL Database (Railway)

### 2.1 — Create Railway project

1. Go to **railway.app** → New Project
2. Click **Add a Plugin** → **PostgreSQL**
3. Wait for the database to provision (~30 seconds)
4. Click the PostgreSQL service → **Variables** tab
5. Copy the `DATABASE_URL` value

### 2.2 — Run TypeORM migrations

```bash
# Set the DATABASE_URL locally (from Railway Variables tab)
export DATABASE_URL="postgresql://postgres:xxx@yyy.railway.internal:5432/railway"

cd blockland-backend

# Run all migrations against the live database
npm run migration:run

# Verify: should report "1 migration executed" for InitialSchema
```

### 2.3 — Seed demo data

```bash
# Generate bcrypt hash for the demo password 'Blockland1!'
node -e "const b=require('bcrypt'); b.hash('Blockland1!',12).then(console.log)"

# Copy the hash, then paste it into the Railway PostgreSQL console:
# railway run psql $DATABASE_URL -f scripts/demo-seed.sql
```

---

## Phase 3 — NestJS Backend (Railway)

### 3.1 — Generate RSA key pair for JWT

```bash
# Run once — store the output securely
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Base64-encode for environment variables
cat private.pem | base64 | tr -d '\n' | pbcopy   # → JWT_PRIVATE_KEY
cat public.pem  | base64 | tr -d '\n' | pbcopy   # → JWT_PUBLIC_KEY

# Delete the .pem files immediately after copying
rm private.pem public.pem
```

### 3.2 — Connect GitHub to Railway

1. Railway Project → **New Service** → **GitHub Repo**
2. Select your repository → set **Root Directory** to `blockland-backend`
3. Set **Build Command**: `npm run build`
4. Set **Start Command**: `node dist/main.js`

### 3.3 — Add all environment variables

In Railway → Service → **Variables**, add every variable from `.env.example`:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `DATABASE_URL` | (auto-set by Railway PostgreSQL plugin) |
| `FRONTEND_URL` | `https://blockland.vercel.app` (update after Vercel deploys) |
| `JWT_PRIVATE_KEY` | (base64 RSA private key from step 3.1) |
| `JWT_PUBLIC_KEY` | (base64 RSA public key from step 3.1) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `STACKS_NETWORK` | `testnet` |
| `STACKS_API_URL` | `https://api.testnet.hiro.so` |
| `CLARITY_CONTRACT_ADDRESS` | `ST_YOUR_ADDRESS.blockland` |
| `REGISTRAR_MNEMONIC` | (24-word mnemonic — Railway marks as secret) |
| `PINATA_API_KEY` | (from pinata.cloud/keys) |
| `PINATA_SECRET_API_KEY` | (from pinata.cloud/keys) |
| `PINATA_GATEWAY_URL` | `https://gateway.pinata.cloud` |

### 3.4 — Deploy and verify

```bash
# Railway auto-deploys when you push to main. Or trigger manually:
railway up

# Check logs
railway logs --tail 50

# Verify health check endpoint
curl https://blockland-api.up.railway.app/health
# Expected:
# {"status":"ok","blockchain":"testnet","contract":"ST...blockland","database":"connected","uptime":42,"timestamp":"..."}
```

---

## Phase 4 — Next.js Frontend (Vercel)

### 4.1 — Deploy to Vercel

1. Go to **vercel.com** → New Project → Import Git Repository
2. Select your repository → set **Root Directory** to `blockland-frontend`
3. Framework Preset: **Next.js** (auto-detected)

### 4.2 — Add environment variables in Vercel

In Vercel → Project → **Settings** → **Environment Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://blockland-api.up.railway.app/api/v1` |
| `NEXT_PUBLIC_STACKS_NETWORK` | `testnet` |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `ST_YOUR_ADDRESS.blockland` |
| `NEXT_PUBLIC_CONTRACT_NAME` | `blockland` |
| `NEXT_PUBLIC_STACKS_EXPLORER` | `https://explorer.hiro.so` |
| `NEXT_PUBLIC_IPFS_GATEWAY` | `https://gateway.pinata.cloud` |

### 4.3 — Deploy and update CORS

```bash
# Trigger first Vercel deployment
git push origin main

# After Vercel shows the URL (e.g. blockland.vercel.app):
# Go to Railway → Backend Service → Variables
# Update FRONTEND_URL to https://blockland.vercel.app
# Railway auto-redeploys with the updated CORS config
```

---

## Phase 5 — IPFS Document Storage (Pinata)

```bash
# 1. Create account at pinata.cloud
# 2. Go to API Keys → New Key → select: pinFileToIPFS + pinJSONToIPFS
# 3. Copy API Key and API Secret
# 4. Add to Railway Variables: PINATA_API_KEY and PINATA_SECRET_API_KEY

# Test that IPFS uploads work:
curl -X POST https://blockland-api.up.railway.app/api/v1/properties \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "titleDeedFile=@test-deed.pdf" \
  -F "plotNumber=TEST-001" \
  # ... other fields

# Verify the returned ipfsHash opens:
open https://gateway.pinata.cloud/ipfs/QmYOURHASH
```

---

## End-to-End Verification Checklist

Run through this checklist after all four phases are complete.

```
□ 1. Frontend loads at https://blockland.vercel.app — no console errors
      Expected: Login page with BlockLand branding

□ 2. GET /health returns 200 with correct contract address
      Command: curl https://blockland-api.up.railway.app/health
      Expected: {"status":"ok","blockchain":"testnet","contract":"ST...blockland",...}

□ 3. Register a new user via the frontend registration form
      URL: /register → fill all fields → submit
      Expected: Redirect to dashboard, user visible in Railway DB

□ 4. Login returns JWT — dashboard loads with correct role-based nav
      URL: /login → enter credentials
      Expected: Sidebar shows role-appropriate nav items

□ 5. Connect Stacks wallet via WalletPill in top bar
      Click "Connect Wallet" → Hiro Wallet popup → approve
      Expected: Wallet address shown in sidebar and saved to user profile

□ 6. REGISTRAR: register a new property
      URL: /properties/new → fill form → submit
      Expected: BlockchainPendingBanner appears, property shows PENDING badge
      After 30-60s: Status transitions to ACTIVE on blockchain confirmation

□ 7. Verify property on Stacks testnet explorer
      URL: https://explorer.hiro.so/txid/{tx_hash}?chain=testnet
      Expected: register-property contract call visible, success status

□ 8. Public verification portal — search by plot number
      URL: /verify → enter plot number → Search
      Expected: VERIFIED result card with on-chain badge and TX hash

□ 9. Full transfer workflow (3-step)
      Step 1: OWNER → /transfers/new → select property + buyer → Initiate
      Step 2: BUYER → /transfers/{id} → Approve Transfer
      Step 3: REGISTRAR → /transfers/{id} → Approve & Finalize
      Expected: Property owner changes in both DB and on-chain

□ 10. Document upload — IPFS storage
       URL: /properties/new → upload title deed PDF → submit
       Expected: ipfs_hash stored in DB, document viewable at
       https://gateway.pinata.cloud/ipfs/{CID}
```

---

## Troubleshooting Guide

### Issue 1: clarinet deployments apply fails with "insufficient funds"

```bash
# Your testnet wallet doesn't have enough STX
# Solution:
# 1. Get more free testnet STX: https://faucet.stacks.co
# 2. Wait for the faucet transaction to confirm (~30s)
# 3. Check your balance: https://explorer.hiro.so/address/ST_YOUR_ADDRESS?chain=testnet
# 4. Retry the deployment
```

### Issue 2: Railway health check fails — "database: disconnected"

```bash
# The API can't reach PostgreSQL
# Solution:
# 1. In Railway → PostgreSQL plugin → check it's running (green dot)
# 2. In Railway → Backend Service → Variables → verify DATABASE_URL is set
#    (Railway auto-injects this when the PG plugin is linked to the service)
# 3. Check if migrations ran: railway run npm run migration:run
# 4. Restart the backend service: Railway → Service → Restart
```

### Issue 3: JWT verification fails — "invalid signature" or "unable to verify"

```bash
# The JWT keys are misconfigured
# Solution:
# 1. Regenerate the RSA key pair:
#    openssl genrsa -out private.pem 2048
#    openssl rsa -in private.pem -pubout -out public.pem
# 2. Re-base64-encode WITHOUT newlines:
#    cat private.pem | base64 | tr -d '\n'
# 3. In Railway Variables, delete JWT_PRIVATE_KEY and JWT_PUBLIC_KEY
# 4. Paste the new base64 values (no quotes, no newlines)
# 5. Redeploy
```

### Issue 4: Frontend API calls fail — CORS error in browser

```bash
# The backend CORS allow-list doesn't include the Vercel URL
# Solution:
# 1. In Railway → Backend Service → Variables
#    Update FRONTEND_URL to exactly: https://blockland.vercel.app
#    (no trailing slash, must match the Vercel URL exactly)
# 2. Railway auto-redeploys with the new CORS config
# 3. Hard-refresh the browser (Ctrl+Shift+R / Cmd+Shift+R)

# If still failing, check the backend CORS config in src/main.ts:
# origin: configService.get('FRONTEND_URL')
# Should match the Vercel URL exactly
```

### Issue 5: Blockchain transactions stuck in "Awaiting confirmation" forever

```bash
# The REGISTRAR_MNEMONIC is wrong or the registrar has no STX
# Solution:
# 1. Verify the registrar address at faucet.stacks.co (check balance)
# 2. If balance is 0: request more testnet STX from the faucet
# 3. In Railway → Variables → check REGISTRAR_MNEMONIC is the correct 24 words
#    (no extra spaces, no quotes in the value)
# 4. Test: call GET /health — check the contract address matches what you deployed
# 5. Re-run: npx ts-node scripts/seed.ts to verify on-chain connectivity
```

---

## Dissertation Demo Preparation

### Demo Users (seed before the demonstration)

| Role | Email | Password | Notes |
|---|---|---|---|
| REGISTRAR | registrar@blockland.co.zw | Blockland1! | Can register properties, approve transfers, resolve disputes |
| OWNER | owner@blockland.co.zw | Blockland1! | Owns Property HD-0042 (ACTIVE) and HD-1205 (PENDING_TRANSFER) |
| BUYER | buyer@blockland.co.zw | Blockland1! | Incoming transfer awaiting approval |

### Demo Properties (pre-seeded)

| Plot # | Status | Notes |
|---|---|---|
| HD-0042 | ACTIVE | Token #1, registered on testnet, linked to IPFS document |
| HA-1205 | PENDING_TRANSFER | Transfer initiated from OWNER → BUYER, awaiting buyer approval |
| MW-0089 | DISPUTED | Flagged by REGISTRAR, shows dispute lock |

### Demo Script (10-minute examination)

```
Minute 0-2: Architecture Overview
  - Show the deployment architecture diagram
  - Explain the four layers: Stacks blockchain, NestJS, PostgreSQL, Next.js
  - Open https://explorer.hiro.so → show the deployed blockland contract

Minute 2-4: Public Verification (no auth)
  - Navigate to /verify
  - Search for "HD-0042"
  - Show the VERIFIED result card with TX hash and on-chain badge
  - Click the TX hash → opens Stacks Explorer showing the on-chain record

Minute 4-6: Property Registration (REGISTRAR role)
  - Login as registrar@blockland.co.zw
  - Navigate to /properties/new
  - Fill the form with new plot details + upload a PDF
  - Click "Register Property" → confirm dialog → BlockchainPendingBanner appears
  - Show the PENDING badge transitioning to ACTIVE after blockchain confirmation

Minute 6-9: Transfer Workflow (3-step)
  - As OWNER: /transfers/new → select HA-1205 → select buyer → Initiate
  - Switch to BUYER login → /transfers → click incoming transfer → Approve
  - Switch to REGISTRAR login → /transfers → click → Approve & Finalize
  - Show the blockchain TX hash on the confirmation screen
  - Open the TX on Stacks Explorer → show registrar-finalize-transfer call

Minute 9-10: Dispute Management
  - As REGISTRAR: click Raise Dispute on MW-0089
  - Show the DISPUTED badge + property locked from transfers
  - Show the on-chain flagDispute TX hash
```

### Links to include in dissertation appendix

```
Live System:
  Frontend:   https://blockland.vercel.app
  API:        https://blockland-api.up.railway.app
  Health:     https://blockland-api.up.railway.app/health
  Verify:     https://blockland.vercel.app/verify

Stacks Testnet:
  Contract:   https://explorer.hiro.so/address/ST_YOUR_ADDRESS.blockland?chain=testnet
  Explorer:   https://explorer.hiro.so/?chain=testnet

Source Code:
  GitHub:     https://github.com/YOUR_USERNAME/blockland-zimbabwe
```

### Pre-demo checklist (run 1 hour before examination)

```bash
# 1. Verify the API is healthy
curl https://blockland-api.up.railway.app/health | python3 -m json.tool

# 2. Verify the frontend loads
open https://blockland.vercel.app

# 3. Test login with all three demo accounts
# 4. Confirm the three demo properties exist in correct states
# 5. Have the Stacks Explorer open at the deployed contract
# 6. Have the dissertation document open to the System Access Details appendix
# 7. Charge your laptop!
```

---

## .gitignore (critical — add before first commit)

```gitignore
# Environment files — NEVER commit these
.env
.env.local
.env.production
.env.*.local

# RSA keys — NEVER commit these
*.pem
private.key
public.key

# Build outputs
dist/
.next/
node_modules/

# Test coverage
coverage/

# OS
.DS_Store
Thumbs.db

# Railway
.railway/
```

---

## TypeORM Migration Commands

```json
// Add to blockland-backend/package.json scripts:
{
  "scripts": {
    "migration:generate": "typeorm-ts-node-commonjs migration:generate -d src/database/data-source.ts",
    "migration:run":      "typeorm-ts-node-commonjs migration:run -d src/database/data-source.ts",
    "migration:revert":   "typeorm-ts-node-commonjs migration:revert -d src/database/data-source.ts",
    "migration:show":     "typeorm-ts-node-commonjs migration:show -d src/database/data-source.ts",
    "seed":               "ts-node ../scripts/seed.ts"
  }
}
```

**Golden rule:** `synchronize: false` in production. Always use migrations. Never `synchronize: true` on a database with real data.
