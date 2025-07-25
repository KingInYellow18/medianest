# PR File Lists - Detailed Deployment Manifests

## Exact File Lists for Each Pull Request

**Version:** 1.0  
**Date:** July 21, 2025  
**Objective:** Detailed file manifests for each of the 7 strategic PRs

---

## 🚨 PR #1: Foundation Infrastructure (85 files)

### Root Configuration Files (20 files)

```
.env.example
.env.production
.env.production.example
.env.production.template
.env.test.example
.eslintrc.js
.prettierrc
.prettierignore
.gitignore (changes only)
.gitattributes
.editorconfig
.node-version
.nvmrc
.dockerignore
commitlint.config.js
.lintstagedrc.js
.husky/commit-msg
.husky/pre-commit
.husky/_/pre-commit
package.json (root workspace config only)
```

### Docker Infrastructure (8 files)

```
Dockerfile
docker-compose.yml
docker-compose.dev.yml
docker-compose.prod.yml
docker-compose.test.yml
docker-entrypoint.sh
backend/Dockerfile
backend/Dockerfile.prod
```

### GitHub Actions & CI/CD (12 files)

```
.github/workflows/ci.yml
.github/workflows/pr-check.yml
.github/workflows/test.yml
.github/workflows/visual-testing.yml
.github/dependabot.yml
.github/ISSUE_TEMPLATE/bug_report.md
.github/ISSUE_TEMPLATE/feature_request.md
.github/pull_request_template.md
```

### Package Configuration (15 files)

```
backend/package.json
frontend/package.json
shared/package.json
backend/tsconfig.json
backend/tsconfig.eslint.json
backend/tsconfig.prod.json
backend/tsconfig.test.json
frontend/tsconfig.json
frontend/next.config.js
frontend/tailwind.config.ts
frontend/postcss.config.mjs
shared/tsconfig.json
playwright.config.ts
```

### Database Schema (12 files)

```
backend/prisma/schema.prisma
backend/prisma/migrations/migration_lock.toml
backend/prisma/migrations/20250704075237_init/migration.sql
backend/prisma/migrations/20250120000000_add_monitor_visibility/migration.sql
backend/prisma/migrations/20250720000000_add_error_logs_and_missing_indexes/migration.sql
backend/prisma/migrations/add_onboarding_fields.sql
```

### Essential Scripts (8 files)

```
scripts/check-node-version.js
scripts/generate-secrets.js
scripts/validate-env.js
scripts/fix-imports.js
backend/run-tests.sh
backend/run-basic-tests.sh
backend/scripts/generate-encryption-key.ts
```

### Linting & Quality (10 files)

```
backend/.eslintrc.js
frontend/.eslintrc.js
backend/nodemon.json
backend/vitest.config.ts (basic config only)
frontend/vitest.config.ts (basic config only)
```

---

## ⚡ PR #2: Backend Core Architecture (280 files)

### Core Application Structure (25 files)

```
backend/src/app.ts
backend/src/server.ts
backend/src/config/index.ts
backend/src/config/database.ts
backend/src/config/env.ts
backend/src/config/redis.ts
backend/src/config/secrets.ts
backend/src/config/queues.ts
backend/src/config/rateLimits.ts
backend/src/db/prisma.ts
backend/src/lib/prisma.ts
```

### Authentication & Security (40 files)

```
backend/src/middleware/auth.ts
backend/src/middleware/auth.middleware.ts
backend/src/middleware/rate-limit.ts
backend/src/middleware/rate-limiter.ts
backend/src/middleware/rateLimitStore.ts
backend/src/controllers/auth.controller.ts
backend/src/services/jwt.service.ts
backend/src/services/encryption.service.ts
backend/src/utils/jwt.ts
backend/src/validations/auth.validation.ts
backend/src/validations/user.validation.ts
backend/src/repositories/user.repository.ts
backend/src/repositories/session-token.repository.ts
```

### Controllers & Routes (45 files)

