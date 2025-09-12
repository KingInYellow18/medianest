# MediaNest Staging Runbook

This runbook defines the concrete, end-to-end steps to stand up and validate the MediaNest staging environment. It aligns with the repository’s scripts and tooling and is designed for execution over 1–2 sprints by a cross‑functional team.

> Scope: Node ≥ 18, npm ≥ 8; monorepo with workspaces `shared/`, `backend/`, `frontend/`; Prisma/Postgres, Redis, Express API, Next.js frontend, Vitest, Playwright, Docker Compose.

---

## Repository Overview (for orientation)

- Root
  - `package.json` (workspaces; build/test/type/lint/security/load/monitoring scripts)
  - `docker-compose.yml`, `Dockerfile`
  - `.env.*` variants incl. `.env.staging.example`
  - `docs/` (MkDocs), `scripts/`, `tests/`, `monitoring/`, `deployment/`, `infrastructure/`
- Backend (`backend/`)
  - Express API, Prisma schema (`backend/prisma/schema.prisma`)
  - Prometheus metrics (`/metrics`, bearer-protected), `/health`
  - Playwright e2e (`npm run test:e2e`)
- Frontend (`frontend/`)
  - Next.js 15, Tailwind, Vitest
- Shared (`shared/`)
  - TS utilities/config; built via `tsc --build`

---

## Roles & DRIs

- DevOps DRI: staging infra, Compose deployments, rollback, observability
- Backend DRI: API readiness, Prisma migrations/seeds, Playwright e2e
- Frontend DRI: Next.js build/runtime config, UI smoke
- QA DRI: verification matrix, manual UAT, sign‑offs
- Security DRI: secrets management, scans, hardening checks
- Docs DRI: runbook upkeep, links to dashboards and known issues

---

## Environment Prerequisites

- Staging host (Linux VM) with Docker and Docker Compose (v2)
- DNS (recommended):
  - `staging.medianest.example.com` → frontend (or reverse proxy)
  - `api.staging.medianest.example.com` → backend (or reverse proxy)
- Secret store (Vault / AWS Secrets Manager / GCP Secret Manager) for `.env.staging` values
- Optional reverse proxy for TLS termination (nginx, Traefik, or cloud LB)

---

## Phase Gates Summary

1) Prep & Baseline (Gate A) → 2) Infra (Gate B) → 3) Config & Secrets (Gate C) → 4) Data & Backups (Gate D) → 5) CI/CD Deploy (Gate E) → 6) Validation (Gate F) → 7) Observability (Gate G) → 8) Go/No‑Go & Rollback (Gate H)

Each gate has explicit acceptance criteria below.

---

## Phase 1 — Prep & Baseline Validation (Gate A)

Run locally or in CI before any staging deploy:

```bash
npm ci
npm run typecheck && npm run lint
npm run build && npm run build:verify
npm run test:ci  # requires ≥ 65% lines coverage per repo guidelines
# Optional local e2e (backend):
(cd backend && npm run test:e2e)
# Prisma sanity:
npm run db:generate && npm run db:validate && npm run migrate:status
```

Acceptance (Gate A):
- Typecheck, lint, build, and `test:ci` all green (coverage ≥ 65%).
- `migrate:status` clean; no drift.
- `npm run security` has no Critical/High unresolved (or explicit waivers).

---

## Phase 2 — Staging Infra (Gate B)

Provision the VM, lock it down, and prepare Compose:

- Install Docker Engine and Docker Compose v2.
- Open only required ports externally (prefer 80/443 via reverse proxy). Keep Postgres/Redis internal to the Docker network.
- Clone repo or fetch deployment bundle to the VM.

Acceptance (Gate B):
- SSH access confirmed; Docker/Compose versions meet requirements.
- Optional reverse proxy terminates TLS and routes to backend/frontend containers.

---

## Phase 3 — Config & Secrets (Gate C)

Create `.env.staging` from `.env.staging.example` and store values in a secret store. Inject to the VM at deploy time.

