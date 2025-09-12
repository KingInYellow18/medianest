# Development Workflow Diagrams

## Git Branching Strategy

```mermaid
gitgraph
    commit id: "Initial Setup"

    branch develop
    checkout develop
    commit id: "Base Development"

    branch feature/authentication
    checkout feature/authentication
    commit id: "Add JWT auth"
    commit id: "Add Plex OAuth"
    commit id: "Add session management"

    checkout develop
    merge feature/authentication
    commit id: "Merge auth feature"

    branch feature/media-requests
    checkout feature/media-requests
    commit id: "Add TMDB integration"
    commit id: "Add request system"
    commit id: "Add Overseerr sync"

    checkout develop
    merge feature/media-requests
    commit id: "Merge media requests"

    branch feature/youtube-downloads
    checkout feature/youtube-downloads
    commit id: "Add YouTube API"
    commit id: "Add download queue"
    commit id: "Add Plex integration"

    checkout develop
    merge feature/youtube-downloads
    commit id: "Merge YouTube feature"

    branch release/v2.0.0
    checkout release/v2.0.0
    commit id: "Prepare release"
    commit id: "Update docs"
    commit id: "Version bump"

    checkout main
    merge release/v2.0.0
    commit id: "Release v2.0.0"

    checkout develop
    merge main
    commit id: "Sync develop with main"

    branch hotfix/security-patch
    checkout hotfix/security-patch
    commit id: "Security fix"

    checkout main
    merge hotfix/security-patch
    commit id: "Hotfix v2.0.1"

    checkout develop
    merge main
    commit id: "Sync hotfix to develop"
```

## CI/CD Pipeline Flow

```mermaid
graph TD
    DEV_COMMIT[Developer Commits] --> GIT_PUSH[Git Push to Branch]
    GIT_PUSH --> TRIGGER_CI[Trigger CI Pipeline]

    TRIGGER_CI --> PR_CHECKS{Pull Request?}
    PR_CHECKS -->|Yes| PR_PIPELINE[PR Validation Pipeline]
    PR_CHECKS -->|No| BRANCH_PIPELINE[Branch Pipeline]

    subgraph "Pull Request Pipeline"
        PR_PIPELINE --> PR_LINT[ESLint + Prettier]
        PR_LINT --> PR_TYPE[TypeScript Check]
        PR_TYPE --> PR_TEST[Run Test Suite]
        PR_TEST --> PR_SECURITY[Security Scan]
        PR_SECURITY --> PR_BUILD[Build Validation]
        PR_BUILD --> PR_E2E[E2E Tests]
        PR_E2E --> PR_COVERAGE[Coverage Report]
        PR_COVERAGE --> PR_REVIEW[Code Review Required]
    end

    subgraph "Branch Pipeline"
        BRANCH_PIPELINE --> BRANCH_LINT[ESLint + Prettier]
        BRANCH_LINT --> BRANCH_TYPE[TypeScript Check]
        BRANCH_TYPE --> BRANCH_TEST[Unit + Integration Tests]
        BRANCH_TEST --> BRANCH_BUILD[Build Application]
        BRANCH_BUILD --> BRANCH_DEPLOY[Deploy to Dev Environment]
    end

    PR_REVIEW --> MERGE_DECISION{Approved?}
    MERGE_DECISION -->|No| PR_FEEDBACK[Address Feedback]
    PR_FEEDBACK --> PR_PIPELINE
    MERGE_DECISION -->|Yes| MERGE_TO_DEVELOP[Merge to Develop]

    MERGE_TO_DEVELOP --> DEVELOP_PIPELINE[Develop Pipeline]
    BRANCH_DEPLOY --> DEVELOP_PIPELINE

    subgraph "Develop Pipeline"
        DEVELOP_PIPELINE --> DEV_FULL_TEST[Full Test Suite]
        DEV_FULL_TEST --> DEV_BUILD[Build All Services]
        DEV_BUILD --> DEV_DOCKER[Build Docker Images]
        DEV_DOCKER --> DEV_DEPLOY[Deploy to Staging]
        DEV_DEPLOY --> DEV_E2E[Staging E2E Tests]
        DEV_E2E --> DEV_PERFORMANCE[Performance Tests]
        DEV_PERFORMANCE --> DEV_SECURITY[Security Audit]
    end

    DEV_SECURITY --> RELEASE_READY{Ready for Release?}
    RELEASE_READY -->|No| CONTINUE_DEV[Continue Development]
    RELEASE_READY -->|Yes| CREATE_RELEASE[Create Release Branch]

    CREATE_RELEASE --> RELEASE_PIPELINE[Release Pipeline]

    subgraph "Release Pipeline"
        RELEASE_PIPELINE --> REL_FREEZE[Code Freeze]
        REL_FREEZE --> REL_DOCS[Update Documentation]
        REL_DOCS --> REL_VERSION[Version Bump]
        REL_VERSION --> REL_BUILD[Production Build]
        REL_BUILD --> REL_TEST[Final Testing]
        REL_TEST --> REL_APPROVE[Release Approval]
    end

    REL_APPROVE --> PROD_DEPLOY[Deploy to Production]

    subgraph "Production Deployment"
        PROD_DEPLOY --> PROD_BACKUP[Backup Current Version]
        PROD_BACKUP --> PROD_DEPLOY_APP[Deploy Application]
        PROD_DEPLOY_APP --> PROD_SMOKE[Smoke Tests]
        PROD_SMOKE --> PROD_MONITOR[Monitor Deployment]
        PROD_MONITOR --> PROD_VERIFY[Verify Health Checks]
    end

    PROD_VERIFY --> DEPLOYMENT_SUCCESS{Deployment Successful?}
    DEPLOYMENT_SUCCESS -->|No| ROLLBACK[Automatic Rollback]
    DEPLOYMENT_SUCCESS -->|Yes| RELEASE_COMPLETE[Release Complete]

    ROLLBACK --> INCIDENT_RESPONSE[Incident Response]
    RELEASE_COMPLETE --> POST_DEPLOY[Post-Deployment Tasks]

    classDef trigger fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef pipeline fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef decision fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef deploy fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef error fill:#ffebee,stroke:#f44336,stroke-width:2px

    class DEV_COMMIT,GIT_PUSH,TRIGGER_CI trigger
    class PR_PIPELINE,BRANCH_PIPELINE,DEVELOP_PIPELINE,RELEASE_PIPELINE pipeline
    class PR_CHECKS,MERGE_DECISION,RELEASE_READY,DEPLOYMENT_SUCCESS decision
    class MERGE_TO_DEVELOP,DEV_DEPLOY,PROD_DEPLOY,RELEASE_COMPLETE deploy
    class ROLLBACK,INCIDENT_RESPONSE error
```

