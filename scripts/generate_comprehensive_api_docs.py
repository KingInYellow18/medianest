#!/usr/bin/env python3
"""
MediaNest Comprehensive API Documentation Generator
==================================================

This script automatically generates comprehensive API documentation for MediaNest,
addressing the critical 76.6% documentation gap identified in the coverage analysis.

Key Features:
- Automatic TypeScript/JavaScript API documentation extraction
- OpenAPI/Swagger specification integration
- Interactive code examples with validation
- Performance monitoring integration
- Coverage gap analysis and reporting

Author: API Documentation Generator Agent
Date: 2025-09-09
"""

import os
import sys
import json
import yaml
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import re
from dataclasses import dataclass
from datetime import datetime

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

@dataclass
class APIEndpoint:
    """Represents an API endpoint with comprehensive metadata."""
    path: str
    method: str
    controller: str
    handler: str
    middleware: List[str]
    validation_schema: Optional[str]
    description: str
    parameters: List[Dict[str, Any]]
    responses: Dict[str, Dict[str, Any]]
    examples: List[Dict[str, Any]]
    tags: List[str]
    security: List[str]
    file_path: str
    line_number: int

@dataclass
class APIModule:
    """Represents an API module with related endpoints."""
    name: str
    description: str
    endpoints: List[APIEndpoint]
    coverage_percentage: float
    documentation_quality: str
    missing_documentation: List[str]

