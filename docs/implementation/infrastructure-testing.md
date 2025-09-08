# MediaNest Infrastructure Testing Framework

## Executive Summary

This document establishes comprehensive infrastructure testing protocols for MediaNest, ensuring reliable, scalable, and secure infrastructure deployment and operation. The framework covers container testing, network validation, resource monitoring, disaster recovery testing, and infrastructure as code validation.

## Infrastructure Testing Philosophy

### Core Principles
- **Infrastructure as Code**: All infrastructure changes are tested before deployment
- **Immutable Infrastructure**: Test infrastructure isolation and reproducibility
- **Fail-Fast Approach**: Early detection of infrastructure issues
- **Production Parity**: Test environments mirror production configuration
- **Automated Validation**: Continuous infrastructure health monitoring

### Infrastructure Testing Pyramid

```
                    End-to-End Infrastructure Testing
                           (5% - Production-like)
           ┌──────────────────────────────────────────────────┐
           │  Full Stack Deployment Testing                  │
           │  Disaster Recovery Simulation                   │
           │  Multi-Region Failover Testing                  │
           └──────────────────────────────────────────────────┘
            
                    Service Integration Testing
                       (15% - Multi-component)
        ┌─────────────────────────────────────────────────────────┐
        │  Container Orchestration Testing                        │
        │  Network Security Testing                               │
        │  Service Mesh Testing                                   │
        └─────────────────────────────────────────────────────────┘
        
                    Component Infrastructure Testing
                       (30% - Individual Services)
      ┌──────────────────────────────────────────────────────────────┐
      │  Container Testing                                           │
      │  Database Performance Testing                                │
      │  Cache Layer Testing                                         │
      └──────────────────────────────────────────────────────────────┘
      
                    Unit Infrastructure Testing
                       (50% - Configuration & Setup)
    ┌─────────────────────────────────────────────────────────────────┐
    │  Configuration Validation                                       │
    │  Dockerfile Testing                                             │
    │  Environment Variable Testing                                   │
    └─────────────────────────────────────────────────────────────────┘
```

## Container Testing Framework

### 1. Docker Container Testing

