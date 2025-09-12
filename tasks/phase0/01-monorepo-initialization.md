# Task: Initialize Monorepo Structure

**Status:** ✅ COMPLETED  
**Completed Date:** 2025-01-04  
**Priority:** Critical  
**Estimated Duration:** 2-3 hours  
**Dependencies:** None  
**Phase:** 0 (Week 1 - Day 1)

## Objective

Initialize the MediaNest monorepo with proper directory structure, configure Node.js environment, set up TypeScript for both frontend and backend, and establish shared configuration files.

## Background

A well-organized monorepo structure is essential for maintaining code quality and developer experience. This task establishes the foundation for all future development.

## Detailed Requirements

### 1. Directory Structure Creation

Create the complete project structure as defined in the architecture:

```
medianest/
├── frontend/          # Next.js 14 application
├── backend/           # Express.js API server
├── shared/            # Shared types and utilities
├── docker/            # Docker configurations
├── scripts/           # Build and deployment scripts
├── docs/              # Already exists
├── tasks/             # Already exists
└── tests/             # E2E tests (Playwright)
```

### 2. Root Package.json Configuration

- Set up workspaces for monorepo management
- Configure scripts for running frontend/backend
- Add common development dependencies

### 3. Node.js Environment Setup

- Ensure Node.js 20.x LTS is used
- Create .nvmrc file
- Set up .node-version for other version managers

### 4. Git Configuration

- Initialize git repository (already done)
- Create comprehensive .gitignore
- Set up .gitattributes for line endings

## Technical Implementation Details

### Root package.json

```json
{
  "name": "medianest",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["frontend", "backend", "shared"],
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:frontend": "npm run dev --workspace=frontend",
    "dev:backend": "npm run dev --workspace=backend",
    "build": "npm run build:shared && npm run build:backend && npm run build:frontend",
    "build:shared": "npm run build --workspace=shared",
    "build:frontend": "npm run build --workspace=frontend",
    "build:backend": "npm run build --workspace=backend",
    "test": "npm run test --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "clean": "npm run clean --workspaces --if-present && rimraf node_modules",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:logs": "docker-compose logs -f"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "rimraf": "^5.0.5",
    "husky": "^9.0.10",
    "lint-staged": "^15.2.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

### Frontend package.json

```json
{
  "name": "@medianest/frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "clean": "rimraf .next out"
  }
}
```

### Backend package.json

```json
{
  "name": "@medianest/backend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint src --ext .ts",
    "clean": "rimraf dist"
  }
}
```

### Shared package.json

```json
{
  "name": "@medianest/shared",
  "version": "1.0.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist"
  }
}
```

### .gitignore

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/
*.lcov
.nyc_output

# Next.js
.next/
out/
build/
*.tsbuildinfo
next-env.d.ts

# Production
dist/

# Misc
.DS_Store
*.pem
.vscode/
.idea/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Vercel
.vercel

# Docker
docker/data/

# OS
Thumbs.db
```

### .nvmrc

```
20.11.0
```

### Directory Creation Script

```bash
#!/bin/bash
# scripts/init-structure.sh

echo "Creating MediaNest directory structure..."

# Create main directories
mkdir -p frontend/{app,components,lib,services,hooks,contexts,public}
mkdir -p backend/{src/{controllers,services,middleware,routes,models,utils},config}
mkdir -p shared/{src,dist}
mkdir -p docker
mkdir -p scripts
mkdir -p tests/e2e

# Create placeholder files
touch frontend/app/layout.tsx
touch frontend/app/page.tsx
touch backend/src/server.ts
touch shared/src/index.ts

echo "Directory structure created successfully!"
```

## Acceptance Criteria

1. ✅ All directories created according to structure
2. ✅ Workspace configuration working (npm install works)
3. ✅ Node.js version locked to 20.x
4. ✅ Git properly configured with .gitignore
5. ✅ All package.json files have correct scripts
6. ✅ Monorepo commands work (npm run dev)
7. ✅ Clean script removes all build artifacts

## Testing Requirements

- Verify `npm install` installs all workspace dependencies
- Confirm `npm run dev` would start both services (once configured)
- Check that git ignores appropriate files
- Ensure Node.js version is enforced

## Commands to Execute

```bash
# 1. Create directory structure
bash scripts/init-structure.sh

# 2. Initialize workspaces
npm init -y # (in each workspace directory)

# 3. Install workspace dependencies
npm install

# 4. Verify setup
npm run clean
npm install
```

## Dependencies

- Node.js 20.x LTS
- npm 10.x or higher
- Git

## Next Steps

After this task:

1. Configure TypeScript (task 02)
2. Set up ESLint and Prettier (task 03)
3. Initialize Next.js and Express (task 04)

## References

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v10/using-npm/workspaces)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
