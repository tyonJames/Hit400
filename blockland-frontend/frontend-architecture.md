# BlockLand Zimbabwe — Frontend Architecture Document

**Framework:** Next.js 14 (App Router) | **State:** Zustand | **Styling:** Tailwind CSS v3  
**Wallet:** @stacks/connect | **Forms:** React Hook Form + Zod | **Tables:** TanStack Table

---

## Tech Stack Recommendations with Justification

### Framework: Next.js 14 App Router ✓ (over Pages Router and React + Vite)

**SSR vs CSR:** BlockLand needs a hybrid. The public verification portal (`/verify`) benefits from SSR — search engines index it and government stakeholders share links. The authenticated dashboard is client-rendered (real-time data, Zustand store, blockchain state). App Router handles both in one framework using Server Components for public pages and Client Components for interactive dashboards.

**Route Groups vs React Router:** App Router's route groups `(auth)` and `(dashboard)` cleanly separate the auth layout (centered card, no sidebar) from the dashboard layout (sidebar + topbar) without affecting URL paths. React Router would require manual layout switching. File-based routing also makes role-specific redirect logic deterministic — you always know which layout wraps which page.

**For a dissertation:** Next.js 14 is the industry standard for full-stack TypeScript apps. The examiner will recognise it immediately. It also supports the exact deployment target (Docker `output: standalone`) needed for P10.

### State Management: Zustand ✓ (over Redux Toolkit and Context + useReducer)

**What state does BlockLand actually need?**
- `AuthStore`: user, accessToken, isLoading — changes only on login/logout/refresh
- `BlockchainStore`: in-flight transaction states (pending → confirmed → failed)
- Server state (properties, transfers, disputes): handled by TanStack Query

Redux Toolkit would add 200+ lines of boilerplate for actions/reducers/selectors to manage essentially two global slices. Context + useReducer would cause unnecessary re-renders across the entire tree on every auth update. Zustand handles both stores in under 100 lines, supports DevTools inspection, and composes naturally with TanStack Query for server state.

**Blockchain tx state:** Zustand's `useBlockchainStore` holds pending tx objects keyed by txid. Components subscribe to their specific entity's tx state with fine-grained selectors — only the property card with a pending tx re-renders when its tx updates.

### Library Choices

| Concern | Chosen | Reason |
|---|---|---|
| Forms | React Hook Form + Zod | Zod schemas are reused as TypeScript types; RHF has zero re-renders on keystroke |
| UI components | Radix UI primitives | Accessible, unstyled — styled with Tailwind to match design system exactly |
| Icons | Lucide React | Consistent stroke weight, tree-shakeable, matches fintech dashboard aesthetic |
| Tables | TanStack Table v8 | Headless — property tables need client-side sort, filter, pagination |
| Notifications | Sonner | Best-in-class toast, rich-colors, accessible, minimal API |
| File upload | react-dropzone | Drag-and-drop + click, built-in MIME validation, preview support |
| Wallet | @stacks/connect | Official Hiro SDK — the only correct choice for Stacks wallet connection |
| Server state | TanStack Query v5 | Automatic cache invalidation, refetch-on-focus, optimistic updates |
| Date handling | date-fns | Tree-shakeable, immutable, no timezone issues |

---

## Full Frontend Architecture

