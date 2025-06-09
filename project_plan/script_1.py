import json
from datetime import datetime, timedelta

# Create development timeline data
start_date = datetime(2025, 1, 1)

phases = [
    {
        "phase": "Phase 1: Foundation Setup",
        "start_week": 1,
        "duration_weeks": 2,
        "tasks": [
            "Project scaffolding and repository setup",
            "Docker containerization for development environment", 
            "Basic Flask API with authentication",
            "React frontend with routing and authentication",
            "Database models and migrations",
            "CI/CD pipeline setup"
        ],
        "deliverables": [
            "Development environment ready",
            "Basic authentication system",
            "Initial project structure"
        ]
    },
    {
        "phase": "Phase 2: Core Integrations", 
        "start_week": 3,
        "duration_weeks": 2,
        "tasks": [
            "Uptime Kuma integration for service monitoring",
            "Overseerr API integration for media requests",
            "yt-dlp integration for YouTube downloads",
            "Configuration management system",
            "Basic user interface components"
        ],
        "deliverables": [
            "External service integrations working",
            "Configuration system implemented",
            "Core UI components built"
        ]
    },
    {
        "phase": "Phase 3: User Features",
        "start_week": 5, 
        "duration_weeks": 2,
        "tasks": [
            "User dashboard with service status",
            "Media request interface",
            "YouTube download manager",
            "Plex setup guide and FAQ system",
            "User authentication and session management"
        ],
        "deliverables": [
            "Complete user dashboard",
            "Media management features",
            "User guide system"
        ]
    },
    {
        "phase": "Phase 4: Admin Features",
        "start_week": 7,
        "duration_weeks": 2, 
        "tasks": [
            "Admin panel for user management",
            "Configuration editor",
            "Log viewer and system health monitoring",
            "User role and permission system",
            "Backup and restore functionality"
        ],
        "deliverables": [
            "Complete admin panel",
            "User management system",
            "System monitoring tools"
        ]
    },
    {
        "phase": "Phase 5: Testing & Deployment",
        "start_week": 9,
        "duration_weeks": 2,
        "tasks": [
            "Comprehensive testing (unit, integration, e2e)",
            "Security audit and penetration testing", 
            "Performance optimization",
            "Production deployment setup",
            "Documentation completion"
        ],
        "deliverables": [
            "Fully tested application",
            "Production-ready deployment",
            "Complete documentation"
        ]
    }
]

# Create timeline data for visualization
timeline_data = []
for phase in phases:
    start_date_phase = start_date + timedelta(weeks=phase["start_week"]-1)
    end_date_phase = start_date_phase + timedelta(weeks=phase["duration_weeks"])
    
    timeline_data.append({
        "Phase": phase["phase"],
        "Start": start_date_phase.strftime("%Y-%m-%d"),
        "End": end_date_phase.strftime("%Y-%m-%d"), 
        "Duration": phase["duration_weeks"],
        "Tasks": len(phase["tasks"]),
        "Deliverables": len(phase["deliverables"])
    })

# Save timeline data
with open('timeline_data.json', 'w') as f:
    json.dump(timeline_data, f, indent=2)

print("Timeline data created successfully")
for item in timeline_data:
    print(f"{item['Phase']}: {item['Start']} to {item['End']} ({item['Duration']} weeks)")