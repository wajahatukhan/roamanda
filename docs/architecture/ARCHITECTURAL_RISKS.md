# 10. Architectural risks & open questions

**Status:** risk register. Distinguishes **verified facts**, **assumptions to
prove**, and **decisions/answers owed** (by RateHawk, by the business, or by a
spike) before the dependent work is built.

---

## 10.1 Top risks (ranked)

| # | Risk | Impact | Likelihood | Mitigation | Phase |
|---|---|---|---|---|---|
| R1 | **Booking/payment integrity** — double-booking or double-charge | Severe (money, trust) | Med | retries off on finish; new `partner_order_id` per attempt; outbox; idempotency; reconciliation; exact-value tests | 3 |
| R2 | **Supplier rate limits** — global per-key caps throttle the platform | High | High | distributed token bucket; move caches to Redis; multi-provider; commercial limit increase | 2,5 |
| R3 | **Process-local caches** block horizontal scaling | High | High (today) | Redis L2 + single-flight | 2 |
| R4 | **Single provider** = single point of inventory failure | High | Med | `InventoryProvider` + second adapter | 1,5 |
| R5 | **Wrong hotel de-duplication** across providers misleads travelers | High | Med | don't merge until mapping proven; show un-merged otherwise | 5 |
| R6 | **Supabase free plan** too small for worldwide content | High | High (certain at scale) | managed Postgres + replicas + object storage | 4 |
| R7 | **Big-bang temptation** — rewriting instead of boundary-introducing | High | Med | strict phased roadmap; behavior-pinning tests | all |
| R8 | **Hotel-page latency** (2.8 s vs 2.0 s) + supplier-bound, uncacheable | Med | High | JS/document weight levers; await Ali's target decision; cannot cache rates | 6 |
| R9 | **Secret/PII leakage** as services multiply | Severe | Low | BFF-only client tier; server-only secrets; PCI isolated in Payment | 2–5 |
| R10 | **Distributed-txn complexity** if services split too hard | Med | Med | one DB + schemas first; outbox, not 2PC | 1–4 |
| R11 | **AI produces a price/room/policy** (forbidden) | Severe (compliance) | Low | AI never sources money/rooms/cancellation; from data only; behind a flag | 6 |
| R12 | **Node/runtime drift** (local v24 vs required 26; no `engines`/Dockerfile) | Med | High (today) | standardize (Phase 0) | 0 |

---

## 10.2 Verified facts [from code / sandbox]
- Business logic is largely provider-neutral and test-covered; ETG coupling is
  isolated to `src/lib/etg/*` (see [SCALABILITY_ASSESSMENT.md](SCALABILITY_ASSESSMENT.md) §1.2).
- Hotel-page rates are uncached by construction; search list uses a 5-min
  in-memory cache; content endpoints are off the request path.
- All caches and the search de-dup are **process-local** today.
- `etgRequest` retries every 5xx POST (unsafe for booking).
- Rate identity is by list index; booking hash exists only during render.
- `StayPrice.net` is `show_amount`, not the contract-currency charge.
- Supabase free plan: 500 MB, auto-pause.
- `.nvmrc`=26 (untracked — on disk, not committed) and CI=26, but no `engines`,
  no Dockerfile; assessed host is v24.
- `.env.example` leaves Supabase vars empty although `env.ts` requires them
  non-empty even in fixture mode (CI injects dummies).

## 10.3 Assumptions to prove (spikes)
- A1: Postgres (trigram + GiST geo) suffices for search before a dedicated
  search engine is needed. → query-pattern spike in Phase 4.
- A2: SNS/SQS FIFO + dedup gives adequate exactly-once-ish behavior for
  booking/payment events. → broker spike in Phase 3.
- A3: Cross-provider hotel mapping is feasible from supplier mapping dumps with
  acceptable precision. → mapping spike in Phase 5.
- A4: ECS/Fargate meets latency/cost targets vs a PaaS. → staging benchmark.
- A5: Capacity/SLO numbers — **no load test exists**; all throughput figures are
  estimates until the §6.7 harness runs.

## 10.4 Decisions owed by RateHawk (Denis) [handover §10]
1. Are automated price re-checks for booked stays allowed, and via which
   endpoint? (gates the price-drop feature)
2. Does an in-site AI feature need a separate "Chatbot" certification?
3. Which payment types are in the contract (deposit / now / pay-at-hotel)?
   (shapes Payment + Booking)
4. What does the cancellation window `commission_info` gross (393.33) vs net
   (354.00) mean, and are there selling-price limits?
5. What does an empty cancellation policy list mean?
6. Does `amount` vs `show_amount` diverge on a non-USD contract or production
   key? (gates the stored supplier-cost field)

## 10.5 Decisions owed by the business (Ali) [handover §10]
- Real markup percentage (placeholder 12).
- Payment provider to integrate.
- Brand name and visual identity.
- Whether the hotel page keeps the 2.0 s target.
- Launch coverage (worldwide from day one needs a paid DB plan).
- Customer-support model (none today → failed bookings must auto-refund+notify).

## 10.6 Guardrails that must never regress
Financial integrity (decimal money; server-only net/markup/hashes) · supplier
data validated at the boundary, one bad row dropped · cancellation text from
data, never a model, never understating penalty or overstating deadline · no
pressure/scarcity UI · residency on every supplier search/hotel call · secrets
server-only and never logged. Any phase that risks one of these stops until the
guardrail is demonstrably intact.
