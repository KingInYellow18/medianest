# Getting Started with MediaNest

Welcome to MediaNest! This section contains everything you need to get up and running quickly.

## Quick Start Guide

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 14+
- Redis 6+

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/medianest.git
   cd medianest
   ```

2. **Install dependencies**

   ```bash
   npm install
   cd shared && npm install
   cd ../frontend && npm install
   cd ../backend && npm install
   ```

3. **Environment setup**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**

   ```bash
   npm run db:setup
   npm run db:migrate
   npm run db:seed
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

## What's in this section

- [Quick Start](./quick-start.md) - Get running in 5 minutes
- [Development Setup](./development-setup.md) - Detailed development environment
- [Project Overview](./project-overview.md) - Understanding MediaNest architecture
- [First Steps](./first-steps.md) - Your first MediaNest customization

## Next Steps

Once you're set up:

1. Check the [Architecture Guide](../02-architecture/README.md) to understand the system
2. Review the [API Reference](../03-api-reference/README.md) for available endpoints
3. Follow the [Implementation Guides](../04-implementation-guides/README.md) for common tasks
