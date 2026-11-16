# 5. Database scalability plan

**Status:** proposed. Guiding rule (brief §7): **do not replace PostgreSQL
without a compelling technical reason**, and introduce no unnecessary
infrastructure.

---

## 5.1 Today [Existing]

- **Supabase PostgreSQL**, free plan (500 MB, auto-pauses when idle).
- One migration, [supabase/migrations/0001_content.sql](../../supabase/migrations/0001_content.sql):
  `hotels` (content keyed by `hid`), `settings` (`markup_percent`, and later
  `dictionaries`), `missing_hotels`. RLS on, **no public policies** — only the
  service-role key reads/writes (correct: all access is server-side).
- Access via one lazy client in
  [store.ts](../../src/lib/content/store.ts); reads bounded (3s / 300ms),
  batched 200 rows, card reads select only needed columns
  (`hid,name,address,star_rating,review_rating,first_image:images->0`).
- `settings` reads (`markup_percent`, `dictionaries`) are **not** bounded —
  fix first (follow-ups).
- No bookings/payments/users tables exist yet.

**Verdict:** PostgreSQL is the right engine (relational, transactional,
JSONB for supplier blobs). **Keep Postgres.** The question is *where it is
hosted* and *how it is partitioned by ownership*, not *whether*.

---

## 5.2 Target shape [Proposed]

### Stage A — service-owned schemas, one database
Keep a single Postgres; give each service its **own schema** and forbid
cross-schema writes (reads via views/contracts only). This buys data ownership
and clean extraction seams with none of the distributed-transaction cost.

```
content.*    hotels, settings, missing_hotels, hotel_mappings, dictionaries
identity.*   users, residency_prefs, sessions(if not Redis)
booking.*    offers, orders, order_items, booking_events(outbox)
payment.*    payments, refunds, payment_events(outbox)
inventory.*  (stateless — no tables; rate-limit tokens in Redis)
analytics.*  → separate warehouse (see §5.6), not in the OLTP DB
```

### Stage B — separate databases where justified
Split a schema into its own database **only** when it needs independent
scaling, backup cadence, or failure isolation. Expected first splits:
- **payment** (PCI blast-radius, strictest backups) — split early.
- **content** (worldwide catalogue dwarfs everything; heavy read, batch write)
  — split with Plan 4.
booking stays with the core OLTP DB until volume forces a move.

---

## 5.3 Hosting: Supabase vs managed Postgres [Proposed]

| | Keep Supabase (paid tier) | Move to AWS RDS/Aurora Postgres |
|---|---|---|
| Fit now | Already integrated; Auth usable for Identity | — |
| Read replicas | limited | first-class (Aurora: up to 15) |
| Partitioning/scale | Postgres native | Postgres native; Aurora storage autoscales |
| PITR / backups | paid tiers | mature, per-DB |
| Ops near compute | separate | same VPC as ECS (low latency, private) |
| Lock-in | Supabase client/Auth | standard Postgres |

**Recommendation:** stay on **Supabase (paid)** through Phases 1–3 — it is
integrated and the catalogue is still small — while **keeping the data-access
layer behind a repository interface** (refactor of `store.ts`) so the engine is
swappable. Plan the move of the **content** (and later payment) databases to a
**managed Postgres co-located with compute** (AWS RDS/Aurora if ECS/Fargate is
chosen — see [INFRASTRUCTURE_AND_DEVOPS.md](INFRASTRUCTURE_AND_DEVOPS.md)) when
worldwide content lands, because the free/shared plan cannot hold it and
replicas/PITR become essential. **No engine change — Postgres throughout.**

---

## 5.4 Scaling techniques, mapped to this platform [Proposed]

- **Connection pooling** — serverless/SSR opens many short connections;
  Postgres handles few well. Use a pooler (Supabase pooler / PgBouncer /
  RDS Proxy) in **transaction** mode. **[Existing risk]** the lazy singleton
  client in `store.ts` is per-instance; under many instances, pool through a
  proxy, not direct connections.
- **Indexing** — `hotels.hid` PK exists. Add, as queries appear: `region_id`
  (region browse), `country_code`, and a GiST index on `(latitude, longitude)`
  for geo-search. Booking: index `orders(partner_order_id)` unique,
  `orders(user_id, created_at)`, `offers(expires_at)`.
- **Read replicas** — route content card reads and reporting to replicas; keep
  booking/payment writes on the primary. The repository layer picks the
  connection by read/write intent.
- **Partitioning** — partition high-volume, time-series tables by range:
  `booking_events`/`payment_events` (outbox) and analytics events by month;
  archive old partitions to object storage. The hotel catalogue partitions by
  region/country if a single table grows unwieldy.
- **Query optimization** — the card read already projects minimal columns;
  keep that discipline (never `select *` on the hot path — note `getHotel`
  uses `*` for the full hotel page, acceptable as it is one row).
- **Transaction integrity** — booking/payment writes + their outbox rows commit
  in one local transaction (see [EVENT_DRIVEN_ARCHITECTURE.md](EVENT_DRIVEN_ARCHITECTURE.md)).
  No money logic uses floats anywhere (decimal strings end-to-end — `money.ts`).
- **Backup / DR** — PITR on the OLTP and payment DBs; documented RPO/RTO;
  periodic restore drills. **[Assumption]** targets to be set with the business.
- **Monitoring** — slow-query log, connection saturation, replica lag, cache
  hit ratio; alert on pool exhaustion (the most likely first incident).

---

## 5.5 Complementary stores [Proposed — only what earns its place]

- **Redis (introduce in Phase 2):** search-result cache, markup/dictionary
  cache, `hotelExists` cache, **distributed rate-limit tokens**, sessions,
  idempotency keys, short locks. Directly replaces the process-local Maps that
  block horizontal scaling. **Highest-value new store.**
- **Object storage (S3 or equivalent):** RateHawk **dumps** (hotel/region/
  reviews — zstd, hourly/daily/weekly per notes), generated exports, booking
  vouchers/receipts, invoices. Images are **not** stored by us today — they are
  served from the supplier CDN `cdn.worldota.net` via Next's optimizer
  ([next.config.ts](../../next.config.ts)); keep it that way unless a provider
  forbids hotlinking.
- **Dedicated search infrastructure (defer):** Postgres (trigram + GiST geo)
  likely suffices for destination autocomplete and region/geo search at first.
  Introduce OpenSearch/Elasticsearch **only** when faceted/full-text search over
  the worldwide catalogue outgrows Postgres — a Phase 4+ decision, backed by a
  query-pattern spike, not adopted pre-emptively.
- **Analytics warehouse (§5.6).**

---

## 5.6 Analytics warehouse [Proposed — Phase 6]

Reporting must **not** run on the OLTP database. Ship domain events (search,
offer-shown, booking, payment, cancellation) to a warehouse
(e.g. BigQuery / Redshift / ClickHouse — chosen with the BI requirements) via
the event stream. Operational DBs keep only what serving needs; history lives in
the warehouse and object storage.

---

## 5.7 Data-ownership rules [Proposed]

1. One service writes a table; others read via that service's contract (or a
   replica/materialized view), never by reaching into its schema.
2. Money columns are `numeric`/decimal; never float. Store supplier cost
   (contract currency) **and** displayed selling price on an order (follow-ups).
3. Supplier blobs stay JSONB, validated by zod at ingestion (already the
   discipline in `map-hotel.ts` / `parseHotelsLenient`).
4. PII (users, travelers, payments) is isolated in identity/payment schemas with
   the strictest access and retention.
