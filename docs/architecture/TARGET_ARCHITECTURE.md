# 2. Target architecture

**Status:** proposed target; adopt incrementally via the
[migration roadmap](MIGRATION_ROADMAP.md). Nothing here is built yet.

---

## 2.1 Principles

1. **Modular monolith before microservices.** Service *boundaries* are drawn
   now as modules with explicit contracts; they become separate deployables
   only when a boundary has a proven scaling, ownership or failure-isolation
   need (brief §4, §6). No service is extracted to satisfy a checklist.
2. **Provider independence is a first-class boundary.** No layer above the
   inventory adapters may depend on a supplier's shapes, hashes, auth or
   error codes (brief §5).
3. **Non-negotiables are invariants, not features.** Financial integrity
   (decimal money, server-only net/markup/hashes), supplier-data validation
   at the boundary, cancellation accuracy from data (never a model), and
   server-side secret isolation hold in every phase (brief §13, `CLAUDE.md`).
4. **Stateless compute, external state.** Compute instances hold no durable
   or shared state; caches, locks, rate-limit tokens and sessions live in
   Redis/DB so any instance can serve any request.
5. **Data consistency over premature distribution.** Keep one PostgreSQL with
   service-owned *schemas* first; split into separate databases only where a
   service's load or lifecycle demands it. Cross-service writes that must be
   atomic use the **transactional outbox**, not distributed transactions.
6. **Fail soft.** One bad rate, one slow provider, one missing content row must
   degrade gracefully — never fail the whole page. This already holds at the
   row level; extend it to the provider level.

---

## 2.2 Layered view [Proposed]

```
                         ┌─────────────────────────────┐
         Browser ───────▶│  Web / BFF  (Next.js 16)     │  SSR, UI, session,
                         │  API Gateway responsibilities │  request validation,
                         └──────────────┬───────────────┘  secret isolation
                                        │ in-process calls (monolith)
                                        │ → HTTP/gRPC later (extracted)
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
        ▼               ▼               ▼               ▼               ▼
  ┌───────────┐  ┌───────────┐  ┌─────────────┐  ┌───────────┐  ┌───────────┐
  │  Search   │  │  Content  │  │  Inventory  │  │  Pricing  │  │ Identity/ │
  │  Service  │  │  Service  │  │ Aggregation │  │  Service  │  │   User    │
  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘  └───────────┘  └───────────┘
        │              │               │  provider fan-out
        │              │        ┌──────┴───────┬──────────┬──────────┐
        │              │        ▼              ▼          ▼          ▼
        │              │   RateHawk      Hotelbeds    WebBeds   DidaTravel
        │              │   Adapter        Adapter      Adapter   Adapter …
        ▼              ▼
  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
  │  Booking  │  │  Payment  │  │Notification│  │   Admin   │  │ Analytics │
  │  Service  │  │  Service  │  │  Service   │  │  Service  │  │ /Reporting│
  └─────┬─────┘  └─────┬─────┘  └─────┬──────┘  └───────────┘  └─────┬─────┘
        │              │              │                              │
        └──────────────┴──────┬───────┴──────────────────────────────┘
                              ▼
              ┌───────────────────────────────┐   ┌──────────────┐
              │  Message broker (SNS/SQS)      │   │ Background    │
              │  transactional outbox → events │──▶│ Workers       │
              └───────────────────────────────┘   └──────────────┘

  Shared infra:  PostgreSQL (service-owned schemas → DBs) · Redis (cache,
  locks, rate-limit tokens) · Object storage (dumps, exports, receipts) ·
  Observability (logs, metrics, OpenTelemetry traces)
```

### Trust & secret boundary [Existing principle, extended]
The browser never receives supplier net cost, markup, booking/search hashes, or
raw supplier objects. In the monolith this is a server-component boundary; once
services split, the **BFF is the only tier the browser talks to**, and
inter-service calls carry no such data to the client tier. Supplier credentials
and the Supabase service-role key live only in server runtimes
(`src/env.ts`, validated by zod; never logged — see `check()` in
[store.ts](../../src/lib/content/store.ts)).

---

## 2.3 Core domain model [Proposed]

Today supplier shapes (`Rate`, `PaymentType` in
[src/lib/etg/schemas.ts](../../src/lib/etg/schemas.ts)) flow outward from the
ETG module. The target introduces a **normalized domain model** owned by the
platform, with adapters mapping each supplier into it:

- `NormalizedHotel` (already essentially `Hotel`/`HotelCard` in
  [src/lib/content/types.ts](../../src/lib/content/types.ts) — provider-neutral).
- `NormalizedRate` — room, meal, board, a **provider-neutral offer token**
  (replacing the index-position identity), cancellation penalties, and a
  **supplier cost** (contract currency) kept server-side.
- `Offer` — a server-held/signed selectable unit (book token, displayed total,
  markup, payment type, currency, expiry, provider id). Directly addresses the
  follow-ups "rate identity" gap and is the hand-off object between Search and
  Booking.
- `CancellationPolicy`, `Money` — already neutral (`decimal.js`), reuse as-is.

Pricing and policy modules already operate on these shapes and move unchanged;
the only structural change is that their *input* comes from a normalized rate
produced by an adapter rather than directly from ETG JSON.

---

## 2.4 Communication patterns [Proposed]

- **Synchronous, request-path:** BFF → Search/Content/Pricing/Inventory. In the
  monolith these are function calls; when extracted, prefer **gRPC or typed
  HTTP** with strict timeouts, retries (idempotent reads only), and circuit
  breakers. The request path must never block on a slow provider beyond a hard
  deadline — partial results are returned (fail-soft).
- **Asynchronous, off-path:** booking confirmation, notifications, content
  sync, reconciliation, analytics — via the broker, driven by the
  **transactional outbox** so a state change and its event commit atomically
  ([EVENT_DRIVEN_ARCHITECTURE.md](EVENT_DRIVEN_ARCHITECTURE.md)).
- **Idempotency everywhere it writes:** booking "finish", payment capture and
  webhook handlers are idempotent by key; booking retries use a **new**
  `partner_order_id` per attempt, never a blind retry (follow-ups).

---

## 2.5 What stays in the monolith initially [Proposed]

Per principle 1, the **first target is one deployable** (the Next.js app)
internally organized into the modules above, plus **workers** as a second
deployable for async jobs, plus **Redis**. Extraction order and triggers are in
[MICROSERVICES_BOUNDARIES.md](MICROSERVICES_BOUNDARIES.md) §"Extraction
sequence". This keeps Plan-1 search and hotel pages working throughout.
