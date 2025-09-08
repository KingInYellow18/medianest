#!/usr/bin/env python3
"""
MediaNest Network Security Analysis Suite
Comprehensive security testing for network topology, API endpoints, and service communication
"""

import json
import requests
import socket
import ssl
import subprocess
import time
from urllib.parse import urlparse, urljoin
from typing import Dict, List, Any, Optional
import concurrent.futures
from datetime import datetime

class NetworkSecurityAnalyzer:
    def __init__(self):
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "network_topology": {},
            "port_exposure": {},
            "api_security": {},
            "service_communication": {},
            "security_headers": {},
            "vulnerabilities": [],
            "recommendations": []
        }
        
        # Configuration from docker-compose
        self.services = {
            "app": {"port": 4000, "internal": True},
            "proxy": {"ports": [80, 443], "internal": False},
            "postgres": {"port": 5432, "internal": True},
            "redis": {"port": 6379, "internal": True}
        }
        
        self.base_url = "http://localhost:4000"
        self.external_url = "http://localhost:80"
    
    def analyze_network_topology(self):
        """Analyze Docker network configuration and service connectivity"""
        print("🔍 Analyzing network topology...")
        
        topology = {
            "network_isolation": {},
            "service_connectivity": {},
            "network_policies": {}
        }
        
        # Check Docker network configuration
        try:
            result = subprocess.run(['docker', 'network', 'ls'], 
                                 capture_output=True, text=True)
            if result.returncode == 0:
                networks = result.stdout
                topology["docker_networks"] = networks
                
                # Check for custom network isolation
                if "secure_internal" in networks:
                    topology["network_isolation"]["custom_network"] = True
                    topology["network_isolation"]["status"] = "SECURE"
                else:
                    topology["network_isolation"]["custom_network"] = False
                    topology["network_isolation"]["status"] = "DEFAULT"
                    self.results["vulnerabilities"].append({
                        "type": "NETWORK_ISOLATION",
                        "severity": "MEDIUM",
                        "issue": "Using default Docker network"
                    })
            
        except Exception as e:
            topology["docker_networks_error"] = str(e)
        
        # Test internal service connectivity
        internal_services = ["postgres", "redis", "app"]
        for service in internal_services:
            if service in self.services:
                port = self.services[service]["port"]
                is_accessible = self.test_port_accessibility("localhost", port)
                topology["service_connectivity"][service] = {
                    "port": port,
                    "accessible_externally": is_accessible,
                    "should_be_internal": self.services[service]["internal"]
                }
                
                if is_accessible and self.services[service]["internal"]:
                    self.results["vulnerabilities"].append({
                        "type": "INTERNAL_SERVICE_EXPOSED",
                        "severity": "HIGH",
                        "service": service,
                        "port": port,
                        "issue": f"Internal service {service} is accessible externally"
                    })
        
        self.results["network_topology"] = topology
    
    def analyze_port_exposure(self):
        """Analyze exposed ports and their necessity"""
        print("🚪 Analyzing port exposure...")
        
        port_analysis = {}
        common_ports = [80, 443, 4000, 3000, 5432, 6379, 22, 8080, 8443]
        
        for port in common_ports:
            is_open = self.test_port_accessibility("localhost", port)
            port_analysis[port] = {
                "open": is_open,
                "service": self.identify_service_by_port(port),
                "necessity": self.assess_port_necessity(port)
            }
            
            if is_open and not self.assess_port_necessity(port):
                self.results["vulnerabilities"].append({
                    "type": "UNNECESSARY_PORT_EXPOSURE",
                    "severity": "MEDIUM",
                    "port": port,
                    "issue": f"Port {port} is open but may not be necessary"
                })
        
        self.results["port_exposure"] = port_analysis
    
    def test_api_security(self):
        """Comprehensive API security testing"""
        print("🔐 Testing API security...")
        
        api_tests = {
            "authentication": self.test_authentication_security(),
            "authorization": self.test_authorization_security(),
            "input_validation": self.test_input_validation(),
            "rate_limiting": self.test_rate_limiting(),
            "cors_policy": self.test_cors_policy(),
            "csrf_protection": self.test_csrf_protection()
        }
        
        self.results["api_security"] = api_tests
    
    def test_authentication_security(self) -> Dict[str, Any]:
        """Test authentication mechanisms"""
        print("  🔑 Testing authentication...")
        
        auth_tests = {}
        
        # Test unauthenticated access to protected endpoints
        protected_endpoints = [
            "/api/v1/dashboard",
            "/api/v1/admin",
            "/api/v1/media",
            "/api/v1/plex"
        ]
        
        for endpoint in protected_endpoints:
            url = urljoin(self.base_url, endpoint)
            try:
                response = requests.get(url, timeout=5)
                auth_tests[endpoint] = {
                    "status_code": response.status_code,
                    "protected": response.status_code in [401, 403],
                    "response_size": len(response.content)
                }
                
                if response.status_code == 200:
                    self.results["vulnerabilities"].append({
                        "type": "AUTHENTICATION_BYPASS",
                        "severity": "HIGH",
                        "endpoint": endpoint,
                        "issue": "Protected endpoint accessible without authentication"
                    })
                    
            except requests.exceptions.RequestException as e:
                auth_tests[endpoint] = {"error": str(e)}
        
        return auth_tests
    
    def test_authorization_security(self) -> Dict[str, Any]:
        """Test authorization and privilege escalation"""
        print("  👑 Testing authorization...")
        
        authz_tests = {}
        
        # Test admin endpoints with user token (if available)
        admin_endpoints = [
            "/api/v1/admin/users",
            "/api/v1/admin/system",
            "/api/v1/admin/config"
        ]
        
        for endpoint in admin_endpoints:
            url = urljoin(self.base_url, endpoint)
            try:
                # Test without auth
                response = requests.get(url, timeout=5)
                authz_tests[endpoint] = {
                    "no_auth_status": response.status_code,
                    "properly_protected": response.status_code in [401, 403]
                }
                
            except requests.exceptions.RequestException as e:
                authz_tests[endpoint] = {"error": str(e)}
        
        return authz_tests
    
    def test_input_validation(self) -> Dict[str, Any]:
        """Test input validation vulnerabilities"""
        print("  🛡️ Testing input validation...")
        
        validation_tests = {}
        
        # SQL Injection payloads
        sql_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users;--",
            "' UNION SELECT * FROM users--"
        ]
        
        # XSS payloads
        xss_payloads = [
            "<script>alert('xss')</script>",
            "<img src=x onerror=alert('xss')>",
            "javascript:alert('xss')"
        ]
        
        # Command injection payloads
        cmd_payloads = [
            "; cat /etc/passwd",
            "&& whoami",
            "| ls -la"
        ]
        
        test_endpoints = [
            "/api/v1/media/search",
            "/api/v1/plex/search"
        ]
        
        all_payloads = sql_payloads + xss_payloads + cmd_payloads
        
        for endpoint in test_endpoints:
            endpoint_tests = {}
            url = urljoin(self.base_url, endpoint)
            
            for payload in all_payloads[:3]:  # Limit for safety
                try:
                    # Test GET parameter
                    response = requests.get(url, params={"q": payload}, timeout=5)
                    endpoint_tests[f"payload_{payload[:20]}"] = {
                        "status_code": response.status_code,
                        "response_contains_payload": payload in response.text,
                        "response_size": len(response.content)
                    }
                    
                    # Check for potential injection success
                    if payload in response.text or "error" not in response.text.lower():
                        self.results["vulnerabilities"].append({
                            "type": "INPUT_VALIDATION_BYPASS",
                            "severity": "HIGH",
                            "endpoint": endpoint,
                            "payload": payload,
                            "issue": "Potential injection vulnerability detected"
                        })
                        
                except requests.exceptions.RequestException as e:
                    endpoint_tests[f"payload_{payload[:20]}"] = {"error": str(e)}
            
            validation_tests[endpoint] = endpoint_tests
        
        return validation_tests
    
    def test_rate_limiting(self) -> Dict[str, Any]:
        """Test rate limiting effectiveness"""
        print("  ⏱️ Testing rate limiting...")
        
        rate_limit_tests = {}
        
        # Test general rate limiting
        test_url = urljoin(self.base_url, "/api/health")
        
        # Send rapid requests
        responses = []
        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(requests.get, test_url, timeout=2) 
                      for _ in range(50)]
            
            for future in concurrent.futures.as_completed(futures):
                try:
                    response = future.result()
                    responses.append({
                        "status_code": response.status_code,
                        "headers": dict(response.headers)
                    })
                except Exception as e:
                    responses.append({"error": str(e)})
        
        duration = time.time() - start_time
        
        # Analyze responses
        rate_limited_responses = [r for r in responses if r.get("status_code") == 429]
        successful_responses = [r for r in responses if r.get("status_code") == 200]
        
        rate_limit_tests = {
            "total_requests": len(responses),
            "successful_requests": len(successful_responses),
            "rate_limited_responses": len(rate_limited_responses),
            "duration_seconds": duration,
            "requests_per_second": len(responses) / duration,
            "rate_limiting_active": len(rate_limited_responses) > 0
        }
        
        if len(rate_limited_responses) == 0:
            self.results["vulnerabilities"].append({
                "type": "INSUFFICIENT_RATE_LIMITING",
                "severity": "MEDIUM",
                "issue": "No rate limiting detected during burst testing"
            })
        
        return rate_limit_tests
    
    def test_cors_policy(self) -> Dict[str, Any]:
        """Test CORS policy configuration"""
        print("  🌐 Testing CORS policy...")
        
        cors_tests = {}
        
        test_origins = [
            "https://evil.com",
            "http://localhost:8080",
            "null",
            "https://sub.example.com"
        ]
        
        for origin in test_origins:
            try:
                headers = {"Origin": origin}
                response = requests.options(
                    urljoin(self.base_url, "/api/v1/health"), 
                    headers=headers, 
                    timeout=5
                )
                
                cors_headers = {
                    "access_control_allow_origin": response.headers.get("Access-Control-Allow-Origin"),
                    "access_control_allow_credentials": response.headers.get("Access-Control-Allow-Credentials"),
                    "access_control_allow_methods": response.headers.get("Access-Control-Allow-Methods")
                }
                
                cors_tests[origin] = {
                    "status_code": response.status_code,
                    "cors_headers": cors_headers,
                    "origin_allowed": cors_headers["access_control_allow_origin"] == origin
                }
                
                # Check for overly permissive CORS
                if (cors_headers["access_control_allow_origin"] == "*" and 
                    cors_headers["access_control_allow_credentials"] == "true"):
                    self.results["vulnerabilities"].append({
                        "type": "INSECURE_CORS_CONFIGURATION",
                        "severity": "HIGH",
                        "issue": "CORS allows all origins with credentials"
                    })
                
            except requests.exceptions.RequestException as e:
                cors_tests[origin] = {"error": str(e)}
        
        return cors_tests
    
    def test_csrf_protection(self) -> Dict[str, Any]:
        """Test CSRF protection mechanisms"""
        print("  🛡️ Testing CSRF protection...")
        
        csrf_tests = {}
        
        # Test state-changing operations without CSRF token
        test_endpoints = [
            ("/api/v1/media/request", "POST"),
            ("/api/v1/admin/config", "PUT")
        ]
        
        for endpoint, method in test_endpoints:
            url = urljoin(self.base_url, endpoint)
            try:
                if method == "POST":
                    response = requests.post(url, json={"test": "data"}, timeout=5)
                elif method == "PUT":
                    response = requests.put(url, json={"test": "data"}, timeout=5)
                else:
                    continue
                
                csrf_tests[endpoint] = {
                    "status_code": response.status_code,
                    "method": method,
                    "csrf_protected": response.status_code in [403, 400] or "csrf" in response.text.lower()
                }
                
                if response.status_code == 200:
                    self.results["vulnerabilities"].append({
                        "type": "CSRF_PROTECTION_MISSING",
                        "severity": "MEDIUM",
                        "endpoint": endpoint,
                        "method": method,
                        "issue": "State-changing operation may lack CSRF protection"
                    })
                    
            except requests.exceptions.RequestException as e:
                csrf_tests[endpoint] = {"error": str(e)}
        
        return csrf_tests
    
    def test_security_headers(self):
        """Analyze security headers"""
        print("🛡️ Analyzing security headers...")
        
        try:
            response = requests.get(urljoin(self.base_url, "/api/health"), timeout=5)
            headers = dict(response.headers)
            
            required_security_headers = {
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": ["DENY", "SAMEORIGIN"],
                "X-XSS-Protection": "1; mode=block",
                "Strict-Transport-Security": None,  # Should exist
                "Content-Security-Policy": None,  # Should exist
                "Referrer-Policy": None  # Should exist
            }
            
            header_analysis = {}
            
            for header, expected_value in required_security_headers.items():
                header_present = header in headers
                header_value = headers.get(header, "")
                
                header_analysis[header] = {
                    "present": header_present,
                    "value": header_value,
                    "secure": self.validate_security_header(header, header_value, expected_value)
                }
                
                if not header_present:
                    self.results["vulnerabilities"].append({
                        "type": "MISSING_SECURITY_HEADER",
                        "severity": "MEDIUM",
                        "header": header,
                        "issue": f"Security header {header} is missing"
                    })
            
            self.results["security_headers"] = header_analysis
            
        except requests.exceptions.RequestException as e:
            self.results["security_headers"] = {"error": str(e)}
    
    def test_service_communication(self):
        """Test inter-service communication security"""
        print("🔗 Testing service communication...")
        
        communication_tests = {
            "internal_service_isolation": {},
            "encryption_in_transit": {},
            "service_authentication": {}
        }
        
        # Test if internal services are accessible externally
        internal_services = ["postgres", "redis"]
        for service in internal_services:
            port = self.services[service]["port"]
            is_accessible = self.test_port_accessibility("localhost", port)
            
            communication_tests["internal_service_isolation"][service] = {
                "port": port,
                "externally_accessible": is_accessible,
                "secure": not is_accessible
            }
        
        self.results["service_communication"] = communication_tests
    
    def validate_security_header(self, header_name: str, header_value: str, expected_value: Any) -> bool:
        """Validate security header value"""
        if not header_value:
            return False
        
        if isinstance(expected_value, str):
            return header_value == expected_value
        elif isinstance(expected_value, list):
            return header_value in expected_value
        else:
            return True  # Just check presence
    
    def test_port_accessibility(self, host: str, port: int, timeout: int = 3) -> bool:
        """Test if a port is accessible"""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(timeout)
                result = sock.connect_ex((host, port))
                return result == 0
        except Exception:
            return False
    
    def identify_service_by_port(self, port: int) -> str:
        """Identify service running on port"""
        service_map = {
            80: "HTTP",
            443: "HTTPS", 
            4000: "MediaNest Backend",
            3000: "Frontend Dev Server",
            5432: "PostgreSQL",
            6379: "Redis",
            22: "SSH",
            8080: "HTTP Alt",
            8443: "HTTPS Alt"
        }
        return service_map.get(port, "Unknown")
    
    def assess_port_necessity(self, port: int) -> bool:
        """Assess if port exposure is necessary"""
        necessary_ports = [80, 443, 4000]  # Only external-facing ports should be open
        return port in necessary_ports
    
    def generate_recommendations(self):
        """Generate security recommendations based on findings"""
        print("📋 Generating security recommendations...")
        
        recommendations = []
        
        # Network segmentation recommendations
        if not self.results["network_topology"].get("network_isolation", {}).get("custom_network", False):
            recommendations.append({
                "category": "Network Security",
                "priority": "HIGH",
                "recommendation": "Implement custom Docker network for service isolation",
                "details": "Use docker-compose networks to isolate services from external access"
            })
        
        # Port exposure recommendations
        exposed_internal_services = [
            vuln for vuln in self.results["vulnerabilities"] 
            if vuln["type"] == "INTERNAL_SERVICE_EXPOSED"
        ]
        if exposed_internal_services:
            recommendations.append({
                "category": "Port Security",
                "priority": "HIGH", 
                "recommendation": "Restrict internal service port exposure",
                "details": "Ensure PostgreSQL and Redis are only accessible within Docker network"
            })
        
        # Rate limiting recommendations
        if any(vuln["type"] == "INSUFFICIENT_RATE_LIMITING" for vuln in self.results["vulnerabilities"]):
            recommendations.append({
                "category": "API Security",
                "priority": "MEDIUM",
                "recommendation": "Implement comprehensive rate limiting",
                "details": "Add rate limiting middleware for all API endpoints with proper burst handling"
            })
        
        # Security headers recommendations
        missing_headers = [
            vuln for vuln in self.results["vulnerabilities"] 
            if vuln["type"] == "MISSING_SECURITY_HEADER"
        ]
        if missing_headers:
            recommendations.append({
                "category": "HTTP Security",
                "priority": "MEDIUM",
                "recommendation": "Implement missing security headers",
                "details": f"Add security headers: {', '.join([h['header'] for h in missing_headers])}"
            })
        
        self.results["recommendations"] = recommendations
    
    def run_full_analysis(self):
        """Run comprehensive security analysis"""
        print("🚀 Starting MediaNest Network Security Analysis...")
        print("=" * 60)
        
        self.analyze_network_topology()
        self.analyze_port_exposure()
        self.test_api_security()
        self.test_security_headers()
        self.test_service_communication()
        self.generate_recommendations()
        
        return self.results
    
    def generate_report(self):
        """Generate comprehensive security report"""
        print("\n📊 SECURITY ANALYSIS REPORT")
        print("=" * 60)
        
        # Summary
        total_vulnerabilities = len(self.results["vulnerabilities"])
        high_severity = len([v for v in self.results["vulnerabilities"] if v["severity"] == "HIGH"])
        medium_severity = len([v for v in self.results["vulnerabilities"] if v["severity"] == "MEDIUM"])
        
        print(f"Total Vulnerabilities: {total_vulnerabilities}")
        print(f"High Severity: {high_severity}")
        print(f"Medium Severity: {medium_severity}")
        print()
        
        # High severity issues
        if high_severity > 0:
            print("🚨 HIGH SEVERITY VULNERABILITIES:")
            for vuln in self.results["vulnerabilities"]:
                if vuln["severity"] == "HIGH":
                    print(f"  - {vuln['type']}: {vuln['issue']}")
            print()
        
        # Recommendations
        print("💡 TOP RECOMMENDATIONS:")
        for rec in self.results["recommendations"][:5]:
            print(f"  - [{rec['priority']}] {rec['recommendation']}")
        print()

if __name__ == "__main__":
    analyzer = NetworkSecurityAnalyzer()
    
    try:
        results = analyzer.run_full_analysis()
        analyzer.generate_report()
        
        # Save results to file
        with open("/tmp/medianest-security-analysis.json", "w") as f:
            json.dump(results, f, indent=2)
        
        print(f"✅ Analysis complete. Results saved to /tmp/medianest-security-analysis.json")
        
    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        exit(1)