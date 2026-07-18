# SkySentinel MVP — Detailed Implementation Plan

## 1. Problem & Goal

Flight disruptions cost airlines billions in call-center overhead, SLA penalties, and churn. **SkySentinel** is an autonomous, privacy-first disruption agent that turns delay events into loyalty-building moments — using open-source/free-tier inference (Groq / OpenRouter), tokenized PII architecture, and a Human-in-the-Loop (HITL) approval gate.

**Goal for this sprint**: Ship a polished, locally-runnable Next.js hackathon demo that walks judges through the "Golden Path" described in the [PRD](file:///home/amit/hck/SkySentinal/PRD.md), with two developers working in parallel on non-overlapping file sets.

---

## 2. Collaboration Model

> [!IMPORTANT]
> Both developers work on `main` with **strict file ownership**. No feature branches — just pull → work → commit → push on owned files only.

### 2.1 Developer Roles

| Role | Developer | Location | Owns |
|------|-----------|----------|------|
| **UI Owner (Workflow A)** | Amit (local Codex) | This machine | `app/page.tsx`, `app/globals.css`, `components/**/*`, `public/**/*` |
| **Backend Owner (Workflow B)** | Collaborator | Remote | `app/api/**/*`, `lib/providers/**/*`, `lib/orchestration/**/*`, `lib/demo-data.ts`, `tests/**/*` |

### 2.2 Shared / Coordinated Files

These files are set during the **foundation commit** and must not be edited by either developer without syncing first:

| File | Rule |
|------|------|
| `lib/types.ts` | **Contract boundary**. Foundation commit defines v1. Any change requires both devs to agree on Slack/Discord before editing. |
| `package.json` | New `dependencies` require coordination. `devDependencies` are okay if they don't affect the other workflow. |
| `app/layout.tsx` | Set once in foundation. Only touch if both agree on metadata/font changes. |
| `next.config.ts` | Set once. Backend owner may add `env` config; UI owner must not edit. |
| `.env.example` | Backend owner adds new keys; UI owner does not edit. |
| `PRD.md` | Read-only reference. Never edit. |

### 2.3 Conflict Prevention Protocol

1. **Before starting work**: `git pull origin main`
2. **Before committing**: `git pull origin main` again
3. **Commit only owned files**: `git add <your-files>` — never `git add .`
4. **Never reformat** files you don't own
5. **Communication**: If you need to touch a shared file, message partner first and wait for ACK

---



## 4. Shared Type Contracts (`lib/types.ts`)

> [!IMPORTANT]
> This is the **single source of truth** for the API boundary between UI and Backend. Both workflows must code against these types. The foundation commit locks v1.

```typescript
// ──── Trace Events ────
export type TraceStatus = 'pending' | 'running' | 'done' | 'error';

export interface TraceEvent {
  id: string;                          // e.g. "trace-1"
  step: number;                        // 1-based order
  provider: 'appwrite' | 'amadeus' | 'contentstack' | 'surrealdb' | 'groq' | 'openrouter';
  label: string;                       // Human-readable, e.g. "Fetched affected passenger manifest"
  detail: string;                      // Technical detail, e.g. "(Tokenized via Appwrite)"
  durationMs: number;                  // e.g. 12
  status: TraceStatus;
  timestamp: string;                   // ISO 8601
}

// ──── Passenger Context (Tokenized — no PII) ────
export interface TokenizedPassenger {
  token: string;                       // e.g. "TKN-GOLD-4471"
  tier: 'standard' | 'silver' | 'gold' | 'platinum';
  preferences: {
    seatType: 'window' | 'aisle' | 'middle';
    dietaryNeeds: string;              // e.g. "Vegan"
    loungeAccess: boolean;
    loyaltyPoints: number;
  };
}

// ──── Flight Offers (Amadeus-shaped) ────
export interface FlightOffer {
  id: string;                          // e.g. "offer-1"
  airline: string;                     // e.g. "BA"
  flightNumber: string;               // e.g. "BA118"
  departure: string;                   // ISO 8601 datetime
  arrival: string;                     // ISO 8601 datetime
  origin: string;                      // IATA code
  destination: string;                 // IATA code
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
  availableSeats: number;
  priceDelta: number;                  // vs original ticket, in USD (can be negative)
  selected: boolean;                   // Whether the agent chose this one
}

// ──── Content Template (Contentstack-shaped) ────
export interface ContentTemplate {
  id: string;
  name: string;                        // e.g. "Premium Tier Weather Delay"
  locale: string;                      // e.g. "en-US"
  subject: string;                     // Email subject line
  bodyTemplate: string;                // Mustache-style template with {{placeholders}}
  disclaimers: string[];               // Legal/compliance footers
  brandTone: 'empathetic' | 'formal' | 'casual';
}

// ──── Recovery Package (Output of reasoning) ────
export interface RecoveryPackage {
  id: string;                          // e.g. "recovery-ba117-001"
  passengerToken: string;              // Links back to TokenizedPassenger
  originalFlight: {
    flightNumber: string;
    route: string;                     // e.g. "LHR-JFK"
    scheduledDeparture: string;
    delayReason: string;
    estimatedDelay: string;            // e.g. "3h 15m"
  };
  selectedAlternative: FlightOffer;
  upsells: Upsell[];
  draftMessage: string;               // Fully composed, ready for HITL review
  reasoning: string;                   // Agent's explanation of why it chose this option
  confidenceScore: number;             // 0-1, agent's self-assessed confidence
}

export interface Upsell {
  type: 'lounge_pass' | 'seat_upgrade' | 'meal_voucher' | 'wifi_pass' | 'priority_boarding';
  description: string;
  originalPrice: number;
  discountedPrice: number;
  currency: string;
}

// ──── De-tokenized Dispatch (Post-approval only) ────
export interface DispatchResult {
  passengerName: string;               // Real name — only revealed post-approval
  email: string;                       // Real email — only revealed post-approval
  phone: string;                       // Real phone — only revealed post-approval
  channels: ChannelStatus[];
  finalMessage: string;                // De-tokenized version of draftMessage
}

export interface ChannelStatus {
  channel: 'sms' | 'whatsapp' | 'email';
  status: 'queued' | 'sent' | 'delivered' | 'failed';
  sentAt: string | null;               // ISO 8601 or null if not yet sent
}

// ──── Metrics ────
export interface DemoMetrics {
  callCenterSaved: number;             // USD, e.g. 450
  upsellCaptured: number;             // USD, e.g. 20
  inferenceCost: number;               // USD, e.g. 0.0001
  totalPassengersProcessed: number;
  avgResponseTimeMs: number;
  modelUsed: string;                   // e.g. "llama-3-70b" or "mistral-7b"
}

// ──── API Request/Response Shapes ────
export interface SimulateDisruptionRequest {
  flightNumber: string;                // e.g. "BA117"
  route: string;                       // e.g. "LHR-JFK"
  reason: 'WX_DELAY' | 'MECHANICAL' | 'ATC_HOLD' | 'CREW_SHORTAGE';
}

export interface SimulateDisruptionResponse {
  traceEvents: TraceEvent[];
  passenger: TokenizedPassenger;
  alternativeFlights: FlightOffer[];
  recoveryPackage: RecoveryPackage;
  template: ContentTemplate;
  metrics: DemoMetrics;
}

export interface ApproveRequest {
  passengerToken: string;              // e.g. "TKN-GOLD-4471"
  recoveryId: string;                  // e.g. "recovery-ba117-001"
}

export interface ApproveResponse {
  dispatch: DispatchResult;
  updatedMetrics: DemoMetrics;
}
```

---

## 5. API Route Specifications (Backend Owner)

### 5.1 `POST /api/simulate-disruption`

**Purpose**: Orchestrate the full disruption response pipeline and return all artifacts for the UI to render step-by-step.

**Request Body**: `SimulateDisruptionRequest`

**Response Body**: `SimulateDisruptionResponse`

**Orchestration Steps** (in order — each produces a `TraceEvent`):

| Step | Provider Module | What It Does | Expected Duration |
|------|----------------|--------------|-------------------|
| 1 | `manifest.ts` | Fetch tokenized passenger manifest for the affected flight. Returns `TokenizedPassenger`. | ~12ms mock |
| 2 | `flight-offers.ts` | Query alternative flights for the same route+date. Returns `FlightOffer[]`. | ~412ms mock |
| 3 | `content-template.ts` | Retrieve the appropriate localized template based on tier + delay reason. Returns `ContentTemplate`. | ~85ms mock |
| 4 | `reasoning-draft.ts` | Feed tokenized context + flights + template to LLM. Returns draft message, reasoning, upsells, selected flight. | ~310ms mock |
| 5 | — | Assemble `RecoveryPackage` from all above outputs. Compute initial `DemoMetrics`. | ~5ms |

**Mock vs Real behavior**:
- **No env keys set**: All providers return deterministic mock data from `demo-data.ts`. Reasoning step returns a pre-written draft message.
- **`GROQ_API_KEY` set**: Step 4 calls Groq API (`https://api.groq.com/openai/v1/chat/completions`) with model from `GROQ_MODEL` env (default: `llama-3.3-70b-versatile`). System prompt includes tokenized passenger context, flight options, and template. Response is parsed into draft message + reasoning.
- **`OPENROUTER_API_KEY` set** (fallback if Groq unavailable): Step 4 calls OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) with model from `OPENROUTER_MODEL` env (default: `meta-llama/llama-3.3-70b-instruct:free`).

