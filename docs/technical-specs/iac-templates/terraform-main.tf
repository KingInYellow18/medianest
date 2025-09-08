# MediaNest Homelab Infrastructure - Terraform Configuration
# Based on validated Terraform v1.12.2 from Context7

terraform {
  required_version = ">= 1.12.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
    proxmox = {
      source  = "telmate/proxmox"
      version = "~> 2.9"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.4"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  backend "local" {
    path = "terraform.tfstate"
  }
}

# Variables for infrastructure configuration
variable "proxmox_api_url" {
  description = "Proxmox API URL"
  type        = string
  default     = "https://proxmox.medianest.local:8006/api2/json"
}

variable "proxmox_api_token_id" {
  description = "Proxmox API token ID"
  type        = string
  sensitive   = true
}

variable "proxmox_api_token_secret" {
  description = "Proxmox API token secret"
  type        = string
  sensitive   = true
}

variable "vm_count" {
  description = "Number of VMs to create"
  type        = number
  default     = 3
}

variable "vm_memory" {
  description = "Memory allocation per VM in MB"
  type        = number
  default     = 4096
}

variable "vm_cores" {
  description = "CPU cores per VM"
  type        = number
  default     = 2
}

variable "storage_pool" {
  description = "Proxmox storage pool for VMs"
  type        = string
  default     = "local-zfs"
}

variable "network_bridge" {
  description = "Network bridge for VMs"
  type        = string
  default     = "vmbr0"
}

variable "vm_template" {
  description = "VM template name"
  type        = string
  default     = "ubuntu-22.04-template"
}

# Proxmox provider configuration
provider "proxmox" {
  pm_api_url          = var.proxmox_api_url
  pm_api_token_id     = var.proxmox_api_token_id
  pm_api_token_secret = var.proxmox_api_token_secret
  pm_tls_insecure     = true
}

# Docker provider configuration
provider "docker" {
  host = "unix:///var/run/docker.sock"
}

# Local provider for file operations
provider "local" {}

# Data source for Proxmox node information
data "proxmox_virtual_environment_nodes" "available_nodes" {}

# Create Proxmox VMs for MediaNest infrastructure
resource "proxmox_vm_qemu" "medianest_vm" {
  count       = var.vm_count
  name        = "medianest-node-${count.index + 1}"
  target_node = data.proxmox_virtual_environment_nodes.available_nodes.names[0]
  clone       = var.vm_template
  
  # VM Configuration
  memory    = var.vm_memory
  cores     = var.vm_cores
  sockets   = 1
  cpu       = "host"
  numa      = true
  hotplug   = "network,disk,usb"
  
  # Boot configuration
  boot      = "c"
  bootdisk  = "scsi0"
  agent     = 1
  
  # Disk configuration
  disk {
    size     = "50G"
    type     = "scsi"
    storage  = var.storage_pool
    format   = "raw"
    cache    = "writeback"
    backup   = true
    replicate = true
    iothread = 1
    ssd      = 1
    discard  = "on"
  }
  
  # Additional data disk
  disk {
    size     = "100G"
    type     = "scsi"
    storage  = var.storage_pool
    format   = "raw"
    cache    = "writeback"
    backup   = true
    slot     = 1
    ssd      = 1
    discard  = "on"
  }
  
  # Network configuration
  network {
    model   = "virtio"
    bridge  = var.network_bridge
    macaddr = "52:54:00:${format("%02x", count.index)}:${format("%02x", random_integer.vm_mac[count.index].result)}:${format("%02x", random_integer.vm_mac_suffix[count.index].result)}"
  }
  
  # Cloud-init configuration
  os_type    = "cloud-init"
  ipconfig0  = "ip=10.0.10.${count.index + 10}/24,gw=10.0.10.1"
  nameserver = "10.0.1.10,1.1.1.1"
  
  # SSH configuration
  sshkeys = file("~/.ssh/id_rsa.pub")
  
  # VM lifecycle management
  lifecycle {
    ignore_changes = [
      network.0.macaddr,
      disk.0.size,
      clone,
    ]
  }

  tags = [
    "medianest",
    "infrastructure",
    "node-${count.index + 1}"
  ]
}

# Generate random MAC address components
resource "random_integer" "vm_mac" {
  count = var.vm_count
  min   = 0
  max   = 255
}

resource "random_integer" "vm_mac_suffix" {
  count = var.vm_count
  min   = 0
  max   = 255
}

