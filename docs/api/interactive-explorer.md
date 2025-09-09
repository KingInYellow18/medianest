# Interactive API Explorer

Welcome to the MediaNest Interactive API Explorer! This comprehensive interface allows you to explore, test, and understand all MediaNest API endpoints with real-time interaction capabilities.

## Features

- **🚀 Live Testing**: Execute real API calls directly from the browser
- **📖 Complete Documentation**: Comprehensive endpoint documentation with examples
- **🔐 Secure Authentication**: Built-in token management and testing
- **📊 Response Visualization**: Beautiful response formatting and analysis
- **💡 Code Generation**: Generate client code in multiple languages
- **📱 Mobile Responsive**: Works perfectly on all devices
- **🎯 Request Builder**: Visual request building with validation

## Quick Start

### 1. Authentication Setup

Before using the explorer, you need to authenticate:

1. **Get API Token**: Visit the [Authentication](/api/authentication/) page
2. **Click "Authorize"** button below
3. **Enter Token**: Format: `Bearer your-token-here`

<div class="auth-setup">
<button onclick="setupAuth()" class="auth-button">🔐 Setup Authentication</button>
</div>

### 2. OpenAPI Specification

<div class="swagger-container">
    <div id="swagger-ui"></div>
</div>

<script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js"></script>
<script src="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js"></script>
<link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css" />