**Error handling**: If real inference fails, fall back to mock data and add an `error` trace event. Never let a live API failure break the demo.

---

### 5.2 `POST /api/approve`

**Purpose**: Simulate the HITL approval + de-tokenization + multi-channel dispatch.

**Request Body**: `ApproveRequest`

**Response Body**: `ApproveResponse`

**Steps**:

| Step | What It Does |
|------|--------------|
| 1 | Validate `passengerToken` matches the active simulation |
| 2 | Call `detokenize-dispatch.ts` to replace token with real PII (from mock data) |
| 3 | Generate `finalMessage` by replacing `{{passenger_name}}` in the draft |
| 4 | Simulate multi-channel dispatch: set all channels to `delivered` with timestamps |
| 5 | Compute `updatedMetrics`: increment `totalPassengersProcessed`, set `callCenterSaved`, `upsellCaptured`, `inferenceCost` |

---

## 6. Provider Module Specifications (Backend Owner)

Each module in `lib/providers/` must export a single async function with a well-defined signature. This is what the orchestration layer calls.

### 6.1 `manifest.ts` — Appwrite-shaped
```typescript
export async function fetchTokenizedManifest(
  flightNumber: string
): Promise<{ passenger: TokenizedPassenger; traceEvent: TraceEvent }>
```
- Mock: Returns `TKN-GOLD-4471` with Gold tier, window seat, vegan, lounge access, 45,000 points.
- Future: Appwrite SDK → query `passengers` collection filtered by `flightNumber`.

