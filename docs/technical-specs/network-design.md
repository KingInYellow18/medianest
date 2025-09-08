# Network Design and Segmentation Strategy

## Overview

This document defines the network architecture for the MediaNest homelab environment, building upon the existing network patterns discovered in the Docker Compose configurations while extending them for enterprise-grade security and scalability.

## Current Network Implementation Analysis

### Existing Docker Networks (From Codebase)
```yaml
networks:
  medianest-internal:
    driver: bridge
    subnet: 172.25.0.0/24
    gateway: 172.25.0.1
    internal: true  # No external access
    
  medianest-public:
    driver: bridge
    subnet: 172.26.0.0/24
    gateway: 172.26.0.1
```

### Current Service Network Assignments
- PostgreSQL: 172.25.0.10 (internal only)
- Redis: 172.25.0.11 (internal only)
- Application: 172.25.0.20 (internal) + 172.26.0.20 (public)
- Nginx: 172.26.0.30 (public only)
- Prometheus: 172.25.0.40 (internal only)

## Enhanced Network Architecture

### Physical Network Topology

```
Internet
    │
┌───▼────┐
│ Router │ (192.168.1.1)
│/Firewall│
└───┬────┘
    │
┌───▼────┐
│ Core   │ (10.0.0.0/16)
│Switch  │
└───┬────┘
    │
    ├── Management VLAN (10.0.1.0/24)
    ├── DMZ VLAN (10.0.2.0/24)
    ├── Application VLAN (10.0.10.0/24)
    ├── Database VLAN (10.0.20.0/24)
    ├── Storage VLAN (10.0.30.0/24)
    ├── Monitoring VLAN (10.0.40.0/24)
    └── Guest VLAN (10.0.100.0/24)
```

### VLAN Segmentation Strategy

#### VLAN 1: Management Network
- **Subnet**: 10.0.1.0/24
- **Purpose**: Infrastructure management and administration
- **Access**: SSH, HTTPS management interfaces
- **Security**: Restricted to admin workstations only

#### VLAN 2: DMZ (Demilitarized Zone)
- **Subnet**: 10.0.2.0/24
- **Purpose**: Public-facing services
- **Components**: Reverse proxies, load balancers, WAF
- **Security**: Ingress from internet, egress to application tier only

#### VLAN 10: Application Tier
- **Subnet**: 10.0.10.0/24
- **Purpose**: Application servers and microservices
- **Components**: MediaNest application containers, API services
- **Security**: Access from DMZ and authorized internal systems

#### VLAN 20: Database Tier
- **Subnet**: 10.0.20.0/24
- **Purpose**: Database servers and data processing
- **Components**: PostgreSQL, Redis, data backup services
- **Security**: Access only from application tier

#### VLAN 30: Storage Network
- **Subnet**: 10.0.30.0/24
- **Purpose**: Storage systems and file services
- **Components**: NFS servers, object storage, backup systems
- **Security**: Dedicated storage traffic, encrypted at rest

#### VLAN 40: Monitoring and Logging
- **Subnet**: 10.0.40.0/24
- **Purpose**: Observability and security monitoring
- **Components**: Prometheus, Grafana, ELK stack, security tools
- **Security**: Read-only access to monitored systems

#### VLAN 100: Guest Network
- **Subnet**: 10.0.100.0/24
- **Purpose**: Guest access and isolated testing
- **Security**: Internet access only, no internal network access

### Container Network Integration

#### Docker Network Mapping
```yaml
# Enhanced Docker network configuration
networks:
  # Maps to Application VLAN
  medianest-app:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-app
    ipam:
      driver: default
      config:
        - subnet: 172.20.0.0/24
          gateway: 172.20.0.1

  # Maps to Database VLAN  
  medianest-db:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-db
    internal: true
    ipam:
      driver: default
      config:
        - subnet: 172.21.0.0/24
          gateway: 172.21.0.1

  # Maps to Storage VLAN
  medianest-storage:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-storage
    internal: true
    ipam:
      driver: default
      config:
        - subnet: 172.22.0.0/24
          gateway: 172.22.0.1

  # Maps to Monitoring VLAN
  medianest-monitoring:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-monitoring
    ipam:
      driver: default
      config:
        - subnet: 172.23.0.0/24
          gateway: 172.23.0.1
```