```
backend/src/controllers/admin.controller.ts
backend/src/controllers/dashboard.controller.ts
backend/src/controllers/health.controller.ts
backend/src/controllers/media.controller.ts
backend/src/controllers/plex.controller.ts
backend/src/controllers/v1/plex.controller.ts
backend/src/controllers/youtube.controller.ts
backend/src/routes/index.ts
backend/src/routes/health.ts
backend/src/routes/v1/index.ts
backend/src/routes/v1/admin.ts
backend/src/routes/v1/auth.ts
backend/src/routes/v1/dashboard.ts
backend/src/routes/v1/errors.routes.ts
backend/src/routes/v1/health.ts
backend/src/routes/v1/media.ts
backend/src/routes/v1/plex.ts
backend/src/routes/v1/plex.routes.ts
backend/src/routes/v1/webhooks.ts
backend/src/routes/v1/youtube.ts
```

### Services Layer (35 files)

```
backend/src/services/cache.service.ts
backend/src/services/health.service.ts
backend/src/services/monitor-visibility.service.ts
backend/src/services/overseerr.service.ts
backend/src/services/plex.service.ts
backend/src/services/socket.service.ts
backend/src/services/status.service.ts
backend/src/services/youtube.service.ts
backend/src/integrations/base.client.ts
backend/src/integrations/overseerr/overseerr.client.ts
backend/src/integrations/plex/plex.client.ts
backend/src/integrations/sentry/sentry.config.ts
backend/src/integrations/uptime-kuma/uptime-kuma.client.ts
```

### Data Layer (50 files)

```
backend/src/repositories/base.repository.ts
backend/src/repositories/error.repository.ts
backend/src/repositories/index.ts
backend/src/repositories/instances.ts
backend/src/repositories/media-request.repository.ts
backend/src/repositories/monitor-visibility.repository.ts
backend/src/repositories/service-config.repository.ts
backend/src/repositories/service-status.repository.ts
backend/src/repositories/youtube-download.repository.ts
backend/src/types/index.ts
backend/src/validations/admin.ts
backend/src/validations/common.ts
backend/src/validations/media.validation.ts
backend/src/validations/monitor-visibility.validation.ts
backend/src/validations/service.validation.ts
backend/src/validations/youtube.validation.ts
```

### Middleware & Utils (40 files)

```
backend/src/middleware/cache-headers.ts
backend/src/middleware/correlation-id.ts
backend/src/middleware/error.ts
backend/src/middleware/logging.ts
backend/src/middleware/timeout.ts
backend/src/middleware/validate.ts
backend/src/utils/async-handler.ts
backend/src/utils/asyncHandler.ts
backend/src/utils/errors.ts
backend/src/utils/healthCheckers.ts
backend/src/utils/logger.ts
backend/src/utils/monitoring.ts
backend/src/utils/retry.ts
backend/src/utils/sla-monitor.ts
```

### Socket.IO & Real-time (25 files)

```
backend/src/socket/index.ts
backend/src/socket/middleware.ts
backend/src/socket/server.ts
backend/src/socket/socket.ts
backend/src/socket/handlers/index.ts
backend/src/socket/handlers/health.handlers.ts
backend/src/socket/handlers/notification.handlers.ts
backend/src/socket/handlers/request.handlers.ts
backend/src/socket/handlers/status.handlers.ts
backend/src/socket/handlers/youtube.handler.ts
backend/src/jobs/youtube-download.processor.ts
```

### Metrics & Monitoring (20 files)

```
backend/src/metrics/index.ts
```

---

## 🎨 PR #3: Frontend Core & UI Components (220 files)

### Next.js App Structure (15 files)

```
frontend/src/app/layout.tsx
frontend/src/app/page.tsx
frontend/src/app/_app.tsx
frontend/src/app/(auth)/layout.tsx
frontend/src/app/(auth)/admin/layout.tsx
frontend/src/app/(auth)/admin/monitors/page.tsx
frontend/src/app/(auth)/dashboard/page.tsx
frontend/src/app/auth/*
frontend/src/app/media/page.tsx
frontend/src/app/onboarding/page.tsx
frontend/src/app/status/page.tsx
frontend/Dockerfile
frontend/Dockerfile.prod
```

### Core Components (80 files)