### 6.2 `flight-offers.ts` — Amadeus-shaped
```typescript
export async function fetchAlternativeFlights(
  origin: string,
  destination: string,
  date: string
): Promise<{ offers: FlightOffer[]; traceEvent: TraceEvent }>
```
- Mock: Returns 3 flights (BA118 +2h, VS456 +3h, AA789 +4h) with varying cabins and price deltas.
- Future: Amadeus Self-Service API → `GET /v2/shopping/flight-offers`.

### 6.3 `content-template.ts` — Contentstack-shaped
```typescript
export async function fetchTemplate(
  tier: string,
  delayReason: string,
  locale?: string
): Promise<{ template: ContentTemplate; traceEvent: TraceEvent }>
```
- Mock: Returns "Premium Tier Weather Delay" template with empathetic tone, disclaimers, and `{{passenger_name}}` placeholder.
- Future: Contentstack Delivery API → query Content Type `delay_templates` with filters.

### 6.4 `reasoning-draft.ts` — Groq/OpenRouter-shaped
```typescript
export async function generateRecoveryDraft(
  passenger: TokenizedPassenger,
  flights: FlightOffer[],
  template: ContentTemplate,
  options?: { apiKey?: string; model?: string; provider?: 'groq' | 'openrouter' }
): Promise<{ draft: string; reasoning: string; selectedFlightId: string; upsells: Upsell[]; confidence: number; traceEvent: TraceEvent }>
```
- Mock: Returns pre-written message selecting BA118, offering $20 lounge pass upsell, confidence 0.92.
- Real (Groq): POST to `https://api.groq.com/openai/v1/chat/completions` with OpenAI-compatible body. System prompt:
  ```
  You are SkySentinel, an airline disruption recovery agent. You receive TOKENIZED 
  passenger data (no real PII). Your job: select the best alternative flight, 
  recommend contextual upsells, and draft a warm, brand-compliant message using the 
  provided template structure. Output JSON with: selectedFlightId, upsells[], 
  draftMessage, reasoning, confidenceScore.
  ```