## Testing Strategy Flow

```mermaid
graph TD
    CODE_CHANGE[Code Changes] --> TEST_STRATEGY{Testing Strategy}

    TEST_STRATEGY --> UNIT_TESTS[Unit Tests<br/>Individual Components]
    TEST_STRATEGY --> INTEGRATION_TESTS[Integration Tests<br/>Component Interaction]
    TEST_STRATEGY --> E2E_TESTS[E2E Tests<br/>Full User Flows]

    subgraph "Unit Testing Layer"
        UNIT_TESTS --> UNIT_BACKEND[Backend Unit Tests<br/>Services, Controllers, Utils]
        UNIT_TESTS --> UNIT_FRONTEND[Frontend Unit Tests<br/>Components, Hooks, Utils]
        UNIT_TESTS --> UNIT_SHARED[Shared Unit Tests<br/>Types, Validators]

        UNIT_BACKEND --> UNIT_RESULTS[Unit Test Results]
        UNIT_FRONTEND --> UNIT_RESULTS
        UNIT_SHARED --> UNIT_RESULTS
    end

    subgraph "Integration Testing Layer"
        INTEGRATION_TESTS --> INT_API[API Integration Tests<br/>Route → Service → DB]
        INTEGRATION_TESTS --> INT_DB[Database Tests<br/>Migrations, Queries]
        INTEGRATION_TESTS --> INT_EXTERNAL[External Service Tests<br/>Plex, TMDB, YouTube]
        INTEGRATION_TESTS --> INT_REALTIME[Real-time Tests<br/>WebSocket Communication]

        INT_API --> INT_RESULTS[Integration Results]
        INT_DB --> INT_RESULTS
        INT_EXTERNAL --> INT_RESULTS
        INT_REALTIME --> INT_RESULTS
    end

    subgraph "E2E Testing Layer"
        E2E_TESTS --> E2E_USER_FLOWS[User Journey Tests<br/>Complete Workflows]
        E2E_TESTS --> E2E_CROSS_BROWSER[Cross-Browser Tests<br/>Chrome, Firefox, Safari]
        E2E_TESTS --> E2E_MOBILE[Mobile Tests<br/>Responsive Design]
        E2E_TESTS --> E2E_PERFORMANCE[Performance Tests<br/>Load & Stress Testing]

        E2E_USER_FLOWS --> E2E_RESULTS[E2E Results]
        E2E_CROSS_BROWSER --> E2E_RESULTS
        E2E_MOBILE --> E2E_RESULTS
        E2E_PERFORMANCE --> E2E_RESULTS
    end

    UNIT_RESULTS --> COVERAGE_ANALYSIS[Coverage Analysis]
    INT_RESULTS --> COVERAGE_ANALYSIS
    E2E_RESULTS --> COVERAGE_ANALYSIS

    COVERAGE_ANALYSIS --> COVERAGE_REPORT[Coverage Report<br/>80%+ Target]

    COVERAGE_REPORT --> QUALITY_GATES{Quality Gates}
    QUALITY_GATES -->|Pass| TESTS_PASS[All Tests Pass]
    QUALITY_GATES -->|Fail| TESTS_FAIL[Tests Failed]

    TESTS_FAIL --> FIX_ISSUES[Fix Issues]
    FIX_ISSUES --> CODE_CHANGE

    TESTS_PASS --> SECURITY_TESTS[Security Tests]

    subgraph "Security Testing"
        SECURITY_TESTS --> SEC_STATIC[Static Analysis<br/>ESLint Security Rules]
        SECURITY_TESTS --> SEC_DEPS[Dependency Audit<br/>npm audit + Snyk]
        SECURITY_TESTS --> SEC_DYNAMIC[Dynamic Testing<br/>OWASP ZAP]
        SECURITY_TESTS --> SEC_SECRETS[Secret Scanning<br/>GitLeaks]

        SEC_STATIC --> SEC_RESULTS[Security Results]
        SEC_DEPS --> SEC_RESULTS
        SEC_DYNAMIC --> SEC_RESULTS
        SEC_SECRETS --> SEC_RESULTS
    end

    SEC_RESULTS --> DEPLOYMENT_READY[Ready for Deployment]

    classDef input fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef unit fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef integration fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef e2e fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef security fill:#ffebee,stroke:#f44336,stroke-width:2px
    classDef output fill:#e0f2f1,stroke:#00695c,stroke-width:2px

    class CODE_CHANGE,TEST_STRATEGY input
    class UNIT_TESTS,UNIT_BACKEND,UNIT_FRONTEND,UNIT_SHARED,UNIT_RESULTS unit
    class INTEGRATION_TESTS,INT_API,INT_DB,INT_EXTERNAL,INT_REALTIME,INT_RESULTS integration
    class E2E_TESTS,E2E_USER_FLOWS,E2E_CROSS_BROWSER,E2E_MOBILE,E2E_PERFORMANCE,E2E_RESULTS e2e
    class SECURITY_TESTS,SEC_STATIC,SEC_DEPS,SEC_DYNAMIC,SEC_SECRETS,SEC_RESULTS security
    class COVERAGE_ANALYSIS,COVERAGE_REPORT,TESTS_PASS,DEPLOYMENT_READY output
```