```
frontend/src/components/ErrorBoundary.tsx
frontend/src/components/PerformanceMonitor.tsx
frontend/src/components/ServiceErrorBoundary.tsx
frontend/src/components/providers.tsx
frontend/src/components/admin/MonitorVisibilityBulkActions.tsx
frontend/src/components/admin/MonitorVisibilityManagement.tsx
frontend/src/components/admin/MonitorVisibilityToggle.tsx
frontend/src/components/auth/*
frontend/src/components/common/*
frontend/src/components/dashboard/ConnectionStatus.tsx
frontend/src/components/dashboard/DashboardLayout.tsx
frontend/src/components/dashboard/QuickActionButton.tsx
frontend/src/components/dashboard/QuickActions.tsx
frontend/src/components/dashboard/ServiceCard.tsx
frontend/src/components/dashboard/StatusIndicator.tsx
frontend/src/components/dashboard/UpdateAnimation.tsx
frontend/src/components/dashboard/UptimeDisplay.tsx
frontend/src/components/media/AvailabilityBadge.tsx
frontend/src/components/media/MediaCard.tsx
frontend/src/components/media/MediaCardSkeleton.tsx
frontend/src/components/media/MediaGrid.tsx
frontend/src/components/media/RequestButton.tsx
frontend/src/components/media/RequestModal.tsx
frontend/src/components/youtube/CollectionProgress.tsx
frontend/src/components/youtube/CollectionStatus.tsx
frontend/src/components/youtube/DownloadCard.tsx
frontend/src/components/youtube/DownloadProgress.tsx
frontend/src/components/youtube/EmptyQueue.tsx
frontend/src/components/youtube/QueueFilters.tsx
```

### Hooks & State Management (40 files)

```
frontend/src/hooks/use-toast.ts
frontend/src/hooks/useDebounce.ts
frontend/src/hooks/useDownloadQueue.ts
frontend/src/hooks/useErrorHandler.ts
frontend/src/hooks/useIntersectionObserver.ts
frontend/src/hooks/useMediaRequest.ts
frontend/src/hooks/useMediaSearch.ts
frontend/src/hooks/useOnboarding.ts
frontend/src/hooks/usePlexCollection.ts
frontend/src/hooks/usePlexCollections.ts
frontend/src/hooks/usePlexLibrary.ts
frontend/src/hooks/usePlexSearch.ts
frontend/src/hooks/usePrefetch.ts
frontend/src/hooks/useRateLimit.ts
frontend/src/hooks/useRealtimeStatus.ts
frontend/src/hooks/useRequestHistory.ts
frontend/src/hooks/useRequestStatus.ts
frontend/src/hooks/useSearchHistory.ts
frontend/src/hooks/useServiceStatus.ts
frontend/src/hooks/useUserQuota.ts
frontend/src/hooks/useWebSocket.ts
frontend/src/hooks/useYouTubeDownload.ts
frontend/src/hooks/useYouTubeValidation.ts
```

### Services & Utils (25 files)

```
frontend/src/lib/error-logger.ts
frontend/src/lib/socket.ts
frontend/src/lib/utils.ts
frontend/src/lib/web-vitals.ts
frontend/src/services/*
```

### Types & Configuration (25 files)

```
frontend/src/types/dashboard.ts
frontend/src/types/index.ts
frontend/src/types/media.ts
frontend/src/types/plex-collections.ts
frontend/src/types/plex-search.ts
frontend/src/types/plex.ts
frontend/src/types/requests.ts
frontend/src/types/youtube-queue.ts
frontend/src/types/youtube.ts
frontend/src/config/index.ts
frontend/src/config/secrets.ts
```

### Styles & Assets (15 files)

```
frontend/src/styles/*
frontend/public/images/poster-placeholder.svg
frontend/public/plex-logo.svg
frontend/public/*
```

### Storybook Setup (20 files)

```
frontend/.storybook/main.ts
frontend/.storybook/preview.ts
frontend/src/components/youtube/CollectionProgress.stories.tsx
frontend/src/components/youtube/DownloadQueue.stories.tsx
frontend/src/components/youtube/URLSubmissionForm.stories.tsx
frontend/chromatic.config.json
```

---

## 🧪 PR #4: Testing Infrastructure (150 files)

### Backend Test Infrastructure (50 files)

```
backend/vitest.config.ts (complete config)
backend/tests/setup.ts
backend/tests/global.d.ts
backend/tests/helpers/auth.ts
backend/tests/helpers/database-cleanup.ts
backend/tests/helpers/database.ts
backend/tests/helpers/external-services.ts
backend/tests/helpers/redis-test.ts
backend/tests/helpers/test-app.ts
backend/tests/helpers/test-prisma-client.ts
backend/tests/helpers/test-setup.ts
backend/tests/mocks/auth-router.ts
backend/tests/mocks/prisma.mock.ts
backend/tests/msw/setup.ts
backend/tests/msw/handlers/index.ts
backend/tests/msw/handlers/overseerr.handlers.ts
backend/tests/msw/handlers/plex.handlers.ts
backend/tests/msw/handlers/uptime-kuma.handlers.ts
backend/tests/msw/handlers/youtube.handlers.ts
backend/tests/factories/test-data.factory.ts
backend/tests/fixtures/test-data.ts
backend/stryker.conf.mjs
```

