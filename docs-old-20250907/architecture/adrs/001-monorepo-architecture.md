# ADR-001: Monorepo Architecture with Separate Frontend/Backend

## Status

Accepted

## Context

MediaNest requires a unified development experience while maintaining clear separation of concerns between the web frontend and API backend. The decision was needed to determine the project structure that would best support:

- Developer productivity and consistent tooling
- Clear separation between frontend and backend concerns
- Shared code reusability (types, utilities, configurations)
- Independent deployment capabilities
- Testing strategies across different layers

Options considered:

1. **Monorepo with separated services** - Single repository with distinct frontend/backend folders
2. **Multi-repo approach** - Separate repositories for frontend, backend, and shared components
3. **Monolithic single application** - Combined Next.js application with API routes

## Decision

We adopt a monorepo architecture with clearly separated frontend and backend applications:

```
medianest/
├── frontend/          # Next.js React application
├── backend/           # Express.js API server
├── shared/            # Shared types, utilities, configurations (referenced)
├── docs/              # Project documentation
├── infrastructure/    # Docker configurations and deployment
├── docker-compose.yml # Development and production orchestration
└── package.json       # Root package with workspace scripts
```

**Key architectural principles:**

- Each service maintains its own `package.json` and dependencies
- Shared code is referenced via `@medianest/shared` package
- Independent build and deployment processes
- Unified development commands at root level
- Consistent tooling (TypeScript, ESLint, Prettier) across services

## Consequences

### Positive

- **Developer Experience**: Single clone, unified development environment
- **Code Sharing**: Easy sharing of types, utilities, and configurations
- **Tooling Consistency**: Shared linting, formatting, and build configurations
- **Coordinated Releases**: Version management and deployment coordination
- **Documentation Centralization**: All architecture decisions and docs in one place
- **Testing Strategy**: Integrated testing pipeline with E2E tests

### Negative

- **Build Complexity**: More complex build orchestration
- **Dependency Management**: Need to manage cross-service dependencies
- **Repository Size**: Larger repository size compared to individual repos
- **CI/CD Complexity**: More complex deployment pipelines

### Mitigations

- Use workspace features for dependency management
- Implement selective building based on changed files
- Clear separation of service-specific vs shared concerns
- Docker containerization for consistent deployment environments
