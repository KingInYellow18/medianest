/**
 * MediaNest Documentation - Enhanced JavaScript Features
 * Interactive enhancements for MkDocs Material theme
 */

(function () {
  'use strict';

  // Wait for DOM to be ready
  const ready = (fn) => {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  };

  // Enhanced search functionality
  class SearchEnhancer {
    constructor() {
      this.searchInput = null;
      this.searchResults = null;
      this.init();
    }

    init() {
      ready(() => {
        this.searchInput = document.querySelector('.md-search__input');
        this.searchResults = document.querySelector('.md-search-result');

        if (this.searchInput) {
          this.enhanceSearchInput();
          this.addSearchSuggestions();
        }
      });
    }

    enhanceSearchInput() {
      // Add search shortcuts
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          this.focusSearch();
        }
      });

      // Add search history
      this.loadSearchHistory();
      this.searchInput.addEventListener(
        'input',
        this.debounce((e) => {
          this.saveToSearchHistory(e.target.value);
        }, 500),
      );
    }

    focusSearch() {
      if (this.searchInput) {
        this.searchInput.focus();
        this.searchInput.select();
      }
    }

    addSearchSuggestions() {
      // Popular search terms for MediaNest
      const suggestions = [
        'API endpoints',
        'Docker setup',
        'Plex integration',
        'Database configuration',
        'Authentication',
        'Media management',
        'Performance optimization',
        'Security setup',
        'User management',
        'File organization',
      ];

      // Add suggestions to search (simplified implementation)
      if (this.searchInput) {
        this.searchInput.setAttribute('data-suggestions', JSON.stringify(suggestions));
      }
    }

    saveToSearchHistory(query) {
      if (query.length < 3) return;

      try {
        const history = JSON.parse(localStorage.getItem('medianest-search-history') || '[]');
        if (!history.includes(query)) {
          history.unshift(query);
          if (history.length > 10) history.pop();
          localStorage.setItem('medianest-search-history', JSON.stringify(history));
        }
      } catch (e) {
        console.warn('Could not save search history:', e);
      }
    }

    loadSearchHistory() {
      try {
        const history = JSON.parse(localStorage.getItem('medianest-search-history') || '[]');
        return history;
      } catch (e) {
        console.warn('Could not load search history:', e);
        return [];
      }
    }

    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  }

  // Theme preference manager
  class ThemeManager {
    constructor() {
      this.init();
    }

    init() {
      ready(() => {
        this.setupThemeToggle();
        this.applySystemTheme();
        this.watchSystemTheme();
      });
    }

    setupThemeToggle() {
      const toggles = document.querySelectorAll('[data-md-color-scheme]');
      toggles.forEach((toggle) => {
        toggle.addEventListener('click', () => {
          const scheme = toggle.getAttribute('data-md-color-scheme');
          this.setTheme(scheme);
          this.saveThemePreference(scheme);
        });
      });
    }

    setTheme(scheme) {
      document.body.setAttribute('data-md-color-scheme', scheme);
    }

    saveThemePreference(scheme) {
      try {
        localStorage.setItem('medianest-theme', scheme);
      } catch (e) {
        console.warn('Could not save theme preference:', e);
      }
    }

    loadThemePreference() {
      try {
        return localStorage.getItem('medianest-theme');
      } catch (e) {
        console.warn('Could not load theme preference:', e);
        return null;
      }
    }

    applySystemTheme() {
      const savedTheme = this.loadThemePreference();
      if (savedTheme) {
        this.setTheme(savedTheme);
        return;
      }

      // Apply system theme if no preference saved
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.setTheme('slate');
      } else {
        this.setTheme('default');
      }
    }

    watchSystemTheme() {
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addListener((e) => {
          if (!this.loadThemePreference()) {
            this.setTheme(e.matches ? 'slate' : 'default');
          }
        });
      }
    }
  }

  // Navigation enhancements
  class NavigationEnhancer {
    constructor() {
      this.init();
    }

    init() {
      ready(() => {
        this.setupSmoothScrolling();
        this.setupBackToTop();
        this.highlightActiveSection();
        this.setupMobileNavigation();
      });
    }

    setupSmoothScrolling() {
      // Enhanced smooth scrolling for anchor links
      document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', (e) => {
          const href = anchor.getAttribute('href');
          if (href === '#') return;

          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });

            // Update URL without triggering scroll
            history.pushState(null, null, href);
          }
        });
      });
    }

    setupBackToTop() {
      const backToTop = document.createElement('button');
      backToTop.className = 'md-top';
      backToTop.innerHTML = '↑';
      backToTop.setAttribute('aria-label', 'Back to top');
      backToTop.style.cssText = `
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                width: 3rem;
                height: 3rem;
                border-radius: 50%;
                background: var(--md-primary-fg-color);
                color: var(--md-primary-bg-color);
                border: none;
                font-size: 1.2rem;
                cursor: pointer;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
                z-index: 100;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            `;

      document.body.appendChild(backToTop);

      // Show/hide based on scroll position
      window.addEventListener('scroll', () => {
        if (window.pageYOffset > 100) {
          backToTop.style.opacity = '1';
          backToTop.style.visibility = 'visible';
        } else {
          backToTop.style.opacity = '0';
          backToTop.style.visibility = 'hidden';
        }
      });

      backToTop.addEventListener('click', () => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      });
    }

    highlightActiveSection() {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const id = entry.target.getAttribute('id');
              if (id) {
                // Update active nav link
                document.querySelectorAll('.md-nav__link--active').forEach((link) => {
                  link.classList.remove('md-nav__link--active');
                });

                const activeLink = document.querySelector(`a[href="#${id}"]`);
                if (activeLink) {
                  activeLink.classList.add('md-nav__link--active');
                }
              }
            }
          });
        },
        {
          rootMargin: '-20% 0px -70% 0px',
        },
      );

      // Observe all headings
      document
        .querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
        .forEach((heading) => {
          observer.observe(heading);
        });
    }

    setupMobileNavigation() {
      const drawer = document.querySelector('.md-sidebar--primary');
      if (drawer) {
        // Close drawer when clicking outside
        document.addEventListener('click', (e) => {
          if (!drawer.contains(e.target) && !e.target.closest('[for="__drawer"]')) {
            const checkbox = document.querySelector('#__drawer');
            if (checkbox && checkbox.checked) {
              checkbox.checked = false;
            }
          }
        });
      }
    }
  }

  // Interactive features for API documentation
  class APIEnhancer {
    constructor() {
      this.init();
    }

    init() {
      ready(() => {
        this.setupCodeCopyButtons();
        this.setupTryItButtons();
        this.setupCodeExamples();
      });
    }

    setupCodeCopyButtons() {
      const codeBlocks = document.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        const button = document.createElement('button');
        button.className = 'md-code__copy md-icon';
        button.innerHTML = '📋';
        button.setAttribute('aria-label', 'Copy code');
        button.style.cssText = `
                    position: absolute;
                    top: 0.5rem;
                    right: 0.5rem;
                    padding: 0.25rem;
                    background: rgba(0,0,0,0.1);
                    border: none;
                    border-radius: 0.25rem;
                    cursor: pointer;
                    opacity: 0.7;
                    transition: opacity 0.2s;
                `;

        const pre = block.closest('pre');
        if (pre) {
          pre.style.position = 'relative';
          pre.appendChild(button);
        }

        button.addEventListener('click', () => {
          this.copyToClipboard(block.textContent);
          button.innerHTML = '✅';
          setTimeout(() => {
            button.innerHTML = '📋';
          }, 2000);
        });

        button.addEventListener('mouseover', () => {
          button.style.opacity = '1';
        });

        button.addEventListener('mouseout', () => {
          button.style.opacity = '0.7';
        });
      });
    }

    setupTryItButtons() {
      // Add "Try it" buttons to API endpoint examples
      const apiEndpoints = document.querySelectorAll(
        '.highlight .language-http, .highlight .language-bash',
      );
      apiEndpoints.forEach((block) => {
        const content = block.textContent;
        if (content.includes('curl') || content.includes('GET ') || content.includes('POST ')) {
          const button = document.createElement('button');
          button.className = 'md-button md-button--primary';
          button.textContent = 'Try it';
          button.style.cssText = `
                        margin-top: 0.5rem;
                        font-size: 0.8rem;
                        padding: 0.3rem 0.6rem;
                    `;

          button.addEventListener('click', () => {
            this.openInAPIExplorer(content);
          });

          const pre = block.closest('pre');
          if (pre && pre.parentNode) {
            pre.parentNode.insertBefore(button, pre.nextSibling);
          }
        }
      });
    }

    setupCodeExamples() {
      // Enhanced code examples with language switching
      const codeGroups = document.querySelectorAll('.tabbed-set');
      codeGroups.forEach((group) => {
        const tabs = group.querySelectorAll('.tabbed-labels label');
        tabs.forEach((tab) => {
          tab.addEventListener('click', () => {
            // Save preferred language
            const language = tab.textContent.toLowerCase().trim();
            this.saveLanguagePreference(language);
          });
        });
      });
    }

    copyToClipboard(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch((err) => {
          console.warn('Could not copy text: ', err);
          this.fallbackCopyTextToClipboard(text);
        });
      } else {
        this.fallbackCopyTextToClipboard(text);
      }
    }

    fallbackCopyTextToClipboard(text) {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.cssText =
        'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
      } catch (err) {
        console.warn('Fallback copy failed: ', err);
      }

      document.body.removeChild(textArea);
    }

    openInAPIExplorer(content) {
      // This would integrate with an API explorer if available
      console.log('Opening API explorer with:', content);
      // For now, just show an alert
      alert('API Explorer integration would open here');
    }

    saveLanguagePreference(language) {
      try {
        localStorage.setItem('medianest-preferred-language', language);
      } catch (e) {
        console.warn('Could not save language preference:', e);
      }
    }
  }

  // Performance monitoring
  class PerformanceMonitor {
    constructor() {
      this.init();
    }

    init() {
      if ('performance' in window) {
        this.trackPageLoad();
        this.trackUserEngagement();
      }
    }

    trackPageLoad() {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const perfData = performance.getEntriesByType('navigation')[0];
          if (perfData) {
            console.log('Page load performance:', {
              loadTime: perfData.loadEventEnd - perfData.loadEventStart,
              domContentLoaded:
                perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
              firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || null,
              firstContentfulPaint:
                performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null,
            });
          }
        }, 100);
      });
    }

    trackUserEngagement() {
      let startTime = Date.now();
      let engaged = true;

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          engaged = false;
        } else {
          engaged = true;
          startTime = Date.now();
        }
      });

      window.addEventListener('beforeunload', () => {
        if (engaged) {
          const timeSpent = Date.now() - startTime;
          console.log('Time spent on page:', timeSpent / 1000, 'seconds');
        }
      });
    }
  }

  // Accessibility enhancements
  class AccessibilityEnhancer {
    constructor() {
      this.init();
    }

    init() {
      ready(() => {
        this.setupKeyboardNavigation();
        this.setupScreenReaderSupport();
        this.setupFocusManagement();
      });
    }

    setupKeyboardNavigation() {
      // Enhanced keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          document.body.classList.add('keyboard-navigation');
        }
      });

      document.addEventListener('mousedown', () => {
        document.body.classList.remove('keyboard-navigation');
      });

      // Add visible focus indicators when using keyboard
      const style = document.createElement('style');
      style.textContent = `
                .keyboard-navigation *:focus {
                    outline: 2px solid var(--md-accent-fg-color) !important;
                    outline-offset: 2px !important;
                }
            `;
      document.head.appendChild(style);
    }

    setupScreenReaderSupport() {
      // Add skip links
      const skipLink = document.createElement('a');
      skipLink.href = '#main';
      skipLink.className = 'md-skip';
      skipLink.textContent = 'Skip to main content';
      document.body.insertBefore(skipLink, document.body.firstChild);

      // Enhance table accessibility
      document.querySelectorAll('table').forEach((table) => {
        if (!table.querySelector('caption')) {
          const caption = document.createElement('caption');
          caption.textContent = 'Data table';
          caption.style.clip = 'rect(0 0 0 0)';
          caption.style.clipPath = 'inset(50%)';
          caption.style.height = '1px';
          caption.style.overflow = 'hidden';
          caption.style.position = 'absolute';
          caption.style.whiteSpace = 'nowrap';
          caption.style.width = '1px';
          table.insertBefore(caption, table.firstChild);
        }
      });
    }

    setupFocusManagement() {
      // Manage focus for dynamic content
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Auto-focus first interactive element in new content
                const firstFocusable = node.querySelector(
                  'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])',
                );
                if (firstFocusable && document.body.classList.contains('keyboard-navigation')) {
                  firstFocusable.focus();
                }
              }
            });
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  // Initialize all enhancements
  const searchEnhancer = new SearchEnhancer();
  const themeManager = new ThemeManager();
  const navigationEnhancer = new NavigationEnhancer();
  const apiEnhancer = new APIEnhancer();
  const performanceMonitor = new PerformanceMonitor();
  const accessibilityEnhancer = new AccessibilityEnhancer();

  // Global utilities
  window.MediaNestDocs = {
    searchEnhancer,
    themeManager,
    navigationEnhancer,
    apiEnhancer,
    performanceMonitor,
    accessibilityEnhancer,

    // Utility functions
    utils: {
      debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
          const later = () => {
            clearTimeout(timeout);
            func(...args);
          };
          clearTimeout(timeout);
          timeout = setTimeout(later, wait);
        };
      },

      throttle: (func, limit) => {
        let inThrottle;
        return function () {
          const args = arguments;
          const context = this;
          if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
          }
        };
      },
    },
  };
})();