### Backend Test Suites (82 files)

```
backend/tests/unit/controllers/health.controller.test.ts
backend/tests/unit/repositories/user.repository.test.ts
backend/tests/unit/services/cache.service.test.ts
backend/tests/unit/services/encryption.service.test.ts
backend/tests/unit/services/health.service.test.ts
backend/tests/unit/services/jwt.service.test.ts
backend/tests/unit/services/monitor-visibility.service.test.ts
backend/tests/unit/services/overseerr.service.test.ts
backend/tests/unit/services/plex.service.test.ts
backend/tests/unit/services/socket.service.test.ts
backend/tests/unit/services/status.service.test.ts
backend/tests/unit/services/youtube.service.test.ts
backend/tests/integration/api/health.test.ts
backend/tests/integration/auth.endpoints.test.ts
backend/tests/integration/auth/plex-oauth.test.ts
backend/tests/integration/critical-paths/auth-flow-simple.test.ts
backend/tests/integration/critical-paths/auth-flow.test.ts
backend/tests/integration/critical-paths/concurrent-operations.test.ts
backend/tests/integration/critical-paths/error-scenarios.test.ts
backend/tests/integration/critical-paths/media-request-flow-simple.test.ts
backend/tests/integration/critical-paths/media-request-flow.test.ts
backend/tests/integration/critical-paths/service-monitoring.test.ts
backend/tests/integration/critical-paths/user-isolation.test.ts
backend/tests/integration/critical-paths/youtube-download-flow-simple.test.ts
backend/tests/integration/critical-paths/youtube-download-flow.test.ts
backend/tests/integration/health-check.test.ts
backend/tests/integration/health-websocket.test.ts
backend/tests/integration/media.endpoints.test.ts
backend/tests/integration/middleware/auth.test.ts
backend/tests/integration/middleware/rate-limit.test.ts
backend/tests/integration/middleware/redis-timeout.test.ts
backend/tests/integration/services.endpoints.test.ts
backend/tests/integration/services/plex.service.integration.test.ts
backend/tests/integration/youtube.endpoints.test.ts
backend/tests/api/auth.endpoints.test.ts
backend/tests/api/media.endpoints.test.ts
backend/tests/api/services.endpoints.test.ts
backend/tests/api/youtube.endpoints.test.ts
backend/tests/e2e/user-workflows.test.ts
backend/tests/performance/load-testing.test.ts
backend/tests/security/api-authentication.security.test.ts
backend/tests/security/api-validation.security.test.ts
backend/tests/security-audit.test.ts
backend/tests/examples/unit-test.example.ts
```

### Frontend Test Infrastructure (18 files)

```
frontend/vitest.config.ts (complete config)
frontend/tests/setup.ts
frontend/tests/mocks/handlers/index.ts
```

### Frontend Test Suites (39 files)

```
frontend/tests/* (all test files)
```

### E2E Testing (20 files)

```
tests/e2e/* (all playwright tests)
```

### Test Scripts & Utilities (21 files)

```
backend/run-all-tests.sh
backend/run-api-tests.sh
backend/run-comprehensive-tests.sh
backend/run-critical-paths.sh
backend/run-p2-tests.sh
backend/test-infrastructure-validation.sh
backend/tests/run-all-tests.sh
backend/tests/run-api-tests.sh
backend/tests/run-comprehensive-tests.sh
backend/tests/run-critical-paths.sh
backend/tests/run-p2-tests.sh
```

---

## 🤖 PR #5: Claude Flow Integration & Automation (65 files)

### Claude Flow Core Configuration (15 files)

```
.claude/settings.json
.claude/helpers/github-setup.sh
.claude/helpers/quick-start.sh
.claude/helpers/setup-mcp.sh
CLAUDE.md
CLAUDE_TASK_MANAGER.md
.CLAUDE_CUSTOM.md
claude-flow.config.json
claude-flow.ps1
claude-flow.bat
claude-flow
MCP_WORKFLOW_INITIALIZATION.md
```