Required keys (non‑exhaustive; see example file):
- App/Auth: `JWT_SECRET`, `JWT_SECRET_ROTATION?`, `ENCRYPTION_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`
- Server/CORS: `ALLOWED_ORIGINS`, `FRONTEND_URL`
- API URL (frontend runtime): `NEXT_PUBLIC_API_URL`
- Observability: `METRICS_TOKEN`
- DB/Cache: `DATABASE_URL`, `REDIS_URL`, `REDIS_PASSWORD`
- Feature Flags: `FEATURE_FLAG_*`
- Integrations (staging creds): Plex, Overseerr, Uptime Kuma, TMDB, YouTube

Important port note (Compose mapping):
- `docker-compose.yml` maps host→container as `${PORT:-3000}:3000` for backend.
- Backend server reads `PORT` to listen. To avoid a mismatch, set `PORT=3000` in `.env.staging` (recommended) or adjust Compose mapping to map `${PORT}:${PORT}` consistently. Do not set backend container to listen on 3001 unless you also change the right‑hand side mapping.
- Frontend mapping is `${FRONTEND_PORT:-3001}:3000` (container stays on 3000). Set `FRONTEND_PORT` as needed for host exposure.

Acceptance (Gate C):
- Secrets file present on VM with strict perms (`chmod 600 .env.staging`).
- `ALLOWED_ORIGINS` matches staging domains; `NEXT_PUBLIC_API_URL` points to the staging API URL.

---

## Phase 4 — Data & Backups (Gate D)

Bring up DB/Redis and apply schema + seed data.

```bash
# Start infra/app stack (initial bring‑up; see deployment below for full command)
docker compose --env-file .env.staging -f docker-compose.yml up -d --build

# Migrations + seed
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed

# Optional pre‑deployment backup
(cd backend && npm run db:backup:pre-deployment)
```

Acceptance (Gate D):
- Migrations applied idempotently; seed data present.
- Backup artifact exists; restore rehearsed on a disposable DB.

---

## Phase 5 — CI/CD to Staging (Gate E)

We deploy via Docker Compose on the VM (no GitHub workflow required). If building images on the VM, use the repo scripts; if pushing from CI, pull by tag.

Deploy (VM):

```bash
# With images built locally on VM
npm run build:production
# Optionally build optimized images at root
npm run docker:build:optimized

# Bring up stack
docker compose --env-file .env.staging -f docker-compose.yml up -d --build

# Verify containers
docker compose ps
```

Acceptance (Gate E):
- Containers healthy; backend/ frontend reachable; no crash loops.

---

## Phase 6 — Validation & QA (Gate F)

Smoke checks:

```bash
# API health
curl -fsS https://api.staging.medianest.example.com/health

# Metrics (Bearer token)
curl -fsS -H "Authorization: Bearer ${METRICS_TOKEN}" \
  https://api.staging.medianest.example.com/metrics | head -n 20

# Frontend (manual)
open https://staging.medianest.example.com  # or navigate in a browser
```

Automated suites:

```bash
# Regression
npm run test:ci

# E2E (backend, against staging)
(cd backend && BASE_URL=https://api.staging.medianest.example.com npm run test:e2e)

# Performance (light)
npm run load-test:light

# Security scans
npm run security
```

Acceptance (Gate F):
- Smoke 100% pass; E2E ≥ 95% pass; regression green.
- Perf: p95 API < 600ms; error rate < 1% during light test.
- Security: no Critical vulns; `/metrics` rejects without bearer; CORS/ratelimits effective.

---

## Phase 7 — Observability & Ops Readiness (Gate G)

- Metrics: Configure Prometheus to scrape `https://api.staging.medianest.example.com/metrics` with header `Authorization: Bearer ${METRICS_TOKEN}`. The backend already exposes prom-client metrics.
- Logging: Aggregate container logs to ELK/Loki/etc.; ensure JSON logs and retention ≥ 7 days in staging.
- Dashboards: Grafana panels for golden signals (req rate, p95/p99 latency, 4xx/5xx, CPU/MEM per service).
- Alerts (staging profile):
  - Healthcheck failing (3 consecutive checks)
  - p95 > 600ms for 10m
  - 5xx > 1% for 10m

Acceptance (Gate G):
- Dashboards rendering fresh data; synthetic checks/alerts tested.

---

## Phase 8 — Go/No‑Go & Rollback (Gate H)

