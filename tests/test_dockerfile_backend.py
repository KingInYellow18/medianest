"""
Targeted Testing Strategy for MediaNest Backend Dockerfile
Tests :ContainerOrchestration pattern implementation for :Flask v3.x + :Python v3.11+

CORE LOGIC TESTING:
- Dockerfile syntax and structure validation
- :Python v3.11+ base image compatibility
- Dependency installation and requirements.txt handling
- Security compliance (:SecurityFirst principle)
- Port exposure and CMD configuration

CONTEXTUAL INTEGRATION TESTING:
- Integration with docker-compose.yml build process
- :Flask environment variable compatibility
- Container startup sequence and health check
- Development workflow support (hot-reload)
- :ClientServerPattern backend role compatibility
"""

import unittest
import subprocess
import os
import tempfile
import shutil
import time
import requests
from pathlib import Path


class TestDockerfileBackendCoreLogic(unittest.TestCase):
    """
    CORE LOGIC TESTING: Verify Dockerfile internal correctness
    Targets: :ConfigurationIssue, :SecurityVulnerability, :CompatibilityIssue
    """
    
    def setUp(self):
        """Set up test environment"""
        self.project_root = Path(__file__).parent.parent
        self.dockerfile_path = self.project_root / "backend" / "Dockerfile"
        self.requirements_path = self.project_root / "backend" / "requirements.txt"
        
    def test_dockerfile_exists_and_readable(self):
        """Test Dockerfile file existence and readability"""
        self.assertTrue(self.dockerfile_path.exists(), 
                       "Dockerfile must exist for :ContainerOrchestration")
        self.assertTrue(self.dockerfile_path.is_file(),
                       "Dockerfile must be a file")
        
        # Test readability
        with open(self.dockerfile_path, 'r') as f:
            content = f.read()
            self.assertGreater(len(content), 0, 
                             "Dockerfile must not be empty")
    
    def test_python_base_image_version(self):
        """Test :Python v3.11+ base image specification"""
        with open(self.dockerfile_path, 'r') as f:
            content = f.read()
            
        # Verify Python 3.11+ base image
        self.assertIn("FROM python:3.11", content,
                     ":Python v3.11+ base image required for :TechnologyVersion compatibility")
        
        # Verify slim variant for security and size optimization
        self.assertIn("python:3.11-slim", content,
                     "Slim image variant required for security optimization")
    
    def test_security_compliance_non_root_user(self):
        """Test :SecurityFirst principle - non-root user implementation"""
        with open(self.dockerfile_path, 'r') as f:
            content = f.read()
        
        # Verify user creation
        self.assertIn("groupadd", content,
                     "Non-root group creation required for :SecurityFirst")
        self.assertIn("useradd", content,
                     "Non-root user creation required for :SecurityFirst")
        
        # Verify user switch
        self.assertIn("USER appuser", content,
                     "Must switch to non-root user to mitigate :SecurityVulnerability")
        
        # Verify no hard-coded secrets
        sensitive_patterns = ["password", "secret", "key", "token", "api_key"]
        content_lower = content.lower()
        for pattern in sensitive_patterns:
            self.assertNotIn(f"{pattern}=", content_lower,
                           f"No hard-coded {pattern} allowed (:SecurityFirst principle)")
    
    def test_flask_environment_variables(self):
        """Test :Flask v3.x environment variable configuration"""
        with open(self.dockerfile_path, 'r') as f:
            content = f.read()
        
        # Required Flask environment variables
        required_env_vars = [
            "FLASK_APP=app.py",
            "FLASK_ENV=development", 
            "FLASK_DEBUG=1"
        ]
        
        for env_var in required_env_vars:
            self.assertIn(env_var, content,
                         f"Required :Flask environment variable {env_var} missing")
        
        # Python optimization variables
        python_env_vars = [
            "PYTHONDONTWRITEBYTECODE=1",
            "PYTHONUNBUFFERED=1",
            "PYTHONPATH=/app"
        ]
        
        for env_var in python_env_vars:
            self.assertIn(env_var, content,
                         f"Required Python optimization variable {env_var} missing")
    
    def test_port_exposure_configuration(self):
        """Test proper port exposure for Flask development server"""
        with open(self.dockerfile_path, 'r') as f:
            content = f.read()
        
        # Verify port 5000 exposure for Flask
        self.assertIn("EXPOSE 5000", content,
                     "Port 5000 must be exposed for Flask development server")
    
    def test_working_directory_setup(self):
        """Test working directory configuration"""
        with open(self.dockerfile_path, 'r') as f:
            content = f.read()
        
        self.assertIn("WORKDIR /app", content,
                     "Working directory /app required for proper application structure")
    
    def test_health_check_configuration(self):
        """Test health check endpoint configuration"""
        with open(self.dockerfile_path, 'r') as f:
            content = f.read()
        
        # Verify health check presence
        self.assertIn("HEALTHCHECK", content,
                     "Health check required for container orchestration")
        
        # Verify health check endpoint
        self.assertIn("/health", content,
                     "Health check endpoint /health required")
        
        # Verify curl usage for health check
        self.assertIn("curl", content,
                     "curl required for health check implementation")
    
    def test_cmd_configuration_flask_development(self):
        """Test CMD configuration for Flask development server"""
        with open(self.dockerfile_path, 'r') as f:
            content = f.read()
        
        # Verify Flask development server command
        self.assertIn('CMD ["python", "-m", "flask", "run"', content,
                     "Flask development server command required")
        
        # Verify host and port configuration
        self.assertIn("--host=0.0.0.0", content,
                     "Host 0.0.0.0 required for container accessibility")
        self.assertIn("--port=5000", content,
                     "Port 5000 required for Flask server")
        
        # Verify hot-reload support
        self.assertIn("--reload", content,
                     "Hot-reload support required for development workflow")


