/* Interactive Diagram Functionality */
document.addEventListener('DOMContentLoaded', function() {
    initializeMermaidDiagrams();
    addDiagramInteractions();
    setupDiagramNavigation();
});

function initializeMermaidDiagrams() {
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: true,
            theme: document.body.getAttribute('data-md-color-scheme') === 'slate' ? 'dark' : 'default',
            themeVariables: {
                primaryColor: 'var(--md-primary-fg-color)',
                primaryTextColor: 'var(--md-primary-bg-color)',
                primaryBorderColor: 'var(--md-primary-fg-color)',
                lineColor: 'var(--md-default-fg-color)',
                secondaryColor: 'var(--md-accent-fg-color)',
                tertiaryColor: 'var(--md-default-bg-color)'
            },
            flowchart: {
                htmlLabels: true,
                curve: 'basis'
            },
            sequence: {
                diagramMarginX: 50,
                diagramMarginY: 10,
                actorMargin: 50,
                width: 150,
                height: 65,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35,
                mirrorActors: true,
                bottomMarginAdj: 1,
                useMaxWidth: true
            },
            gantt: {
                titleTopMargin: 25,
                barHeight: 20,
                fontFamily: 'var(--md-text-font-family)',
                fontSize: 11,
                gridLineStartPadding: 35,
                bottomPadding: 25,
                leftPadding: 75,
                topPadding: 50,
                topAxis: false
            }
        });
        
        // Re-render diagrams when theme changes
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.attributeName === 'data-md-color-scheme') {
                    const newTheme = document.body.getAttribute('data-md-color-scheme') === 'slate' ? 'dark' : 'default';
                    mermaid.initialize({ theme: newTheme });
                    location.reload(); // Simple way to re-render all diagrams
                }
            });
        });
        
        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-md-color-scheme']
        });
    }
}

function addDiagramInteractions() {
    const diagrams = document.querySelectorAll('.mermaid, .language-mermaid');
    
    diagrams.forEach(diagram => {
        // Add zoom functionality
        addZoomControls(diagram);
        
        // Add fullscreen capability
        addFullscreenButton(diagram);
        
        // Add export functionality
        addExportButton(diagram);
        
        // Add click-to-expand for nodes
        addNodeInteractions(diagram);
    });
}

function addZoomControls(diagram) {
    const controls = document.createElement('div');
    controls.className = 'diagram-controls';
    controls.innerHTML = `
        <button class="diagram-btn zoom-in" title="Zoom In">+</button>
        <button class="diagram-btn zoom-out" title="Zoom Out">−</button>
        <button class="diagram-btn zoom-reset" title="Reset Zoom">⌂</button>
    `;
    
    diagram.parentElement.style.position = 'relative';
    diagram.parentElement.appendChild(controls);
    
    let scale = 1;
    const svg = diagram.querySelector('svg');
    
    if (svg) {
        controls.querySelector('.zoom-in').addEventListener('click', () => {
            scale = Math.min(scale * 1.2, 3);
            svg.style.transform = `scale(${scale})`;
            svg.style.transformOrigin = 'center center';
        });
        
        controls.querySelector('.zoom-out').addEventListener('click', () => {
            scale = Math.max(scale / 1.2, 0.5);
            svg.style.transform = `scale(${scale})`;
            svg.style.transformOrigin = 'center center';
        });
        
        controls.querySelector('.zoom-reset').addEventListener('click', () => {
            scale = 1;
            svg.style.transform = 'scale(1)';
        });
    }
}

function addFullscreenButton(diagram) {
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'diagram-btn fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.title = 'Fullscreen';
    
    fullscreenBtn.addEventListener('click', () => {
        openDiagramFullscreen(diagram);
    });
    
    const controls = diagram.parentElement.querySelector('.diagram-controls');
    if (controls) {
        controls.appendChild(fullscreenBtn);
    }
}

