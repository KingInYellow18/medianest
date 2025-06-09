import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import json

# Define the data
data = {
    "title": "Media Management Web App - System Architecture",
    "components": [
        {"name": "React Frontend", "type": "frontend", "technologies": ["React 18", "TypeScript", "Tailwind CSS", "React Query"], "port": "3000", "description": "User interface with authentication, dashboard, and admin panels"},
        {"name": "Flask API Server", "type": "backend", "technologies": ["Flask", "SQLAlchemy", "JWT", "Marshmallow"], "port": "5000", "description": "REST API handling authentication, user management, and business logic"},
        {"name": "Nginx Reverse Proxy", "type": "proxy", "technologies": ["Nginx", "SSL/TLS"], "port": "80/443", "description": "Load balancing, SSL termination, and static file serving"},
        {"name": "SQLite Database", "type": "database", "technologies": ["SQLite", "Alembic"], "port": "N/A", "description": "User data, configurations, and application state"},
        {"name": "Uptime Kuma", "type": "external", "technologies": ["Node.js", "WebSocket API"], "port": "3001", "description": "Service monitoring and health checks"},
        {"name": "Overseerr", "type": "external", "technologies": ["Node.js", "REST API"], "port": "5055", "description": "Media request management for Plex"},
        {"name": "NFS Storage", "type": "storage", "technologies": ["NFS", "File System"], "port": "2049", "description": "Shared storage for media files and downloads"}
    ],
    "connections": [
        {"from": "React Frontend", "to": "Nginx Reverse Proxy", "protocol": "HTTPS"},
        {"from": "Nginx Reverse Proxy", "to": "Flask API Server", "protocol": "HTTP"},
        {"from": "Flask API Server", "to": "SQLite Database", "protocol": "Local"},
        {"from": "Flask API Server", "to": "Uptime Kuma", "protocol": "HTTP/WebSocket"},
        {"from": "Flask API Server", "to": "Overseerr", "protocol": "HTTP"},
        {"from": "Flask API Server", "to": "NFS Storage", "protocol": "NFS"}
    ]
}

# Define colors for each component type
type_colors = {
    'frontend': '#1FB8CD',
    'proxy': '#FFC185', 
    'backend': '#ECEBD5',
    'database': '#5D878F',
    'external': '#D2BA4C',
    'storage': '#B4413C'
}

# Define layered positions for better architecture visualization
positions = {
    'React Frontend': (2, 5),
    'Nginx Reverse Proxy': (2, 4),
    'Flask API Server': (2, 3),
    'SQLite Database': (1, 2),
    'Uptime Kuma': (2.7, 2),
    'Overseerr': (3.4, 2),
    'NFS Storage': (1, 1)
}

# Create the figure
fig = go.Figure()

# Add layer background rectangles for visual grouping
layer_configs = [
    {"name": "Presentation Layer", "y": 4.5, "height": 1, "color": "rgba(31, 184, 205, 0.1)"},
    {"name": "Application Layer", "y": 2.5, "height": 1, "color": "rgba(236, 235, 213, 0.1)"},
    {"name": "Data Layer", "y": 1, "height": 1.5, "color": "rgba(93, 135, 143, 0.1)"}
]

for layer in layer_configs:
    fig.add_shape(
        type="rect",
        x0=0.5, x1=4,
        y0=layer["y"], y1=layer["y"] + layer["height"],
        fillcolor=layer["color"],
        line=dict(color="lightgray", width=1)
    )

# Add layer labels
fig.add_annotation(x=0.3, y=5, text="Presentation", showarrow=False, font=dict(size=10), textangle=90)
fig.add_annotation(x=0.3, y=3, text="Application", showarrow=False, font=dict(size=10), textangle=90)
fig.add_annotation(x=0.3, y=1.75, text="Data/Storage", showarrow=False, font=dict(size=10), textangle=90)