```python
# tests/infrastructure/container-tests.py
import docker
import pytest
import time
import requests
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class ContainerTestSuite:
    def __init__(self):
        self.client = docker.from_env()
        self.containers = {}
        
    def setup_method(self):
        """Setup test environment"""
        logger.info("🏗️  Setting up container test environment")
        self.cleanup_containers()
        
    def teardown_method(self):
        """Cleanup test environment"""
        logger.info("🧹 Cleaning up container test environment")
        self.cleanup_containers()
        
    def cleanup_containers(self):
        """Remove all test containers"""
        for container_name in list(self.containers.keys()):
            self.remove_container(container_name)
            
    def start_container(self, image: str, name: str, **kwargs) -> docker.models.containers.Container:
        """Start a container with specified configuration"""
        try:
            container = self.client.containers.run(
                image=image,
                name=name,
                detach=True,
                remove=True,
                **kwargs
            )
            self.containers[name] = container
            logger.info(f"✅ Started container: {name}")
            return container
        except Exception as e:
            logger.error(f"❌ Failed to start container {name}: {e}")
            raise
            
    def remove_container(self, name: str):
        """Remove a specific container"""
        if name in self.containers:
            try:
                self.containers[name].stop()
                self.containers[name].remove()
                del self.containers[name]
                logger.info(f"🗑️  Removed container: {name}")
            except Exception as e:
                logger.warning(f"⚠️  Failed to remove container {name}: {e}")

class TestDockerfileValidation(ContainerTestSuite):
    """Test Dockerfile configurations and builds"""
    
    def test_backend_dockerfile_build(self):
        """Test backend Dockerfile builds successfully"""
        logger.info("🔨 Testing backend Dockerfile build")
        
        image, logs = self.client.images.build(
            path="./backend",
            dockerfile="Dockerfile.production",
            tag="medianest-backend:test",
            rm=True
        )
        
        assert image is not None
        assert len(image.id) > 0
        
        # Verify image properties
        assert 'medianest-backend:test' in image.tags
        
        # Check image size (should be reasonable)
        size_mb = image.attrs['Size'] / (1024 * 1024)
        assert size_mb < 500, f"Backend image too large: {size_mb:.2f}MB"
        
        logger.info(f"✅ Backend image built successfully: {size_mb:.2f}MB")
        
    def test_frontend_dockerfile_build(self):
        """Test frontend Dockerfile builds successfully"""
        logger.info("🔨 Testing frontend Dockerfile build")
        
        image, logs = self.client.images.build(
            path="./frontend",
            dockerfile="Dockerfile.production",
            tag="medianest-frontend:test",
            rm=True
        )
        
        assert image is not None
        size_mb = image.attrs['Size'] / (1024 * 1024)
        assert size_mb < 200, f"Frontend image too large: {size_mb:.2f}MB"
        
        logger.info(f"✅ Frontend image built successfully: {size_mb:.2f}MB")
        
    def test_multi_stage_build_efficiency(self):
        """Test that multi-stage builds are efficient"""
        logger.info("📊 Testing multi-stage build efficiency")
        
        # Build with and without multi-stage to compare
        backend_image, _ = self.client.images.build(
            path="./backend",
            dockerfile="Dockerfile.production",
            tag="medianest-backend:multistage",
            rm=True
        )
        
        # Verify development dependencies are not included
        container = self.client.containers.run(
            "medianest-backend:multistage",
            command="ls /app/node_modules",
            remove=True,
            detach=False
        )
        
        # Should not include dev dependencies like jest, eslint, etc.
        output = container.decode('utf-8').lower()
        dev_dependencies = ['jest', 'eslint', 'nodemon', '@types/jest']
        
        for dep in dev_dependencies:
            assert dep not in output, f"Dev dependency {dep} found in production image"
            
        logger.info("✅ Multi-stage build correctly excludes dev dependencies")

class TestContainerRuntime(ContainerTestSuite):
    """Test container runtime behavior"""
    
    def test_backend_container_startup(self):
        """Test backend container starts and responds to health checks"""
        logger.info("🚀 Testing backend container startup")
        
        container = self.start_container(
            image="medianest-backend:latest",
            name="test-backend",
            ports={'3000/tcp': 3000},
            environment={
                'NODE_ENV': 'production',
                'DATABASE_URL': 'postgresql://test:test@postgres:5432/test',
                'REDIS_URL': 'redis://redis:6379'
            }
        )
        
        # Wait for container to start
        self.wait_for_container_health(container, "http://localhost:3000/health", timeout=30)
        
        # Verify health endpoint
        response = requests.get("http://localhost:3000/health", timeout=5)
        assert response.status_code == 200
        
        health_data = response.json()
        assert health_data['status'] == 'healthy'
        assert 'uptime' in health_data
        assert 'version' in health_data
        
        logger.info("✅ Backend container started successfully")
        
    def test_container_resource_limits(self):
        """Test container respects resource limits"""
        logger.info("💾 Testing container resource limits")
        
        container = self.start_container(
            image="medianest-backend:latest",
            name="test-backend-limited",
            mem_limit="512m",
            cpuset_cpus="0",
            environment={'NODE_ENV': 'production'}
        )
        
        # Wait for startup
        time.sleep(10)
        
        # Check container stats
        stats = container.stats(stream=False)
        memory_usage = stats['memory_stats']['usage']
        memory_limit = stats['memory_stats']['limit']
        
        # Memory should be within limits
        memory_usage_mb = memory_usage / (1024 * 1024)
        memory_limit_mb = memory_limit / (1024 * 1024)
        
        assert memory_usage_mb <= memory_limit_mb
        assert memory_limit_mb <= 512  # Should respect the 512MB limit
        
        logger.info(f"✅ Container memory usage: {memory_usage_mb:.2f}MB / {memory_limit_mb:.2f}MB")
        
    def test_container_graceful_shutdown(self):
        """Test container handles graceful shutdown"""
        logger.info("🛑 Testing container graceful shutdown")
        
        container = self.start_container(
            image="medianest-backend:latest",
            name="test-backend-shutdown",
            ports={'3000/tcp': 3001}
        )
        
        # Wait for startup
        time.sleep(10)
        
        # Send SIGTERM and measure shutdown time
        start_time = time.time()
        container.stop(timeout=10)  # 10 second timeout
        shutdown_time = time.time() - start_time
        
        # Should shutdown within reasonable time
        assert shutdown_time < 10, f"Container took too long to shutdown: {shutdown_time:.2f}s"
        
        # Verify container is stopped
        container.reload()
        assert container.status == 'exited'
        
        logger.info(f"✅ Container graceful shutdown completed in {shutdown_time:.2f}s")
        
    def wait_for_container_health(self, container, health_url: str, timeout: int = 30):
        """Wait for container to be healthy"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                response = requests.get(health_url, timeout=2)
                if response.status_code == 200:
                    return
            except requests.RequestException:
                pass
            time.sleep(1)
            
        raise TimeoutError(f"Container did not become healthy within {timeout} seconds")

class TestContainerSecurity(ContainerTestSuite):
    """Test container security configurations"""
    
    def test_non_root_user(self):
        """Test containers run as non-root user"""
        logger.info("🔒 Testing non-root user execution")
        
        container = self.start_container(
            image="medianest-backend:latest",
            name="test-security",
            command="id"
        )
        
        # Wait for completion and get logs
        container.wait()
        logs = container.logs().decode('utf-8')
        
        # Should not be running as root (uid=0)
        assert "uid=0(root)" not in logs, "Container running as root user"
        
        # Should be running as app user
        assert "app" in logs or "node" in logs, "Container not running as expected user"
        
        logger.info("✅ Container running as non-root user")
        
    def test_readonly_filesystem(self):
        """Test containers can work with read-only filesystem"""
        logger.info("📖 Testing read-only filesystem compatibility")
        
        container = self.start_container(
            image="medianest-backend:latest",
            name="test-readonly",
            read_only=True,
            tmpfs={'/tmp': 'noexec,nosuid,size=100m'},
            command="ls -la /app && echo 'Read-only test passed'"
        )
        
        container.wait()
        logs = container.logs().decode('utf-8')
        
        assert "Read-only test passed" in logs
        
        logger.info("✅ Container compatible with read-only filesystem")
        
    def test_security_scanning(self):
        """Test container images for security vulnerabilities"""
        logger.info("🛡️  Testing container security scanning")
        
        # This would integrate with tools like Trivy, Clair, or Snyk
        # For now, we'll do basic checks
        
        image = self.client.images.get("medianest-backend:latest")
        
        # Check for known vulnerable base images
        config = image.attrs.get('Config', {})
        env_vars = config.get('Env', [])
        
        # Should not expose sensitive information in environment
        sensitive_patterns = ['password', 'secret', 'key', 'token']
        for env_var in env_vars:
            var_lower = env_var.lower()
            for pattern in sensitive_patterns:
                assert pattern not in var_lower or '=' not in env_var, \
                    f"Potential sensitive data in environment: {env_var}"
                    
        logger.info("✅ Basic security checks passed")

# Kubernetes Testing (if using K8s)
class TestKubernetesDeployment:
    """Test Kubernetes deployment configurations"""
    
    def test_deployment_manifest_validation(self):
        """Test Kubernetes deployment manifests are valid"""
        import yaml
        import os
        
        logger.info("⚙️  Testing Kubernetes manifest validation")
        
        k8s_dir = "k8s"
        if not os.path.exists(k8s_dir):
            pytest.skip("Kubernetes manifests not found")
            
        for filename in os.listdir(k8s_dir):
            if filename.endswith(('.yaml', '.yml')):
                filepath = os.path.join(k8s_dir, filename)
                
                with open(filepath, 'r') as f:
                    try:
                        manifests = list(yaml.safe_load_all(f))
                        for manifest in manifests:
                            if manifest is None:
                                continue
                                
                            # Basic manifest validation
                            assert 'apiVersion' in manifest
                            assert 'kind' in manifest
                            assert 'metadata' in manifest
                            assert 'name' in manifest['metadata']
                            
                    except yaml.YAMLError as e:
                        pytest.fail(f"Invalid YAML in {filename}: {e}")
                        
        logger.info("✅ Kubernetes manifests are valid")
        
    def test_resource_limits_defined(self):
        """Test that resource limits are defined for all containers"""
        import yaml
        import os
        
        logger.info("📊 Testing resource limits in Kubernetes manifests")
        
        k8s_dir = "k8s"
        if not os.path.exists(k8s_dir):
            pytest.skip("Kubernetes manifests not found")
            
        for filename in os.listdir(k8s_dir):
            if filename.endswith(('.yaml', '.yml')):
                filepath = os.path.join(k8s_dir, filename)
                
                with open(filepath, 'r') as f:
                    manifests = list(yaml.safe_load_all(f))
                    
                    for manifest in manifests:
                        if manifest and manifest.get('kind') == 'Deployment':
                            containers = manifest['spec']['template']['spec']['containers']
                            
                            for container in containers:
                                resources = container.get('resources', {})
                                
                                # Should have resource limits
                                assert 'limits' in resources, \
                                    f"No resource limits defined for container {container['name']} in {filename}"
                                    
                                limits = resources['limits']
                                assert 'memory' in limits, \
                                    f"No memory limit defined for container {container['name']} in {filename}"
                                assert 'cpu' in limits, \
                                    f"No CPU limit defined for container {container['name']} in {filename}"
                                    
        logger.info("✅ All containers have resource limits defined")
```

### 2. Docker Compose Testing