- Real (OpenRouter): Same prompt, different endpoint.

### 6.5 `detokenize-dispatch.ts` — Appwrite-shaped
```typescript
export async function detokenizeAndDispatch(
  passengerToken: string,
  draftMessage: string
): Promise<{ dispatch: DispatchResult; traceEvent: TraceEvent }>
```
- Mock: Maps `TKN-GOLD-4471` → `{ name: "Eleanor Vance", email: "e.vance@email.com", phone: "+44 7700 900123" }`. Replaces placeholders. Returns all 3 channels as `delivered`.
- Future: Appwrite Function → secure server-side token lookup + Twilio/SendGrid dispatch.

---

## 7. UI Component Specifications (UI Owner)

### 7.1 Design System (`app/globals.css`)

**Color Palette** (Dark mode, airline-premium aesthetic):

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `hsl(222, 47%, 6%)` | Main background — deep navy-black |
| `--bg-secondary` | `hsl(222, 35%, 10%)` | Card/panel backgrounds |
| `--bg-tertiary` | `hsl(222, 30%, 14%)` | Elevated surfaces, hover states |
| `--border` | `hsla(220, 30%, 30%, 0.4)` | Subtle borders |
| `--text-primary` | `hsl(210, 40%, 96%)` | Primary text — near-white |
| `--text-secondary` | `hsl(215, 20%, 65%)` | Secondary/muted text |
| `--accent-blue` | `hsl(217, 91%, 60%)` | Primary accent — links, active states |
| `--accent-cyan` | `hsl(190, 95%, 55%)` | Trace timeline highlights |
| `--accent-green` | `hsl(152, 69%, 50%)` | Success states, delivered channels |
| `--accent-red` | `hsl(0, 72%, 58%)` | Disruption trigger, error states |
| `--accent-amber` | `hsl(38, 92%, 55%)` | Warning, pending states |
| `--accent-purple` | `hsl(270, 65%, 60%)` | Inference/AI-related highlights |
| `--glass-bg` | `hsla(222, 35%, 12%, 0.7)` | Glassmorphism panels |
| `--glass-border` | `hsla(220, 40%, 40%, 0.2)` | Glass border |

**Typography**: Google Fonts — `Inter` for body, `JetBrains Mono` for trace/code elements.

**Animations**:
- `@keyframes fadeSlideUp` — cards entering the viewport
- `@keyframes pulseGlow` — the red disruption trigger button
- `@keyframes typewriter` — trace events appearing character by character
- `@keyframes channelLight` — channel icons lighting up green on dispatch
- `@keyframes counterTick` — metrics numbers counting up

**Glassmorphism recipe**: `backdrop-filter: blur(16px); background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 16px;`

---

### 7.2 `app/page.tsx` — Main Dashboard

**Layout**: Single-page app, no routing. Vertical stack of panels that progressively reveal as the golden path advances.

**State machine** (local React state, no external state management):

```
IDLE → SIMULATING → TRACE_COMPLETE → HITL_REVIEW → APPROVING → DISPATCHED
```

