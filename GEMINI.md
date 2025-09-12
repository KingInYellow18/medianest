# MediaNest Project Overview

This document provides a comprehensive overview of the MediaNest project, its structure, and key operational commands. It is intended to be used as a quick reference for developers and as a context file for AI assistants.

## Project Overview

MediaNest is a unified web portal for managing Plex media server and related services. It provides a modern, responsive interface for media management, user authentication, and service integration.

*   **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
*   **Backend:** Express.js, TypeScript, Prisma ORM
*   **Database:** PostgreSQL
*   **Caching:** Redis
*   **Deployment:** Docker

The project is structured as a monorepo with the following key directories:

*   `frontend/`: The Next.js frontend application.
*   `backend/`: The Express.js backend API.
*   `shared/`: Shared utilities and types between the frontend and backend.
*   `infrastructure/`: Deployment configurations, including Docker and Nginx.
*   `tests/`: E2E, integration, and security tests.
*   `docs/`: Project documentation.
*   `scripts/`: Various build, test, and deployment scripts.

## Building and Running

### Prerequisites

*   Node.js 20.x+
*   Docker
*   PostgreSQL 15.x+
*   Redis 7.x+

### Development

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set up Environment Variables:**
    ```bash
    cp .env.example .env
    ```
    *Note: You will need to fill in the required environment variables in the `.env` file.*

3.  **Run Database Migrations:**
    ```bash
    cd backend && npx prisma migrate deploy
    ```

4.  **Start Development Servers:**
    ```bash
    npm run dev
    ```
    This will start the frontend on `http://localhost:3000` and the backend on `http://localhost:3001`.

### Docker

The project is configured to run with Docker Compose.

*   **Start Development Environment:**
    ```bash
    npm run docker:compose
    ```

*   **Start Production Environment:**
    ```bash
    ./deployment/scripts/deploy-compose.sh --domain your-domain.com
    ```

## Testing

The project uses `vitest` for testing.

*   **Run All Tests:**
    ```bash
    npm test
    ```

*   **Run Fast Tests (for development):**
    ```bash
    npm run test:ultra-fast
    ```

*   **Run Tests with Coverage:**
    ```bash
    npm run test:coverage
    ```

## Development Conventions

*   **Code Style:** The project uses ESLint and Prettier for code formatting and linting.
*   **Commits:** The project follows the Conventional Commits specification.
*   **Branching:** Feature branches should be created from `main`.
*   **Backend:** The backend follows a layered architecture with `controllers`, `services`, `middleware`, and `routes`.
*   **Frontend:** The frontend uses the Next.js App Router and a component-based architecture.
