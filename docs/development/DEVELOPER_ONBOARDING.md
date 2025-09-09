# MediaNest Developer Onboarding Guide

**Welcome to the MediaNest Development Team!** 🎉  
**Version**: 2.0  
**Target Audience**: New Developers  
**Estimated Completion Time**: 2-3 days

## 🎯 Onboarding Goals

By the end of this guide, you will:

- Have a fully functional development environment
- Understand MediaNest's architecture and codebase
- Successfully complete your first pull request
- Be familiar with our development workflows and standards

## 📋 Pre-Onboarding Checklist

### System Requirements

- [ ] **Operating System**: macOS 11+, Ubuntu 20.04+, or Windows 11 with WSL2
- [ ] **Memory**: Minimum 8GB RAM (16GB recommended)
- [ ] **Storage**: 50GB+ available space
- [ ] **Network**: Stable internet connection

### Account Setup

- [ ] **GitHub Account**: Access to MediaNest repository
- [ ] **Plex Account**: For testing authentication (provided if needed)
- [ ] **Slack/Discord**: Team communication access
- [ ] **1Password/LastPass**: Shared credential access

## 🛠️ Development Environment Setup

### Phase 1: Core Tools Installation

#### Version Control & Development Tools

```bash
# Git configuration
git config --global user.name "Your Name"
git config --global user.email "your.email@company.com"
git config --global init.defaultBranch main

# Essential tools
# macOS
brew install node@18 postgresql@14 redis docker

# Ubuntu
sudo apt update
sudo apt install nodejs npm postgresql-14 redis-server docker.io

# Windows (WSL2)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql redis-server
```

#### IDE Setup (VS Code Recommended)

```bash
# Install VS Code extensions
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-vscode.vscode-json
code --install-extension ms-kubernetes-tools.vscode-kubernetes-tools
code --install-extension ms-vscode-remote.remote-containers
```

#### VS Code Configuration

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"],
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### Phase 2: Repository Setup

#### Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/kinginyellow/medianest.git
cd medianest

# Install dependencies (root)
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to root
cd ..
```

#### Environment Configuration

```bash
# Copy environment templates
cp backend/.env.example backend/.env.local
cp frontend/.env.example frontend/.env.local

# Generate required secrets
npm run generate:secrets
```

#### Environment Variables Setup

```bash
# Backend environment (.env.local)
DATABASE_URL="postgresql://medianest:password@localhost:5432/medianest_dev"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-generated-jwt-secret"
PLEX_CLIENT_ID="your-plex-client-id"

# Frontend environment (.env.local)
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXTAUTH_SECRET="your-generated-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
```

### Phase 3: Database Setup

#### PostgreSQL Configuration

```bash
# Start PostgreSQL
sudo service postgresql start  # Linux
brew services start postgresql  # macOS

# Create database and user
sudo -u postgres psql
CREATE USER medianest WITH PASSWORD 'password';
CREATE DATABASE medianest_dev OWNER medianest;
CREATE DATABASE medianest_test OWNER medianest;
GRANT ALL PRIVILEGES ON DATABASE medianest_dev TO medianest;
GRANT ALL PRIVILEGES ON DATABASE medianest_test TO medianest;
\q

# Run initial migrations
cd backend
npm run db:migrate
npm run db:seed
```

#### Redis Configuration

```bash
# Start Redis
sudo service redis-server start  # Linux
brew services start redis        # macOS

# Verify Redis connection
redis-cli ping  # Should return PONG
```

### Phase 4: Docker Setup (Optional but Recommended)

#### Docker Compose for Development

```bash
# Start development services
docker-compose -f docker-compose.dev.yml up -d

# This starts:
# - PostgreSQL on port 5432
# - Redis on port 6379
# - pgAdmin on port 5050 (optional)
```

## 🏃‍♂️ Running the Application

### Development Servers

#### Start All Services

```bash
# Option 1: Using npm scripts (recommended for development)
npm run dev  # Starts both backend and frontend with hot reload

# Option 2: Start services individually
# Terminal 1: Backend
cd backend
npm run dev  # Starts on http://localhost:4000

# Terminal 2: Frontend
cd frontend
npm run dev  # Starts on http://localhost:3000
```

#### Verify Installation

1. **Backend Health Check**: Visit `http://localhost:4000/api/v1/health`
2. **Frontend Access**: Visit `http://localhost:3000`
3. **Database Connection**: Should show "Connected" in health check
4. **Redis Connection**: Should show "Connected" in health check

### Development Workflow

#### Daily Development Process

```bash
# 1. Start your day
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/your-feature-name

# 3. Start development servers
npm run dev

# 4. Make your changes...

# 5. Run tests
npm run test
npm run test:e2e

# 6. Commit changes
git add .
git commit -m "feat: add your feature description"

# 7. Push and create PR
git push origin feature/your-feature-name
```

## 🏗️ Codebase Architecture Overview

### Project Structure