```
blockland-frontend/
├── src/
│   ├── app/                          # Next.js App Router pages
│   │   ├── layout.tsx                # Root: fonts, providers, auth hydrator
│   │   ├── globals.css               # Design tokens + Tailwind base
│   │   ├── middleware.ts             # Edge route protection
│   │   │
│   │   ├── auth/                     # Auth pages (no sidebar)
│   │   │   ├── layout.tsx            # Split-panel auth layout
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   └── reset-password/page.tsx
│   │   │
│   │   ├── verify/                   # Public verification (no auth)
│   │   │   ├── page.tsx              # Search form + results
│   │   │   └── [propertyId]/page.tsx # Verify specific property
│   │   │
│   │   └── (dashboard)/              # Route group — all require auth + sidebar
│   │       ├── layout.tsx            # Sidebar + topbar + auth guard
│   │       ├── dashboard/page.tsx    # Role-specific home screen
│   │       ├── properties/
│   │       │   ├── page.tsx          # Property list (REGISTRAR) / portfolio (OWNER)
│   │       │   ├── new/page.tsx      # Register property form (REGISTRAR)
│   │       │   └── [id]/
│   │       │       ├── page.tsx      # Property detail + blockchain data
│   │       │       └── edit/page.tsx # Edit property (REGISTRAR)
│   │       ├── transfers/
│   │       │   ├── page.tsx          # Transfer list / incoming approvals
│   │       │   ├── new/page.tsx      # Initiate transfer (OWNER)
│   │       │   └── [id]/page.tsx     # Transfer detail + step indicator + approval
│   │       ├── disputes/
│   │       │   ├── page.tsx          # Dispute list
│   │       │   ├── new/page.tsx      # Raise dispute form
│   │       │   └── [id]/page.tsx     # Detail + evidence + resolution
│   │       ├── ownership/
│   │       │   └── [propertyId]/page.tsx  # Ownership timeline (DB + on-chain)
│   │       ├── profile/page.tsx      # Profile, wallet, password
│   │       └── admin/
│   │           ├── page.tsx          # Admin overview
│   │           ├── users/page.tsx    # User management
│   │           ├── registrars/page.tsx
│   │           └── logs/page.tsx     # Activity log viewer
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx           # Dark nav sidebar
│   │   │   └── topbar.tsx            # Top bar + user menu
│   │   ├── shared/
│   │   │   ├── auth-hydrator.tsx     # Session restoration on mount
│   │   │   ├── status-badge.tsx      # PropertyStatus, TransferStatus badges
│   │   │   ├── skeleton.tsx          # Reusable skeleton loader shapes
│   │   │   ├── empty-state.tsx       # Empty list placeholder
│   │   │   ├── confirm-modal.tsx     # Generic "Are you sure?" modal
│   │   │   ├── pagination.tsx        # Page controls for data tables
│   │   │   └── page-header.tsx       # Consistent page title + action button slot
│   │   ├── property/
│   │   │   ├── property-card.tsx     # Property grid card
│   │   │   ├── property-table.tsx    # TanStack Table for property list
│   │   │   ├── property-form.tsx     # Registration form (multipart)
│   │   │   ├── property-detail.tsx   # Detail sections + on-chain panel
│   │   │   └── blockchain-panel.tsx  # Token ID, tx hash, IPFS hash display
│   │   ├── transfer/
│   │   │   ├── transfer-step-indicator.tsx  # 3-step progress indicator
│   │   │   ├── transfer-card.tsx            # Transfer list item
│   │   │   ├── initiate-form.tsx            # Initiate transfer form
│   │   │   └── approval-panel.tsx           # Buyer/registrar approve action
│   │   ├── dispute/
│   │   │   ├── dispute-card.tsx             # Dispute list item
│   │   │   ├── dispute-form.tsx             # Raise dispute form
│   │   │   ├── evidence-upload.tsx          # Evidence file dropzone
│   │   │   └── resolution-form.tsx          # Registrar resolution form
│   │   ├── verification/
│   │   │   ├── verification-form.tsx        # Public search form
│   │   │   └── verification-result.tsx      # Result card with chain badge
│   │   └── blockchain/
│   │       ├── wallet-connect-btn.tsx       # Hiro Wallet connect button
│   │       ├── tx-hash-display.tsx          # Truncated hash + explorer link
│   │       ├── tx-pending-banner.tsx        # "Transaction pending" info bar
│   │       └── on-chain-indicator.tsx       # Live "On-Chain ✓" badge
│   │
│   ├── stores/
│   │   ├── auth.store.ts             # AuthUser, tokens, role helpers
│   │   └── blockchain.store.ts       # Pending/confirmed tx tracking
│   │
│   ├── hooks/
│   │   ├── use-properties.ts         # TanStack Query hooks for property data
│   │   ├── use-transfers.ts          # TanStack Query hooks for transfer data
│   │   ├── use-disputes.ts           # TanStack Query hooks for dispute data
│   │   ├── use-dashboard.ts          # Dashboard summary query hook
│   │   └── use-blockchain-poll.ts    # Polling hook for tx confirmation
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts             # Typed fetch wrapper + token refresh
│   │   │   └── services.ts           # Typed service functions per endpoint group
│   │   ├── schemas/
│   │   │   └── index.ts              # All Zod validation schemas
│   │   ├── stacks/
│   │   │   └── index.ts              # @stacks/connect config + wallet helpers
│   │   └── navigation.ts             # Route constants, sidebar nav, role redirects
│   │
│   └── types/
│       └── index.ts                  # All shared TypeScript interfaces
│
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── .env.local                        # See .env.example
```

---

## Page Breakdown with Components

### `/dashboard` — Role-Specific Home

| Role | Content |
|---|---|
| REGISTRAR | 4 stat cards (total props, pending transfers, open disputes, total registrars) + transfer queue table + dispute queue table |
| ADMIN | Same as registrar + user count + system health |
| OWNER | 3 stat cards (owned, pending transfers, disputes) + recent activity feed + portfolio preview |
| BUYER | 1 stat card (incoming approvals) + transfer approval list |

**Components:** `StatCard`, `TransferCard`, `DisputeCard`, `ActivityFeed`, `PropertyCard`

---

### `/properties` — Property List / Portfolio

**REGISTRAR/ADMIN view:** Full searchable table with status filter, zoning filter, date range. TanStack Table with sort on all columns. "Register Property" CTA in page header.

**OWNER view:** Card grid with toggle to table view. Filters: by status. Each card shows plot number, address, status badge, quick-action buttons (Initiate Transfer, Raise Dispute).

