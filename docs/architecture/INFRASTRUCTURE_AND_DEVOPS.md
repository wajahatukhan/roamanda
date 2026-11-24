# 8. Infrastructure and DevOps

**Status:** proposed. Guiding rule (brief §10): balance scalability, operational
complexity and cost; **do not introduce Kubernetes without clear operational
justification**, and no unnecessary infrastructure.

---

## 8.1 Node.js standardization [Existing + fix]

Target: **Node.js 26 everywhere** — local, CI, Docker, production.

| Place | State today | Action |
|---|---|---|
| `.nvmrc` | On disk (`26`) but **untracked by git** (not ignored either) | **commit it** so a fresh clone gets it |
| `package.json` `engines` | **Missing** | add `"engines": { "node": ">=26 <27" }` |
| CI (`.github/workflows/ci.yml`) | `node-version: 26` ✓ | keep; pin action SHAs (follow-ups) |
| Dockerfile | **Missing** | add, `FROM node:26-bookworm-slim` |
| Local machine (assessed) | **Node v24** ✗ | install 26 (`nvm use` reads `.nvmrc`) |
| Production runtime | n/a (not deployed) | base image pinned to 26 |

Per brief §3: **verify compatibility before changing dependency versions and do
not perform unnecessary upgrades** as part of this. Next 16.4.6 / React 19.3 are
already on the CI's Node 26; standardizing the *runtime* needs no dependency
bumps. Add only the version-pinning config above.

---

## 8.2 Containerization [Proposed]

- **Multi-stage Dockerfile** for the Next.js app: `deps` (npm ci) → `build`
  (`next build`, Node 26) → `runner` (slim, non-root, `next start`). Honor the
  handover warning that synced folders break the build — irrelevant in CI/Docker
  but keep local dev off iCloud.
- **Second image** for the **workers** deployable (same base, different entry).
- **`.dockerignore`** excluding `node_modules`, `.next`, `tests/fixtures` from
  the runtime image where not needed (note: fixtures are currently bundled into
  the build — follow-ups Plan 5; production images should not ship fixture mode;
  `ALLOW_FIXTURE_MODE` must be unset in prod — [env.ts](../../src/env.ts) already
  refuses fixture mode in production).
- **`docker-compose.yml`** for local dev: app + workers + Postgres + Redis +
  (localstack for SQS/SNS) — a one-command local platform.

---

## 8.3 Orchestration: ECS/Fargate vs Kubernetes vs other [Proposed]

| | AWS ECS + Fargate (recommended) | Kubernetes (EKS) | Other PaaS |
|---|---|---|---|
| Ops complexity | low (no nodes/control plane) | high | lowest, least control |
| Autoscaling | service + target tracking | HPA/cluster-autoscaler | varies |
| Fit for few services | excellent | overkill early | fine early, ceilings later |
| Cost at small scale | pay-per-task | cluster baseline cost | low |
| Portability | AWS-centric | portable | lock-in |

**Recommendation: AWS ECS on Fargate.** The platform starts as **1–2
deployables** (app + workers); Fargate gives independent service scaling,
managed networking and autoscaling without a control plane to run. Revisit
**Kubernetes only** when service count, multi-region, or team topology creates a
clear operational need — the brief explicitly warns against adopting it early.
Managed companions in the same account/VPC: **RDS/Aurora Postgres**,
**ElastiCache Redis**, **SNS/SQS**, **S3**, **ALB**, **CloudFront** (CDN).

---

## 8.4 Environments [Proposed]

- **development** — local docker-compose; fixture mode allowed.
- **staging** — mirrors production; live sandbox RateHawk key; dummy payments;
  the place to run the Lighthouse `speed` job and load tests.
- **production** — live credentials; fixture mode refused; least-privilege IAM.

Config/secrets never in images: **AWS Secrets Manager / SSM Parameter Store**,
injected as env at task start, validated by `parseEnv` ([env.ts](../../src/env.ts)).
Keep honoring: supplier keys, Supabase service-role key and (future) PSP keys
are server-only and never logged (`check()` already strips key material).

---

## 8.5 CI/CD [Proposed]

Build on the existing GitHub Actions ([.github/workflows/ci.yml](../../.github/workflows/ci.yml)):
two jobs today — `checks` (`npm run ci`: typecheck, unit, lint, build, e2e) and
`speed` (Lighthouse). Keep `checks` as the merge gate.

Add:
1. **Pin action versions to SHAs** (follow-ups Plan 5).
2. **Build & push Docker images** (app, workers) on merge to `main`.
3. **Deploy pipeline**: → staging automatically → smoke tests → **manual
   approval** → production (blue/green or rolling on ECS, with health-check
   gating and automatic rollback).
4. **Per-service pipelines** as services extract (independent deploy — brief §4).
5. **DB migrations** run as a gated pipeline step (expand/contract, never
   destructive in one release).

---

## 8.6 Observability [Proposed]

- **Centralized logs** — structured JSON to CloudWatch/OpenSearch; the codebase
  already logs messages only, never payloads or secrets (keep this).
- **Metrics & alerting** — RED metrics per service + domain metrics (searches/
  min vs supplier budget, cache hit-rate, booking success rate, refund backlog,
  DB pool saturation, replica lag). Alert on supplier-limit exhaustion and DLQ
  depth first — the likeliest incidents.
- **Distributed tracing** — OpenTelemetry BFF → services → provider adapters, so
  latency is attributable to a specific supplier call (ties to the 2.8 s hotel
  page and to slow-provider isolation).
- **Health checks** — liveness/readiness per service for ECS; readiness fails if
  Redis/DB/broker dependencies are unavailable, so the LB stops routing.
- **Backups & DR** — automated PITR (OLTP, payment DBs), object-storage
  lifecycle for dumps/receipts, documented RPO/RTO with restore drills.
- **Autoscaling** — Fargate target-tracking on CPU + custom queue-depth / RPS
  metrics; thresholds set from the §6.7 load tests, not guessed.
