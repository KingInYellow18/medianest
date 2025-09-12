# Repository Guidelines

This monorepo contains a TypeScript/Node stack with shared code and separate backend and frontend apps. Follow these practices to keep builds reproducible and reviews fast.

## Project Structure & Module Organization

- `backend/`: Express API, Prisma, Playwright e2e tests.
- `frontend/`: Next.js app and UI tests.
- `shared/`: Reusable TS utilities and config.
- `src/`: Root-level services and tooling used across the repo.
- `tests/`: Cross‑package unit/integration tests.
- `scripts/`, `docs/|site/`: CI/dev scripts, MkDocs documentation.

## Build, Test, and Development Commands

- Install: `npm install` (Node ≥ 18, npm ≥ 8).
- Dev (both apps): `npm run dev`.
- Backend only: `npm run start:backend` | `npm run dev:backend`.
- Frontend only: `npm run start:frontend` | `npm run dev:frontend`.
- Build: `npm run build` (calls workspace builds).
- Tests (unit): `npm test` | fast: `npm run test:fast` | coverage: `npm run test:coverage`.
- E2E (backend): `npm run test:e2e` (from `backend/`).
- Type safety & linting: `npm run typecheck`, `npm run lint`, `npm run lint:fix`, `npm run format`.
- Database: `npm run db:migrate` | seed: `npm run db:seed` (uses Prisma).

## Coding Style & Naming Conventions

- Formatting (Prettier): 2‑space indent, single quotes, trailing commas, 100‑char width.
- Linting (ESLint + @typescript-eslint): import ordering enforced; avoid `console` except `warn`/`error`.
- Files: components `PascalCase.tsx`; utilities `kebab-case.ts`; tests `*.test.ts` / `*.test.tsx`.

## Testing Guidelines

- Frameworks: Vitest for unit/integration; Playwright for e2e (backend).
- Locations: `backend/tests/**`, `frontend/src/**.test.tsx`, `tests/**`.
- Coverage: CI requires ≥ 65% lines via `npm run test:ci`.
- Conventions: co‑locate small unit tests next to code or under `tests/`; name with `.test.` suffix.

## Commit & Pull Request Guidelines

- Conventional Commits enforced (commitlint): types `feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert, hotfix, emergency`; header ≤ 100 chars; include a scope.
- Hooks: Husky runs formatting and checks; bypass only for emergencies via `MEDIANEST_SKIP_HOOKS=1` (never in CI).
- PRs: fill template, link issues (`Fixes #123`), describe testing, attach screenshots for UI changes, ensure lint, typecheck, and tests pass.

## Security & Configuration Tips

- Copy `.env.example` to `.env` locally; never commit secrets.
- Use `npm run db:migrate` before running the API; validate with `npm run db:check`.
- See `ARCHITECTURE.md` and `SECURITY_HARDENING_COMPLETE.md` for deeper context.

## Documentation

- Authoritative project documentation lives in `/docs` (MkDocs). Preview with `npm run docs:serve` and build with `npm run docs:build`.