| State | What's visible |
|-------|---------------|
| `IDLE` | Header + TriggerPanel only. Everything else hidden/collapsed. |
| `SIMULATING` | TriggerPanel (disabled) + AgentTrace (events streaming in one by one) |
| `TRACE_COMPLETE` | TriggerPanel (disabled) + AgentTrace (all done) + HitlGate (slides in) |
| `HITL_REVIEW` | Same as TRACE_COMPLETE but HitlGate is front-and-center, glowing border |
| `APPROVING` | HitlGate shows spinner on "Approve" button |
| `DISPATCHED` | All panels visible: AgentTrace (complete) + HitlGate (approved badge) + ChannelDispatch (animated) + MetricsPanel (counting up) |

**Data flow**:
1. User clicks trigger → `POST /api/simulate-disruption` → response stored in state
2. `traceEvents` are revealed one-by-one with staggered delays matching their `durationMs`
3. After last trace event, `HitlGate` slides into view with `recoveryPackage` data
4. User clicks "Approve & De-Tokenize" → `POST /api/approve` → response stored
5. `ChannelDispatch` and `MetricsPanel` animate in with dispatch + metrics data

---

### 7.3 `TriggerPanel.tsx`

**Visual**: A dark glassmorphism card at the top of the dashboard. Contains:
- SkySentinel logo/wordmark (SVG or styled text)
- Subtitle: "Proactive Disruption Recovery Agent"
- Flight info block: `BA117 · LHR → JFK · Scheduled 13:45 UTC`
- Large red pulsing button: **"Simulate: WX Delay LHR→JFK (Flight BA117)"**
- Button has `pulseGlow` animation in `IDLE` state, becomes disabled+muted during simulation

**Props**:
```typescript
interface TriggerPanelProps {
  status: DemoState;  // controls button enabled/disabled + animation
  onTrigger: () => void;
}
```

---

### 7.4 `AgentTrace.tsx`

**Visual**: Terminal/console aesthetic. Monospace font (`JetBrains Mono`). Dark card with subtle scan-line effect.

Each trace event renders as a row:
```
[  12ms] ✓ Fetched affected passenger manifest (Tokenized via Appwrite)     APPWRITE
[412ms] ✓ Fetched 3 alternative LHR→JFK flights                           AMADEUS
[ 85ms] ✓ Retrieved "Premium Tier Weather Delay" localized template         CONTENTSTACK
[310ms] ✓ Reasoning recovery package & drafting message                    GROQ
[  5ms] ✓ Recovery package assembled                                       SYSTEM
```

- Events appear **one at a time** with a delay equal to the event's `durationMs` (scaled for UX — e.g., `durationMs * 2` minimum 300ms)
- Each event has a **typewriter entrance animation**
- Provider badge on the right uses the provider's brand color:
  - Appwrite → pink/magenta
  - Amadeus → blue
  - Contentstack → purple
  - SurrealDB → cyan
  - Groq → orange
  - OpenRouter → green
- Running event shows a spinner; completed shows a green check; error shows red ✗
- Duration badge is left-aligned in a fixed-width column

**Props**:
```typescript
interface AgentTraceProps {
  events: TraceEvent[];
  activeEventIndex: number;  // which event is currently "running"
}
```

---

### 7.5 `HitlGate.tsx`

**Visual**: The most prominent panel — appears with a dramatic slide-up animation and glowing amber border (the "high-stakes pause"). Contains:

1. **Header**: "🛡️ Human-in-the-Loop Review Required" with amber glow
2. **Passenger Context Card** (tokenized):
   - Token: `TKN-GOLD-4471`
   - Tier: Gold ⭐ (with badge)
   - Preferences: Window seat, Vegan, Lounge access
   - Points: 45,000
   - ⚠️ No PII visible — "Passenger identity is tokenized"
3. **Proposed Recovery Card**:
   - Original: BA117 LHR→JFK, Delayed 3h 15m (Weather)
   - Alternative: BA118, Departing 16:00, Economy, +$0
   - Upsell: First Class Lounge — ~~$35~~ **$20**
   - Agent confidence: 92% with a small bar
4. **Draft Message Preview**: Styled like an SMS/email preview bubble showing the composed message with `{{passenger_name}}` still tokenized
5. **Agent Reasoning**: Collapsible section showing the agent's explanation
6. **Action Buttons**:
   - **"Approve & De-Tokenize"** — large, green, prominent. Shows lock→unlock icon animation on hover
   - **"Reject"** — smaller, outlined, muted (for demo purposes, just resets to IDLE)

