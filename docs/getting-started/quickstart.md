# Quick Start Guide

Get MediaNest up and running in under 5 minutes with Docker.

## Prerequisites

- Docker 20.10+
- 2GB+ available RAM
- 10GB+ available disk space

## One-Line Install

```bash
docker run -d --name medianest -p 8080:8080 -v $(pwd)/media:/app/media medianest/medianest:latest
```

## Next Steps

1. Open http://localhost:8080 in your browser
2. Complete the setup wizard
3. Add your media directories
4. Start managing your media!

For detailed configuration, see the [Installation Guide](../installation/index.md).