# MediaNest Consul Service Discovery Configuration
# Production-ready service mesh and discovery

# Global Configuration
datacenter = "medianest-homelab"
data_dir = "/opt/consul/data"
log_level = "INFO"
node_name = "medianest-consul-1"
server = true
bootstrap_expect = 1

# Network Configuration
bind_addr = "0.0.0.0"
client_addr = "0.0.0.0"
ports {
  grpc = 8502
  http = 8500
  https = 8501
  dns = 8600
}

# Security Configuration
encrypt = "K8n7LzwL2dZ5Q6QzJ9XzY4WjR7VzJ9XzK8n7LzwL2dZ="
acl = {
  enabled = true
  default_policy = "allow"
  enable_token_persistence = true
}

# TLS Configuration
tls {
  defaults {
    verify_incoming = false
    verify_outgoing = false
  }
  internal_rpc {
    verify_server_hostname = false
  }
}

# Service Discovery Configuration
services {
  # MediaNest Application Service
  name = "medianest-app"
  port = 3000
  tags = ["web", "nodejs", "production"]
  
  check {
    http = "http://localhost:3000/api/health"
    interval = "30s"
    timeout = "10s"
    deregister_critical_service_after = "90s"
  }
  
  check {
    tcp = "localhost:3000"
    interval = "10s"
    timeout = "3s"
  }
  
  connect {
    sidecar_service {
      port = 20000
      check {
        name = "Connect Envoy Sidecar"
        tcp = "localhost:20000"
        interval = "10s"
      }
      proxy {
        upstreams = [
          {
            destination_name = "postgres"
            local_bind_port = 5432
          },
          {
            destination_name = "redis"
            local_bind_port = 6379
          }
        ]
      }
    }
  }
  
  meta {
    version = "1.0.0"
    environment = "production"
    team = "platform"
  }
}

services {
  # PostgreSQL Database Service
  name = "postgres"
  port = 5432
  tags = ["database", "postgres", "primary"]
  
  check {
    tcp = "localhost:5432"
    interval = "30s"
    timeout = "5s"
    deregister_critical_service_after = "90s"
  }
  
  check {
    script = "pg_isready -h localhost -p 5432 -U medianest"
    interval = "60s"
    timeout = "10s"
  }
  
  connect {
    sidecar_service {
      port = 20001
      proxy {
        config {
          protocol = "tcp"
        }
      }
    }
  }
  
  meta {
    version = "16"
    role = "primary"
    backup_enabled = "true"
  }
}

services {
  # Redis Cache Service
  name = "redis"
  port = 6379
  tags = ["cache", "redis", "session"]
  
  check {
    tcp = "localhost:6379"
    interval = "30s"
    timeout = "5s"
  }
  
  check {
    script = "redis-cli -h localhost -p 6379 ping"
    interval = "30s"
    timeout = "5s"
  }
  
  connect {
    sidecar_service {
      port = 20002
      proxy {
        config {
          protocol = "tcp"
        }
      }
    }
  }
  
  meta {
    version = "7"
    memory_policy = "allkeys-lru"
    max_memory = "512mb"
  }
}

services {
  # Prometheus Monitoring Service
  name = "prometheus"
  port = 9090
  tags = ["monitoring", "metrics", "prometheus"]
  
  check {
    http = "http://localhost:9090/-/healthy"
    interval = "30s"
    timeout = "10s"
  }
  
  meta {
    version = "latest"
    retention = "15d"
    scrape_interval = "15s"
  }
}

services {
  # Grafana Dashboard Service
  name = "grafana"
  port = 3000
  tags = ["monitoring", "dashboard", "grafana"]
  
  check {
    http = "http://localhost:3000/api/health"
    interval = "30s"
    timeout = "10s"
  }
  
  meta {
    version = "latest"
    admin_user = "admin"
  }
}

services {
  # Traefik Load Balancer Service
  name = "traefik"
  port = 8080
  tags = ["loadbalancer", "proxy", "traefik"]
  
  check {
    http = "http://localhost:8080/ping"
    interval = "30s"
    timeout = "10s"
  }
  
  meta {
    version = "3.0"
    api_dashboard = "enabled"
    ssl_provider = "letsencrypt"
  }
}

# Connect Configuration for Service Mesh
connect {
  enabled = true
}

# UI Configuration
ui_config {
  enabled = true
  dir = "/opt/consul/ui"
}

# Performance Configuration
performance {
  raft_multiplier = 1
}

# Logging Configuration
log_rotate_duration = "24h"
log_rotate_max_files = 7

# Telemetry
telemetry {
  prometheus_retention_time = "60s"
  disable_hostname = false
}

# Autopilot Configuration
autopilot {
  cleanup_dead_servers = true
  last_contact_threshold = "200ms"
  max_trailing_logs = 250
  server_stabilization_time = "10s"
}