# BlockLand Zimbabwe — Complete UI/UX Wireframe Specification
# P7 Output → feeds directly into P8 (React/Next.js code generation)

---

## DESIGN SYSTEM REFERENCE

### Colour Tokens (CSS custom properties → Tailwind classes)
```
--sidebar:        #0F172A   bg-slate-900    Dark navy sidebar
--sidebar-surface:#1E293B   bg-slate-800    Card bg within sidebar
--page-bg:        #F8FAFC   bg-slate-50     Main content area
--primary:        #0D9488   bg-teal-600     CTAs, active states, on-chain
--primary-hover:  #0F766E   hover:bg-teal-700
--info:           #2563EB   bg-blue-600     Links, info states
--success:        #16A34A   bg-green-600    ACTIVE, VERIFIED, CONFIRMED
--warning:        #D97706   bg-amber-600    PENDING states
--danger:         #DC2626   bg-red-600      DISPUTED, errors, MISMATCH
--text-primary:   #0F172A   text-slate-900
--text-muted:     #64748B   text-slate-500
```

### Typography Scale
```
Page title:      24px / font-semibold / text-slate-900
Section heading: 18px / font-medium  / text-slate-900
Body:            14px / font-normal  / text-slate-700
Labels:          12px / font-medium  / uppercase tracking-widest / text-slate-500
Captions:        12px / font-normal  / text-slate-500
Hash/mono:       12px / font-mono    / text-slate-500
```

### Spacing Units (base 4px / Tailwind default)
```
Card padding:    p-6 (24px)
Section gap:     gap-6 (24px)
Form row gap:    gap-4 (16px)
Sidebar width:   260px / w-[260px]
Topbar height:   64px / h-16
Content max-w:   1280px / max-w-7xl mx-auto
```

### Status Badge Reference
```
ACTIVE:              bg-green-100  text-green-700  border-green-200
PENDING_TRANSFER:    bg-amber-100  text-amber-700  border-amber-200
PENDING_BUYER:       bg-blue-100   text-blue-700   border-blue-200
PENDING_REGISTRAR:   bg-amber-100  text-amber-700  border-amber-200
DISPUTED:            bg-red-100    text-red-700    border-red-200
INACTIVE:            bg-slate-100  text-slate-500  border-slate-200
CONFIRMED:           bg-teal-100   text-teal-700   border-teal-200  + ✓ icon
VERIFIED:            bg-teal-100   text-teal-700   border-teal-200
MISMATCH:            bg-red-100    text-red-700    border-red-200
NOT_FOUND:           bg-slate-100  text-slate-500  border-slate-200
OPEN (dispute):      bg-red-100    text-red-700    border-red-200
UNDER_REVIEW:        bg-amber-100  text-amber-700  border-amber-200
RESOLVED:            bg-green-100  text-green-700  border-green-200
BLOCKCHAIN_PENDING:  bg-blue-100   text-blue-600   border-blue-200  + pulsing dot
```

---

## ROLE-TO-NAVIGATION MAP

| Nav Item              | ADMIN | REGISTRAR | OWNER | BUYER |
|-----------------------|-------|-----------|-------|-------|
| Dashboard             | ✓     | ✓         | ✓     | ✓     |
| Users                 | ✓     | —         | —     | —     |
| Properties (all)      | ✓     | ✓         | —     | —     |
| Register Property     | —     | ✓         | —     | —     |
| My Properties         | —     | —         | ✓     | ✓ *   |
| Transfers (all)       | ✓     | ✓         | —     | —     |
| Transfer Approvals    | —     | ✓         | —     | —     |
| Initiate Transfer     | —     | —         | ✓     | —     |
| My Transfers          | —     | —         | ✓     | —     |
| Incoming Transfers    | —     | —         | —     | ✓     |
| Disputes (all)        | ✓     | ✓         | —     | —     |
| Dispute Queue         | —     | ✓         | —     | —     |
| My Disputes           | —     | —         | ✓     | —     |
| Registrars            | ✓     | —         | —     | —     |
| Activity Logs         | ✓     | —         | —     | —     |
| Verification          | ✓     | ✓         | ✓     | ✓     |

*BUYER sees only properties they now own after a confirmed transfer

**P8 implementation:** export a `NAV_ITEMS` config array with a `roles` field per item.
Filter with `navItems.filter(item => item.roles.includes(user.primaryRole))`.

---

## SCREEN 1 — AUTHENTICATION SCREENS

### 1A: Login Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  bg-slate-900 full screen with subtle grid pattern overlay          │
│                                                                     │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐ │
│  │  LEFT PANEL (hidden mobile)  │  │  RIGHT PANEL (form)          │ │
│  │  bg-slate-900                │  │  bg-white rounded-2xl        │ │
│  │                              │  │  shadow-xl p-8               │ │
│  │  ┌──────────────────────┐    │  │                              │ │
│  │  │ [BL] BlockLand       │    │  │  [BL] BlockLand (mobile)    │ │
│  │  │      Zimbabwe        │    │  │                              │ │
│  │  └──────────────────────┘    │  │  Sign in to your account     │ │
│  │                              │  │  ─────────────────────────   │ │
│  │  Zimbabwe's Land Registry.   │  │                              │ │
│  │  On the Blockchain.          │  │  Email address *             │ │
│  │                              │  │  [________________________] │ │
│  │  Secure, transparent, and    │  │                              │ │
│  │  tamper-proof land records   │  │  Password *                  │ │
│  │  anchored to Stacks.         │  │  [________________] [👁]    │ │
│  │                              │  │                              │ │
│  │  ✓ Immutable registration    │  │  ☐ Remember me    Forgot? → │ │
│  │  ✓ Verified transfers        │  │                              │ │
│  │  ✓ Public verification       │  │  [    Sign In    ] ← primary│ │
│  │  ✓ Dispute resolution        │  │                              │ │
│  │                              │  │  ───────────── or ───────── │ │
│  │  ──────────────────────────  │  │                              │ │
│  │  Final-year dissertation     │  │  Don't have an account?      │ │
│  │  Stacks Testnet · Clarity    │  │  [Create account] ← link    │ │
│  └──────────────────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- `<div>` two-column grid (lg:grid-cols-2)
- Left panel: decorative, brand text, feature bullets
- Right panel: `Card` (shadcn) with `CardContent`
- `Label` + `Input` (email, password with eye toggle)
- `Checkbox` + label "Remember me"
- `Button` variant="default" (primary teal) — full width
- `Link` "Forgot password?" → /auth/forgot-password
- `Link` "Create account" → /auth/register
- `useForm` with `zodResolver(loginSchema)` from React Hook Form

**Interaction States:**
- **Idle:** form empty, button disabled until both fields have input
- **Typing:** no validation until blur
- **Blur:** Zod validates — red border + red helper text below field if invalid
- **Submit click:** button shows `<Loader2 className="animate-spin" />` + "Signing in..." text, fields disabled
- **API error (401):** toast.error("Invalid email or password") — fields re-enabled
- **API success:** router.push(getPostLoginRedirect(user.roles))
- **Loading state:** skeleton version: two grey input bars + grey button

---