**Props**:
```typescript
interface HitlGateProps {
  passenger: TokenizedPassenger;
  recoveryPackage: RecoveryPackage;
  status: 'review' | 'approving' | 'approved';
  onApprove: () => void;
  onReject: () => void;
}
```

---

### 7.6 `ChannelDispatch.tsx`

**Visual**: Three large channel cards that "light up" sequentially with a 500ms stagger after approval:

| Channel | Icon | Status Animation |
|---------|------|-----------------|
| SMS | 💬 | Gray → pulsing amber → solid green with "Delivered ✓" |
| WhatsApp | 📱 | Same pattern, 500ms after SMS |
| Email | ✉️ | Same pattern, 500ms after WhatsApp |

Below the channels: **De-tokenized passenger reveal** — the real name/email/phone fade in with a dramatic "unlock" animation, emphasizing that PII only appears post-approval.

**Props**:
```typescript
interface ChannelDispatchProps {
  dispatch: DispatchResult | null;
  isAnimating: boolean;
}
```

---

### 7.7 `MetricsPanel.tsx`

**Visual**: Three metric cards in a horizontal row, each with a large animated counter and a label:

| Metric | Value | Color | Icon |
|--------|-------|-------|------|
| Call Center Saved | $450 | Green | 📞 |
| Upsell Captured | $20 | Blue | 📈 |
| Inference Cost | $0.0001 | Purple | ⚡ |

- Numbers count up from $0 using `counterTick` animation
- Below: small text showing `Model: llama-3-70b` and `Avg Response: 819ms`
- Optional: small sparkline or progress bar for visual flair

**Props**:
```typescript
interface MetricsPanelProps {
  metrics: DemoMetrics | null;
  isAnimating: boolean;
}
```

---

## 8. Mock Data Specification (`lib/demo-data.ts` — Backend Owner)

This file contains all deterministic demo data. The golden path uses these exact values:

### Passenger
- Token: `TKN-GOLD-4471`
- Tier: `gold`
- Seat: `window`, Diet: `Vegan`, Lounge: `true`, Points: `45000`
- Real PII (only used in de-tokenization): `Eleanor Vance`, `e.vance@email.com`, `+44 7700 900123`

### Original Flight
- Flight: `BA117`, Route: `LHR-JFK`, Scheduled: `2026-07-18T13:45:00Z`
- Delay reason: `WX_DELAY`, Estimated delay: `3h 15m`

### Alternative Flights
| ID | Flight | Departure | Cabin | Price Delta | Selected |
|----|--------|-----------|-------|-------------|----------|
| `offer-1` | BA118 | 16:00 | economy | $0 | ✓ |
| `offer-2` | VS456 | 17:30 | premium_economy | +$85 | |
| `offer-3` | AA789 | 18:15 | business | +$340 | |

### Template
- Name: "Premium Tier Weather Delay"
- Locale: `en-US`
- Tone: `empathetic`
- Subject: "Update on your flight BA117 — we've got you covered"

### Draft Message
```
Dear {{passenger_name}},

We're sorry for the delay on your BA117 flight from London Heathrow to New York JFK. 
Due to weather conditions, we've proactively secured you a seat on BA118, departing at 
4:00 PM today — a window seat, just how you like it.

While you wait, enjoy complimentary coffee at the Terminal 5 café. As a valued Gold 
member, we'd also like to offer you access to our First Class Lounge for just $20 
(normally $35) — the perfect place to relax before your flight.

Your meal preference (Vegan) has been noted for BA118.

Safe travels,
SkySentinel
```

### Upsell
- Type: `lounge_pass`, Description: "First Class Lounge Access", Original: $35, Discounted: $20, Currency: USD

### Trace Events
| Step | Provider | Label | Duration |
|------|----------|-------|----------|
| 1 | `appwrite` | "Fetched affected passenger manifest (Tokenized via Appwrite)" | 12ms |
| 2 | `amadeus` | "Amadeus API: Fetched 3 alternative LHR→JFK flights" | 412ms |
| 3 | `contentstack` | "Contentstack: Retrieved \"Premium Tier Weather Delay\" localized template" | 85ms |
| 4 | `groq` | "Groq (Llama-3-70b): Reasoning recovery package & drafting message" | 310ms |

