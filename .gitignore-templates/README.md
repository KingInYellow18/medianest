# MediaNest Branch-Specific .gitignore Templates

This directory contains optimized .gitignore patterns for each branch in the MediaNest 4-tier workflow.

## Branch-Specific Templates

### 1. `.gitignore.main` - Production Branch
**Purpose**: Clean production deployments with minimal essential files
- ✅ Essential source code only
- ✅ Core configuration files
- ✅ Production documentation
- ❌ All development tools
- ❌ All test artifacts
- ❌ All coordination files

### 2. `.gitignore.development` - Stable Development
**Purpose**: Contributor-friendly with shared development tools
- ✅ Source code and tests
- ✅ Shared IDE configurations
- ✅ Basic coordination tools
- ❌ Personal IDE settings
- ❌ Test coverage reports
- ❌ Advanced coordination memory

### 3. `.gitignore.test` - Testing & Validation
**Purpose**: Include test artifacts for analysis
- ✅ Test results and reports
- ✅ Visual regression artifacts
- ✅ Performance benchmarks
- ✅ Test databases
- ❌ Coverage reports (too volatile)
- ❌ Personal development files

### 4. `.gitignore.claude-flow` - AI Development
**Purpose**: Include all tooling and personal configurations
- ✅ All development configurations
- ✅ All coordination and AI tooling
- ✅ All test results and coverage
- ✅ Personal IDE settings
- ✅ Memory and learning data
- ❌ Large binaries only

## Usage

### Automatic Branch Detection
The system automatically applies the appropriate .gitignore based on the current branch.

### Manual Application
```bash
# Apply main branch patterns
cp .gitignore.main .gitignore

# Apply development branch patterns  
cp .gitignore.development .gitignore

# Apply test branch patterns
cp .gitignore.test .gitignore

# Apply claude-flow branch patterns
cp .gitignore.claude-flow .gitignore
```

### Branch Switching
When switching branches, the appropriate .gitignore is automatically applied:
```bash
git checkout main        # Auto-applies .gitignore.main
git checkout development # Auto-applies .gitignore.development
git checkout test        # Auto-applies .gitignore.test
git checkout claude-flow # Auto-applies .gitignore.claude-flow
```

## Key Differences

| Pattern | main | development | test | claude-flow |
|---------|------|-------------|------|-------------|
| Source Code | ✅ | ✅ | ✅ | ✅ |
| Test Files | ❌ | ✅ | ✅ | ✅ |
| Test Results | ❌ | ❌ | ✅ | ✅ |
| Coverage Reports | ❌ | ❌ | ❌ | ✅ |
| IDE Settings (shared) | ✅ | ✅ | ✅ | ✅ |
| IDE Settings (personal) | ❌ | ❌ | ❌ | ✅ |
| Coordination Tools | ❌ | Basic | Basic | ✅ |
| Memory/Learning | ❌ | ❌ | ❌ | ✅ |
| Build Outputs | ❌ | ❌ | ❌ | Partial |
| Dev Dependencies | ❌ | ✅ | ✅ | ✅ |
| Secrets | ❌ | ❌ | ❌ | ❌ |

## Coordination Integration

These templates integrate with the Claude Flow coordination system:
- Memory storage for pattern decisions
- Automatic application during branch switches
- Hive mind coordination for optimization
- Learning from usage patterns

## Maintenance

Templates are maintained by the Gitignore-Architect agent and updated based on:
- Project evolution
- Workflow optimization
- Team feedback
- Automated analysis