/**
 * MediaNest Documentation - Enhanced Interactive Features
 * Advanced MkDocs Material theme enhancements and interactive components
 */

(function() {
    'use strict';

    // Configuration object
    const MediaNestDocs = {
        config: {
            apiBaseUrl: 'https://api.medianest.com',
            demoUrl: 'https://demo.medianest.com',
            githubRepo: 'kinginyellow/medianest'
        },
        
        // Feature toggles
        features: {
            apiExplorer: true,
            interactiveDiagrams: true,
            advancedSearch: true,
            performanceTracking: true,
            accessibilityEnhancements: true
        }
    };

    // Enhanced Material Design Components
    class MaterialEnhancer {
        constructor() {
            this.init();
        }

        init() {
            document.addEventListener('DOMContentLoaded', () => {
                this.enhanceCards();
                this.enhanceButtons();
                this.enhanceTabs();
                this.enhanceChips();
                this.enhanceTooltips();
                this.enhanceDialogs();
            });
        }

        enhanceCards() {
            // Add ripple effect to cards
            const cards = document.querySelectorAll('.feature-card, .doc-section, .community-card');
            cards.forEach(card => {
                this.addRippleEffect(card);
                this.addHoverElevation(card);
            });
        }

        enhanceButtons() {
            // Enhanced button interactions
            const buttons = document.querySelectorAll('.md-button');
            buttons.forEach(button => {
                this.addRippleEffect(button);
                this.addButtonFeedback(button);
            });
        }

        enhanceTabs() {
            // Enhanced tab functionality with smooth transitions
            const tabGroups = document.querySelectorAll('.tabbed-set');
            tabGroups.forEach(group => {
                this.addTabAnimations(group);
                this.addTabMemory(group);
            });
        }

        enhanceChips() {
            // Create and enhance tag chips
            const tags = document.querySelectorAll('[data-tag]');
            tags.forEach(tag => {
                this.createChip(tag);
            });
        }

        enhanceTooltips() {
            // Enhanced tooltips with rich content
            const tooltipElements = document.querySelectorAll('[data-tooltip]');
            tooltipElements.forEach(element => {
                this.createTooltip(element);
            });
        }

        enhanceDialogs() {
            // Modal dialogs for enhanced content display
            this.createImageModal();
            this.createCodeModal();
        }

        addRippleEffect(element) {
            element.addEventListener('click', (e) => {
                const ripple = document.createElement('span');
                const rect = element.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;
                
                ripple.style.cssText = `
                    position: absolute;
                    width: ${size}px;
                    height: ${size}px;
                    left: ${x}px;
                    top: ${y}px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 50%;
                    transform: scale(0);
                    animation: ripple 0.6s linear;
                    pointer-events: none;
                `;
                
                element.style.position = 'relative';
                element.style.overflow = 'hidden';
                element.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            });
        }

        addHoverElevation(element) {
            const originalBoxShadow = getComputedStyle(element).boxShadow;
            
            element.addEventListener('mouseenter', () => {
                element.style.transform = 'translateY(-2px)';
                element.style.boxShadow = '0 8px 24px rgba(103, 58, 183, 0.15)';
                element.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'translateY(0)';
                element.style.boxShadow = originalBoxShadow;
            });
        }

        addButtonFeedback(button) {
            button.addEventListener('click', () => {
                button.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    button.style.transform = 'scale(1)';
                }, 150);
            });
        }

        addTabAnimations(group) {
            const tabs = group.querySelectorAll('.tabbed-labels label');
            const contents = group.querySelectorAll('.tabbed-content > .tabbed-block');
            
            tabs.forEach((tab, index) => {
                tab.addEventListener('click', () => {
                    contents.forEach((content, contentIndex) => {
                        if (contentIndex === index) {
                            content.style.animation = 'slideIn 0.3s ease-out forwards';
                        }
                    });
                });
            });
        }

        addTabMemory(group) {
            const groupId = group.id || 'tab-group-' + Math.random().toString(36).substr(2, 9);
            const savedTab = localStorage.getItem(`medianest-tab-${groupId}`);
            
            if (savedTab) {
                const targetTab = group.querySelector(`input[value="${savedTab}"]`);
                if (targetTab) {
                    targetTab.checked = true;
                }
            }
            
            const tabs = group.querySelectorAll('input[type="radio"]');
            tabs.forEach(tab => {
                tab.addEventListener('change', () => {
                    if (tab.checked) {
                        localStorage.setItem(`medianest-tab-${groupId}`, tab.value);
                    }
                });
            });
        }

        createChip(element) {
            const chip = document.createElement('span');
            chip.className = 'md-chip';
            chip.textContent = element.getAttribute('data-tag');
            chip.style.cssText = `
                display: inline-block;
                padding: 4px 12px;
                margin: 2px;
                background: var(--md-accent-fg-color--transparent);
                color: var(--md-accent-fg-color);
                border-radius: 16px;
                font-size: 0.75rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            chip.addEventListener('click', () => {
                this.searchByTag(element.getAttribute('data-tag'));
            });
            
            element.appendChild(chip);
        }

        createTooltip(element) {
            const tooltip = document.createElement('div');
            tooltip.className = 'md-tooltip';
            tooltip.textContent = element.getAttribute('data-tooltip');
            tooltip.style.cssText = `
                position: absolute;
                background: var(--md-default-fg-color);
                color: var(--md-default-bg-color);
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 0.75rem;
                white-space: nowrap;
                z-index: 1000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
                transform: translateY(-100%) translateX(-50%);
            `;
            
            element.style.position = 'relative';
            element.appendChild(tooltip);
            
            element.addEventListener('mouseenter', () => {
                tooltip.style.opacity = '1';
            });
            
            element.addEventListener('mouseleave', () => {
                tooltip.style.opacity = '0';
            });
        }

        createImageModal() {
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                img.addEventListener('click', () => {
                    this.openImageModal(img.src, img.alt);
                });
                img.style.cursor = 'pointer';
            });
        }

        createCodeModal() {
            const codeBlocks = document.querySelectorAll('pre code');
            codeBlocks.forEach(block => {
                const expandButton = document.createElement('button');
                expandButton.innerHTML = '⛶';
                expandButton.style.cssText = `
                    position: absolute;
                    top: 0.5rem;
                    right: 3rem;
                    background: none;
                    border: none;
                    color: var(--md-default-fg-color--light);
                    cursor: pointer;
                    font-size: 1rem;
                `;
                
                const pre = block.closest('pre');
                if (pre && pre.scrollHeight > 300) {
                    pre.style.position = 'relative';
                    pre.appendChild(expandButton);
                    
                    expandButton.addEventListener('click', () => {
                        this.openCodeModal(block.textContent, block.className);
                    });
                }
            });
        }

        openImageModal(src, alt) {
            const modal = this.createModal();
            const img = document.createElement('img');
            img.src = src;
            img.alt = alt;
            img.style.cssText = `
                max-width: 90vw;
                max-height: 90vh;
                object-fit: contain;
            `;
            
            modal.content.appendChild(img);
            document.body.appendChild(modal.container);
        }

        openCodeModal(code, language) {
            const modal = this.createModal();
            const pre = document.createElement('pre');
            const codeEl = document.createElement('code');
            
            codeEl.textContent = code;
            codeEl.className = language;
            pre.appendChild(codeEl);
            pre.style.cssText = `
                max-width: 90vw;
                max-height: 90vh;
                overflow: auto;
                margin: 0;
            `;
            
            modal.content.appendChild(pre);
            document.body.appendChild(modal.container);
        }

        createModal() {
            const container = document.createElement('div');
            container.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                opacity: 0;
                animation: fadeIn 0.3s ease forwards;
            `;
            
            const content = document.createElement('div');
            content.style.cssText = `
                background: var(--md-default-bg-color);
                border-radius: 8px;
                padding: 1rem;
                position: relative;
                max-width: 95vw;
                max-height: 95vh;
                overflow: auto;
            `;
            
            const closeButton = document.createElement('button');
            closeButton.innerHTML = '✕';
            closeButton.style.cssText = `
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: var(--md-default-fg-color);
            `;
            
            closeButton.addEventListener('click', () => {
                container.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => container.remove(), 300);
            });
            
            container.addEventListener('click', (e) => {
                if (e.target === container) {
                    closeButton.click();
                }
            });
            
            content.appendChild(closeButton);
            container.appendChild(content);
            
            return { container, content };
        }

        searchByTag(tag) {
            const searchInput = document.querySelector('.md-search__input');
            if (searchInput) {
                searchInput.value = `tag:${tag}`;
                searchInput.dispatchEvent(new Event('input'));
                searchInput.focus();
            }
        }
    }

    // Advanced API Explorer
    class APIExplorer {
        constructor() {
            if (MediaNestDocs.features.apiExplorer) {
                this.init();
            }
        }

        init() {
            document.addEventListener('DOMContentLoaded', () => {
                this.createAPIExplorer();
                this.enhanceEndpointExamples();
            });
        }

        createAPIExplorer() {
            const apiSections = document.querySelectorAll('[data-api-endpoint]');
            apiSections.forEach(section => {
                this.addTryItButton(section);
            });
        }

        enhanceEndpointExamples() {
            const httpBlocks = document.querySelectorAll('.language-http, .language-bash');
            httpBlocks.forEach(block => {
                const content = block.textContent;
                if (this.isAPIExample(content)) {
                    this.addInteractiveFeatures(block);
                }
            });
        }

        isAPIExample(content) {
            return content.includes('curl') || 
                   content.includes('GET ') || 
                   content.includes('POST ') ||
                   content.includes('PUT ') ||
                   content.includes('DELETE ');
        }

        addTryItButton(section) {
            const button = document.createElement('button');
            button.className = 'md-button md-button--primary api-try-button';
            button.innerHTML = '🚀 Try it Live';
            
            button.addEventListener('click', () => {
                this.openAPIExplorer(section.getAttribute('data-api-endpoint'));
            });
            
            section.appendChild(button);
        }

        addInteractiveFeatures(block) {
            const container = document.createElement('div');
            container.className = 'api-interactive-container';
            
            // Add form for parameters
            const form = this.createParameterForm(block.textContent);
            container.appendChild(form);
            
            // Add execute button
            const executeBtn = document.createElement('button');
            executeBtn.className = 'md-button md-button--primary';
            executeBtn.textContent = 'Execute Request';
            executeBtn.addEventListener('click', () => {
                this.executeRequest(form, block);
            });
            container.appendChild(executeBtn);
            
            // Add response area
            const responseArea = document.createElement('div');
            responseArea.className = 'api-response-area';
            responseArea.style.cssText = `
                margin-top: 1rem;
                padding: 1rem;
                background: var(--md-code-bg-color);
                border-radius: 4px;
                display: none;
            `;
            container.appendChild(responseArea);
            
            block.closest('pre').parentNode.insertBefore(container, block.closest('pre').nextSibling);
        }

        createParameterForm(apiCall) {
            const form = document.createElement('form');
            form.className = 'api-parameter-form';
            form.style.cssText = `
                display: grid;
                gap: 1rem;
                margin: 1rem 0;
                padding: 1rem;
                border: 1px solid var(--md-default-fg-color--lightest);
                border-radius: 4px;
            `;
            
            // Extract parameters from API call
            const params = this.extractParameters(apiCall);
            
            params.forEach(param => {
                const field = this.createParameterField(param);
                form.appendChild(field);
            });
            
            return form;
        }

        extractParameters(apiCall) {
            const params = [];
            
            // Extract URL parameters
            const urlParamPattern = /\{(\w+)\}/g;
            let match;
            while ((match = urlParamPattern.exec(apiCall)) !== null) {
                params.push({
                    name: match[1],
                    type: 'path',
                    required: true
                });
            }
            
            // Extract query parameters
            if (apiCall.includes('?')) {
                const queryPattern = /(\w+)=([^&\s]+)/g;
                while ((match = queryPattern.exec(apiCall)) !== null) {
                    params.push({
                        name: match[1],
                        type: 'query',
                        required: false,
                        defaultValue: match[2]
                    });
                }
            }
            
            return params;
        }

        createParameterField(param) {
            const field = document.createElement('div');
            field.className = 'api-parameter-field';
            
            const label = document.createElement('label');
            label.textContent = `${param.name} ${param.required ? '*' : ''}`;
            label.style.cssText = `
                display: block;
                font-weight: 500;
                margin-bottom: 0.25rem;
                color: var(--md-default-fg-color);
            `;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.name = param.name;
            input.placeholder = param.defaultValue || `Enter ${param.name}`;
            input.required = param.required;
            input.style.cssText = `
                width: 100%;
                padding: 0.5rem;
                border: 1px solid var(--md-default-fg-color--lightest);
                border-radius: 4px;
                background: var(--md-default-bg-color);
                color: var(--md-default-fg-color);
            `;
            
            if (param.defaultValue) {
                input.value = param.defaultValue;
            }
            
            field.appendChild(label);
            field.appendChild(input);
            
            return field;
        }

        async executeRequest(form, codeBlock) {
            const formData = new FormData(form);
            const responseArea = form.parentNode.querySelector('.api-response-area');
            
            // Show loading state
            responseArea.style.display = 'block';
            responseArea.innerHTML = '<div class="loading">Executing request...</div>';
            
            try {
                // This would integrate with actual API in production
                const mockResponse = await this.mockAPICall(formData, codeBlock.textContent);
                this.displayResponse(responseArea, mockResponse);
            } catch (error) {
                this.displayError(responseArea, error);
            }
        }

        async mockAPICall(formData, originalCall) {
            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Return mock response based on endpoint
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': Math.random().toString(36).substr(2, 9)
                },
                data: {
                    message: 'API call executed successfully',
                    timestamp: new Date().toISOString(),
                    parameters: Object.fromEntries(formData)
                }
            };
        }

        displayResponse(container, response) {
            container.innerHTML = `
                <h4>Response</h4>
                <div class="response-status">Status: ${response.status}</div>
                <div class="response-headers">
                    <h5>Headers</h5>
                    <pre><code>${JSON.stringify(response.headers, null, 2)}</code></pre>
                </div>
                <div class="response-body">
                    <h5>Body</h5>
                    <pre><code>${JSON.stringify(response.data, null, 2)}</code></pre>
                </div>
            `;
        }

        displayError(container, error) {
            container.innerHTML = `
                <h4>Error</h4>
                <div class="error-message" style="color: var(--md-typeset-color-error);">
                    ${error.message || 'An error occurred while executing the request'}
                </div>
            `;
        }

        openAPIExplorer(endpoint) {
            // Open API explorer in new tab or modal
            window.open(`${MediaNestDocs.config.apiBaseUrl}/explorer?endpoint=${endpoint}`, '_blank');
        }
    }

    // Interactive Diagram Enhancer
    class DiagramEnhancer {
        constructor() {
            if (MediaNestDocs.features.interactiveDiagrams) {
                this.init();
            }
        }

        init() {
            document.addEventListener('DOMContentLoaded', () => {
                this.enhanceMermaidDiagrams();
                this.addDiagramControls();
            });
        }

        enhanceMermaidDiagrams() {
            const diagrams = document.querySelectorAll('.mermaid');
            diagrams.forEach(diagram => {
                this.addInteractivity(diagram);
                this.addZoomControls(diagram);
                this.addExportOptions(diagram);
            });
        }

        addInteractivity(diagram) {
            // Add click handlers for diagram nodes
            diagram.addEventListener('click', (e) => {
                const node = e.target.closest('[id]');
                if (node) {
                    this.handleNodeClick(node, diagram);
                }
            });
            
            // Add hover effects
            const style = document.createElement('style');
            style.textContent = `
                .mermaid .node:hover {
                    filter: brightness(1.1);
                    cursor: pointer;
                    transform: scale(1.05);
                    transition: all 0.2s ease;
                }
            `;
            document.head.appendChild(style);
        }

        addZoomControls(diagram) {
            const controls = document.createElement('div');
            controls.className = 'diagram-controls';
            controls.style.cssText = `
                position: absolute;
                top: 1rem;
                right: 1rem;
                display: flex;
                gap: 0.5rem;
                opacity: 0;
                transition: opacity 0.2s ease;
            `;
            
            const zoomIn = this.createControlButton('🔍+', () => this.zoomDiagram(diagram, 1.2));
            const zoomOut = this.createControlButton('🔍-', () => this.zoomDiagram(diagram, 0.8));
            const reset = this.createControlButton('⌂', () => this.resetDiagram(diagram));
            
            controls.appendChild(zoomIn);
            controls.appendChild(zoomOut);
            controls.appendChild(reset);
            
            const container = diagram.parentNode;
            container.style.position = 'relative';
            container.appendChild(controls);
            
            container.addEventListener('mouseenter', () => {
                controls.style.opacity = '1';
            });
            
            container.addEventListener('mouseleave', () => {
                controls.style.opacity = '0';
            });
        }

        addExportOptions(diagram) {
            const exportBtn = this.createControlButton('💾', () => {
                this.exportDiagram(diagram);
            });
            
            const controls = diagram.parentNode.querySelector('.diagram-controls');
            if (controls) {
                controls.appendChild(exportBtn);
            }
        }

        createControlButton(text, onclick) {
            const button = document.createElement('button');
            button.textContent = text;
            button.style.cssText = `
                background: var(--md-default-bg-color);
                border: 1px solid var(--md-default-fg-color--lightest);
                border-radius: 4px;
                padding: 0.25rem 0.5rem;
                cursor: pointer;
                font-size: 0.8rem;
            `;
            button.addEventListener('click', onclick);
            return button;
        }

        zoomDiagram(diagram, factor) {
            const currentScale = parseFloat(diagram.style.transform.match(/scale\(([\d.]+)\)/)?.[1] || 1);
            const newScale = currentScale * factor;
            diagram.style.transform = `scale(${newScale})`;
            diagram.style.transformOrigin = 'center';
        }

        resetDiagram(diagram) {
            diagram.style.transform = 'scale(1)';
        }

        handleNodeClick(node, diagram) {
            // Extract node information and show details
            const nodeId = node.id;
            const nodeText = node.textContent;
            
            this.showNodeDetails(nodeId, nodeText, diagram);
        }

        showNodeDetails(id, text, diagram) {
            const tooltip = document.createElement('div');
            tooltip.className = 'node-tooltip';
            tooltip.innerHTML = `
                <h4>${text}</h4>
                <p>Node ID: ${id}</p>
                <button onclick="this.parentNode.remove()">Close</button>
            `;
            tooltip.style.cssText = `
                position: absolute;
                background: var(--md-default-bg-color);
                border: 1px solid var(--md-default-fg-color--lightest);
                border-radius: 4px;
                padding: 1rem;
                z-index: 1000;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            
            diagram.parentNode.appendChild(tooltip);
            
            // Position tooltip near the clicked node
            const rect = diagram.getBoundingClientRect();
            tooltip.style.left = rect.left + 'px';
            tooltip.style.top = rect.bottom + 10 + 'px';
        }

        exportDiagram(diagram) {
            // Convert diagram to SVG and download
            const svg = diagram.querySelector('svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = 'medianest-diagram.svg';
                link.click();
                
                URL.revokeObjectURL(url);
            }
        }
    }

    // Performance and Analytics Tracker
    class PerformanceTracker {
        constructor() {
            if (MediaNestDocs.features.performanceTracking) {
                this.init();
            }
        }

        init() {
            this.trackPageMetrics();
            this.trackUserInteractions();
            this.trackScrollDepth();
            this.trackSearchUsage();
        }

        trackPageMetrics() {
            if ('performance' in window) {
                window.addEventListener('load', () => {
                    setTimeout(() => {
                        const perfData = performance.getEntriesByType('navigation')[0];
                        const metrics = {
                            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
                            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || null,
                            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null,
                            pageSize: new Blob([document.documentElement.outerHTML]).size
                        };
                        
                        this.sendMetrics('page_load', metrics);
                    }, 100);
                });
            }
        }

        trackUserInteractions() {
            // Track clicks on important elements
            document.addEventListener('click', (e) => {
                const element = e.target.closest('a, button, .feature-card, .md-nav__link');
                if (element) {
                    this.sendMetrics('interaction', {
                        type: 'click',
                        element: element.tagName.toLowerCase(),
                        text: element.textContent.trim().substring(0, 50),
                        href: element.href || null
                    });
                }
            });
        }

        trackScrollDepth() {
            let maxScroll = 0;
            const checkpoints = [25, 50, 75, 90, 100];
            const triggered = new Set();
            
            window.addEventListener('scroll', () => {
                const scrollPercent = Math.round(
                    (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
                );
                
                if (scrollPercent > maxScroll) {
                    maxScroll = scrollPercent;
                    
                    checkpoints.forEach(checkpoint => {
                        if (scrollPercent >= checkpoint && !triggered.has(checkpoint)) {
                            triggered.add(checkpoint);
                            this.sendMetrics('scroll_depth', {
                                checkpoint: checkpoint,
                                page: window.location.pathname
                            });
                        }
                    });
                }
            });
        }

        trackSearchUsage() {
            const searchInput = document.querySelector('.md-search__input');
            if (searchInput) {
                let searchStartTime = null;
                
                searchInput.addEventListener('focus', () => {
                    searchStartTime = Date.now();
                });
                
                searchInput.addEventListener('input', (e) => {
                    if (e.target.value.length >= 3) {
                        this.sendMetrics('search_query', {
                            query: e.target.value,
                            length: e.target.value.length
                        });
                    }
                });
                
                // Track search result clicks
                document.addEventListener('click', (e) => {
                    if (e.target.closest('.md-search-result__link')) {
                        const timeToClick = searchStartTime ? Date.now() - searchStartTime : null;
                        this.sendMetrics('search_result_click', {
                            href: e.target.href,
                            timeToClick: timeToClick
                        });
                    }
                });
            }
        }

        sendMetrics(event, data) {
            // In production, this would send to analytics service
            if (window.gtag) {
                window.gtag('event', event, {
                    custom_parameter: JSON.stringify(data)
                });
            }
            
            // Also log to console in development
            if (window.location.hostname === 'localhost') {
                console.log('MediaNest Docs Analytics:', event, data);
            }
        }
    }

    // Progressive Web App Features
    class PWAEnhancer {
        constructor() {
            this.init();
        }

        init() {
            this.registerServiceWorker();
            this.setupInstallPrompt();
            this.handleOfflineStatus();
        }

        registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('SW registered:', registration);
                    })
                    .catch(error => {
                        console.log('SW registration failed:', error);
                    });
            }
        }

        setupInstallPrompt() {
            let deferredPrompt;
            
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                this.showInstallButton(deferredPrompt);
            });
        }

        showInstallButton(deferredPrompt) {
            const installButton = document.createElement('button');
            installButton.className = 'md-button md-button--primary install-pwa-button';
            installButton.innerHTML = '📱 Install App';
            installButton.style.cssText = `
                position: fixed;
                bottom: 2rem;
                left: 2rem;
                z-index: 1000;
                border-radius: 24px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            
            installButton.addEventListener('click', async () => {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    installButton.remove();
                }
                
                deferredPrompt = null;
            });
            
            document.body.appendChild(installButton);
        }

        handleOfflineStatus() {
            const showOfflineMessage = () => {
                const message = document.createElement('div');
                message.className = 'offline-message';
                message.innerHTML = '📡 You are offline. Some features may be limited.';
                message.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: var(--md-typeset-color-warning);
                    color: white;
                    padding: 0.5rem;
                    text-align: center;
                    z-index: 10000;
                `;
                document.body.prepend(message);
            };
            
            const hideOfflineMessage = () => {
                const message = document.querySelector('.offline-message');
                if (message) {
                    message.remove();
                }
            };
            
            window.addEventListener('offline', showOfflineMessage);
            window.addEventListener('online', hideOfflineMessage);
        }
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .api-interactive-container {
            margin: 1rem 0;
            border: 1px solid var(--md-default-fg-color--lightest);
            border-radius: 8px;
            overflow: hidden;
        }
        
        .api-parameter-form {
            background: var(--md-code-bg-color);
        }
        
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            color: var(--md-default-fg-color--light);
        }
        
        .loading::after {
            content: '';
            width: 20px;
            height: 20px;
            border: 2px solid var(--md-default-fg-color--lightest);
            border-top: 2px solid var(--md-accent-fg-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 1rem;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);

    // Initialize all features
    document.addEventListener('DOMContentLoaded', () => {
        window.MediaNestDocs = MediaNestDocs;
        
        // Initialize components
        const materialEnhancer = new MaterialEnhancer();
        const apiExplorer = new APIExplorer();
        const diagramEnhancer = new DiagramEnhancer();
        const performanceTracker = new PerformanceTracker();
        const pwaEnhancer = new PWAEnhancer();
        
        // Make components available globally
        window.MediaNestDocs.components = {
            materialEnhancer,
            apiExplorer,
            diagramEnhancer,
            performanceTracker,
            pwaEnhancer
        };
        
        console.log('MediaNest Documentation Enhanced ✨');
    });

})();