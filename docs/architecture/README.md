# Architecture evolution: travel technology platform

These documents are an **architecture assessment and target design**, produced
2026-11-17 in response to the "Architectural Evolution" brief. They do **not**
change application code. No implementation should begin until the direction
here is approved (brief §13).

They describe how to evolve the existing browse-only Next.js hotel site
(`main`, Plan 1 "foundation and browse") into a provider-independent, scalable
platform **without a big-bang rewrite**. Read them with the project's own
handover ([../HANDOVER.md](../HANDOVER.md)), design spec and follow-ups backlog
([../superpowers/](../superpowers/)).

## How to read these documents

Each document labels claims so design is never confused with fact:

- **[Existing]** — verified in the code at this commit, with file references.
- **[Proposed]** — a recommendation, not yet built.
- **[Verified]** — checked against RateHawk sandbox recordings or the code.
- **[Assumption]** — not yet confirmed; needs a decision, a supplier answer, or
  a spike. Assumptions are collected per document and in
  [ARCHITECTURAL_RISKS.md](ARCHITECTURAL_RISKS.md).

## Index

| # | Document | Question it answers |
|---|---|---|
| 1 | [SCALABILITY_ASSESSMENT.md](SCALABILITY_ASSESSMENT.md) | What exists today, what scales, what does not, which modules are reusable |
| 2 | [TARGET_ARCHITECTURE.md](TARGET_ARCHITECTURE.md) | The modular, service-oriented target and the principles behind it |
| 3 | [MICROSERVICES_BOUNDARIES.md](MICROSERVICES_BOUNDARIES.md) | The twelve candidate services, their contracts, data ownership, and what stays in the monolith first |
| 4 | [INVENTORY_AGGREGATION_ARCHITECTURE.md](INVENTORY_AGGREGATION_ARCHITECTURE.md) | The provider interface, adapters and the multi-supplier orchestrator |
| 5 | [DATABASE_SCALABILITY_PLAN.md](DATABASE_SCALABILITY_PLAN.md) | PostgreSQL scaling, service-owned schemas, Supabase vs managed Postgres, complementary stores |
| 6 | [CACHING_AND_PERFORMANCE_STRATEGY.md](CACHING_AND_PERFORMANCE_STRATEGY.md) | Where caching is safe, Redis, CDN, SSR performance, capacity targets |
| 7 | [EVENT_DRIVEN_ARCHITECTURE.md](EVENT_DRIVEN_ARCHITECTURE.md) | Async workflows, broker choice, the transactional outbox for bookings |
| 8 | [INFRASTRUCTURE_AND_DEVOPS.md](INFRASTRUCTURE_AND_DEVOPS.md) | Containers, ECS vs Kubernetes, environments, CI/CD, observability |
| 9 | [MIGRATION_ROADMAP.md](MIGRATION_ROADMAP.md) | The phased, non-breaking migration with completion criteria and rollback |
| 10 | [ARCHITECTURAL_RISKS.md](ARCHITECTURAL_RISKS.md) | Risks, open questions, and the facts that must be verified before building |

## One-paragraph summary

The existing code is small (~4,800 lines) but **well-factored**: the pure
business logic — money/pricing, cancellation policy, search-list building,
content mapping — is already provider-neutral and heavily tested, and the
RateHawk integration is isolated behind a thin HTTP client. The right first
move is **not** microservices; it is a **modular monolith**: introduce an
`InventoryProvider` interface, wrap today's `src/lib/etg` as the first adapter,
add an orchestration layer, and externalize the in-process caches to Redis so
the single Next.js app can scale horizontally. Services are then extracted
**only where a real scaling or ownership need appears** — booking/payment
first (transactional integrity), then inventory aggregation (latency isolation
and provider fan-out), then worldwide content sync (storage and throughput).
Non-negotiables — financial integrity, supplier-data validation, cancellation
accuracy, and server-only secret isolation — are preserved at every phase.
