# Create API endpoint structure for visualization
api_structure = {
    "Authentication": {
        "endpoints": [
            {"method": "POST", "path": "/api/auth/login", "description": "User login with credentials"},
            {"method": "POST", "path": "/api/auth/logout", "description": "User logout and token invalidation"},
            {"method": "POST", "path": "/api/auth/refresh", "description": "Refresh access token"},
            {"method": "POST", "path": "/api/auth/register", "description": "Register new user (admin only)"}
        ],
        "security": "JWT tokens, rate limiting",
        "priority": "High"
    },
    "User Management": {
        "endpoints": [
            {"method": "GET", "path": "/api/users", "description": "List all users (admin only)"},
            {"method": "POST", "path": "/api/users", "description": "Create new user (admin only)"},
            {"method": "PUT", "path": "/api/users/{id}", "description": "Update user details"},
            {"method": "DELETE", "path": "/api/users/{id}", "description": "Delete user (admin only)"},
            {"method": "GET", "path": "/api/users/profile", "description": "Get current user profile"},
            {"method": "PUT", "path": "/api/users/profile", "description": "Update current user profile"}
        ],
        "security": "JWT authentication, role-based access",
        "priority": "High"
    },
    "Service Monitoring": {
        "endpoints": [
            {"method": "GET", "path": "/api/services/status", "description": "Get all service statuses"},
            {"method": "GET", "path": "/api/services/uptime", "description": "Get uptime statistics"},
            {"method": "GET", "path": "/api/services/health", "description": "Get detailed health checks"}
        ],
        "security": "JWT authentication",
        "priority": "Medium"
    },
    "Media Management": {
        "endpoints": [
            {"method": "GET", "path": "/api/media/requests", "description": "List media requests"},
            {"method": "POST", "path": "/api/media/requests", "description": "Create new media request"},
            {"method": "PUT", "path": "/api/media/requests/{id}", "description": "Update media request"},
            {"method": "DELETE", "path": "/api/media/requests/{id}", "description": "Delete media request"},
            {"method": "GET", "path": "/api/media/downloads", "description": "List YouTube downloads"},
            {"method": "POST", "path": "/api/media/downloads", "description": "Start YouTube download"},
            {"method": "DELETE", "path": "/api/media/downloads/{id}", "description": "Cancel/delete download"}
        ],
        "security": "JWT authentication, user ownership validation",
        "priority": "High"
    },
    "Admin Functions": {
        "endpoints": [
            {"method": "GET", "path": "/api/admin/config", "description": "Get application configuration"},
            {"method": "PUT", "path": "/api/admin/config", "description": "Update application configuration"},
            {"method": "GET", "path": "/api/admin/logs", "description": "Get application logs"},
            {"method": "GET", "path": "/api/admin/system", "description": "Get system health information"},
            {"method": "POST", "path": "/api/admin/backup", "description": "Create system backup"}
        ],
        "security": "JWT authentication, admin role required",
        "priority": "Medium"
    }
}

# Create summary data for chart
api_summary = []
for category, data in api_structure.items():
    endpoint_count = len(data["endpoints"])
    methods = [ep["method"] for ep in data["endpoints"]]
    method_counts = {method: methods.count(method) for method in set(methods)}
    
    api_summary.append({
        "Category": category,
        "Endpoints": endpoint_count,
        "GET": method_counts.get("GET", 0),
        "POST": method_counts.get("POST", 0), 
        "PUT": method_counts.get("PUT", 0),
        "DELETE": method_counts.get("DELETE", 0),
        "Priority": data["priority"],
        "Security": data["security"]
    })

# Save API structure
with open('api_structure.json', 'w') as f:
    json.dump(api_structure, f, indent=2)

with open('api_summary.json', 'w') as f:
    json.dump(api_summary, f, indent=2)

print("API structure data created")
print(f"Total categories: {len(api_structure)}")
total_endpoints = sum(len(data["endpoints"]) for data in api_structure.values())
print(f"Total endpoints: {total_endpoints}")

for item in api_summary:
    print(f"{item['Category']}: {item['Endpoints']} endpoints ({item['Priority']} priority)")