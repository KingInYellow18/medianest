import pandas as pd
import plotly.graph_objects as go

# Data
data = [
    {"Category": "Authentication", "Endpoints": 4, "GET": 0, "POST": 4, "PUT": 0, "DELETE": 0, "Priority": "High"},
    {"Category": "User Mgmt", "Endpoints": 6, "GET": 2, "POST": 1, "PUT": 2, "DELETE": 1, "Priority": "High"},
    {"Category": "Service Monitor", "Endpoints": 3, "GET": 3, "POST": 0, "PUT": 0, "DELETE": 0, "Priority": "Medium"},
    {"Category": "Media Mgmt", "Endpoints": 7, "GET": 2, "POST": 2, "PUT": 1, "DELETE": 2, "Priority": "High"},
    {"Category": "Admin Functions", "Endpoints": 5, "GET": 3, "POST": 1, "PUT": 1, "DELETE": 0, "Priority": "Medium"}
]

df = pd.DataFrame(data)

# Brand colors for HTTP methods
colors = ['#1FB8CD', '#FFC185', '#ECEBD5', '#5D878F']

# Create stacked bar chart
fig = go.Figure()

methods = ['GET', 'POST', 'PUT', 'DELETE']

for i, method in enumerate(methods):
    fig.add_trace(go.Bar(
        name=method,
        x=df['Category'],
        y=df[method],
        marker_color=colors[i],
        cliponaxis=False,
        hovertemplate=f'<b>{method}</b><br>' +
                     'Category: %{x}<br>' +
                     'Count: %{y}<br>' +
                     'Total: %{customdata[0]}<br>' +
                     'Priority: %{customdata[1]}<br>' +
                     '<extra></extra>',
        customdata=list(zip(df['Endpoints'], df['Priority']))
    ))

fig.update_layout(
    title='API Endpoint Distribution',
    xaxis_title='Category',
    yaxis_title='Endpoints',
    barmode='stack',
    legend=dict(orientation='h', yanchor='bottom', y=1.05, xanchor='center', x=0.5)
)

fig.write_image('api_endpoints_chart.png')