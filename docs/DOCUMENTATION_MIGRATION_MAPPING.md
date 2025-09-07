# Documentation Migration File Mapping

## Overview

This document provides the detailed file mapping from current MediaNest documentation to the optimized structure. Total consolidation: **5,461 → ~150-200** well-organized documents.

## Critical Content Preservation Matrix

### 🔥 High Priority - Must Preserve (Comprehensive Integration Required)

| Current File                             | Target Location                           | Action | Content Value |
| ---------------------------------------- | ----------------------------------------- | ------ | ------------- |
| `docs/TESTING_ARCHITECTURE.md`           | `06-testing/README.md` + multiple         | SPLIT  | ⭐⭐⭐⭐⭐    |
| `docs/API_IMPLEMENTATION_GUIDE.md`       | `03-api/README.md` + multiple             | SPLIT  | ⭐⭐⭐⭐⭐    |
| `docs/BACKEND_IMPLEMENTATION_GUIDE.md`   | `05-backend/README.md` + multiple         | SPLIT  | ⭐⭐⭐⭐⭐    |
| `docs/FRONTEND_ARCHITECTURE_GUIDE.md`    | `04-frontend/README.md` + multiple        | SPLIT  | ⭐⭐⭐⭐⭐    |
| `docs/SECURITY_ARCHITECTURE_STRATEGY.md` | `08-security/README.md` + multiple        | SPLIT  | ⭐⭐⭐⭐⭐    |
| `docs/PERFORMANCE_STRATEGY.md`           | `09-operations/performance-monitoring.md` | MERGE  | ⭐⭐⭐⭐⭐    |
| `IMPLEMENTATION_ROADMAP.md`              | `01-getting-started/README.md`            | MERGE  | ⭐⭐⭐⭐      |
| `ARCHITECTURE_REPORT.md`                 | `02-architecture/README.md`               | MERGE  | ⭐⭐⭐⭐      |

### ⚠️ Medium Priority - Important Integration

| Current File                          | Target Location                          | Action | Content Value |
| ------------------------------------- | ---------------------------------------- | ------ | ------------- |
| `docs/AUTHENTICATION_ARCHITECTURE.md` | `02-architecture/authentication-flow.md` | MERGE  | ⭐⭐⭐⭐      |
| `docs/DEPLOYMENT_GUIDE.md`            | `07-deployment/README.md`                | MERGE  | ⭐⭐⭐⭐      |
| `docs/PRODUCTION_DEPLOYMENT.md`       | `07-deployment/production-deployment.md` | MERGE  | ⭐⭐⭐⭐      |
| `docs/API_REFERENCE.md`               | `03-api/README.md`                       | MERGE  | ⭐⭐⭐⭐      |
| `docs/RESPONSE_ENVELOPE_STANDARD.md`  | `03-api/response-formats.md`             | DIRECT | ⭐⭐⭐⭐      |
| `docs/PAGINATION_IMPLEMENTATION.md`   | `03-api/rate-limiting.md`                | MERGE  | ⭐⭐⭐        |
| `docs/MANUAL_TESTING_GUIDE.md`        | `06-testing/manual-testing-guide.md`     | DIRECT | ⭐⭐⭐        |
| `docs/SECURITY_BEST_PRACTICES.md`     | `08-security/README.md`                  | MERGE  | ⭐⭐⭐        |

## Detailed Migration Mapping

### 1. Testing Documentation (284 files → 7 files)

#### Target Structure:

```
06-testing/
├── README.md              ← TESTING_ARCHITECTURE.md + test_architecture.md + TESTING.md
├── unit-testing.md        ← frontend/README-TESTING.md + backend unit test docs
├── integration-testing.md ← backend/tests/integration/README.md + related
├── e2e-testing.md         ← backend/tests/e2e/README.md + related
├── test-data-management.md ← backend/tests/examples/README.md + fixtures docs
├── mocking-strategies.md  ← MSW and mocking documentation scattered across
└── manual-testing-guide.md ← docs/MANUAL_TESTING_GUIDE.md + checklists
```

#### File Mapping:

| Source Files (284 total)              | Target                               | Merge Strategy                |
| ------------------------------------- | ------------------------------------ | ----------------------------- |
| `docs/TESTING_ARCHITECTURE.md`        | `06-testing/README.md`               | PRIMARY - Main content        |
| `test_architecture.md`                | `06-testing/README.md`               | MERGE - Additional strategies |
| `TESTING.md`                          | `06-testing/README.md`               | MERGE - Overview content      |
| `frontend/README-TESTING.md`          | `06-testing/unit-testing.md`         | FRONTEND SECTION              |
| `backend/tests/README.md`             | `06-testing/unit-testing.md`         | BACKEND SECTION               |
| `backend/tests/integration/README.md` | `06-testing/integration-testing.md`  | PRIMARY                       |
| `backend/tests/e2e/README.md`         | `06-testing/e2e-testing.md`          | PRIMARY                       |
| `backend/tests/examples/README.md`    | `06-testing/test-data-management.md` | MERGE                         |
| `docs/MANUAL_TESTING_GUIDE.md`        | `06-testing/manual-testing-guide.md` | DIRECT                        |
| `docs/MANUAL_TESTING_CHECKLIST.md`    | `06-testing/manual-testing-guide.md` | APPEND                        |
| **Remaining 275 test files**          | **Distribute by type**               | **CONSOLIDATE**               |

### 2. API Documentation (23 files → 9 files)

#### Target Structure:

```
03-api/
├── README.md              ← API_IMPLEMENTATION_GUIDE.md + API_REFERENCE.md
├── authentication.md      ← Auth sections from multiple docs
├── media-management.md    ← Media operation docs
├── user-management.md     ← User operation docs
├── plex-integration.md    ← Plex API sections
├── request-system.md      ← Request workflow docs
├── openapi-spec.yaml      ← docs/openapi.yaml
├── response-formats.md    ← RESPONSE_ENVELOPE_STANDARD.md
├── error-handling.md      ← Error handling sections
└── rate-limiting.md       ← PAGINATION_IMPLEMENTATION.md + rate limit docs
```

#### File Mapping:

| Source Files                         | Target                       | Merge Strategy              |
| ------------------------------------ | ---------------------------- | --------------------------- |
| `docs/API_IMPLEMENTATION_GUIDE.md`   | `03-api/README.md`           | PRIMARY - Split by sections |
| `docs/API_REFERENCE.md`              | `03-api/README.md`           | MERGE - Reference content   |
| `docs/RESPONSE_ENVELOPE_STANDARD.md` | `03-api/response-formats.md` | DIRECT MOVE                 |
| `docs/PAGINATION_IMPLEMENTATION.md`  | `03-api/rate-limiting.md`    | MERGE                       |
| `docs/openapi.yaml`                  | `03-api/openapi-spec.yaml`   | DIRECT MOVE                 |
| `docs/CSRF_IMPLEMENTATION.md`        | `03-api/authentication.md`   | MERGE - Security section    |
| Authentication sections from guides  | `03-api/authentication.md`   | EXTRACT & MERGE             |
| Plex integration API sections        | `03-api/plex-integration.md` | EXTRACT & MERGE             |
| **Remaining 15 API-related files**   | **Distribute by function**   | **CONSOLIDATE**             |

### 3. Deployment Documentation (33 files → 9 files)

#### Target Structure:

```
07-deployment/
├── README.md                 ← DEPLOYMENT_GUIDE.md + overview sections
├── local-development.md      ← INSTALLATION_GUIDE.md + DEVELOPMENT.md
├── staging-deployment.md     ← Staging-specific deployment docs
├── production-deployment.md  ← PRODUCTION_DEPLOYMENT.md + related
├── docker-guide.md          ← DOCKER_DEPLOYMENT.md + Docker sections
├── nginx-configuration.md    ← Nginx configs + reverse proxy docs
├── ssl-certificates.md      ← SSL/TLS setup docs
├── monitoring-setup.md      ← Monitoring deployment sections
└── backup-recovery.md       ← Backup and recovery procedures
```

#### File Mapping:

| Source Files                        | Target                                   | Merge Strategy      |
| ----------------------------------- | ---------------------------------------- | ------------------- |
| `docs/DEPLOYMENT_GUIDE.md`          | `07-deployment/README.md`                | PRIMARY             |
| `docs/PRODUCTION_DEPLOYMENT.md`     | `07-deployment/production-deployment.md` | DIRECT              |
| `DOCKER_DEPLOYMENT.md`              | `07-deployment/docker-guide.md`          | DIRECT              |
| `INSTALLATION_GUIDE.md`             | `07-deployment/local-development.md`     | PRIMARY             |
| `DEVELOPMENT.md`                    | `07-deployment/local-development.md`     | MERGE - Local setup |
| `infrastructure/nginx/SSL_SETUP.md` | `07-deployment/ssl-certificates.md`      | DIRECT              |
| Docker sections from guides         | `07-deployment/docker-guide.md`          | EXTRACT & MERGE     |
| Monitoring deployment sections      | `07-deployment/monitoring-setup.md`      | EXTRACT & MERGE     |
| **Remaining 25 deployment files**   | **Distribute by environment**            | **CONSOLIDATE**     |

### 4. Architecture Documentation (16 files → 8 files)

#### Target Structure:

```
02-architecture/
├── README.md                    ← ARCHITECTURE_REPORT.md + overviews
├── system-overview.md           ← ARCHITECTURE_OVERVIEW.md + system design
├── database-design.md           ← Database schema and design docs
├── api-design.md               ← API architecture sections
├── frontend-architecture.md     ← FRONTEND_ARCHITECTURE_GUIDE.md (extracted)
├── security-architecture.md     ← SECURITY_ARCHITECTURE_STRATEGY.md (extracted)
├── authentication-flow.md       ← AUTHENTICATION_ARCHITECTURE.md
└── performance-architecture.md  ← Performance design sections
```

#### File Mapping:

| Source Files                                   | Target                                        | Merge Strategy                  |
| ---------------------------------------------- | --------------------------------------------- | ------------------------------- |
| `ARCHITECTURE_REPORT.md`                       | `02-architecture/README.md`                   | PRIMARY                         |
| `docs/architecture/ARCHITECTURE_OVERVIEW.md`   | `02-architecture/system-overview.md`          | DIRECT                          |
| `docs/architecture/ARCHITECTURE_CONTAINERS.md` | `02-architecture/system-overview.md`          | MERGE                           |
| `docs/AUTHENTICATION_ARCHITECTURE.md`          | `02-architecture/authentication-flow.md`      | DIRECT                          |
| `docs/SECURITY_ARCHITECTURE_STRATEGY.md`       | `02-architecture/security-architecture.md`    | EXTRACT - Architecture sections |
| `docs/FRONTEND_ARCHITECTURE_GUIDE.md`          | `02-architecture/frontend-architecture.md`    | EXTRACT - Architecture sections |
| Database design sections                       | `02-architecture/database-design.md`          | EXTRACT & MERGE                 |
| API architecture sections                      | `02-architecture/api-design.md`               | EXTRACT & MERGE                 |
| Performance design sections                    | `02-architecture/performance-architecture.md` | EXTRACT & MERGE                 |

## Archive Migration Strategy

### Archive Categories:

```
archive/
├── deprecated-features/        ← Deprecated functionality docs
├── legacy-migrations/          ← Old migration guides
├── historical-decisions/       ← Archived ADRs & decisions
├── phase-documentation/        ← Phase-based development docs
│   ├── phase0/                ← tasks/phase0/*.md
│   ├── phase1/                ← tasks/phase1/*.md
│   ├── phase3/                ← docs/archive/phases/phase3/*.md
│   └── phase5/                ← docs/archive/phases/phase5/*.md
├── reports/                   ← Historical reports and audits
│   ├── technical-debt/        ← Technical debt reports
│   ├── quality-reports/       ← Quality assessment reports
│   ├── performance-reports/   ← Performance analysis reports
│   └── migration-reports/     ← Migration completion reports
└── temporary-migrations/      ← Test_Tasks_MIGRATED_2025-01-19/
```