## Development Environment Setup

```mermaid
flowchart TD
    START([New Developer Onboarding]) --> PREREQ[Check Prerequisites]

    PREREQ --> NODE_CHECK{Node.js 20+?}
    NODE_CHECK -->|No| INSTALL_NODE[Install Node.js 20+]
    NODE_CHECK -->|Yes| DOCKER_CHECK{Docker Installed?}

    INSTALL_NODE --> DOCKER_CHECK
    DOCKER_CHECK -->|No| INSTALL_DOCKER[Install Docker Desktop]
    DOCKER_CHECK -->|Yes| GIT_CHECK{Git Configured?}

    INSTALL_DOCKER --> GIT_CHECK
    GIT_CHECK -->|No| CONFIGURE_GIT[Configure Git]
    GIT_CHECK -->|Yes| CLONE_REPO[Clone Repository]

    CONFIGURE_GIT --> CLONE_REPO
    CLONE_REPO --> SETUP_ENV[Setup Environment Files]

    subgraph "Environment Configuration"
        SETUP_ENV --> COPY_ENV[Copy .env.example to .env]
        COPY_ENV --> CONFIG_DB[Configure Database URLs]
        CONFIG_DB --> CONFIG_REDIS[Configure Redis URLs]
        CONFIG_REDIS --> CONFIG_EXTERNAL[Configure External APIs]
        CONFIG_EXTERNAL --> CONFIG_JWT[Generate JWT Secrets]
    end

    CONFIG_JWT --> INSTALL_DEPS[Install Dependencies]

    subgraph "Dependency Installation"
        INSTALL_DEPS --> INSTALL_ROOT[npm install (root)]
        INSTALL_ROOT --> INSTALL_BACKEND[npm install (backend)]
        INSTALL_BACKEND --> INSTALL_FRONTEND[npm install (frontend)]
        INSTALL_FRONTEND --> INSTALL_SHARED[npm install (shared)]
    end

    INSTALL_SHARED --> START_SERVICES[Start Development Services]

    subgraph "Service Startup"
        START_SERVICES --> START_DB[Start PostgreSQL Container]
        START_DB --> START_REDIS[Start Redis Container]
        START_REDIS --> RUN_MIGRATIONS[Run Database Migrations]
        RUN_MIGRATIONS --> SEED_DATA[Seed Development Data]
    end

    SEED_DATA --> START_DEV[Start Development Servers]

    subgraph "Development Servers"
        START_DEV --> START_BACKEND[npm run dev:backend]
        START_DEV --> START_FRONTEND[npm run dev:frontend]
        START_BACKEND --> BACKEND_READY[Backend: localhost:8081]
        START_FRONTEND --> FRONTEND_READY[Frontend: localhost:3001]
    end

    BACKEND_READY --> VERIFY_SETUP[Verify Setup]
    FRONTEND_READY --> VERIFY_SETUP

    subgraph "Setup Verification"
        VERIFY_SETUP --> TEST_HEALTH[Test Health Endpoints]
        TEST_HEALTH --> TEST_AUTH[Test Authentication]
        TEST_AUTH --> TEST_DB[Test Database Connection]
        TEST_DB --> RUN_TESTS[Run Test Suite]
    end

    RUN_TESTS --> SETUP_COMPLETE{Setup Successful?}
    SETUP_COMPLETE -->|No| TROUBLESHOOT[Troubleshoot Issues]
    SETUP_COMPLETE -->|Yes| DEV_READY[Development Ready!]

    TROUBLESHOOT --> CHECK_LOGS[Check Logs]
    CHECK_LOGS --> CHECK_PORTS[Check Port Conflicts]
    CHECK_PORTS --> CHECK_ENV[Verify Environment Variables]
    CHECK_ENV --> RESTART_SERVICES[Restart Services]
    RESTART_SERVICES --> VERIFY_SETUP

    DEV_READY --> WORKFLOW_GUIDE[Show Development Workflow]

    subgraph "Development Workflow Guide"
        WORKFLOW_GUIDE --> CREATE_BRANCH[Create Feature Branch]
        CREATE_BRANCH --> MAKE_CHANGES[Make Code Changes]
        MAKE_CHANGES --> RUN_LINTING[Run Linting/Formatting]
        RUN_LINTING --> RUN_UNIT_TESTS[Run Unit Tests]
        RUN_UNIT_TESTS --> COMMIT_CHANGES[Commit Changes]
        COMMIT_CHANGES --> PUSH_BRANCH[Push Branch]
        PUSH_BRANCH --> CREATE_PR[Create Pull Request]
    end

    classDef start fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef check fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef install fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef config fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef service fill:#e0f2f1,stroke:#00695c,stroke-width:2px
    classDef verify fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef complete fill:#e8f5e8,stroke:#4caf50,stroke-width:2px

    class START,DEV_READY,WORKFLOW_GUIDE start
    class NODE_CHECK,DOCKER_CHECK,GIT_CHECK,SETUP_COMPLETE check
    class INSTALL_NODE,INSTALL_DOCKER,INSTALL_DEPS,INSTALL_ROOT,INSTALL_BACKEND,INSTALL_FRONTEND,INSTALL_SHARED install
    class SETUP_ENV,COPY_ENV,CONFIG_DB,CONFIG_REDIS,CONFIG_EXTERNAL,CONFIG_JWT config
    class START_SERVICES,START_DB,START_REDIS,RUN_MIGRATIONS,SEED_DATA,START_DEV,START_BACKEND,START_FRONTEND service
    class VERIFY_SETUP,TEST_HEALTH,TEST_AUTH,TEST_DB,RUN_TESTS verify
    class CREATE_BRANCH,MAKE_CHANGES,RUN_LINTING,RUN_UNIT_TESTS,COMMIT_CHANGES,PUSH_BRANCH,CREATE_PR complete
```