Checklist (all must be “Go”):

- [ ] Gate A–G accepted and documented
- [ ] `npm run test:ci` green (≥ 65% coverage) on the staging commit
- [ ] E2E (backend) ≥ 95% pass; smoke 100% pass
- [ ] Secrets vaulted; `/metrics` gated; CORS restricted to staging domains
- [ ] Dashboards/alerts operational; logs centralized
- [ ] Rollback drill completed; last two image tags available
- [ ] Stakeholder sign‑offs: Backend / Frontend / QA / Security / DevOps / PO

Rollback strategy (staging):

- Containers/images:
  ```bash
  # If you tag/push images, pull previous known‑good tag then redeploy
  docker compose --env-file .env.staging -f docker-compose.yml pull
  docker compose --env-file .env.staging -f docker-compose.yml up -d  # service pins control versions

  # If building locally with tags, retag previous commit’s images and up -d
  ```
- Database:
  - Prefer forward‑only; for staging emergencies you may reset using `npm run db:rollback` or redeploy a fresh DB + re‑seed.
- Failure handling:
  - Gather logs: `docker compose logs backend` (and frontend/db/redis if relevant)
  - If partial outage, `docker compose down` followed by a clean `up -d` with known‑good images.

Post‑deploy validation:
- Re‑run smoke/E2E; check dashboards and alerts return to normal; file an incident summary if rollback was used.

---

## Verification Matrix (mapped to repo scripts)

| Category     | Command/Method                                                                 | Owner    | Acceptance |
|--------------|----------------------------------------------------------------------------------|----------|------------|
| Static       | `npm run typecheck && npm run lint`                                             | Devs     | No errors  |
| Unit/Integr. | `npm run test:ci`                                                               | Devs/QA  | ≥ 65% lines|
| E2E (API)    | `(cd backend && BASE_URL=… npm run test:e2e)`                                   | QA       | ≥ 95% pass |
| Smoke        | `curl /health`, `curl -H "Authorization: Bearer …" /metrics`, frontend load    | QA       | 100% pass  |
| Perf (light) | `npm run load-test:light`                                                       | QA/DevOps| p95<600ms  |
| Security     | `npm run security` + runtime checks (CORS, /metrics bearer, ratelimits)         | Security | No Critical|

---

## Deployment Commands (Quick Reference)

```bash
# 1) Prepare
cp .env.staging.example .env.staging  # then fill values from your vault
chmod 600 .env.staging

npm ci
npm run typecheck && npm run lint
npm run build && npm run build:verify
npm run test:ci

# 2) Deploy (VM)
docker compose --env-file .env.staging -f docker-compose.yml up -d --build

docker compose ps

# 3) DB ops
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed

# 4) Smoke
curl -fsS https://api.staging.medianest.example.com/health
curl -fsS -H "Authorization: Bearer ${METRICS_TOKEN}" \
  https://api.staging.medianest.example.com/metrics | head -n 20

# 5) Tests
(cd backend && BASE_URL=https://api.staging.medianest.example.com npm run test:e2e)
```

---

## Notes & Trade‑offs

- Compose vs. Kubernetes: Compose on a single VM is sufficient for staging and fastest to operationalize. Document a future path to k8s (namespace per env, secrets as K8s secrets, Ingress, HPA). Observability pieces (Prometheus/Grafana) map well to either.
- Secrets hygiene: never commit `.env.staging`; always source from vault; rotate `JWT_SECRET`, `METRICS_TOKEN`, and `REDIS_PASSWORD` periodically and on incident.
- CORS: keep `ALLOWED_ORIGINS` narrowly scoped to staging domains; log denies.
- Backend port alignment: ensure container listens on the same port Compose maps internally (3000 by default). If you change it, update both env and mapping consistently.

---

## Ownership Log (fill during execution)

- Staging VM provisioned by: ____  on: ____
- `.env.staging` vaulted by: ____  on: ____
- First deploy commit: ____  date: ____  tags: ____
- Rollback drill date: ____  duration: ____  notes: ____
- Dashboards/alerts validated by: ____

---

This runbook is source‑controlled in `docs/staging-runbook.md`. Keep it current as the deployment process evolves.
