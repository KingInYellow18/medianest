# Getting Started with MediaNest

Welcome to MediaNest! This section will help you get up and running quickly with our powerful media management platform.

## What You'll Learn

In this getting started guide, you'll learn how to:

1. **[Quick Start](quickstart.md)** - Get MediaNest running in under 5 minutes
2. **[System Requirements](requirements.md)** - Ensure your system meets the prerequisites
3. **[First Time Setup](first-setup.md)** - Configure MediaNest for your needs

## Prerequisites

Before you begin, make sure you have:

- A supported operating system (Linux, macOS, or Windows)
- Docker and Docker Compose installed
- At least 4GB of RAM available
- 10GB of free disk space for initial setup

## Next Steps

Choose your preferred installation method:

=== "Docker (Recommended)"

    The fastest way to get started with MediaNest is using Docker:

    ```bash
    git clone https://github.com/medianest/medianest.git
    cd medianest
    docker-compose up -d
    ```

    [Full Docker Guide](../installation/docker.md){ .md-button }

=== "Manual Installation"

    For development or custom deployments:

    ```bash
    npm install -g @medianest/cli
    medianest init my-project
    cd my-project
    medianest start
    ```

    [Manual Installation Guide](../installation/manual.md){ .md-button }

## Common Use Cases

<div class="grid cards" markdown>

- **Personal Media Library**

  ***

  Organize family photos, videos, and documents with AI-powered categorization.

- **Content Creator Workflow**

  ***

  Manage assets for videos, podcasts, and social media with collaboration tools.

- **Team Collaboration**

  ***

  Share media assets across teams with role-based permissions and version control.

- **Enterprise DAM**

  ***

  Scale to enterprise-level digital asset management with advanced features.

</div>

## Need Help?

- Check our [FAQ](../reference/faq.md) for common questions
- Browse [Troubleshooting](../troubleshooting/) for solutions to common issues
- Join our [GitHub Discussions](https://github.com/medianest/medianest/discussions) for community support

---

Ready to dive in? Start with our [Quick Start Guide](quickstart.md)!