## Code Review Process

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant Git as Git Repository
    participant CI as CI Pipeline
    participant Rev as Code Reviewer
    participant PM as Project Maintainer
    participant Auto as Automated Tools

    Dev->>Git: Push feature branch
    Git->>CI: Trigger CI pipeline

    CI->>Auto: Run automated checks
    Auto->>Auto: ESLint + Prettier
    Auto->>Auto: TypeScript compilation
    Auto->>Auto: Unit tests
    Auto->>Auto: Security scan
    Auto->>Auto: Dependency audit
    Auto-->>CI: All checks pass

    CI->>Git: Update PR status
    Git->>Rev: Notify reviewer

    Rev->>Git: Review code changes

    alt Code Review Feedback
        Rev->>Git: Request changes
        Git->>Dev: Notification
        Dev->>Dev: Address feedback
        Dev->>Git: Push updates
        Git->>CI: Re-run checks
        CI->>Rev: Ready for re-review
    else Code Approved
        Rev->>Git: Approve PR
    end

    Git->>PM: Request final approval
    PM->>Git: Review and approve

    PM->>Git: Merge to develop
    Git->>CI: Trigger deploy pipeline
    CI->>CI: Deploy to staging
    CI->>Auto: Run E2E tests
    Auto-->>CI: Tests pass

    CI->>Dev: Deployment successful
    Dev->>Git: Delete feature branch
```