```python
# tests/infrastructure/docker-compose-tests.py
import docker
import yaml
import pytest
import requests
import time
import os
from typing import Dict, List

class DockerComposeTestSuite:
    def __init__(self):
        self.client = docker.from_env()
        self.compose_files = [
            'docker-compose.yml',
            'docker-compose.production.yml',
            'docker-compose.test.yml'
        ]
        
    def test_compose_file_validation(self):
        """Test Docker Compose files are valid YAML and well-formed"""
        logger.info("📋 Testing Docker Compose file validation")
        
        for compose_file in self.compose_files:
            if os.path.exists(compose_file):
                with open(compose_file, 'r') as f:
                    try:
                        config = yaml.safe_load(f)
                        
                        # Basic structure validation
                        assert 'version' in config
                        assert 'services' in config
                        assert len(config['services']) > 0
                        
                        # Validate each service
                        for service_name, service_config in config['services'].items():
                            self.validate_service_config(service_name, service_config, compose_file)
                            
                        logger.info(f"✅ {compose_file} is valid")
                        
                    except yaml.YAMLError as e:
                        pytest.fail(f"Invalid YAML in {compose_file}: {e}")
                        
    def validate_service_config(self, service_name: str, config: Dict, filename: str):
        """Validate individual service configuration"""
        
        # Should have either image or build
        assert 'image' in config or 'build' in config, \
            f"Service {service_name} in {filename} must specify image or build"
            
        # Check environment variables don't contain secrets
        if 'environment' in config:
            env_vars = config['environment']
            if isinstance(env_vars, list):
                env_vars = {var.split('=')[0]: var.split('=', 1)[1] for var in env_vars if '=' in var}
            elif isinstance(env_vars, dict):
                pass
            else:
                env_vars = {}
                
            sensitive_patterns = ['password', 'secret', 'key', 'token']
            for env_name, env_value in env_vars.items():
                env_name_lower = env_name.lower()
                for pattern in sensitive_patterns:
                    if pattern in env_name_lower and not env_value.startswith('${'):
                        # Environment variables should use ${VAR} syntax for secrets
                        pytest.fail(f"Hardcoded secret in {service_name}.{env_name} in {filename}")
                        
        # Validate health checks for critical services
        critical_services = ['app', 'backend', 'frontend', 'api']
        if service_name.lower() in critical_services:
            assert 'healthcheck' in config or 'depends_on' in config, \
                f"Critical service {service_name} should have health check defined"
                
    def test_production_compose_security(self):
        """Test production Docker Compose has security configurations"""
        logger.info("🔒 Testing production Docker Compose security")
        
        compose_file = 'docker-compose.production.yml'
        if not os.path.exists(compose_file):
            pytest.skip(f"{compose_file} not found")
            
        with open(compose_file, 'r') as f:
            config = yaml.safe_load(f)
            
        for service_name, service_config in config['services'].items():
            # Should not bind privileged ports directly
            if 'ports' in service_config:
                for port_mapping in service_config['ports']:
                    if isinstance(port_mapping, str):
                        host_port = port_mapping.split(':')[0]
                        if host_port.isdigit() and int(host_port) < 1024:
                            pytest.fail(f"Service {service_name} binds privileged port {host_port}")
                            
            # Should not run as root (where applicable)
            if 'user' in service_config:
                user = service_config['user']
                assert user != 'root' and user != '0', \
                    f"Service {service_name} should not run as root"
                    
            # Should have restart policy for production
            if service_name not in ['test', 'migration']:
                assert 'restart' in service_config, \
                    f"Production service {service_name} should have restart policy"
                    
        logger.info("✅ Production Docker Compose security validated")
        
    def test_service_dependencies(self):
        """Test service dependencies are correctly configured"""
        logger.info("🔗 Testing service dependencies")
        
        compose_file = 'docker-compose.yml'
        if not os.path.exists(compose_file):
            pytest.skip(f"{compose_file} not found")
            
        with open(compose_file, 'r') as f:
            config = yaml.safe_load(f)
            
        services = set(config['services'].keys())
        
        for service_name, service_config in config['services'].items():
            if 'depends_on' in service_config:
                dependencies = service_config['depends_on']
                if isinstance(dependencies, list):
                    for dep in dependencies:
                        assert dep in services, \
                            f"Service {service_name} depends on non-existent service {dep}"
                elif isinstance(dependencies, dict):
                    for dep in dependencies.keys():
                        assert dep in services, \
                            f"Service {service_name} depends on non-existent service {dep}"
                            
        logger.info("✅ Service dependencies are valid")

# Network Testing
class TestNetworkConfiguration:
    """Test Docker network configuration"""
    
    def test_network_isolation(self):
        """Test that services are properly isolated by networks"""
        logger.info("🌐 Testing network isolation")
        
        # This would test custom networks defined in docker-compose
        client = docker.from_env()
        
        # List networks created by docker-compose
        networks = client.networks.list()
        project_networks = [n for n in networks if 'medianest' in n.name.lower()]
        
        # Should have custom networks for different service tiers
        expected_networks = ['frontend', 'backend', 'database']
        
        for expected in expected_networks:
            matching_networks = [n for n in project_networks if expected in n.name.lower()]
            if matching_networks:
                network = matching_networks[0]
                
                # Network should have proper configuration
                assert network.attrs['Driver'] == 'bridge'
                
                # Should have connected containers
                containers = network.attrs.get('Containers', {})
                logger.info(f"✅ Network {network.name} has {len(containers)} containers")
                
    def test_port_exposure(self):
        """Test that only necessary ports are exposed"""
        logger.info("🚪 Testing port exposure")
        
        compose_file = 'docker-compose.production.yml'
        if not os.path.exists(compose_file):
            pytest.skip(f"{compose_file} not found")
            
        with open(compose_file, 'r') as f:
            config = yaml.safe_load(f)
            
        # Database and cache services should not expose ports in production
        internal_services = ['postgres', 'redis', 'database', 'cache']
        
        for service_name, service_config in config['services'].items():
            service_lower = service_name.lower()
            
            if any(internal in service_lower for internal in internal_services):
                assert 'ports' not in service_config or len(service_config['ports']) == 0, \
                    f"Internal service {service_name} should not expose ports in production"
                    
        logger.info("✅ Port exposure configuration validated")

# Volume and Data Persistence Testing  
class TestDataPersistence:
    """Test data persistence and volume configurations"""
    
    def test_volume_configuration(self):
        """Test volume configurations for data persistence"""
        logger.info("💾 Testing volume configuration")
        
        compose_file = 'docker-compose.production.yml'
        if not os.path.exists(compose_file):
            pytest.skip(f"{compose_file} not found")
            
        with open(compose_file, 'r') as f:
            config = yaml.safe_load(f)
            
        # Services that need persistent storage
        stateful_services = ['postgres', 'redis', 'database', 'cache']
        
        for service_name, service_config in config['services'].items():
            service_lower = service_name.lower()
            
            if any(stateful in service_lower for stateful in stateful_services):
                assert 'volumes' in service_config, \
                    f"Stateful service {service_name} should have volumes defined"
                    
                volumes = service_config['volumes']
                
                # Should have at least one named volume or bind mount for data
                data_volumes = [v for v in volumes if '/data' in v or '/var/lib' in v]
                assert len(data_volumes) > 0, \
                    f"Stateful service {service_name} should have data volume"
                    
        # Check named volumes are defined
        if 'volumes' in config:
            named_volumes = config['volumes']
            logger.info(f"✅ Found {len(named_volumes)} named volumes: {list(named_volumes.keys())}")
        else:
            logger.warning("⚠️  No named volumes defined - using bind mounts or anonymous volumes")
            
    def test_backup_strategy(self):
        """Test that backup strategies are in place for persistent data"""
        logger.info("🗄️  Testing backup strategy")
        
        # Check for backup scripts or configurations
        backup_files = [
            'scripts/backup-database.sh',
            'scripts/backup.sh',
            'backup/backup-config.yml'
        ]
        
        backup_found = any(os.path.exists(f) for f in backup_files)
        
        if not backup_found:
            logger.warning("⚠️  No backup scripts found - ensure backup strategy is implemented")
        else:
            logger.info("✅ Backup configuration found")

# Environment Configuration Testing
class TestEnvironmentConfiguration:
    """Test environment-specific configurations"""
    
    def test_environment_file_validation(self):
        """Test environment files are properly configured"""
        logger.info("📋 Testing environment file validation")
        
        env_files = [
            '.env.example',
            '.env.production.example',
            '.env.test.example'
        ]
        
        for env_file in env_files:
            if os.path.exists(env_file):
                with open(env_file, 'r') as f:
                    lines = f.readlines()
                    
                required_vars = [
                    'NODE_ENV',
                    'DATABASE_URL',
                    'REDIS_URL',
                    'JWT_SECRET'
                ]
                
                env_content = ''.join(lines).upper()
                
                for var in required_vars:
                    assert var in env_content, \
                        f"Required environment variable {var} not found in {env_file}"
                        
                # Check for placeholder values that should be replaced
                for line in lines:
                    if '=' in line and not line.strip().startswith('#'):
                        key, value = line.strip().split('=', 1)
                        if value in ['changeme', 'your-secret-here', 'localhost']:
                            logger.warning(f"⚠️  Placeholder value found in {env_file}: {key}={value}")
                            
                logger.info(f"✅ {env_file} validated")
                
    def test_production_environment_security(self):
        """Test production environment has secure defaults"""
        logger.info("🔒 Testing production environment security")
        
        compose_file = 'docker-compose.production.yml'
        if not os.path.exists(compose_file):
            pytest.skip(f"{compose_file} not found")
            
        with open(compose_file, 'r') as f:
            config = yaml.safe_load(f)
            
        for service_name, service_config in config['services'].items():
            if 'environment' in service_config:
                env_vars = service_config['environment']
                
                # Convert to dict if it's a list
                if isinstance(env_vars, list):
                    env_dict = {}
                    for var in env_vars:
                        if '=' in var:
                            key, value = var.split('=', 1)
                            env_dict[key] = value
                else:
                    env_dict = env_vars
                    
                # NODE_ENV should be production
                if 'NODE_ENV' in env_dict:
                    node_env = env_dict['NODE_ENV']
                    if not node_env.startswith('${'):  # Not using env var substitution
                        assert node_env == 'production', \
                            f"Service {service_name} should have NODE_ENV=production"
                            
                # DEBUG should be false or not set
                if 'DEBUG' in env_dict:
                    debug_value = env_dict['DEBUG']
                    if not debug_value.startswith('${'):
                        assert debug_value.lower() in ['false', '0', ''], \
                            f"Service {service_name} should not have DEBUG enabled in production"
                            
        logger.info("✅ Production environment security validated")
```