```
medianest/
├── backend/                 # Node.js/Express API
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helper functions
│   ├── prisma/            # Database schema & migrations
│   └── tests/             # Backend tests
├── frontend/              # Next.js React app
│   ├── src/
│   │   ├── app/           # Next.js app router
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   └── types/         # Frontend TypeScript types
│   └── tests/             # Frontend tests
├── docs/                  # Project documentation
├── scripts/               # Development scripts
└── infrastructure/        # Deployment configs
```

### Technology Stack Deep Dive

#### Backend Technologies

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with custom middleware stack
- **Database**: PostgreSQL 14+ with Prisma ORM
- **Caching**: Redis for sessions and API caching
- **Authentication**: JWT with Plex OAuth integration
- **Testing**: Jest/Vitest with Supertest for API testing
- **Monitoring**: Winston logging with OpenTelemetry

#### Frontend Technologies

- **Framework**: Next.js 15 with App Router
- **UI Library**: React 19 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query for server state
- **Forms**: React Hook Form with Zod validation
- **Testing**: Vitest with React Testing Library
- **Build**: Turbo for monorepo management

### Key Design Patterns

#### Backend Patterns

```typescript
// Repository pattern for data access
interface MediaRepository {
  findById(id: string): Promise<Media | null>;
  findByQuery(query: SearchQuery): Promise<Media[]>;
  create(data: CreateMediaData): Promise<Media>;
  update(id: string, data: UpdateMediaData): Promise<Media>;
  delete(id: string): Promise<void>;
}

// Service layer for business logic
class MediaService {
  constructor(
    private mediaRepo: MediaRepository,
    private plexService: PlexService,
    private cacheService: CacheService
  ) {}

  async searchMedia(query: SearchQuery): Promise<SearchResults> {
    // Business logic implementation
  }
}

// Controller pattern for HTTP handling
class MediaController {
  constructor(private mediaService: MediaService) {}

  async searchMedia(req: Request, res: Response): Promise<void> {
    try {
      const results = await this.mediaService.searchMedia(req.query);
      res.json({ success: true, data: results });
    } catch (error) {
      next(error); // Error middleware handles the response
    }
  }
}
```

#### Frontend Patterns

```typescript
// Custom hooks for API integration
function useMediaSearch(query: string) {
  return useQuery({
    queryKey: ['media', 'search', query],
    queryFn: () => api.searchMedia(query),
    enabled: query.length > 0,
  });
}

// Component composition
function SearchPage() {
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = useMediaSearch(query);

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} />
      <SearchResults data={data} loading={isLoading} error={error} />
    </div>
  );
}
```

## 🧪 Testing Overview

### Testing Strategy

MediaNest uses a comprehensive testing approach:

1. **Unit Tests**: Test individual functions and components
2. **Integration Tests**: Test API endpoints and database interactions
3. **End-to-End Tests**: Test complete user workflows
4. **Performance Tests**: Load testing and benchmarking

### Running Tests

#### Backend Testing

```bash
cd backend

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run tests in watch mode
npm run test:watch
```

#### Frontend Testing

```bash
cd frontend

# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run component tests
npm run test:components

# Run E2E tests
npm run test:e2e
```

### Writing Your First Test

#### Backend Test Example

```typescript
// tests/services/media.test.ts
describe('MediaService', () => {
  let mediaService: MediaService;
  let mockRepository: jest.Mocked<MediaRepository>;

  beforeEach(() => {
    mockRepository = createMockRepository();
    mediaService = new MediaService(mockRepository, mockPlexService, mockCache);
  });

  it('should search media successfully', async () => {
    const query = { term: 'Avengers', type: 'movie' };
    const expectedResults = [{ id: '1', title: 'Avengers', type: 'movie' }];

    mockRepository.findByQuery.mockResolvedValue(expectedResults);

    const results = await mediaService.searchMedia(query);

    expect(results).toEqual(expectedResults);
    expect(mockRepository.findByQuery).toHaveBeenCalledWith(query);
  });
});
```

#### Frontend Test Example

```typescript
// tests/components/SearchInput.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '@/components/SearchInput';

describe('SearchInput', () => {
  it('should call onChange when input value changes', () => {
    const mockOnChange = jest.fn();

    render(<SearchInput value="" onChange={mockOnChange} />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test query' } });

    expect(mockOnChange).toHaveBeenCalledWith('test query');
  });
});
```

## 📜 Development Standards

### Code Style Guidelines

#### TypeScript Standards

```typescript
// ✅ Good: Use interface for object shapes
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

// ✅ Good: Use type for unions and primitives
type Status = 'idle' | 'loading' | 'success' | 'error';

// ✅ Good: Use const assertions for immutable data
const API_ENDPOINTS = {
  USERS: '/api/users',
  MEDIA: '/api/media',
} as const;

// ✅ Good: Use generic constraints
function processItems<T extends { id: string }>(items: T[]): T[] {
  return items.filter((item) => item.id.length > 0);
}
```

#### React Component Standards

```typescript
// ✅ Good: Function component with proper typing
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchInput({ value, onChange, placeholder, disabled }: SearchInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-4 py-2 border rounded-lg"
    />
  );
}
```

