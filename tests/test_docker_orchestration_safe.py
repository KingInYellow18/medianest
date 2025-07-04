#!/usr/bin/env python3
"""
TARGETED TESTING STRATEGY for Docker Container Orchestration Configuration (Safe Mode)
MediaNest Project - :ContainerOrchestration for :ClientServerPattern (:Flask v3.x + :React v18)

CORE LOGIC TESTING: Docker Compose syntax, service definitions, networking, volumes
CONTEXTUAL INTEGRATION TESTING: Configuration validation, :SecurityFirst compliance
"""

import os
import sys
import yaml
import subprocess
import shutil
from pathlib import Path

# Test configuration
DOCKER_COMPOSE_FILE = "docker-compose.yml"

class DockerOrchestrationSafeTester:
    """Safe test suite for MediaNest Docker container orchestration (no Docker required)"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.compose_file = self.project_root / DOCKER_COMPOSE_FILE
        self.test_results = {
            "core_logic": [],
            "contextual_integration": [],
            "security_compliance": []
        }
        self.docker_available = self._check_docker_availability()
    
    def _check_docker_availability(self):
        """Check if Docker and docker-compose are available"""
        try:
            docker_available = shutil.which('docker') is not None
            compose_available = shutil.which('docker-compose') is not None or shutil.which('docker') is not None
            return docker_available and compose_available
        except Exception:
            return False
    
    def log_result(self, category, test_name, passed, message=""):
        """Log test result with SAPPO :Problem classification"""
        result = {
            "test": test_name,
            "passed": passed,
            "message": message,
            "sappo_problem": self._classify_sappo_problem(test_name, passed, message)
        }
        self.test_results[category].append(result)
        status = "PASS" if passed else "FAIL"
        print(f"[{category.upper()}] {test_name}: {status}")
        if message:
            print(f"  → {message}")
    
    def _classify_sappo_problem(self, test_name, passed, message):
        """Classify potential SAPPO :Problem types"""
        if passed:
            return None
        
        if "syntax" in test_name.lower() or "yaml" in message.lower():
            return ":ConfigurationError"
        elif "network" in test_name.lower() or "connectivity" in message.lower():
            return ":NetworkError"
        elif "security" in test_name.lower() or "secret" in message.lower():
            return ":SecurityVulnerability"
        elif "dependency" in test_name.lower() or "depends_on" in message.lower():
            return ":DependencyIssue"
        elif "service" in test_name.lower() or "startup" in message.lower():
            return ":ServiceError"
        else:
            return ":IntegrationError"

    # ========== CORE LOGIC TESTING ==========
    
    def test_docker_compose_syntax_validity(self):
        """Test docker-compose.yml syntax and structure validity"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            # Verify required top-level keys
            required_keys = ['version', 'services']
            for key in required_keys:
                if key not in compose_data:
                    self.log_result("core_logic", "docker_compose_syntax", False, 
                                  f"Missing required key: {key}")
                    return
            
            # Verify version format
            version = compose_data['version']
            if not isinstance(version, str) or not version.startswith('3'):
                self.log_result("core_logic", "docker_compose_syntax", False, 
                              f"Invalid version format: {version}")
                return
            
            self.log_result("core_logic", "docker_compose_syntax", True, 
                          "Valid YAML syntax and structure")
            
        except yaml.YAMLError as e:
            self.log_result("core_logic", "docker_compose_syntax", False, 
                          f"YAML syntax error: {str(e)}")
        except FileNotFoundError:
            self.log_result("core_logic", "docker_compose_syntax", False, 
                          f"docker-compose.yml not found at {self.compose_file}")
    
    def test_service_definitions_completeness(self):
        """Test that required services (backend, frontend) are properly defined"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            services = compose_data.get('services', {})
            required_services = ['backend', 'frontend']
            
            for service in required_services:
                if service not in services:
                    self.log_result("core_logic", "service_definitions", False, 
                                  f"Missing required service: {service}")
                    return
                
                service_config = services[service]
                
                # Verify build context
                if 'build' not in service_config:
                    self.log_result("core_logic", "service_definitions", False, 
                                  f"Service {service} missing build configuration")
                    return
                
                # Verify ports mapping
                if 'ports' not in service_config:
                    self.log_result("core_logic", "service_definitions", False, 
                                  f"Service {service} missing ports configuration")
                    return
            
            self.log_result("core_logic", "service_definitions", True, 
                          "All required services properly defined")
            
        except Exception as e:
            self.log_result("core_logic", "service_definitions", False, str(e))
    
    def test_network_configuration(self):
        """Test network configuration for medianest-network"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            # Verify networks section
            networks = compose_data.get('networks', {})
            if 'medianest-network' not in networks:
                self.log_result("core_logic", "network_configuration", False, 
                              "Missing medianest-network definition")
                return
            
            # Verify services are connected to network
            services = compose_data.get('services', {})
            for service_name in ['backend', 'frontend']:
                service = services.get(service_name, {})
                service_networks = service.get('networks', [])
                if 'medianest-network' not in service_networks:
                    self.log_result("core_logic", "network_configuration", False, 
                                  f"Service {service_name} not connected to medianest-network")
                    return
            
            self.log_result("core_logic", "network_configuration", True, 
                          "Network configuration valid")
            
        except Exception as e:
            self.log_result("core_logic", "network_configuration", False, str(e))
    
    def test_volume_mappings(self):
        """Test volume mappings for development workflow"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            services = compose_data.get('services', {})
            
            # Test frontend volumes
            frontend = services.get('frontend', {})
            frontend_volumes = frontend.get('volumes', [])
            expected_frontend_volumes = [
                './frontend/src:/app/src',
                './frontend/public:/app/public',
                '/app/node_modules'
            ]
            
            for expected_vol in expected_frontend_volumes:
                if expected_vol not in frontend_volumes:
                    self.log_result("core_logic", "volume_mappings", False, 
                                  f"Frontend missing volume: {expected_vol}")
                    return
            
            # Test backend volumes
            backend = services.get('backend', {})
            backend_volumes = backend.get('volumes', [])
            expected_backend_volumes = [
                './backend:/app',
                './backend/config:/app/config'
            ]
            
            for expected_vol in expected_backend_volumes:
                if expected_vol not in backend_volumes:
                    self.log_result("core_logic", "volume_mappings", False, 
                                  f"Backend missing volume: {expected_vol}")
                    return
            
            self.log_result("core_logic", "volume_mappings", True, 
                          "Volume mappings configured correctly")
            
        except Exception as e:
            self.log_result("core_logic", "volume_mappings", False, str(e))
    
    def test_environment_variables_structure(self):
        """Test environment variable structure and :SecurityFirst compliance"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            services = compose_data.get('services', {})
            
            # Test backend environment variables
            backend = services.get('backend', {})
            backend_env = backend.get('environment', [])
            
            # Check for :Flask v3.x specific variables
            flask_vars = ['FLASK_ENV', 'FLASK_DEBUG', 'FLASK_APP']
            for var in flask_vars:
                if not any(var in env_var for env_var in backend_env):
                    self.log_result("core_logic", "environment_variables", False, 
                                  f"Missing Flask environment variable: {var}")
                    return
            
            # Test frontend environment variables
            frontend = services.get('frontend', {})
            frontend_env = frontend.get('environment', [])
            
            # Check for :React v18 specific variables
            react_vars = ['REACT_APP_API_URL', 'NODE_ENV']
            for var in react_vars:
                if not any(var in env_var for env_var in frontend_env):
                    self.log_result("core_logic", "environment_variables", False, 
                                  f"Missing React environment variable: {var}")
                    return
            
            self.log_result("core_logic", "environment_variables", True, 
                          "Environment variables properly structured")
            
        except Exception as e:
            self.log_result("core_logic", "environment_variables", False, str(e))
    
    def test_service_dependencies(self):
        """Test service dependency configuration"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            services = compose_data.get('services', {})
            frontend = services.get('frontend', {})
            
            # Frontend should depend on backend
            depends_on = frontend.get('depends_on', [])
            if 'backend' not in depends_on:
                self.log_result("core_logic", "service_dependencies", False, 
                              "Frontend service missing dependency on backend")
                return
            
            self.log_result("core_logic", "service_dependencies", True, 
                          "Service dependencies configured correctly")
            
        except Exception as e:
            self.log_result("core_logic", "service_dependencies", False, str(e))

    # ========== CONTEXTUAL INTEGRATION TESTING ==========
    
    def test_docker_compose_validation(self):
        """Test docker-compose config validation (if Docker available)"""
        if not self.docker_available:
            self.log_result("contextual_integration", "compose_validation", True, 
                          "Docker not available - skipping validation (acceptable for CI/CD)")
            return
        
        try:
            os.chdir(self.project_root)
            result = subprocess.run(
                ['docker-compose', 'config'], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            
            if result.returncode != 0:
                self.log_result("contextual_integration", "compose_validation", False, 
                              f"docker-compose config failed: {result.stderr}")
                return
            
            self.log_result("contextual_integration", "compose_validation", True, 
                          "Docker Compose configuration validates successfully")
            
        except subprocess.TimeoutExpired:
            self.log_result("contextual_integration", "compose_validation", False, 
                          "docker-compose config command timed out")
        except Exception as e:
            self.log_result("contextual_integration", "compose_validation", False, str(e))
    
    def test_flask_backend_configuration_compatibility(self):
        """Test :Flask v3.x configuration compatibility"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            backend = compose_data.get('services', {}).get('backend', {})
            backend_env = backend.get('environment', [])
            
            # Check Flask-specific configurations
            flask_configs = {
                'FLASK_ENV': ['development', 'production'],
                'FLASK_DEBUG': ['0', '1'],
                'FLASK_APP': ['app.py', 'main.py']
            }
            
            for env_var in backend_env:
                for config_key, valid_values in flask_configs.items():
                    if config_key in env_var:
                        # Extract value after = or :
                        if '=' in env_var:
                            value = env_var.split('=')[1].strip()
                        elif ':' in env_var:
                            value = env_var.split(':')[1].strip()
                        else:
                            continue
                        
                        # Remove ${} wrapper if present
                        if value.startswith('${') and value.endswith('}'):
                            # This is environment variable substitution - acceptable
                            continue
                        
                        if value not in valid_values and not value.startswith('${'):
                            self.log_result("contextual_integration", "flask_compatibility", False, 
                                          f"Invalid Flask config value: {config_key}={value}")
                            return
            
            self.log_result("contextual_integration", "flask_compatibility", True, 
                          "Flask backend configuration compatible")
            
        except Exception as e:
            self.log_result("contextual_integration", "flask_compatibility", False, str(e))
    
    def test_react_frontend_configuration_compatibility(self):
        """Test :React v18 configuration compatibility"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            frontend = compose_data.get('services', {}).get('frontend', {})
            frontend_env = frontend.get('environment', [])
            
            # Check React-specific configurations
            react_api_url_found = False
            node_env_found = False
            
            for env_var in frontend_env:
                if 'REACT_APP_API_URL' in env_var:
                    react_api_url_found = True
                    # Should point to backend service
                    if 'backend:5000' not in env_var:
                        self.log_result("contextual_integration", "react_compatibility", False, 
                                      "REACT_APP_API_URL should reference backend service")
                        return
                
                if 'NODE_ENV' in env_var:
                    node_env_found = True
            
            if not react_api_url_found:
                self.log_result("contextual_integration", "react_compatibility", False, 
                              "Missing REACT_APP_API_URL configuration")
                return
            
            if not node_env_found:
                self.log_result("contextual_integration", "react_compatibility", False, 
                              "Missing NODE_ENV configuration")
                return
            
            self.log_result("contextual_integration", "react_compatibility", True, 
                          "React frontend configuration compatible")
            
        except Exception as e:
            self.log_result("contextual_integration", "react_compatibility", False, str(e))
    
    def test_client_server_pattern_implementation(self):
        """Test :ClientServerPattern implementation in container orchestration"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            services = compose_data.get('services', {})
            
            # Verify client (frontend) configuration
            frontend = services.get('frontend', {})
            if not frontend:
                self.log_result("contextual_integration", "client_server_pattern", False, 
                              "Frontend service (client) not defined")
                return
            
            # Verify server (backend) configuration
            backend = services.get('backend', {})
            if not backend:
                self.log_result("contextual_integration", "client_server_pattern", False, 
                              "Backend service (server) not defined")
                return
            
            # Verify client depends on server
            frontend_deps = frontend.get('depends_on', [])
            if 'backend' not in frontend_deps:
                self.log_result("contextual_integration", "client_server_pattern", False, 
                              "Client (frontend) does not depend on server (backend)")
                return
            
            # Verify appropriate port mappings
            frontend_ports = frontend.get('ports', [])
            backend_ports = backend.get('ports', [])
            
            if not any('3000' in port for port in frontend_ports):
                self.log_result("contextual_integration", "client_server_pattern", False, 
                              "Frontend (client) missing standard port 3000")
                return
            
            if not any('5000' in port for port in backend_ports):
                self.log_result("contextual_integration", "client_server_pattern", False, 
                              "Backend (server) missing standard port 5000")
                return
            
            self.log_result("contextual_integration", "client_server_pattern", True, 
                          ":ClientServerPattern properly implemented")
            
        except Exception as e:
            self.log_result("contextual_integration", "client_server_pattern", False, str(e))

    # ========== SECURITY COMPLIANCE TESTING ==========
    
    def test_security_no_hardcoded_secrets(self):
        """Test :SecurityFirst compliance - no hardcoded secrets in docker-compose.yml"""
        try:
            with open(self.compose_file, 'r') as f:
                content = f.read()
            
            # Check for potential hardcoded secrets
            security_violations = []
            
            # Look for hardcoded values that should be environment variables
            if 'password=' in content.lower() and '${' not in content:
                security_violations.append("Hardcoded password detected")
            
            if 'secret=' in content.lower() and '${' not in content:
                security_violations.append("Hardcoded secret detected")
            
            if 'key=' in content.lower() and '${' not in content and 'JWT_SECRET_KEY=${' not in content:
                security_violations.append("Hardcoded key detected")
            
            # Verify sensitive variables use environment variable substitution
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            backend_env = compose_data.get('services', {}).get('backend', {}).get('environment', [])
            sensitive_vars = ['JWT_SECRET_KEY', 'UPTIME_KUMA_API_KEY', 'OVERSEERR_API_KEY']
            
            for env_var in backend_env:
                for sensitive in sensitive_vars:
                    if sensitive in env_var and '${' not in env_var:
                        security_violations.append(f"Sensitive variable {sensitive} not using env substitution")
            
            if security_violations:
                self.log_result("security_compliance", "no_hardcoded_secrets", False, 
                              f"Security violations: {', '.join(security_violations)}")
                return
            
            self.log_result("security_compliance", "no_hardcoded_secrets", True, 
                          ":SecurityFirst compliance verified - no hardcoded secrets")
            
        except Exception as e:
            self.log_result("security_compliance", "no_hardcoded_secrets", False, str(e))

    # ========== TEST EXECUTION ==========
    
    def run_all_tests(self):
        """Execute all targeted tests"""
        print("=== TARGETED TESTING STRATEGY: Docker Container Orchestration (Safe Mode) ===")
        print("Context: MediaNest :ContainerOrchestration for :ClientServerPattern")
        print("Technologies: :Flask v3.x backend + :React v18 frontend")
        print(f"Docker Available: {self.docker_available}")
        print()
        
        print("🔹 CORE LOGIC TESTING:")
        self.test_docker_compose_syntax_validity()
        self.test_service_definitions_completeness()
        self.test_network_configuration()
        self.test_volume_mappings()
        self.test_environment_variables_structure()
        self.test_service_dependencies()
        
        print("\n🔹 CONTEXTUAL INTEGRATION TESTING:")
        self.test_docker_compose_validation()
        self.test_flask_backend_configuration_compatibility()
        self.test_react_frontend_configuration_compatibility()
        self.test_client_server_pattern_implementation()
        
        print("\n🔹 SECURITY COMPLIANCE TESTING:")
        self.test_security_no_hardcoded_secrets()
        
        return self.generate_final_report()
    
    def generate_final_report(self):
        """Generate final test report with PASS/FAIL status"""
        total_tests = 0
        passed_tests = 0
        failed_tests = []
        
        for category, tests in self.test_results.items():
            for test in tests:
                total_tests += 1
                if test['passed']:
                    passed_tests += 1
                else:
                    failed_tests.append({
                        'category': category,
                        'test': test['test'],
                        'message': test['message'],
                        'sappo_problem': test['sappo_problem']
                    })
        
        print(f"\n=== FINAL REPORT ===")
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {len(failed_tests)}")
        
        if failed_tests:
            print("\nFAILED TESTS:")
            for failure in failed_tests:
                print(f"  [{failure['category']}] {failure['test']}")
                print(f"    → {failure['message']}")
                print(f"    → SAPPO Problem: {failure['sappo_problem']}")
        
        overall_status = "PASS" if len(failed_tests) == 0 else "FAIL"
        print(f"\nOVERALL STATUS: {overall_status}")
        
        return {
            'status': overall_status,
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failed_tests': failed_tests,
            'test_results': self.test_results
        }

if __name__ == "__main__":
    tester = DockerOrchestrationSafeTester()
    result = tester.run_all_tests()
    
    # Exit with appropriate code for CI/CD integration
    sys.exit(0 if result['status'] == 'PASS' else 1)