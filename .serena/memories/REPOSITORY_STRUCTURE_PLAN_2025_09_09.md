# MediaNest Repository Structure Reorganization Plan

**Date:** 2025-09-09  
**Agent:** Repository Structure Agent  
**Scope:** Complete repository restructuring for optimal maintainability

## Executive Summary

### Current State Analysis

- **Total Root Directories:** 29 directories
- **Configuration File Proliferation:** 8+ Next.js config variants
- **Test Directory Scattering:** 3+ separate test locations
- **Documentation Fragmentation:** 4+ doc directories
- **Backend Structure:** Technical layer anti-pattern (controllers/services/routes separation)
- **Compliance:** ❌ Violates Node.js best practices for component-based architecture

### Optimization Opportunities

1. **Configuration Consolidation:** Reduce 8+ config variants to 3 environment-specific configs
2. **Test Co-location:** Centralize scattered test files following component proximity
3. **Business Component Restructure:** Transform technical layers into domain modules
4. **Documentation Unification:** Consolidate 4+ doc locations into coherent structure
5. **Dependency Optimization:** Simplify complex re-export patterns

## Current Structure Problems

### 🔴 Critical Issues

#### 1. Configuration File Proliferation

**Current State:**

```
frontend/
├── next.config.js
├── next.config.emergency.js
├── next.config.runtime.js
├── next.config.optimized.js
├── next.config.performance-optimized.js
├── next.config.bundle-optimized.js
├── next.config.conservative-optimized.js
└── next.config.critical-fix.js
```

**Problem:** 8+ configuration variants create deployment confusion and maintenance overhead.

#### 2. Backend Technical Layer Anti-Pattern

**Current State:**

```
backend/src/
├── controllers/     # All controllers mixed together
├── services/        # All services mixed together
├── routes/          # All routes mixed together
├── repositories/    # All repositories mixed together
└── middleware/      # All middleware mixed together
```

**Problem:** Violates Node.js best practice - should be organized by business domain, not technical role.

#### 3. Test Directory Scattering

**Current State:**

```
./tests/                    # Root level tests
./backend/tests/           # Backend-specific tests
./frontend/tests/          # Frontend-specific tests
./shared/src/__tests__/    # Shared component tests
```

**Problem:** Tests scattered across 4+ locations, making test discovery and execution complex.

#### 4. Documentation Fragmentation

**Current State:**

```
./docs/              # Main documentation
./backend/docs/      # Backend documentation
./frontend/docs/     # Frontend documentation
./shared/README.md   # Shared documentation
```

**Problem:** Documentation scattered across multiple locations.

### 🟠 High Priority Issues

#### 5. Import Complexity

**Current State:** Complex re-export patterns in `backend/src/repositories/index.ts`

```typescript
export * from './base.repository';
export * from './user.repository';
// ... 7+ more exports
export function createRepositories(prisma: PrismaClient) { ... }
```

**Problem:** Creates circular dependency risks and complicated dependency injection.

#### 6. Environment Configuration Duplication

**Current State:**

```
.env.production
.env.production.example
.env.production.final
backend/.env.production
backend/.env.production.final
config/environments/.env.production
```

**Problem:** Multiple environment files across different locations.

## Proposed Optimal Structure

### 🎯 Target Architecture: Business Component Pattern

Based on Node.js best practices and Context7 monorepo guidelines:

```
medianest/
├── apps/                          # Business Applications
│   ├── api-server/               # Backend API (Express + Prisma)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── modules/          # Business modules
│   │   │   │   ├── auth/         # Authentication domain
│   │   │   │   │   ├── api/      # Controllers & routes
│   │   │   │   │   ├── domain/   # Business logic & services
│   │   │   │   │   ├── data/     # Repositories & data access
│   │   │   │   │   └── __tests__/ # Co-located tests
│   │   │   │   ├── media/        # Media management domain
│   │   │   │   │   ├── api/
│   │   │   │   │   ├── domain/
│   │   │   │   │   ├── data/
│   │   │   │   │   └── __tests__/
│   │   │   │   ├── admin/        # Admin functionality domain
│   │   │   │   ├── integrations/ # External service integrations
│   │   │   │   └── websocket/    # Real-time communication
│   │   │   ├── shared/           # Shared app utilities
│   │   │   │   ├── middleware/
│   │   │   │   ├── utils/
│   │   │   │   └── types/
│   │   │   ├── config/           # App configuration
│   │   │   └── server.ts         # App entry point
│   │   └── tests/                # Integration & E2E tests
│   │       ├── integration/
│   │       ├── e2e/
│   │       └── fixtures/
│   │
│   ├── web-client/               # Frontend application (Next.js)
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── features/         # Feature-based organization
│   │   │   │   ├── auth/         # Authentication UI
│   │   │   │   │   ├── components/
│   │   │   │   │   ├── pages/
│   │   │   │   │   ├── hooks/
│   │   │   │   │   └── __tests__/
│   │   │   │   ├── media/        # Media management UI
│   │   │   │   ├── admin/        # Admin interface
│   │   │   │   └── dashboard/    # Dashboard views
│   │   │   ├── shared/           # Shared UI components
│   │   │   │   ├── components/   # Reusable components
│   │   │   │   ├── layouts/
│   │   │   │   ├── hooks/
│   │   │   │   └── utils/
│   │   │   └── app/              # Next.js app router
│   │   ├── tests/                # Frontend tests
│   │   └── public/               # Static assets
│   │
│   └── docs-site/                # Documentation site (MkDocs)
│       ├── docs/
│       ├── mkdocs.yml
│       └── package.json
│
├── packages/                      # Shared libraries
│   ├── shared-types/             # TypeScript type definitions
│   │   ├── package.json
│   │   └── src/
│   │       ├── api/              # API type definitions
│   │       ├── database/         # Database type definitions
│   │       └── common/           # Common type definitions
│   │
│   ├── shared-config/            # Configuration utilities
│   │   ├── package.json
│   │   └── src/
│   │       ├── environment/      # Environment configuration
│   │       ├── database/         # Database configuration
│   │       └── validation/       # Configuration validation
│   │
│   ├── shared-utils/             # Utility functions
│   │   ├── package.json
│   │   └── src/
│   │       ├── crypto/           # Cryptography utilities
│   │       ├── validation/       # Data validation
│   │       ├── formatting/       # Data formatting
│   │       └── __tests__/        # Utility tests
│   │
│   └── shared-testing/           # Testing utilities
│       ├── package.json
│       └── src/
│           ├── fixtures/         # Test data fixtures
│           ├── mocks/           # Mock implementations
│           ├── helpers/         # Test helper functions
│           └── setup/           # Test environment setup
│
├── tools/                        # Development & deployment tools
│   ├── build/                   # Build scripts
│   ├── deployment/              # Deployment scripts
│   ├── docker/                  # Docker configurations
│   │   ├── api-server/
│   │   ├── web-client/
│   │   └── docker-compose/
│   ├── monitoring/              # Monitoring & observability
│   └── security/                # Security scanning & tools
│
├── infrastructure/              # Infrastructure as Code
│   ├── kubernetes/              # K8s manifests
│   ├── terraform/               # Infrastructure definitions
│   └── nginx/                   # Reverse proxy configs
│
├── tests/                       # Global integration tests
│   ├── system/                  # System-level tests
│   ├── performance/             # Performance tests
│   └── security/                # Security tests
│
├── docs/                        # Repository documentation
│   ├── architecture/            # Architecture docs
│   ├── deployment/              # Deployment guides
│   ├── development/             # Development guides
│   └── api/                     # API documentation
│
└── config/                      # Root configuration files
    ├── environments/            # Environment configurations
    │   ├── .env.development
    │   ├── .env.production
    │   └── .env.test
    ├── workspace/               # Workspace configuration
    │   ├── pnpm-workspace.yaml  # Package manager workspace
    │   └── turbo.json           # Build system configuration
    └── quality/                 # Code quality configurations
        ├── eslint.config.js
        ├── prettier.config.js
        └── tsconfig.base.json
```

### 🎯 Key Improvements

#### 1. Business Component Organization

**Before:** Technical layers (controllers/services/routes)
**After:** Business domains (auth/media/admin) with internal layers

**Benefits:**

- Clear module boundaries
- Easier feature development
- Reduced coupling between domains
- Simplified testing and maintenance

#### 2. Configuration Consolidation

**Before:** 8+ Next.js config variants
**After:** 3 environment-specific configurations

```
config/environments/
├── next.config.development.js
├── next.config.production.js
└── next.config.test.js
```

#### 3. Test Co-location

**Before:** Tests scattered across 4+ directories
**After:** Tests co-located with the code they test

```
apps/api-server/src/modules/auth/__tests__/
apps/web-client/src/features/auth/__tests__/
packages/shared-utils/src/__tests__/
```

#### 4. Documentation Unification

**Before:** Documentation scattered across multiple locations
**After:** Centralized documentation structure

