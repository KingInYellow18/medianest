# Performance Monitoring Diagrams

## Performance Metrics Collection Flow

```mermaid
graph TD
    subgraph "Application Layer Metrics"
        EXPRESS[Express.js Application]
        MIDDLEWARE[Performance Middleware]
        ROUTES[API Routes]
        WEBSOCKET[Socket.IO Server]

        EXPRESS --> MIDDLEWARE
        MIDDLEWARE --> ROUTES
        EXPRESS --> WEBSOCKET
    end

    subgraph "Infrastructure Metrics"
        NODE_METRICS[Node.js Process Metrics]
        CONTAINER_METRICS[Container Metrics]
        SYSTEM_METRICS[System Metrics]
        NETWORK_METRICS[Network Metrics]
    end

    subgraph "Database Metrics"
        PG_METRICS[PostgreSQL Metrics]
        REDIS_METRICS[Redis Metrics]
        QUERY_METRICS[Query Performance]
        CONNECTION_METRICS[Connection Pool Metrics]
    end

    subgraph "External Service Metrics"
        PLEX_METRICS[Plex API Metrics]
        TMDB_METRICS[TMDB API Metrics]
        YOUTUBE_METRICS[YouTube API Metrics]
        OVERSEERR_METRICS[Overseerr Metrics]
    end

    subgraph "Custom Business Metrics"
        USER_METRICS[User Activity Metrics]
        MEDIA_METRICS[Media Request Metrics]
        DOWNLOAD_METRICS[Download Performance]
        ERROR_METRICS[Error Rate Metrics]
    end

    subgraph "Metrics Collection & Storage"
        PROMETHEUS[Prometheus Server]
        GRAFANA[Grafana Dashboard]
        ALERTMANAGER[Alert Manager]
        PUSHGATEWAY[Push Gateway]
    end

    subgraph "Alerting & Notification"
        SLACK[Slack Notifications]
        EMAIL[Email Alerts]
        WEBHOOK[Webhook Endpoints]
        PAGERDUTY[PagerDuty Integration]
    end

    %% Application Metrics Flow
    MIDDLEWARE --> PROMETHEUS
    ROUTES --> PROMETHEUS
    WEBSOCKET --> PROMETHEUS

    %% Infrastructure Metrics Flow
    NODE_METRICS --> PROMETHEUS
    CONTAINER_METRICS --> PROMETHEUS
    SYSTEM_METRICS --> PROMETHEUS
    NETWORK_METRICS --> PROMETHEUS

    %% Database Metrics Flow
    PG_METRICS --> PROMETHEUS
    REDIS_METRICS --> PROMETHEUS
    QUERY_METRICS --> PROMETHEUS
    CONNECTION_METRICS --> PROMETHEUS

    %% External Service Metrics Flow
    PLEX_METRICS --> PUSHGATEWAY
    TMDB_METRICS --> PUSHGATEWAY
    YOUTUBE_METRICS --> PUSHGATEWAY
    OVERSEERR_METRICS --> PUSHGATEWAY
    PUSHGATEWAY --> PROMETHEUS

    %% Custom Metrics Flow
    USER_METRICS --> PROMETHEUS
    MEDIA_METRICS --> PROMETHEUS
    DOWNLOAD_METRICS --> PROMETHEUS
    ERROR_METRICS --> PROMETHEUS

    %% Dashboard & Alerting Flow
    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTMANAGER

    ALERTMANAGER --> SLACK
    ALERTMANAGER --> EMAIL
    ALERTMANAGER --> WEBHOOK
    ALERTMANAGER --> PAGERDUTY

    classDef application fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef infrastructure fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef database fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef external fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef business fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef monitoring fill:#e0f2f1,stroke:#00695c,stroke-width:2px
    classDef alerting fill:#ffebee,stroke:#f44336,stroke-width:2px

    class EXPRESS,MIDDLEWARE,ROUTES,WEBSOCKET application
    class NODE_METRICS,CONTAINER_METRICS,SYSTEM_METRICS,NETWORK_METRICS infrastructure
    class PG_METRICS,REDIS_METRICS,QUERY_METRICS,CONNECTION_METRICS database
    class PLEX_METRICS,TMDB_METRICS,YOUTUBE_METRICS,OVERSEERR_METRICS external
    class USER_METRICS,MEDIA_METRICS,DOWNLOAD_METRICS,ERROR_METRICS business
    class PROMETHEUS,GRAFANA,PUSHGATEWAY monitoring
    class ALERTMANAGER,SLACK,EMAIL,WEBHOOK,PAGERDUTY alerting
```