### Git Workflow

#### Commit Message Format

```bash
# Format: type(scope): description

feat(auth): add Plex OAuth integration
fix(api): handle authentication errors properly
docs(readme): update installation instructions
test(media): add search functionality tests
refactor(components): extract reusable button component
perf(api): optimize database queries for media search
```

#### Branch Naming

```bash
# Feature branches
feature/plex-integration
feature/user-dashboard
feature/media-search

# Bug fix branches
fix/authentication-error
fix/search-pagination
fix/mobile-responsive-layout

# Documentation branches
docs/api-documentation
docs/deployment-guide
docs/contributing-guidelines
```

### Code Review Process

#### Pull Request Template

```markdown
## Description

Brief description of the changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No console.log statements in production code
```

#### Review Checklist

1. **Functionality**: Does the code work as intended?
2. **Code Quality**: Is the code clean and maintainable?
3. **Performance**: Are there any performance implications?
4. **Security**: Are there any security vulnerabilities?
5. **Testing**: Is the code properly tested?
6. **Documentation**: Is the code properly documented?

## 🚀 Your First Contribution

### Step-by-Step First Task

We've prepared a beginner-friendly task to help you get familiar with the codebase:

#### Task: Add a "Last Updated" timestamp to media items

1. **Understanding the Task**:

   - Add a "lastUpdated" field to media items in the database
   - Update the API to return this field
   - Display the timestamp in the frontend

2. **Backend Changes**:

```sql
-- Add migration file: backend/prisma/migrations/add_last_updated.sql
ALTER TABLE media_items ADD COLUMN last_updated TIMESTAMP DEFAULT NOW();
```

3. **Update API Response**:

```typescript
// backend/src/services/media.service.ts
async getMediaById(id: string): Promise<Media> {
  const media = await this.mediaRepository.findById(id)
  return {
    ...media,
    lastUpdated: media.lastUpdated || media.createdAt
  }
}
```

4. **Frontend Display**:

```typescript
// frontend/src/components/MediaCard.tsx
import { formatDistanceToNow } from 'date-fns';

export function MediaCard({ media }: { media: Media }) {
  return (
    <div className="media-card">
      <h3>{media.title}</h3>
      <p>Last updated: {formatDistanceToNow(new Date(media.lastUpdated))} ago</p>
    </div>
  );
}
```

5. **Add Tests**:

```typescript
// backend/tests/services/media.test.ts
it('should include lastUpdated in media response', async () => {
  const media = await mediaService.getMediaById('test-id');
  expect(media.lastUpdated).toBeDefined();
  expect(media.lastUpdated).toBeInstanceOf(Date);
});
```

### Getting Help

#### Resources

1. **Documentation**: Check `/docs` directory first
2. **Code Comments**: Look for inline documentation
3. **Tests**: Existing tests show usage patterns
4. **Wiki**: Team knowledge base (if applicable)

#### Team Communication

1. **Daily Standup**: Ask questions during daily standup
2. **Slack/Discord**: Use appropriate channels
3. **Pair Programming**: Schedule with team members
4. **Code Reviews**: Learn from feedback

#### Escalation Path

1. **Junior Developer**: Ask team members
2. **Technical Questions**: Ask senior developers
3. **Architecture Decisions**: Ask tech lead
4. **Process Questions**: Ask team lead/manager

## 🎓 Learning Path

### Week 1: Foundation

- [ ] Complete environment setup
- [ ] Read architecture documentation
- [ ] Complete first pull request
- [ ] Attend team meetings

### Week 2: Feature Development

- [ ] Work on assigned user story
- [ ] Write comprehensive tests
- [ ] Participate in code reviews
- [ ] Deploy to staging environment

### Week 3: Integration

- [ ] Work on cross-team feature
- [ ] Contribute to team processes
- [ ] Help with documentation
- [ ] Mentor newer team members (as applicable)

### Ongoing Learning

- [ ] Stay updated with technology stack
- [ ] Contribute to technical discussions
- [ ] Participate in architecture reviews
- [ ] Share knowledge through documentation

## 📚 Additional Resources

### Internal Resources

- **Team Wiki**: Internal knowledge base
- **Architecture Decisions**: `/docs/architecture/ADR/`
- **API Documentation**: See actual implementations in `/backend/src/routes/` and `/backend/src/controllers/`
- **Deployment Guide**: `/docs/deployment/`

### External Resources

- **Next.js Documentation**: https://nextjs.org/docs
- **Prisma Documentation**: https://www.prisma.io/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript Handbook**: https://www.typescriptlang.org/docs

### Community

- **Stack Overflow**: Tag questions with project-specific tags
- **Discord/Slack**: Team communication channels
- **GitHub Issues**: Bug reports and feature requests
- **Team Blog**: Technical articles and updates

---

**Welcome to the team!** 🎉  
**Generated by**: MediaNest SWARM Developer Experience Agent  
**Next Review**: Monthly with new hires  
**Feedback**: onboarding@medianest.team