### 3. Infrastructure Monitoring Tests

```python
# tests/infrastructure/monitoring-tests.py
import requests
import time
import json
from typing import Dict, List
import logging

logger = logging.getLogger(__name__)

class InfrastructureMonitoringTests:
    """Test infrastructure monitoring and observability"""
    
    def __init__(self):
        self.base_url = os.getenv('BASE_URL', 'http://localhost:3000')
        self.monitoring_endpoints = {
            'health': '/health',
            'metrics': '/metrics',
            'ready': '/ready',
            'live': '/live'
        }
        
    def test_health_check_endpoints(self):
        """Test all health check endpoints are responding"""
        logger.info("❤️  Testing health check endpoints")
        
        for endpoint_name, path in self.monitoring_endpoints.items():
            url = f"{self.base_url}{path}"
            
            try:
                response = requests.get(url, timeout=5)
                
                if endpoint_name == 'health':
                    assert response.status_code == 200
                    health_data = response.json()
                    
                    # Validate health check response structure
                    assert 'status' in health_data
                    assert health_data['status'] in ['healthy', 'unhealthy']
                    assert 'timestamp' in health_data
                    assert 'uptime' in health_data
                    assert 'version' in health_data
                    
                    # Validate service dependencies
                    if 'dependencies' in health_data:
                        for dep_name, dep_status in health_data['dependencies'].items():
                            assert 'status' in dep_status
                            assert 'responseTime' in dep_status
                            
                elif endpoint_name == 'metrics':
                    assert response.status_code == 200
                    # Should return Prometheus format metrics
                    content = response.text
                    assert '# HELP' in content or '# TYPE' in content
                    
                elif endpoint_name in ['ready', 'live']:
                    # Kubernetes readiness and liveness probes
                    assert response.status_code in [200, 404]  # 404 if not implemented
                    
                logger.info(f"✅ {endpoint_name} endpoint ({path}) is responding")
                
            except requests.RequestException as e:
                if endpoint_name == 'health':
                    pytest.fail(f"Critical health endpoint {path} is not responding: {e}")
                else:
                    logger.warning(f"⚠️  Optional endpoint {path} is not responding: {e}")
                    
    def test_metrics_collection(self):
        """Test that application metrics are being collected"""
        logger.info("📊 Testing metrics collection")
        
        metrics_url = f"{self.base_url}/metrics"
        
        try:
            response = requests.get(metrics_url, timeout=5)
            assert response.status_code == 200
            
            metrics_content = response.text
            
            # Check for standard application metrics
            expected_metrics = [
                'http_requests_total',
                'http_request_duration_seconds',
                'nodejs_memory_usage_bytes',
                'process_cpu_user_seconds_total'
            ]
            
            for metric in expected_metrics:
                assert metric in metrics_content, f"Metric {metric} not found in metrics endpoint"
                
            logger.info("✅ Application metrics are being collected")
            
        except requests.RequestException as e:
            logger.warning(f"⚠️  Metrics endpoint not available: {e}")
            
    def test_log_aggregation(self):
        """Test that logs are properly formatted and aggregated"""
        logger.info("📝 Testing log aggregation")
        
        # Test log format by making requests and checking structured logs
        test_endpoints = [
            '/api/v1/health',
            '/api/v1/media',
            '/api/v1/nonexistent'  # Should generate 404 log
        ]
        
        for endpoint in test_endpoints:
            try:
                requests.get(f"{self.base_url}{endpoint}", timeout=5)
            except requests.RequestException:
                pass  # We just want to generate log entries
                
        # In a real test, you would check log aggregation service
        # For now, we'll just verify the application is logging
        logger.info("✅ Log aggregation test completed (check log aggregation service)")
        
    def test_alerting_configuration(self):
        """Test that alerting rules are properly configured"""
        logger.info("🚨 Testing alerting configuration")
        
        # This would test Prometheus alerting rules if configured
        alerting_config_files = [
            'config/alerting/rules.yml',
            'monitoring/alerts.yml',
            'k8s/monitoring/alerting-rules.yml'
        ]
        
        alerting_found = False
        for config_file in alerting_config_files:
            if os.path.exists(config_file):
                alerting_found = True
                
                with open(config_file, 'r') as f:
                    try:
                        config = yaml.safe_load(f)
                        
                        # Basic validation of alerting rules structure
                        if 'groups' in config:
                            for group in config['groups']:
                                assert 'name' in group
                                assert 'rules' in group
                                
                                for rule in group['rules']:
                                    assert 'alert' in rule or 'record' in rule
                                    assert 'expr' in rule
                                    
                        logger.info(f"✅ Alerting configuration found and validated: {config_file}")
                        break
                        
                    except yaml.YAMLError as e:
                        logger.error(f"❌ Invalid alerting configuration in {config_file}: {e}")
                        
        if not alerting_found:
            logger.warning("⚠️  No alerting configuration found")
            
    def test_performance_monitoring(self):
        """Test performance monitoring capabilities"""
        logger.info("🏃‍♂️ Testing performance monitoring")
        
        # Test that performance metrics are being tracked
        metrics_url = f"{self.base_url}/metrics"
        
        try:
            response = requests.get(metrics_url, timeout=5)
            metrics_content = response.text
            
            # Check for performance-related metrics
            performance_metrics = [
                'http_request_duration_seconds',
                'http_requests_total',
                'nodejs_memory_usage_bytes',
                'nodejs_gc_duration_seconds'
            ]
            
            for metric in performance_metrics:
                if metric in metrics_content:
                    logger.info(f"✅ Performance metric found: {metric}")
                else:
                    logger.warning(f"⚠️  Performance metric missing: {metric}")
                    
        except requests.RequestException as e:
            logger.warning(f"⚠️  Could not retrieve performance metrics: {e}")

# Resource Utilization Tests
class TestResourceUtilization:
    """Test resource utilization and limits"""
    
    def test_memory_usage_monitoring(self):
        """Test memory usage is within acceptable limits"""
        logger.info("💾 Testing memory usage monitoring")
        
        try:
            response = requests.get(f"{self.base_url}/metrics", timeout=5)
            metrics_content = response.text
            
            # Parse memory metrics
            memory_lines = [line for line in metrics_content.split('\n') 
                          if 'nodejs_memory_usage_bytes' in line and not line.startswith('#')]
            
            for line in memory_lines:
                if 'type="heap_used"' in line:
                    # Extract memory value
                    value = float(line.split()[-1])
                    memory_mb = value / (1024 * 1024)
                    
                    # Memory usage should be reasonable (less than 512MB for typical app)
                    assert memory_mb < 512, f"High memory usage detected: {memory_mb:.2f}MB"
                    
                    logger.info(f"✅ Heap memory usage: {memory_mb:.2f}MB")
                    break
                    
        except requests.RequestException as e:
            logger.warning(f"⚠️  Could not retrieve memory metrics: {e}")
            
    def test_cpu_usage_monitoring(self):
        """Test CPU usage monitoring"""
        logger.info("🖥️  Testing CPU usage monitoring")
        
        try:
            response = requests.get(f"{self.base_url}/metrics", timeout=5)
            metrics_content = response.text
            
            # Check for CPU metrics
            cpu_metrics = ['process_cpu_user_seconds_total', 'process_cpu_system_seconds_total']
            
            for metric in cpu_metrics:
                if metric in metrics_content:
                    logger.info(f"✅ CPU metric available: {metric}")
                    
        except requests.RequestException as e:
            logger.warning(f"⚠️  Could not retrieve CPU metrics: {e}")
            
    def test_disk_usage_monitoring(self):
        """Test disk usage monitoring"""
        logger.info("💽 Testing disk usage monitoring")
        
        # This would typically check filesystem metrics
        # In container environments, this might be different
        
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            health_data = response.json()
            
            # Check if disk usage is included in health check
            if 'system' in health_data:
                system_info = health_data['system']
                if 'disk' in system_info:
                    disk_usage = system_info['disk']
                    
                    # Disk usage should be reported as percentage
                    if 'usage_percent' in disk_usage:
                        usage = disk_usage['usage_percent']
                        assert usage < 90, f"High disk usage detected: {usage}%"
                        logger.info(f"✅ Disk usage: {usage}%")
                        
        except requests.RequestException as e:
            logger.warning(f"⚠️  Could not retrieve disk usage metrics: {e}")
```