## Real-time Performance Dashboard

```mermaid
graph TD
    subgraph "Dashboard Layout"
        subgraph "System Health Overview"
            CPU_GAUGE[CPU Usage Gauge<br/>0-100%]
            MEMORY_GAUGE[Memory Usage Gauge<br/>0-100%]
            DISK_GAUGE[Disk Usage Gauge<br/>0-100%]
            UPTIME[System Uptime<br/>Days:Hours:Minutes]
        end

        subgraph "Application Performance"
            RESPONSE_TIME[Response Time<br/>95th Percentile]
            THROUGHPUT[Requests per Second<br/>Real-time Graph]
            ERROR_RATE[Error Rate %<br/>Last 5 minutes]
            ACTIVE_USERS[Active Users<br/>WebSocket Connections]
        end

        subgraph "Database Performance"
            DB_CONNECTIONS[Active Connections<br/>Pool Usage]
            QUERY_TIME[Average Query Time<br/>Last 100 queries]
            SLOW_QUERIES[Slow Queries<br/>Queries > 1s]
            CACHE_HIT_RATE[Redis Cache Hit Rate<br/>%]
        end

        subgraph "Business Metrics"
            MEDIA_REQUESTS[Media Requests<br/>Today/This Week]
            DOWNLOAD_QUEUE[Download Queue Size<br/>Pending/In Progress]
            USER_ACTIVITY[User Activity<br/>Login/Actions]
            SERVICE_STATUS[External Services<br/>Health Status]
        end

        subgraph "Alerts & Incidents"
            ACTIVE_ALERTS[Active Alerts<br/>Critical/Warning]
            RECENT_INCIDENTS[Recent Incidents<br/>Last 24 hours]
            SLA_STATUS[SLA Status<br/>Uptime %]
            PERFORMANCE_TRENDS[Performance Trends<br/>Week over Week]
        end
    end

    subgraph "Data Sources"
        PROMETHEUS_DS[Prometheus Data Source]
        LOKI[Loki Log Data]
        JAEGER_DS[Jaeger Tracing Data]
        CUSTOM_METRICS[Custom Application Metrics]
    end

    %% Data Flow to Dashboard Components
    PROMETHEUS_DS --> CPU_GAUGE
    PROMETHEUS_DS --> MEMORY_GAUGE
    PROMETHEUS_DS --> DISK_GAUGE
    PROMETHEUS_DS --> UPTIME

    PROMETHEUS_DS --> RESPONSE_TIME
    PROMETHEUS_DS --> THROUGHPUT
    PROMETHEUS_DS --> ERROR_RATE
    PROMETHEUS_DS --> ACTIVE_USERS

    PROMETHEUS_DS --> DB_CONNECTIONS
    PROMETHEUS_DS --> QUERY_TIME
    PROMETHEUS_DS --> SLOW_QUERIES
    PROMETHEUS_DS --> CACHE_HIT_RATE

    CUSTOM_METRICS --> MEDIA_REQUESTS
    CUSTOM_METRICS --> DOWNLOAD_QUEUE
    CUSTOM_METRICS --> USER_ACTIVITY
    CUSTOM_METRICS --> SERVICE_STATUS

    PROMETHEUS_DS --> ACTIVE_ALERTS
    LOKI --> RECENT_INCIDENTS
    PROMETHEUS_DS --> SLA_STATUS
    PROMETHEUS_DS --> PERFORMANCE_TRENDS

    classDef overview fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef performance fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef database fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef business fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef alerts fill:#ffebee,stroke:#f44336,stroke-width:2px
    classDef datasource fill:#e0f2f1,stroke:#00695c,stroke-width:2px

    class CPU_GAUGE,MEMORY_GAUGE,DISK_GAUGE,UPTIME overview
    class RESPONSE_TIME,THROUGHPUT,ERROR_RATE,ACTIVE_USERS performance
    class DB_CONNECTIONS,QUERY_TIME,SLOW_QUERIES,CACHE_HIT_RATE database
    class MEDIA_REQUESTS,DOWNLOAD_QUEUE,USER_ACTIVITY,SERVICE_STATUS business
    class ACTIVE_ALERTS,RECENT_INCIDENTS,SLA_STATUS,PERFORMANCE_TRENDS alerts
    class PROMETHEUS_DS,LOKI,JAEGER_DS,CUSTOM_METRICS datasource
```