### 1B: Register Page

```
┌───────────────────────────────────────────────────────┐
│  Same two-panel layout as login                       │
│                                                       │
│  RIGHT PANEL (scrollable):                            │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Create your account                            │  │
│  │  ───────────────────────────────────────────    │  │
│  │                                                 │  │
│  │  Full Name *         National ID *              │  │
│  │  [______________]    [______________]           │  │
│  │  Letters and spaces  5–20 characters            │  │
│  │                                                 │  │
│  │  Email address *     Phone Number *             │  │
│  │  [______________]    [______________]           │  │
│  │                      10–15 digits only          │  │
│  │                                                 │  │
│  │  Password *          Confirm Password *         │  │
│  │  [______________]    [______________]           │  │
│  │  Min 8 chars, upper, number, special            │  │
│  │                                                 │  │
│  │  Stacks Wallet Address (optional)               │  │
│  │  [____________________________________________] │  │
│  │  SP... or ST... format                          │  │
│  │                                                 │  │
│  │  [        Create Account        ]               │  │
│  │                                                 │  │
│  │  Already have an account? Sign in →             │  │
│  └─────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────┘
```

**Component Inventory:**
- Two-column form grid on desktop (md:grid-cols-2), single column mobile
- `Label` + `Input` × 6 fields (fullName, nationalId, email, phone, password, confirmPassword)
- `Label` + `Input` × 1 optional field (walletAddress)
- Password strength indicator bar (4-segment: weak → strong)
- `Button` full width primary
- `Link` back to login

**Interaction States:**
- Password strength bar updates live as user types
- Confirm password validates on blur against password value
- walletAddress field: on blur, shows green checkmark if Stacks format valid
- On success: redirect to dashboard with welcome toast

---

### 1C: Forgot Password Page

```
┌───────────────────────────────────┐
│  Centered card (max-w-sm)         │
│  ┌─────────────────────────────┐  │
│  │  [BL] BlockLand             │  │
│  │                             │  │
│  │  Reset your password        │  │
│  │  Enter your email to        │  │
│  │  receive a reset link.      │  │
│  │  ─────────────────────────  │  │
│  │  Email address *            │  │
│  │  [_______________________]  │  │
│  │                             │  │
│  │  [ Send Reset Link ]        │  │
│  │                             │  │
│  │  ← Back to Sign In          │  │
│  └─────────────────────────────┘  │
│                                   │
│  SUCCESS STATE:                   │
│  ┌─────────────────────────────┐  │
│  │  ✉ Check your email         │  │
│  │  We sent a link to          │  │
│  │  you@example.com            │  │
│  │  (valid for 15 minutes)     │  │
│  │  [ ← Back to Sign In ]      │  │
│  └─────────────────────────────┘  │
└───────────────────────────────────┘
```

**Component Inventory:** `Card`, `Input`, `Button`, `Link`. After submit: card replaces form with success message (regardless of email existence — anti-enumeration).

---

## SCREEN 2 — MAIN APPLICATION SHELL

```
┌──260px──┬────────────────────────────────────────────────────────┐
│ SIDEBAR │                    TOPBAR (64px)                        │
│ #0F172A │  ┌──────────────────────────────────────────────────┐  │
│         │  │ Page Title / Breadcrumb  │ 🔔(3) │ [🔗 ST1...] │👤│ │
│ [BL]    │  └──────────────────────────────────────────────────┘  │
│ Block   │                                                         │
│ Land    │  ──────────────────────────────────────────────────    │
│         │                                                         │
│ ● Dashboard                MAIN CONTENT AREA                      │
│   Properties               bg-slate-50                            │
│   ├ Register               max-w-7xl mx-auto                      │
│   └ All Properties         px-6 py-6                              │
│   Transfers                                                        │
│   ├ Approvals              <page-specific content>                │
│   └ All                                                           │
│   Disputes                                                         │
│   ├ Queue                                                          │
│   └ All                                                           │
│   Verification                                                     │
│   ─────────                                                        │
│   [🔗 ST1...4xZA]                                                 │
│   [👤 T. Moyo    ]                                                │
│      Registrar                                                     │
└─────────┴───────────────────────────────────────────────────────┘
```

**Component Inventory:**
- `Sheet` (shadcn) — mobile sidebar drawer, triggered by hamburger `Button`
- Sidebar: `<nav>` with role-filtered `NavItem` components
- Active state: left 3px solid teal border + bg-slate-800 background
- `Button` variant="ghost" — notification bell with `Badge` count overlay
- **WalletPill:** conditional pill — teal "ST1...xZA" if connected, outlined "Connect Wallet" if not
- User avatar: `Avatar` (shadcn) with initials fallback + `DropdownMenu`
- Dropdown items: Profile, Change Password, `Separator`, Sign Out

**Interaction States:**
- **Active nav item:** teal left border, slate-800 bg, white text
- **Hover nav item:** slate-800 bg, transition 150ms
- **Collapsed sidebar (tablet):** shows icon only (w-16), tooltip on hover shows label
- **Mobile hamburger:** opens `Sheet` from left with full nav
- **Notification bell:** `Badge` shows unread count, click → notification dropdown list
- **WalletPill connected:** click → opens wallet info Sheet with address + explorer link
- **WalletPill disconnected:** click → `connectWallet()` from @stacks/connect

---

