# 9. Migration roadmap

**Status:** proposed sequence. **No big-bang rewrite** (brief §11). Every phase
preserves the working Plan-1 search and hotel pages, keeps `npm run ci` green,
and removes no feature or test without explicit justification. Phases are
ordered by dependency and risk; durations are deliberately omitted (team-sized).

Each phase states: components affected · new components · files/modules · DB
changes · dependencies · risks · testing · rollback · completion criteria.

---

## Phase 0 — Standardize & stabilize (no architecture change)
- **Affected:** build/runtime config; `store.ts`; `env.ts`.
- **New:** `package.json` `engines`, Dockerfile, `.dockerignore`,
  `docker-compose.yml`.
- **Files:** `package.json`, new `Dockerfile`; bound `readSetting` in
  [store.ts](../../src/lib/content/store.ts) with the 3 s timeout (follow-ups
  "first tasks"); make local e2e server start with `TZ=UTC` (follow-ups).
- **DB:** none.
- **Deps:** Node 26 locally.
- **Risk:** low.
- **Testing:** existing `npm run ci`; verify Docker image boots in fixture mode
  with `ALLOW_FIXTURE_MODE=1` and refuses it without.
- **Rollback:** revert config commits.
- **Done when:** Node 26 pinned in all four places, image builds and runs, the
  two unbounded settings reads are bounded, CI green.
- **Note:** `.env.example` ships empty `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`
  but `env.ts` requires them non-empty even in fixture mode — document the
  CI-style dummy values (or relax the schema for fixture mode) so a fresh clone
  runs. Decide which; it is a one-line fix either way.

## Phase 1 — Modular monolith + provider interface (highest priority)
- **Affected:** `src/lib/etg/*`, `src/lib/search/list.ts`, search/hotel pages
  (internally only).
- **New:** `InventoryProvider` interface, `ProviderCapabilities`, normalized
  domain types, `RateHawkAdapter`, the orchestrator (single provider), a
  per-call retry policy, normalized error taxonomy.
- **Files:** move `etg/{client,search,content,schemas,errors}.ts` behind the
  adapter; `list.ts` consumes normalized rates; introduce `src/lib/inventory/`.
- **DB:** none.
- **Deps:** none new at runtime.
- **Risk:** medium (touches the hot path) — mitigated by unchanged external
  behavior and the existing 356 unit / 84 browser tests pinning it.
- **Testing:** all current tests must pass unchanged; add adapter-contract tests.
- **Rollback:** feature-flag the orchestrator; fall back to direct ETG calls.
- **Done when:** search/hotel render identically through the orchestrator with
  RateHawk as the only adapter, and no ETG type leaks above the adapter layer.

## Phase 2 — Externalize state + workers deployable
- **Affected:** all caches; deployment topology.
- **New:** Redis; cache adapter (L1+L2, single-flight); **distributed
  per-provider rate limiter**; **workers** deployable; SQS/SNS skeleton.
- **Files:** refactor `serp-cache.ts` and the `store.ts` caches behind the cache
  adapter; sync script becomes a worker job.
- **DB:** none (Redis is new).
- **Deps:** Redis, broker (localstack locally).
- **Risk:** medium — cache correctness; mitigated by keeping identical keys/TTLs
  and the no-hotel-rate-cache invariant.
- **Testing:** cache-behavior unit tests; a load test showing one supplier call
  per miss across instances; verify the rate limiter sheds load, not 429s.
