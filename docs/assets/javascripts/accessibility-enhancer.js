/* MediaNest Documentation Accessibility Enhancer - 2025 Enhanced */

(function() {
    'use strict';

    class MediaNestAccessibilityEnhancer {
        constructor() {
            this.init();
            this.setupKeyboardNavigation();
            this.enhanceScreenReaderSupport();
            this.addFocusManagement();
            this.setupAccessibilityTools();
        }

        init() {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.enhance());
            } else {
                this.enhance();
            }
        }

        enhance() {
            this.enhanceImages();
            this.enhanceLinks();
            this.enhanceButtons();
            this.enhanceCodeBlocks();
            this.enhanceNavigation();
            this.enhanceSearch();
            this.addSkipLinks();
            this.setupColorContrastMode();
            this.announcePageChanges();
        }

        enhanceImages() {
            // Add missing alt attributes and enhance existing ones
            const images = document.querySelectorAll('img');
            images.forEach((img, index) => {
                if (!img.alt) {
                    if (img.src.includes('logo')) {
                        img.alt = 'MediaNest Logo';
                    } else if (img.closest('figure')) {
                        const caption = img.closest('figure').querySelector('figcaption');
                        img.alt = caption ? caption.textContent : `Image ${index + 1}`;
                    } else {
                        img.alt = `Illustration ${index + 1}`;
                    }
                }

                // Add loading status for screen readers
                if (img.loading === 'lazy') {
                    img.setAttribute('aria-label', `${img.alt} (loading when visible)`);
                }
            });
        }

        enhanceLinks() {
            const links = document.querySelectorAll('a');
            links.forEach(link => {
                // Enhance external links
                if (link.hostname && link.hostname !== window.location.hostname) {
                    if (!link.getAttribute('aria-label')) {
                        link.setAttribute('aria-label', `${link.textContent || link.href} (opens in new tab)`);
                    }
                    if (link.target === '_blank' && !link.rel.includes('noopener')) {
                        link.rel = link.rel ? `${link.rel} noopener` : 'noopener';
                    }
                }

                // Enhance anchor links
                if (link.href.includes('#') && link.hostname === window.location.hostname) {
                    const targetId = link.href.split('#')[1];
                    const target = document.getElementById(targetId);
                    if (target) {
                        link.setAttribute('aria-describedby', targetId);
                    }
                }

                // Add download indicators
                if (link.download || link.href.match(/\.(pdf|doc|docx|xls|xlsx|zip)$/i)) {
                    const fileType = link.href.split('.').pop().toUpperCase();
                    link.setAttribute('aria-label', `${link.textContent} (${fileType} download)`);
                }
            });
        }

        enhanceButtons() {
            const buttons = document.querySelectorAll('button:not([aria-label]):not([aria-labelledby])');
            buttons.forEach(button => {
                if (!button.textContent.trim()) {
                    // Add aria-label for icon-only buttons
                    if (button.querySelector('svg') || button.className.includes('icon')) {
                        if (button.className.includes('search')) {
                            button.setAttribute('aria-label', 'Search documentation');
                        } else if (button.className.includes('menu')) {
                            button.setAttribute('aria-label', 'Toggle navigation menu');
                        } else if (button.className.includes('theme')) {
                            button.setAttribute('aria-label', 'Toggle theme');
                        } else {
                            button.setAttribute('aria-label', 'Button');
                        }
                    }
                }
            });
        }

        enhanceCodeBlocks() {
            const codeBlocks = document.querySelectorAll('pre code');
            codeBlocks.forEach((code, index) => {
                const pre = code.parentElement;
                
                // Add language label
                const language = code.className.match(/language-(\w+)/);
                if (language) {
                    pre.setAttribute('aria-label', `${language[1]} code example`);
                } else {
                    pre.setAttribute('aria-label', `Code example ${index + 1}`);
                }

                // Add role for better screen reader support
                pre.setAttribute('role', 'region');
                
                // Add tabindex for keyboard navigation
                pre.setAttribute('tabindex', '0');

                // Enhance copy button accessibility
                const copyButton = pre.querySelector('.md-clipboard');
                if (copyButton) {
                    copyButton.setAttribute('aria-label', 'Copy code to clipboard');
                    copyButton.setAttribute('title', 'Copy code to clipboard');
                }
            });
        }

        enhanceNavigation() {
            // Enhance main navigation
            const nav = document.querySelector('.md-nav--primary');
            if (nav) {
                nav.setAttribute('role', 'navigation');
                nav.setAttribute('aria-label', 'Main navigation');
            }

            // Enhance table of contents
            const toc = document.querySelector('.md-nav--secondary');
            if (toc) {
                toc.setAttribute('role', 'navigation');
                toc.setAttribute('aria-label', 'Table of contents');
            }

            // Add current page indication
            const currentLink = document.querySelector('.md-nav__link--active');
            if (currentLink) {
                currentLink.setAttribute('aria-current', 'page');
            }
        }

        enhanceSearch() {
            const searchInput = document.querySelector('.md-search__input');
            if (searchInput) {
                searchInput.setAttribute('aria-label', 'Search MediaNest documentation');
                searchInput.setAttribute('aria-describedby', 'search-help');
                
                // Add search help text
                const helpText = document.createElement('div');
                helpText.id = 'search-help';
                helpText.className = 'sr-only';
                helpText.textContent = 'Use arrow keys to navigate results, Enter to select';
                searchInput.parentNode.appendChild(helpText);
            }

            // Enhance search results
            const searchResults = document.querySelector('.md-search__output');
            if (searchResults) {
                searchResults.setAttribute('role', 'region');
                searchResults.setAttribute('aria-label', 'Search results');
                searchResults.setAttribute('aria-live', 'polite');
            }
        }

        addSkipLinks() {
            // Add skip to content link
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.className = 'skip-link';
            skipLink.textContent = 'Skip to main content';
            skipLink.setAttribute('aria-label', 'Skip navigation and go to main content');

            // Style skip link
            skipLink.style.cssText = `
                position: absolute;
                top: -40px;
                left: 6px;
                background: #673ab7;
                color: white;
                padding: 8px;
                text-decoration: none;
                border-radius: 4px;
                z-index: 10000;
                font-weight: bold;
                transition: top 0.2s ease;
            `;

            skipLink.addEventListener('focus', () => {
                skipLink.style.top = '6px';
            });

            skipLink.addEventListener('blur', () => {
                skipLink.style.top = '-40px';
            });

            document.body.insertBefore(skipLink, document.body.firstChild);

            // Add main content id if not present
            const mainContent = document.querySelector('main, .md-content, article');
            if (mainContent && !mainContent.id) {
                mainContent.id = 'main-content';
                mainContent.setAttribute('tabindex', '-1');
            }
        }

        setupKeyboardNavigation() {
            // Enhanced keyboard navigation for documentation
            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd + K for search
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    const searchInput = document.querySelector('.md-search__input');
                    if (searchInput) {
                        searchInput.focus();
                    }
                }

                // Escape to close search/menus
                if (e.key === 'Escape') {
                    const activeSearch = document.querySelector('.md-search--active');
                    if (activeSearch) {
                        activeSearch.classList.remove('md-search--active');
                    }
                    
                    const drawerInput = document.querySelector('#__drawer:checked');
                    if (drawerInput) {
                        drawerInput.checked = false;
                    }
                }

                // Arrow keys for navigation in search results
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    const searchResults = document.querySelector('.md-search__list');
                    if (searchResults && searchResults.children.length > 0) {
                        e.preventDefault();
                        this.navigateSearchResults(e.key === 'ArrowDown' ? 1 : -1);
                    }
                }
            });
        }

        navigateSearchResults(direction) {
            const results = document.querySelectorAll('.md-search__list .md-search-result');
            const currentFocus = document.querySelector('.md-search-result--focused');
            
            let currentIndex = currentFocus ? Array.from(results).indexOf(currentFocus) : -1;
            
            if (currentFocus) {
                currentFocus.classList.remove('md-search-result--focused');
            }
            
            currentIndex += direction;
            
            if (currentIndex < 0) {
                currentIndex = results.length - 1;
            } else if (currentIndex >= results.length) {
                currentIndex = 0;
            }
            
            if (results[currentIndex]) {
                results[currentIndex].classList.add('md-search-result--focused');
                results[currentIndex].scrollIntoView({ block: 'nearest' });
            }
        }

        enhanceScreenReaderSupport() {
            // Add aria-live regions for dynamic content
            const liveRegion = document.createElement('div');
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            liveRegion.id = 'live-region';
            document.body.appendChild(liveRegion);

            // Announce theme changes
            const themeButtons = document.querySelectorAll('[data-md-color-scheme]');
            themeButtons.forEach(button => {
                button.addEventListener('click', () => {
                    setTimeout(() => {
                        const currentScheme = document.body.getAttribute('data-md-color-scheme');
                        this.announceToScreenReader(`Theme changed to ${currentScheme} mode`);
                    }, 100);
                });
            });
        }

        addFocusManagement() {
            // Manage focus for dynamic content changes
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                this.manageFocusForNewContent(node);
                            }
                        });
                    }
                });
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        manageFocusForNewContent(element) {
            // Add focus management for modals, dropdowns, etc.
            if (element.classList && element.classList.contains('md-search__output')) {
                // Focus first search result when results appear
                const firstResult = element.querySelector('.md-search-result');
                if (firstResult) {
                    setTimeout(() => {
                        firstResult.focus();
                    }, 100);
                }
            }
        }

        setupAccessibilityTools() {
            // Add accessibility toolbar (optional)
            if (sessionStorage.getItem('medianest-a11y-tools') === 'enabled') {
                this.createAccessibilityToolbar();
            }

            // Add keyboard shortcut to toggle tools
            document.addEventListener('keydown', (e) => {
                if (e.altKey && e.shiftKey && e.key === 'A') {
                    e.preventDefault();
                    this.toggleAccessibilityToolbar();
                }
            });
        }

        createAccessibilityToolbar() {
            const toolbar = document.createElement('div');
            toolbar.className = 'medianest-a11y-toolbar';
            toolbar.innerHTML = `
                <div class="a11y-toolbar-content">
                    <h3>Accessibility Tools</h3>
                    <button id="increase-font" aria-label="Increase font size">A+</button>
                    <button id="decrease-font" aria-label="Decrease font size">A-</button>
                    <button id="toggle-contrast" aria-label="Toggle high contrast">Contrast</button>
                    <button id="toggle-focus" aria-label="Show focus indicators">Focus</button>
                    <button id="close-toolbar" aria-label="Close accessibility toolbar">×</button>
                </div>
            `;

            // Style toolbar
            toolbar.style.cssText = `
                position: fixed;
                top: 100px;
                right: 20px;
                background: white;
                border: 2px solid #673ab7;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                z-index: 10000;
                font-family: 'Roboto', sans-serif;
            `;

            document.body.appendChild(toolbar);

            // Add event listeners
            this.setupToolbarEvents(toolbar);
        }

        setupToolbarEvents(toolbar) {
            toolbar.querySelector('#increase-font').addEventListener('click', () => {
                this.adjustFontSize(1.1);
            });

            toolbar.querySelector('#decrease-font').addEventListener('click', () => {
                this.adjustFontSize(0.9);
            });

            toolbar.querySelector('#toggle-contrast').addEventListener('click', () => {
                document.body.classList.toggle('high-contrast');
            });

            toolbar.querySelector('#toggle-focus').addEventListener('click', () => {
                document.body.classList.toggle('show-focus');
            });

            toolbar.querySelector('#close-toolbar').addEventListener('click', () => {
                toolbar.remove();
                sessionStorage.setItem('medianest-a11y-tools', 'disabled');
            });
        }

        adjustFontSize(factor) {
            const rootStyle = getComputedStyle(document.documentElement);
            const currentSize = parseFloat(rootStyle.fontSize) || 16;
            const newSize = Math.min(Math.max(currentSize * factor, 12), 24);
            document.documentElement.style.fontSize = `${newSize}px`;
        }

        toggleAccessibilityToolbar() {
            const existing = document.querySelector('.medianest-a11y-toolbar');
            if (existing) {
                existing.remove();
                sessionStorage.setItem('medianest-a11y-tools', 'disabled');
            } else {
                this.createAccessibilityToolbar();
                sessionStorage.setItem('medianest-a11y-tools', 'enabled');
            }
        }

        setupColorContrastMode() {
            // Detect system preference for high contrast
            if (window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches) {
                document.body.classList.add('system-high-contrast');
            }

            // Listen for changes
            if (window.matchMedia) {
                const contrastQuery = window.matchMedia('(prefers-contrast: high)');
                contrastQuery.addEventListener('change', (e) => {
                    if (e.matches) {
                        document.body.classList.add('system-high-contrast');
                    } else {
                        document.body.classList.remove('system-high-contrast');
                    }
                });
            }
        }

        announcePageChanges() {
            // Announce navigation changes for SPA-like behavior
            let currentPath = window.location.pathname;
            
            const checkForNavigationChange = () => {
                if (window.location.pathname !== currentPath) {
                    currentPath = window.location.pathname;
                    
                    // Announce page change
                    const pageTitle = document.title.split(' - ')[0];
                    this.announceToScreenReader(`Navigated to ${pageTitle}`);
                    
                    // Re-enhance new content
                    setTimeout(() => this.enhance(), 100);
                }
            };

            // Check for navigation changes
            setInterval(checkForNavigationChange, 1000);
        }

        announceToScreenReader(message) {
            const liveRegion = document.getElementById('live-region');
            if (liveRegion) {
                liveRegion.textContent = message;
                setTimeout(() => {
                    liveRegion.textContent = '';
                }, 1000);
            }
        }
    }

    // Add CSS for accessibility enhancements
    const style = document.createElement('style');
    style.textContent = `
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }
        
        .show-focus *:focus {
            outline: 3px solid #673ab7 !important;
            outline-offset: 2px !important;
        }
        
        .high-contrast {
            filter: contrast(150%) brightness(110%);
        }
        
        .md-search-result--focused {
            background-color: #673ab7 !important;
            color: white !important;
        }
        
        @media (prefers-reduced-motion: reduce) {
            *, *::before, *::after {
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }
        }
        
        .system-high-contrast {
            --md-primary-fg-color: #000000;
            --md-primary-bg-color: #ffffff;
            --md-accent-fg-color: #000000;
        }
    `;
    document.head.appendChild(style);

    // Initialize accessibility enhancer
    new MediaNestAccessibilityEnhancer();

})();