## Performance Alert Flow

```mermaid
graph TD
    METRICS_COLLECTION[Metrics Collection] --> PROMETHEUS[Prometheus Server]
    PROMETHEUS --> ALERT_RULES[Alert Rules Evaluation]

    subgraph "Alert Rule Categories"
        ALERT_RULES --> INFRA_ALERTS[Infrastructure Alerts<br/>CPU, Memory, Disk]
        ALERT_RULES --> APP_ALERTS[Application Alerts<br/>Response Time, Error Rate]
        ALERT_RULES --> DB_ALERTS[Database Alerts<br/>Connections, Query Time]
        ALERT_RULES --> BUSINESS_ALERTS[Business Alerts<br/>Queue Size, Service Health]
    end

    INFRA_ALERTS --> ALERT_MANAGER[AlertManager]
    APP_ALERTS --> ALERT_MANAGER
    DB_ALERTS --> ALERT_MANAGER
    BUSINESS_ALERTS --> ALERT_MANAGER

    ALERT_MANAGER --> SEVERITY_ROUTING{Alert Severity}

    SEVERITY_ROUTING -->|Critical| CRITICAL_FLOW[Critical Alert Flow]
    SEVERITY_ROUTING -->|Warning| WARNING_FLOW[Warning Alert Flow]
    SEVERITY_ROUTING -->|Info| INFO_FLOW[Info Alert Flow]

    subgraph "Critical Alert Flow"
        CRITICAL_FLOW --> PAGERDUTY_CRITICAL[PagerDuty Immediate]
        CRITICAL_FLOW --> SLACK_CRITICAL[Slack #critical-alerts]
        CRITICAL_FLOW --> EMAIL_ONCALL[Email On-Call Team]
        CRITICAL_FLOW --> AUTO_SCALE[Auto-scaling Trigger]

        PAGERDUTY_CRITICAL --> INCIDENT_CREATION[Create Incident]
        INCIDENT_CREATION --> ESCALATION[Escalation Policy]
    end

    subgraph "Warning Alert Flow"
        WARNING_FLOW --> SLACK_WARNING[Slack #alerts]
        WARNING_FLOW --> EMAIL_TEAM[Email Dev Team]
        WARNING_FLOW --> INVESTIGATE[Automated Investigation]

        INVESTIGATE --> AUTO_REMEDIATION{Auto-Remediation?}
        AUTO_REMEDIATION -->|Yes| REMEDIATION_ACTION[Execute Remediation]
        AUTO_REMEDIATION -->|No| MANUAL_REVIEW[Manual Review Required]
    end

    subgraph "Info Alert Flow"
        INFO_FLOW --> SLACK_INFO[Slack #monitoring]
        INFO_FLOW --> DASHBOARD_UPDATE[Update Dashboard]
        INFO_FLOW --> LOG_AGGREGATION[Log to Aggregation System]
    end

    subgraph "Alert Resolution"
        REMEDIATION_ACTION --> VERIFY_FIX[Verify Fix]
        MANUAL_REVIEW --> HUMAN_ACTION[Human Intervention]
        HUMAN_ACTION --> VERIFY_FIX

        VERIFY_FIX --> RESOLUTION_CHECK{Issue Resolved?}
        RESOLUTION_CHECK -->|Yes| CLOSE_ALERT[Close Alert]
        RESOLUTION_CHECK -->|No| ESCALATE_ALERT[Escalate Alert]

        CLOSE_ALERT --> POST_MORTEM[Post-Mortem Analysis]
        ESCALATE_ALERT --> CRITICAL_FLOW
    end

    classDef collection fill:#e8f5e8,stroke:#4caf50,stroke-width:2px
    classDef processing fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    classDef critical fill:#ffebee,stroke:#f44336,stroke-width:2px
    classDef warning fill:#fff3e0,stroke:#ff9800,stroke-width:2px
    classDef info fill:#e0f2f1,stroke:#00695c,stroke-width:2px
    classDef resolution fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px

    class METRICS_COLLECTION,PROMETHEUS collection
    class ALERT_RULES,INFRA_ALERTS,APP_ALERTS,DB_ALERTS,BUSINESS_ALERTS,ALERT_MANAGER,SEVERITY_ROUTING processing
    class CRITICAL_FLOW,PAGERDUTY_CRITICAL,SLACK_CRITICAL,EMAIL_ONCALL,AUTO_SCALE,INCIDENT_CREATION,ESCALATION critical
    class WARNING_FLOW,SLACK_WARNING,EMAIL_TEAM,INVESTIGATE,AUTO_REMEDIATION,REMEDIATION_ACTION,MANUAL_REVIEW warning
    class INFO_FLOW,SLACK_INFO,DASHBOARD_UPDATE,LOG_AGGREGATION info
    class VERIFY_FIX,HUMAN_ACTION,RESOLUTION_CHECK,CLOSE_ALERT,ESCALATE_ALERT,POST_MORTEM resolution
```