class TestDockerfileBackendContextualIntegration(unittest.TestCase):
    """
    CONTEXTUAL INTEGRATION TESTING: Verify integration with :ClientServerPattern
    Targets: :InterfaceMismatch, :CompatibilityIssue, :DependencyIssue
    """
    
    def setUp(self):
        """Set up integration test environment"""
        self.project_root = Path(__file__).parent.parent
        self.docker_compose_path = self.project_root / "docker-compose.yml"
        self.dockerfile_path = self.project_root / "backend" / "Dockerfile"
        
    def test_docker_compose_integration(self):
        """Test integration with docker-compose.yml configuration"""
        # Verify docker-compose.yml exists
        self.assertTrue(self.docker_compose_path.exists(),
                       "docker-compose.yml required for :ContainerOrchestration")
        
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        # Verify backend service configuration
        self.assertIn("backend:", compose_content,
                     "Backend service must be defined in docker-compose.yml")
        
        # Verify build context
        self.assertIn("context: ./backend", compose_content,
                     "Backend build context must point to ./backend directory")
        
        # Verify Dockerfile reference
        self.assertIn("dockerfile: Dockerfile", compose_content,
                     "Dockerfile reference required in docker-compose.yml")
        
        # Verify port mapping
        self.assertIn("5000:5000", compose_content,
                     "Port mapping 5000:5000 required for Flask server access")
    
    def test_environment_variable_compatibility(self):
        """Test :Flask environment variable compatibility with docker-compose"""
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        # Verify Flask environment variables in docker-compose
        flask_env_vars = [
            "FLASK_ENV",
            "FLASK_DEBUG", 
            "FLASK_APP"
        ]
        
        for env_var in flask_env_vars:
            self.assertIn(env_var, compose_content,
                         f"Flask environment variable {env_var} must be configurable in docker-compose")
    
    def test_volume_mounting_development_workflow(self):
        """Test volume mounting for development workflow support"""
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        # Verify backend volume mounting for hot-reload
        self.assertIn("./backend:/app", compose_content,
                     "Backend volume mounting required for development hot-reload")
        
        # Verify config directory mounting
        self.assertIn("./backend/config:/app/config", compose_content,
                     "Config directory mounting required for configuration management")
    
    def test_network_configuration_client_server_pattern(self):
        """Test network configuration for :ClientServerPattern"""
        with open(self.docker_compose_path, 'r') as f:
            compose_content = f.read()
        
        # Verify network definition
        self.assertIn("medianest-network", compose_content,
                     "Shared network required for :ClientServerPattern communication")
        
        # Verify backend is on the network
        backend_section = self._extract_backend_section(compose_content)
        self.assertIn("medianest-network", backend_section,
                     "Backend must be on shared network for frontend communication")
    
    def test_dependency_handling_requirements_txt(self):
        """Test requirements.txt handling in Dockerfile"""
        with open(self.dockerfile_path, 'r') as f:
            dockerfile_content = f.read()
        
        # Verify requirements.txt copy before pip install
        lines = dockerfile_content.split('\n')
        copy_req_line = None
        pip_install_line = None
        
        for i, line in enumerate(lines):
            if "COPY requirements.txt" in line:
                copy_req_line = i
            elif "pip install" in line and "requirements.txt" in line:
                pip_install_line = i
        
        self.assertIsNotNone(copy_req_line,
                           "requirements.txt must be copied for dependency installation")
        self.assertIsNotNone(pip_install_line,
                           "pip install from requirements.txt required")
        
        if copy_req_line and pip_install_line:
            self.assertLess(copy_req_line, pip_install_line,
                          "requirements.txt copy must occur before pip install for proper layer caching")
    
    def test_dockerfile_build_validation(self):
        """Test Dockerfile can be built successfully (syntax validation)"""
        try:
            # Create minimal requirements.txt for build test
            req_path = self.project_root / "backend" / "requirements.txt"
            original_req_content = ""
            
            if req_path.exists():
                with open(req_path, 'r') as f:
                    original_req_content = f.read()
            
            # Write minimal requirements for test
            with open(req_path, 'w') as f:
                f.write("Flask>=3.0.0\n")
            
            # Create minimal app.py for build test
            app_path = self.project_root / "backend" / "app.py"
            original_app_content = ""
            
            if app_path.exists():
                with open(app_path, 'r') as f:
                    original_app_content = f.read()
            
            # Write minimal Flask app for test
            with open(app_path, 'w') as f:
                f.write("""
from flask import Flask

app = Flask(__name__)

@app.route('/health')
def health():
    return {'status': 'healthy'}, 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
""")
            
            # Test docker build (dry run with --dry-run if available, otherwise build)
            result = subprocess.run([
                'docker', 'build', 
                '--file', str(self.dockerfile_path),
                '--tag', 'medianest-backend-test',
                str(self.project_root / "backend")
            ], capture_output=True, text=True, timeout=300)
            
            # Restore original files
            with open(req_path, 'w') as f:
                f.write(original_req_content)
            with open(app_path, 'w') as f:
                f.write(original_app_content)
            
            self.assertEqual(result.returncode, 0,
                           f"Dockerfile build failed: {result.stderr}")
            
            # Clean up test image
            subprocess.run(['docker', 'rmi', 'medianest-backend-test'], 
                         capture_output=True)
            
        except subprocess.TimeoutExpired:
            self.fail("Docker build timed out - potential :DependencyIssue or :ConfigurationIssue")
        except Exception as e:
            self.fail(f"Docker build test failed with exception: {str(e)}")
    
    def _extract_backend_section(self, compose_content):
        """Helper method to extract backend service section from docker-compose.yml"""
        lines = compose_content.split('\n')
        backend_section = []
        in_backend = False
        
        for line in lines:
            if line.strip().startswith('backend:'):
                in_backend = True
                backend_section.append(line)
            elif in_backend:
                if line.startswith('  ') or line.strip() == '':
                    backend_section.append(line)
                else:
                    break
        
        return '\n'.join(backend_section)