## SCREEN 3 — DASHBOARD (LAND WALLET)

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard                              Mon 15 Mar 2025         │
├─────────────┬─────────────┬─────────────┬──────────────────────┤
│ CARD 1      │ CARD 2      │ CARD 3      │ CARD 4 (role-based)  │
│             │             │             │                       │
│ 🏠 12       │ ↔ 3         │ ⚠ 1        │ REGISTRAR: ⏳ 5     │
│ Properties  │ Pending     │ Active      │ Pending Approvals     │
│ Owned       │ Transfers   │ Disputes    │                       │
│             │             │             │ OWNER: 💰 $45,000    │
│ ▲ +2 this   │ → view all  │ → view all  │ Estimated Value       │
│ month       │             │             │                       │
│             │             │             │ BUYER: 📥 2           │
│             │             │             │ Incoming Transfers     │
├─────────────┴─────────────┴─────────────┴──────────────────────┤
│                                                                  │
├────────────────────────────────┬───────────────────────────────┤
│  RECENT ACTIVITY               │  QUICK ACTIONS                │
│  ────────────────────────────  │  ─────────────────────────    │
│  ↗ Transfer Initiated          │                               │
│    Plot HD-0042 → R. Chiku...  │  [Register Property]          │
│    2 hours ago                 │  [Approve Transfer]           │
│                                │  [View Disputes]              │
│  ✓ Property Registered         │                               │
│    Plot HA-1205 confirmed      │  ─────────────────────────    │
│    Yesterday at 14:23          │  LAST TX STATUS               │
│                                │                               │
│  ⚠ Dispute Raised              │  ● TX pending...             │
│    Plot MW-0089                │  0x3f2a...8c1d               │
│    3 days ago                  │  [View on Explorer →]         │
│                                │                               │
│  [View all activity →]         │                               │
└────────────────────────────────┴───────────────────────────────┘
```

**Component Inventory:**
- 4× `Card` (shadcn) with `CardHeader`, `CardContent` — grid-cols-1/2/4
- Large number with label and delta indicator
- `ScrollArea` for Recent Activity list (if > 5 items)
- Activity item: icon + action text + entity link + relative timestamp (`date-fns formatDistance`)
- Quick Actions: 2–3 `Button` variant="outline" or "default" per role
- Last TX Status: `TxHashDisplay` custom component + status dot
- `Skeleton` — shown while `GET /dashboard/summary` is fetching

**Interaction States:**
- **Loading:** 4 skeleton cards, skeleton activity list (5 rows), skeleton quick actions
- **Stat card hover:** subtle shadow lift, card becomes slightly lighter
- **Activity item hover:** bg-slate-50 highlight, entity link underlines
- **Empty activity:** "No recent activity. Get started by registering a property."
- **TX pending dot:** pulsing blue dot animation (animate-pulse)
- **TX confirmed:** dot turns solid teal, text "Confirmed ✓"

---

## SCREEN 4 — PROPERTY REGISTRATION (REGISTRAR)

```
┌─────────────────────────────────────────────────────────────────┐
│  Register New Property                                           │
│  ← Back to Properties                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📋 Basic Details                                          │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  Plot Number *              Address *                      │  │
│  │  [___________________]      [_________________________]   │  │
│  │  3–20 alphanumeric          Min 5 characters              │  │
│  │                                                            │  │
│  │  Land Size *                Unit *                         │  │
│  │  [___________]              [Select unit ▾]               │  │
│  │  Positive number            SQM / HECTARE / ACRE           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📍 Location (optional)                                    │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  GPS Latitude               GPS Longitude                  │  │
│  │  [___________________]      [___________________]          │  │
│  │  e.g. -17.8292              e.g. 31.0522                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📜 Legal Details                                          │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  Title Deed Number *        Zoning Type *                  │  │
│  │  [___________________]      [Select zoning ▾]             │  │
│  │                                                            │  │
│  │  Registration Date *                                       │  │
│  │  [📅 Select date...]        (future dates disabled)        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  👤 Property Owner                                         │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  Search Owner by National ID *                             │  │
│  │  [🔍 Search users...                         ] ← Command  │  │
│  │                                                            │  │
│  │  Selected: Tendai Moyo (63-012345X-00)                     │  │
│  │  Wallet: ST1PQHQ...PGZGM  [linked ✓]                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📄 Title Deed Document *                                  │  │
│  │  ─────────────────────────────────────────────────────    │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │                                                     │  │  │
│  │  │     ⬆ Drag & drop or click to upload                │  │  │
│  │  │     PDF, JPG, PNG — max 5MB                         │  │  │
│  │  │                                                     │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  [After selection]: 📄 TitleDeed_Plot.pdf (2.4 MB) [✕]   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  📝 Additional Notes (optional)                            │  │
│  │  [                                                       ] │  │
│  │  [                                                       ] │  │
│  │                                          0 / 500 chars     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [  Cancel  ]                   [  Register Property →  ]       │
│                                 ← disabled until form valid      │
│                                                                  │
│  ┌ BLOCKCHAIN CONFIRMATION MODAL ───────────────────────────┐   │
│  │  ⚠ Confirm On-Chain Registration                         │   │
│  │  This will permanently register Plot HD-0042             │   │
│  │  on the Stacks blockchain.                               │   │
│  │  Owner: Tendai Moyo (ST1PQH...GZGM)                     │   │
│  │  This action cannot be undone.                           │   │
│  │                                                          │   │
│  │  [Cancel]         [Confirm & Register]                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- `Card` × 5 sections (Basic, Location, Legal, Owner, Documents)
- `Label` + `Input` — all form fields
- `Select` (shadcn) — unit, zoningType
- `Popover` + `Calendar` (shadcn) — registrationDate (future dates disabled)
- `Command` (shadcn combobox) — owner search with API autocomplete
- `FileUploadZone` (custom, wraps react-dropzone) — drag/drop + file preview
- `Textarea` — notes with char counter
- `Button` variant="outline" (Cancel) + variant="default" (Register Property)
- `AlertDialog` (shadcn) — irreversible action confirmation before submit
- `BlockchainPendingBanner` — shown after successful submit

**Interaction States:**
- **Owner search:** debounced API call to search users, shows dropdown list of matches
- **Owner selected:** displays name, national ID, wallet address status (linked / not linked)
- **No wallet warning:** amber inline alert "This owner has no linked wallet address. They must connect a wallet before this property can be registered on-chain."
- **File drop:** file zone border turns teal, shows file name + size + remove ✕
- **File too large:** red border on zone + "File exceeds 5MB limit"
- **Submit click:** `AlertDialog` opens with summary
- **After confirm:** button shows spinner, all fields disabled, `BlockchainPendingBanner` appears
- **After API response (202):** success toast + redirect to `/properties/{id}` with PENDING badge
- **After blockchain confirmation:** property status updates to ACTIVE (polled by frontend)

---

## SCREEN 5 — PROPERTY PORTFOLIO (MY PROPERTIES)