# Add connections with arrows and protocol labels
for conn in data['connections']:
    from_pos = positions[conn['from']]
    to_pos = positions[conn['to']]
    
    # Calculate arrow position (slightly offset from end point)
    arrow_x = to_pos[0] - 0.1 * (to_pos[0] - from_pos[0])
    arrow_y = to_pos[1] - 0.1 * (to_pos[1] - from_pos[1])
    
    # Add connection line
    fig.add_trace(go.Scatter(
        x=[from_pos[0], to_pos[0]],
        y=[from_pos[1], to_pos[1]],
        mode='lines',
        line=dict(color='gray', width=2),
        showlegend=False,
        hoverinfo='skip'
    ))
    
    # Add arrow annotation
    fig.add_annotation(
        x=to_pos[0],
        y=to_pos[1],
        ax=arrow_x,
        ay=arrow_y,
        xref='x', yref='y',
        axref='x', ayref='y',
        text='',
        arrowhead=2,
        arrowsize=1.5,
        arrowwidth=2,
        arrowcolor='gray'
    )
    
    # Add protocol label on connection
    mid_x = (from_pos[0] + to_pos[0]) / 2
    mid_y = (from_pos[1] + to_pos[1]) / 2
    
    # Abbreviate protocol if too long
    protocol_label = conn['protocol']
    if len(protocol_label) > 8:
        protocol_label = protocol_label[:8]
    
    fig.add_annotation(
        x=mid_x, y=mid_y,
        text=protocol_label,
        showarrow=False,
        font=dict(size=8, color='darkgray'),
        bgcolor='white',
        bordercolor='lightgray',
        borderwidth=1
    )

# Add components with enhanced information
component_types = list(set(comp['type'] for comp in data['components']))

for comp_type in component_types:
    components_of_type = [comp for comp in data['components'] if comp['type'] == comp_type]
    
    x_coords = []
    y_coords = []
    hover_texts = []
    display_names = []
    
    for comp in components_of_type:
        pos = positions[comp['name']]
        x_coords.append(pos[0])
        y_coords.append(pos[1])
        
        # Create detailed hover text
        tech_list = ', '.join(comp['technologies'][:3])
        if len(tech_list) > 30:
            tech_list = tech_list[:27] + '...'
        
        desc_text = comp['description']
        if len(desc_text) > 50:
            desc_text = desc_text[:47] + '...'
        
        port_text = f"Port: {comp['port']}" if comp['port'] != 'N/A' else 'No specific port'
        hover_text = f"<b>{comp['name']}</b><br>{tech_list}<br>{port_text}<br>{desc_text}"
        hover_texts.append(hover_text)
        
        # Create display name with tech and port info
        display_name = comp['name']
        if len(display_name) > 15:
            if 'Frontend' in display_name:
                display_name = 'React Frontend'
            elif 'Server' in display_name:
                display_name = 'Flask API'
            elif 'Proxy' in display_name:
                display_name = 'Nginx Proxy'
            elif 'Database' in display_name:
                display_name = 'SQLite DB'
        
        # Add main tech and port
        main_tech = comp['technologies'][0] if comp['technologies'] else ''
        if len(main_tech) > 10:
            main_tech = main_tech[:10]
        
        if comp['port'] != 'N/A':
            display_text = f"{display_name}<br>{main_tech}<br>:{comp['port']}"
        else:
            display_text = f"{display_name}<br>{main_tech}"
            
        display_names.append(display_text)
    
    fig.add_trace(go.Scatter(
        x=x_coords,
        y=y_coords,
        mode='markers+text',
        marker=dict(
            size=120,
            color=type_colors[comp_type],
            line=dict(width=3, color='white'),
            symbol='square'
        ),
        text=display_names,
        textposition='middle center',
        textfont=dict(size=8, color='black'),
        hovertext=hover_texts,
        hoverinfo='text',
        name=comp_type.title(),
        showlegend=True
    ))

# Update layout
fig.update_layout(
    title="Media Mgmt Web App Architecture",
    xaxis=dict(
        showgrid=False,
        showticklabels=False,
        zeroline=False,
        range=[0, 4.5]
    ),
    yaxis=dict(
        showgrid=False,
        showticklabels=False,
        zeroline=False,
        range=[0.5, 6]
    ),
    plot_bgcolor='white',
    legend=dict(
        orientation='h',
        yanchor='bottom',
        y=1.05,
        xanchor='center',
        x=0.5
    )
)

# Save the chart
fig.write_image("architecture_diagram.png")
fig.show()