# Create Docker networks based on discovered patterns
resource "docker_network" "medianest_internal" {
  name   = "medianest-internal"
  driver = "bridge"
  
  options = {
    "com.docker.network.bridge.name" = "br-medianest-internal"
  }
  
  internal = true
  
  ipam_config {
    subnet   = "172.25.0.0/24"
    gateway  = "172.25.0.1"
  }
  
  labels = {
    environment = "production"
    project     = "medianest"
    tier        = "internal"
  }
}

resource "docker_network" "medianest_public" {
  name   = "medianest-public"
  driver = "bridge"
  
  options = {
    "com.docker.network.bridge.name" = "br-medianest-public"
  }
  
  ipam_config {
    subnet   = "172.26.0.0/24"
    gateway  = "172.26.0.1"
  }
  
  labels = {
    environment = "production"
    project     = "medianest"
    tier        = "public"
  }
}

# Enhanced networks for different tiers
resource "docker_network" "medianest_database" {
  name   = "medianest-database"
  driver = "bridge"
  
  options = {
    "com.docker.network.bridge.name" = "br-medianest-db"
  }
  
  internal = true
  
  ipam_config {
    subnet   = "172.27.0.0/24"
    gateway  = "172.27.0.1"
  }
  
  labels = {
    environment = "production"
    project     = "medianest"
    tier        = "database"
  }
}

resource "docker_network" "medianest_monitoring" {
  name   = "medianest-monitoring"
  driver = "bridge"
  
  options = {
    "com.docker.network.bridge.name" = "br-medianest-monitoring"
  }
  
  ipam_config {
    subnet   = "172.28.0.0/24"
    gateway  = "172.28.0.1"
  }
  
  labels = {
    environment = "production"
    project     = "medianest"
    tier        = "monitoring"
  }
}

# Create Docker volumes based on discovered patterns
resource "docker_volume" "postgres_data" {
  name = "postgres_data"
  
  driver_opts = {
    type   = "none"
    o      = "bind"
    device = "/var/lib/medianest/postgres"
  }
  
  labels = {
    environment = "production"
    project     = "medianest"
    service     = "postgres"
  }
}

resource "docker_volume" "redis_data" {
  name = "redis_data"
  
  driver_opts = {
    type   = "none"
    o      = "bind"
    device = "/var/lib/medianest/redis"
  }
  
  labels = {
    environment = "production"
    project     = "medianest"
    service     = "redis"
  }
}

resource "docker_volume" "uploads" {
  name = "uploads"
  
  driver_opts = {
    type   = "none"
    o      = "bind"
    device = "/var/lib/medianest/uploads"
  }
  
  labels = {
    environment = "production"
    project     = "medianest"
    service     = "application"
  }
}

resource "docker_volume" "app_logs" {
  name = "app_logs"
  
  driver_opts = {
    type   = "none"
    o      = "bind"
    device = "/var/log/medianest"
  }
  
  labels = {
    environment = "production"
    project     = "medianest"
    service     = "logging"
  }
}

# Create directory structure for volumes
resource "null_resource" "create_directories" {
  provisioner "local-exec" {
    command = <<-EOT
      mkdir -p /var/lib/medianest/{postgres,redis,uploads,backups}
      mkdir -p /var/log/medianest/{application,nginx,system}
      chmod 755 /var/lib/medianest
      chmod 750 /var/lib/medianest/postgres
      chmod 750 /var/lib/medianest/redis
      chmod 755 /var/lib/medianest/uploads
      chmod 755 /var/log/medianest
    EOT
  }
}

# Generate Docker Compose files from templates
resource "local_file" "docker_compose_production" {
  content = templatefile("${path.module}/docker-compose.prod.tpl", {
    postgres_network = docker_network.medianest_database.name
    app_network      = docker_network.medianest_internal.name
    public_network   = docker_network.medianest_public.name
    monitoring_network = docker_network.medianest_monitoring.name
    
    postgres_volume = docker_volume.postgres_data.name
    redis_volume    = docker_volume.redis_data.name
    uploads_volume  = docker_volume.uploads.name
    logs_volume     = docker_volume.app_logs.name
  })
  
  filename = "${path.module}/../../docker-compose.terraform-generated.yml"
}

# Create monitoring configuration
resource "local_file" "prometheus_config" {
  content = templatefile("${path.module}/prometheus.yml.tpl", {
    vm_ips = [for vm in proxmox_vm_qemu.medianest_vm : "10.0.10.${vm.index + 10}"]
  })
  
  filename = "${path.module}/../../config/prometheus/prometheus.terraform.yml"
}