```
┌─────────────────────────────────────────────────────────────────┐
│  My Properties              [+ Register Property] ← REGISTRAR    │
├─────────────────────────────────────────────────────────────────┤
│  [🔍 Search plot, address...] [Status ▾] [Zone ▾]  [⊞ ≡ toggle]│
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CARD VIEW (default):                                            │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐      │
│  │  Plot HD-0042   │ │  Plot HA-1205  │ │  Plot MW-0089  │      │
│  │  ─────────────  │ │  ─────────────│ │  ─────────────  │      │
│  │  45 Samora M... │ │  12 Nelson... │ │  Farm Lot 3... │      │
│  │  Harare CBD     │ │  Bulawayo     │ │  Masvingo      │      │
│  │                 │ │               │ │                │      │
│  │ [ACTIVE ✓]      │ │[PENDING TRNSFR│ │[DISPUTED ⚠]   │      │
│  │ [ON-CHAIN 🔗]   │ │  amber badge] │ │  red badge]    │      │
│  │                 │ │               │ │                │      │
│  │ Token #1        │ │ Token #2      │ │ Token #3       │      │
│  │ 450 SQM RES     │ │ 2.4 HA AGR    │ │ 800 SQM COM    │      │
│  │                 │ │               │ │                │      │
│  │ [View][Transfer]│ │ [View][Cancel]│ │ [View][Resolve]│      │
│  └────────────────┘ └────────────────┘ └────────────────┘      │
│                                                                  │
│  TABLE VIEW (toggle):                                            │
│  ┌───────┬──────────┬──────────┬─────────┬────────┬──────────┐  │
│  │ Plot# │ Address  │ Status   │ Owner   │ Token  │ Actions  │  │
│  ├───────┼──────────┼──────────┼─────────┼────────┼──────────┤  │
│  │HD-0042│45 Samora…│[ACTIVE]  │T. Moyo  │ #1     │ [⋮]     │  │
│  │HA-1205│12 Nelson…│[PENDING] │R. Chiku…│ #2     │ [⋮]     │  │
│  │MW-0089│Farm Lot…│[DISPUTED]│T. Ndlovu│ #3     │ [⋮]     │  │
│  └───────┴──────────┴──────────┴─────────┴────────┴──────────┘  │
│                                                                  │
│  ← Prev    Page 1 of 8    Next →                                │
└─────────────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- `Input` with search icon prefix (shadcn)
- `Select` × 2 (Status filter, Zone filter)
- `ToggleGroup` (shadcn) — grid/table view toggle with icons
- **PropertyCard** (custom): `Card` + `Badge` (status) + `Badge` variant="outline" (On-Chain) + `Button` × 2-3
- `Table` (shadcn) — for table view with TanStack Table
- `DropdownMenu` — row actions (⋮ kebab)
- `Pagination` (shadcn) — page controls
- `Skeleton` × 6 card shapes — loading state
- Empty state: `EmptyState` custom component

**Interaction States:**
- **Search:** debounced filter (300ms), updates URL query param `?search=`
- **Status filter:** updates URL `?status=ACTIVE`
- **Card hover:** shadow-lg lift, border becomes slate-300
- **Card "Transfer" button:** hidden if status is DISPUTED or PENDING_TRANSFER
- **Card "Cancel Transfer":** shown only if PENDING_TRANSFER and user is seller
- **Table sort:** column header click, arrow icon indicates direction
- **Row kebab:** DropdownMenu with View, Transfer, Raise Dispute, View History
- **Loading:** skeleton cards (6 cards in grid)
- **Empty state (no properties):** "You don't own any properties yet." + "Explore the registry →"
- **Empty state (filters applied):** "No properties match your filters." + [Clear filters]

---

## SCREEN 6 — PROPERTY DETAIL

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Properties                                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  PROPERTY HEADER                                           │  │
│  │  Plot #HD-0042   [ACTIVE ●]   [🔗 ON-CHAIN]               │  │
│  │  45 Samora Machel Avenue, Harare CBD, Zimbabwe             │  │
│  │  Owner: Tendai Moyo  ·  Registered: 14 Aug 2023            │  │
│  │  450 SQM · RESIDENTIAL                                     │  │
│  │                                                            │  │
│  │  [Transfer Property]  [Raise Dispute]  [View History]      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── Tabs: Details | Documents | Ownership History | Blockchain ┐ │
│  │                                                              │ │
│  │  [Details tab — active]                                     │ │
│  │  ┌─────────────────────┐  ┌──────────────────────────────┐ │ │
│  │  │  LEGAL INFORMATION   │  │  LOCATION                    │ │ │
│  │  │  ─────────────────  │  │  ─────────────────────────   │ │ │
│  │  │  Title Deed:         │  │  Address:                    │ │ │
│  │  │  TD2024/00345/H      │  │  45 Samora Machel Ave       │ │ │
│  │  │  Zoning: Residential │  │  Harare CBD, Zimbabwe        │ │ │
│  │  │  Reg Date: 14/08/23  │  │  GPS: -17.8292, 31.0522     │ │ │
│  │  │  Land Size: 450 SQM  │  │  [Open in Maps →]            │ │ │
│  │  └─────────────────────┘  └──────────────────────────────┘ │ │
│  │                                                              │ │
│  │  [Blockchain tab]                                            │ │
│  │  ┌───────────────────────────────────────────────────────┐ │ │
│  │  │  BLOCKCHAIN RECORD                                    │ │ │
│  │  │  ───────────────────────────────────────────────────  │ │ │
│  │  │  TOKEN ID        LABEL Token #1                       │ │ │
│  │  │  TOKEN_VALUE     1                                    │ │ │
│  │  │                                                       │ │ │
│  │  │  TX HASH         LABEL                                │ │ │
│  │  │  0x3f2a...8c1d  [📋 copy] [↗ Stacks Explorer]       │ │ │
│  │  │                                                       │ │ │
│  │  │  IPFS HASH       LABEL                                │ │ │
│  │  │  QmYw...Pbdg    [📋 copy] [↗ View on IPFS]          │ │ │
│  │  │                                                       │ │ │
│  │  │  VERIFICATION    [VERIFIED ✓ ON-CHAIN]                │ │ │
│  │  │                                                       │ │ │
│  │  │  [🔍 Verify On-Chain Now]  ← calls GET /verify/:id   │ │ │
│  │  └───────────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────── ┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- Property header: custom hero section with status `Badge` + OnChain `Badge`
- Action buttons: `Button` × 3 (conditional on role + status)
- `Tabs` (shadcn) — Details, Documents, Ownership History, Blockchain
- `Card` × 2 within Details tab (Legal, Location)
- `TxHashDisplay` custom — mono text + copy `Button` + external `Link`
- `Badge` for verification status
- `Button` "Verify On-Chain" — calls GET /verify/:id
- Documents tab: file list with `ipfsGatewayUrl` links
- Ownership History tab: `OwnershipTimeline` (see Screen 9)

**Interaction States:**
- **"Transfer Property":** only shown when status=ACTIVE and user=currentOwner → navigates to `/transfers/new?propertyId=...`
- **"Raise Dispute":** hidden when status=DISPUTED → navigates to `/disputes/new?propertyId=...`
- **"Verify On-Chain":** shows spinner while fetching, result replaces badge
- **MISMATCH result:** red alert banner "⚠ Blockchain mismatch detected. Contact the Deeds Registry."
- **Copy hash:** click copies to clipboard + tooltip "Copied!" for 2 seconds
- **Blockchain tab:** if no TX hash → shows "Awaiting blockchain confirmation..." with `Skeleton`

---

## SCREEN 7 — OWNERSHIP TRANSFER WORKFLOW

### Step Indicator (persistent across all steps)
```
┌──────────────────────────────────────────────────────────────┐
│  [✓ 1 Initiate] ─── [● 2 Buyer Approves] ─── [3 Registrar] ─── [4 Confirmed]
│  done:teal         active:teal pulse       pending:slate   pending:slate  │
└──────────────────────────────────────────────────────────────┘
```

### Step 1: Initiate Transfer (OWNER)
```
┌──────────────────────────────────────────────────────────────┐
│  Initiate Transfer                                            │
│  [StepIndicator: Step 1 active]                               │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  PROPERTY                                              │   │
│  │  [🔍 Select property...  ▾]  OR pre-filled from detail │   │
│  │  Selected: Plot HD-0042 — 45 Samora Machel Ave [ACTIVE]│   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  BUYER                                                 │   │
│  │  [🔍 Search buyer by name or email...]   ← Command     │   │
│  │  Selected: Rudo Chikwanda (rudo@email.co.zw)           │   │
│  │  Wallet: ST2XYZ...89AB  [connected ✓]                  │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  SALE DETAILS (optional)                               │   │
│  │  Sale Value (USD)                                      │   │
│  │  [$  _______________]                                  │   │
│  │  Notes                                                 │   │
│  │  [_________________________________________________]   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─ TRANSFER SUMMARY ─────────────────────────────────────┐   │
│  │  Property:  Plot HD-0042                               │   │
│  │  From:      Tendai Moyo (you)                          │   │
│  │  To:        Rudo Chikwanda                             │   │
│  │  Sale Value: $45,000                                   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  [Cancel]                  [Initiate Transfer →]              │
└──────────────────────────────────────────────────────────────┘
```

### Step 2: Buyer Approval (BUYER)
```
┌──────────────────────────────────────────────────────────────┐
│  Approve Incoming Transfer                                    │
│  [StepIndicator: Step 2 active]                               │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  TRANSFER DETAILS                                      │   │
│  │  Property:   Plot HD-0042, 45 Samora Machel Ave        │   │
│  │  Seller:     Tendai Moyo                               │   │
│  │  Sale Value: $45,000 USD                               │   │
│  │  Initiated:  15 Mar 2025 at 10:23                      │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  By approving, you confirm:                                   │
│  ✓ You consent to receive this property                       │
│  ✓ You understand this will be recorded on the blockchain     │
│                                                               │
│  [✕ Decline Transfer]    [✓ Approve Transfer]                 │
│                          ← calls buyer-approve-transfer      │
└──────────────────────────────────────────────────────────────┘
```

### Step 3: Registrar Approval (REGISTRAR)
```
┌──────────────────────────────────────────────────────────────┐
│  Review & Finalize Transfer                                   │
│  [StepIndicator: Step 3 active]                               │
│                                                               │
│  ┌─────────────────────────┐  ┌─────────────────────────┐    │
│  │  PROPERTY               │  │  PARTIES                │    │
│  │  Plot HD-0042           │  │  Seller: Tendai Moyo    │    │
│  │  450 SQM Residential    │  │  Buyer:  Rudo Chikwanda │    │
│  │  [PENDING_TRANSFER]     │  │  Value:  $45,000        │    │
│  └─────────────────────────┘  └─────────────────────────┘    │
│                                                               │
│  ┌─ DOCUMENTS ───────────────────────────────────────────┐    │
│  │  📄 TitleDeed_HD0042.pdf  [View on IPFS →]           │    │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  Registrar Notes (optional)                                   │
│  [_______________________________________________________]    │
│  [Verified all documents in person on 15 Mar 2025.      ]    │
│                                                               │
│  [✕ Reject Transfer]    [✓ Approve & Finalize]               │
│                         ← calls registrar-finalize-transfer  │
└──────────────────────────────────────────────────────────────┘
```

### Step 4: Confirmed
```
┌──────────────────────────────────────────────────────────────┐
│  [StepIndicator: All steps ✓ complete]                        │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │       ✓  Transfer Complete                              │   │
│  │                                                        │   │
│  │  Plot HD-0042 is now owned by Rudo Chikwanda.          │   │
│  │                                                        │   │
│  │  Blockchain Transaction:                               │   │
│  │  0x9b1c...4a2f  [📋 copy] [↗ Stacks Explorer]         │   │
│  │                                                        │   │
│  │  [View Updated Property]  [View All Transfers]         │   │
│  └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**Component Inventory (all steps):**
- `StepIndicator` custom — 4 steps, teal active/done, slate pending
- `Command` (shadcn combobox) — property/buyer search with API
- `Card` sections — property, parties, documents, notes
- `Textarea` — registrar notes
- `Button` × 2 — decline/approve (always paired)
- `AlertDialog` — confirm before finalize (irreversible)
- `BlockchainPendingBanner` — shown after submit on steps 2 and 3
- `TxHashDisplay` — on Step 4 confirmation screen

