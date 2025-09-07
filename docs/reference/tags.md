# Documentation Tags

This page lists all tags used throughout the MediaNest documentation for improved searchability and organization.

## Architecture Tags

- **architecture** - System architecture and design documents
- **system-design** - High-level system design patterns
- **monolithic** - Monolithic architecture patterns
- **containers** - Docker and containerization
- **microservices** - Microservice architecture patterns
- **scalability** - Scalability considerations and patterns

## Security Tags

- **security** - Security-related documentation
- **authentication** - Authentication mechanisms
- **authorization** - Authorization and access control
- **encryption** - Data encryption and protection
- **oauth** - OAuth implementation
- **jwt** - JWT token handling
- **csrf** - CSRF protection
- **tls** - TLS/SSL configuration

## API Tags

- **api** - API documentation
- **rest** - RESTful API design
- **design-patterns** - API design patterns
- **openapi** - OpenAPI specification
- **endpoints** - API endpoint documentation
- **middleware** - API middleware
- **validation** - Input validation
- **rate-limiting** - API rate limiting

## Development Tags

- **backend** - Backend development
- **frontend** - Frontend development
- **database** - Database-related content
- **testing** - Testing strategies and guides
- **deployment** - Deployment procedures
- **docker** - Docker-specific content
- **monitoring** - Monitoring and observability
- **performance** - Performance optimization

## Infrastructure Tags

- **infrastructure** - Infrastructure management
- **devops** - DevOps practices
- **ci-cd** - Continuous integration/deployment
- **nginx** - Nginx configuration
- **ssl** - SSL certificate management
- **backup** - Backup strategies
- **disaster-recovery** - Disaster recovery planning

## User Experience Tags

- **user-guide** - User documentation
- **tutorial** - Step-by-step tutorials
- **troubleshooting** - Problem-solving guides
- **faq** - Frequently asked questions
- **best-practices** - Recommended practices
- **configuration** - Configuration guides

## Integration Tags

- **plex** - Plex Media Server integration
- **youtube** - YouTube API integration
- **tmdb** - TMDB API integration
- **sonarr** - Sonarr integration
- **radarr** - Radarr integration
- **tautulli** - Tautulli integration
- **webhooks** - Webhook implementation

## Quality Tags

- **code-quality** - Code quality standards
- **documentation** - Documentation standards
- **review** - Review processes
- **standards** - Coding and documentation standards
- **compliance** - Compliance requirements

## Status Tags

- **active** - Currently maintained documentation
- **deprecated** - Deprecated features or approaches
- **beta** - Beta/experimental features
- **planned** - Future planned features
- **legacy** - Legacy system documentation

---

## Tag Usage Guidelines

### For Contributors

When creating or updating documentation:

1. **Add relevant tags** to the frontmatter of your document:

   ```yaml
   ---
   title: 'Document Title'
   tags: [tag1, tag2, tag3]
   ---
   ```

2. **Use existing tags** when possible to maintain consistency

3. **Propose new tags** if existing ones don't fit your content

4. **Limit to 5-7 tags** per document for optimal searchability

### For Searchers

Use tags to find related content:

- Search for `tag:architecture` to find all architecture documents
- Combine tags: `tag:security AND tag:api` for security API docs
- Browse by category using the tag cloud

---

_Tags are automatically indexed and searchable through the documentation search system._
