# MediaNest Terminology Standards

**Version:** 1.0  
**Date:** January 2025  
**Status:** Active  
**Purpose:** Standardized terminology dictionary for consistent documentation

## Technology Name Standards

### Framework and Runtime Names

- ✅ **Node.js** (not NodeJS, node.js, Node)
- ✅ **Express.js** (not Express, ExpressJS, express)
- ✅ **Next.js** (not NextJS, Nextjs, next.js)
- ✅ **TypeScript** (not Typescript, typescript, TS)
- ✅ **JavaScript** (not Javascript, javascript, JS)

### Database and Storage

- ✅ **PostgreSQL** (not Postgres, postgres, PostGreSQL)
- ✅ **Redis** (not redis, REDIS)
- ✅ **Prisma ORM** (not prisma, PRISMA)

### Authentication and Security

- ✅ **JWT** (not Json Web Token, jwt)
- ✅ **OAuth** (not oauth, OAUTH, oAuth)
- ✅ **Plex OAuth** (not plex oauth, PLEX OAuth)

### Build Tools and Development

- ✅ **Docker** (not docker, DOCKER)
- ✅ **Docker Compose** (not docker-compose, docker compose)
- ✅ **ESLint** (not eslint, EsLint)
- ✅ **Prettier** (not prettier, PRETTIER)

## Project Name Standards

### MediaNest Branding

- ✅ **MediaNest** - For documentation titles, user-facing content
- ✅ **medianest** - For technical references, file paths, URLs
- ✅ **@medianest** - For package names and npm scopes

### Component References

- ✅ **MediaNest Backend** (not medianest backend, Backend)
- ✅ **MediaNest Frontend** (not medianest frontend, Frontend)
- ✅ **MediaNest API** (not medianest api, API)

## Status Indicator Standards

### Implementation Status

- ✅ **IMPLEMENTED** - Feature is coded, tested, and functional
- ✅ **IN PROGRESS** - Currently being developed with active work
- ✅ **PLANNED** - Scheduled for development in defined timeline
- ✅ **PENDING** - Waiting for dependencies or blockers to resolve
- ✅ **NOT STARTED** - Not yet begun, in backlog

### Avoid These Status Indicators

- ❌ ✅ COMPLETE (misleading when not actually complete)
- ❌ 🔧 IN PROGRESS (emoji inconsistent)
- ❌ ⚡ READY (unclear meaning)
- ❌ 🚀 DONE (misleading completion state)

## Version Reference Standards

### Technology Versions (Current Standards)

- ✅ **Node.js 20.x LTS** (aligned with .nvmrc)
- ✅ **Express.js 5.x** (aligned with package.json)
- ✅ **TypeScript 5.x** (current stable)
- ✅ **PostgreSQL 15.x** (Docker configuration)
- ✅ **Redis 7.x** (Docker configuration)
- ✅ **Next.js 14.x** (package.json alignment)

### Version Format Standards

- Use semantic versioning format: MAJOR.x (e.g., "20.x LTS")
- Include LTS designation for Node.js: "Node.js 20.x LTS"
- Be specific about major versions only unless patch is critical

## File and Path Standards

### Documentation Structure

- ✅ **README.md** (uppercase, not readme.md)
- ✅ **DEVELOPMENT.md** (uppercase for root docs)
- ✅ **INSTALLATION_GUIDE.md** (descriptive, uppercase)
- ✅ **docs/guides/** (lowercase for directories)

### Code Organization

- ✅ **src/** (lowercase source directory)
- ✅ **tests/** (lowercase test directory)
- ✅ **scripts/** (lowercase utility scripts)
- ✅ **config/** (lowercase configuration)

## API and Endpoint Standards

### URL Patterns

- ✅ **/api/v1/endpoint** (versioned API paths)
- ✅ **/api/auth/plex** (clear service indication)
- ✅ **/api/media/requests** (RESTful resource naming)

### HTTP Methods

- ✅ **GET /api/endpoint** (uppercase HTTP methods)
- ✅ **POST /api/endpoint** (consistent formatting)
- ✅ **PUT /api/endpoint** (full method names)
- ✅ **DELETE /api/endpoint** (not DEL or REMOVE)

## Environment and Configuration

### Environment Variables

- ✅ **DATABASE_URL** (uppercase with underscores)
- ✅ **REDIS_URL** (consistent naming pattern)
- ✅ **JWT_SECRET** (clear purpose indication)
- ✅ **NEXTAUTH_SECRET** (vendor prefix pattern)

### Configuration Files

- ✅ **docker-compose.yml** (lowercase with hyphens)
- ✅ **package.json** (lowercase standard)
- ✅ **tsconfig.json** (tool-specific naming)
- ✅ **.env.example** (dotfile standard)

## Quality and Testing Standards

### Test Organization

- ✅ **Unit Tests** (not unit tests, Unit tests)
- ✅ **Integration Tests** (not integration tests, E2E Tests)
- ✅ **End-to-End Tests** (not e2e tests, E2E tests)

### Quality Metrics

- ✅ **Code Coverage** (not coverage, code cov)
- ✅ **Test Coverage** (specific context)
- ✅ **Performance Metrics** (not perf metrics, performance)

## Documentation Standards

### Header Format

```markdown
# MediaNest [Document Type]

**Version:** [Semantic Version]  
**Date:** [Month Year]  
**Status:** [Active|Final|Under Development]
```

### Section Headings

- Use sentence case: "Authentication system"
- Be descriptive: "Plex OAuth implementation"
- Avoid abbreviations: "Application Programming Interface" not "API"

## Consistency Enforcement Rules

### Global Find/Replace Patterns

1. "Express" → "Express.js" (in technology contexts)
2. "Postgres" → "PostgreSQL" (database references)
3. "nodejs" → "Node.js" (runtime references)
4. "typescript" → "TypeScript" (language references)
5. "✅ COMPLETE" → "IMPLEMENTED" (status corrections)

### Manual Review Required

- Context-sensitive replacements
- Brand name consistency
- Technical accuracy verification
- Cross-reference validation

## Maintenance Procedures

### Monthly Terminology Audit

1. Search for deprecated terms
2. Verify version alignment with package.json
3. Check for new inconsistencies
4. Update standards as project evolves

### Release Preparation

1. Update version references
2. Verify terminology consistency
3. Check status indicator accuracy
4. Validate cross-references

---

**Maintained by:** Documentation Team  
**Next Review:** Monthly audit cycle  
**Authority:** Project-wide standard