---

## SCREEN 8 — TITLE VERIFICATION PORTAL (PUBLIC)

```
┌─────────────────────────────────────────────────────────────────┐
│  NO SIDEBAR — standalone page with minimal navbar               │
│                                                                  │
│  [🔗 BL] BlockLand Zimbabwe                     [Login →]       │
│  ─────────────────────────────────────────────────────────      │
│                                                                  │
│        VERIFY LAND TITLE                                         │
│        Confirm property ownership on the Stacks blockchain.      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  SEARCH BY                                               │    │
│  │  ○ Plot Number  ● Title Deed Number                      │    │
│  │                                                          │    │
│  │  [🔍 Enter plot number or title deed...          ]       │    │
│  │  [              Search              ]                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ── RESULT ─────────────────────────────────────────────────    │
│                                                                  │
│  ┌─── VERIFIED RESULT ──────────────────────────────────────┐   │
│  │  ✓  This property is verified on the Stacks blockchain.  │   │
│  │     On-chain and registry records match.                  │   │
│  │                                                          │   │
│  │  Plot #HD-0042              [ACTIVE]  [🔗 ON-CHAIN]      │   │
│  │  ────────────────────────────────────────────────────    │   │
│  │  Zoning:       Residential                               │   │
│  │  Land Size:    450 SQM                                   │   │
│  │  Registered:   14 Aug 2023                               │   │
│  │                                                          │   │
│  │  TOKEN ID      1                                         │   │
│  │  TX HASH       0x3f2a...8c1d  [📋] [↗ Explorer]         │   │
│  │                                                          │   │
│  │  Wallet:       ST1PQH...PGZGM  (current registered owner)│   │
│  │                                                          │   │
│  │  ⚠ For privacy, owner name is not displayed publicly.    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── MISMATCH RESULT ──────────────────────────────────────┐   │
│  │  ⚠ Discrepancy detected between registry and blockchain. │   │
│  │     Contact the Deeds Registry for assistance.           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── NOT FOUND RESULT ─────────────────────────────────────┐   │
│  │  ○ No property found for "XYZ-9999".                     │   │
│  │    Check the plot number or title deed number is correct. │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- Minimal top nav (no sidebar, no auth required)
- `RadioGroup` (shadcn) — search type toggle (Plot / Title Deed)
- `Input` — search field
- `Button` — search submit
- `VerificationResultCard` custom — three visual states (VERIFIED / MISMATCH / NOT_FOUND)
- VERIFIED: green alert banner + property data card
- MISMATCH: red alert banner with contact instruction
- NOT_FOUND: grey "not found" state
- `TxHashDisplay` — in VERIFIED result
- `Badge` — status and On-Chain badges
- No personal data rendered (no owner name, no email, no national ID)

**Interaction States:**
- **Empty search submit:** inline validation "Please enter a search term"
- **Loading:** `Skeleton` placeholder for result card
- **VERIFIED:** green left border on card, green top banner, all blockchain data shown
- **MISMATCH:** red left border, red warning banner, minimal data shown
- **NOT_FOUND:** grey card, friendly message, suggest checking spelling

---

## SCREEN 9 — OWNERSHIP HISTORY

```
┌─────────────────────────────────────────────────────────────────┐
│  Ownership History                                               │
│  Plot #HD-0042 — 45 Samora Machel Avenue, Harare                │
│                                   [Fetch from Blockchain ↗]     │
├─────────────────────────────────────────────────────────────────┤
│  [Timeline View] / [Table View]  toggle                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TIMELINE VIEW:                                                  │
│  ●─────────────────────────────────────────────────────────     │
│  │ 14 Aug 2023                                                   │
│  │ [REGISTERED]  badge                                           │
│  │ Tendai Moyo   ← owner name                                   │
│  │ Seq #0                                                        │
│  │ 0x3f2a...8c1d  [📋 copy] [↗ Explorer]                        │
│  │                                                               │
│  ●─────────────────────────────────────────────────────────     │
│  │ 02 Jan 2025                                                   │
│  │ [TRANSFERRED]  badge                                          │
│  │ Rudo Chikwanda ← owner name (current)                        │
│  │ Seq #1   ← from blockchain                                    │
│  │ 0x9b1c...4a2f  [📋 copy] [↗ Explorer]                        │
│  │                                                               │
│  ● CURRENT OWNER (dot is solid teal, no connector below)        │
│                                                                  │
│  TABLE VIEW:                                                     │
│  ┌──────┬────────────┬────────────┬───────────┬──────┬────────┐ │
│  │ Seq  │ Owner      │ Acquired   │ Released  │ Type │ TX Hash│ │
│  ├──────┼────────────┼────────────┼───────────┼──────┼────────┤ │
│  │  0   │ T. Moyo    │ 14 Aug '23 │ 02 Jan'25 │ INIT │0x3f2a…│ │
│  │  1   │ R. Chikwan.│ 02 Jan '25 │ Current   │ TRNSFR│0x9b1c…│ │
│  └──────┴────────────┴────────────┴───────────┴──────┴────────┘ │
│                                                                  │
│  ┌─ ON-CHAIN STATUS ──────────────────────────────────────────┐  │
│  │  DB records: 2    On-chain entries: 2    [MATCH ✓]         │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- `ToggleGroup` — timeline/table view
- `OwnershipTimeline` custom — vertical connector line + event dots
- `Collapsible` (shadcn) — each event expandable for full detail
- `Badge` — event type (REGISTERED / TRANSFERRED / DISPUTE_RESOLVED)
- `TxHashDisplay` — per event
- `Button` "Fetch from Blockchain" — calls GET /ownership/:id/history/onchain
- `Table` (shadcn) for table view
- Blockchain match status card — MATCH ✓ or MISMATCH ⚠