if __name__ == '__main__':
    # Execute targeted tests
    print("🎯 Executing Targeted Testing Strategy for Backend Dockerfile")
    print("📋 CORE LOGIC TESTING: Dockerfile structure, security, configuration")
    print("🔗 CONTEXTUAL INTEGRATION TESTING: docker-compose integration, :ClientServerPattern")
    
    # Create test suite
    suite = unittest.TestSuite()
    
    # Add Core Logic Tests
    suite.addTest(unittest.makeSuite(TestDockerfileBackendCoreLogic))
    
    # Add Contextual Integration Tests  
    suite.addTest(unittest.makeSuite(TestDockerfileBackendContextualIntegration))
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Report results
    if result.wasSuccessful():
        print("\n✅ TARGETED TESTING RESULT: PASS")
        print("🔹 CORE LOGIC TESTING: All Dockerfile structure and security tests passed")
        print("🔹 CONTEXTUAL INTEGRATION TESTING: All docker-compose integration tests passed")
    else:
        print("\n❌ TARGETED TESTING RESULT: FAIL")
        print(f"🔹 Failures: {len(result.failures)}")
        print(f"🔹 Errors: {len(result.errors)}")
        
        for test, error in result.failures + result.errors:
            print(f"   - {test}: {error.split('AssertionError:')[-1].strip()}")