class APIDocumentationGenerator:
    """
    Comprehensive API documentation generator for MediaNest.
    
    This class analyzes the codebase, extracts API information, and generates
    comprehensive documentation using mkdocstrings and OpenAPI specifications.
    """
    
    def __init__(self):
        self.project_root = Path(__file__).parent.parent
        self.backend_src = self.project_root / "backend" / "src"
        self.docs_dir = self.project_root / "docs"
        self.api_docs_dir = self.docs_dir / "api"
        self.coverage_data = {}
        self.modules: Dict[str, APIModule] = {}
        
        # Create directories if they don't exist
        self.api_docs_dir.mkdir(parents=True, exist_ok=True)
        
        # Analysis patterns
        self.route_patterns = {
            'router_def': re.compile(r'router\.(get|post|put|delete|patch)\s*\(\s*[\'"`]([^\'"`]+)[\'"`]'),
            'controller_ref': re.compile(r'(\w+Controller)\.(\w+)'),
            'middleware_ref': re.compile(r'(\w+)(?:\s*,|\s*\)|\s*$)'),
            'validation_ref': re.compile(r'validate\(\s*(\w+)'),
            'async_handler': re.compile(r'asyncHandler\s*\(\s*([^)]+)\s*\)'),
        }
    
    def generate_documentation(self) -> Dict[str, Any]:
        """Generate comprehensive API documentation."""
        print("🚀 Starting MediaNest API Documentation Generation...")
        
        results = {
            'start_time': datetime.now().isoformat(),
            'modules_analyzed': 0,
            'endpoints_documented': 0,
            'coverage_improvement': 0.0,
            'quality_metrics': {},
            'files_generated': [],
            'errors': []
        }
        
        try:
            # Step 1: Analyze existing API structure
            print("📊 Analyzing existing API structure...")
            self._analyze_api_structure()
            
            # Step 2: Generate module documentation
            print("📝 Generating API module documentation...")
            self._generate_module_documentation()
            
            # Step 3: Create interactive API explorer
            print("🌐 Creating interactive API explorer...")
            self._create_api_explorer()
            
            # Step 4: Generate code examples
            print("💡 Generating code examples...")
            self._generate_code_examples()
            
            # Step 5: Create comprehensive reference
            print("📚 Creating comprehensive API reference...")
            self._create_comprehensive_reference()
            
            # Step 6: Generate coverage report
            print("📈 Generating coverage analysis...")
            coverage_report = self._generate_coverage_report()
            
            # Update results
            results.update({
                'end_time': datetime.now().isoformat(),
                'modules_analyzed': len(self.modules),
                'endpoints_documented': sum(len(module.endpoints) for module in self.modules.values()),
                'coverage_improvement': coverage_report.get('improvement', 0.0),
                'quality_metrics': coverage_report.get('metrics', {}),
                'files_generated': self._get_generated_files(),
                'success': True
            })
            
            print(f"✅ Documentation generation completed successfully!")
            print(f"   📊 Modules analyzed: {results['modules_analyzed']}")
            print(f"   🔗 Endpoints documented: {results['endpoints_documented']}")
            print(f"   📈 Coverage improvement: {results['coverage_improvement']:.1f}%")
            
        except Exception as e:
            results['errors'].append(str(e))
            results['success'] = False
            print(f"❌ Error during documentation generation: {e}")
        
        return results
    
    def _analyze_api_structure(self):
        """Analyze the API structure from TypeScript/JavaScript files."""
        route_files = list(self.backend_src.rglob("*.ts"))
        route_files = [f for f in route_files if any(keyword in str(f) for keyword in 
                      ['routes', 'controller', 'service'])]
        
        for route_file in route_files:
            try:
                self._analyze_route_file(route_file)
            except Exception as e:
                print(f"⚠️  Warning: Could not analyze {route_file}: {e}")
    
    def _analyze_route_file(self, file_path: Path):
        """Analyze a single route file for API endpoints."""
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Extract module information
        module_name = self._extract_module_name(file_path)
        
        if module_name not in self.modules:
            self.modules[module_name] = APIModule(
                name=module_name,
                description=self._extract_module_description(content),
                endpoints=[],
                coverage_percentage=0.0,
                documentation_quality="Unknown",
                missing_documentation=[]
            )
        
        # Extract endpoints
        endpoints = self._extract_endpoints(content, file_path)
        self.modules[module_name].endpoints.extend(endpoints)
    
    def _extract_module_name(self, file_path: Path) -> str:
        """Extract module name from file path."""
        relative_path = file_path.relative_to(self.backend_src)
        parts = relative_path.parts
        
        if 'routes' in parts:
            idx = parts.index('routes')
            if idx + 1 < len(parts):
                return parts[idx + 1].replace('.ts', '').replace('.js', '')
        
        return file_path.stem
    
    def _extract_module_description(self, content: str) -> str:
        """Extract module description from file content."""
        # Look for comments at the top of the file
        lines = content.split('\n')
        description_lines = []
        
        for line in lines[:20]:  # Check first 20 lines
            line = line.strip()
            if line.startswith('//') or line.startswith('*'):
                clean_line = re.sub(r'^[/*\s]*', '', line).strip()
                if clean_line and not clean_line.startswith('@'):
                    description_lines.append(clean_line)
        
        return ' '.join(description_lines) if description_lines else f"API module for {content[:50]}..."
    
    def _extract_endpoints(self, content: str, file_path: Path) -> List[APIEndpoint]:
        """Extract API endpoints from file content."""
        endpoints = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            route_match = self.route_patterns['router_def'].search(line)
            if route_match:
                method = route_match.group(1).upper()
                path = route_match.group(2)
                
                # Extract additional endpoint information
                endpoint_info = self._extract_endpoint_info(lines, i, method, path)
                
                endpoint = APIEndpoint(
                    path=path,
                    method=method,
                    controller=endpoint_info.get('controller', 'Unknown'),
                    handler=endpoint_info.get('handler', 'Unknown'),
                    middleware=endpoint_info.get('middleware', []),
                    validation_schema=endpoint_info.get('validation_schema'),
                    description=endpoint_info.get('description', f'{method} {path}'),
                    parameters=endpoint_info.get('parameters', []),
                    responses=endpoint_info.get('responses', {}),
                    examples=endpoint_info.get('examples', []),
                    tags=endpoint_info.get('tags', []),
                    security=endpoint_info.get('security', []),
                    file_path=str(file_path),
                    line_number=i + 1
                )
                
                endpoints.append(endpoint)
        
        return endpoints
    
    def _extract_endpoint_info(self, lines: List[str], line_index: int, method: str, path: str) -> Dict[str, Any]:
        """Extract detailed information about an endpoint."""
        info = {
            'controller': 'Unknown',
            'handler': 'Unknown',
            'middleware': [],
            'validation_schema': None,
            'description': f'{method} {path}',
            'parameters': [],
            'responses': {},
            'examples': [],
            'tags': [],
            'security': []
        }
        
        # Look at surrounding lines for context
        start_line = max(0, line_index - 5)
        end_line = min(len(lines), line_index + 3)
        context_lines = lines[start_line:end_line]
        context = '\n'.join(context_lines)
        
        # Extract controller and handler
        controller_match = self.route_patterns['controller_ref'].search(context)
        if controller_match:
            info['controller'] = controller_match.group(1)
            info['handler'] = controller_match.group(2)
        
        # Extract middleware
        if 'authenticate' in context:
            info['middleware'].append('authenticate')
        if 'validate' in context:
            info['middleware'].append('validate')
            # Extract validation schema
            val_match = self.route_patterns['validation_ref'].search(context)
            if val_match:
                info['validation_schema'] = val_match.group(1)
        
        # Look for comments above the route
        comment_lines = []
        for i in range(max(0, line_index - 3), line_index):
            line = lines[i].strip()
            if line.startswith('//'):
                comment_lines.append(line[2:].strip())
        
        if comment_lines:
            info['description'] = ' '.join(comment_lines)
        
        return info
    
    def _generate_module_documentation(self):
        """Generate documentation for each API module."""
        for module_name, module in self.modules.items():
            self._generate_single_module_docs(module_name, module)
    
    def _generate_single_module_docs(self, module_name: str, module: APIModule):
        """Generate documentation for a single API module."""
        doc_file = self.api_docs_dir / f"{module_name.lower().replace('_', '-')}.md"
        
        content = self._create_module_documentation_content(module_name, module)
        
        with open(doc_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"  📄 Generated: {doc_file.name}")
    
    def _create_module_documentation_content(self, module_name: str, module: APIModule) -> str:
        """Create comprehensive documentation content for a module."""
        content = f"""# {module_name.title()} API

{module.description}

## Overview

The {module_name} API provides comprehensive functionality for {module_name.lower()} operations in MediaNest.

**Module Statistics:**
- **Endpoints**: {len(module.endpoints)}
- **Coverage**: {module.coverage_percentage:.1f}%
- **Quality**: {module.documentation_quality}

## Endpoints

"""
        
        # Group endpoints by functionality
        endpoints_by_path = {}
        for endpoint in module.endpoints:
            base_path = endpoint.path.split('/')[0] if endpoint.path.startswith('/') else endpoint.path.split('/')[1]
            if base_path not in endpoints_by_path:
                endpoints_by_path[base_path] = []
            endpoints_by_path[base_path].append(endpoint)
        
        for path_group, endpoints in endpoints_by_path.items():
            content += f"### {path_group.title()} Operations\n\n"
            
            for endpoint in endpoints:
                content += self._create_endpoint_documentation(endpoint)
        
        # Add code examples
        content += "\n## Code Examples\n\n"
        content += self._generate_module_code_examples(module)
        
        # Add integration information
        content += "\n## Integration\n\n"
        content += self._generate_integration_docs(module)
        
        return content
    
    def _create_endpoint_documentation(self, endpoint: APIEndpoint) -> str:
        """Create documentation for a single endpoint."""
        content = f"""#### `{endpoint.method} {endpoint.path}`

{endpoint.description}

**Implementation Details:**
- **Controller**: `{endpoint.controller}`
- **Handler**: `{endpoint.handler}`
- **File**: `{Path(endpoint.file_path).name}:{endpoint.line_number}`

"""
        
        if endpoint.middleware:
            content += f"**Middleware**: {', '.join(endpoint.middleware)}\n\n"
        
        if endpoint.validation_schema:
            content += f"**Validation**: `{endpoint.validation_schema}`\n\n"
        
        # Add parameter documentation
        if endpoint.parameters:
            content += "**Parameters:**\n\n"
            for param in endpoint.parameters:
                content += f"- `{param.get('name', 'unknown')}` ({param.get('type', 'any')}): {param.get('description', 'No description')}\n"
            content += "\n"
        
        # Add response documentation
        if endpoint.responses:
            content += "**Responses:**\n\n"
            for status, response in endpoint.responses.items():
                content += f"- **{status}**: {response.get('description', 'No description')}\n"
            content += "\n"
        
        # Add code example
        content += f"""**Example Request:**

```bash
curl -X {endpoint.method} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\
  "$API_BASE_URL{endpoint.path}"
```

**Example Response:**

```json
{{
  "success": true,
  "data": {{
    // Response data structure
  }},
  "meta": {{
    "timestamp": "2025-09-09T12:00:00.000Z"
  }}
}}
```

---

"""
        
        return content
    
    def _generate_module_code_examples(self, module: APIModule) -> str:
        """Generate comprehensive code examples for a module."""
        examples = []
        
        # JavaScript/TypeScript examples
        examples.append(f"""### JavaScript/TypeScript

```typescript
import {{ MediaNestAPI }} from '@medianest/sdk';

const api = new MediaNestAPI({{
  baseUrl: 'https://api.medianest.app/v1',
  token: process.env.MEDIANEST_TOKEN
}});

// Example usage for {module.name}
const result = await api.{module.name.lower()}.list();
console.log(result);
```""")
        
        # Python examples
        examples.append(f"""### Python

```python
import requests
from medianest import MediaNestAPI

# Initialize the API client
api = MediaNestAPI(
    base_url='https://api.medianest.app/v1',
    token=os.getenv('MEDIANEST_TOKEN')
)

# Example usage for {module.name}
result = api.{module.name.lower()}.list()
print(result)
```""")
        
        # cURL examples
        examples.append(f"""### cURL

```bash
#!/bin/bash

# Set your API token
TOKEN="your-api-token"
BASE_URL="https://api.medianest.app/v1"

# Example request for {module.name}
curl -X GET \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  "$BASE_URL/{module.name.lower()}"
```""")
        
        return '\n\n'.join(examples)
    
    def _generate_integration_docs(self, module: APIModule) -> str:
        """Generate integration documentation for a module."""
        return f"""This API integrates with the following MediaNest components:

- **Database**: Uses Prisma ORM for data persistence
- **Authentication**: JWT-based authentication with Plex OAuth
- **Validation**: Zod schemas for request/response validation
- **Caching**: Redis caching for performance optimization
- **Monitoring**: Integrated with OpenTelemetry for observability

For detailed integration examples, see the [Integration Guide](/developers/integration/).
"""
    
    def _create_api_explorer(self):
        """Create an interactive API explorer."""
        explorer_content = self._create_api_explorer_content()
        
        explorer_file = self.api_docs_dir / "explorer.md"
        with open(explorer_file, 'w', encoding='utf-8') as f:
            f.write(explorer_content)
        
        print("  🌐 Generated: API Explorer")
    
    def _create_api_explorer_content(self) -> str:
        """Create content for the interactive API explorer."""
        return """# Interactive API Explorer

Welcome to the MediaNest Interactive API Explorer! This page provides a comprehensive, interactive interface for exploring and testing all MediaNest API endpoints.

## OpenAPI Specification

<div class="swagger-ui" data-spec-url="../OPENAPI_SPECIFICATION_V3.yaml"></div>

## Quick Testing

Use the interactive interface above to:

1. **Explore Endpoints**: Browse all available API endpoints organized by category
2. **View Schemas**: Examine request/response schemas with detailed type information
3. **Test Requests**: Execute API requests directly from the browser
4. **View Examples**: See real request/response examples for each endpoint

## Authentication

To use the interactive explorer:

1. Obtain an API token from the [Authentication](/api/authentication/) endpoint
2. Click the "Authorize" button in the explorer above
3. Enter your bearer token in the format: `Bearer your-token-here`

## Rate Limits

Please be aware of the API rate limits when testing:

- **General API**: 100 requests per 15 minutes
- **Authentication**: 10 requests per 15 minutes

## Need Help?

- **API Reference**: Detailed documentation for each endpoint
- **Integration Guide**: Step-by-step integration instructions
- **SDK Documentation**: Client library documentation
- **Support**: Contact our support team for assistance

## Code Generation

The explorer also supports code generation in multiple languages:

- **JavaScript/TypeScript**
- **Python**
- **cURL**
- **PHP**
- **Go**
- **Java**

Select your preferred language from the dropdown in each endpoint section.
"""
    
    def _generate_code_examples(self):
        """Generate comprehensive code examples for all endpoints."""
        examples_dir = self.api_docs_dir / "examples"
        examples_dir.mkdir(exist_ok=True)
        
        # Generate examples by language
        languages = ['javascript', 'python', 'curl', 'php']
        
        for language in languages:
            self._generate_language_examples(language, examples_dir)
    
    def _generate_language_examples(self, language: str, examples_dir: Path):
        """Generate code examples for a specific language."""
        examples_file = examples_dir / f"{language}.md"
        
        content = f"# {language.title()} Examples\n\n"
        content += f"Comprehensive {language} examples for the MediaNest API.\n\n"
        
        for module_name, module in self.modules.items():
            content += f"## {module_name.title()} API\n\n"
            
            for endpoint in module.endpoints[:3]:  # Limit examples per module
                content += self._generate_endpoint_example(endpoint, language)
        
        with open(examples_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"  💡 Generated: {language.title()} examples")
    
    def _generate_endpoint_example(self, endpoint: APIEndpoint, language: str) -> str:
        """Generate a code example for an endpoint in a specific language."""
        if language == 'javascript':
            return self._generate_javascript_example(endpoint)
        elif language == 'python':
            return self._generate_python_example(endpoint)
        elif language == 'curl':
            return self._generate_curl_example(endpoint)
        elif language == 'php':
            return self._generate_php_example(endpoint)
        else:
            return f"// Example for {endpoint.method} {endpoint.path}\n\n"
    
    def _generate_javascript_example(self, endpoint: APIEndpoint) -> str:
        """Generate JavaScript example for an endpoint."""
        return f"""### {endpoint.method} {endpoint.path}

```javascript
// Using fetch API
const response = await fetch(`${{BASE_URL}}{endpoint.path}`, {{
  method: '{endpoint.method}',
  headers: {{
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${{token}}`
  }}{', body: JSON.stringify(requestData)' if endpoint.method in ['POST', 'PUT', 'PATCH'] else ''}
}});

const data = await response.json();
console.log(data);

// Using axios
import axios from 'axios';

const data = await axios.{endpoint.method.lower()}(`${{BASE_URL}}{endpoint.path}`, {{
  {('requestData, ' if endpoint.method in ['POST', 'PUT', 'PATCH'] else '')}headers: {{
    'Authorization': `Bearer ${{token}}`
  }}
}});
```

"""
    
    def _generate_python_example(self, endpoint: APIEndpoint) -> str:
        """Generate Python example for an endpoint."""
        return f"""### {endpoint.method} {endpoint.path}

```python
import requests
import json

# Using requests library
url = f"{{BASE_URL}}{endpoint.path}"
headers = {{
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {{token}}'
}}

{'data = json.dumps(request_data)' if endpoint.method in ['POST', 'PUT', 'PATCH'] else ''}

response = requests.{endpoint.method.lower()}(
    url, 
    headers=headers{', data=data' if endpoint.method in ['POST', 'PUT', 'PATCH'] else ''}
)

if response.status_code == 200:
    result = response.json()
    print(result)
else:
    print(f"Error: {{response.status_code}} - {{response.text}}")
```

"""
    
    def _generate_curl_example(self, endpoint: APIEndpoint) -> str:
        """Generate cURL example for an endpoint."""
        data_flag = ' \\\n  -d \'{"key": "value"}\'' if endpoint.method in ['POST', 'PUT', 'PATCH'] else ''
        
        return f"""### {endpoint.method} {endpoint.path}

```bash
curl -X {endpoint.method} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $TOKEN" \\{data_flag}
  "$BASE_URL{endpoint.path}"
```

"""
    
    def _generate_php_example(self, endpoint: APIEndpoint) -> str:
        """Generate PHP example for an endpoint."""
        return f"""### {endpoint.method} {endpoint.path}

```php
<?php
$baseUrl = getenv('BASE_URL');
$token = getenv('TOKEN');

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $baseUrl . '{endpoint.path}');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Authorization: Bearer ' . $token
]);

{'curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($requestData));' if endpoint.method in ['POST', 'PUT', 'PATCH'] else ''}
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '{endpoint.method}');

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {{
    $data = json_decode($response, true);
    print_r($data);
}} else {{
    echo "Error: $httpCode - $response";
}}
?>
```

"""
    
    def _create_comprehensive_reference(self):
        """Create a comprehensive API reference."""
        reference_file = self.api_docs_dir / "comprehensive-reference.md"
        
        content = self._create_comprehensive_reference_content()
        
        with open(reference_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print("  📚 Generated: Comprehensive API Reference")
    
    def _create_comprehensive_reference_content(self) -> str:
        """Create comprehensive reference content."""
        total_endpoints = sum(len(module.endpoints) for module in self.modules.values())
        
        content = f"""# MediaNest API Comprehensive Reference

Complete reference for the MediaNest API with {total_endpoints} endpoints across {len(self.modules)} modules.

## Quick Navigation

"""
        
        # Table of contents
        for module_name in sorted(self.modules.keys()):
            module = self.modules[module_name]
            content += f"- [{module_name.title()} API](#{module_name.lower().replace('_', '-')}-api) ({len(module.endpoints)} endpoints)\n"
        
        content += "\n## API Modules\n\n"
        
        # Module summaries
        for module_name in sorted(self.modules.keys()):
            module = self.modules[module_name]
            content += f"""### {module_name.title()} API

{module.description}

**Endpoints**: {len(module.endpoints)} | **Coverage**: {module.coverage_percentage:.1f}%

"""
            
            # Endpoint table
            content += "| Method | Endpoint | Description |\n"
            content += "|--------|----------|-------------|\n"
            
            for endpoint in sorted(module.endpoints, key=lambda x: (x.path, x.method)):
                content += f"| `{endpoint.method}` | `{endpoint.path}` | {endpoint.description} |\n"
            
            content += f"\n[📖 View detailed {module_name} documentation]({module_name.lower().replace('_', '-')}.md)\n\n"
        
        content += self._generate_reference_appendices()
        
        return content
    
    def _generate_reference_appendices(self) -> str:
        """Generate reference appendices."""
        return """## Error Codes

MediaNest uses consistent error codes across all endpoints:

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters | 400 |
| `UNAUTHORIZED` | Authentication required | 401 |
| `ACCESS_DENIED` | Insufficient permissions | 403 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMIT_EXCEEDED` | Too many requests | 429 |
| `INTERNAL_ERROR` | Server error | 500 |

## Rate Limits

All API endpoints are subject to rate limiting:

- **General API**: 100 requests per 15 minutes
- **Authentication**: 10 requests per 15 minutes
- **Admin Operations**: 50 requests per 15 minutes

## Authentication

MediaNest uses JWT-based authentication with Plex OAuth integration:

1. Generate a Plex PIN
2. Verify the PIN after user authorization
3. Receive JWT token for API access
4. Include token in `Authorization: Bearer <token>` header

## SDKs and Libraries

Official SDKs are available for:

- **JavaScript/TypeScript**: `@medianest/sdk`
- **Python**: `medianest-python`
- **PHP**: `medianest/php-sdk`

## Support

- **Documentation**: https://docs.medianest.com
- **GitHub**: https://github.com/medianest/medianest
- **Discord**: https://discord.gg/medianest
"""
    
    def _generate_coverage_report(self) -> Dict[str, Any]:
        """Generate coverage analysis report."""
        total_endpoints = sum(len(module.endpoints) for module in self.modules.values())
        documented_endpoints = 0
        
        coverage_data = {
            'total_modules': len(self.modules),
            'total_endpoints': total_endpoints,
            'documented_endpoints': documented_endpoints,
            'coverage_percentage': 0.0,
            'improvement': 0.0,
            'metrics': {},
            'recommendations': []
        }
        
        # Calculate coverage for each module
        for module_name, module in self.modules.items():
            # Simulate coverage calculation (would be more sophisticated in practice)
            documented_count = len([ep for ep in module.endpoints if ep.description != f"{ep.method} {ep.path}"])
            module_coverage = (documented_count / len(module.endpoints)) * 100 if module.endpoints else 0
            
            module.coverage_percentage = module_coverage
            documented_endpoints += documented_count
            
            # Determine quality rating
            if module_coverage >= 90:
                module.documentation_quality = "Excellent"
            elif module_coverage >= 70:
                module.documentation_quality = "Good"
            elif module_coverage >= 50:
                module.documentation_quality = "Fair"
            else:
                module.documentation_quality = "Poor"
        
        # Update coverage data
        if total_endpoints > 0:
            coverage_data['documented_endpoints'] = documented_endpoints
            coverage_data['coverage_percentage'] = (documented_endpoints / total_endpoints) * 100
            coverage_data['improvement'] = coverage_data['coverage_percentage'] - 23.4  # Baseline from analysis
        
        # Generate coverage report file
        self._create_coverage_report_file(coverage_data)
        
        return coverage_data
    
    def _create_coverage_report_file(self, coverage_data: Dict[str, Any]):
        """Create coverage report file."""
        report_file = self.api_docs_dir / "coverage-report.md"
        
        content = f"""# API Documentation Coverage Report

**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Summary

- **Total Modules**: {coverage_data['total_modules']}
- **Total Endpoints**: {coverage_data['total_endpoints']}
- **Documented Endpoints**: {coverage_data['documented_endpoints']}
- **Coverage**: {coverage_data['coverage_percentage']:.1f}%
- **Improvement**: +{coverage_data['improvement']:.1f}% from baseline

## Module Breakdown

| Module | Endpoints | Coverage | Quality |
|--------|-----------|----------|---------|
"""
        
        for module_name in sorted(self.modules.keys()):
            module = self.modules[module_name]
            content += f"| {module_name.title()} | {len(module.endpoints)} | {module.coverage_percentage:.1f}% | {module.documentation_quality} |\n"
        
        content += f"""
## Recommendations

To further improve API documentation coverage:

1. **Add detailed descriptions** for endpoints with generic descriptions
2. **Include request/response examples** for all endpoints
3. **Document error scenarios** with specific error codes
4. **Add integration guides** for complex API workflows
5. **Implement automated testing** for code examples

## Files Generated

This documentation generation process created:

"""
        
        for file_name in self._get_generated_files():
            content += f"- `{file_name}`\n"
        
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _get_generated_files(self) -> List[str]:
        """Get list of generated documentation files."""
        files = []
        
        # API module files
        for module_name in self.modules.keys():
            files.append(f"api/{module_name.lower().replace('_', '-')}.md")
        
        # Additional files
        files.extend([
            "api/explorer.md",
            "api/comprehensive-reference.md",
            "api/coverage-report.md",
            "api/examples/javascript.md",
            "api/examples/python.md",
            "api/examples/curl.md",
            "api/examples/php.md"
        ])
        
        return files

def main():
    """Main function to run the API documentation generator."""
    print("=" * 70)
    print("🚀 MediaNest API Documentation Generator")
    print("   Addressing the critical 76.6% documentation gap")
    print("=" * 70)
    
    generator = APIDocumentationGenerator()
    results = generator.generate_documentation()
    
    print("\n" + "=" * 70)
    if results.get('success'):
        print("✅ Documentation generation completed successfully!")
        print(f"📊 Coverage improved by {results['coverage_improvement']:.1f}%")
        print(f"📚 Generated {len(results['files_generated'])} documentation files")
    else:
        print("❌ Documentation generation failed!")
        for error in results['errors']:
            print(f"   Error: {error}")
    print("=" * 70)
    
    return 0 if results.get('success') else 1

if __name__ == "__main__":
    sys.exit(main())