import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime

# Create DataFrame from the provided data
data = [
    {"Phase": "Phase 1: Foundation Setup", "Start": "2025-01-01", "End": "2025-01-15", "Duration": 2, "Tasks": 6, "Deliverables": 3},
    {"Phase": "Phase 2: Core Integrations", "Start": "2025-01-15", "End": "2025-01-29", "Duration": 2, "Tasks": 5, "Deliverables": 3},
    {"Phase": "Phase 3: User Features", "Start": "2025-01-29", "End": "2025-02-12", "Duration": 2, "Tasks": 5, "Deliverables": 3},
    {"Phase": "Phase 4: Admin Features", "Start": "2025-02-12", "End": "2025-02-26", "Duration": 2, "Tasks": 5, "Deliverables": 3},
    {"Phase": "Phase 5: Testing & Deployment", "Start": "2025-02-26", "End": "2025-03-12", "Duration": 2, "Tasks": 5, "Deliverables": 3}
]

df = pd.DataFrame(data)

# Convert dates to datetime
df['Start'] = pd.to_datetime(df['Start'])
df['End'] = pd.to_datetime(df['End'])

# Create better phase names within 15 character limit
df['Phase_Display'] = [
    "Foundation",
    "Integrations", 
    "User Features",
    "Admin Features",
    "Testing Deploy"
]

# Add task/deliverable info to display text
df['Phase_Info'] = df['Phase_Display'] + " (" + df['Tasks'].astype(str) + "T/" + df['Deliverables'].astype(str) + "D)"

# Define colors from the specified palette
colors = ['#1FB8CD', '#FFC185', '#ECEBD5', '#5D878F', '#D2BA4C']

# Create Gantt chart using timeline
fig = px.timeline(
    df, 
    x_start="Start", 
    x_end="End", 
    y="Phase_Display",
    title="Media Mgmt Web App Timeline",
    color="Phase_Display",
    color_discrete_sequence=colors
)

# Update layout and axes
fig.update_layout(
    xaxis_title="Project Timeline",
    yaxis_title="Development Phase",
    showlegend=False
)

# Set x-axis range to cover full 10 weeks and improve formatting
fig.update_xaxes(
    range=["2024-12-29", "2025-03-16"],  # Slightly wider range for better visibility
    tickformat="%b %d",
    dtick=7*24*60*60*1000,  # Weekly ticks (7 days in milliseconds)
    tickangle=45
)

# Update y-axis order (reverse to match typical Gantt chart display)
fig.update_yaxes(categoryorder='array', categoryarray=df['Phase_Display'].tolist()[::-1])

# Update hover template with comprehensive information
fig.update_traces(
    hovertemplate="<b>%{y}</b><br>" +
                  "Start: %{base|%b %d, %Y}<br>" +
                  "End: %{x|%b %d, %Y}<br>" +
                  "Tasks: %{customdata[0]}<br>" +
                  "Deliverables: %{customdata[1]}<br>" +
                  "<extra></extra>",
    customdata=df[['Tasks', 'Deliverables']].values
)

# Save the chart
fig.write_image("gantt_chart.png")