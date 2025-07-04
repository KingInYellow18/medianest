#!/bin/bash
# scripts/init-structure.sh

echo "Creating MediaNest directory structure..."

# Create frontend directories if they don't exist
mkdir -p frontend/{app,components,lib,services,hooks,contexts,public}

# Create backend directories if they don't exist
mkdir -p backend/{src/{controllers,services,middleware,routes,models,utils,integrations,jobs,repositories},config}

# Create shared directories
mkdir -p shared/{src,dist}

# Create docker directory
mkdir -p docker

# Create scripts directory (already exists)
mkdir -p scripts

# Create test directories
mkdir -p tests/e2e

# Create placeholder files if they don't exist
[ ! -f frontend/app/layout.tsx ] && touch frontend/app/layout.tsx
[ ! -f frontend/app/page.tsx ] && touch frontend/app/page.tsx
[ ! -f backend/src/server.ts ] && touch backend/src/server.ts
[ ! -f shared/src/index.ts ] && touch shared/src/index.ts

echo "Directory structure created successfully!"