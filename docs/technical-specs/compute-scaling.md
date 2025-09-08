# Compute Resource Allocation and Scaling Strategy

## Overview

This document defines the compute architecture and scaling strategy for the MediaNest homelab environment, based on the existing resource constraints discovered in the Docker Compose configurations and enhanced with enterprise-grade scaling capabilities.

## Current Compute Resource Analysis

### Existing Container Resource Limits (From Codebase)

#### PostgreSQL Container
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1G
      pids: 100
    reservations:
      cpus: '0.25'
      memory: 512M
```

#### Redis Container
```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 320M
      pids: 50
    reservations:
      cpus: '0.1'
      memory: 128M
```

#### Application Container
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
      pids: 150
    reservations:
      cpus: '0.5'
      memory: 512M
```

#### Nginx Container
```yaml
deploy:
  resources:
    limits:
      cpus: '0.5'
      memory: 256M
      pids: 50
    reservations:
      cpus: '0.1'
      memory: 64M
```

### Current Total Resource Allocation
- **CPU Limits**: 4.0 cores total
- **Memory Limits**: 2.576 GB total
- **CPU Reservations**: 0.95 cores total
- **Memory Reservations**: 1.216 GB total

## Enhanced Compute Architecture

### Hardware Infrastructure

#### Physical Server Specifications
```yaml
# Primary Compute Node
Server1:
  CPU: "AMD EPYC 7443P (24 cores, 48 threads)"
  Memory: "128GB DDR4 ECC"
  Storage: "2x 1TB NVMe (RAID 1) + 4x 4TB SSD (RAID 10)"
  Network: "2x 10GbE + 1x 1GbE (IPMI)"
  Power: "Dual PSU with UPS backup"

# Secondary Compute Node  
Server2:
  CPU: "AMD EPYC 7413 (24 cores, 48 threads)"
  Memory: "128GB DDR4 ECC"
  Storage: "2x 1TB NVMe (RAID 1) + 4x 4TB SSD (RAID 10)"
  Network: "2x 10GbE + 1x 1GbE (IPMI)"
  Power: "Dual PSU with UPS backup"

# Edge/Management Node
Server3:
  CPU: "AMD Ryzen 7 7700X (8 cores, 16 threads)"
  Memory: "64GB DDR5"
  Storage: "2x 500GB NVMe (RAID 1) + 2x 2TB SSD"
  Network: "1x 2.5GbE + 1x 1GbE (IPMI)"
  Power: "Single PSU with UPS backup"
```

#### Virtualization Strategy
```
┌─────────────────────────────────────────────────────────┐
│                   Proxmox VE Cluster                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │   Server1   │  │   Server2   │  │   Server3   │    │
│  │   (Primary) │  │ (Secondary) │  │ (Management)│    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                Virtual Machine Layout                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Kubernetes  │  │   Docker    │  │ Management  │    │
│  │   Master    │  │   Swarm     │  │   Services  │    │
│  │ (6C/32GB)   │  │ (8C/48GB)   │  │ (4C/16GB)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Kubernetes  │  │   Docker    │  │  Monitoring │    │
│  │   Worker1   │  │   Swarm     │  │   Stack     │    │
│  │ (10C/64GB)  │  │ (8C/48GB)   │  │ (6C/24GB)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Resource Allocation Strategy

### Service-Based Resource Planning

#### Database Tier Resources
```yaml
# PostgreSQL Primary
postgres_primary:
  cpu_limit: "4.0"
  cpu_reservation: "2.0"
  memory_limit: "16G"
  memory_reservation: "8G"
  storage_iops: 3000
  network_bandwidth: "1Gbps"

# PostgreSQL Replica (Read-only)
postgres_replica:
  cpu_limit: "2.0"
  cpu_reservation: "1.0"
  memory_limit: "8G"
  memory_reservation: "4G"
  storage_iops: 1500
  network_bandwidth: "500Mbps"

# Redis Cluster (3 nodes)
redis_cluster:
  per_node:
    cpu_limit: "1.0"
    cpu_reservation: "0.5"
    memory_limit: "4G"
    memory_reservation: "2G"
    storage_iops: 1000
    network_bandwidth: "500Mbps"
```

#### Application Tier Resources
```yaml
# MediaNest Application (Auto-scaling)
medianest_app:
  min_replicas: 2
  max_replicas: 8
  per_replica:
    cpu_limit: "2.0"
    cpu_reservation: "1.0"
    memory_limit: "2G"
    memory_reservation: "1G"
    storage: "1G" # temporary files
    network_bandwidth: "1Gbps"

