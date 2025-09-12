# MediaNest Filename Cleanup Strategy

## Executive Summary

Based on comprehensive analysis of the MediaNest project structure, this document outlines a systematic approach to standardize filename conventions across the entire codebase. The project currently exhibits inconsistent naming patterns that need immediate attention for maintainability and professional standards.

## Current State Analysis

### Naming Pattern Inventory

- **Total Files**: 75,508+ files in project
- **Problematic Files**: 135+ files with ALL_CAPS naming
- **Mixed Patterns**:
  - kebab-case: `test-results`, `docker-swarm-stack.yml`
  - snake_case: `VALIDATION_COMPLETE.md`, `SSL_SETUP.md`
  - PascalCase: `Dockerfile`, `README.md`
  - Mixed case: Various inconsistent patterns

### Critical Issues Identified

1. **Report Files**: 135+ files with aggressive ALL_CAPS naming (e.g., `PHASE_H_PATTERN_APPLICATION_MATRIX_2025_09_10.md`)
2. **Inconsistent Documentation**: Mix of ALL_CAPS and kebab-case in docs directory
3. **Legacy Artifacts**: Dated filenames with embedded timestamps
4. **Professional Standards**: ALL_CAPS violates modern naming conventions

## Naming Convention Standards

### 1. Documentation Files (.md)

**Standard**: kebab-case with descriptive names

- **Current**: `VALIDATION_COMPLETE.md`, `SSL_SETUP.md`
- **Target**: `validation-complete.md`, `ssl-setup.md`

### 2. Configuration Files

**Standard**: kebab-case or well-established conventions

- **Docker**: Keep `Dockerfile` (industry standard)
- **Config**: `docker-compose.yml`, `nginx.conf`
- **Scripts**: `setup-ssl.sh`, `build-docs.sh`

### 3. Source Code Files

**Standard**: camelCase for TypeScript/JavaScript, kebab-case for configs

- **TypeScript**: `userService.ts`, `authController.ts`
- **React**: `UserProfile.tsx` (PascalCase for components)
- **Config**: `vitest.config.ts`, `playwright.config.ts`

### 4. Report and Analysis Files

**Standard**: kebab-case with date suffix if needed

- **Current**: `PHASE_H_PATTERN_APPLICATION_MATRIX_2025_09_10.md`
- **Target**: `pattern-application-matrix-2025-09-10.md`

### 5. Directory Structure

**Standard**: kebab-case throughout

- Keep existing: `test-results/`, `docs/`
- Standardize: Ensure consistency across all subdirectories

## Execution Strategy

### Phase 1: Documentation Cleanup (Low Risk)

**Priority**: High
**Risk Level**: Low
**Files**: ~200 documentation files

#### 1.1 Report Files Standardization

```bash
# Examples of transformations:
PHASE_H_PATTERN_APPLICATION_MATRIX_2025_09_10.md → pattern-application-matrix-2025-09-10.md
EMERGENCY_PRISMA_API_ALIGNMENT_SUCCESS_REPORT.md → prisma-api-alignment-report.md
FRONTEND_TEST_EMERGENCY_RESTORATION_SUCCESS_REPORT.md → frontend-test-restoration-report.md
JWT_MOCK_EMERGENCY_REPAIR_SUCCESS.md → jwt-mock-repair-report.md
```

#### 1.2 General Documentation

```bash
# Examples:
VALIDATION_COMPLETE.md → validation-complete.md
VULNERABILITY_REMEDIATION_REPORT.md → vulnerability-remediation-report.md
DOCKER_DEPLOYMENT.md → docker-deployment.md
SSL_SETUP.md → ssl-setup.md
```

### Phase 2: Configuration Files (Medium Risk)

**Priority**: Medium
**Risk Level**: Medium
**Files**: ~50 configuration files

#### 2.1 Safe Renames

- Keep industry standards: `Dockerfile`, `README.md`
- Standardize configs: `nginx-prod.conf` → `nginx.prod.conf`

#### 2.2 Build Scripts

- Verify all script references in package.json
- Update any hardcoded paths in build scripts

### Phase 3: Source Code Alignment (High Risk)

**Priority**: Low (defer until other phases complete)
**Risk Level**: High
**Files**: Source code files with import dependencies

#### 3.1 Import Analysis Required

- Scan for hardcoded imports referencing files to be renamed
- Identify circular dependencies
- Map all file references in codebase

