# FILENAME SANITIZATION MANIFEST

**Date:** 2025-09-09  
**Agent:** Filename Sanitization Agent  
**Status:** EXECUTION READY

## EXECUTIVE SUMMARY

Found **78 problematic files** requiring sanitization across the MediaNest repository:

- **2 critical scripts** with `-fixed` suffixes
- **1 test file** with unprofessional naming
- **12 documentation files** with inconsistent ALL_CAPS naming
- **20+ temporary log files** safe for deletion
- **42 timestamped files** requiring archival organization
- **1 backup file** confirmed identical to source (safe to delete)

## IMMEDIATE EXECUTION PLAN

### ✅ PHASE 1: SCRIPT SANITIZATION (SAFE - NO REFERENCES)

```bash
# Remove identical backup file
rm /home/kinginyellow/projects/medianest/backend/src/middleware/auth.ts.cleanup-backup

# Rename scripts with temporal suffixes
git mv scripts/docs-quality-check-fixed.sh scripts/docs-quality-check.sh
git mv scripts/build-stabilizer-fixed.sh scripts/build-stabilizer.sh
```

**Reference Updates Required:**

- `DOCUMENTATION_SETUP_COMPLETE.md` references `docs-quality-check-fixed.sh`
- `package.json` + 7 other files reference `build-stabilizer-fixed.sh`

### ✅ PHASE 2: TEST FILE SANITIZATION (SAFE)

```bash
# Standardize test naming
git mv tests/auth/auth-middleware-fixed.test.ts tests/auth/auth-middleware.test.ts
```

**Reference Updates Required:**

- 3 files reference the old test filename

### ✅ PHASE 3: DOCUMENTATION STANDARDIZATION (MEDIUM RISK)

```bash
# Convert ALL_CAPS documentation to kebab-case
git mv docs/architecture/ARCHITECTURE_EVOLUTION_ROADMAP.md docs/architecture/architecture-evolution-roadmap.md
git mv docs/deployment/DEPLOYMENT_VALIDATION.md docs/deployment/deployment-validation.md
git mv docs/deployment/MERGE_TO_STAGING.md docs/deployment/merge-to-staging.md
git mv docs/deployment/PREREQUISITES_CHECKLIST.md docs/deployment/prerequisites-checklist.md
git mv docs/deployment/TROUBLESHOOTING_GUIDE.md docs/deployment/troubleshooting-guide.md
git mv docs/CONFIGURATION_AUDIT.md docs/configuration-audit.md
git mv docs/DOCKER_CONFIGURATION_ANALYSIS.md docs/docker-configuration-analysis.md
git mv docs/DOCUMENTATION_VALIDATION_REPORT.md docs/documentation-validation-report.md
git mv docs/ENVIRONMENT_VARIABLES.md docs/environment-variables.md
git mv docs/FINAL_BUILD_STRATEGY.md docs/final-build-strategy.md
git mv docs/PRE_MERGE_CHECKLIST.md docs/pre-merge-checklist.md
```

**Reference Updates Required:**

- `docs/validation/success-criteria-compliance.md` references `ARCHITECTURE_EVOLUTION_ROADMAP`
- `VALID_DOCUMENTATION.md` references `DEPLOYMENT_VALIDATION` and `PRE_MERGE_CHECKLIST`
- `docs/DOCUMENTATION_VALIDATION_REPORT.md` references `DEPLOYMENT_VALIDATION`

### ✅ PHASE 4: TEMPORARY FILE CLEANUP (SAFE DELETION)

```bash
# Archive logs instead of deleting
mkdir -p logs/archive/2025-09
mkdir -p backend/logs/archive/2025-09
mkdir -p scripts/cleanup/archive

# Move temporary files to archive
mv logs/application-2025-09-*.log logs/archive/2025-09/
mv logs/prometheus-validation-20250908-*.log logs/archive/2025-09/
mv backend/logs/application-2025-09-*.log backend/logs/archive/2025-09/
mv backend/logs/monitoring-baseline-*.json backend/logs/archive/2025-09/
mv backend/logs/health-*.log backend/logs/archive/2025-09/
mv scripts/cleanup/cleanup-*.log scripts/cleanup/archive/
mv scripts/cleanup/validation-*.log scripts/cleanup/archive/
```

### ✅ PHASE 5: METRICS ORGANIZATION

```bash
# Organize metrics by date structure
mkdir -p backend/logs/metrics/archive/2025/09
mv backend/logs/metrics/*-20250908* backend/logs/metrics/archive/2025/09/
mv backend/logs/metrics/*-20250909* backend/logs/metrics/archive/2025/09/
```

## DETAILED REFERENCE MAPPINGS

### Script References to Update:

1. **docs-quality-check-fixed.sh → docs-quality-check.sh**
   - `DOCUMENTATION_SETUP_COMPLETE.md` (Line reference needed)

2. **build-stabilizer-fixed.sh → build-stabilizer.sh**
   - `package.json` (script section)
   - `scripts/final-build-ready.sh`
   - `BUILD_STABILIZATION_REPORT.md`
   - `docs/FINAL_BUILD_STRATEGY.md`
   - `docs/roadmap/implementation-timeline.md`
   - `docs/roadmap/strategic-development-roadmap.md`
   - `.git/COMMIT_EDITMSG`
   - `.serena/memories/TECHNICAL_DEBT_AUDIT_MASTER_MANIFEST_2025_09_09.md`

### Documentation References to Update:

1. **ARCHITECTURE_EVOLUTION_ROADMAP.md → architecture-evolution-roadmap.md**
   - `docs/validation/success-criteria-compliance.md`

2. **DEPLOYMENT_VALIDATION.md → deployment-validation.md**
   - `docs/DOCUMENTATION_VALIDATION_REPORT.md`
   - `VALID_DOCUMENTATION.md`

3. **PRE_MERGE_CHECKLIST.md → pre-merge-checklist.md**
   - `VALID_DOCUMENTATION.md`

## EXECUTION SEQUENCE

1. **Backup Current State**: Create git checkpoint
2. **Execute Renames**: Use `git mv` for all operations
3. **Update References**: Replace old filenames in referencing files
4. **Validate**: Run build tests and documentation checks
5. **Commit Changes**: Atomic commit per phase

## VALIDATION CHECKLIST

- [ ] All builds pass: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Documentation builds: `npm run docs:build`
- [ ] No broken internal links
- [ ] All CI/CD pipelines reference correct files
- [ ] Git history preserved for all renames

## RISK MITIGATION

- **Low Risk**: Script and test renames (2-3 references each)
- **Medium Risk**: Documentation renames (MkDocs integration)
- **Zero Risk**: Temporary file archival (no dependencies)

## SUCCESS METRICS

✅ **Professional Naming**: No temporal suffixes (-fixed, -new, -old)  
✅ **Consistent Conventions**: kebab-case documentation, camelCase code  
✅ **Clean Repository**: Organized logs, archived temporaries  
✅ **Preserved History**: All renames use `git mv`  
✅ **Zero Broken Links**: All references updated correctly

---

**Next Action**: Execute Phase 1 (Script Sanitization) followed by reference updates.