### Metrics
- Call center saved: $450
- Upsell captured: $20
- Inference cost: $0.0001
- Model: `llama-3.3-70b-versatile`
- Avg response: 819ms

---

## 9. Environment Variables (`.env.example`)

```bash
# ─── Inference (Optional — app works without these) ───
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

OPENROUTER_API_KEY=
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free

# ─── Future Sponsor Integrations (Not used in v1) ───
AMADEUS_API_KEY=
AMADEUS_API_SECRET=

CONTENTSTACK_API_KEY=
CONTENTSTACK_DELIVERY_TOKEN=
CONTENTSTACK_ENVIRONMENT=

APPWRITE_ENDPOINT=
APPWRITE_PROJECT_ID=
APPWRITE_API_KEY=

SURREALDB_URL=
SURREALDB_NAMESPACE=
SURREALDB_DATABASE=
```

---

## 10. Foundation Commit Checklist

These items are completed in one atomic commit before either workflow begins:

- [ ] Run `npx -y create-next-app@latest ./` in `SkySentinal/` with TypeScript, App Router, no Tailwind, no src dir
- [ ] Clean default boilerplate (remove default page content, default CSS)
- [ ] Create `lib/types.ts` with all shared types from §4
- [ ] Create stub `lib/demo-data.ts` (Backend owner will fill in, but file must exist)
- [ ] Create stub `lib/providers/*.ts` files (export placeholder async functions)
- [ ] Create stub `lib/orchestration/*.ts` files
- [ ] Create stub `app/api/simulate-disruption/route.ts` and `app/api/approve/route.ts`
- [ ] Create stub `components/demo/*.tsx` files
- [ ] Create `docs/workflows/ui.md` and `docs/workflows/backend.md`
- [ ] Create `.env.example`
- [ ] Update `tasks.md` as coordination index
- [ ] Replace `plan.md` with this detailed plan
- [ ] Add Google Fonts (Inter, JetBrains Mono) to `app/layout.tsx`
- [ ] Commit: `chore: scaffold skysentinel collaboration structure`
- [ ] Push to `origin main`

---

## 11. Verification Plan

### Automated
```bash
npm run lint          # No errors
npm run build         # Clean production build
npm run test          # All provider + orchestration tests pass (Backend owner writes these)
```

### Manual Golden Path
1. `npm run dev` → `http://localhost:3000`
2. Dashboard loads with dark premium UI, pulsing red trigger button
3. Click trigger → trace events animate in one by one with provider badges
4. After trace completes → HITL gate slides in with tokenized passenger data
5. Verify NO real PII (name/email/phone) is visible anywhere
6. Click "Approve & De-Tokenize" → channels light up green sequentially
7. Real passenger name appears only after approval
8. Metrics count up to final values
9. Click trigger again → demo resets cleanly to IDLE state

### Responsive
- Desktop (1440px+): 3-column metrics, wide trace panel
- Tablet (768px): 2-column metrics, full-width panels
- Mobile (375px): Single column, all panels stack vertically

---

## User Review Required

> [!IMPORTANT]
> **File ownership assignments**: Confirm that the UI/Backend split described in §2.1 matches who will actually be working on what. The entire collaboration model depends on this.

> [!IMPORTANT]
> **Single-branch model**: The plan uses `main` with file ownership instead of feature branches. This is simpler but means both devs must be disciplined about only committing owned files. Want to switch to feature branches instead?

## Open Questions

> [!WARNING]
> **Collaborator onboarding**: Does your collaborator have access to this repo already? Do they need the plan pushed before they can start? I'll commit and push the foundation as part of execution.

> [!NOTE]
> **Real inference in v1**: The plan supports optional Groq/OpenRouter API keys. Do you want me to wire up real Groq inference during the UI workflow, or should that be exclusively the backend owner's responsibility?

> [!NOTE]
> **tasks.md**: Currently empty in git. The plan replaces it with a coordination index. Confirm this is okay.
