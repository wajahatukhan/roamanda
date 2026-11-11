# Travel portal

A hotel booking site built on the RateHawk (ETG) API. Plan 1 covers search, the results list and the hotel page.
Hotel content (names, photos, policies) is stored in Supabase and synced from RateHawk; prices and availability
come from RateHawk on each request.

**New to the project? Start with [docs/HANDOVER.md](docs/HANDOVER.md).** Rules for AI coding assistants are in
[CLAUDE.md](CLAUDE.md).

## Requirements

- Node 26 (the version CI uses, see `.github/workflows/ci.yml`)
- npm

## Setup

```bash
npm ci
cp .env.example .env.local   # then fill in the values; never commit .env.local
```

## Commands

- `npm run dev` starts the development server on http://localhost:3000.
- `npm run ci` runs typecheck, unit tests, lint, build and the end-to-end tests. This is what CI runs.
- `npm run ci:speed` builds if needed and runs the Lighthouse speed checks.
- `npm run sync:content -- --hids 10004834,8819557` fetches content for those hotel ids and stores it.

## Modes

`ETG_MODE` in `.env.local` picks where data comes from:

- `live` calls RateHawk. It needs `ETG_KEY_ID` and `ETG_API_KEY`.
- `fixture` replays recorded responses and needs no RateHawk credentials. Production builds refuse it unless
  `ALLOW_FIXTURE_MODE=1` is set.

## Documents

The design, the plan and the follow-ups live under `docs/superpowers/`:

- `specs/2026-11-11-travel-portal-design.md`: the design
- `plans/2026-11-11-plan-1-foundation-and-browse.md`: plan 1
- `plans/2026-11-12-plan-1-outcome-and-follow-ups.md`: what plan 1 delivered and what is left