**Interaction States:**
- **Timeline event:** click to expand (Collapsible) shows full TX detail
- **Fetch from Blockchain:** spinner while calling on-chain endpoint, results compared with DB
- **MISMATCH:** amber warning banner "On-chain count (3) differs from database count (2). Contact admin."
- **Loading:** skeleton timeline (3 skeleton event dots)

---

## SCREEN 10 — DISPUTE MANAGEMENT

### Dispute List
```
┌─────────────────────────────────────────────────────────────────┐
│  Disputes                      [Raise Dispute]                   │
├─────────────────────────────────────────────────────────────────┤
│  [Status filter ▾]  [Type filter ▾]  [🔍 Search property...]    │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┬───────────┬───────────┬──────────┬────────┬──────┐ │
│  │ Property│ Type      │ Status    │ Raised By│ Date   │ Act. │ │
│  ├─────────┼───────────┼───────────┼──────────┼────────┼──────┤ │
│  │HD-0042  │ Ownership │ [OPEN]    │ T. Ndlovu│ 10 Mar │[View]│ │
│  │HA-1205  │ Boundary  │[REVIEWING]│ R. Chiku.│ 05 Mar │[View]│ │
│  │MW-0089  │ Fraud     │[RESOLVED] │ T. Moyo  │ 01 Feb │[View]│ │
│  └─────────┴───────────┴───────────┴──────────┴────────┴──────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Raise Dispute Form
```
┌─────────────────────────────────────────────────────────────────┐
│  Raise a Dispute                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  ⚠ Warning: Raising a dispute will lock this property   │    │
│  │  from all transfers until the dispute is resolved.      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  Property *                                                       │
│  [🔍 Select property...  ▾]                                       │
│                                                                   │
│  Dispute Type *                                                   │
│  [Select type...  ▾]   Ownership Claim / Boundary / Fraud / Other│
│                                                                   │
│  Description *                                                    │
│  [________________________________________________]              │
│  [                                                ]              │
│  [                                          ]  42 / 1000 chars   │
│                                                                   │
│  Evidence Files (optional)                                        │
│  ┌─────────────────────────────────────────────────────┐         │
│  │  ⬆ Drag & drop evidence files                       │         │
│  │  PDF, JPG, PNG — max 5MB each                       │         │
│  └─────────────────────────────────────────────────────┘         │
│  📄 boundary_survey.pdf (1.2 MB) [✕]                             │
│  📄 witness_statement.pdf (0.8 MB) [✕]                           │
│                                                                   │
│  [Cancel]                 [Submit Dispute]                        │
└─────────────────────────────────────────────────────────────────┘
```

### Dispute Detail (with Resolution for REGISTRAR)
```
┌─────────────────────────────────────────────────────────────────┐
│  Dispute #D-00123          [OPEN ●]                              │
│  ─────────────────────────────────────────────────────────      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Property:  Plot HD-0042                                 │   │
│  │  Type:      Ownership Claim                              │   │
│  │  Raised by: Tapiwa Ndlovu  on 10 Mar 2025                │   │
│  │  TX Hash:   0x2e3f...9a1c  [📋] [↗ Explorer]            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Description                                                      │
│  "I hold an original title deed for this plot dating from 2019.  │
│  The current registration appears to be fraudulent..."           │
│                                                                   │
│  Evidence Files                                                   │
│  📄 original_deed_2019.pdf  [View on IPFS →]                     │
│  📄 photo_boundary_markers.jpg  [View on IPFS →]                  │
│  [+ Upload more evidence]                                         │
│                                                                   │
│  ── REGISTRAR RESOLUTION ────────────────────────────────────    │
│  (shown only to REGISTRAR role)                                   │
│                                                                   │
│  Resolution Notes *                                              │
│  [________________________________________________]              │
│  [Survey conducted 12 Mar. Boundaries confirmed as per...]       │
│                                                                   │
│  [✕ Dismiss Dispute]    [✓ Resolve Dispute]                      │
│                         ← calls resolve-dispute on-chain         │
└─────────────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- `Table` — dispute list with `Badge` status
- `Select` × 2 — filter by status, type
- `Alert` (shadcn) — warning banner on raise form
- `Command` — property selector
- `Select` — dispute type dropdown
- `Textarea` with live char counter
- `FileUploadZone` — multi-file, shows file list
- `Button` "Upload more evidence" — opens file picker
- `Collapsible` — evidence file list if > 3 files
- `Textarea` — resolution notes (REGISTRAR only)
- `Button` × 2 — Dismiss / Resolve (REGISTRAR) or just View (OWNER)
- `AlertDialog` — confirm before resolve (irreversible on-chain action)
- `BlockchainPendingBanner` — after resolve submit

---

## SCREEN 11 — ADMIN / REGISTRAR CONTROL PANEL

