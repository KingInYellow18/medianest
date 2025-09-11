# Code Quality Auditor Agent Mission

## Agent Designation: QualityAuditor
**Type**: reviewer  
**Mission**: Eliminate accumulated technical debt while preserving enterprise patterns

## Primary Objectives

### 1. Critical Security & Production Issues (P0)
- Remove console.log statements from production middleware (security risk)
- Eliminate 15+ TODO comments in core business logic
- Clean up -fixed, -backup file naming confusion
- Address build stability issues

### 2. File Organization & Configuration Debt (P1)
- Clean 25 problematic filename patterns (.backup files in source tree)
- Consolidate duplicate .env and configuration files
- Remove backup pollution from source directories
- Standardize naming conventions

### 3. Code Quality & Deduplication (P2)
- Eliminate duplicate CSS patterns (50+ instances)
- Remove dead code references
- Optimize import statements
- Clean up unused template files

## Success Criteria
- 127 problematic files reduced by 80%+
- Zero console.log in production
- Zero TODO comments in critical paths
- Clean, organized codebase structure

## Agent Instructions
**Execute systematic debt elimination while coordinating with StabilityGuardian to prevent regression**