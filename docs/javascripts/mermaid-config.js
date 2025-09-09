/**
 * MediaNest Documentation - Mermaid Configuration
 * Custom configuration for Mermaid diagrams with MediaNest branding
 */

// Wait for Mermaid to be available
document.addEventListener('DOMContentLoaded', function() {
    // Configure Mermaid with MediaNest theme
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({
            startOnLoad: true,
            theme: 'base',
            themeVariables: {
                // MediaNest color scheme
                primaryColor: '#673ab7',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#4527a0',
                lineColor: '#673ab7',
                sectionBkgColor: '#f3e5f5',
                altSectionBkgColor: '#ede7f6',
                gridColor: '#e1bee7',
                secondaryColor: '#9c27b0',
                tertiaryColor: '#ba68c8',
                
                // Background colors
                background: '#ffffff',
                mainBkg: '#ffffff',
                secondBkg: '#f8f9fa',
                tertiaryBkg: '#e9ecef',
                
                // Text colors
                textColor: '#212529',
                primaryTextColor: '#ffffff',
                pieOuterStrokeWidth: '2px',
                pieSectionTextColor: '#212529',
                pieTitleTextSize: '24px',
                pieTitleTextColor: '#212529',
                
                // Node colors
                fillType0: '#673ab7',
                fillType1: '#9c27b0',
                fillType2: '#ba68c8',
                fillType3: '#ce93d8',
                fillType4: '#e1bee7',
                fillType5: '#f3e5f5',
                fillType6: '#fce4ec',
                fillType7: '#f8bbd9',
                
                // Flowchart
                nodeBorder: '#4527a0',
                clusterBkg: '#f3e5f5',
                clusterBorder: '#9c27b0',
                defaultLinkColor: '#673ab7',
                titleColor: '#212529',
                edgeLabelBackground: '#ffffff',
                
                // Sequence diagram
                actorBorder: '#673ab7',
                actorBkg: '#f3e5f5',
                actorTextColor: '#212529',
                actorLineColor: '#9c27b0',
                signalColor: '#673ab7',
                signalTextColor: '#212529',
                labelBoxBkgColor: '#f3e5f5',
                labelBoxBorderColor: '#673ab7',
                labelTextColor: '#212529',
                loopTextColor: '#212529',
                noteBorderColor: '#9c27b0',
                noteBkgColor: '#fff3e0',
                noteTextColor: '#212529',
                activationBorderColor: '#4527a0',
                activationBkgColor: '#e8eaf6',
                
                // Gantt chart
                cScale0: '#673ab7',
                cScale1: '#9c27b0',
                cScale2: '#ba68c8',
                
                // State diagram
                labelColor: '#212529',
                
                // Class diagram
                classText: '#212529',
                
                // Git graph
                git0: '#673ab7',
                git1: '#9c27b0',
                git2: '#ba68c8',
                git3: '#ce93d8',
                git4: '#e1bee7',
                git5: '#f3e5f5',
                git6: '#fce4ec',
                git7: '#f8bbd9',
                gitBranchLabel0: '#ffffff',
                gitBranchLabel1: '#ffffff',
                gitBranchLabel2: '#ffffff',
                gitBranchLabel3: '#ffffff',
                gitBranchLabel4: '#212529',
                gitBranchLabel5: '#212529',
                gitBranchLabel6: '#212529',
                gitBranchLabel7: '#212529',
                
                // Journey diagram
                fillType0: '#673ab7',
                fillType1: '#9c27b0',
                fillType2: '#ba68c8',
                fillType3: '#ce93d8',
                fillType4: '#e1bee7'
            },
            
            // Flowchart configuration
            flowchart: {
                diagramPadding: 20,
                htmlLabels: true,
                curve: 'basis',
                padding: 15,
                useMaxWidth: true,
                nodeSpacing: 50,
                rankSpacing: 50
            },
            
            // Sequence diagram configuration
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
                useMaxWidth: true,
                rightAngles: false,
                showSequenceNumbers: false
            },
            
            // Gantt configuration
            gantt: {
                titleTopMargin: 25,
                barHeight: 20,
                fontSizeFactor: 1,
                fontSize: 11,
                gridLineStartPadding: 35,
                bottomPadding: 50,
                numberSectionStyles: 4
            },
            
            // Class diagram configuration
            class: {
                useMaxWidth: true,
                htmlLabels: true
            },
            
            // State diagram configuration
            state: {
                useMaxWidth: true,
                htmlLabels: true
            },
            
            // Journey configuration
            journey: {
                useMaxWidth: true,
                diagramMarginX: 50,
                diagramMarginY: 10,
                leftMargin: 150,
                width: 150,
                height: 50,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35,
                bottomMarginAdj: 1
            },
            
            // Security settings
            securityLevel: 'strict',
            
            // Error handling
            suppressErrorRendering: false,
            
            // Responsive behavior
            maxTextSize: 50000,
            maxEdges: 500,
            
            // Font settings
            fontFamily: 'Roboto, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
        });
        
        // Custom post-processing for better integration
        const originalRender = mermaid.render;
        mermaid.render = function(id, text, cb, container) {
            return originalRender(id, text, function(svgCode, bindFunctions) {
                // Add custom classes and attributes
                const parser = new DOMParser();
                const doc = parser.parseFromString(svgCode, 'image/svg+xml');
                const svg = doc.querySelector('svg');
                
                if (svg) {
                    // Add MediaNest classes
                    svg.classList.add('medianest-diagram');
                    svg.setAttribute('role', 'img');
                    svg.setAttribute('aria-label', 'MediaNest diagram');
                    
                    // Ensure responsive behavior
                    svg.style.maxWidth = '100%';
                    svg.style.height = 'auto';
                    
                    // Add dark mode support
                    svg.classList.add('diagram-responsive');
                    
                    // Return modified SVG
                    const modifiedSvgCode = new XMLSerializer().serializeToString(doc);
                    if (cb) cb(modifiedSvgCode, bindFunctions);
                    return modifiedSvgCode;
                }
                
                if (cb) cb(svgCode, bindFunctions);
                return svgCode;
            }, container);
        };
        
        // Enhanced error handling
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const diagrams = node.querySelectorAll('.mermaid:not([data-processed])');
                            diagrams.forEach(function(diagram) {
                                try {
                                    mermaid.init(undefined, diagram);
                                } catch (error) {
                                    console.warn('Mermaid diagram failed to render:', error);
                                    diagram.innerHTML = '<div class="mermaid-error">Diagram failed to render</div>';
                                }
                            });
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Dark mode theme switching
        const handleThemeChange = () => {
            const isDark = document.body.getAttribute('data-md-color-scheme') === 'slate';
            
            mermaid.initialize({
                theme: isDark ? 'dark' : 'base',
                themeVariables: isDark ? {
                    primaryColor: '#bb86fc',
                    primaryTextColor: '#000000',
                    primaryBorderColor: '#7c4dff',
                    lineColor: '#bb86fc',
                    sectionBkgColor: '#2d2d30',
                    altSectionBkgColor: '#3e3e42',
                    gridColor: '#484848',
                    secondaryColor: '#cf6679',
                    tertiaryColor: '#bb86fc',
                    background: '#1e1e1e',
                    mainBkg: '#2d2d30',
                    secondBkg: '#3e3e42',
                    tertiaryBkg: '#484848',
                    textColor: '#ffffff',
                    primaryTextColor: '#000000',
                    nodeBorder: '#7c4dff',
                    clusterBkg: '#2d2d30',
                    clusterBorder: '#bb86fc',
                    defaultLinkColor: '#bb86fc',
                    titleColor: '#ffffff',
                    edgeLabelBackground: '#2d2d30',
                    actorBorder: '#bb86fc',
                    actorBkg: '#2d2d30',
                    actorTextColor: '#ffffff',
                    actorLineColor: '#cf6679',
                    signalColor: '#bb86fc',
                    signalTextColor: '#ffffff',
                    labelBoxBkgColor: '#2d2d30',
                    labelBoxBorderColor: '#bb86fc',
                    labelTextColor: '#ffffff',
                    loopTextColor: '#ffffff',
                    noteBorderColor: '#cf6679',
                    noteBkgColor: '#3e3e42',
                    noteTextColor: '#ffffff',
                    activationBorderColor: '#7c4dff',
                    activationBkgColor: '#484848',
                    labelColor: '#ffffff',
                    classText: '#ffffff'
                } : {
                    // Light theme variables (same as above)
                    primaryColor: '#673ab7',
                    primaryTextColor: '#ffffff',
                    primaryBorderColor: '#4527a0',
                    lineColor: '#673ab7',
                    sectionBkgColor: '#f3e5f5',
                    altSectionBkgColor: '#ede7f6',
                    gridColor: '#e1bee7',
                    secondaryColor: '#9c27b0',
                    tertiaryColor: '#ba68c8',
                    background: '#ffffff',
                    mainBkg: '#ffffff',
                    secondBkg: '#f8f9fa',
                    tertiaryBkg: '#e9ecef',
                    textColor: '#212529',
                    primaryTextColor: '#ffffff',
                    nodeBorder: '#4527a0',
                    clusterBkg: '#f3e5f5',
                    clusterBorder: '#9c27b0',
                    defaultLinkColor: '#673ab7',
                    titleColor: '#212529',
                    edgeLabelBackground: '#ffffff'
                }
            });
        };
        
        // Watch for theme changes
        const themeObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-md-color-scheme') {
                    handleThemeChange();
                    // Re-render all diagrams with new theme
                    setTimeout(() => {
                        document.querySelectorAll('.mermaid[data-processed]').forEach(diagram => {
                            diagram.removeAttribute('data-processed');
                            mermaid.init(undefined, diagram);
                        });
                    }, 100);
                }
            });
        });
        
        themeObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-md-color-scheme']
        });
    }
});