function addExportButton(diagram) {
    const exportBtn = document.createElement('button');
    exportBtn.className = 'diagram-btn export-btn';
    exportBtn.innerHTML = '↓';
    exportBtn.title = 'Export as PNG';
    
    exportBtn.addEventListener('click', () => {
        exportDiagramAsPNG(diagram);
    });
    
    const controls = diagram.parentElement.querySelector('.diagram-controls');
    if (controls) {
        controls.appendChild(exportBtn);
    }
}

function openDiagramFullscreen(diagram) {
    const modal = document.createElement('div');
    modal.className = 'diagram-fullscreen-modal';
    modal.innerHTML = `
        <div class="diagram-fullscreen-content">
            <div class="diagram-fullscreen-header">
                <h3>Diagram View</h3>
                <button class="close-button" onclick="closeDiagramFullscreen()">&times;</button>
            </div>
            <div class="diagram-fullscreen-body">
                ${diagram.outerHTML}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

function closeDiagramFullscreen() {
    const modals = document.querySelectorAll('.diagram-fullscreen-modal');
    modals.forEach(modal => modal.remove());
}

function exportDiagramAsPNG(diagram) {
    const svg = diagram.querySelector('svg');
    if (!svg) return;
    
    // Create a canvas element
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // Get SVG data
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
    const svgUrl = URL.createObjectURL(svgBlob);
    
    img.onload = function() {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        // Create download link
        const downloadLink = document.createElement('a');
        downloadLink.download = 'diagram.png';
        downloadLink.href = canvas.toDataURL('image/png');
        downloadLink.click();
        
        URL.revokeObjectURL(svgUrl);
    };
    
    img.src = svgUrl;
}

function addNodeInteractions(diagram) {
    // Add click handlers for diagram nodes (if applicable)
    const nodes = diagram.querySelectorAll('[id^="flowchart"], [id^="graph"] rect, [id^="graph"] circle');
    
    nodes.forEach(node => {
        node.style.cursor = 'pointer';
        node.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Show tooltip or additional information
            showNodeTooltip(node, e);
        });
    });
}

function showNodeTooltip(node, event) {
    // Remove existing tooltips
    document.querySelectorAll('.diagram-tooltip').forEach(tip => tip.remove());
    
    const tooltip = document.createElement('div');
    tooltip.className = 'diagram-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-content">
            <h4>Node Information</h4>
            <p>Click for detailed information about this component.</p>
            <button onclick="this.parentElement.parentElement.remove()">Close</button>
        </div>
    `;
    
    tooltip.style.position = 'absolute';
    tooltip.style.left = event.pageX + 'px';
    tooltip.style.top = event.pageY + 'px';
    tooltip.style.zIndex = '1000';
    
    document.body.appendChild(tooltip);
    
    // Auto-remove tooltip after 5 seconds
    setTimeout(() => {
        if (tooltip.parentElement) {
            tooltip.remove();
        }
    }, 5000);
}

function setupDiagramNavigation() {
    // Create diagram index for navigation
    const diagrams = document.querySelectorAll('.mermaid, .language-mermaid');
    if (diagrams.length > 1) {
        createDiagramNavigator(diagrams);
    }
}

function createDiagramNavigator(diagrams) {
    const navigator = document.createElement('div');
    navigator.className = 'diagram-navigator';
    navigator.innerHTML = '<h4>Diagrams on this page:</h4>';
    
    const list = document.createElement('ul');
    diagrams.forEach((diagram, index) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.textContent = `Diagram ${index + 1}`;
        link.href = '#';
        link.addEventListener('click', (e) => {
            e.preventDefault();
            diagram.scrollIntoView({ behavior: 'smooth' });
        });
        
        item.appendChild(link);
        list.appendChild(item);
    });
    
    navigator.appendChild(list);
    
    // Insert navigator before first diagram
    diagrams[0].parentElement.insertBefore(navigator, diagrams[0]);
}