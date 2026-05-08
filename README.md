# BlockLand Zimbabwe — Local Setup Guide

BlockLand is a blockchain-based land administration system for Zimbabwe. It uses a dual-ledger architecture — PostgreSQL for operational data and the Stacks blockchain (anchored to Bitcoin) for immutable ownership records.

**Student:** Tinotenda James — H220349M  
**Supervisor:** Ms Chavhunduka  
**Institution:** Harare Institute of Technology

---

## System Components

| Component | Technology | Port |
|-----------|-----------|------|
| Backend API | NestJS 10, TypeORM, PostgreSQL | 3001 |
| Frontend | Next.js 14, Tailwind CSS | 3002 |
| Smart Contract | Clarity 2 on Stacks blockchain | — |

---

## Prerequisites

Install the following before proceeding:

| Tool | Version | Link |
|------|---------|------|
| Node.js | 20.x LTS | https://nodejs.org |
| PostgreSQL | 16.x | https://www.postgresql.org/download/ |
| npm | 10.x (bundled with Node.js) | — |

Verify your installation:

```bash
node --version    # should print v20.x.x
npm --version     # should print 10.x.x
psql --version    # should print 16.x
```

---

## Step 1 — Install Dependencies

Open a terminal in the project root and install dependencies for both services:

```bash
# Backend
cd blockland-backend
npm install

# Frontend
cd ../blockland-frontend
npm install
```

---

## Step 2 — Set Up the Database

Start PostgreSQL and create the database.

**Using psql (command line):**

```bash
psql -U postgres
```

```sql
CREATE DATABASE blockland_db;
\q
```

**Using pgAdmin:** Right-click Databases → Create → Database → name it `blockland_db`.

> The backend connects with username `postgres` and password `postgres` on port `5432`.  
> If your PostgreSQL uses different credentials, update `blockland-backend/.env` to match.

---

## Step 3 — Run Database Migrations

This creates all tables, indexes, foreign keys, and seeds the five system roles.

```bash
cd blockland-backend
npm run migration:run
```

Expected output ends with: `Migration ... has been executed successfully.`

---

## Step 4 — Create the Admin Account

```bash
cd blockland-backend
node seed-admin.js
```

This creates the administrator account used to manage all other users.

**Admin credentials:**

| Field | Value |
|-------|-------|
| Email | admin@blockland.co.zw |
| Password | Admin@1234 |

---

## Step 5 — Seed Test Data (Recommended)

Load 20 Zimbabwean test users with sample properties across Harare, Bulawayo, Mutare, and other cities:

```bash
cd blockland-backend
node seed-users.js
```

All seeded users share the password `Test@1234`. Sample logins are printed at the end of the script.

---

## Step 6 — Start the Backend API

```bash
cd blockland-backend
npm run start:dev
```

The API starts at: **http://localhost:3001**  
Interactive API docs (Swagger): **http://localhost:3001/api/docs**

Wait for the log line: `Application is running on: http://localhost:3001/api/v1`

---

## Step 7 — Start the Frontend

Open a second terminal:

```bash
cd blockland-frontend
npm run dev -- -p 3002
```

> The frontend **must** run on port **3002**. This is configured in the backend CORS policy.  
> Using port 3000 will cause API requests to be blocked by the browser.

The application opens at: **http://localhost:3002**

---

## Test Accounts

### Administrator

| Email | Password | Access |
|-------|----------|--------|
| admin@blockland.co.zw | Admin@1234 | Full system — user management, registrar assignment, approvals |

### Registrar

To create a Registrar account:
1. Register a new account via the frontend signup page
2. Log in as Admin → **Admin → Users** → approve the account
3. Go to **Admin → Registrars** → assign the Registrar role

### Property Owners (20 seeded users — all use password `Test@1234`)

| Full Name | Email | Properties |
|-----------|-------|-----------|
| Tendai Moyo | tendai.moyo@mail.co.zw | 2 |
| Farai Mhende | farai.mhende@mail.co.zw | 1 |
| Shumirai Dube | shumirai.dube@mail.co.zw | 3 |
| Blessing Ncube | blessing.ncube@mail.co.zw | 1 |
| Tatenda Mutasa | tatenda.mutasa@mail.co.zw | 2 |
| Rutendo Zimba | rutendo.zimba@mail.co.zw | 1 |
| Simba Chikwanda | simba.chikwanda@mail.co.zw | 2 |
| Nomvula Mpofu | nomvula.mpofu@mail.co.zw | 1 |
| Tinotenda Chikowore | tino.chikowore@mail.co.zw | 3 |
| Rudo Makoni | rudo.makoni@mail.co.zw | 1 |
| Innocent Ndlovu | innocent.ndlovu@mail.co.zw | 2 |
| Memory Chirwa | memory.chirwa@mail.co.zw | 1 |
| Prosper Mutsvairo | prosper.mutsvairo@mail.co.zw | 1 |
| Thandeka Sithole | thandeka.sithole@mail.co.zw | 2 |
| Kudzai Mutombo | kudzai.mutombo@mail.co.zw | 1 |
| Dakarai Chigumba | dakarai.chigumba@mail.co.zw | 1 |
| Sithembile Moyo | sithembile.moyo@mail.co.zw | 3 |
| Ngoni Masango | ngoni.masango@mail.co.zw | 1 |
| Ruvimbo Mapuranga | ruvimbo.mapuranga@mail.co.zw | 2 |
| Emmerson Takawira | emmerson.takawira@mail.co.zw | 2 |

