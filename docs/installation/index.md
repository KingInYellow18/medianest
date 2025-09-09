# Installation Guide

Choose your preferred installation method for MediaNest. We recommend Docker for most users.

## Installation Methods

### 🐳 [Docker Installation](docker.md) (Recommended)
- **Pros**: Easy setup, isolated environment, automatic dependencies
- **Best for**: Production deployments, quick testing
- **Time**: 5 minutes

### ⚙️ [Manual Installation](manual.md)
- **Pros**: Full control, development-friendly
- **Best for**: Development, custom configurations
- **Time**: 15-30 minutes

## Quick Start Options

### Docker Compose (Production Ready)
```bash
curl -o docker-compose.yml https://raw.githubusercontent.com/medianest/medianest/main/docker-compose.yml
docker-compose up -d
```

### Single Docker Container
```bash
docker run -d --name medianest -p 8080:8080 medianest/medianest:latest
```

## Next Steps

After installation:

1. **[Configuration](configuration.md)** - Configure MediaNest settings
2. **[Environment Variables](environment.md)** - Set up environment variables
3. **[Database Setup](database.md)** - Initialize the database
4. **[First Setup](../getting-started/first-setup.md)** - Complete the setup wizard

## Support

- Installation issues: [GitHub Issues](https://github.com/medianest/medianest/issues)
- Community help: [Discord](https://discord.gg/medianest)
- Documentation: [User Guides](../user-guides/index.md)