## Network Security Implementation

### Firewall Rules Matrix

| Source VLAN | Destination VLAN | Protocol | Port | Action | Purpose |
|-------------|------------------|----------|------|--------|---------|
| Internet | DMZ | TCP | 80,443 | ALLOW | Web traffic |
| DMZ | Application | TCP | 3000,4000 | ALLOW | App communication |
| Application | Database | TCP | 5432,6379 | ALLOW | DB access |
| Application | Storage | TCP | 2049,9000 | ALLOW | File access |
| Management | All VLANs | TCP | 22 | ALLOW | SSH access |
| Monitoring | All VLANs | TCP | Various | ALLOW | Metrics collection |
| All | All | Any | Any | DENY | Default deny |

### Network Access Control Lists (NACLs)

#### DMZ NACL
```bash
# Inbound rules
allow tcp from any to 10.0.2.0/24 port 80
allow tcp from any to 10.0.2.0/24 port 443
allow tcp from 10.0.1.0/24 to 10.0.2.0/24 port 22

# Outbound rules
allow tcp from 10.0.2.0/24 to 10.0.10.0/24 port 3000-4000
deny all from 10.0.2.0/24 to any
```

#### Application NACL
```bash
# Inbound rules
allow tcp from 10.0.2.0/24 to 10.0.10.0/24 port 3000-4000
allow tcp from 10.0.1.0/24 to 10.0.10.0/24 port 22

# Outbound rules
allow tcp from 10.0.10.0/24 to 10.0.20.0/24 port 5432,6379
allow tcp from 10.0.10.0/24 to 10.0.30.0/24 port 2049,9000
allow tcp from 10.0.10.0/24 to any port 80,443  # Internet access
```

### DNS Configuration

#### Internal DNS Zones
```
# Primary zone: medianest.local
app.medianest.local      IN A  10.0.10.10
db.medianest.local       IN A  10.0.20.10
cache.medianest.local    IN A  10.0.20.11
storage.medianest.local  IN A  10.0.30.10
monitor.medianest.local  IN A  10.0.40.10
```

#### DNS Security Features
- DNSSEC enabled for all zones
- DNS over HTTPS (DoH) for external queries
- DNS filtering for malware and phishing protection
- Split-horizon DNS for internal/external resolution

## Load Balancing and High Availability

### HAProxy Configuration
```
global
    daemon
    user haproxy
    group haproxy
    log stdout local0

defaults
    mode http
    timeout connect 5s
    timeout client 30s
    timeout server 30s
    option httplog

frontend medianest_frontend
    bind *:80
    bind *:443 ssl crt /etc/ssl/certs/medianest.pem
    redirect scheme https if !{ ssl_fc }
    default_backend medianest_backend

backend medianest_backend
    balance roundrobin
    option httpchk GET /health
    server app1 10.0.10.10:3000 check
    server app2 10.0.10.11:3000 check backup
```

### Service Discovery

#### Consul Configuration
```json
{
  "datacenter": "medianest",
  "data_dir": "/opt/consul/data",
  "log_level": "INFO",
  "server": true,
  "bootstrap_expect": 3,
  "bind_addr": "10.0.10.5",
  "client_addr": "0.0.0.0",
  "ui_config": {
    "enabled": true
  },
  "services": [
    {
      "name": "medianest-app",
      "port": 3000,
      "check": {
        "http": "http://10.0.10.10:3000/health",
        "interval": "10s"
      }
    }
  ]
}
```

## Network Monitoring and Observability

### Traffic Analysis
- **sFlow/NetFlow**: Traffic pattern analysis
- **Packet Capture**: Security incident investigation
- **Bandwidth Monitoring**: Capacity planning
- **Latency Tracking**: Performance optimization

### Network Metrics Collection
```yaml
# Prometheus configuration for network monitoring
- job_name: 'network-devices'
  static_configs:
    - targets:
      - '10.0.1.1:161'  # Core switch
      - '10.0.1.2:161'  # Firewall
  metrics_path: /snmp
  params:
    module: [if_mib]
  relabel_configs:
    - source_labels: [__address__]
      target_label: __param_target
    - source_labels: [__param_target]
      target_label: instance
    - target_label: __address__
      replacement: localhost:9116  # SNMP exporter
```