# Generate Ansible inventory
resource "local_file" "ansible_inventory" {
  content = templatefile("${path.module}/inventory.ini.tpl", {
    vms = [
      for i, vm in proxmox_vm_qemu.medianest_vm : {
        name = vm.name
        ip   = "10.0.10.${i + 10}"
        role = i == 0 ? "primary" : i == 1 ? "secondary" : "worker"
      }
    ]
  })
  
  filename = "${path.module}/../ansible/inventory.ini"
}

# Generate SSL certificate with self-signed CA
resource "null_resource" "ssl_certificates" {
  provisioner "local-exec" {
    command = <<-EOT
      mkdir -p ${path.module}/../../ssl
      
      # Generate CA key
      openssl genrsa -out ${path.module}/../../ssl/ca-key.pem 4096
      
      # Generate CA certificate
      openssl req -new -x509 -days 3650 -key ${path.module}/../../ssl/ca-key.pem \
        -out ${path.module}/../../ssl/ca.pem \
        -subj "/C=US/ST=Local/L=Homelab/O=MediaNest/CN=MediaNest CA"
      
      # Generate server key
      openssl genrsa -out ${path.module}/../../ssl/server-key.pem 4096
      
      # Generate server certificate request
      openssl req -new -key ${path.module}/../../ssl/server-key.pem \
        -out ${path.module}/../../ssl/server.csr \
        -subj "/C=US/ST=Local/L=Homelab/O=MediaNest/CN=medianest.local"
      
      # Create extensions file
      echo "subjectAltName = DNS:medianest.local,DNS:*.medianest.local,IP:10.0.10.10,IP:127.0.0.1" > ${path.module}/../../ssl/extfile.cnf
      
      # Sign server certificate with CA
      openssl x509 -req -days 365 -in ${path.module}/../../ssl/server.csr \
        -CA ${path.module}/../../ssl/ca.pem \
        -CAkey ${path.module}/../../ssl/ca-key.pem \
        -CAcreateserial \
        -out ${path.module}/../../ssl/server.pem \
        -extensions v3_req \
        -extfile ${path.module}/../../ssl/extfile.cnf
      
      # Set appropriate permissions
      chmod 400 ${path.module}/../../ssl/*-key.pem
      chmod 444 ${path.module}/../../ssl/*.pem
      chmod 444 ${path.module}/../../ssl/ca.pem
    EOT
  }
  
  depends_on = [null_resource.create_directories]
}

# Output important information
output "vm_information" {
  description = "Information about created VMs"
  value = {
    for vm in proxmox_vm_qemu.medianest_vm :
    vm.name => {
      id     = vm.id
      ip     = "10.0.10.${vm.index + 10}"
      memory = vm.memory
      cores  = vm.cores
      node   = vm.target_node
    }
  }
}

output "network_information" {
  description = "Docker network configuration"
  value = {
    internal_network = {
      name   = docker_network.medianest_internal.name
      subnet = "172.25.0.0/24"
    }
    public_network = {
      name   = docker_network.medianest_public.name
      subnet = "172.26.0.0/24"
    }
    database_network = {
      name   = docker_network.medianest_database.name
      subnet = "172.27.0.0/24"
    }
    monitoring_network = {
      name   = docker_network.medianest_monitoring.name
      subnet = "172.28.0.0/24"
    }
  }
}

output "volume_information" {
  description = "Docker volume configuration"
  value = {
    postgres_data = docker_volume.postgres_data.name
    redis_data    = docker_volume.redis_data.name
    uploads       = docker_volume.uploads.name
    app_logs      = docker_volume.app_logs.name
  }
}

output "next_steps" {
  description = "Next steps for deployment"
  value = <<-EOT
    Infrastructure has been provisioned. Next steps:
    
    1. Run Ansible playbook to configure VMs:
       cd ../ansible && ansible-playbook -i inventory.ini site.yml
    
    2. Deploy MediaNest application:
       docker-compose -f ../../docker-compose.terraform-generated.yml up -d
    
    3. Access the application:
       https://medianest.local (add to /etc/hosts: 10.0.10.10 medianest.local)
    
    4. Monitor the infrastructure:
       http://10.0.10.10:9090 (Prometheus)
       http://10.0.10.10:3000 (Grafana)
  EOT
}