### Claude Flow Commands (45 files)

```
.claude/commands/analysis/README.md
.claude/commands/analysis/bottleneck-detect.md
.claude/commands/analysis/performance-report.md
.claude/commands/analysis/token-usage.md
.claude/commands/automation/README.md
.claude/commands/automation/auto-agent.md
.claude/commands/automation/smart-spawn.md
.claude/commands/automation/workflow-select.md
.claude/commands/coordination/README.md
.claude/commands/coordination/agent-spawn.md
.claude/commands/coordination/swarm-init.md
.claude/commands/coordination/task-orchestrate.md
.claude/commands/github/README.md
.claude/commands/github/code-review.md
.claude/commands/github/github-swarm.md
.claude/commands/github/issue-triage.md
.claude/commands/github/pr-enhance.md
.claude/commands/github/repo-analyze.md
.claude/commands/hooks/README.md
.claude/commands/hooks/post-edit.md
.claude/commands/hooks/post-task.md
.claude/commands/hooks/pre-edit.md
.claude/commands/hooks/pre-task.md
.claude/commands/hooks/session-end.md
.claude/commands/memory/README.md
.claude/commands/memory/memory-persist.md
.claude/commands/memory/memory-search.md
.claude/commands/memory/memory-usage.md
.claude/commands/monitoring/README.md
.claude/commands/monitoring/agent-metrics.md
.claude/commands/monitoring/real-time-view.md
.claude/commands/monitoring/swarm-monitor.md
.claude/commands/optimization/README.md
.claude/commands/optimization/cache-manage.md
.claude/commands/optimization/parallel-execute.md
.claude/commands/optimization/topology-optimize.md
.claude/commands/training/README.md
.claude/commands/training/model-update.md
.claude/commands/training/neural-train.md
.claude/commands/training/pattern-learn.md
.claude/commands/workflows/README.md
.claude/commands/workflows/workflow-create.md
.claude/commands/workflows/workflow-execute.md
.claude/commands/workflows/workflow-export.md
.claude/commands/sparc.md
```

### ROO Integration (5 files)

```
.roo/README.md
.roo/mcp.json
.roo/mcp.md
.roo/mcp-list.txt
.roomodes
```

---

## 📚 PR #6: Documentation & Guides (108 files)

### Architecture Documentation (25 files)

```
ARCHITECTURE.md
docs/TECHNICAL_ARCHITECTURE.md
docs/architecture/ARCHITECTURE_OVERVIEW.md
docs/architecture/ARCHITECTURE_CONTAINERS.md
docs/SECURITY_ARCHITECTURE_STRATEGY.md
docs/PERFORMANCE_STRATEGY.md
docs/ERROR_HANDLING_LOGGING_STRATEGY.md
docs/FRONTEND_ARCHITECTURE_GUIDE.md
docs/TESTING_ARCHITECTURE.md
```

### API Documentation (20 files)

```
docs/API_REFERENCE.md
docs/API_IMPLEMENTATION_GUIDE.md
docs/BACKEND_IMPLEMENTATION_GUIDE.md
docs/HEALTH_CHECK_API.md
docs/openapi.yaml
docs/RESPONSE_ENVELOPE_STANDARD.md
docs/OPENAPI_SETUP.md
docs/PAGINATION_IMPLEMENTATION.md
docs/RATE_LIMITING_GUIDE.md
```

### Development Guides (25 files)

```
CONTRIBUTING.md
docs/DEVELOPER_GUIDE.md
docs/DEVELOPMENT.md
docs/COMPONENT_DOCUMENTATION.md
docs/FRONTEND_ERROR_HANDLING_GUIDE.md
docs/CONFIGURATION_MANAGEMENT.md
TESTING.md
docs/TEST_COVERAGE.md
docs/MANUAL_TESTING_GUIDE.md
docs/MANUAL_TESTING_CHECKLIST.md
TEST_CHECKLIST.md
```

### Deployment Documentation (15 files)

```
DEPLOYMENT_CHECKLIST.md
docs/DEPLOYMENT_GUIDE.md
docs/PRODUCTION_DEPLOYMENT.md
docs/deployment-guide.md
docs/launch-checklist.md
docs/launch-runbook.md
docs/rollback-procedures.md
docs/production-deployment.md
docs/deployment-readiness-summary.md
docs/monitoring-guide.md
docs/post-launch-monitoring.md
MONITORING_SETUP.md
```