---

## Blockchain Configuration

The system connects to the **Stacks testnet** (requires an active internet connection).

### What works without a crypto wallet

All core features work without a wallet:

- Property registration and approval workflow
- Viewing properties, ownership history, and title deed certificates
- The full transfer workflow (Registrar review → Payment → Seller confirmation → Final sign-off)
- Public property verification portal
- Dispute management
- Admin and registrar dashboards

### Buyer blockchain signing (optional)

The buyer-side blockchain signing step requires the **Hiro Wallet** browser extension:

1. Install **Hiro Wallet** from the Chrome Web Store
2. Create or restore a wallet
3. Switch the network to **Testnet** inside the wallet
4. Get free test STX from the faucet: https://explorer.hiro.so/sandbox/faucet?chain=testnet

> Without a connected wallet, all other transfer steps still complete normally through the registrar workflow.

### Smart contract

The Clarity smart contract is at `blockland-contracts/contracts/blockland.clar`.

| Setting | Value |
|---------|-------|
| Network | Stacks Testnet |
| Contract address | STT771M41X1KVVKVFHZSWXVQDDST159RDHMX2RTG |
| Contract name | blockland |

**To run the contract test suite locally:**

```bash
# Install Clarinet (Stacks smart contract development tool)
# Windows: winget install hirosystems.clarinet
# macOS:   brew install clarinet

cd blockland-contracts
npm install
npm test
```

The test suite uses Clarinet's simulated network — no internet or wallet required.

---

## Project Structure

```
blockland-backend/           NestJS REST API
  src/
    modules/                 13 feature modules (auth, property, transfer,
    │                        blockchain, admin, dispute, marketplace, ...)
    database/
      entities/              18 TypeORM entities
      1700000000000-...ts    Database migration
      data-source.ts         TypeORM CLI config
  seed-admin.js              Initial admin account seeder
  seed-users.js              Test data seeder (20 users + properties)
  .env                       Environment configuration (ready to use)
  api-reference.md           Full REST API documentation

blockland-frontend/          Next.js 14 web application
  src/
    app/                     App Router pages (40+ routes)
    components/              Layout and shared UI components
    lib/                     API client, Stacks helpers, Zod schemas
    stores/                  Zustand state (auth, blockchain)
  .env.local                 Environment configuration (ready to use)

blockland-contracts/         Clarity smart contract
  contracts/
    blockland.clar           Main contract (~700 lines)
  settings/
    Devnet.toml              Local devnet with pre-funded test wallets
  blockland.test.ts          Vitest test suite
  Clarinet.toml              Clarinet project config

deployment/                  Docker Compose (alternative setup — see below)
  docker-compose.yml
  Dockerfile

docs/
  wireframe-specification.md UI/UX design specification
```

---

## Alternative: Docker Setup

If you prefer Docker over a manual PostgreSQL install:

**Prerequisites:** Docker Desktop — https://www.docker.com/products/docker-desktop/

```bash
cd deployment
cp .env.example .env
# Edit .env and fill in the required values (see .env.example for guidance)
docker compose up --build
```

Then in a separate terminal:

```bash
docker compose exec api npm run migration:run
docker compose exec api node seed-admin.js
docker compose exec api node seed-users.js
```

Frontend: **http://localhost:3000** | Backend: **http://localhost:3001**

> Note: The Docker setup uses different database credentials from the manual setup. Use one approach or the other, not both.

---

## Troubleshooting

**"Your account is pending administrator approval"**  
Log in as admin and approve the user: Admin → Users → approve the account.

**Database connection error on startup**  
Confirm PostgreSQL is running, the `blockland_db` database exists, and the credentials in `blockland-backend/.env` match your PostgreSQL installation.

**Migration fails with "relation does not exist"**  
Ensure `blockland_db` was created before running migrations.

**CORS error / API calls blocked in browser**  
The frontend must run on port 3002. Stop and restart with: `npm run dev -- -p 3002`

**`seed-users.js` fails with "No admin user found"**  
Run `node seed-admin.js` first, then run `node seed-users.js`.

**Blockchain API errors (testnet)**  
These are non-fatal — they indicate the testnet is unreachable or the contract call failed. All PostgreSQL-backed features continue to work normally.

**Port already in use**  
Kill the process using the port:  
Windows: `netstat -ano | findstr :3001` then `taskkill /PID <pid> /F`

---

## Environment Files

Both environment files are pre-configured and ready to use:

- `blockland-backend/.env` — database, JWT, blockchain, and IPFS settings
- `blockland-frontend/.env.local` — API URL, blockchain network, contract address

No changes are needed for local development unless your PostgreSQL uses non-default credentials.
