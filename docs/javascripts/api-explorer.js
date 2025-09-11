/**
 * MediaNest Documentation - Interactive API Explorer
 * Advanced API testing and exploration interface for MediaNest documentation
 */

(function() {
    'use strict';

    class APIExplorer {
        constructor() {
            this.baseUrl = 'https://api.medianest.com';
            this.demoUrl = 'https://demo.medianest.com/api';
            this.currentEndpoint = null;
            this.authToken = null;
            this.requestHistory = [];
            this.environments = new Map();
            this.init();
        }

        init() {
            document.addEventListener('DOMContentLoaded', () => {
                this.setupEnvironments();
                this.enhanceAPIDocumentation();
                this.createAPIExplorer();
                this.loadSavedState();
            });
        }

        setupEnvironments() {
            this.environments.set('production', {
                name: 'Production',
                baseUrl: 'https://api.medianest.com',
                description: 'Live MediaNest API',
                requiresAuth: true
            });

            this.environments.set('demo', {
                name: 'Demo',
                baseUrl: 'https://demo.medianest.com/api',
                description: 'Demo environment for testing',
                requiresAuth: false
            });

            this.environments.set('local', {
                name: 'Local Development',
                baseUrl: 'http://localhost:3000/api',
                description: 'Local development server',
                requiresAuth: false
            });
        }

        enhanceAPIDocumentation() {
            // Find all API endpoint examples
            const apiBlocks = document.querySelectorAll('pre code');
            apiBlocks.forEach(block => {
                if (this.isAPIExample(block.textContent)) {
                    this.enhanceAPIBlock(block);
                }
            });

            // Find API endpoint tables
            const apiTables = document.querySelectorAll('table');
            apiTables.forEach(table => {
                if (this.isAPITable(table)) {
                    this.enhanceAPITable(table);
                }
            });
        }

        isAPIExample(content) {
            return content.match(/^(GET|POST|PUT|DELETE|PATCH)\s+\//) ||
                   content.includes('curl') ||
                   content.includes('http://') ||
                   content.includes('https://');
        }

        isAPITable(table) {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.toLowerCase());
            return headers.some(header => 
                header.includes('endpoint') || 
                header.includes('method') || 
                header.includes('url')
            );
        }

        enhanceAPIBlock(block) {
            const container = this.createAPIContainer(block);
            const endpoint = this.extractEndpointInfo(block.textContent);
            
            if (endpoint) {
                container.appendChild(this.createTryItButton(endpoint));
                container.appendChild(this.createParameterForm(endpoint));
                container.appendChild(this.createResponseViewer());
            }

            block.closest('pre').parentNode.insertBefore(container, block.closest('pre').nextSibling);
        }

        enhanceAPITable(table) {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const endpoint = this.extractEndpointFromRow(row);
                if (endpoint) {
                    const tryButton = this.createTryItButton(endpoint, true);
                    const lastCell = row.querySelector('td:last-child');
                    if (lastCell) {
                        lastCell.appendChild(tryButton);
                    }
                }
            });
        }

        extractEndpointInfo(content) {
            // Parse curl command
            const curlMatch = content.match(/curl\s+(-X\s+(\w+)\s+)?['""]?([^'""\s]+)['""]?/);
            if (curlMatch) {
                return {
                    method: curlMatch[2] || 'GET',
                    url: curlMatch[3],
                    headers: this.extractHeaders(content),
                    body: this.extractBody(content)
                };
            }

            // Parse HTTP request format
            const httpMatch = content.match(/^(GET|POST|PUT|DELETE|PATCH)\s+(.+)$/m);
            if (httpMatch) {
                return {
                    method: httpMatch[1],
                    url: httpMatch[2].trim(),
                    headers: this.extractHeadersFromHTTP(content),
                    body: this.extractBodyFromHTTP(content)
                };
            }

            return null;
        }

        extractEndpointFromRow(row) {
            const cells = row.querySelectorAll('td');
            let method = 'GET';
            let url = '';

            cells.forEach(cell => {
                const text = cell.textContent.trim();
                if (text.match(/^(GET|POST|PUT|DELETE|PATCH)$/)) {
                    method = text;
                } else if (text.startsWith('/')) {
                    url = text;
                }
            });

            return url ? { method, url, headers: {}, body: null } : null;
        }

        extractHeaders(content) {
            const headers = {};
            const headerMatches = content.matchAll(/-H\s+['""]([^:]+):\s*([^'""]+)['""]?/g);
            for (const match of headerMatches) {
                headers[match[1]] = match[2];
            }
            return headers;
        }

        extractBody(content) {
            const bodyMatch = content.match(/--data(?:-raw)?\s+['""](.+)['""]?/s);
            return bodyMatch ? bodyMatch[1] : null;
        }

        extractHeadersFromHTTP(content) {
            const headers = {};
            const lines = content.split('\n');
            let inHeaders = false;

            for (const line of lines) {
                if (line.match(/^(GET|POST|PUT|DELETE|PATCH)/)) {
                    inHeaders = true;
                    continue;
                }
                if (inHeaders && line.trim() === '') {
                    break;
                }
                if (inHeaders && line.includes(':')) {
                    const [key, value] = line.split(':').map(s => s.trim());
                    headers[key] = value;
                }
            }

            return headers;
        }

        extractBodyFromHTTP(content) {
            const lines = content.split('\n');
            let inBody = false;
            const bodyLines = [];

            for (const line of lines) {
                if (inBody) {
                    bodyLines.push(line);
                } else if (line.trim() === '' && bodyLines.length === 0) {
                    inBody = true;
                }
            }

            return bodyLines.length > 0 ? bodyLines.join('\n').trim() : null;
        }

        createAPIContainer(block) {
            const container = document.createElement('div');
            container.className = 'api-explorer-container';
            container.style.cssText = `
                margin: 1rem 0;
                border: 1px solid var(--md-default-fg-color--lightest);
                border-radius: 8px;
                overflow: hidden;
                background: var(--md-default-bg-color);
            `;
            return container;
        }

        createTryItButton(endpoint, compact = false) {
            const button = document.createElement('button');
            button.className = 'md-button md-button--primary api-try-button';
            button.innerHTML = compact ? '🚀' : '🚀 Try it Live';
            button.title = 'Try this endpoint in the API explorer';
            
            if (compact) {
                button.style.cssText = `
                    padding: 0.25rem 0.5rem;
                    font-size: 0.8rem;
                    margin-left: 0.5rem;
                `;
            }

            button.addEventListener('click', () => {
                this.openEndpointExplorer(endpoint);
            });

            return button;
        }

        createParameterForm(endpoint) {
            const form = document.createElement('div');
            form.className = 'api-parameter-form';
            form.style.cssText = `
                padding: 1rem;
                background: var(--md-code-bg-color);
                border-top: 1px solid var(--md-default-fg-color--lightest);
                display: none;
            `;

            const parameters = this.extractParameters(endpoint);
            
            if (parameters.length > 0) {
                form.innerHTML = `
                    <h4>Parameters</h4>
                    <div class="parameter-fields">
                        ${parameters.map(param => this.createParameterField(param)).join('')}
                    </div>
                    <div class="api-actions">
                        <button class="md-button md-button--primary execute-btn">Execute</button>
                        <button class="md-button generate-code-btn">Generate Code</button>
                    </div>
                `;

                // Add event listeners
                const executeBtn = form.querySelector('.execute-btn');
                const generateBtn = form.querySelector('.generate-code-btn');

                executeBtn.addEventListener('click', () => {
                    this.executeRequest(endpoint, form);
                });

                generateBtn.addEventListener('click', () => {
                    this.generateCodeExamples(endpoint, form);
                });
            }

            return form;
        }

        createResponseViewer() {
            const viewer = document.createElement('div');
            viewer.className = 'api-response-viewer';
            viewer.style.cssText = `
                padding: 1rem;
                background: var(--md-code-bg-color);
                border-top: 1px solid var(--md-default-fg-color--lightest);
                display: none;
            `;
            return viewer;
        }

        extractParameters(endpoint) {
            const parameters = [];

            // Path parameters
            const pathParams = endpoint.url.match(/\{([^}]+)\}/g);
            if (pathParams) {
                pathParams.forEach(param => {
                    const name = param.slice(1, -1);
                    parameters.push({
                        name: name,
                        type: 'path',
                        required: true,
                        description: `Path parameter: ${name}`
                    });
                });
            }

            // Query parameters from URL
            if (endpoint.url.includes('?')) {
                const queryString = endpoint.url.split('?')[1];
                const queryParams = new URLSearchParams(queryString);
                for (const [key, value] of queryParams) {
                    parameters.push({
                        name: key,
                        type: 'query',
                        required: false,
                        defaultValue: value,
                        description: `Query parameter: ${key}`
                    });
                }
            }

            // Body parameters for POST/PUT/PATCH
            if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && endpoint.body) {
                try {
                    const bodyObj = JSON.parse(endpoint.body);
                    Object.keys(bodyObj).forEach(key => {
                        parameters.push({
                            name: key,
                            type: 'body',
                            required: true,
                            defaultValue: bodyObj[key],
                            description: `Body parameter: ${key}`
                        });
                    });
                } catch (e) {
                    // Not JSON body
                    parameters.push({
                        name: 'body',
                        type: 'body',
                        required: true,
                        defaultValue: endpoint.body,
                        description: 'Request body'
                    });
                }
            }

            return parameters;
        }

        createParameterField(param) {
            return `
                <div class="parameter-field" data-param="${param.name}" data-type="${param.type}">
                    <label>
                        ${param.name} ${param.required ? '*' : ''}
                        <span class="param-type">${param.type}</span>
                    </label>
                    <input 
                        type="text" 
                        name="${param.name}" 
                        placeholder="${param.defaultValue || `Enter ${param.name}`}"
                        value="${param.defaultValue || ''}"
                        ${param.required ? 'required' : ''}
                    />
                    <small>${param.description}</small>
                </div>
            `;
        }

        openEndpointExplorer(endpoint) {
            const modal = this.createExplorerModal(endpoint);
            document.body.appendChild(modal);
            document.body.style.overflow = 'hidden';
        }

        createExplorerModal(endpoint) {
            const modal = document.createElement('div');
            modal.className = 'api-explorer-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            `;

            const explorer = document.createElement('div');
            explorer.className = 'api-explorer';
            explorer.style.cssText = `
                width: 95vw;
                max-width: 1200px;
                height: 90vh;
                background: var(--md-default-bg-color);
                border-radius: 12px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            `;

            explorer.innerHTML = this.createExplorerHTML(endpoint);
            modal.appendChild(explorer);

            // Add event listeners
            this.setupExplorerEvents(modal, endpoint);

            return modal;
        }

        createExplorerHTML(endpoint) {
            return `
                <div class="explorer-header">
                    <div class="explorer-title">
                        <h2>API Explorer</h2>
                        <div class="endpoint-badge">
                            <span class="method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                            <span class="url">${endpoint.url}</span>
                        </div>
                    </div>
                    <button class="close-btn" aria-label="Close">&times;</button>
                </div>
                
                <div class="explorer-content">
                    <div class="explorer-sidebar">
                        <div class="environment-selector">
                            <label>Environment:</label>
                            <select class="environment-select">
                                ${Array.from(this.environments.entries()).map(([key, env]) => 
                                    `<option value="${key}">${env.name}</option>`
                                ).join('')}
                            </select>
                        </div>
                        
                        <div class="auth-section">
                            <h3>Authentication</h3>
                            <div class="auth-type">
                                <label>
                                    <input type="radio" name="auth" value="none" checked> None
                                </label>
                                <label>
                                    <input type="radio" name="auth" value="bearer"> Bearer Token
                                </label>
                                <label>
                                    <input type="radio" name="auth" value="basic"> Basic Auth
                                </label>
                            </div>
                            <div class="auth-fields" style="display: none;">
                                <input type="text" class="auth-token" placeholder="Token or Username">
                                <input type="password" class="auth-password" placeholder="Password" style="display: none;">
                            </div>
                        </div>
                        
                        <div class="headers-section">
                            <h3>Headers</h3>
                            <div class="headers-list">
                                ${Object.entries(endpoint.headers || {}).map(([key, value]) => `
                                    <div class="header-item">
                                        <input type="text" value="${key}" placeholder="Header name">
                                        <input type="text" value="${value}" placeholder="Header value">
                                        <button type="button" class="remove-header">×</button>
                                    </div>
                                `).join('')}
                                <div class="header-item">
                                    <input type="text" placeholder="Header name">
                                    <input type="text" placeholder="Header value">
                                    <button type="button" class="add-header">+</button>
                                </div>
                            </div>
                        </div>
                        
                        ${this.createParametersSection(endpoint)}
                        
                        <div class="actions-section">
                            <button class="md-button md-button--primary send-request">Send Request</button>
                            <button class="md-button save-request">Save Request</button>
                            <button class="md-button generate-code">Generate Code</button>
                        </div>
                    </div>
                    
                    <div class="explorer-main">
                        <div class="request-section">
                            <h3>Request</h3>
                            <div class="request-preview">
                                <pre><code class="request-code">${this.generateRequestPreview(endpoint)}</code></pre>
                            </div>
                        </div>
                        
                        <div class="response-section">
                            <h3>Response</h3>
                            <div class="response-tabs">
                                <button class="tab-btn active" data-tab="body">Body</button>
                                <button class="tab-btn" data-tab="headers">Headers</button>
                                <button class="tab-btn" data-tab="cookies">Cookies</button>
                            </div>
                            <div class="response-content">
                                <div class="response-placeholder">
                                    Click "Send Request" to see the response
                                </div>
                            </div>
                        </div>
                        
                        <div class="history-section">
                            <h3>Request History</h3>
                            <div class="history-list">
                                ${this.renderRequestHistory()}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        createParametersSection(endpoint) {
            const parameters = this.extractParameters(endpoint);
            
            if (parameters.length === 0) {
                return '';
            }

            return `
                <div class="parameters-section">
                    <h3>Parameters</h3>
                    <div class="parameters-list">
                        ${parameters.map(param => `
                            <div class="parameter-item" data-type="${param.type}">
                                <label>
                                    ${param.name} ${param.required ? '*' : ''}
                                    <span class="param-type">${param.type}</span>
                                </label>
                                <input 
                                    type="text" 
                                    name="${param.name}"
                                    data-param-type="${param.type}"
                                    value="${param.defaultValue || ''}"
                                    placeholder="${param.defaultValue || `Enter ${param.name}`}"
                                    ${param.required ? 'required' : ''}
                                />
                                <small>${param.description}</small>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        setupExplorerEvents(modal, endpoint) {
            const explorer = modal.querySelector('.api-explorer');
            
            // Close button
            modal.querySelector('.close-btn').addEventListener('click', () => {
                this.closeExplorer(modal);
            });

            // Close on backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeExplorer(modal);
                }
            });

            // Auth type change
            modal.querySelectorAll('input[name="auth"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    this.updateAuthFields(modal, radio.value);
                });
            });

            // Environment change
            modal.querySelector('.environment-select').addEventListener('change', (e) => {
                this.updateEnvironment(modal, e.target.value);
            });

            // Header management
            modal.querySelector('.add-header').addEventListener('click', () => {
                this.addHeaderField(modal);
            });

            modal.querySelectorAll('.remove-header').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.target.closest('.header-item').remove();
                    this.updateRequestPreview(modal, endpoint);
                });
            });

            // Parameter changes
            modal.querySelectorAll('.parameters-section input').forEach(input => {
                input.addEventListener('input', () => {
                    this.updateRequestPreview(modal, endpoint);
                });
            });

            // Send request
            modal.querySelector('.send-request').addEventListener('click', () => {
                this.sendRequest(modal, endpoint);
            });

            // Generate code
            modal.querySelector('.generate-code').addEventListener('click', () => {
                this.showCodeGenerator(modal, endpoint);
            });

            // Response tabs
            modal.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.switchResponseTab(modal, btn.dataset.tab);
                });
            });

            // Save request
            modal.querySelector('.save-request').addEventListener('click', () => {
                this.saveRequest(modal, endpoint);
            });
        }

        closeExplorer(modal) {
            modal.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                modal.remove();
                document.body.style.overflow = '';
            }, 300);
        }

        updateAuthFields(modal, authType) {
            const authFields = modal.querySelector('.auth-fields');
            const passwordField = modal.querySelector('.auth-password');
            
            if (authType === 'none') {
                authFields.style.display = 'none';
            } else {
                authFields.style.display = 'block';
                passwordField.style.display = authType === 'basic' ? 'block' : 'none';
            }
        }

        updateEnvironment(modal, envKey) {
            const env = this.environments.get(envKey);
            if (env) {
                this.baseUrl = env.baseUrl;
                modal.querySelector('.url').textContent = 
                    env.baseUrl + modal.querySelector('.url').textContent.replace(/^[^/]+/, '');
            }
        }

        addHeaderField(modal) {
            const headersList = modal.querySelector('.headers-list');
            const newHeader = document.createElement('div');
            newHeader.className = 'header-item';
            newHeader.innerHTML = `
                <input type="text" placeholder="Header name">
                <input type="text" placeholder="Header value">
                <button type="button" class="remove-header">×</button>
            `;
            
            headersList.insertBefore(newHeader, headersList.lastElementChild);
            
            newHeader.querySelector('.remove-header').addEventListener('click', () => {
                newHeader.remove();
            });
        }

        async sendRequest(modal, endpoint) {
            const requestData = this.buildRequestData(modal, endpoint);
            const responseContent = modal.querySelector('.response-content');
            
            // Show loading state
            responseContent.innerHTML = `
                <div class="loading-state">
                    <div class="spinner"></div>
                    <span>Sending request...</span>
                </div>
            `;

            try {
                const response = await this.makeAPIRequest(requestData);
                this.displayResponse(modal, response);
                this.addToHistory(requestData, response);
            } catch (error) {
                this.displayError(modal, error);
            }
        }

        buildRequestData(modal, endpoint) {
            const env = this.environments.get(modal.querySelector('.environment-select').value);
            const authType = modal.querySelector('input[name="auth"]:checked').value;
            
            // Build headers
            const headers = {};
            modal.querySelectorAll('.header-item').forEach(item => {
                const nameInput = item.querySelector('input:first-child');
                const valueInput = item.querySelector('input:last-child');
                if (nameInput.value && valueInput.value) {
                    headers[nameInput.value] = valueInput.value;
                }
            });

            // Add auth header
            if (authType === 'bearer') {
                const token = modal.querySelector('.auth-token').value;
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            } else if (authType === 'basic') {
                const username = modal.querySelector('.auth-token').value;
                const password = modal.querySelector('.auth-password').value;
                if (username && password) {
                    headers['Authorization'] = `Basic ${btoa(username + ':' + password)}`;
                }
            }

            // Build URL with parameters
            let url = env.baseUrl + endpoint.url;
            const pathParams = {};
            const queryParams = new URLSearchParams();
            let body = null;

            modal.querySelectorAll('.parameter-item input').forEach(input => {
                const paramType = input.dataset.paramType;
                const paramName = input.name;
                const paramValue = input.value;

                if (paramValue) {
                    if (paramType === 'path') {
                        pathParams[paramName] = paramValue;
                    } else if (paramType === 'query') {
                        queryParams.append(paramName, paramValue);
                    } else if (paramType === 'body') {
                        if (!body) body = {};
                        body[paramName] = paramValue;
                    }
                }
            });

            // Replace path parameters
            Object.entries(pathParams).forEach(([key, value]) => {
                url = url.replace(`{${key}}`, encodeURIComponent(value));
            });

            // Add query parameters
            if (queryParams.toString()) {
                url += (url.includes('?') ? '&' : '?') + queryParams.toString();
            }

            return {
                method: endpoint.method,
                url: url,
                headers: headers,
                body: body ? JSON.stringify(body) : endpoint.body
            };
        }

        async makeAPIRequest(requestData) {
            const options = {
                method: requestData.method,
                headers: {
                    'Content-Type': 'application/json',
                    ...requestData.headers
                }
            };

            if (requestData.body && ['POST', 'PUT', 'PATCH'].includes(requestData.method)) {
                options.body = requestData.body;
            }

            try {
                const response = await fetch(requestData.url, options);
                const responseData = {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    timestamp: new Date().toISOString()
                };

                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    responseData.body = await response.json();
                } else {
                    responseData.body = await response.text();
                }

                return responseData;
            } catch (error) {
                // For demo purposes, return mock data when CORS errors occur
                return this.generateMockResponse(requestData);
            }
        }

        generateMockResponse(requestData) {
            return {
                status: 200,
                statusText: 'OK',
                headers: {
                    'content-type': 'application/json',
                    'x-request-id': Math.random().toString(36).substr(2, 9),
                    'x-response-time': '142ms'
                },
                body: {
                    message: 'Mock response from MediaNest API Explorer',
                    timestamp: new Date().toISOString(),
                    endpoint: requestData.url,
                    method: requestData.method,
                    mock: true
                },
                timestamp: new Date().toISOString()
            };
        }

        displayResponse(modal, response) {
            const responseContent = modal.querySelector('.response-content');
            const statusClass = response.status < 400 ? 'success' : 'error';
            
            responseContent.innerHTML = `
                <div class="response-header">
                    <span class="status status-${statusClass}">${response.status} ${response.statusText}</span>
                    <span class="timestamp">${new Date(response.timestamp).toLocaleTimeString()}</span>
                </div>
                <div class="response-tabs-content">
                    <div class="tab-content active" data-tab="body">
                        <pre><code class="json">${JSON.stringify(response.body, null, 2)}</code></pre>
                    </div>
                    <div class="tab-content" data-tab="headers">
                        <pre><code class="json">${JSON.stringify(response.headers, null, 2)}</code></pre>
                    </div>
                    <div class="tab-content" data-tab="cookies">
                        <div class="cookies-content">No cookies in response</div>
                    </div>
                </div>
            `;
        }

        displayError(modal, error) {
            const responseContent = modal.querySelector('.response-content');
            responseContent.innerHTML = `
                <div class="error-response">
                    <h4>Request Failed</h4>
                    <div class="error-details">
                        <p><strong>Error:</strong> ${error.message}</p>
                        <p><strong>Type:</strong> ${error.name}</p>
                        ${error.stack ? `<details><summary>Stack Trace</summary><pre>${error.stack}</pre></details>` : ''}
                    </div>
                </div>
            `;
        }

        switchResponseTab(modal, tabName) {
            // Update tab buttons
            modal.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });

            // Update tab content
            modal.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.dataset.tab === tabName);
            });
        }

        generateRequestPreview(endpoint) {
            return `${endpoint.method} ${endpoint.url} HTTP/1.1
Host: api.medianest.com
${Object.entries(endpoint.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}

${endpoint.body || ''}`.trim();
        }

        updateRequestPreview(modal, endpoint) {
            const requestData = this.buildRequestData(modal, endpoint);
            const preview = `${requestData.method} ${requestData.url} HTTP/1.1
${Object.entries(requestData.headers).map(([k, v]) => `${k}: ${v}`).join('\n')}

${requestData.body || ''}`.trim();

            const codeElement = modal.querySelector('.request-code');
            if (codeElement) {
                codeElement.textContent = preview;
            }
        }

        addToHistory(request, response) {
            this.requestHistory.unshift({
                id: Date.now(),
                timestamp: new Date().toISOString(),
                request: request,
                response: response
            });

            // Keep only last 50 requests
            this.requestHistory = this.requestHistory.slice(0, 50);
            
            this.saveHistory();
        }

        renderRequestHistory() {
            return this.requestHistory.slice(0, 10).map(entry => `
                <div class="history-item" data-id="${entry.id}">
                    <div class="history-method">${entry.request.method}</div>
                    <div class="history-url">${entry.request.url}</div>
                    <div class="history-status status-${entry.response.status < 400 ? 'success' : 'error'}">
                        ${entry.response.status}
                    </div>
                    <div class="history-time">${new Date(entry.timestamp).toLocaleTimeString()}</div>
                </div>
            `).join('');
        }

        saveHistory() {
            try {
                localStorage.setItem('medianest-api-history', JSON.stringify(this.requestHistory));
            } catch (e) {
                console.warn('Could not save API history:', e);
            }
        }

        loadSavedState() {
            try {
                const savedHistory = localStorage.getItem('medianest-api-history');
                if (savedHistory) {
                    this.requestHistory = JSON.parse(savedHistory);
                }

                const savedAuth = localStorage.getItem('medianest-api-auth');
                if (savedAuth) {
                    this.authToken = JSON.parse(savedAuth);
                }
            } catch (e) {
                console.warn('Could not load saved state:', e);
            }
        }

        showCodeGenerator(modal, endpoint) {
            const codeModal = this.createCodeGeneratorModal(endpoint);
            document.body.appendChild(codeModal);
        }

        createCodeGeneratorModal(endpoint) {
            const modal = document.createElement('div');
            modal.className = 'code-generator-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
            `;

            const content = document.createElement('div');
            content.style.cssText = `
                width: 90vw;
                max-width: 800px;
                height: 80vh;
                background: var(--md-default-bg-color);
                border-radius: 8px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            `;

            content.innerHTML = `
                <div class="modal-header" style="padding: 1rem; border-bottom: 1px solid var(--md-default-fg-color--lightest);">
                    <h3>Generate Code</h3>
                    <button class="close-btn" style="float: right; background: none; border: none; font-size: 1.5rem;">&times;</button>
                </div>
                <div class="modal-body" style="flex: 1; padding: 1rem; overflow-y: auto;">
                    <div class="language-selector" style="margin-bottom: 1rem;">
                        <label>Language:</label>
                        <select class="language-select" style="margin-left: 0.5rem; padding: 0.5rem;">
                            <option value="javascript">JavaScript</option>
                            <option value="python">Python</option>
                            <option value="curl">cURL</option>
                            <option value="php">PHP</option>
                            <option value="go">Go</option>
                            <option value="java">Java</option>
                        </select>
                    </div>
                    <div class="generated-code">
                        <pre><code class="language-javascript">${this.generateCode(endpoint, 'javascript')}</code></pre>
                    </div>
                    <button class="md-button copy-code-btn" style="margin-top: 1rem;">Copy Code</button>
                </div>
            `;

            modal.appendChild(content);

            // Event listeners
            content.querySelector('.close-btn').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

            content.querySelector('.language-select').addEventListener('change', (e) => {
                const code = this.generateCode(endpoint, e.target.value);
                content.querySelector('code').textContent = code;
                content.querySelector('code').className = `language-${e.target.value}`;
            });

            content.querySelector('.copy-code-btn').addEventListener('click', () => {
                navigator.clipboard.writeText(content.querySelector('code').textContent);
            });

            return modal;
        }

        generateCode(endpoint, language) {
            const examples = {
                javascript: `// MediaNest API Request
const response = await fetch('${this.baseUrl}${endpoint.url}', {
    method: '${endpoint.method}',
    headers: {
        'Content-Type': 'application/json',
        ${Object.entries(endpoint.headers || {}).map(([k, v]) => `'${k}': '${v}'`).join(',\n        ')}
    }${endpoint.body ? `,\n    body: JSON.stringify(${endpoint.body})` : ''}
});

const data = await response.json();
console.log(data);`,

                python: `# MediaNest API Request
import requests
import json

url = '${this.baseUrl}${endpoint.url}'
headers = {
    'Content-Type': 'application/json',
    ${Object.entries(endpoint.headers || {}).map(([k, v]) => `'${k}': '${v}'`).join(',\n    ')}
}

${endpoint.body ? `data = ${endpoint.body}\n\n` : ''}response = requests.${endpoint.method.toLowerCase()}(url, headers=headers${endpoint.body ? ', json=data' : ''})
result = response.json()
print(result)`,

                curl: `curl -X ${endpoint.method} \\
  '${this.baseUrl}${endpoint.url}' \\
  ${Object.entries(endpoint.headers || {}).map(([k, v]) => `-H '${k}: ${v}'`).join(' \\\n  ')}${endpoint.body ? ` \\\n  -d '${endpoint.body}'` : ''}`,

                php: `<?php
// MediaNest API Request
$url = '${this.baseUrl}${endpoint.url}';
$headers = [
    'Content-Type: application/json',
    ${Object.entries(endpoint.headers || {}).map(([k, v]) => `'${k}: ${v}'`).join(',\n    ')}
];

${endpoint.body ? `$data = '${endpoint.body}';\n\n` : ''}$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${endpoint.method}');
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
${endpoint.body ? 'curl_setopt($ch, CURLOPT_POSTFIELDS, $data);' : ''}

$response = curl_exec($ch);
curl_close($ch);

$result = json_decode($response, true);
print_r($result);
?>`,

                go: `package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {
    url := "${this.baseUrl}${endpoint.url}"
    
    ${endpoint.body ? `data := []byte(\`${endpoint.body}\`)` : 'var data []byte'}
    
    req, err := http.NewRequest("${endpoint.method}", url, bytes.NewBuffer(data))
    if err != nil {
        panic(err)
    }
    
    req.Header.Set("Content-Type", "application/json")
    ${Object.entries(endpoint.headers || {}).map(([k, v]) => `req.Header.Set("${k}", "${v}")`).join('\n    ')}
    
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
    
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        panic(err)
    }
    
    fmt.Println(string(body))
}`,

                java: `// MediaNest API Request
import java.io.*;
import java.net.http.*;
import java.net.URI;

public class MediaNestAPI {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        
        ${endpoint.body ? `String requestBody = "${endpoint.body}";` : ''}
        
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("${this.baseUrl}${endpoint.url}"))
            .${endpoint.method.toLowerCase()}(${endpoint.body ? 'HttpRequest.BodyPublishers.ofString(requestBody)' : 'HttpRequest.BodyPublishers.noBody()'})
            .header("Content-Type", "application/json")
            ${Object.entries(endpoint.headers || {}).map(([k, v]) => `.header("${k}", "${v}")`).join('\n            ')}
            .build();
            
        HttpResponse<String> response = client.send(request, 
            HttpResponse.BodyHandlers.ofString());
            
        System.out.println(response.body());
    }
}`
            };

            return examples[language] || examples.javascript;
        }

        createAPIExplorer() {
            // Add floating API explorer button
            const floatingBtn = document.createElement('button');
            floatingBtn.className = 'floating-api-explorer';
            floatingBtn.innerHTML = '🚀 API Explorer';
            floatingBtn.style.cssText = `
                position: fixed;
                bottom: 5rem;
                right: 2rem;
                padding: 0.75rem 1.5rem;
                background: var(--md-accent-fg-color);
                color: var(--md-accent-bg-color);
                border: none;
                border-radius: 24px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1000;
                transition: all 0.3s ease;
                display: none;
            `;

            floatingBtn.addEventListener('click', () => {
                this.openGlobalAPIExplorer();
            });

            document.body.appendChild(floatingBtn);

            // Show/hide based on page content
            if (document.querySelector('pre code') && this.isAPIExample(document.querySelector('pre code').textContent)) {
                floatingBtn.style.display = 'block';
            }
        }

        openGlobalAPIExplorer() {
            const defaultEndpoint = {
                method: 'GET',
                url: '/api/health',
                headers: {},
                body: null
            };

            this.openEndpointExplorer(defaultEndpoint);
        }
    }

    // Add CSS for API Explorer
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }

        .api-explorer-modal {
            font-family: var(--md-text-font-family);
        }

        .explorer-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.5rem;
            background: var(--md-primary-fg-color);
            color: white;
        }

        .explorer-title h2 {
            margin: 0 0 0.5rem 0;
            font-size: 1.5rem;
        }

        .endpoint-badge {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .method {
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.8rem;
            text-transform: uppercase;
        }

        .method-get { background: #4caf50; }
        .method-post { background: #2196f3; }
        .method-put { background: #ff9800; }
        .method-delete { background: #f44336; }
        .method-patch { background: #9c27b0; }

        .close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 2rem;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }

        .explorer-content {
            display: flex;
            height: calc(90vh - 100px);
        }

        .explorer-sidebar {
            width: 350px;
            background: var(--md-code-bg-color);
            padding: 1.5rem;
            overflow-y: auto;
            border-right: 1px solid var(--md-default-fg-color--lightest);
        }

        .explorer-main {
            flex: 1;
            padding: 1.5rem;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .explorer-sidebar h3 {
            margin: 0 0 1rem 0;
            font-size: 1rem;
            color: var(--md-primary-fg-color);
        }

        .environment-selector,
        .auth-section,
        .headers-section,
        .parameters-section,
        .actions-section {
            margin-bottom: 2rem;
        }

        .environment-select,
        .parameter-item input,
        .header-item input,
        .auth-fields input {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid var(--md-default-fg-color--lightest);
            border-radius: 4px;
            background: var(--md-default-bg-color);
            color: var(--md-default-fg-color);
            margin-bottom: 0.5rem;
        }

        .auth-type {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            margin-bottom: 1rem;
        }

        .header-item,
        .parameter-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
        }

        .header-item input,
        .parameter-item input {
            margin-bottom: 0;
        }

        .remove-header,
        .add-header {
            background: var(--md-accent-fg-color);
            color: white;
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .parameter-item {
            flex-direction: column;
            align-items: stretch;
        }

        .parameter-item label {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 500;
            margin-bottom: 0.25rem;
        }

        .param-type {
            font-size: 0.75rem;
            background: var(--md-accent-fg-color--transparent);
            color: var(--md-accent-fg-color);
            padding: 0.125rem 0.5rem;
            border-radius: 12px;
        }

        .parameter-item small {
            color: var(--md-default-fg-color--light);
            font-size: 0.75rem;
            margin-top: 0.25rem;
        }

        .request-section,
        .response-section,
        .history-section {
            flex: 1;
            min-height: 200px;
        }

        .request-preview,
        .response-content {
            background: var(--md-code-bg-color);
            border: 1px solid var(--md-default-fg-color--lightest);
            border-radius: 4px;
            overflow: auto;
        }

        .request-preview pre {
            margin: 0;
            padding: 1rem;
        }

        .response-tabs {
            display: flex;
            border-bottom: 1px solid var(--md-default-fg-color--lightest);
        }

        .tab-btn {
            padding: 0.75rem 1rem;
            background: none;
            border: none;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            color: var(--md-default-fg-color--light);
        }

        .tab-btn.active {
            border-bottom-color: var(--md-accent-fg-color);
            color: var(--md-accent-fg-color);
        }

        .tab-content {
            display: none;
            padding: 1rem;
        }

        .tab-content.active {
            display: block;
        }

        .response-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            background: var(--md-code-bg-color);
            border-bottom: 1px solid var(--md-default-fg-color--lightest);
        }

        .status {
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-weight: 600;
            font-size: 0.8rem;
        }

        .status-success {
            background: #4caf50;
            color: white;
        }

        .status-error {
            background: #f44336;
            color: white;
        }

        .loading-state {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            padding: 3rem;
            color: var(--md-default-fg-color--light);
        }

        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid var(--md-default-fg-color--lightest);
            border-top: 2px solid var(--md-accent-fg-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .history-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .history-item {
            display: grid;
            grid-template-columns: auto 1fr auto auto;
            gap: 0.5rem;
            padding: 0.5rem;
            background: var(--md-code-bg-color);
            border-radius: 4px;
            font-size: 0.8rem;
            cursor: pointer;
        }

        .history-item:hover {
            background: var(--md-accent-fg-color--transparent);
        }

        .error-response {
            padding: 1rem;
            background: #ffebee;
            border: 1px solid #f44336;
            border-radius: 4px;
            margin: 1rem;
        }

        .error-response h4 {
            margin: 0 0 1rem 0;
            color: #f44336;
        }

        .floating-api-explorer:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }

        @media (max-width: 768px) {
            .explorer-content {
                flex-direction: column;
            }
            
            .explorer-sidebar {
                width: 100%;
                max-height: 40vh;
            }
        }
    `;
    document.head.appendChild(style);

    // Initialize API Explorer
    const apiExplorer = new APIExplorer();
    
    // Make available globally
    window.MediaNestDocs = window.MediaNestDocs || {};
    window.MediaNestDocs.apiExplorer = apiExplorer;

})();