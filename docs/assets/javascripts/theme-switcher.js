/* MediaNest Documentation Advanced Theme Switcher - 2025 Enhanced */

(function() {
    'use strict';

    class MediaNestThemeSwitcher {
        constructor() {
            this.currentScheme = null;
            this.systemPreference = null;
            this.userPreference = null;
            this.transitions = new Map();
            
            this.init();
        }

        init() {
            this.detectSystemPreference();
            this.loadUserPreference();
            this.setupThemeDetection();
            this.enhanceThemeToggle();
            this.addAdvancedThemeOptions();
            this.setupTransitions();
        }

        detectSystemPreference() {
            if (window.matchMedia) {
                const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
                this.systemPreference = darkQuery.matches ? 'slate' : 'default';
                
                // Listen for system theme changes
                darkQuery.addEventListener('change', (e) => {
                    this.systemPreference = e.matches ? 'slate' : 'default';
                    this.announceThemeChange(`System theme changed to ${e.matches ? 'dark' : 'light'} mode`);
                    
                    // Apply system preference if user hasn't set a preference
                    if (!this.userPreference || this.userPreference === 'auto') {
                        this.applyTheme(this.systemPreference);
                    }
                });
            }
        }

        loadUserPreference() {
            try {
                this.userPreference = localStorage.getItem('medianest-theme-preference') || 'auto';
            } catch (e) {
                this.userPreference = 'auto';
            }
        }

        saveUserPreference(preference) {
            try {
                localStorage.setItem('medianest-theme-preference', preference);
                this.userPreference = preference;
            } catch (e) {
                console.warn('MediaNest Theme: Could not save theme preference');
            }
        }

        setupThemeDetection() {
            // Monitor current theme
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-md-color-scheme') {
                        const newScheme = document.body.getAttribute('data-md-color-scheme');
                        if (newScheme !== this.currentScheme) {
                            this.onThemeChange(this.currentScheme, newScheme);
                            this.currentScheme = newScheme;
                        }
                    }
                });
            });

            observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['data-md-color-scheme']
            });

            // Set initial theme
            this.currentScheme = document.body.getAttribute('data-md-color-scheme');
        }

        enhanceThemeToggle() {
            // Find all theme toggle buttons
            const themeToggles = document.querySelectorAll('[data-md-color-scheme]');
            
            themeToggles.forEach(toggle => {
                this.enhanceToggleButton(toggle);
            });

            // Also enhance palette toggles in header
            const paletteToggles = document.querySelectorAll('.md-header__button[data-md-component="palette"]');
            paletteToggles.forEach(toggle => {
                toggle.addEventListener('click', () => {
                    setTimeout(() => this.onManualThemeChange(), 100);
                });
            });
        }

        enhanceToggleButton(button) {
            // Add enhanced accessibility
            const scheme = button.getAttribute('data-md-color-scheme');
            const schemeName = scheme === 'slate' ? 'dark' : 'light';
            
            button.setAttribute('aria-label', `Switch to ${schemeName} theme`);
            button.setAttribute('title', `Switch to ${schemeName} theme`);
            
            // Add keyboard support
            button.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    button.click();
                }
            });

            // Track manual theme changes
            button.addEventListener('click', () => {
                this.onManualThemeChange();
            });
        }

        onManualThemeChange() {
            // User manually changed theme, save preference
            setTimeout(() => {
                const newScheme = document.body.getAttribute('data-md-color-scheme');
                this.saveUserPreference(newScheme);
                this.announceThemeChange(`Theme manually changed to ${newScheme === 'slate' ? 'dark' : 'light'} mode`);
            }, 50);
        }

        addAdvancedThemeOptions() {
            // Create advanced theme selector (hidden by default)
            const themeSelector = document.createElement('div');
            themeSelector.className = 'medianest-theme-selector';
            themeSelector.innerHTML = `
                <div class="theme-selector-content">
                    <h4>Theme Preferences</h4>
                    <div class="theme-options">
                        <label>
                            <input type="radio" name="theme" value="auto" ${this.userPreference === 'auto' ? 'checked' : ''}>
                            <span class="theme-option">
                                <span class="theme-icon">🔄</span>
                                <span class="theme-label">Auto (Follow System)</span>
                            </span>
                        </label>
                        <label>
                            <input type="radio" name="theme" value="default" ${this.userPreference === 'default' ? 'checked' : ''}>
                            <span class="theme-option">
                                <span class="theme-icon">☀️</span>
                                <span class="theme-label">Light Mode</span>
                            </span>
                        </label>
                        <label>
                            <input type="radio" name="theme" value="slate" ${this.userPreference === 'slate' ? 'checked' : ''}>
                            <span class="theme-option">
                                <span class="theme-icon">🌙</span>
                                <span class="theme-label">Dark Mode</span>
                            </span>
                        </label>
                    </div>
                    <div class="theme-actions">
                        <button id="apply-theme">Apply</button>
                        <button id="close-theme-selector">Close</button>
                    </div>
                </div>
            `;

            // Style the selector
            this.styleThemeSelector(themeSelector);
            
            // Add to body (hidden initially)
            themeSelector.style.display = 'none';
            document.body.appendChild(themeSelector);

            // Add keyboard shortcut to open theme selector
            document.addEventListener('keydown', (e) => {
                if (e.altKey && e.key === 't') {
                    e.preventDefault();
                    this.toggleThemeSelector();
                }
            });

            this.setupThemeSelectorEvents(themeSelector);
        }

        styleThemeSelector(selector) {
            const style = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: var(--md-default-bg-color);
                border: 2px solid var(--md-primary-fg-color);
                border-radius: 12px;
                padding: 24px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                font-family: var(--md-text-font-family);
                min-width: 300px;
                backdrop-filter: blur(10px);
            `;
            selector.style.cssText = style;
        }

        setupThemeSelectorEvents(selector) {
            const applyButton = selector.querySelector('#apply-theme');
            const closeButton = selector.querySelector('#close-theme-selector');
            const radioInputs = selector.querySelectorAll('input[type="radio"]');

            applyButton.addEventListener('click', () => {
                const selected = selector.querySelector('input[type="radio"]:checked').value;
                this.applyThemePreference(selected);
                this.hideThemeSelector();
            });

            closeButton.addEventListener('click', () => {
                this.hideThemeSelector();
            });

            // Apply theme on radio change
            radioInputs.forEach(input => {
                input.addEventListener('change', () => {
                    if (input.checked) {
                        this.applyThemePreference(input.value);
                    }
                });
            });

            // Close on escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && selector.style.display !== 'none') {
                    this.hideThemeSelector();
                }
            });
        }

        applyThemePreference(preference) {
            this.saveUserPreference(preference);
            
            if (preference === 'auto') {
                this.applyTheme(this.systemPreference || 'default');
            } else {
                this.applyTheme(preference);
            }

            this.announceThemeChange(`Theme preference set to ${preference}`);
        }

        applyTheme(scheme) {
            document.body.setAttribute('data-md-color-scheme', scheme);
            
            // Update meta theme-color
            const metaTheme = document.querySelector('meta[name="theme-color"]');
            if (metaTheme) {
                metaTheme.content = scheme === 'slate' ? '#2d2d2d' : '#673ab7';
            }
        }

        toggleThemeSelector() {
            const selector = document.querySelector('.medianest-theme-selector');
            if (selector) {
                if (selector.style.display === 'none') {
                    this.showThemeSelector();
                } else {
                    this.hideThemeSelector();
                }
            }
        }

        showThemeSelector() {
            const selector = document.querySelector('.medianest-theme-selector');
            if (selector) {
                selector.style.display = 'block';
                
                // Focus first radio button
                const firstRadio = selector.querySelector('input[type="radio"]');
                if (firstRadio) {
                    firstRadio.focus();
                }

                // Add backdrop
                this.addBackdrop();
            }
        }

        hideThemeSelector() {
            const selector = document.querySelector('.medianest-theme-selector');
            if (selector) {
                selector.style.display = 'none';
                this.removeBackdrop();
            }
        }

        addBackdrop() {
            const backdrop = document.createElement('div');
            backdrop.className = 'medianest-theme-backdrop';
            backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9999;
                backdrop-filter: blur(4px);
            `;
            
            backdrop.addEventListener('click', () => {
                this.hideThemeSelector();
            });

            document.body.appendChild(backdrop);
        }

        removeBackdrop() {
            const backdrop = document.querySelector('.medianest-theme-backdrop');
            if (backdrop) {
                backdrop.remove();
            }
        }

        setupTransitions() {
            // Add smooth transitions for theme changes
            const style = document.createElement('style');
            style.textContent = `
                :root {
                    --theme-transition: color 0.3s ease, background-color 0.3s ease, border-color 0.3s ease;
                }
                
                *, *::before, *::after {
                    transition: var(--theme-transition);
                }
                
                .medianest-theme-selector {
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }
                
                .theme-options {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin: 16px 0;
                }
                
                .theme-options label {
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                }
                
                .theme-option {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border: 1px solid var(--md-default-fg-color--lighter);
                    border-radius: 8px;
                    transition: all 0.2s ease;
                    min-width: 200px;
                }
                
                .theme-options input:checked + .theme-option {
                    background: var(--md-primary-fg-color);
                    color: var(--md-primary-bg-color);
                    border-color: var(--md-primary-fg-color);
                }
                
                .theme-options input {
                    margin: 0;
                    margin-right: 8px;
                }
                
                .theme-icon {
                    font-size: 1.2em;
                }
                
                .theme-actions {
                    display: flex;
                    gap: 12px;
                    justify-content: flex-end;
                    margin-top: 16px;
                }
                
                .theme-actions button {
                    padding: 8px 16px;
                    border: 1px solid var(--md-primary-fg-color);
                    background: transparent;
                    color: var(--md-primary-fg-color);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .theme-actions button:hover {
                    background: var(--md-primary-fg-color);
                    color: var(--md-primary-bg-color);
                }
                
                #apply-theme {
                    background: var(--md-primary-fg-color);
                    color: var(--md-primary-bg-color);
                }
                
                @media (prefers-reduced-motion: reduce) {
                    *, *::before, *::after {
                        transition: none !important;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        onThemeChange(oldScheme, newScheme) {
            // Trigger custom events for other components
            const event = new CustomEvent('themechange', {
                detail: { oldScheme, newScheme }
            });
            document.dispatchEvent(event);

            // Update any theme-dependent components
            this.updateThemeComponents(newScheme);
        }

        updateThemeComponents(scheme) {
            // Update syntax highlighting if present
            const codeBlocks = document.querySelectorAll('.codehilite, .highlight');
            codeBlocks.forEach(block => {
                block.classList.toggle('dark-theme', scheme === 'slate');
            });

            // Update mermaid diagrams if present
            if (window.mermaid) {
                const theme = scheme === 'slate' ? 'dark' : 'default';
                mermaid.initialize({ theme });
            }
        }

        announceThemeChange(message) {
            // Announce to screen readers
            const announcement = document.getElementById('live-region') || document.createElement('div');
            if (!announcement.id) {
                announcement.id = 'live-region';
                announcement.setAttribute('aria-live', 'polite');
                announcement.className = 'sr-only';
                document.body.appendChild(announcement);
            }
            
            announcement.textContent = message;
            setTimeout(() => {
                announcement.textContent = '';
            }, 1000);

            // Console log for debugging
            console.log(`MediaNest Theme: ${message}`);
        }

        // Public API
        getCurrentTheme() {
            return this.currentScheme;
        }

        getUserPreference() {
            return this.userPreference;
        }

        getSystemPreference() {
            return this.systemPreference;
        }

        setTheme(scheme) {
            this.applyThemePreference(scheme);
        }
    }

    // Initialize theme switcher
    let themeSwitcher;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            themeSwitcher = new MediaNestThemeSwitcher();
        });
    } else {
        themeSwitcher = new MediaNestThemeSwitcher();
    }

    // Export for external use
    window.MediaNestTheme = {
        getCurrentTheme: () => themeSwitcher?.getCurrentTheme(),
        getUserPreference: () => themeSwitcher?.getUserPreference(),
        getSystemPreference: () => themeSwitcher?.getSystemPreference(),
        setTheme: (scheme) => themeSwitcher?.setTheme(scheme),
        toggleSelector: () => themeSwitcher?.toggleThemeSelector()
    };

})();