/* Interactive API Explorer JavaScript */
document.addEventListener('DOMContentLoaded', function() {
    // Initialize API Explorer functionality
    initializeApiExplorer();
    
    // Add syntax highlighting for API examples
    initializeCodeHighlighting();
    
    // Setup interactive elements
    setupInteractiveElements();
});

function initializeApiExplorer() {
    const apiEndpoints = document.querySelectorAll('.api-endpoint');
    
    apiEndpoints.forEach(endpoint => {
        // Add expand/collapse functionality
        const header = endpoint.querySelector('.api-endpoint-header');
        if (header) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', function() {
                const body = endpoint.querySelector('.api-endpoint-body');
                if (body) {
                    body.classList.toggle('expanded');
                }
            });
        }
        
        // Add "Try it" buttons
        addTryItButton(endpoint);
    });
}

function addTryItButton(endpoint) {
    const tryButton = document.createElement('button');
    tryButton.className = 'md-button md-button--primary api-try-button';
    tryButton.textContent = 'Try it out';
    tryButton.onclick = function() {
        openApiTester(endpoint);
    };
    
    const header = endpoint.querySelector('.api-endpoint-header');
    if (header) {
        header.appendChild(tryButton);
    }
}

function openApiTester(endpoint) {
    // Create modal for API testing
    const modal = document.createElement('div');
    modal.className = 'api-tester-modal';
    modal.innerHTML = `
        <div class="api-tester-content">
            <div class="api-tester-header">
                <h3>API Tester</h3>
                <button class="close-button" onclick="closeApiTester()">&times;</button>
            </div>
            <div class="api-tester-body">
                <form class="api-test-form">
                    <div class="form-group">
                        <label>Authorization Token:</label>
                        <input type="password" id="auth-token" placeholder="Bearer token">
                    </div>
                    <div class="form-group">
                        <label>Request Body (JSON):</label>
                        <textarea id="request-body" rows="6" placeholder="{}"></textarea>
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="md-button md-button--primary">Send Request</button>
                        <button type="button" class="md-button" onclick="clearForm()">Clear</button>
                    </div>
                </form>
                <div class="api-response">
                    <h4>Response</h4>
                    <pre id="response-output">Click "Send Request" to test the API</pre>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Setup form submission
    const form = modal.querySelector('.api-test-form');
    form.onsubmit = function(e) {
        e.preventDefault();
        sendApiRequest(endpoint, modal);
    };
}

function sendApiRequest(endpoint, modal) {
    const token = modal.querySelector('#auth-token').value;
    const body = modal.querySelector('#request-body').value;
    const output = modal.querySelector('#response-output');
    
    // Extract endpoint info
    const method = endpoint.dataset.method || 'GET';
    const url = endpoint.dataset.url || '/api/example';
    
    output.textContent = 'Sending request...';
    
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }
    
    if (body && method !== 'GET') {
        options.body = body;
    }
    
    fetch(url, options)
        .then(response => response.json())
        .then(data => {
            output.textContent = JSON.stringify(data, null, 2);
            output.className = 'response-success';
        })
        .catch(error => {
            output.textContent = `Error: ${error.message}`;
            output.className = 'response-error';
        });
}

function closeApiTester() {
    const modals = document.querySelectorAll('.api-tester-modal');
    modals.forEach(modal => modal.remove());
}

function clearForm() {
    document.getElementById('auth-token').value = '';
    document.getElementById('request-body').value = '';
    document.getElementById('response-output').textContent = 'Click "Send Request" to test the API';
    document.getElementById('response-output').className = '';
}

function initializeCodeHighlighting() {
    // Add copy buttons to code blocks
    const codeBlocks = document.querySelectorAll('pre code');
    codeBlocks.forEach(block => {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-code-button';
        copyButton.textContent = 'Copy';
        copyButton.onclick = function() {
            copyToClipboard(block.textContent);
            copyButton.textContent = 'Copied!';
            setTimeout(() => copyButton.textContent = 'Copy', 2000);
        };
        
        block.parentElement.style.position = 'relative';
        block.parentElement.appendChild(copyButton);
    });
}

function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    }
}

function setupInteractiveElements() {
    // Setup tabs for code examples
    const tabContainers = document.querySelectorAll('.tabbed-set');
    tabContainers.forEach(container => {
        const tabs = container.querySelectorAll('.tabbed-labels label');
        const contents = container.querySelectorAll('.tabbed-content');
        
        tabs.forEach((tab, index) => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs and contents
                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                if (contents[index]) {
                    contents[index].classList.add('active');
                }
            });
        });
    });
    
    // Add search functionality for API endpoints
    const searchInput = document.getElementById('api-search');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterApiEndpoints(this.value);
        });
    }
}

function filterApiEndpoints(searchTerm) {
    const endpoints = document.querySelectorAll('.api-endpoint');
    const term = searchTerm.toLowerCase();
    
    endpoints.forEach(endpoint => {
        const title = endpoint.querySelector('h3, h4')?.textContent.toLowerCase() || '';
        const description = endpoint.querySelector('.api-description')?.textContent.toLowerCase() || '';
        
        if (title.includes(term) || description.includes(term)) {
            endpoint.style.display = 'block';
        } else {
            endpoint.style.display = 'none';
        }
    });
}