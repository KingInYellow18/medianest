# MediaNest Staging Deployment Readiness Checklist

Objective: Ship to staging with guardrails across code quality, security, performance, testing, and infrastructure. Every step specifies commands, pass/fail, evidence, and owner. Phases: Pre‑flight → CI Gates → Release Artifacts → Infra Readiness → Deploy & Verify → Observability → Rollback.

Assumptions

- Node ≥ 18, npm ≥ 8
- Monorepo workspaces: `backend`, `frontend`, `shared`
- Orchestration: `docker-compose.yml` + `config/docker/docker-compose.prod.yml`
- Monitoring: `monitoring/docker-compose.yml`
- Tooling: Prisma, Vitest, Playwright, MkDocs
- Coverage threshold: ≥ 65% lines (repo CI standard)

Repo Pointers

- Workspaces: `backend/`, `frontend/`, `shared/`
- Orchestration: `docker-compose.yml`, `config/docker/docker-compose.prod.yml`
- Monitoring: `monitoring/docker-compose.yml`
- Security docs: `SECURITY_HARDENING_COMPLETE.md`
- Staging validation: `MEDIANEST_STAGING_DEPLOY_20250912.md`
- Deployment guide: `README_DEPLOYMENT.md`
- Env example: `.env.staging.example`

---

## Phase 0: Preconditions

- Tooling: Node/npm match engines; Docker/Compose available; access to secrets store.
- Branch hygiene: Conventional Commits; hooks enabled; CI green on branch.
- Env files: `.env.staging` derived from `.env.staging.example` (no secrets committed).

---

## Phase 1: Pre‑Flight (Developer Local)

- Formatting & linting:
  - Commands: `npm run format`; `cd backend && npm run lint`; `cd frontend && npm run lint`; `cd shared && npm run lint`
  - Pass: 0 errors; warnings acceptable only if documented.
  - Evidence: Lint output snippet in PR.
  - Owner: Backend, Frontend, Shared.

- Type safety:
  - Commands: `npm run typecheck` (or `npm run typecheck:backend && npm run typecheck:frontend`)
  - Pass: 0 TypeScript errors.
  - Evidence: TS logs if fixes were required.
  - Owner: Backend, Frontend.

- Fast tests smoke:
  - Command: `npm run test:ultra-fast`
  - Pass: 100% pass.
  - Evidence: Test summary.
  - Owner: All.

- Env parity check:
  - Command: Diff `.env.example` vs `.env.staging.example`
  - Pass: No missing keys in staging example.
  - Evidence: Short diff or “no diff”.
  - Owner: DevOps, Backend.

---

## Phase 2: CI Gates (Automated, PR‑blocking)

- Build all:
  - Commands: `npm run build`; verify with `npm run build:verify`
  - Pass: Exit 0; Backend ✅, Frontend ✅ in verify output.
  - Evidence: `build-output.log`, `build-metrics.json`
  - Owner: Backend, Frontend
  - CI job: `build-all` | Cache: node_modules by `package-lock.json`

- Unit/integration + coverage:
  - Command: `npm run test:ci`
  - Pass: All tests pass; lines coverage ≥ 65%
  - Evidence: `test-results/coverage-results.json` or coverage summary
  - Owner: All
  - CI job: `test-ci` and `test-coverage` | Cache: vitest cache

- Security (deps + SAST hooks):
  - Commands: `npm run security`; `npm run security:scan`
  - Pass: 0 Critical/High; Mediums documented (owner/date)
  - Evidence: `security-audit-results.json`
  - Owner: DevOps, Backend
  - CI job: `security-scan`

- Docs build:
  - Command: `npm run docs:build`
  - Pass: MkDocs builds (exit 0)
  - Evidence: `site/` build log
  - Owner: DevOps
  - CI job: `build-docs`

- E2E (API-level where feasible):
  - Command: `npm run test:e2e` (from `backend/`)
  - Pass: All Playwright e2e pass
  - Evidence: `backend/playwright-report/`
  - Owner: Backend
  - CI job: `e2e-backend`

---

## Phase 3: Release Candidate Artifacts (Tag/Release)

- Production images:
  - Commands:
    - `docker build -f Dockerfile --target backend-production -t medianest-backend:${GIT_SHA} .`
    - `docker build -f Dockerfile --target frontend-production -t medianest-frontend:${GIT_SHA} .`
  - Pass: Builds succeed; healthcheck OK when run locally
  - Evidence: Image digests; `docker history` size snapshot
  - Owner: DevOps
  - CI job: `build-push-containers` | Cache: Docker layer cache

- Docs publish (optional on tag):
  - Commands: `npm run docs:gh-deploy` or `scripts/deploy-docs.sh`
  - Pass: Site live
  - Evidence: Build logs
  - Owner: DevOps

---

## Phase 4: Staging Infrastructure Readiness