### Phase 4: Archive Cleanup (Low Risk)

**Priority**: Medium
**Risk Level**: Low
**Files**: Temporary and backup files

#### 4.1 Archive Strategy

- Move dated report files to archive directories
- Clean up duplicate files
- Remove obsolete temporary files

## Risk Mitigation Strategies

### 1. Backup Strategy

```bash
# Create comprehensive backup before any changes
git stash push -m "Pre-filename-cleanup-backup-$(date +%Y%m%d)"
git branch filename-cleanup-backup-$(date +%Y%m%d)
```

### 2. Testing Protocols

#### 2.1 After Each Phase

```bash
# Verify build integrity
npm run build:verify
npm run test:fast
npm run typecheck

# Check documentation builds
npm run docs:build
mkdocs build --strict
```

#### 2.2 Reference Validation

```bash
# Scan for broken references after each rename
grep -r "old-filename" . --exclude-dir=node_modules
find . -name "*.md" -exec grep -l "old-filename" {} \;
```

### 3. Rollback Points

- **Phase 1 Complete**: Git tag `phase-1-docs-cleanup`
- **Phase 2 Complete**: Git tag `phase-2-config-cleanup`
- **Phase 3 Complete**: Git tag `phase-3-source-cleanup`

### 4. Reference Update Strategy

#### 4.1 Documentation Links

```bash
# Update internal documentation references
sed -i 's/OLD_FILENAME.md/new-filename.md/g' docs/**/*.md
```

#### 4.2 Script References

```bash
# Update package.json script references
# Manual verification required for each change
```

## Implementation Order

### Week 1: Documentation Cleanup

1. **Day 1-2**: Phase 1.1 - Report files (highest visual impact)
2. **Day 3-4**: Phase 1.2 - General documentation
3. **Day 5**: Testing and verification

### Week 2: Configuration and Archive

1. **Day 1-2**: Phase 2 - Configuration files
2. **Day 3-4**: Phase 4 - Archive cleanup
3. **Day 5**: Comprehensive testing

### Week 3: Source Code (If Required)

1. **Day 1-3**: Import analysis and mapping
2. **Day 4-5**: Careful source file renames with immediate testing

## High-Risk Rename Categories

### 1. Files Referenced in package.json

- All build scripts
- Configuration files used by npm scripts
- Entry points and main files

### 2. Import Dependencies

- TypeScript/JavaScript files with import statements
- Configuration files imported by source code
- Template and example files

### 3. Infrastructure Files

- Docker configurations
- Nginx configurations
- Database initialization scripts

### 4. CI/CD References

- GitHub Actions workflows
- Build script dependencies
- Deployment configurations

## Success Metrics

### 1. Consistency Score

- Target: 95%+ filename consistency across project
- Current: ~60% (estimated based on analysis)

### 2. Professional Standards

- Eliminate ALL_CAPS documentation files: 135+ files
- Standardize report naming: Remove "EMERGENCY", "PHASE\_", "SUCCESS" patterns

### 3. Maintainability

- Clear, descriptive filenames
- Predictable naming patterns
- Improved developer experience

## Rollback Procedures

### Emergency Rollback

```bash
# Full project rollback to pre-cleanup state
git reset --hard filename-cleanup-backup-$(date +%Y%m%d)
git clean -fd
npm install
npm run build:verify
```

### Selective Rollback

```bash
# Per-phase rollback capability
git reset --hard phase-1-docs-cleanup  # or appropriate tag
```

## Post-Cleanup Validation

### 1. Build Verification

```bash
npm run build:production
npm run test:all
npm run docs:build
```

### 2. Link Validation

```bash
# Check for broken internal references
find docs -name "*.md" -exec grep -l "\[.*\](.*\.md)" {} \;
```

### 3. Performance Impact

```bash
# Ensure no performance degradation
npm run test:performance:all
```

## Conclusion

This filename cleanup strategy prioritizes safety through phased execution, comprehensive testing, and robust rollback procedures. The approach focuses on immediate visual improvements (documentation cleanup) while deferring high-risk changes (source code) until the infrastructure is proven stable.

The strategy targets a professional, consistent naming convention that will improve long-term maintainability and developer experience while minimizing disruption to the existing codebase.

**Estimated Timeline**: 2-3 weeks for complete cleanup
**Risk Level**: Low-Medium with proper execution
**Impact**: High improvement in professional appearance and maintainability
