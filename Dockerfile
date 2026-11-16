# syntax=docker/dockerfile:1
# Node 26 everywhere: this base must stay in step with .nvmrc, package.json "engines"
# and .github/workflows/ci.yml (node-version: 26).

# --- dependencies ------------------------------------------------------------
FROM node:26-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- build -------------------------------------------------------------------
FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` does not call RateHawk or Supabase (pages are request-time, getEnv is lazy),
# so no API credentials are needed at build time.
RUN npm run build

# --- runtime -----------------------------------------------------------------
FROM node:26-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Run as the non-root user the base image already provides.
USER node
COPY --from=build --chown=node:node /app ./
EXPOSE 3000
# ETG_MODE, SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY and (in live mode) the ETG
# credentials are injected at runtime, never baked into the image. In production
# fixture mode is refused unless ALLOW_FIXTURE_MODE=1 (see src/env.ts).
# A smaller image via Next's `output: "standalone"` is a later optimisation
# (see docs/architecture/CACHING_AND_PERFORMANCE_STRATEGY.md); kept simple here.
CMD ["npm", "run", "start"]