- Secrets & config set:
  - Action: Validate from secure store; ensure `.env.staging` present
  - Pass: All required vars resolved (JWT, NextAuth, DB/Redis URLs, encryption keys)
  - Evidence: Redacted checklist (no secrets)
  - Owner: DevOps

- DB backup then migrate:
  - Commands:
    - Backup: `backend/scripts/backup-procedures.sh pre-deployment` (or compose `pg_dump`)
    - Migrate: `npm run db:migrate`
  - Pass: Backup artifact exists; migrate exit 0
  - Evidence: Backup filename; migrate logs
  - Owner: DevOps, Backend

- Pull new images (if using registry):
  - Command: `docker compose -f docker-compose.yml -f config/docker/docker-compose.prod.yml pull`
  - Pass: Latest tags pulled
  - Evidence: Compose pull output
  - Owner: DevOps

- Monitoring stack up (if separate host, skip here):
  - Command: `docker compose -f monitoring/docker-compose.yml up -d`
  - Pass: Prometheus/Grafana/Loki healthy
  - Evidence: `docker compose ps` output
  - Owner: DevOps

---

## Phase 5: Deploy to Staging & Verify

- Deploy app:
  - Command: `docker compose -f docker-compose.yml -f config/docker/docker-compose.prod.yml --env-file .env.staging up -d --build backend frontend`
  - Pass: `docker compose ps` healthy; no CrashLoop
  - Evidence: `docker compose ps` output
  - Owner: DevOps

- Smoke endpoints:
  - Commands:
    - API: `curl -sfS http://<staging>/health`
    - Frontend: `curl -sfS http://<staging>/`
  - Pass: HTTP 200 for both
  - Evidence: Curl logs
  - Owner: Backend, Frontend

- E2E against staging:
  - Command: `cd backend && npx playwright test --reporter=line`
  - Pass: All critical flows green
  - Evidence: `backend/playwright-report/`
  - Owner: Backend

- Performance sanity (optional gate):
  - Command: `npm run load-test:light` (or `npm run load-test:staged`)
  - Pass: No error spikes; baseline p95 within agreed band
  - Evidence: k6 summary JSON
  - Owner: DevOps

---

## Phase 6: Observability & SLO Checks

- Metrics & logs flowing:
  - Command: `docker compose -f monitoring/docker-compose.yml ps`
  - Pass: New app version metrics visible; logs indexed in Loki ≤ 5 minutes
  - Evidence: Grafana dashboard screenshots
  - Owner: DevOps

- Runtime guards:
  - Action: Check API rate limit and healthcheck alerts
  - Pass: No active alarms after 15 minutes steady state
  - Evidence: Alertmanager status
  - Owner: DevOps

---

## Phase 7: Rollback Readiness (Exercise Once)

- Image‑level rollback:
  - Action: Redeploy previous tag via compose image override
  - Pass: Previous version healthy + smoke pass
  - Evidence: Deployment and smoke logs
  - Owner: DevOps

- Schema compatibility:
  - Note: If migrations are non‑reversible, document impact; prefer feature toggles.

---

## PR Evidence Bundle (attach or link)

- Build: `build-output.log`, `build-metrics.json`
- Tests: `test-results/coverage-results.json`, `backend/playwright-report/`
- Security: `security-audit-results.json` (redacted)
- Infra: Migration logs; backup artifact name/hash
- Deploy: `docker compose ps` output; curl checks
- Monitoring: Grafana screenshots; alert status

---

## CI Job Map (suggested)

- build-all: Install + `npm run build` + `npm run build:verify`; cache node_modules by `package-lock.json`
- test-ci: `npm run test:ci`; cache vitest
- test-coverage: `npm run test:coverage`; upload reports
- security-scan: `npm run security` + `npm run security:scan`
- e2e-backend: `npm run test:e2e` (containerized)
- build-push-containers: Multi-stage Docker builds; push to registry
- deploy-staging (manual/approve): Compose pull + up; runs Phase 5
- post-deploy-verify: Smoke + optional k6; uploads artifacts
- monitoring-check: Validate Prometheus/Grafana/Loki health

---

## Rationale Highlights

- Coverage ≥ 65%: Matches repo CI threshold; enforces regression catch without blocking iteration.
- Zero High/Critical vulns: Baseline safety for staging; documented Mediums acceptable short-term.
- Smoke + E2E on staging: Surfaces env-specific issues beyond CI mocks.
- DB backup pre‑migrate: Ensures safe rollback path for data.
- Observability gate: Confirms telemetry/alerting prior to prod promotion.

---

## Gaps & Light Proposals (planning only; no edits made)

- Staging-tagged E2E: Add `test:e2e:staging` targeting live host with tag `@staging`.
- Automated smoke: Add `tests/smoke.spec.ts` or `scripts/smoke.sh` for consistent checks.
- Compose staging overlay: Consider `config/docker/docker-compose.staging.yml` for env deltas.
- Performance baseline: Persist k6 JSON trend to detect regressions vs last staging.