```
docs/                    # Repository docs
apps/docs-site/          # User-facing documentation site
```

## Migration Plan

### Phase 1: Backend Restructuring (8-12 hours)

**Agent Assignment:** Backend Architecture Agent

#### 1.1 Create Business Module Structure

```bash
# Create new module directories
mkdir -p apps/api-server/src/modules/{auth,media,admin,integrations,websocket}
mkdir -p apps/api-server/src/modules/{auth,media,admin}/{api,domain,data,__tests__}
```

#### 1.2 Migrate Files by Business Domain

**Auth Module:**

- `backend/src/controllers/auth.controller.ts` → `apps/api-server/src/modules/auth/api/`
- `backend/src/services/jwt.service.ts` → `apps/api-server/src/modules/auth/domain/`
- `backend/src/repositories/user.repository.ts` → `apps/api-server/src/modules/auth/data/`
- `backend/src/routes/v1/auth.ts` → `apps/api-server/src/modules/auth/api/`

**Media Module:**

- `backend/src/controllers/media.controller.ts` → `apps/api-server/src/modules/media/api/`
- `backend/src/services/overseerr.service.ts` → `apps/api-server/src/modules/media/domain/`
- `backend/src/repositories/media-request.repository.ts` → `apps/api-server/src/modules/media/data/`

#### 1.3 Update Import Paths

- Replace complex re-export patterns with explicit module imports
- Update all import statements to new module structure
- Remove circular dependency risks

### Phase 2: Frontend Restructuring (6-8 hours)

**Agent Assignment:** Frontend Architecture Agent

#### 2.1 Feature-Based Organization

```bash
# Create feature directories
mkdir -p apps/web-client/src/features/{auth,media,admin,dashboard}
mkdir -p apps/web-client/src/features/{auth,media,admin,dashboard}/{components,pages,hooks,__tests__}
```

#### 2.2 Configuration Consolidation

- Merge 8+ Next.js config variants into 3 environment-specific configs
- Move to `config/environments/next.config.{env}.js`
- Update build scripts to use environment-specific configs

### Phase 3: Shared Package Extraction (4-6 hours)

**Agent Assignment:** Package Architecture Agent

#### 3.1 Extract Shared Libraries

- Move `shared/src/types/` → `packages/shared-types/src/`
- Move `shared/src/config/` → `packages/shared-config/src/`
- Move `shared/src/utils/` → `packages/shared-utils/src/`
- Move `backend/tests/shared/` → `packages/shared-testing/src/`

#### 3.2 Update Package Dependencies

- Create individual `package.json` for each shared package
- Update workspace configuration (`pnpm-workspace.yaml`)
- Update import paths across all applications

### Phase 4: Tools & Infrastructure (4-6 hours)

**Agent Assignment:** DevOps Architecture Agent

#### 4.1 Consolidate Development Tools

- Move `scripts/` → `tools/build/`
- Move `docker-scripts/` → `tools/docker/`
- Move `deployment/` → `tools/deployment/`
- Organize by purpose rather than technology

#### 4.2 Infrastructure Organization

- Move `config/docker/` → `infrastructure/docker/`
- Move `deployment/kubernetes/` → `infrastructure/kubernetes/`
- Create infrastructure management structure

### Phase 5: Documentation & Testing (4-6 hours)

**Agent Assignment:** Documentation Architecture Agent

#### 5.1 Documentation Consolidation

- Merge scattered docs into unified structure
- Create centralized `docs/` for repository documentation
- Move user-facing docs to `apps/docs-site/`

#### 5.2 Test Organization

- Co-locate unit tests with source code
- Centralize integration tests in `tests/system/`
- Create shared testing utilities in `packages/shared-testing/`

## Import Path Updates Required

### Backend Module Imports

**Before:**

```typescript
import { UserRepository } from '../repositories/user.repository';
import { JwtService } from '../services/jwt.service';
import { authMiddleware } from '../middleware/auth';
```

**After:**

```typescript
import { UserRepository } from './data/user.repository';
import { JwtService } from './domain/jwt.service';
import { authMiddleware } from '../../shared/middleware/auth';
```

### Frontend Feature Imports

**Before:**

```typescript
import { LoginForm } from '../components/forms/LoginForm';
import { useAuth } from '../hooks/useAuth';
```

**After:**

```typescript
import { LoginForm } from './components/LoginForm';
import { useAuth } from './hooks/useAuth';
```

### Shared Package Imports

**Before:**

