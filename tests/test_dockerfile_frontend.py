"""
MediaNest Frontend Dockerfile Targeted Testing Strategy
Tests :ContainerOrchestration pattern implementation for :React v18 + :Node.js v18 LTS
Validates :ClientServerPattern frontend :ComponentRole with backend communication readiness

SAPPO Focus Areas:
- :ContainerOrchestration pattern compliance
- :SecurityFirst principle verification  
- :React v18 + :Node.js v18 :TechnologyVersion compatibility
- :ClientServerPattern integration readiness
"""

import unittest
import os
import subprocess
import tempfile
import json
import re
from pathlib import Path


class TestFrontendDockerfileCore(unittest.TestCase):
    """
    CORE LOGIC TESTING: Verify Dockerfile internal correctness
    Tests Dockerfile syntax, structure, security, and :Node.js v18 compatibility
    """
    
    def setUp(self):
        """Setup test environment with file paths"""
        self.project_root = Path(__file__).parent.parent
        self.dockerfile_path = self.project_root / "frontend" / "Dockerfile"
        self.package_json_path = self.project_root / "frontend" / "package.json"
        
        # Verify test files exist
        self.assertTrue(self.dockerfile_path.exists(), 
                       f":ConfigurationIssue - Frontend Dockerfile not found at {self.dockerfile_path}")
        self.assertTrue(self.package_json_path.exists(),
                       f":ConfigurationIssue - package.json not found at {self.package_json_path}")
    
    def test_dockerfile_syntax_validity(self):
        """
        Test Dockerfile syntax and structure validity
        Targets: :SyntaxError, :ConfigurationIssue
        """
        with open(self.dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        
        # Test basic Dockerfile structure
        self.assertIn('FROM', dockerfile_content, ":SyntaxError - Missing FROM instruction")
        self.assertIn('WORKDIR', dockerfile_content, ":ConfigurationIssue - Missing WORKDIR instruction")
        self.assertIn('EXPOSE', dockerfile_content, ":ConfigurationIssue - Missing EXPOSE instruction")
        self.assertIn('CMD', dockerfile_content, ":ConfigurationIssue - Missing CMD instruction")
        
        # Test FROM instruction uses Node.js 18 LTS
        from_match = re.search(r'FROM\s+node:(\d+)', dockerfile_content)
        self.assertIsNotNone(from_match, ":TechnologyVersion - Node.js base image not specified")
        if from_match:
            node_version = int(from_match.group(1))
            self.assertEqual(node_version, 18, f":TechnologyVersion - Expected Node.js 18, found {node_version}")
        
        # Test Alpine variant for security and size optimization
        self.assertIn('node:18-alpine', dockerfile_content, 
                     ":SecurityVulnerability - Should use Alpine variant for security")
    
    def test_security_compliance(self):
        """
        Test :SecurityFirst principle compliance
        Targets: :SecurityVulnerability, :PrivilegeEscalation
        """
        with open(self.dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        
        # Test non-root user creation and usage
        self.assertIn('adduser', dockerfile_content, 
                     ":SecurityVulnerability - Missing non-root user creation")
        self.assertIn('USER appuser', dockerfile_content,
                     ":PrivilegeEscalation - Container runs as root user")
        
        # Test no hardcoded secrets
        secret_patterns = [
            r'password\s*=\s*["\'][^"\']+["\']',
            r'api[_-]?key\s*=\s*["\'][^"\']+["\']',
            r'secret\s*=\s*["\'][^"\']+["\']',
            r'token\s*=\s*["\'][^"\']+["\']'
        ]
        
        for pattern in secret_patterns:
            matches = re.findall(pattern, dockerfile_content, re.IGNORECASE)
            self.assertEqual(len(matches), 0, 
                           f":SecurityVulnerability - Potential hardcoded secret found: {matches}")
        
        # Test proper file permissions
        self.assertIn('chown', dockerfile_content,
                     ":SecurityVulnerability - Missing proper file ownership setup")
    
    def test_port_configuration(self):
        """
        Test port exposure and configuration
        Targets: :NetworkError, :ConfigurationIssue
        """
        with open(self.dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        
        # Test React development server port (3000) exposure
        self.assertIn('EXPOSE 3000', dockerfile_content,
                     ":NetworkError - React development server port 3000 not exposed")
        
        # Test no other ports exposed (security)
        expose_lines = re.findall(r'EXPOSE\s+(\d+)', dockerfile_content)
        self.assertEqual(expose_lines, ['3000'], 
                        f":SecurityVulnerability - Unexpected ports exposed: {expose_lines}")
    
    def test_react_v18_compatibility(self):
        """
        Test :React v18 compatibility and configuration
        Targets: :CompatibilityIssue, :TechnologyVersion
        """
        # Test package.json React version
        with open(self.package_json_path, 'r') as f:
            package_data = json.load(f)
        
        react_version = package_data.get('dependencies', {}).get('react', '')
        self.assertTrue(react_version.startswith('^18.') or react_version.startswith('18.'),
                       f":TechnologyVersion - Expected React v18, found {react_version}")
        
        react_dom_version = package_data.get('dependencies', {}).get('react-dom', '')
        self.assertTrue(react_dom_version.startswith('^18.') or react_dom_version.startswith('18.'),
                       f":TechnologyVersion - Expected React DOM v18, found {react_dom_version}")
        
        # Test React scripts configuration
        scripts = package_data.get('scripts', {})
        self.assertIn('start', scripts, ":ConfigurationIssue - Missing start script")
        self.assertEqual(scripts['start'], 'react-scripts start',
                        ":ConfigurationIssue - Invalid start script configuration")
    
    def test_npm_installation_process(self):
        """
        Test npm installation and dependency management
        Targets: :DependencyIssue, :MemoryLeak
        """
        with open(self.dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        
        # Test npm ci usage for reproducible builds
        self.assertIn('npm ci', dockerfile_content,
                     ":DependencyIssue - Should use 'npm ci' for reproducible builds")
        
        # Test cache cleaning to prevent :MemoryLeak
        self.assertIn('npm cache clean', dockerfile_content,
                     ":MemoryLeak - Missing npm cache cleanup")
        
        # Test package.json copied before source code (layer optimization)
        lines = dockerfile_content.split('\n')
        copy_package_line = -1
        copy_source_line = -1
        
        for i, line in enumerate(lines):
            if 'COPY package' in line:
                copy_package_line = i
            elif 'COPY --chown=appuser:appuser . .' in line:
                copy_source_line = i
        
        self.assertGreater(copy_package_line, -1, ":ConfigurationIssue - package.json not copied")
        self.assertGreater(copy_source_line, -1, ":ConfigurationIssue - source code not copied")
        self.assertLess(copy_package_line, copy_source_line,
                       ":PerformanceIssue - package.json should be copied before source code for layer caching")
    
    def test_healthcheck_configuration(self):
        """
        Test container health check configuration
        Targets: :MonitoringIssue, :NetworkError
        """
        with open(self.dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        
        # Test health check presence
        self.assertIn('HEALTHCHECK', dockerfile_content,
                     ":MonitoringIssue - Missing health check configuration")
        
        # Test health check targets correct port
        self.assertIn('localhost:3000', dockerfile_content,
                     ":NetworkError - Health check should target port 3000")
        
        # Test reasonable health check intervals
        healthcheck_match = re.search(r'HEALTHCHECK.*--interval=(\d+)s', dockerfile_content)
        self.assertIsNotNone(healthcheck_match, ":MonitoringIssue - Missing health check interval")
        if healthcheck_match:
            interval = int(healthcheck_match.group(1))
            self.assertGreaterEqual(interval, 10, ":PerformanceIssue - Health check interval too frequent")
            self.assertLessEqual(interval, 60, ":MonitoringIssue - Health check interval too long")


class TestFrontendDockerfileIntegration(unittest.TestCase):
    """
    CONTEXTUAL INTEGRATION TESTING: Verify :ClientServerPattern integration
    Tests docker-compose integration, environment variables, and backend communication readiness
    """
    
    def setUp(self):
        """Setup integration test environment"""
        self.project_root = Path(__file__).parent.parent
        self.dockerfile_path = self.project_root / "frontend" / "Dockerfile"
        self.docker_compose_path = self.project_root / "docker-compose.yml"
        self.package_json_path = self.project_root / "frontend" / "package.json"
    
    def test_docker_compose_integration(self):
        """
        Test integration with docker-compose.yml build process
        Targets: :InterfaceMismatch, :ConfigurationIssue
        """
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        # Test frontend service configuration
        self.assertIn('frontend:', compose_content,
                     ":ConfigurationIssue - Frontend service not defined in docker-compose")
        
        # Test build context points to frontend directory
        self.assertIn('context: ./frontend', compose_content,
                     ":ConfigurationIssue - Incorrect build context for frontend")
        
        # Test Dockerfile reference
        self.assertIn('dockerfile: Dockerfile', compose_content,
                     ":ConfigurationIssue - Dockerfile not referenced in compose")
        
        # Test port mapping (3000:3000)
        self.assertIn('"3000:3000"', compose_content,
                     ":NetworkError - Incorrect port mapping for frontend")
    
    def test_environment_variable_compatibility(self):
        """
        Test React environment variable configuration and API URL setup
        Targets: :InterfaceMismatch, :ConfigurationIssue
        """
        with open(self.dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        # Test REACT_APP_API_URL configuration in Dockerfile
        self.assertIn('REACT_APP_API_URL=http://backend:5000/api', dockerfile_content,
                     ":InterfaceMismatch - Missing or incorrect API URL configuration")
        
        # Test environment variable override capability in docker-compose
        self.assertIn('REACT_APP_API_URL=${REACT_APP_API_URL:-http://backend:5000/api}', compose_content,
                     ":ConfigurationIssue - Missing environment variable override in compose")
        
        # Test development environment configuration
        self.assertIn('NODE_ENV=development', dockerfile_content,
                     ":ConfigurationIssue - Missing NODE_ENV configuration")
        
        # Test React environment variable
        self.assertIn('REACT_APP_ENVIRONMENT=development', dockerfile_content,
                     ":ConfigurationIssue - Missing REACT_APP_ENVIRONMENT configuration")
    
    def test_backend_communication_readiness(self):
        """
        Test network connectivity preparation for backend communication (port 5000)
        Targets: :NetworkError, :InterfaceMismatch
        """
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        with open(self.package_json_path, 'r') as f:
            package_data = json.load(f)
        
        # Test backend service dependency
        self.assertIn('depends_on:', compose_content,
                     ":DependencyIssue - Missing service dependencies")
        self.assertIn('- backend', compose_content,
                     ":DependencyIssue - Frontend should depend on backend service")
        
        # Test network configuration
        self.assertIn('medianest-network', compose_content,
                     ":NetworkError - Missing shared network configuration")
        
        # Test proxy configuration for development
        proxy_config = package_data.get('proxy', '')
        self.assertEqual(proxy_config, 'http://backend:5000',
                        f":InterfaceMismatch - Incorrect proxy configuration: {proxy_config}")
        
        # Test backend port exposure
        self.assertIn('"5000:5000"', compose_content,
                     ":NetworkError - Backend port 5000 not properly exposed")
    
    def test_development_workflow_support(self):
        """
        Test hot-reload via volume mounting and development workflow
        Targets: :PerformanceIssue, :DevelopmentWorkflow
        """
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        # Test source code volume mounting for hot-reload
        self.assertIn('./frontend/src:/app/src', compose_content,
                     ":DevelopmentWorkflow - Missing src volume mount for hot-reload")
        
        # Test public directory volume mounting
        self.assertIn('./frontend/public:/app/public', compose_content,
                     ":DevelopmentWorkflow - Missing public volume mount")
        
        # Test node_modules volume to prevent conflicts
        self.assertIn('/app/node_modules', compose_content,
                     ":DependencyIssue - Missing node_modules volume mount")
        
        # Test CMD uses npm start for development server
        with open(self.dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        
        self.assertIn('CMD ["npm", "start"]', dockerfile_content,
                     ":ConfigurationIssue - Should use npm start for development server")
    
    def test_container_orchestration_pattern(self):
        """
        Test :ContainerOrchestration pattern implementation
        Targets: :ArchitecturalPattern, :ScalabilityIssue
        """
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        # Test version specification
        self.assertIn('version:', compose_content,
                     ":ConfigurationIssue - Missing docker-compose version")
        
        # Test services section
        self.assertIn('services:', compose_content,
                     ":ArchitecturalPattern - Missing services section")
        
        # Test networks section for service communication
        self.assertIn('networks:', compose_content,
                     ":NetworkError - Missing networks configuration")
        
        # Test bridge network driver
        self.assertIn('driver: bridge', compose_content,
                     ":NetworkError - Should use bridge network driver")
        
        # Test both frontend and backend services present
        self.assertIn('frontend:', compose_content,
                     ":ArchitecturalPattern - Missing frontend service")
        self.assertIn('backend:', compose_content,
                     ":ArchitecturalPattern - Missing backend service")


def run_targeted_tests():
    """
    Execute Targeted Testing Strategy for Frontend Dockerfile
    Returns: (success: bool, results: dict)
    """
    # Create test suite
    core_suite = unittest.TestLoader().loadTestsFromTestCase(TestFrontendDockerfileCore)
    integration_suite = unittest.TestLoader().loadTestsFromTestCase(TestFrontendDockerfileIntegration)
    
    # Run tests with detailed output
    core_runner = unittest.TextTestRunner(verbosity=2, stream=open(os.devnull, 'w'))
    integration_runner = unittest.TextTestRunner(verbosity=2, stream=open(os.devnull, 'w'))
    
    core_result = core_runner.run(core_suite)
    integration_result = integration_runner.run(integration_suite)
    
    # Compile results
    results = {
        'core_logic': {
            'tests_run': core_result.testsRun,
            'failures': len(core_result.failures),
            'errors': len(core_result.errors),
            'success': core_result.wasSuccessful(),
            'details': core_result.failures + core_result.errors
        },
        'contextual_integration': {
            'tests_run': integration_result.testsRun,
            'failures': len(integration_result.failures),
            'errors': len(integration_result.errors),
            'success': integration_result.wasSuccessful(),
            'details': integration_result.failures + integration_result.errors
        }
    }
    
    overall_success = core_result.wasSuccessful() and integration_result.wasSuccessful()
    return overall_success, results


if __name__ == '__main__':
    success, results = run_targeted_tests()
    
    print("=== FRONTEND DOCKERFILE TARGETED TESTING RESULTS ===")
    print(f"CORE LOGIC TESTING: {'PASS' if results['core_logic']['success'] else 'FAIL'}")
    print(f"CONTEXTUAL INTEGRATION TESTING: {'PASS' if results['contextual_integration']['success'] else 'FAIL'}")
    print(f"OVERALL RESULT: {'PASS' if success else 'FAIL'}")
    
    if not success:
        print("\n=== FAILURE DETAILS ===")
        for category, result in results.items():
            if result['details']:
                print(f"\n{category.upper()} FAILURES:")
                for test, error in result['details']:
                    print(f"- {test}: {error}")
    
    exit(0 if success else 1)