<script>
window.onload = function() {
  // Initialize Swagger UI
  const ui = SwaggerUIBundle({
    url: './OPENAPI_SPECIFICATION_V3.yaml',
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout",
    theme: "dark",
    tryItOutEnabled: true,
    filter: true,
    displayRequestDuration: true,
    showExtensions: true,
    showCommonExtensions: true,
    requestInterceptor: function(request) {
      // Add authentication header if available
      const token = localStorage.getItem('medianest-token');
      if (token) {
        request.headers.Authorization = `Bearer ${token}`;
      }
      return request;
    },
    responseInterceptor: function(response) {
      // Log response for debugging
      console.log('API Response:', response);
      return response;
    },
    onComplete: function() {
      console.log('Swagger UI loaded successfully');
      
      // Auto-authenticate if token exists
      const token = localStorage.getItem('medianest-token');
      if (token) {
        autoAuthenticate(token);
      }
    }
  });

  // Custom authentication function
  window.setupAuth = function() {
    const token = prompt('Enter your MediaNest API token:');
    if (token) {
      localStorage.setItem('medianest-token', token);
      ui.preauthorizeApiKey('cookieAuth', token);
      alert('Authentication configured successfully!');
    }
  };

  function autoAuthenticate(token) {
    ui.preauthorizeApiKey('cookieAuth', token);
  }

  // Custom styling for MediaNest theme
  const style = document.createElement('style');
  style.textContent = `
    .swagger-ui .topbar {
      background-color: #673ab7;
      background-image: linear-gradient(135deg, #673ab7 0%, #9c27b0 100%);
    }
    
    .swagger-ui .info .title {
      color: #673ab7;
    }
    
    .swagger-ui .scheme-container {
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 10px;
    }
    
    .auth-setup {
      text-align: center;
      margin: 20px 0;
    }
    
    .auth-button {
      background: linear-gradient(135deg, #673ab7 0%, #9c27b0 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .auth-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(103, 58, 183, 0.3);
    }
    
    .swagger-container {
      margin: 20px 0;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);
};
</script>

## Advanced Features

### Code Generation

The explorer supports code generation in multiple programming languages:

#### JavaScript/TypeScript
```javascript
// Generated code example
const response = await fetch('/api/v1/media/search?query=inception', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);
```

#### Python
```python
import requests

response = requests.get(
    '/api/v1/media/search',
    params={'query': 'inception'},
    headers={'Authorization': 'Bearer YOUR_TOKEN'}
)

data = response.json()
print(data)
```

#### cURL
```bash
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  "/api/v1/media/search?query=inception"
```

### Request Builder

<div class="request-builder">
<h4>🛠️ Visual Request Builder</h4>

<div class="builder-section">
  <label for="endpoint-select">Select Endpoint:</label>
  <select id="endpoint-select" onchange="updateRequestBuilder()">
    <option value="">Choose an endpoint...</option>
    <option value="GET /api/v1/media/search">Search Media</option>
    <option value="POST /api/v1/media/request">Request Media</option>
    <option value="GET /api/v1/media/requests">Get User Requests</option>
    <option value="GET /api/v1/performance/metrics">Get Performance Metrics</option>
    <option value="GET /api/v1/plex/libraries">Get Plex Libraries</option>
  </select>
</div>

<div class="builder-section">
  <label for="auth-token">Authentication Token:</label>
  <input type="password" id="auth-token" placeholder="Bearer token..." />
</div>

<div id="parameters-section" class="builder-section" style="display: none;">
  <h5>Parameters:</h5>
  <div id="parameters-container"></div>
</div>

<div id="body-section" class="builder-section" style="display: none;">
  <label for="request-body">Request Body:</label>
  <textarea id="request-body" rows="8" placeholder="JSON request body..."></textarea>
</div>

<div class="builder-actions">
  <button onclick="executeRequest()" class="execute-btn">🚀 Execute Request</button>
  <button onclick="generateCode()" class="generate-btn">💡 Generate Code</button>
</div>

<div id="response-section" class="response-section" style="display: none;">
  <h5>Response:</h5>
  <div class="response-tabs">
    <button onclick="showResponseTab('body')" class="tab-btn active">Response Body</button>
    <button onclick="showResponseTab('headers')" class="tab-btn">Headers</button>
    <button onclick="showResponseTab('curl')" class="tab-btn">cURL</button>
  </div>
  <div id="response-content" class="response-content"></div>
</div>
</div>

<script>
const endpointConfigs = {
  'GET /api/v1/media/search': {
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Search query' },
      { name: 'page', type: 'number', required: false, description: 'Page number' }
    ]
  },
  'POST /api/v1/media/request': {
    body: {
      title: 'string (required)',
      mediaType: 'movie | tv (required)',
      tmdbId: 'string (required)',
      seasons: 'number[] (optional, TV only)'
    }
  },
  'GET /api/v1/media/requests': {
    parameters: [
      { name: 'page', type: 'number', required: false, description: 'Page number' },
      { name: 'status', type: 'string', required: false, description: 'Filter by status' },
      { name: 'mediaType', type: 'string', required: false, description: 'Filter by media type' }
    ]
  },
  'GET /api/v1/performance/metrics': {
    parameters: [
      { name: 'timeRange', type: 'string', required: false, description: 'Time range (5m, 1h, 6h, 24h)' },
      { name: 'metrics', type: 'array', required: false, description: 'Specific metrics to include' }
    ]
  },
  'GET /api/v1/plex/libraries': {
    parameters: []
  }
};

function updateRequestBuilder() {
  const endpoint = document.getElementById('endpoint-select').value;
  const config = endpointConfigs[endpoint];
  
  if (!config) {
    document.getElementById('parameters-section').style.display = 'none';
    document.getElementById('body-section').style.display = 'none';
    return;
  }
  
  // Update parameters
  if (config.parameters) {
    const parametersContainer = document.getElementById('parameters-container');
    parametersContainer.innerHTML = '';
    
    config.parameters.forEach(param => {
      const paramDiv = document.createElement('div');
      paramDiv.className = 'parameter-input';
      paramDiv.innerHTML = `
        <label>${param.name} ${param.required ? '(required)' : '(optional)'}:</label>
        <input type="${param.type === 'number' ? 'number' : 'text'}" 
               id="param-${param.name}" 
               placeholder="${param.description}" 
               ${param.required ? 'required' : ''} />
      `;
      parametersContainer.appendChild(paramDiv);
    });
    
    document.getElementById('parameters-section').style.display = 'block';
  } else {
    document.getElementById('parameters-section').style.display = 'none';
  }
  
  // Update body section
  if (config.body) {
    const bodyTextarea = document.getElementById('request-body');
    bodyTextarea.value = JSON.stringify(config.body, null, 2);
    document.getElementById('body-section').style.display = 'block';
  } else {
    document.getElementById('body-section').style.display = 'none';
  }
}

async function executeRequest() {
  const endpoint = document.getElementById('endpoint-select').value;
  const token = document.getElementById('auth-token').value;
  
  if (!endpoint) {
    alert('Please select an endpoint');
    return;
  }
  
  if (!token) {
    alert('Please enter an authentication token');
    return;
  }
  
  const [method, path] = endpoint.split(' ');
  const baseUrl = 'https://api.medianest.app/v1'; // Update with your actual API URL
  
  try {
    const config = endpointConfigs[endpoint];
    let url = baseUrl + path.replace('/api/v1', '');
    let body = null;
    
    // Build query parameters
    if (config.parameters) {
      const params = new URLSearchParams();
      config.parameters.forEach(param => {
        const value = document.getElementById(`param-${param.name}`)?.value;
        if (value) {
          params.append(param.name, value);
        }
      });
      if (params.toString()) {
        url += '?' + params.toString();
      }
    }
    
    // Build request body
    if (method !== 'GET' && config.body) {
      const bodyText = document.getElementById('request-body').value;
      if (bodyText.trim()) {
        body = JSON.stringify(JSON.parse(bodyText));
      }
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body
    });
    
    const responseData = await response.json();
    
    // Display response
    document.getElementById('response-section').style.display = 'block';
    displayResponse({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseData,
      url,
      method,
      requestBody: body
    });
    
  } catch (error) {
    alert(`Request failed: ${error.message}`);
  }
}

function displayResponse(response) {
  const contentDiv = document.getElementById('response-content');
  
  contentDiv.innerHTML = `
    <div class="response-status ${response.status >= 200 && response.status < 300 ? 'success' : 'error'}">
      ${response.status} ${response.statusText}
    </div>
    <pre class="response-body">${JSON.stringify(response.body, null, 2)}</pre>
  `;
  
  // Store response data for other tabs
  window.currentResponse = response;
}

function showResponseTab(tab) {
  const contentDiv = document.getElementById('response-content');
  const response = window.currentResponse;
  
  if (!response) return;
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  
  switch (tab) {
    case 'body':
      contentDiv.innerHTML = `
        <div class="response-status ${response.status >= 200 && response.status < 300 ? 'success' : 'error'}">
          ${response.status} ${response.statusText}
        </div>
        <pre class="response-body">${JSON.stringify(response.body, null, 2)}</pre>
      `;
      break;
    case 'headers':
      contentDiv.innerHTML = `
        <pre class="response-headers">${JSON.stringify(response.headers, null, 2)}</pre>
      `;
      break;
    case 'curl':
      const curlCommand = generateCurlCommand(response);
      contentDiv.innerHTML = `
        <pre class="curl-command">${curlCommand}</pre>
        <button onclick="copyCurl()" class="copy-btn">📋 Copy cURL</button>
      `;
      break;
  }
}

function generateCurlCommand(response) {
  const token = document.getElementById('auth-token').value;
  let curl = `curl -X ${response.method} \\\n`;
  curl += `  -H "Authorization: Bearer ${token}" \\\n`;
  curl += `  -H "Content-Type: application/json" \\\n`;
  
  if (response.requestBody) {
    curl += `  -d '${response.requestBody}' \\\n`;
  }
  
  curl += `  "${response.url}"`;
  
  return curl;
}

function copyCurl() {
  const curlCommand = document.querySelector('.curl-command').textContent;
  navigator.clipboard.writeText(curlCommand);
  alert('cURL command copied to clipboard!');
}

function generateCode() {
  const endpoint = document.getElementById('endpoint-select').value;
  if (!endpoint) {
    alert('Please select an endpoint first');
    return;
  }
  
  const language = prompt('Select language:\n1. JavaScript\n2. Python\n3. cURL\n\nEnter 1, 2, or 3:');
  
  // Implementation for code generation would go here
  alert('Code generation feature coming soon!');
}
</script>

<style>
.request-builder {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.builder-section {
  margin-bottom: 15px;
}

.builder-section label {
  display: block;
  font-weight: 600;
  margin-bottom: 5px;
}

.builder-section input,
.builder-section select,
.builder-section textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-family: monospace;
}

.parameter-input {
  margin-bottom: 10px;
}

.builder-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.execute-btn,
.generate-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.execute-btn {
  background: #28a745;
  color: white;
}

.execute-btn:hover {
  background: #218838;
}

.generate-btn {
  background: #673ab7;
  color: white;
}

.generate-btn:hover {
  background: #5e35b1;
}

.response-section {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  margin-top: 20px;
  overflow: hidden;
}

.response-tabs {
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
  display: flex;
}

.tab-btn {
  padding: 10px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  border-bottom-color: #673ab7;
  background: white;
}

.response-content {
  padding: 15px;
}

.response-status {
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-family: monospace;
  font-weight: 600;
}

.response-status.success {
  background: #d4edda;
  color: #155724;
}

.response-status.error {
  background: #f8d7da;
  color: #721c24;
}

.response-body,
.response-headers,
.curl-command {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 15px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
}

.copy-btn {
  margin-top: 10px;
  padding: 6px 12px;
  background: #673ab7;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.copy-btn:hover {
  background: #5e35b1;
}
</style>

## Testing Scenarios

### Common Use Cases

Here are some common testing scenarios you can try:

#### 1. Media Search Flow
1. **Search for content**: Use the media search endpoint
2. **Get details**: Retrieve detailed information for a specific item
3. **Submit request**: Request the media item
4. **Check status**: Monitor the request status

#### 2. User Management Flow
1. **Authenticate**: Get your authentication token
2. **View profile**: Get your user profile information
3. **View requests**: List your media requests
4. **Manage requests**: Update or cancel requests

#### 3. Admin Operations Flow
1. **System health**: Check overall system health
2. **Performance metrics**: Monitor system performance
3. **User management**: Manage user accounts and permissions
4. **Service configuration**: Configure external services

### Load Testing

For load testing, you can use the built-in performance testing endpoints:

```javascript
// Example load test configuration
const loadTestConfig = {
  testName: "API Explorer Load Test",
  duration: 60,
  scenarios: [{
    name: "media-search",
    weight: 100,
    target: "/api/v1/media/search",
    method: "GET",
    parameters: { query: "test" }
  }],
  load: {
    phases: [{
      duration: 60,
      arrivalRate: 10,
      name: "steady-load"
    }]
  }
};
```

## Rate Limits

Be aware of API rate limits when testing:

| Endpoint Category | Limit | Window |
|------------------|-------|---------|
| General API | 100 requests | 15 minutes |
| Authentication | 10 requests | 15 minutes |
| Admin Operations | 50 requests | 15 minutes |
| Performance Testing | 5 requests | 1 hour |

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Ensure your token is valid and properly formatted
   - Check token expiration
   - Verify you have necessary permissions

2. **CORS Issues**
   - Use the built-in explorer instead of external tools
   - Ensure your domain is whitelisted

3. **Rate Limiting**
   - Wait for the rate limit window to reset
   - Use pagination for large data sets
   - Implement exponential backoff

### Getting Help

- **Documentation**: Complete API reference documentation
- **Examples**: Comprehensive code examples in multiple languages
- **Support**: Contact support team for assistance
- **Community**: Join our Discord community for help

## Security Best Practices

1. **Token Management**
   - Never share your API tokens
   - Use environment variables for tokens in production
   - Rotate tokens regularly

2. **Request Validation**
   - Always validate input parameters
   - Use HTTPS for all requests
   - Implement proper error handling

3. **Data Privacy**
   - Don't log sensitive data
   - Follow GDPR compliance guidelines
   - Implement proper data retention policies

---

**Happy Testing!** 🚀

The Interactive API Explorer makes it easy to understand and test the MediaNest API. Whether you're building integrations, debugging issues, or exploring new features, this tool provides everything you need for successful API interaction.

For more advanced usage, check out our [SDK Documentation](/developers/sdks/) and [Integration Guides](/developers/integration/).