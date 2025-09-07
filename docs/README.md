# MediaNest Documentation

This directory contains the complete documentation for MediaNest, built with MkDocs Material theme.

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

### Build Scripts

Use the provided build scripts for production builds:

```bash
# Full build with all optimizations
./scripts/build-docs.sh

# Development build (faster)
./scripts/build-docs.sh --dev

# Skip dependencies and tests
./scripts/build-docs.sh --skip-deps --skip-tests
```

### Deployment Scripts

Deploy to various platforms:

```bash
# Deploy to GitHub Pages
./scripts/deploy-docs.sh --github

# Deploy to Netlify
./scripts/deploy-docs.sh --netlify

# Deploy to AWS S3
./scripts/deploy-docs.sh --s3

# Deploy to custom server
./scripts/deploy-docs.sh --custom
```

## License

This documentation is part of the MediaNest project and follows the same MIT license.