**Components:** `PropertyTable`, `PropertyCard`, `StatusBadge`, `EmptyState`, `Pagination`

---

### `/properties/new` — Register Property (REGISTRAR)

Multi-section form with the drag-and-drop file upload for the title deed.

**Form Sections:**
1. Plot Information (plotNumber, titleDeedNumber)
2. Location (address, gpsLat, gpsLng — with map preview placeholder)
3. Land Details (landSize, unit, zoningType, registrationDate)
4. Ownership (ownerNationalId — autocomplete search of registered users)
5. Notes & Documents (notes textarea, titleDeedFile dropzone)

**Submit flow:** Validate → confirm modal "This will register the property on the Stacks blockchain. Confirm?" → POST /properties → show tx pending banner.

---

### `/properties/[id]` — Property Detail

Four panels:

1. **Overview** — plot number, address, zoning, size, registration date
2. **Ownership** — current owner name + wallet address + link to ownership history
3. **Blockchain Panel** — Token ID, tx hash (→ Stacks Explorer link), IPFS hash (→ Pinata gateway link), on-chain status from `get-property-info`
4. **Documents** — list of uploaded property_documents with IPFS links
5. **Status Panel** — current status badge + action buttons appropriate to role

---

### `/transfers/[id]` — Transfer Detail with Step Indicator

The step indicator is the central UI element for transfers:

```
[1. Initiated ✓] ———— [2. Buyer Approved ✓] ———— [3. Registrar Approved] ———— [Confirmed]
```

Steps are colour-coded: done (emerald), active (teal pulse), pending (slate). Below the indicator: the transfer details, parties involved, and the action button appropriate to the current user's role at the current step.

---

## Blockchain Integration Points on the Frontend

### 1. Wallet Connection
**Component:** `WalletConnectButton`  
**When:** Profile page, sidebar bottom panel (if no wallet linked)  
**Flow:** `connectWallet()` → Hiro Wallet popup → `PATCH /users/me/wallet` → Zustand `setUser`

### 2. Transaction Pending State
**Component:** `TxPendingBanner`  
**When:** After any blockchain write endpoint returns 202  
**Flow:** Add to `useBlockchainStore` → poll `/properties/:id` every 5s → on status change update store → remove banner

### 3. TX Hash Display
**Component:** `TxHashDisplay`  
**Where:** Property detail (blockchain panel), transfer detail (confirmation), dispute detail  
**Format:** `0xabc123...def456` → clickable → Stacks Explorer URL

### 4. On-Chain Verification Badge
**Component:** `OnChainIndicator`  
**Where:** Property cards, verification results  
**Data:** From `onChainState` field on `GET /properties/:id` or from `GET /verify`  
**States:** `VERIFIED` (teal pulsing dot), `MISMATCH` (amber warning), `NOT_FOUND` (grey)

---

## Navigation Per Role

| Role | Post-Login Redirect | Visible Nav Items |
|---|---|---|
| ADMIN | `/admin` | Dashboard, Properties (all), Transfers (all), Disputes (all), Admin Panel, Verification, Profile |
| REGISTRAR | `/dashboard` | Dashboard, Properties (all + register), Transfers (all), Disputes (all + raise), Verification, Profile |
| OWNER | `/properties` | Dashboard, My Portfolio, My Transfers + Initiate, My Disputes + Raise, Verification, Profile |
| BUYER | `/transfers` | Dashboard, My Transfers (incoming), Verification, Profile |
| PUBLIC | `/verify` | Verification only (redirect away from all others) |

---

## Implementation Order (P8 will build the actual pages in this order)

```
1. Shared infrastructure (already done in P1):
   globals.css, types, api client, services, stores, schemas, stacks lib, navigation

2. Shared components:
   StatusBadge, TxHashDisplay, Skeleton, EmptyState, ConfirmModal, Pagination, PageHeader

3. Auth pages: Login → Register → ForgotPassword → ResetPassword

4. Dashboard layout: Sidebar + Topbar (already done in P1)

5. Dashboard page (role-specific summary cards + activity feed)

6. Property pages: List → Detail → New (registration form + file upload)

7. Transfer pages: List → Detail → Initiate form (includes step indicator)

8. Dispute pages: List → Detail → New form → Evidence upload

9. Verification portal (public — no auth, highest external visibility)

10. Ownership history page (DB + on-chain comparison)

11. Profile page (wallet connect, password change)

12. Admin pages (user management table, registrar control, activity log)

13. Polish: loading skeletons, empty states, mobile responsive sweep
```

---

## .env.local Template

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Stacks Blockchain
NEXT_PUBLIC_STACKS_NETWORK=testnet
NEXT_PUBLIC_CONTRACT_ADDRESS=ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
NEXT_PUBLIC_CONTRACT_NAME=blockland
NEXT_PUBLIC_STACKS_EXPLORER=https://explorer.hiro.so
```