# Nginx Load Balancer (HA Pair)
nginx_lb:
  replicas: 2
  per_replica:
    cpu_limit: "1.0"
    cpu_reservation: "0.5"
    memory_limit: "512M"
    memory_reservation: "256M"
    network_bandwidth: "2Gbps"
```

#### Monitoring and Management
```yaml
# Prometheus Stack
prometheus:
  cpu_limit: "2.0"
  cpu_reservation: "1.0"
  memory_limit: "8G"
  memory_reservation: "4G"
  storage: "500G" # metrics retention

# Grafana
grafana:
  cpu_limit: "1.0"
  cpu_reservation: "0.5"
  memory_limit: "2G"
  memory_reservation: "1G"

# ElasticSearch (Log aggregation)
elasticsearch:
  replicas: 3
  per_replica:
    cpu_limit: "2.0"
    cpu_reservation: "1.5"
    memory_limit: "8G"
    memory_reservation: "6G"
    storage: "1T" # log retention
```

### Resource Quotas and Limits

#### Kubernetes Resource Quotas
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: medianest-quota
  namespace: medianest
spec:
  hard:
    requests.cpu: "20"
    requests.memory: 64Gi
    limits.cpu: "40"
    limits.memory: 128Gi
    persistentvolumeclaims: "20"
    pods: "50"
    services: "10"
    secrets: "20"
    configmaps: "20"
```

#### LimitRange Configuration
```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: medianest-limits
  namespace: medianest
spec:
  limits:
  - default:
      cpu: "1"
      memory: "2Gi"
    defaultRequest:
      cpu: "500m"
      memory: "1Gi"
    type: Container
  - default:
      storage: "10Gi"
    type: PersistentVolumeClaim
```

## Auto-Scaling Configuration

### Horizontal Pod Autoscaler (HPA)

#### Application Auto-scaling
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: medianest-app-hpa
  namespace: medianest
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: medianest-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: nginx_http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
```

#### Custom Metrics Auto-scaling
```yaml
# Custom metrics for application-specific scaling
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-rules
data:
  medianest.rules: |
    groups:
    - name: medianest.rules
      rules:
      - record: medianest:queue_depth
        expr: sum(redis_list_length{job="redis"}) by (instance)
      
      - record: medianest:response_time_p95
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket{job="medianest-app"})
      
      - record: medianest:error_rate
        expr: sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

### Vertical Pod Autoscaler (VPA)

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: postgres-vpa
  namespace: medianest
spec:
  targetRef:
    apiVersion: apps/v1
    kind: StatefulSet
    name: postgres
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: postgres
      maxAllowed:
        cpu: "8"
        memory: 32Gi
      minAllowed:
        cpu: "1"
        memory: 4Gi
      controlledResources: ["cpu", "memory"]
      controlledValues: RequestsAndLimits
```

## Load Balancing and Traffic Management

### HAProxy Configuration
```
global
    daemon
    user haproxy
    group haproxy
    log stdout local0 info
    stats socket /var/run/haproxy.sock mode 660 level admin
    tune.ssl.default-dh-param 2048

defaults
    mode http
    timeout connect 5s
    timeout client 30s
    timeout server 30s
    option httplog
    option dontlognull
    option forwardfor
    option http-server-close

# Application backend with health checks
backend medianest_app
    balance roundrobin
    option httpchk GET /health HTTP/1.1\r\nHost:\ localhost
    http-check expect status 200
    default-server check maxconn 500 weight 100
    
    # Primary application servers
    server app1 10.0.10.10:3000 check
    server app2 10.0.10.11:3000 check
    server app3 10.0.10.12:3000 check backup
    
    # Auto-scaled instances (dynamic)
    server-template app 5 10.0.10.20:3000 check disabled

# Database connection pooling
backend postgres_pool
    balance source
    option tcp-check
    tcp-check connect
    tcp-check send-binary 00000016 # connection packet
    tcp-check expect binary 4e
    
    server pg-primary 10.0.20.10:5432 check
    server pg-replica 10.0.20.11:5432 check backup