// CSS for better diagram styling
const style = document.createElement('style');
style.textContent = `
    .mermaid {
        text-align: center;
        margin: 2rem 0;
        background: transparent;
    }
    
    .medianest-diagram {
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        background: var(--md-default-bg-color);
        padding: 1rem;
        margin: 1rem 0;
    }
    
    [data-md-color-scheme="slate"] .medianest-diagram {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        background: var(--md-code-bg-color);
    }
    
    .diagram-responsive {
        width: 100%;
        height: auto;
        max-width: 100%;
    }
    
    .mermaid-error {
        padding: 1rem;
        background: #ffebee;
        border: 1px solid #f44336;
        border-radius: 4px;
        color: #c62828;
        font-weight: 500;
        text-align: center;
    }
    
    [data-md-color-scheme="slate"] .mermaid-error {
        background: #1a1a1a;
        border-color: #cf6679;
        color: #cf6679;
    }
    
    @media (max-width: 768px) {
        .mermaid {
            margin: 1rem -1rem;
        }
        
        .medianest-diagram {
            border-radius: 0;
            margin: 1rem -1rem;
            padding: 0.5rem;
        }
    }
    
    @media print {
        .mermaid {
            break-inside: avoid;
            page-break-inside: avoid;
        }
    }
`;

document.head.appendChild(style);