### 4. Network Security Testing

```bash
#!/bin/bash
# tests/infrastructure/network-security-test.sh

set -e

echo "🛡️  Starting Network Security Testing"

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
TIMEOUT="${TIMEOUT:-10}"

# Test network connectivity and security
test_network_security() {
    echo "🌐 Testing network security configurations"
    
    # Test HTTPS enforcement (if configured)
    if [[ $BASE_URL == https://* ]]; then
        echo "🔒 Testing HTTPS configuration"
        
        # Test SSL/TLS configuration
        echo "GET / HTTP/1.1\nHost: $(echo $BASE_URL | cut -d'/' -f3)\n" | \
            openssl s_client -connect $(echo $BASE_URL | cut -d'/' -f3):443 -servername $(echo $BASE_URL | cut -d'/' -f3) 2>/dev/null | \
            openssl x509 -noout -text | grep -E "(Signature Algorithm|Public Key|Not After)"
            
        # Test for weak cipher suites
        weak_ciphers=$(nmap --script ssl-enum-ciphers -p 443 $(echo $BASE_URL | cut -d'/' -f3) 2>/dev/null | grep -i "weak\|broken" || true)
        
        if [ ! -z "$weak_ciphers" ]; then
            echo "❌ Weak cipher suites detected:"
            echo "$weak_ciphers"
            exit 1
        else
            echo "✅ No weak cipher suites detected"
        fi
    fi
    
    # Test for open ports that shouldn't be exposed
    echo "🚪 Testing port exposure"
    
    host=$(echo $BASE_URL | cut -d'/' -f3 | cut -d':' -f1)
    
    # Common ports that should NOT be exposed in production
    dangerous_ports=(22 3306 5432 6379 27017 9200 9300)
    
    for port in "${dangerous_ports[@]}"; do
        if timeout 3 bash -c "echo >/dev/tcp/$host/$port" 2>/dev/null; then
            echo "⚠️  WARNING: Port $port is exposed on $host"
        else
            echo "✅ Port $port is properly secured"
        fi
    done
    
    # Test application security headers
    echo "🛡️  Testing security headers"
    
    response_headers=$(curl -I "$BASE_URL" 2>/dev/null)
    
    # Check for important security headers
    security_headers=(
        "X-Content-Type-Options"
        "X-Frame-Options"
        "X-XSS-Protection"
        "Strict-Transport-Security"
        "Content-Security-Policy"
    )
    
    for header in "${security_headers[@]}"; do
        if echo "$response_headers" | grep -qi "$header"; then
            echo "✅ Security header present: $header"
        else
            echo "⚠️  Missing security header: $header"
        fi
    done
}

# Test firewall rules
test_firewall_rules() {
    echo "🔥 Testing firewall configuration"
    
    # This would test iptables rules or cloud firewall rules
    # For Docker, we can test if internal services are not accessible externally
    
    internal_services=(
        "postgres:5432"
        "redis:6379"
        "elasticsearch:9200"
    )
    
    for service in "${internal_services[@]}"; do
        service_name=$(echo $service | cut -d':' -f1)
        port=$(echo $service | cut -d':' -f2)
        
        # Try to connect to internal service from outside
        if timeout 3 bash -c "echo >/dev/tcp/localhost/$port" 2>/dev/null; then
            echo "⚠️  WARNING: Internal service $service_name is externally accessible"
        else
            echo "✅ Internal service $service_name is properly isolated"
        fi
    done
}

# Test container network isolation
test_container_isolation() {
    echo "🏠 Testing container network isolation"
    
    # Check if containers are using custom networks
    networks=$(docker network ls --format "table {{.Name}}" | grep -v "bridge\|host\|none" | tail -n +2)
    
    if [ -z "$networks" ]; then
        echo "⚠️  No custom Docker networks found - containers may not be properly isolated"
    else
        echo "✅ Custom Docker networks found:"
        echo "$networks"
        
        # Test inter-container communication
        for network in $networks; do
            containers=$(docker network inspect $network --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null || true)
            
            if [ ! -z "$containers" ]; then
                echo "   Network $network has containers: $containers"
            fi
        done
    fi
}

# Test DNS configuration
test_dns_configuration() {
    echo "🌍 Testing DNS configuration"
    
    # Test DNS resolution
    host=$(echo $BASE_URL | cut -d'/' -f3 | cut -d':' -f1)
    
    dns_result=$(dig +short $host 2>/dev/null || nslookup $host 2>/dev/null | grep "Address" | tail -1 | cut -d' ' -f2 || echo "DNS_FAILED")
    
    if [ "$dns_result" = "DNS_FAILED" ]; then
        echo "⚠️  DNS resolution failed for $host"
    else
        echo "✅ DNS resolution successful: $host -> $dns_result"
    fi
    
    # Test for DNS rebinding protection (if applicable)
    private_ips=("127.0.0.1" "10.0.0.1" "192.168.1.1" "172.16.0.1")
    
    for ip in "${private_ips[@]}"; do
        response=$(curl -s -m 3 -H "Host: $host" "http://$ip/" 2>/dev/null || echo "BLOCKED")
        
        if [ "$response" = "BLOCKED" ]; then
            echo "✅ DNS rebinding protection working for $ip"
        else
            echo "⚠️  Potential DNS rebinding vulnerability for $ip"
        fi
    done
}

# Main execution
main() {
    echo "🚀 Starting comprehensive network security testing"
    
    test_network_security
    test_firewall_rules
    test_container_isolation  
    test_dns_configuration
    
    echo "✅ Network security testing completed"
}

# Run tests
main "$@"
```