## Performance Optimization Workflow

```mermaid
graph TD
    PERFORMANCE_ISSUE[Performance Issue Detected] --> INITIAL_ANALYSIS[Initial Analysis]

    INITIAL_ANALYSIS --> METRIC_REVIEW[Review Metrics]
    METRIC_REVIEW --> IDENTIFY_BOTTLENECK[Identify Bottleneck]

    IDENTIFY_BOTTLENECK --> BOTTLENECK_TYPE{Bottleneck Type}

    BOTTLENECK_TYPE -->|CPU| CPU_OPTIMIZATION[CPU Optimization]
    BOTTLENECK_TYPE -->|Memory| MEMORY_OPTIMIZATION[Memory Optimization]
    BOTTLENECK_TYPE -->|Database| DB_OPTIMIZATION[Database Optimization]
    BOTTLENECK_TYPE -->|Network| NETWORK_OPTIMIZATION[Network Optimization]
    BOTTLENECK_TYPE -->|Application| APP_OPTIMIZATION[Application Optimization]

    subgraph "CPU Optimization"
        CPU_OPTIMIZATION --> CPU_PROFILING[CPU Profiling]
        CPU_PROFILING --> ALGORITHM_REVIEW[Algorithm Review]
        ALGORITHM_REVIEW --> CODE_OPTIMIZATION[Code Optimization]
        CODE_OPTIMIZATION --> ASYNC_PATTERNS[Async Patterns]
        ASYNC_PATTERNS --> CPU_SCALING[Horizontal Scaling]
    end

    subgraph "Memory Optimization"
        MEMORY_OPTIMIZATION --> MEMORY_PROFILING[Memory Profiling]
        MEMORY_PROFILING --> LEAK_DETECTION[Memory Leak Detection]
        LEAK_DETECTION --> GARBAGE_COLLECTION[GC Optimization]
        GARBAGE_COLLECTION --> CACHING_STRATEGY[Caching Strategy]
        CACHING_STRATEGY --> MEMORY_SCALING[Memory Scaling]
    end

    subgraph "Database Optimization"
        DB_OPTIMIZATION --> QUERY_ANALYSIS[Query Analysis]
        QUERY_ANALYSIS --> INDEX_OPTIMIZATION[Index Optimization]
        INDEX_OPTIMIZATION --> CONNECTION_POOLING[Connection Pooling]
        CONNECTION_POOLING --> READ_REPLICAS[Read Replicas]
        READ_REPLICAS --> QUERY_CACHING[Query Caching]
    end

    subgraph "Network Optimization"
        NETWORK_OPTIMIZATION --> BANDWIDTH_ANALYSIS[Bandwidth Analysis]
        BANDWIDTH_ANALYSIS --> COMPRESSION[Response Compression]
        COMPRESSION --> CDN_OPTIMIZATION[CDN Optimization]
        CDN_OPTIMIZATION --> KEEP_ALIVE[Connection Keep-Alive]
        KEEP_ALIVE --> LOAD_BALANCING[Load Balancing]
    end

    subgraph "Application Optimization"
        APP_OPTIMIZATION --> CODE_PROFILING[Code Profiling]
        CODE_PROFILING --> HOT_PATHS[Hot Path Analysis]
        HOT_PATHS --> MIDDLEWARE_OPT[Middleware Optimization]
        MIDDLEWARE_OPT --> ROUTE_OPTIMIZATION[Route Optimization]
        ROUTE_OPTIMIZATION --> BUNDLE_OPTIMIZATION[Bundle Optimization]
    end

    CPU_SCALING --> IMPLEMENT_SOLUTION[Implement Solution]
    MEMORY_SCALING --> IMPLEMENT_SOLUTION
    QUERY_CACHING --> IMPLEMENT_SOLUTION
    LOAD_BALANCING --> IMPLEMENT_SOLUTION
    BUNDLE_OPTIMIZATION --> IMPLEMENT_SOLUTION

    IMPLEMENT_SOLUTION --> TESTING_PHASE[Testing Phase]

    subgraph "Performance Testing"
        TESTING_PHASE --> LOAD_TESTING[Load Testing]
        LOAD_TESTING --> STRESS_TESTING[Stress Testing]
        STRESS_TESTING --> SPIKE_TESTING[Spike Testing]
        SPIKE_TESTING --> ENDURANCE_TESTING[Endurance Testing]
    end

    ENDURANCE_TESTING --> MEASURE_IMPROVEMENT[Measure Improvement]
    MEASURE_IMPROVEMENT --> IMPROVEMENT_CHECK{Performance Improved?}

    IMPROVEMENT_CHECK -->|Yes| DEPLOY_OPTIMIZATION[Deploy Optimization]
    IMPROVEMENT_CHECK -->|No| ROLLBACK_CHANGES[Rollback Changes]

    ROLLBACK_CHANGES --> ALTERNATIVE_APPROACH[Try Alternative Approach]
    ALTERNATIVE_APPROACH --> BOTTLENECK_TYPE

    DEPLOY_OPTIMIZATION --> MONITOR_PRODUCTION[Monitor Production]
    MONITOR_PRODUCTION --> CONTINUOUS_MONITORING[Continuous Monitoring]

    CONTINUOUS_MONITORING --> PERFORMANCE_BASELINE[Update Performance Baseline]
    PERFORMANCE_BASELINE --> DOCUMENTATION[Document Optimization]

    classDef analysis fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef optimization fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef testing fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef deployment fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef monitoring fill:#e0f2f1,stroke:#00695c,stroke-width:2px

    class PERFORMANCE_ISSUE,INITIAL_ANALYSIS,METRIC_REVIEW,IDENTIFY_BOTTLENECK,BOTTLENECK_TYPE analysis
    class CPU_OPTIMIZATION,MEMORY_OPTIMIZATION,DB_OPTIMIZATION,NETWORK_OPTIMIZATION,APP_OPTIMIZATION,CPU_PROFILING,MEMORY_PROFILING,QUERY_ANALYSIS,BANDWIDTH_ANALYSIS,CODE_PROFILING optimization
    class TESTING_PHASE,LOAD_TESTING,STRESS_TESTING,SPIKE_TESTING,ENDURANCE_TESTING,MEASURE_IMPROVEMENT testing
    class IMPLEMENT_SOLUTION,DEPLOY_OPTIMIZATION,ROLLBACK_CHANGES,ALTERNATIVE_APPROACH deployment
    class MONITOR_PRODUCTION,CONTINUOUS_MONITORING,PERFORMANCE_BASELINE,DOCUMENTATION monitoring
```