# Frontend configuration
frontend medianest_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/medianest.pem alpn h2,http/1.1
    
    # Redirect HTTP to HTTPS
    redirect scheme https code 301 if !{ ssl_fc }
    
    # Rate limiting
    stick-table type ip size 100k expire 30s store http_req_rate(10s)
    http-request track-sc0 src
    http-request deny if { sc_http_req_rate(0) gt 50 }
    
    # Route to backend
    default_backend medianest_app

# Statistics page
listen stats
    bind *:8404
    stats enable
    stats uri /stats
    stats refresh 30s
    stats admin if TRUE
```

### Nginx Load Balancing
```nginx
upstream medianest_app {
    least_conn;
    
    # Main application servers
    server 10.0.10.10:3000 weight=3 max_fails=2 fail_timeout=30s;
    server 10.0.10.11:3000 weight=3 max_fails=2 fail_timeout=30s;
    
    # Auto-scaled instances
    server 10.0.10.20:3000 weight=1 max_fails=2 fail_timeout=30s backup;
    server 10.0.10.21:3000 weight=1 max_fails=2 fail_timeout=30s backup;
    
    keepalive 16;
}

server {
    listen 80;
    listen [::]:80;
    server_name medianest.local;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name medianest.local;
    
    # SSL configuration
    ssl_certificate /etc/ssl/certs/medianest.crt;
    ssl_certificate_key /etc/ssl/private/medianest.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=web:10m rate=50r/s;
    
    location / {
        limit_req zone=web burst=20 nodelay;
        proxy_pass http://medianest_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Connection reuse
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    location /api/ {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://medianest_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

## Performance Optimization

### CPU Optimization

#### CPU Affinity and NUMA Awareness
```bash
# Set CPU affinity for database containers
docker update --cpuset-cpus="0-7" postgres-container

# NUMA-aware memory allocation
docker run --cpuset-cpus="0-11" --cpuset-mems="0" --memory=16g postgres:16

# Enable CPU frequency scaling
echo performance > /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

#### Process Scheduling
```bash
# Set process priorities
systemctl edit docker.service
[Service]
CPUSchedulingPolicy=1
CPUSchedulingPriority=99
IOSchedulingClass=1
IOSchedulingPriority=4

# Container process scheduling
docker run --cpu-shares=1024 --oom-kill-disable medianest/app
```

### Memory Optimization

#### Kernel Memory Management
```bash
# Optimize kernel memory settings
echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' >> /etc/sysctl.conf
echo 'vm.dirty_ratio=15' >> /etc/sysctl.conf
echo 'vm.dirty_background_ratio=5' >> /etc/sysctl.conf
echo 'kernel.sched_migration_cost_ns=5000000' >> /etc/sysctl.conf
sysctl -p
```

#### Container Memory Management
```yaml
# Memory-optimized container configuration
services:
  postgres:
    mem_limit: 16g
    mem_reservation: 8g
    memswap_limit: 16g  # No swap
    oom_kill_disable: false
    oom_score_adj: -500  # Lower OOM killer priority
    
  medianest-app:
    mem_limit: 2g
    mem_reservation: 1g
    memswap_limit: 2g
    environment:
      - NODE_OPTIONS=--max-old-space-size=1536
```

## Monitoring and Alerting

### Resource Monitoring Dashboard
```yaml
# Grafana dashboard configuration for compute resources
dashboard:
  title: "MediaNest Compute Resources"
  panels:
    - title: "CPU Usage by Service"
      type: "graph"
      targets:
        - expr: 'rate(container_cpu_usage_seconds_total{name=~"medianest.*"}[5m]) * 100'
          legendFormat: '{{name}}'
    
    - title: "Memory Usage by Service"
      type: "graph"
      targets:
        - expr: 'container_memory_usage_bytes{name=~"medianest.*"} / container_spec_memory_limit_bytes * 100'
          legendFormat: '{{name}}'
    
    - title: "Auto-scaling Events"
      type: "table"
      targets:
        - expr: 'increase(hpa_scaling_events_total[1h])'
          legendFormat: '{{deployment}}'
```

### Alerting Rules
```yaml
groups:
  - name: compute.rules
    rules:
      - alert: HighCPUUsage
        expr: rate(container_cpu_usage_seconds_total[5m]) * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.name }}"
          description: "CPU usage is {{ $value }}% on {{ $labels.name }}"

      - alert: HighMemoryUsage
        expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) * 100 > 90
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage on {{ $labels.name }}"
          description: "Memory usage is {{ $value }}% on {{ $labels.name }}"

      - alert: AutoScalingMaxReached
        expr: kube_deployment_status_replicas == kube_deployment_spec_replicas and kube_deployment_spec_replicas == kube_hpa_spec_max_replicas
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Auto-scaling has reached maximum replicas"
          description: "{{ $labels.deployment }} has reached maximum replicas ({{ $value }})"