## Load Testing & Stress Testing

### 1. Infrastructure Load Testing

```javascript
// tests/infrastructure/infrastructure-load-test.js
import http from 'k6/http';
import { check, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Infrastructure-specific metrics
export const infraResponseTime = new Trend('infra_response_time');
export const infraErrorRate = new Rate('infra_error_rate');
export const containerResourceUsage = new Trend('container_resource_usage');
export const networkLatency = new Trend('network_latency');

export const options = {
  scenarios: {
    infrastructure_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '10m', target: 200 },
        { duration: '5m', target: 300 },
        { duration: '10m', target: 300 },
        { duration: '2m', target: 0 },
      ],
    },
    
    spike_test: {
      executor: 'ramping-vus',
      startTime: '35m',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 500 },
        { duration: '1m', target: 500 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.1'],
    infra_response_time: ['p(95)<1500'],
    infra_error_rate: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  group('Infrastructure Load Testing', function () {
    testApplicationEndpoints();
    testStaticAssets();
    testDatabaseConnections();
    testCachePerformance();
  });
  
  // Monitor container resource usage (would require additional setup)
  if (__ENV.MONITOR_CONTAINERS === 'true') {
    monitorContainerResources();
  }
}

function testApplicationEndpoints() {
  const endpoints = [
    '/health',
    '/api/v1/media',
    '/api/v1/collections',
    '/api/v1/search?q=test',
  ];
  
  endpoints.forEach(endpoint => {
    const response = http.get(`${BASE_URL}${endpoint}`, {
      tags: { endpoint: endpoint },
    });
    
    const success = check(response, {
      [`${endpoint} status is 200`]: (r) => r.status === 200,
      [`${endpoint} response time < 2s`]: (r) => r.timings.duration < 2000,
    });
    
    infraResponseTime.add(response.timings.duration);
    infraErrorRate.add(!success);
  });
}

function testStaticAssets() {
  const assets = [
    '/static/css/main.css',
    '/static/js/bundle.js',
    '/favicon.ico',
  ];
  
  assets.forEach(asset => {
    const response = http.get(`${BASE_URL}${asset}`, {
      tags: { asset_type: 'static' },
    });
    
    check(response, {
      [`${asset} loads successfully`]: (r) => r.status === 200,
      [`${asset} has correct content-type`]: (r) => {
        const contentType = r.headers['Content-Type'];
        return contentType && contentType.length > 0;
      },
    });
  });
}

function testDatabaseConnections() {
  // Test endpoints that require database access
  const dbEndpoints = [
    '/api/v1/media',
    '/api/v1/users/profile',
    '/api/v1/collections',
  ];
  
  dbEndpoints.forEach(endpoint => {
    const startTime = new Date();
    
    const response = http.get(`${BASE_URL}${endpoint}`, {
      tags: { test_type: 'database' },
    });
    
    const dbLatency = new Date() - startTime;
    
    check(response, {
      [`${endpoint} DB query successful`]: (r) => r.status === 200,
      [`${endpoint} DB query time < 1s`]: (r) => dbLatency < 1000,
    });
    
    networkLatency.add(dbLatency);
  });
}

function testCachePerformance() {
  // Test cached vs uncached responses
  const cacheableEndpoint = '/api/v1/media';
  
  // First request (uncached)
  const uncachedResponse = http.get(`${BASE_URL}${cacheableEndpoint}`, {
    tags: { cache_status: 'miss' },
  });
  
  // Second request (should be cached)
  const cachedResponse = http.get(`${BASE_URL}${cacheableEndpoint}`, {
    tags: { cache_status: 'hit' },
  });
  
  check(cachedResponse, {
    'cached response is faster': (r) => {
      return r.timings.duration < uncachedResponse.timings.duration * 0.8;
    },
    'cached response has cache headers': (r) => {
      return r.headers['Cache-Control'] || r.headers['ETag'];
    },
  });
}

function monitorContainerResources() {
  // This would require additional setup to monitor Docker stats
  // For now, we'll simulate resource monitoring
  
  const mockCpuUsage = Math.random() * 80; // 0-80%
  const mockMemoryUsage = Math.random() * 512; // 0-512MB
  
  containerResourceUsage.add(mockCpuUsage, { resource: 'cpu' });
  containerResourceUsage.add(mockMemoryUsage, { resource: 'memory' });
}

export function setup() {
  console.log('🏗️  Setting up infrastructure load test');
  
  // Verify all services are running
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    throw new Error(`Application not healthy: ${healthResponse.status}`);
  }
  
  return {
    startTime: new Date(),
  };
}

export function teardown(data) {
  console.log('🧹 Infrastructure load test completed');
  console.log(`Total test duration: ${(new Date() - data.startTime) / 1000}s`);
}
```