## Wireless Network Design

### Access Point Placement
- **Coverage Areas**: Office, lab, guest areas
- **VLAN Assignment**: Dynamic VLAN based on authentication
- **Security**: WPA3-Enterprise with certificate authentication

### Wireless Security
```
# WPA3-Enterprise configuration
network={
    ssid="MediaNest-Corporate"
    key_mgmt=WPA-EAP
    eap=TLS
    identity="username@medianest.local"
    ca_cert="/etc/ssl/certs/ca.pem"
    client_cert="/etc/ssl/certs/client.pem"
    private_key="/etc/ssl/private/client.key"
}
```

## Network Automation with Ansible

### Network Device Configuration
```yaml
---
- name: Configure network infrastructure
  hosts: network_devices
  gather_facts: no
  tasks:
    - name: Configure VLAN interfaces
      community.network.net_vlan:
        vlan_id: "{{ item.vlan_id }}"
        name: "{{ item.name }}"
        state: present
      loop:
        - { vlan_id: 1, name: "Management" }
        - { vlan_id: 2, name: "DMZ" }
        - { vlan_id: 10, name: "Application" }
        - { vlan_id: 20, name: "Database" }
        - { vlan_id: 30, name: "Storage" }
        - { vlan_id: 40, name: "Monitoring" }

    - name: Configure access control lists
      community.network.net_acl:
        name: "{{ item.name }}"
        rules: "{{ item.rules }}"
        state: present
      loop: "{{ acl_rules }}"
```

## Performance Optimization

### Quality of Service (QoS)
```bash
# Traffic prioritization
tc qdisc add dev eth0 root handle 1: htb default 30

# High priority: Management and monitoring traffic
tc class add dev eth0 parent 1: classid 1:10 htb rate 100mbit ceil 1gbit prio 1

# Normal priority: Application traffic
tc class add dev eth0 parent 1: classid 1:20 htb rate 500mbit ceil 1gbit prio 2

# Low priority: Backup and bulk transfer
tc class add dev eth0 parent 1: classid 1:30 htb rate 100mbit ceil 500mbit prio 3
```

### Network Tuning
```bash
# Kernel network optimizations
echo 'net.core.rmem_max = 134217728' >> /etc/sysctl.conf
echo 'net.core.wmem_max = 134217728' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_rmem = 4096 65536 134217728' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_wmem = 4096 65536 134217728' >> /etc/sysctl.conf
sysctl -p
```

## Disaster Recovery Network Design

### Network Failover
- **Primary**: Main datacenter connectivity
- **Secondary**: Backup internet connection
- **Tertiary**: Cellular backup for critical services

### Site-to-Site VPN
```
# IPSec tunnel configuration
conn medianest-dr
    type=tunnel
    authby=secret
    left=203.0.113.1
    leftsubnet=10.0.0.0/16
    right=198.51.100.1
    rightsubnet=10.1.0.0/16
    auto=route
```

## Implementation Timeline

### Week 1: Physical Infrastructure
- Install core switch and configure VLANs
- Set up firewall with initial rule set
- Configure management network access

### Week 2: Network Services
- Deploy DNS and DHCP services
- Configure load balancers
- Implement monitoring infrastructure

### Week 3: Security Implementation
- Deploy network access controls
- Configure wireless security
- Implement network monitoring

### Week 4: Testing and Optimization
- Performance testing and tuning
- Security testing and validation
- Documentation and training

## Maintenance Procedures

### Regular Tasks
- **Weekly**: Review firewall logs and update rules
- **Monthly**: Update network device firmware
- **Quarterly**: Review and update network documentation
- **Annually**: Complete security audit and penetration testing

### Emergency Procedures
- **Network Outage**: Failover to backup connectivity
- **Security Incident**: Isolate affected network segments
- **Performance Degradation**: Activate QoS policies

---

*This network design should be reviewed and updated as the infrastructure evolves and requirements change.*