```typescript
import { ApiResponse } from '../../../shared/src/types';
import { validateSchema } from '../../../shared/src/utils/validation';
```

**After:**

```typescript
import { ApiResponse } from '@medianest/shared-types';
import { validateSchema } from '@medianest/shared-utils';
```

## Configuration File Consolidation

### Environment Configuration Cleanup

**Remove:**

- Multiple `.env.production*` variants
- Scattered environment files across directories
- Emergency and backup configuration files

**Consolidate to:**

```
config/environments/
├── .env.development
├── .env.production
├── .env.test
├── next.config.development.js
├── next.config.production.js
└── next.config.test.js
```

### Build Configuration Cleanup

**Remove:**

- `webpack.config.emergency.js`
- Multiple `tsconfig.*` variants
- Scattered build configurations

**Consolidate to:**

```
config/quality/
├── tsconfig.base.json        # Base TypeScript config
├── eslint.config.js          # ESLint configuration
└── prettier.config.js        # Prettier configuration

tools/build/
├── webpack.config.js         # Webpack configuration
├── turbo.json               # Build system configuration
└── scripts/                 # Build scripts
```

## Benefits of New Structure

### 🎯 Developer Experience Benefits

1. **Intuitive Navigation:** Clear feature/domain boundaries
2. **Faster Onboarding:** Self-documenting structure
3. **Reduced Cognitive Load:** Related code co-located
4. **Easier Testing:** Tests next to implementation

### 🚀 Maintainability Benefits

1. **Clear Ownership:** Each module has defined responsibilities
2. **Reduced Coupling:** Business domains are isolated
3. **Easier Refactoring:** Changes contained within modules
4. **Simplified Dependency Management:** Explicit package boundaries

### ⚡ Performance Benefits

1. **Better Tree Shaking:** Clear import boundaries
2. **Faster Builds:** Modular build targets
3. **Improved Caching:** Granular cache invalidation
4. **Optimized Bundling:** Feature-based code splitting

### 🔧 Operational Benefits

1. **Cleaner Deployments:** Single app per deployment unit
2. **Better Monitoring:** Service-level observability
3. **Simplified CI/CD:** Target-specific pipelines
4. **Easier Scaling:** Independent service scaling

## Risk Mitigation Strategy

### File Movement Safety

1. **Incremental Migration:** Move one module at a time
2. **Import Verification:** Validate all imports after each move
3. **Test Execution:** Run full test suite after each phase
4. **Rollback Procedures:** Git branch for each migration phase

### Build Continuity

1. **Parallel Configuration:** Keep old configs during transition
2. **Gradual Cutover:** Environment-by-environment migration
3. **Validation Gates:** Automated build verification
4. **Emergency Rollback:** Quick revert procedures

### Team Coordination

1. **Migration Windows:** Coordinate with development team
2. **Documentation Updates:** Update all development guides
3. **IDE Configuration:** Update workspace settings
4. **Training Materials:** Create transition guides

## Success Metrics

### Quantitative Goals

- **Directory Reduction:** 29 → 15 root directories (48% reduction)
- **Configuration Consolidation:** 8+ configs → 3 environment configs
- **Test Organization:** 4+ test locations → Co-located + centralized integration
- **Import Complexity:** 50% reduction in import path length

### Qualitative Goals

- **Developer Satisfaction:** Easier navigation and development
- **Code Discoverability:** Intuitive file organization
- **Maintenance Efficiency:** Faster bug fixes and feature development
- **Team Onboarding:** Reduced time to productivity

## Timeline & Resources

### Estimated Effort: 26-38 agent-hours

- **Phase 1 (Backend):** 8-12 hours
- **Phase 2 (Frontend):** 6-8 hours
- **Phase 3 (Packages):** 4-6 hours
- **Phase 4 (Tools):** 4-6 hours
- **Phase 5 (Docs/Tests):** 4-6 hours

### Agent Coordination Requirements

- **File Locking:** Prevent concurrent edits
- **Communication Channel:** Real-time progress updates
- **Dependency Mapping:** Identify critical path dependencies
- **Quality Gates:** Validation after each phase

## Next Steps

1. **Stakeholder Approval:** Get team consensus on new structure
2. **Migration Schedule:** Plan migration windows with development team
3. **Tooling Preparation:** Set up automated migration scripts
4. **Documentation:** Create detailed migration guides
5. **Execution:** Begin with Phase 1 backend restructuring

---

**Repository Structure Agent** - Comprehensive reorganization plan complete  
**Recommendation:** Begin with Phase 1 backend restructuring for maximum impact