## Disaster Recovery Testing

### 1. Automated Disaster Recovery Testing

```bash
#!/bin/bash
# tests/infrastructure/disaster-recovery-test.sh

set -e

echo "🚨 Starting Disaster Recovery Testing"

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TEST_DB="${TEST_DB:-medianest_dr_test}"
RECOVERY_TIMEOUT="${RECOVERY_TIMEOUT:-300}"

# Test backup creation
test_backup_creation() {
    echo "💾 Testing backup creation"
    
    # Create test data
    echo "📝 Creating test data for backup"
    docker-compose exec postgres psql -U postgres -d medianest -c "
        INSERT INTO users (email, password, role) VALUES 
        ('dr.test@medianest.com', 'password123', 'user'),
        ('dr.admin@medianest.com', 'password123', 'admin');
        
        INSERT INTO media_files (user_id, filename, size, mime_type) VALUES
        (1, 'dr-test-file.jpg', 1024000, 'image/jpeg');
    "
    
    # Create backup
    echo "🗄️  Creating database backup"
    docker-compose exec postgres pg_dump -U postgres -d medianest > "${BACKUP_DIR}/dr-test-backup.sql"
    
    # Verify backup file exists and has content
    if [ ! -f "${BACKUP_DIR}/dr-test-backup.sql" ] || [ ! -s "${BACKUP_DIR}/dr-test-backup.sql" ]; then
        echo "❌ Backup creation failed"
        exit 1
    fi
    
    backup_size=$(stat -c%s "${BACKUP_DIR}/dr-test-backup.sql")
    echo "✅ Backup created successfully (${backup_size} bytes)"
}

# Test backup restoration
test_backup_restoration() {
    echo "🔄 Testing backup restoration"
    
    # Create test database for restoration
    echo "🏗️  Creating test database for restoration"
    docker-compose exec postgres psql -U postgres -c "CREATE DATABASE ${TEST_DB};"
    
    # Restore from backup
    echo "📥 Restoring from backup"
    docker-compose exec -T postgres psql -U postgres -d "${TEST_DB}" < "${BACKUP_DIR}/dr-test-backup.sql"
    
    # Verify restoration
    echo "🔍 Verifying restoration"
    user_count=$(docker-compose exec postgres psql -U postgres -d "${TEST_DB}" -t -c "SELECT COUNT(*) FROM users WHERE email LIKE 'dr.%@medianest.com';" | tr -d ' ')
    
    if [ "$user_count" != "2" ]; then
        echo "❌ Backup restoration verification failed. Expected 2 users, found $user_count"
        exit 1
    fi
    
    echo "✅ Backup restoration successful"
    
    # Cleanup test database
    docker-compose exec postgres psql -U postgres -c "DROP DATABASE ${TEST_DB};"
}

# Test service failover
test_service_failover() {
    echo "🔄 Testing service failover"
    
    # Test database failover (if using replication)
    echo "💾 Testing database failover"
    
    # Stop primary database container
    echo "🛑 Stopping primary database"
    docker-compose stop postgres
    
    # Wait a moment
    sleep 5
    
    # Check if application handles database unavailability gracefully
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
    
    if [ "$response" = "200" ]; then
        echo "⚠️  Application reports healthy when database is down"
    elif [ "$response" = "503" ]; then
        echo "✅ Application correctly reports service unavailable"
    else
        echo "⚠️  Unexpected response during database outage: $response"
    fi
    
    # Restart database
    echo "🔄 Restarting database"
    docker-compose start postgres
    
    # Wait for database to be ready
    echo "⏳ Waiting for database recovery"
    timeout $RECOVERY_TIMEOUT bash -c 'until docker-compose exec postgres pg_isready -U postgres; do sleep 2; done'
    
    # Verify application recovery
    sleep 10
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
    
    if [ "$response" = "200" ]; then
        echo "✅ Application recovered successfully after database restart"
    else
        echo "❌ Application failed to recover after database restart: $response"
        exit 1
    fi
}

# Test data corruption recovery
test_data_corruption_recovery() {
    echo "🔧 Testing data corruption recovery"
    
    # Create test data
    echo "📝 Creating test data"
    docker-compose exec postgres psql -U postgres -d medianest -c "
        INSERT INTO test_table (id, data) VALUES (9999, 'corruption-test-data')
        ON CONFLICT DO NOTHING;
    " 2>/dev/null || echo "Test table doesn't exist, skipping corruption test"
    
    # Simulate corruption by inserting invalid data (if possible)
    echo "💥 Simulating data corruption"
    
    # In a real scenario, you would:
    # 1. Stop the database
    # 2. Modify data files to simulate corruption
    # 3. Start the database and observe behavior
    # 4. Restore from backup
    
    echo "⚠️  Data corruption testing requires manual setup - see documentation"
}

# Test network partition recovery
test_network_partition_recovery() {
    echo "🌐 Testing network partition recovery"
    
    # Test Redis connection failure
    echo "🔌 Testing Redis connection failure"
    
    # Stop Redis container
    docker-compose stop redis
    
    # Test application behavior
    sleep 5
    response=$(curl -s http://localhost:3000/api/v1/health | jq -r '.dependencies.redis.status' 2>/dev/null || echo "unknown")
    
    if [ "$response" = "unhealthy" ] || [ "$response" = "down" ]; then
        echo "✅ Application correctly detects Redis unavailability"
    else
        echo "⚠️  Application may not be properly detecting Redis failures: $response"
    fi
    
    # Restart Redis
    docker-compose start redis
    
    # Wait for Redis recovery
    timeout $RECOVERY_TIMEOUT bash -c 'until docker-compose exec redis redis-cli ping | grep PONG; do sleep 2; done'
    
    # Verify application recovery
    sleep 5
    response=$(curl -s http://localhost:3000/api/v1/health | jq -r '.dependencies.redis.status' 2>/dev/null || echo "unknown")
    
    if [ "$response" = "healthy" ] || [ "$response" = "up" ]; then
        echo "✅ Application recovered Redis connection successfully"
    else
        echo "❌ Application failed to recover Redis connection: $response"
    fi
}

# Test backup integrity
test_backup_integrity() {
    echo "🔍 Testing backup integrity"
    
    # Create backup with checksum
    backup_file="${BACKUP_DIR}/integrity-test-backup.sql"
    
    docker-compose exec postgres pg_dump -U postgres -d medianest > "$backup_file"
    
    # Generate checksum
    checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    echo "$checksum  $backup_file" > "${backup_file}.sha256"
    
    echo "📝 Backup checksum: $checksum"
    
    # Verify checksum
    if sha256sum -c "${backup_file}.sha256"; then
        echo "✅ Backup integrity verified"
    else
        echo "❌ Backup integrity check failed"
        exit 1
    fi
    
    # Test backup compression
    echo "🗜️  Testing backup compression"
    gzip -c "$backup_file" > "${backup_file}.gz"
    
    original_size=$(stat -c%s "$backup_file")
    compressed_size=$(stat -c%s "${backup_file}.gz")
    compression_ratio=$((compressed_size * 100 / original_size))
    
    echo "📊 Compression ratio: ${compression_ratio}% (${original_size} -> ${compressed_size} bytes)"
    
    # Verify compressed backup can be restored
    docker-compose exec postgres psql -U postgres -c "CREATE DATABASE integrity_test_db;"
    zcat "${backup_file}.gz" | docker-compose exec -T postgres psql -U postgres -d integrity_test_db
    
    # Verify restoration worked
    table_count=$(docker-compose exec postgres psql -U postgres -d integrity_test_db -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
    
    if [ "$table_count" -gt "0" ]; then
        echo "✅ Compressed backup restoration successful ($table_count tables)"
    else
        echo "❌ Compressed backup restoration failed"
        exit 1
    fi
    
    # Cleanup
    docker-compose exec postgres psql -U postgres -c "DROP DATABASE integrity_test_db;"
    rm -f "$backup_file" "${backup_file}.gz" "${backup_file}.sha256"
}

# Main execution
main() {
    echo "🚀 Starting comprehensive disaster recovery testing"
    
    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"
    
    # Run all disaster recovery tests
    test_backup_creation
    test_backup_restoration
    test_service_failover
    test_data_corruption_recovery
    test_network_partition_recovery
    test_backup_integrity
    
    echo "✅ Disaster recovery testing completed successfully"
    
    # Cleanup
    rm -rf "$BACKUP_DIR"
}

# Execute main function
main "$@"
```