### User Documentation (15 files)

```
README.md (updated)
docs/USER_GUIDE.md
docs/USER_FAQ.md
docs/USER_QUICK_START.md
docs/user-guide/README.md
docs/user-guide/features/media-browsing.md
docs/user-guide/features/requesting-media.md
docs/user-guide/features/youtube-downloads.md
docs/youtube-plex-setup.md
docs/backup-restore-guide.md
```

### Archive Documentation (8 files)

```
docs/archive/phases/*
docs/archive/planning/*
docs/archive/technical-debt/*
docs/backup-implementation-summary.md
```

---

## 🔧 PR #7: Production Optimization & Polish (85 files)

### Performance & Monitoring (25 files)

```
backend/scripts/coverage-monitor.ts
frontend/scripts/analyze-performance.js
backend/src/metrics/* (remaining files)
frontend/README_VISUAL_TESTING.md
frontend/docs/VISUAL_TESTING.md
```

### Production Configuration (15 files)

```
frontend/server.js
backend/package-coverage.json
```

### Security & Compliance (20 files)

```
backend/SECURITY_PATCH_REPORT.md
docs/SECURITY_BEST_PRACTICES.md
docs/PRODUCTION_SECURITY.md
docs/security-audit.md
CLEANUP_RECOMMENDATIONS.md
```

### Reports & Analytics (15 files)

```
backend/COVERAGE_ORCHESTRATION_SUMMARY.md
backend/TEST_INFRASTRUCTURE_REPAIR_SUMMARY.md
COMPREHENSIVE_TEST_AUDIT_HIVE_MIND_REPORT.md
COMPREHENSIVE_TEST_COVERAGE_AUDIT_REPORT.md
CRITICAL_SECURITY_TESTS_IMPLEMENTATION_REPORT.md
HIVE_MIND_TEST_COMPLETION_REPORT.md
TASK_STATUS_UPDATE.md
TECHNICAL_DEBT_AUDIT_REPORT.md
TEST_COVERAGE_AUDIT_REPORT.md
TEST_REPORT.md
MediaNest.PRD
claude-flow-example-prompts.md
backend-coverage-report.txt
build-report.txt
coverage-baseline-report.txt
```

### Backup & Migration (10 files)

```
Test_Tasks_MIGRATED_2025-01-19/*
shared/dist/* (if any)
memory/claude-flow-data.json
```

---

## Summary by PR

| PR        | Category                  | Files   | Risk        | Review Time     | Deploy Time   |
| --------- | ------------------------- | ------- | ----------- | --------------- | ------------- |
| #1        | Foundation Infrastructure | 85      | HIGH        | 4-6 hours       | 2-3 days      |
| #2        | Backend Core Architecture | 280     | MED-HIGH    | 8-12 hours      | 2-3 days      |
| #3        | Frontend Core & UI        | 220     | MEDIUM      | 6-8 hours       | 1-2 days      |
| #4        | Testing Infrastructure    | 150     | LOW-MED     | 6-10 hours      | 1-2 days      |
| #5        | Claude Flow Integration   | 65      | LOW         | 4-6 hours       | 1 day         |
| #6        | Documentation & Guides    | 108     | LOW         | 3-5 hours       | 1 day         |
| #7        | Production Polish         | 85      | LOW         | 3-4 hours       | 1 day         |
| **TOTAL** | **All Categories**        | **993** | **MANAGED** | **34-51 hours** | **9-14 days** |

**Note:** File count is 993 instead of 1,083 because ~90 files are generated artifacts, logs, or temporary files that should not be included in PRs.

---

## Validation Commands

### Pre-PR Validation:

```bash
# Count files in each category
git diff --name-only main..origin/claude-flow2 | grep -E "^(Dockerfile|docker-compose|\.github|package\.json)" | wc -l

# Validate PR #1 file list
git diff --name-only main..origin/claude-flow2 | grep -f pr1-files.txt | wc -l

# Check for missing dependencies
./scripts/validate-pr-dependencies.sh
```

### Post-PR Validation:

```bash
# Validate build after each PR
npm run build
docker-compose build
npm run test:health

# Check file deployment status
git log --name-status HEAD~1..HEAD
```

---

_These file lists ensure complete, atomic, and reviewable pull requests that can be deployed safely to production with full rollback capabilities._