- **Rollback:** cache adapter falls back to in-process maps (today's behavior).
- **Done when:** the app runs as 2+ instances with shared cache + rate limiting,
  and horizontal scaling no longer multiplies supplier calls.

## Phase 3 — Booking + Payment (transactional core)
- **Affected:** new surface; Inventory adapters gain booking methods.
- **New:** Booking service, Payment service, Notification/reconciliation
  workers, **transactional outbox**, signed/stored **Offer**, idempotency keys,
  PSP integration (provider TBD).
- **Files:** `src/lib/inventory` booking methods on `RateHawkAdapter` (prebook/
  form/finish/status/cancel per [etg-api-notes.md](../reference/etg-api-notes.md));
  new `booking/`, `payment/` modules/services.
- **DB:** new `booking.*`, `payment.*` schemas (offers, orders, order_items,
  payments, refunds, outbox tables); store supplier cost **and** selling price.
- **Deps:** broker, Redis idempotency, PSP, payment DB.
- **Risk:** **high** (money + double-booking). Mitigations: retries **off** on
  finish; new `partner_order_id` per attempt; outbox; reconciliation of unknown
  outcomes; automatic refund+notify on failure; exact-value money tests.
- **Testing:** exact-value pricing/refund tests; idempotency tests; sandbox
  error-suffix simulation (`soldout`, `booking_form_expired`, etc.); webhook
  signature verification.
- **Rollback:** booking behind a feature flag; browse unaffected if disabled.
- **Done when:** a sandbox booking completes, a failed booking auto-refunds and
  notifies, and no path can double-book or double-charge.

## Phase 4 — Worldwide content + Content Service
- **Affected:** content store, sync.
- **New:** Content Service (extracted), dump-ingestion pipeline (hotel/region/
  reviews dumps → object storage → upsert), managed Postgres for content with
  read replicas, hotel-mapping table for cross-provider de-dupe.
- **Files:** `src/lib/content/*` → Content Service; `scripts/sync-content.ts` →
  worker pipeline.
- **DB:** content moves off the Supabase free plan; partition/index for scale;
  clear `missing_hotels` on arrival; flag closed/deleted (follow-ups Plan 3).
- **Deps:** managed Postgres, object storage.
- **Risk:** medium-high (data volume, 500 MB → large). Mitigations: staged
  backfill, replica reads, back-off on 429, partial-upsert reporting.
- **Testing:** mapper logging for skips; https-only image URLs; replica-read
  correctness; load test of card reads at catalogue scale.
- **Rollback:** keep the sandbox store until the worldwide store is validated.
- **Done when:** content reads serve from the scaled store with replicas, and
  the catalogue exceeds the sandbox 24 without regressing browse.

## Phase 5 — Extract Inventory Aggregation + second provider
- **Affected:** orchestrator becomes a service; add a real second adapter.
- **New:** Inventory Aggregation Service (independently deployed/scaled),
  `HotelbedsAdapter` (or next supplier), hotel mapping across providers, formal
  BFF/API-gateway shaping.
- **Files:** `src/lib/inventory` → service; adapters per provider.
- **DB:** mapping table populated from supplier mapping dumps.
- **Deps:** second supplier credentials/contract.
- **Risk:** medium — mapping correctness (wrong merges mislead travelers).
  Mitigation: do not merge until a provider's mapping is proven; show un-merged
  otherwise.
- **Testing:** adapter-contract tests for the new provider; merge/de-dupe tests;
  latency-isolation test (slow provider dropped within deadline).
- **Rollback:** provider-selection config disables the new adapter instantly.
- **Done when:** two providers return merged, de-duplicated, priced results with
  Plan-1 tests green — the formal "provider-independent" milestone.

## Phase 6 — Analytics, AI planning, hardening
- **New:** Analytics warehouse + event pipeline; AI planning service (guided
  brief → three picks) **with prices/rooms/cancellation always from data, never
  the model** (handover §7, `CLAUDE.md`); certification-readiness work
  (RateHawk checklist, speed, accessibility audit, production hardening).
- **Risk:** AI must stay behind a switch; plain flow remains certifiable alone.
- **Done when:** BI reporting runs off the warehouse (not OLTP), and AI features
  ship behind a flag without touching the money/policy invariants.

---

## Cross-phase guarantees
- `npm run ci` is green at the end of every phase.
- No feature/test removed without written justification.
- Invariants hold throughout: decimal money; server-only net/markup/hashes;
  cancellation text from data; supplier data zod-validated, one bad row dropped;
  residency on every supplier search/hotel call; no pressure/scarcity UI.
- Every phase is independently deployable and reversible (feature flags +
  expand/contract migrations).