### Archive File Mapping:

| Source Location                                       | Archive Target                        | Reasoning                  |
| ----------------------------------------------------- | ------------------------------------- | -------------------------- |
| `tasks/phase0/` →                                     | `archive/phase-documentation/phase0/` | Historical phase docs      |
| `tasks/phase1/` →                                     | `archive/phase-documentation/phase1/` | Historical phase docs      |
| `docs/archive/phases/` →                              | `archive/phase-documentation/`        | Already archived phases    |
| `Test_Tasks_MIGRATED_2025-01-19/` →                   | `archive/temporary-migrations/`       | Historical migration tasks |
| Technical debt reports →                              | `archive/reports/technical-debt/`     | Historical analysis        |
| `docs/COMPREHENSIVE_TECHNICAL_DEBT_AUDIT_REPORT.md` → | `archive/reports/technical-debt/`     | Important historical audit |

## Content Extraction Guidelines

### For Large Files Requiring Splitting:

#### `docs/API_IMPLEMENTATION_GUIDE.md` (55KB) Split Strategy:

- **Introduction & Overview** → `03-api/README.md`
- **Authentication Implementation** → `03-api/authentication.md`
- **Media Management APIs** → `03-api/media-management.md`
- **User Management APIs** → `03-api/user-management.md`
- **Error Handling Patterns** → `03-api/error-handling.md`
- **Response Standards** → `03-api/response-formats.md`

#### `docs/TESTING_ARCHITECTURE.md` (63KB) Split Strategy:

- **Testing Strategy Overview** → `06-testing/README.md`
- **Unit Testing Patterns** → `06-testing/unit-testing.md`
- **Integration Testing** → `06-testing/integration-testing.md`
- **E2E Testing Strategy** → `06-testing/e2e-testing.md`
- **Test Data Management** → `06-testing/test-data-management.md`
- **Mocking Strategies** → `06-testing/mocking-strategies.md`

#### `docs/SECURITY_ARCHITECTURE_STRATEGY.md` (55KB) Split Strategy:

- **Security Architecture** → `02-architecture/security-architecture.md`
- **Authentication Security** → `08-security/authentication-security.md`
- **API Security** → `08-security/api-security.md`
- **Data Protection** → `08-security/data-protection.md`
- **Vulnerability Management** → `08-security/vulnerability-management.md`

## Migration Script Requirements

### Automated Migration Tasks:

1. **File Movement** - Move files to new locations
2. **Content Extraction** - Extract sections from large files
3. **Link Updates** - Update all internal references
4. **Index Generation** - Create README files with navigation
5. **Validation** - Check for broken links and missing content

### Manual Review Required:

1. **Content Consolidation** - Merge overlapping information
2. **Duplicate Removal** - Eliminate redundant content
3. **Formatting Standardization** - Ensure consistent formatting
4. **Cross-Reference Creation** - Add related document links
5. **Final Content Review** - Validate completeness and accuracy

## Success Validation Checklist

### Quantitative Validation:

- [ ] Total file count reduced from 5,461 to ~200
- [ ] Testing docs consolidated from 284 to 7
- [ ] API docs consolidated from 23 to 9
- [ ] Deployment docs consolidated from 33 to 9
- [ ] Architecture docs restructured from 16 to 8

### Qualitative Validation:

- [ ] All critical content preserved and accessible
- [ ] Navigation flows are logical and efficient
- [ ] No broken internal links
- [ ] Consistent formatting across all documents
- [ ] Clear section organization and indexing
- [ ] Cross-references properly implemented
- [ ] Search functionality works effectively

### Content Completeness Validation:

- [ ] Getting started guide covers basic setup
- [ ] Architecture documentation covers all major components
- [ ] API documentation includes all endpoints
- [ ] Testing guides cover all testing strategies
- [ ] Deployment guides cover all environments
- [ ] Security documentation covers all concerns
- [ ] Operations documentation covers monitoring and maintenance

This migration plan ensures comprehensive consolidation while preserving all critical content and maintaining logical organization for improved developer experience.
