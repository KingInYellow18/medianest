# MediaNest Documentation

**📚 Comprehensive Documentation Hub - MkDocs Material**

[![MkDocs](https://img.shields.io/badge/MkDocs-Material-blue)](https://squidfunk.github.io/mkdocs-material/)
[![Documentation](https://img.shields.io/badge/Docs-Live-green)](https://kinginyellow.github.io/medianest/)
[![Status](https://img.shields.io/badge/Status-Active-brightgreen)]()

Welcome to the MediaNest documentation system. This directory contains all project documentation organized for easy navigation and maintenance.

## 📖 Documentation Structure

```
docs/
├── 🏠 index.md                    # Main documentation homepage
├── 🚀 getting-started/            # Quick start guides and setup
│   ├── quickstart.md             # 5-minute setup guide
│   └── development-setup.md      # Full development environment
├── 🏗️ architecture/              # System design and architecture
│   ├── system-overview.md        # High-level system architecture
│   ├── component-architecture.md # Component design patterns
│   ├── data-flow.md             # Data flow diagrams
│   └── decisions/               # Architecture Decision Records (ADRs)
├── 📡 api/                       # API documentation and reference
│   ├── overview.md              # API overview and authentication
│   ├── websocket.md            # Real-time API documentation
│   └── endpoints/              # Endpoint-specific documentation
├── 🚀 deployment/                # Deployment guides and configuration
│   ├── ci-cd.md                # Continuous integration/deployment
│   ├── prerequisites-checklist.md # Pre-deployment requirements
│   └── deployment-validation.md   # Post-deployment validation
├── ⚙️ operations/                # Operations and staging deployment
│   ├── staging-deployment.md   # Complete staging deployment guide
│   ├── staging-prerequisites.md # Staging infrastructure requirements
│   ├── staging-troubleshooting.md # Staging troubleshooting guide
│   └── monitoring-stack.md     # Monitoring and observability
├── 🧑‍💻 developers/                # Developer guides and contribution
│   ├── contributing.md         # Contribution guidelines
│   └── workflow.md            # Development workflow
├── 📊 visuals/                   # Diagrams and visual documentation
│   ├── database-schema.md      # Database schema diagrams
│   ├── deployment-architecture.md # Infrastructure diagrams
│   └── system-flow.md          # Process flow diagrams
├── 📋 standards/                 # Documentation and coding standards
│   └── documentation-checklist.md # Documentation quality checklist
└── 🎨 stylesheets/              # Custom MkDocs styling
    └── extra.css               # Additional styling
```

## 🌐 Accessing Documentation

### 🔴 Live Documentation Site

The documentation is automatically built and deployed using MkDocs Material:

**🌍 Live Site**: [https://kinginyellow.github.io/medianest/](https://kinginyellow.github.io/medianest/)

### 💻 Local Development

To build and serve documentation locally:

```bash
# Install MkDocs and dependencies
pip install mkdocs-material

# Serve documentation locally with hot reload
npm run dev:docs
# or
mkdocs serve

# Build static documentation
npm run build:docs
# or
mkdocs build
```

**Local URL**: [http://localhost:8000](http://localhost:8000)

## 📝 Documentation Standards

### Writing Guidelines

- **Clear and Concise**: Write for developers at all levels
- **Code Examples**: Include working code samples
- **Visual Aids**: Add diagrams and screenshots where helpful
- **Update Frequently**: Keep documentation in sync with code changes
- **Link Cross-References**: Connect related documentation sections

### Markdown Format

- Use **MkDocs Material** syntax for enhanced features
- Include **code blocks** with language specifications
- Add **admonitions** for notes, warnings, and tips
- Use **tables** for structured information
- Include **diagrams** using Mermaid syntax

### Example Documentation Structure

````markdown
# Page Title

Brief description of what this document covers.

## Prerequisites

List any requirements or setup needed.

## Quick Start

### Step 1: Setup

```bash
command examples
```
````

### Step 2: Configuration

Configuration details with examples.

## Advanced Topics

Detailed information for advanced users.

!!! note "Important Note"
Use admonitions for important information.

!!! warning "Warning"
Highlight potential issues or risks.

## Related Documentation

- [Related Topic 1](../other-topic/)
- [Related Topic 2](../../another-topic/)

````

## 🔧 MkDocs Configuration

The documentation site is configured via `mkdocs.yml` in the project root:

### Key Features

- **Material Theme**: Modern, responsive design
- **Search**: Full-text search with highlighting
- **Navigation**: Automatic sidebar generation
- **Code Highlighting**: Syntax highlighting for 100+ languages
- **Mermaid Diagrams**: Integrated diagram support
- **Git Integration**: Automatic last-modified dates
- **Mobile Responsive**: Optimized for all devices

### Build Process

```bash
# Development server with live reload
mkdocs serve

# Production build
mkdocs build

# Deploy to GitHub Pages
mkdocs gh-deploy
````

## 📊 Documentation Metrics

| Metric                | Value         | Status           |
| --------------------- | ------------- | ---------------- |
| **Total Pages**       | 25+           | ✅ Comprehensive |
| **API Documentation** | 15+ endpoints | ✅ Complete      |
| **Architecture Docs** | 8 diagrams    | ✅ Current       |
| **Setup Guides**      | 3 levels      | ✅ Detailed      |
| **Last Update**       | Current       | ✅ Active        |

## 🤝 Contributing to Documentation

### Adding New Documentation

1. **Create Markdown File**

   ```bash
   # Create new documentation file
   touch docs/new-section/new-topic.md
   ```

2. **Update Navigation**

   ```yaml
   # Add to mkdocs.yml nav section
   nav:
     - New Section:
         - New Topic: new-section/new-topic.md
   ```

3. **Write Content**
   - Follow documentation standards
   - Include code examples
   - Add cross-references
   - Test locally with `mkdocs serve`

4. **Submit Changes**
   - Create pull request with documentation changes
   - Documentation builds automatically via GitHub Actions
   - Review changes on live site after merge

### Documentation Review Process

1. **Content Review**: Ensure accuracy and completeness
2. **Technical Review**: Verify code examples work
3. **Style Review**: Check formatting and consistency
4. **Link Check**: Verify all links work correctly

## 🔗 Quick Links

### Essential Documentation

- **[Getting Started](getting-started/)** - Setup and installation guides
- **[API Reference](api/)** - Complete API documentation
- **[Architecture](architecture/)** - System design and patterns
- **[Deployment](deployment/)** - Production deployment guides
- **[Operations](operations/)** - Staging deployment and operations

#### Staging Deployment

- **[Staging Deployment Guide](operations/staging-deployment.md)** - Complete staging setup
- **[Staging Prerequisites](operations/staging-prerequisites.md)** - Infrastructure requirements
- **[Staging Troubleshooting](operations/staging-troubleshooting.md)** - Common issues and solutions
- **[Critical Fixes Applied](operations/critical-fixes-applied.md)** - Resolved deployment issues

### Development Resources

- **[Contributing Guidelines](developers/contributing.md)** - How to contribute
- **[Development Workflow](developers/workflow.md)** - Development processes
- **[Standards](standards/)** - Coding and documentation standards

### Visual Resources

- **[Database Schema](visuals/database-schema.md)** - Database design
- **[System Architecture](visuals/deployment-architecture.md)** - Infrastructure design
- **[Process Flows](visuals/system-flow.md)** - Workflow diagrams

## 🆘 Documentation Help

### Common Tasks

```bash
# Search for specific content
grep -r "search term" docs/

# Find broken links
mkdocs build --strict

# Check documentation formatting
prettier --check "docs/**/*.md"

# Update table of contents
mkdocs build && open site/index.html
```

### Getting Support

- **Documentation Issues**: [GitHub Issues](https://github.com/kinginyellow/medianest/issues)
- **Content Questions**: Check existing documentation first
- **Contribution Help**: See [Contributing Guidelines](developers/contributing.md)

---

**📅 Last Updated**: September 11, 2025  
**✍️ Maintained By**: MediaNest Development Team  
**🔄 Update Frequency**: Active development - updated with each release
