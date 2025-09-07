# MediaNest Documentation

⚠️ **PROJECT STATUS: UNDER DEVELOPMENT - NOT PRODUCTION READY**

This directory contains the documentation for MediaNest (currently in development phase). Some documentation may contain outdated or aspirational content that does not reflect current implementation status.

**CRITICAL**: Review individual documents as some may contain false claims about production readiness, test coverage, and security status.

## Quick Start

1. **Install MkDocs and dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

2. **Start the development server:**

   ```bash
   mkdocs serve
   ```

3. **Build the documentation:**
   ```bash
   mkdocs build
   ```

## Documentation Structure

```
docs/
├── index.md                    # Homepage
├── getting-started/            # Getting started guides
├── installation/               # Installation guides
├── user-guides/               # User guides and tutorials
├── api/                       # API reference
├── developers/                # Developer documentation
├── troubleshooting/           # Troubleshooting guides
├── reference/                 # Reference materials
└── assets/                    # Static assets
```

## Building and Deployment

⚠️ **BUILD STATUS: CURRENTLY BROKEN**

The main MediaNest application has build failures that may affect documentation builds:

- Vite build errors (maximum call stack exceeded)
- 42 security vulnerabilities in dependencies
- TypeScript compilation failures

### Build Scripts (May Fail)

```bash
# Full build (may fail due to main project issues)
./scripts/build-docs.sh

# Development build (may have limited functionality)
./scripts/build-docs.sh --dev

# Skip dependencies and tests (safest option currently)
./scripts/build-docs.sh --skip-deps --skip-tests
```

### Deployment Scripts (Not Recommended Currently)

⚠️ **DEPLOYMENT BLOCKED**: Do not deploy documentation while main project has build failures and security vulnerabilities.

```bash
# These commands exist but should not be used until issues are resolved:
# ./scripts/deploy-docs.sh --github
# ./scripts/deploy-docs.sh --netlify
# ./scripts/deploy-docs.sh --s3
# ./scripts/deploy-docs.sh --custom
```

**Fix Required**: Resolve main project build failures and security vulnerabilities before deploying documentation.

## License

This documentation is part of the MediaNest project and follows the same MIT license.
