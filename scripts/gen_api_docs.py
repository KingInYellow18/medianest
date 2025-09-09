#!/usr/bin/env python3
"""
MediaNest API Documentation Generator
Generates API documentation from OpenAPI/Swagger specifications
"""

import os
import json
from pathlib import Path

def generate_api_docs():
    """Generate API documentation from API specifications."""
    
    # Define the docs directory
    docs_dir = Path(__file__).parent.parent / "docs"
    api_dir = docs_dir / "api"
    
    # Ensure API directory exists
    api_dir.mkdir(exist_ok=True)
    
    # API endpoints configuration
    api_endpoints = {
        "authentication": {
            "title": "Authentication API",
            "description": "User authentication and authorization endpoints",
            "methods": ["POST", "GET", "PUT", "DELETE"],
            "base_url": "/api/v1/auth"
        },
        "media": {
            "title": "Media API", 
            "description": "Media file management and processing endpoints",
            "methods": ["GET", "POST", "PUT", "DELETE", "PATCH"],
            "base_url": "/api/v1/media"
        },
        "collections": {
            "title": "Collections API",
            "description": "Media collection management endpoints", 
            "methods": ["GET", "POST", "PUT", "DELETE"],
            "base_url": "/api/v1/collections"
        },
        "users": {
            "title": "User Management API",
            "description": "User account and profile management endpoints",
            "methods": ["GET", "POST", "PUT", "DELETE"],
            "base_url": "/api/v1/users"
        },
        "search": {
            "title": "Search API",
            "description": "Advanced search and filtering endpoints",
            "methods": ["GET", "POST"],
            "base_url": "/api/v1/search"
        }
    }
    
    # Generate individual API documentation files
    for endpoint, config in api_endpoints.items():
        api_file = api_dir / f"{endpoint}.md"
        
        # Check if file already exists with content
        if api_file.exists() and api_file.stat().st_size > 100:
            print(f"API documentation already exists: {api_file}")
            continue
            
        generate_api_endpoint_docs(api_file, endpoint, config)
        print(f"Generated API documentation: {api_file}")
    
    # Generate API index if it doesn't exist
    index_file = api_dir / "index.md"
    if not index_file.exists():
        generate_api_index(index_file, api_endpoints)
        print(f"Generated API index: {index_file}")

def generate_api_endpoint_docs(file_path, endpoint, config):
    """Generate documentation for a specific API endpoint."""
    
    content = f'''# {config["title"]}

{config["description"]}

## Base URL

```
{config["base_url"]}
```

## Authentication

All API endpoints require authentication unless otherwise specified.

### Authentication Header

```http
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Available Methods

{" | ".join([f"`{method}`" for method in config["methods"]])}

## Examples

### Basic Request

```bash
curl -X GET \\
  "{config["base_url"]}" \\
  -H "Authorization: Bearer <your-jwt-token>" \\
  -H "Content-Type: application/json"
```

### Response Format

```json
{{
  "success": true,
  "data": {{}},
  "message": "Success",
  "timestamp": "2025-01-09T00:00:00Z"
}}
```

## Error Handling

### Error Response Format

```json
{{
  "success": false,
  "error": {{
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {{}}
  }},
  "timestamp": "2025-01-09T00:00:00Z"
}}
```

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created successfully |
| 400 | Bad Request - Invalid request parameters |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

## Rate Limiting

### Rate Limits

- **Authenticated users**: 1000 requests per hour
- **Anonymous users**: 100 requests per hour

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1609459200
```

## SDKs and Libraries

### Official SDKs

- [JavaScript SDK](https://github.com/medianest/js-sdk)
- [Python SDK](https://github.com/medianest/python-sdk)
- [Go SDK](https://github.com/medianest/go-sdk)

### Community Libraries

- [PHP Library](https://github.com/community/medianest-php)
- [Ruby Gem](https://github.com/community/medianest-ruby)

## Support

For API support and questions:

- [GitHub Issues](https://github.com/medianest/medianest/issues)
- [Discord Community](https://discord.gg/medianest)
- [Email Support](mailto:api-support@medianest.com)
'''
    
    file_path.write_text(content)

def generate_api_index(file_path, api_endpoints):
    """Generate the main API documentation index."""
    
    content = '''# MediaNest API Documentation

Welcome to the MediaNest API documentation. Our REST API allows you to integrate MediaNest's powerful media management capabilities into your applications.

## Quick Start

1. [Authentication](authentication.md) - Get your API credentials
2. [Media API](media.md) - Upload and manage media files  
3. [Collections API](collections.md) - Organize media into collections
4. [Search API](search.md) - Search and filter media content

## API Overview

MediaNest provides a comprehensive REST API for media management, user administration, and content organization.

### Base URL

```
https://api.medianest.com/v1
```

### Authentication

All API requests require authentication using JWT tokens. See [Authentication](authentication.md) for details.

### Response Format

All API responses follow a consistent JSON format:

```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "timestamp": "2025-01-09T00:00:00Z"
}
```

## Available APIs

'''
    
    for endpoint, config in api_endpoints.items():
        content += f'''### [{config["title"]}]({endpoint}.md)

{config["description"]}

**Base URL:** `{config["base_url"]}`  
**Methods:** {" | ".join([f"`{method}`" for method in config["methods"]])}

'''
    
    content += '''## Getting Started

### 1. Create an Account

Sign up for a MediaNest account at [medianest.com](https://medianest.com).

### 2. Generate API Keys

Navigate to your account settings and generate API keys for your application.

### 3. Make Your First Request

```bash
curl -X GET \\
  "https://api.medianest.com/v1/media" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"
```

## SDKs and Tools

### Official SDKs

- **JavaScript/Node.js**: `npm install @medianest/sdk`
- **Python**: `pip install medianest-sdk`
- **Go**: `go get github.com/medianest/go-sdk`

### API Testing Tools

- [Postman Collection](https://postman.com/medianest)
- [Insomnia Workspace](https://insomnia.rest/medianest)
- [OpenAPI Specification](https://api.medianest.com/openapi.json)

## Support & Community

- **Documentation**: [docs.medianest.com](https://docs.medianest.com)
- **GitHub**: [github.com/medianest/medianest](https://github.com/medianest/medianest)
- **Discord**: [discord.gg/medianest](https://discord.gg/medianest)
- **Email**: [support@medianest.com](mailto:support@medianest.com)

## Changelog

Track API changes and updates in our [changelog](../reference/changelog.md).
'''
    
    file_path.write_text(content)

if __name__ == "__main__":
    generate_api_docs()