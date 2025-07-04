#!/usr/bin/env python3
"""
TARGETED TESTING STRATEGY for Docker Compose Configuration
MediaNest Project - :MicroservicesContainerOrchestration :ArchitecturalPattern

CORE LOGIC TESTING: Docker Compose v3.9 schema, service definitions, network/volume configuration
CONTEXTUAL INTEGRATION TESTING: Service orchestration, inter-service communication, :SecurityFirst compliance
"""

import os
import sys
import yaml
import subprocess
from pathlib import Path

class DockerComposeTargetedTester:
    """Targeted test suite for MediaNest Docker Compose configuration"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.compose_file = self.project_root / "docker-compose.yml"
        self.test_results = {
            "core_logic": [],
            "contextual_integration": []
        }
    
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
        elif "network" in test_name.lower():
            return ":MissingNetwork"
        elif "volume" in test_name.lower():
            return ":MissingVolume"
        elif "security" in test_name.lower():
            return ":SecurityVulnerability"
        elif "compatibility" in test_name.lower():
            return ":CompatibilityIssue"
        else:
            return ":IntegrationError"

    # ========== CORE LOGIC TESTING ==========
    
    def test_docker_compose_schema_compliance(self):
        """Test Docker Compose v3.9 schema compliance and YAML validity"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            # Verify version (though obsolete in v2, still valid)
            version = compose_data.get('version', '')
            if version and not version.startswith('3'):
                self.log_result("core_logic", "schema_compliance", False, 
                              f"Invalid version format: {version}")
                return
            
            # Verify required sections
            required_sections = ['services']
            for section in required_sections:
                if section not in compose_data:
                    self.log_result("core_logic", "schema_compliance", False, 
                                  f"Missing required section: {section}")
                    return
            
            self.log_result("core_logic", "schema_compliance", True, 
                          "Docker Compose schema compliance verified")
            
        except yaml.YAMLError as e:
            self.log_result("core_logic", "schema_compliance", False, 
                          f"YAML syntax error: {str(e)}")
        except FileNotFoundError:
            self.log_result("core_logic", "schema_compliance", False, 
                          f"docker-compose.yml not found")
    
    def test_microservices_architecture_pattern(self):
        """Test :MicroservicesContainerOrchestration pattern implementation"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            services = compose_data.get('services', {})
            
            # Verify backend service (Flask microservice)
            backend = services.get('backend', {})
            if not backend:
                self.log_result("core_logic", "microservices_pattern", False, 
                              "Backend microservice not defined")
                return
            
            # Verify frontend service (React microservice)
            frontend = services.get('frontend', {})
            if not frontend:
                self.log_result("core_logic", "microservices_pattern", False, 
                              "Frontend microservice not defined")
                return
            
            # Verify build contexts for microservices
            if 'build' not in backend or 'build' not in frontend:
                self.log_result("core_logic", "microservices_pattern", False, 
                              "Microservices missing build configurations")
                return
            
            # Verify port mappings (5000:5000 for backend, 3000:3000 for frontend)
            backend_ports = backend.get('ports', [])
            frontend_ports = frontend.get('ports', [])
            
            if not any('5000:5000' in str(port) for port in backend_ports):
                self.log_result("core_logic", "microservices_pattern", False, 
                              "Backend missing port 5000:5000 mapping")
                return
            
            if not any('3000:3000' in str(port) for port in frontend_ports):
                self.log_result("core_logic", "microservices_pattern", False, 
                              "Frontend missing port 3000:3000 mapping")
                return
            
            self.log_result("core_logic", "microservices_pattern", True, 
                          ":MicroservicesContainerOrchestration pattern implemented correctly")
            
        except Exception as e:
            self.log_result("core_logic", "microservices_pattern", False, str(e))
    
    def test_network_configuration_resolution(self):
        """Test medianest-network configuration resolves :MissingNetwork :Problem"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            # Verify networks section exists
            networks = compose_data.get('networks', {})
            if 'medianest-network' not in networks:
                self.log_result("core_logic", "network_resolution", False, 
                              ":MissingNetwork - medianest-network not defined")
                return
            
            # Verify bridge driver
            network_config = networks['medianest-network']
            if network_config.get('driver') != 'bridge':
                self.log_result("core_logic", "network_resolution", False, 
                              "Network driver should be 'bridge'")
                return
            
            # Verify services are connected to network
            services = compose_data.get('services', {})
            for service_name in ['backend', 'frontend']:
                service = services.get(service_name, {})
                service_networks = service.get('networks', [])
                if 'medianest-network' not in service_networks:
                    self.log_result("core_logic", "network_resolution", False, 
                                  f"Service {service_name} not connected to medianest-network")
                    return
            
            self.log_result("core_logic", "network_resolution", True, 
                          ":MissingNetwork :Problem resolved - network configuration valid")
            
        except Exception as e:
            self.log_result("core_logic", "network_resolution", False, str(e))
    
    def test_volume_configuration_resolution(self):
        """Test volume configuration resolves :MissingVolume :Problem"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            # Verify volumes section exists
            volumes = compose_data.get('volumes', {})
            expected_volumes = ['backend_cache', 'frontend_node_modules']
            
            for vol_name in expected_volumes:
                if vol_name not in volumes:
                    self.log_result("core_logic", "volume_resolution", False, 
                                  f":MissingVolume - {vol_name} not defined")
                    return
            
            # Verify volume usage in services
            services = compose_data.get('services', {})
            
            # Check backend cache volume usage
            backend_volumes = services.get('backend', {}).get('volumes', [])
            if not any('backend_cache:/app/.cache' in str(vol) for vol in backend_volumes):
                self.log_result("core_logic", "volume_resolution", False, 
                              "Backend not using backend_cache volume")
                return
            
            # Check frontend node_modules volume (anonymous volume)
            frontend_volumes = services.get('frontend', {}).get('volumes', [])
            if '/app/node_modules' not in frontend_volumes:
                self.log_result("core_logic", "volume_resolution", False, 
                              "Frontend missing node_modules volume")
                return
            
            self.log_result("core_logic", "volume_resolution", True, 
                          ":MissingVolume :Problem resolved - volume configuration valid")
            
        except Exception as e:
            self.log_result("core_logic", "volume_resolution", False, str(e))

    # ========== CONTEXTUAL INTEGRATION TESTING ==========
    
    def test_docker_compose_validation_integration(self):
        """Test Docker Compose configuration validation using docker compose config"""
        try:
            os.chdir(self.project_root)
            result = subprocess.run(
                ['docker', 'compose', 'config'], 
                capture_output=True, 
                text=True, 
                timeout=30
            )
            
            if result.returncode != 0:
                self.log_result("contextual_integration", "compose_validation", False, 
                              f"docker compose config failed: {result.stderr}")
                return
            
            # Verify expected warnings about unset environment variables (security compliance)
            expected_warnings = ['JWT_SECRET_KEY', 'UPTIME_KUMA_API_KEY', 'OVERSEERR_API_KEY']
            for warning in expected_warnings:
                if warning not in result.stderr:
                    self.log_result("contextual_integration", "compose_validation", False, 
                                  f"Expected security warning for {warning} not found")
                    return
            
            self.log_result("contextual_integration", "compose_validation", True, 
                          "Docker Compose configuration validates with proper security warnings")
            
        except subprocess.TimeoutExpired:
            self.log_result("contextual_integration", "compose_validation", False, 
                          "docker compose config command timed out")
        except FileNotFoundError:
            self.log_result("contextual_integration", "compose_validation", False, 
                          "docker compose command not found")
        except Exception as e:
            self.log_result("contextual_integration", "compose_validation", False, str(e))
    
    def test_client_server_pattern_compatibility(self):
        """Test :ClientServerPattern compatibility between Flask backend and React frontend"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            services = compose_data.get('services', {})
            backend = services.get('backend', {})
            frontend = services.get('frontend', {})
            
            # Verify frontend depends on backend (client-server dependency)
            frontend_deps = frontend.get('depends_on', [])
            if 'backend' not in frontend_deps:
                self.log_result("contextual_integration", "client_server_compatibility", False, 
                              ":CompatibilityIssue - Frontend does not depend on backend")
                return
            
            # Verify API URL configuration points to backend service
            frontend_env = frontend.get('environment', [])
            api_url_found = False
            for env_var in frontend_env:
                if 'REACT_APP_API_URL' in str(env_var) and 'backend:5000' in str(env_var):
                    api_url_found = True
                    break
            
            if not api_url_found:
                self.log_result("contextual_integration", "client_server_compatibility", False, 
                              ":CompatibilityIssue - Frontend API URL not pointing to backend service")
                return
            
            # Verify both services on same network for communication
            backend_networks = backend.get('networks', [])
            frontend_networks = frontend.get('networks', [])
            
            if 'medianest-network' not in backend_networks or 'medianest-network' not in frontend_networks:
                self.log_result("contextual_integration", "client_server_compatibility", False, 
                              ":CompatibilityIssue - Services not on same network")
                return
            
            self.log_result("contextual_integration", "client_server_compatibility", True, 
                          ":ClientServerPattern compatibility verified - :CompatibilityIssue resolved")
            
        except Exception as e:
            self.log_result("contextual_integration", "client_server_compatibility", False, str(e))
    
    def test_security_first_compliance(self):
        """Test :SecurityFirst compliance - environment variable substitution"""
        try:
            with open(self.compose_file, 'r') as f:
                compose_data = yaml.safe_load(f)
            
            backend_env = compose_data.get('services', {}).get('backend', {}).get('environment', [])
            
            # Verify sensitive variables use environment substitution
            sensitive_vars = ['JWT_SECRET_KEY', 'UPTIME_KUMA_API_KEY', 'OVERSEERR_API_KEY']
            
            for env_var in backend_env:
                for sensitive in sensitive_vars:
                    if sensitive in str(env_var):
                        # Should use ${VAR} syntax, not hardcoded values
                        if '${' not in str(env_var):
                            self.log_result("contextual_integration", "security_compliance", False, 
                                          f":SecurityVulnerability - {sensitive} not using env substitution")
                            return
            
            # Verify no hardcoded secrets in file content
            with open(self.compose_file, 'r') as f:
                content = f.read().lower()
            
            security_violations = []
            if 'password=' in content and '${' not in content:
                security_violations.append("Hardcoded password detected")
            if 'secret=' in content and '${' not in content:
                security_violations.append("Hardcoded secret detected")
            
            if security_violations:
                self.log_result("contextual_integration", "security_compliance", False, 
                              f":SecurityVulnerability - {', '.join(security_violations)}")
                return
            
            self.log_result("contextual_integration", "security_compliance", True, 
                          ":SecurityFirst compliance verified - no hardcoded secrets")
            
        except Exception as e:
            self.log_result("contextual_integration", "security_compliance", False, str(e))

    # ========== TEST EXECUTION ==========
    
    def run_targeted_tests(self):
        """Execute targeted testing strategy"""
        print("=== TARGETED TESTING STRATEGY: Docker Compose Configuration ===")
        print("Context: :MicroservicesContainerOrchestration for MediaNest local development")
        print("Technologies: :Flask v3.x backend + :React v18 frontend")
        print("Target :Problems: :CompatibilityIssue, :MissingNetwork, :MissingVolume")
        print()
        
        print("🔹 CORE LOGIC TESTING:")
        self.test_docker_compose_schema_compliance()
        self.test_microservices_architecture_pattern()
        self.test_network_configuration_resolution()
        self.test_volume_configuration_resolution()
        
        print("\n🔹 CONTEXTUAL INTEGRATION TESTING:")
        self.test_docker_compose_validation_integration()
        self.test_client_server_pattern_compatibility()
        self.test_security_first_compliance()
        
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
        
        print(f"\n=== TARGETED TESTING FINAL REPORT ===")
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
            'failed_tests': failed_tests
        }

if __name__ == "__main__":
    tester = DockerComposeTargetedTester()
    result = tester.run_targeted_tests()
    
    # Exit with appropriate code for CI/CD integration
    sys.exit(0 if result['status'] == 'PASS' else 1)