```
┌─────────────────────────────────────────────────────────────────┐
│  Control Panel                                                    │
├─────────────────────────────────────────────────────────────────┤
│  [Transfers ▼]  [Disputes ▼]  [Users ▼]  [Registrars] [Logs ▼] │
│  ← Tabs component                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  TRANSFER APPROVALS TAB:                                          │
│  ┌──────────┬───────────┬──────────┬──────────┬────────────────┐ │
│  │ Property │ Seller    │ Buyer    │ Step     │ Actions        │ │
│  ├──────────┼───────────┼──────────┼──────────┼────────────────┤ │
│  │ HD-0042  │ T. Moyo   │ R. Chiku.│ [Step 3] │ [View][Approve]│ │
│  │ HA-1205  │ J. Ncube  │ F. Dube  │ [Step 3] │ [View][Approve]│ │
│  └──────────┴───────────┴──────────┴──────────┴────────────────┘ │
│                                                                   │
│  USERS TAB (ADMIN):                                               │
│  ┌─────────┬────────────┬──────────┬──────────┬────────────────┐ │
│  │ Name    │ Email      │ Role     │ Status   │ Actions        │ │
│  ├─────────┼────────────┼──────────┼──────────┼────────────────┤ │
│  │T. Moyo  │tendai@...  │[OWNER]   │[Active]  │[Edit][Deactivate]│
│  │R. Chiku.│rudo@...    │[BUYER]   │[Active]  │[Edit][Assign Role]│
│  │J. Zimba │james@...   │[REGISTRAR│[Active]  │[Edit][Remove Reg]│
│  └─────────┴────────────┴──────────┴──────────┴────────────────┘ │
│                                                                   │
│  ACTIVITY LOGS TAB:                                               │
│  [From Date 📅] [To Date 📅] [User ▾] [Entity Type ▾] [Search]  │
│  ┌───────────┬───────────┬─────────────────────┬──────────────┐  │
│  │ Timestamp │ User      │ Action              │ Entity       │  │
│  ├───────────┼───────────┼─────────────────────┼──────────────┤  │
│  │14:23 today│ T. Moyo   │ PROPERTY_REGISTERED │ Property:HD..│  │
│  │12:01 today│ System    │ BLOCKCHAIN_CONFIRMED │ Property:HA..│  │
│  └───────────┴───────────┴─────────────────────┴──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Component Inventory:**
- `Tabs` (shadcn) — Transfer Approvals, Disputes, Users, Registrars, Activity Logs
- `DataTable` custom (TanStack Table) — per tab
- `Badge` — role, status per user
- `Button` "Approve" → `AlertDialog` confirm → calls `PATCH /transfers/:id/registrar-approve`
- `Switch` (shadcn) — activate/deactivate user status
- `DropdownMenu` — row actions (kebab)
- `DatePicker` × 2 — from/to date filter on logs tab
- `Select` — user/entity filters
- `Pagination` — all tabs

**Interaction States:**
- **Approve button:** `AlertDialog` "Approve this transfer? This will finalize on-chain." [Cancel][Approve]
- **Approve confirmed:** button row shows spinner → `BlockchainPendingBanner` top of page
- **Deactivate user:** `AlertDialog` confirm → `Switch` toggles to false
- **Assign Registrar:** `Dialog` with summary "This will authorize [name]'s wallet on the Stacks blockchain." + confirm button
- **Log row:** click to expand JSON metadata in a `Collapsible`

---

## SCREEN 12 — NOTIFICATIONS & SYSTEM FEEDBACK

### Blockchain Pending Banner
```
┌─────────────────────────────────────────────────────────────────┐
│  ● Blockchain transaction pending — awaiting confirmation...     │
│    register-property · 0x3f2a...8c1d  [View on Explorer ↗]     │
│    This may take up to 60 seconds on Stacks testnet.            │
│                                                    [✕ Dismiss]  │
└─────────────────────────────────────────────────────────────────┘
```
- Blue background (bg-blue-50 border-blue-200)
- Pulsing dot (animate-pulse bg-blue-500)
- Persistent until polled status changes to 'success' or 'abort_by_response'

### Toast Variants (Sonner)
```
✓ Property registered successfully. Awaiting blockchain confirmation.  [green]
✗ Transfer failed. Buyer must connect a Stacks wallet first.          [red]
ℹ Verification complete. On-chain and registry records match.         [blue]
⚠ Blockchain tx aborted. Property registration was not completed.     [amber]
```

### Confirmation Dialog (AlertDialog)
```
┌──────────────────────────────────────────────────────────┐
│  ⚠ Confirm Transfer Initiation                           │
│                                                          │
│  You are about to transfer Plot HD-0042 to               │
│  Rudo Chikwanda. This will:                              │
│  • Lock the property from other transfers                │
│  • Submit a blockchain transaction                       │
│                                                          │
│  This action cannot be undone once confirmed on-chain.   │
│                                                          │
│  [Cancel]                    [Confirm Transfer]          │
└──────────────────────────────────────────────────────────┘
```

### Empty States
```
┌────────────────────────────────────────┐
│           🏠                           │  Properties:
│   No properties found                 │  "Get started by registering
│   Your property portfolio is empty.   │   your first property."
│                                        │
│   [Register Property →]                │
└────────────────────────────────────────┘