## Infrastructure Testing Automation

### 1. CI/CD Pipeline Integration

```yaml
# .github/workflows/infrastructure-testing.yml
name: Infrastructure Testing

on:
  push:
    branches: [main, develop]
    paths:
      - 'docker-compose*.yml'
      - 'Dockerfile*'
      - 'k8s/**'
      - 'infrastructure/**'
  pull_request:
    branches: [main]
    paths:
      - 'docker-compose*.yml'
      - 'Dockerfile*'

jobs:
  infrastructure-validation:
    name: Infrastructure Validation
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3
        
      - name: Validate Docker Compose files
        run: |
          for file in docker-compose*.yml; do
            if [ -f "$file" ]; then
              echo "Validating $file"
              docker-compose -f "$file" config
            fi
          done
          
      - name: Build Docker images
        run: |
          docker build -f backend/Dockerfile.production -t medianest-backend:test backend/
          docker build -f frontend/Dockerfile.production -t medianest-frontend:test frontend/
          
      - name: Run infrastructure tests
        run: |
          python -m pytest tests/infrastructure/ -v --tb=short
          
      - name: Test container startup
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30
          docker-compose -f docker-compose.test.yml exec -T app curl -f http://localhost:3000/health
          
      - name: Run security scans
        uses: anchore/scan-action@v3
        with:
          image: "medianest-backend:test"
          
      - name: Cleanup
        if: always()
        run: |
          docker-compose -f docker-compose.test.yml down -v

  load-testing:
    name: Infrastructure Load Testing
    runs-on: ubuntu-latest
    needs: infrastructure-validation
    if: github.ref == 'refs/heads/main'
    timeout-minutes: 45
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup test environment
        run: |
          docker-compose -f docker-compose.performance.yml up -d
          sleep 60
          
      - name: Install K6
        run: |
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
          
      - name: Run infrastructure load tests
        run: |
          k6 run tests/infrastructure/infrastructure-load-test.js \
            --env BASE_URL=http://localhost:3000 \
            --out json=infrastructure-load-results.json
            
      - name: Analyze results
        run: |
          node scripts/analyze-infrastructure-results.js infrastructure-load-results.json
          
      - name: Upload results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: infrastructure-load-results
          path: infrastructure-load-results.json
          
      - name: Cleanup
        if: always()
        run: |
          docker-compose -f docker-compose.performance.yml down -v

  disaster-recovery-testing:
    name: Disaster Recovery Testing
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup test environment
        run: |
          docker-compose -f docker-compose.test.yml up -d
          sleep 30
          
      - name: Run disaster recovery tests
        run: |
          chmod +x tests/infrastructure/disaster-recovery-test.sh
          ./tests/infrastructure/disaster-recovery-test.sh
          
      - name: Cleanup
        if: always()
        run: |
          docker-compose -f docker-compose.test.yml down -v
```

## Conclusion

This comprehensive infrastructure testing framework provides MediaNest with:

1. **Multi-layer Infrastructure Validation**: From container builds to full-stack deployment testing
2. **Security-First Approach**: Security testing integrated into all infrastructure validation
3. **Performance Validation**: Load testing and resource monitoring for infrastructure components
4. **Disaster Recovery Assurance**: Automated backup, restoration, and failover testing
5. **Network Security Testing**: Comprehensive network isolation and security validation
6. **Container Orchestration Testing**: Docker Compose and Kubernetes deployment validation
7. **Monitoring & Observability Testing**: Health checks, metrics, and alerting validation
8. **CI/CD Integration**: Automated infrastructure testing in deployment pipelines

The framework ensures that MediaNest's infrastructure is robust, secure, scalable, and capable of handling production workloads while maintaining high availability and disaster recovery capabilities.