// MediaNest Documentation JavaScript Enhancements

document.addEventListener('DOMContentLoaded', function() {
    // Add copy buttons to code blocks
    addCopyButtons();
    
    // Initialize search enhancements
    initSearchEnhancements();
    
    // Add progress tracking
    initProgressTracking();
    
    // Initialize tab navigation
    initTabNavigation();
    
    // Add version badge
    addVersionBadge();
});

/**
 * Add copy buttons to all code blocks
 */
function addCopyButtons() {
    const codeBlocks = document.querySelectorAll('pre code');
    
    codeBlocks.forEach(function(codeBlock) {
        const pre = codeBlock.parentNode;
        const button = document.createElement('button');
        
        button.className = 'copy-button';
        button.textContent = 'Copy';
        button.setAttribute('aria-label', 'Copy code to clipboard');
        
        button.addEventListener('click', function() {
            const text = codeBlock.textContent;
            
            navigator.clipboard.writeText(text).then(function() {
                button.textContent = 'Copied!';
                button.classList.add('copied');
                
                setTimeout(function() {
                    button.textContent = 'Copy';
                    button.classList.remove('copied');
                }, 2000);
            }).catch(function() {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                button.textContent = 'Copied!';
                setTimeout(function() {
                    button.textContent = 'Copy';
                }, 2000);
            });
        });
        
        // Style the button
        Object.assign(button.style, {
            position: 'absolute',
            top: '8px',
            right: '8px',
            padding: '4px 8px',
            fontSize: '12px',
            background: 'var(--medianest-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: '0.8',
            transition: 'opacity 0.2s ease'
        });
        
        pre.style.position = 'relative';
        pre.appendChild(button);
        
        // Show button on hover
        pre.addEventListener('mouseenter', function() {
            button.style.opacity = '1';
        });
        
        pre.addEventListener('mouseleave', function() {
            button.style.opacity = '0.8';
        });
    });
}

/**
 * Enhance search functionality
 */
function initSearchEnhancements() {
    const searchInput = document.querySelector('.md-search__input');
    
    if (searchInput) {
        // Add search shortcuts
        document.addEventListener('keydown', function(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
            
            if (e.key === 'Escape' && document.activeElement === searchInput) {
                searchInput.blur();
            }
        });
        
        // Add placeholder enhancement
        searchInput.placeholder = 'Search docs... (Ctrl+K)';
    }
}

/**
 * Track reading progress
 */
function initProgressTracking() {
    const article = document.querySelector('.md-content__inner');
    
    if (article) {
        const progressBar = document.createElement('div');
        progressBar.className = 'reading-progress';
        
        Object.assign(progressBar.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '0%',
            height: '2px',
            background: 'linear-gradient(90deg, var(--medianest-primary), var(--medianest-secondary))',
            zIndex: '1000',
            transition: 'width 0.1s ease'
        });
        
        document.body.appendChild(progressBar);
        
        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = (scrollTop / docHeight) * 100;
            
            progressBar.style.width = Math.min(scrollPercent, 100) + '%';
        });
    }
}

/**
 * Enhanced tab navigation
 */
function initTabNavigation() {
    const tabGroups = document.querySelectorAll('.tabbed-set');
    
    tabGroups.forEach(function(tabGroup) {
        const tabs = tabGroup.querySelectorAll('.tabbed-labels label');
        
        tabs.forEach(function(tab, index) {
            tab.addEventListener('keydown', function(e) {
                let targetIndex;
                
                switch(e.key) {
                    case 'ArrowLeft':
                        targetIndex = index > 0 ? index - 1 : tabs.length - 1;
                        break;
                    case 'ArrowRight':
                        targetIndex = index < tabs.length - 1 ? index + 1 : 0;
                        break;
                    case 'Home':
                        targetIndex = 0;
                        break;
                    case 'End':
                        targetIndex = tabs.length - 1;
                        break;
                    default:
                        return;
                }
                
                e.preventDefault();
                tabs[targetIndex].click();
                tabs[targetIndex].focus();
            });
        });
    });
}

/**
 * Add version badge to navigation
 */
function addVersionBadge() {
    const header = document.querySelector('.md-header__inner');
    
    if (header) {
        const versionBadge = document.createElement('div');
        versionBadge.className = 'version-badge';
        versionBadge.textContent = 'v1.0.0';
        
        Object.assign(versionBadge.style, {
            position: 'absolute',
            top: '8px',
            right: '16px',
            padding: '2px 8px',
            fontSize: '10px',
            background: 'var(--medianest-accent)',
            color: 'white',
            borderRadius: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        });
        
        header.style.position = 'relative';
        header.appendChild(versionBadge);
    }
}

/**
 * Add table of contents highlighting
 */
function initTocHighlighting() {
    const headings = document.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]');
    const tocLinks = document.querySelectorAll('.md-nav__link[href^="#"]');
    
    if (headings.length === 0 || tocLinks.length === 0) return;
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            const id = entry.target.getAttribute('id');
            const tocLink = document.querySelector(`.md-nav__link[href="#${id}"]`);
            
            if (tocLink) {
                if (entry.isIntersecting) {
                    tocLink.classList.add('active');
                } else {
                    tocLink.classList.remove('active');
                }
            }
        });
    }, {
        rootMargin: '-20% 0px -80% 0px'
    });
    
    headings.forEach(function(heading) {
        observer.observe(heading);
    });
}

/**
 * Add print functionality
 */
function initPrintFunctionality() {
    const printButton = document.createElement('button');
    printButton.innerHTML = '🖨️ Print';
    printButton.className = 'print-button';
    
    Object.assign(printButton.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '10px 15px',
        background: 'var(--medianest-primary)',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '600',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: '1000'
    });
    
    printButton.addEventListener('click', function() {
        window.print();
    });
    
    document.body.appendChild(printButton);
    
    // Hide print button on mobile
    if (window.innerWidth < 768) {
        printButton.style.display = 'none';
    }
}

/**
 * Initialize all enhancements after DOM load
 */
window.addEventListener('load', function() {
    initTocHighlighting();
    initPrintFunctionality();
    
    // Add fade-in animation to main content
    const content = document.querySelector('.md-content');
    if (content) {
        content.style.opacity = '0';
        content.style.transform = 'translateY(20px)';
        content.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        setTimeout(function() {
            content.style.opacity = '1';
            content.style.transform = 'translateY(0)';
        }, 100);
    }
});

/**
 * Service worker registration for offline support
 */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('SW registered: ', registration);
            })
            .catch(function(registrationError) {
                console.log('SW registration failed: ', registrationError);
            });
    });
}