## Load Testing Architecture

```mermaid
graph TD
    subgraph "Load Testing Setup"
        TEST_SCENARIOS[Test Scenarios<br/>User Journey Scripts]
        TEST_DATA[Test Data<br/>Mock Users & Content]
        LOAD_CONFIG[Load Configuration<br/>Ramp-up Patterns]
    end

    subgraph "Load Testing Tools"
        ARTILLERY[Artillery.js<br/>HTTP Load Testing]
        K6[K6<br/>Performance Testing]
        PLAYWRIGHT[Playwright<br/>E2E Load Testing]
        CUSTOM_SCRIPTS[Custom Load Scripts<br/>Node.js/Python]
    end

    subgraph "Test Environments"
        STAGING[Staging Environment<br/>Production-like Setup]
        PERF_ENV[Performance Environment<br/>Dedicated Testing]
        PROD_MONITORING[Production Monitoring<br/>Real-user Metrics]
    end

    subgraph "Target Application"
        LOAD_BALANCER[Load Balancer<br/>Nginx/ALB]
        FRONTEND_CLUSTER[Frontend Cluster<br/>Next.js Instances]
        BACKEND_CLUSTER[Backend Cluster<br/>Express.js Instances]
        DATABASE_CLUSTER[Database Cluster<br/>PostgreSQL + Redis]
    end

    subgraph "Metrics Collection"
        RESPONSE_TIMES[Response Times<br/>P50, P95, P99]
        THROUGHPUT_METRICS[Throughput<br/>RPS, Concurrent Users]
        ERROR_RATES[Error Rates<br/>4xx, 5xx Responses]
        RESOURCE_USAGE[Resource Usage<br/>CPU, Memory, Network]
    end

    subgraph "Load Testing Patterns"
        RAMP_UP[Ramp-up Testing<br/>Gradual Load Increase]
        SPIKE_TEST[Spike Testing<br/>Sudden Load Spikes]
        SOAK_TEST[Soak Testing<br/>Extended Duration]
        VOLUME_TEST[Volume Testing<br/>Large Data Sets]
    end

    %% Test Execution Flow
    TEST_SCENARIOS --> ARTILLERY
    TEST_SCENARIOS --> K6
    TEST_SCENARIOS --> PLAYWRIGHT
    TEST_SCENARIOS --> CUSTOM_SCRIPTS

    TEST_DATA --> ARTILLERY
    TEST_DATA --> K6
    TEST_DATA --> PLAYWRIGHT

    LOAD_CONFIG --> ARTILLERY
    LOAD_CONFIG --> K6
    LOAD_CONFIG --> CUSTOM_SCRIPTS

    %% Target Environment
    ARTILLERY --> STAGING
    K6 --> STAGING
    PLAYWRIGHT --> STAGING
    CUSTOM_SCRIPTS --> PERF_ENV

    %% Application Under Test
    STAGING --> LOAD_BALANCER
    PERF_ENV --> LOAD_BALANCER

    LOAD_BALANCER --> FRONTEND_CLUSTER
    LOAD_BALANCER --> BACKEND_CLUSTER
    BACKEND_CLUSTER --> DATABASE_CLUSTER

    %% Metrics Flow
    FRONTEND_CLUSTER --> RESPONSE_TIMES
    BACKEND_CLUSTER --> RESPONSE_TIMES
    DATABASE_CLUSTER --> RESPONSE_TIMES

    LOAD_BALANCER --> THROUGHPUT_METRICS
    BACKEND_CLUSTER --> ERROR_RATES
    DATABASE_CLUSTER --> RESOURCE_USAGE

    %% Test Pattern Application
    RAMP_UP --> ARTILLERY
    SPIKE_TEST --> K6
    SOAK_TEST --> CUSTOM_SCRIPTS
    VOLUME_TEST --> PLAYWRIGHT

    %% Results Analysis
    RESPONSE_TIMES --> RESULTS_ANALYSIS[Results Analysis]
    THROUGHPUT_METRICS --> RESULTS_ANALYSIS
    ERROR_RATES --> RESULTS_ANALYSIS
    RESOURCE_USAGE --> RESULTS_ANALYSIS

    RESULTS_ANALYSIS --> PERFORMANCE_REPORT[Performance Report]
    PERFORMANCE_REPORT --> OPTIMIZATION_RECOMMENDATIONS[Optimization Recommendations]

    classDef setup fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef tools fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef environment fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef application fill:#f3e5f5,stroke:#9c27b0,stroke-width:2px
    classDef metrics fill:#fce4ec,stroke:#c2185b,stroke-width:2px
    classDef patterns fill:#e0f2f1,stroke:#00695c,stroke-width:2px
    classDef analysis fill:#e8eaf6,stroke:#3f51b5,stroke-width:2px

    class TEST_SCENARIOS,TEST_DATA,LOAD_CONFIG setup
    class ARTILLERY,K6,PLAYWRIGHT,CUSTOM_SCRIPTS tools
    class STAGING,PERF_ENV,PROD_MONITORING environment
    class LOAD_BALANCER,FRONTEND_CLUSTER,BACKEND_CLUSTER,DATABASE_CLUSTER application
    class RESPONSE_TIMES,THROUGHPUT_METRICS,ERROR_RATES,RESOURCE_USAGE metrics
    class RAMP_UP,SPIKE_TEST,SOAK_TEST,VOLUME_TEST patterns
    class RESULTS_ANALYSIS,PERFORMANCE_REPORT,OPTIMIZATION_RECOMMENDATIONS analysis
```