┌────────────────────────────────────────┐
│           ↔                           │  Transfers:
│   No transfers yet                    │  "Initiate your first transfer
│   No ownership transfers found.       │   from the Properties page."
│                                        │
│   [View Properties →]                  │
└────────────────────────────────────────┘
```

### Skeleton Loaders
```
Property Card skeleton:
┌──────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  ← plot number
│ ▓▓▓▓▓▓▓▓▓▓▓▓   │  ← address line 1
│ ▓▓▓▓▓▓▓▓       │  ← address line 2
│                  │
│ ▓▓▓▓▓  ▓▓▓▓▓▓  │  ← badge + badge
│ ▓▓▓▓▓  ▓▓▓▓▓   │  ← buttons
└──────────────────┘
```

---

## REUSABLE COMPONENT PROPS INTERFACES

### `PropertyCard`
```typescript
interface PropertyCardProps {
  property:     Property;
  onView:       () => void;
  onTransfer?:  () => void;    // hidden if status !== ACTIVE or user !== owner
  onDispute?:   () => void;    // hidden if status === DISPUTED
  onCancel?:    () => void;    // shown if status === PENDING_TRANSFER and user === seller
  compact?:     boolean;       // table row mode vs card mode
}
```

### `StatusBadge`
```typescript
interface StatusBadgeProps {
  status:   PropertyStatus | TransferStatus | DisputeStatus | VerificationStatus | 'pending' | 'confirmed';
  size?:    'sm' | 'md' | 'lg';        // default 'md'
  showDot?: boolean;                   // pulsing dot for blockchain states
}
```

### `TxHashDisplay`
```typescript
interface TxHashDisplayProps {
  txHash:     string;
  network?:   'testnet' | 'mainnet';   // default 'testnet'
  label?:     string;                  // "TX" | "IPFS" | "TOKEN"
  showCopy?:  boolean;                 // clipboard button
  showLink?:  boolean;                 // external link to explorer
  chars?:     number;                  // chars to show per side (default 8)
}
```

### `StepIndicator`
```typescript
interface StepIndicatorProps {
  steps:       { label: string }[];    // ['Initiate', 'Buyer Approves', 'Registrar Approves', 'Confirmed']
  currentStep: number;                 // 0-indexed: 0=step1, 1=step2, etc.
  className?:  string;
}
```

### `OwnershipTimeline`
```typescript
interface OwnershipTimelineProps {
  records: OwnershipRecord[];
  onFetchOnChain?: () => void;         // calls GET /ownership/:id/history/onchain
  isLoadingOnChain?: boolean;
  mismatch?: boolean;
}
```

### `VerificationResultCard`
```typescript
interface VerificationResultCardProps {
  result: VerificationResult;          // { status, property?, owner?, onChainOwner? }
  searchValue: string;                 // the search term that was entered
}
```

### `FileUploadZone`
```typescript
interface FileUploadZoneProps {
  onFilesSelected:  (files: File[]) => void;
  accept?:          string[];          // ['application/pdf', 'image/jpeg', 'image/png']
  maxSize?:         number;            // bytes, default 5 * 1024 * 1024
  multiple?:        boolean;           // default false
  label?:           string;
  error?:           string;
}
```

### `BlockchainPendingBanner`
```typescript
interface BlockchainPendingBannerProps {
  txid:       string;
  action:     string;                  // "register-property", "initiate-transfer", etc.
  network?:   'testnet' | 'mainnet';
  onDismiss?: () => void;
  onConfirmed?: () => void;            // called when polling detects success
}
```

### `DataTable`
```typescript
interface DataTableProps<T> {
  data:          T[];
  columns:       ColumnDef<T>[];       // TanStack Table column definitions
  loading?:      boolean;
  onRowClick?:   (row: T) => void;
  pagination?:   { page: number; total: number; limit: number; onPageChange: (p: number) => void };
  searchable?:   boolean;
  filterable?:   { key: string; options: string[] }[];
}
```

### `RoleGuard`
```typescript
interface RoleGuardProps {
  allowedRoles: UserRole[];
  children:     React.ReactNode;
  fallback?:    React.ReactNode;       // rendered if user lacks role — default: null
}
// Usage: <RoleGuard allowedRoles={['REGISTRAR']}><RegisterButton /></RoleGuard>
```

---

## FORM UX RULES

### Validation Timing
```
Field level:    validate on blur (onBlur mode in React Hook Form)
Form level:     validate ALL on first submit attempt; then field-level thereafter
Async checks:   e.g. title deed uniqueness — debounced 500ms API call on blur
```

### Error Display Pattern
```
┌─────────────────────────────────────────────┐
│ Plot Number *                               │
│ ┌─────────────────────────────────────────┐ │
│ │ ABC-123                         ← value │ │  border-red-400
│ └─────────────────────────────────────────┘ │
│ ⚠ Plot number already registered in the    │  text-red-600 text-xs
│   system. Use a different plot number.      │
└─────────────────────────────────────────────┘

Valid state:  border-green-400 + ✓ icon inside input
```

### Submit Button States
```
Idle (valid form):    [  Register Property  ]  bg-teal-600 text-white
Idle (invalid form):  [  Register Property  ]  bg-slate-200 text-slate-400 cursor-not-allowed
Loading:              [  ⟳ Submitting...    ]  bg-teal-600 text-white opacity-75 disabled
```

### Field Helper Text Patterns
```
GPS Lat:     "Decimal degrees format (e.g. -17.8292)"
Phone:       "10–15 digits, no spaces or dashes"
Password:    "Min 8 chars — include uppercase, number, and special character"
Wallet:      "Your Stacks wallet address (SP... for mainnet, ST... for testnet)"
Description: "20–1000 characters (x / 1000)"
```

---

## RESPONSIVE LAYOUT RULES

```
Desktop  (≥1280px):  Sidebar 260px fixed + content area, 4-col grid
Tablet   (768-1279): Sidebar 64px icons-only (hover to expand) + content, 2-col grid
Mobile   (<768px):   No sidebar; hamburger → Sheet; 1-col grid; tables → card stacks
```

### Specific Mobile Adaptations
- Property table → each row becomes a stacked card with all fields visible
- 4-column dashboard cards → 2×2 grid on tablet, 1-col stack on mobile
- Two-column forms → single column, full width inputs
- Step indicator → compact numbered pills with no connector labels on mobile
- Topbar → hide breadcrumb, show only hamburger + logo + avatar

---

## DESIGN-TO-CODE HANDOFF NOTES FOR P8

### shadcn/ui Component Mapping
```
Dashboard cards       → Card + CardHeader + CardContent + CardFooter
Status badges         → Badge variant="outline" with className overrides
Navigation sidebar    → custom (shadcn Sheet for mobile version)
Property table        → Table + TanStack Table integration
Owner/buyer search    → Command (combobox) with API fetch on input
Date picker           → Calendar + Popover + Button trigger
File upload           → react-dropzone (no shadcn equivalent)
Transfer step bar     → custom StepIndicator (Tailwind only)
Ownership timeline    → custom OwnershipTimeline + Collapsible
Confirmation dialogs  → AlertDialog
Information dialogs   → Dialog
Notifications         → Sonner (toast)
Blockchain pending    → custom BlockchainPendingBanner
Skeleton loaders      → Skeleton (shadcn)
Pagination            → Pagination (shadcn) or custom TanStack pagination
Wallet pill           → custom WalletPill using Badge + Button
```

### shadcn Installation Commands for P8
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add card badge button input label select
npx shadcn-ui@latest add dialog alert-dialog sheet tabs
npx shadcn-ui@latest add table pagination skeleton avatar
npx shadcn-ui@latest add command popover calendar collapsible
npx shadcn-ui@latest add dropdown-menu toggle-group separator
npx shadcn-ui@latest add checkbox switch textarea radio-group
npx shadcn-ui@latest add toast  # using sonner separately
```

---

## IMPLEMENTATION ORDER FOR P8

```
Priority 1 — Foundation (shared components, no API calls):
  StatusBadge, TxHashDisplay, StepIndicator, BlockchainPendingBanner
  FileUploadZone, DataTable, RoleGuard, EmptyState, Skeleton shapes

Priority 2 — Auth (blocks all other screens):
  Login → Register → ForgotPassword → ResetPassword

Priority 3 — Shell:
  Sidebar + Topbar + DashboardLayout (already started in P1)

Priority 4 — Dashboard:
  Dashboard summary page (connects to GET /dashboard/summary)

Priority 5 — Property core flow (most exam-critical):
  PropertyList → PropertyDetail → PropertyRegistrationForm

Priority 6 — Transfer workflow (blockchain showcase):
  TransferList → TransferDetail with StepIndicator
  → Step1 Form → Step2 Approval → Step3 Registrar → Step4 Confirmed

Priority 7 — Public verification (high visibility):
  VerificationPortal (public, no auth — standalone page)

Priority 8 — Disputes:
  DisputeList → DisputeDetail → RaiseDisputeForm → ResolveForm

Priority 9 — Ownership history:
  OwnershipTimeline + table + blockchain fetch

Priority 10 — Admin panel:
  ControlPanel with all Tabs

Priority 11 — Profile page:
  Profile + WalletConnect + ChangePassword

Priority 12 — Polish:
  Mobile responsive sweep, loading states, empty states, error boundaries
```