```

## Disaster Recovery and Business Continuity

### Compute Resource Failover
```bash
#!/bin/bash
# Automated failover script
PRIMARY_NODE="server1.medianest.local"
SECONDARY_NODE="server2.medianest.local"

check_primary() {
    ssh $PRIMARY_NODE "systemctl is-active docker" >/dev/null 2>&1
}

failover_to_secondary() {
    echo "Failing over to secondary node..."
    
    # Stop services on primary (if accessible)
    ssh $PRIMARY_NODE "docker stack rm medianest" 2>/dev/null || true
    
    # Start services on secondary
    ssh $SECONDARY_NODE "docker stack deploy -c docker-compose.prod.yml medianest"
    
    # Update DNS records
    nsupdate -k /etc/bind/update.key <<EOF
server 10.0.1.10
zone medianest.local
update delete app.medianest.local A
update add app.medianest.local 300 A 10.0.20.10
send
EOF
}

# Check primary node health
if ! check_primary; then
    failover_to_secondary
fi
```

### Resource Backup and Migration
```bash
#!/bin/bash
# Container state backup
BACKUP_DIR="/backup/containers/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# Export container configurations
docker ps -aq | xargs docker inspect > $BACKUP_DIR/containers.json

# Export docker volumes
docker volume ls -q | while read volume; do
    docker run --rm -v $volume:/volume -v $BACKUP_DIR:/backup alpine \
        tar czf /backup/${volume}.tar.gz -C /volume ./
done

# Export docker networks
docker network ls -q | xargs docker network inspect > $BACKUP_DIR/networks.json
```

## Cost Optimization Strategies

### Resource Right-sizing
```bash
#!/bin/bash
# Resource usage analysis script
analyze_resource_usage() {
    local container=$1
    local days=${2:-7}
    
    echo "Analyzing $container for last $days days..."
    
    # CPU usage analysis
    avg_cpu=$(docker stats $container --no-stream --format "table {{.CPUPerc}}" | tail -n +2 | sed 's/%//' | awk '{sum+=$1} END {print sum/NR}')
    
    # Memory usage analysis
    avg_mem=$(docker stats $container --no-stream --format "table {{.MemPerc}}" | tail -n +2 | sed 's/%//' | awk '{sum+=$1} END {print sum/NR}')
    
    echo "Average CPU: ${avg_cpu}%"
    echo "Average Memory: ${avg_mem}%"
    
    # Recommendations
    if (( $(echo "$avg_cpu < 30" | bc -l) )); then
        echo "RECOMMENDATION: Consider reducing CPU allocation"
    fi
    
    if (( $(echo "$avg_mem < 50" | bc -l) )); then
        echo "RECOMMENDATION: Consider reducing memory allocation"
    fi
}

# Analyze all MediaNest containers
docker ps --format "{{.Names}}" | grep medianest | while read container; do
    analyze_resource_usage $container
    echo "---"
done
```

### Scheduled Scaling
```yaml
# Scheduled auto-scaling for predictable load patterns
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: medianest-scheduled-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: medianest-app
  minReplicas: 2
  maxReplicas: 6
  behavior:
    scaleDown:
      # Scale down slowly during business hours
      policies:
      - type: Pods
        value: 1
        periodSeconds: 300
    scaleUp:
      # Scale up quickly during peak hours
      policies:
      - type: Pods
        value: 2
        periodSeconds: 60
```

## Implementation Timeline

### Week 1: Infrastructure Setup
- Deploy Proxmox VE cluster
- Configure virtual machines
- Set up basic monitoring

### Week 2: Container Orchestration
- Deploy Docker Swarm/Kubernetes
- Configure resource quotas and limits
- Implement basic auto-scaling

### Week 3: Load Balancing and HA
- Configure HAProxy/Nginx load balancers
- Implement health checks
- Test failover procedures

### Week 4: Optimization and Monitoring
- Fine-tune resource allocations
- Deploy comprehensive monitoring
- Complete performance testing

---

*This compute scaling strategy should be reviewed monthly and adjusted based on actual usage patterns and performance metrics.*