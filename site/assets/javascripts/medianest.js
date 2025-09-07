/**
 * MediaNest Documentation - Enhanced JavaScript Functionality
 * Provides interactive features, animations, and user experience improvements
 */

(function(window, document) {
  'use strict';

  // Namespace for MediaNest documentation features
  window.MediaNest = window.MediaNest || {};

  /**
   * Configuration and constants
   */
  const config = {
    animationDuration: 300,
    scrollThreshold: 100,
    debounceDelay: 150,
    storage: {
      prefix: 'medianest_docs_',
      theme: 'theme_preference',
      lastVisited: 'last_visited_page',
      readingProgress: 'reading_progress'
    }
  };

  /**
   * Utility functions
   */
  const utils = {
    // Debounce function for performance
    debounce: function(func, delay) {
      let timeoutId;
      return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
      };
    },

    // Throttle function for scroll events
    throttle: function(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    // Check if element is in viewport
    isInViewport: function(element, threshold = 0) {
      const rect = element.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;
      
      return (
        rect.top <= windowHeight - threshold &&
        rect.bottom >= threshold &&
        rect.left <= windowWidth - threshold &&
        rect.right >= threshold
      );
    },

    // Smooth scroll to element
    scrollToElement: function(element, offset = 0) {
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      });
    },

    // Local storage wrapper with error handling
    storage: {
      set: function(key, value) {
        try {
          localStorage.setItem(config.storage.prefix + key, JSON.stringify(value));
        } catch (e) {
          console.warn('Failed to save to localStorage:', e);
        }
      },
      get: function(key) {
        try {
          const item = localStorage.getItem(config.storage.prefix + key);
          return item ? JSON.parse(item) : null;
        } catch (e) {
          console.warn('Failed to read from localStorage:', e);
          return null;
        }
      },
      remove: function(key) {
        try {
          localStorage.removeItem(config.storage.prefix + key);
        } catch (e) {
          console.warn('Failed to remove from localStorage:', e);
        }
      }
    }
  };

  /**
   * Theme management
   */
  const themeManager = {
    init: function() {
      this.bindEvents();
      this.loadPreference();
    },

    bindEvents: function() {
      // Listen for theme toggle clicks
      const toggles = document.querySelectorAll('[data-md-color-scheme]');
      toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
          setTimeout(() => this.savePreference(), 100);
        });
      });
    },

    savePreference: function() {
      const currentScheme = document.querySelector('[data-md-color-scheme]')?.getAttribute('data-md-color-scheme');
      if (currentScheme) {
        utils.storage.set(config.storage.theme, currentScheme);
      }
    },

    loadPreference: function() {
      const savedTheme = utils.storage.get(config.storage.theme);
      if (savedTheme) {
        const themeToggle = document.querySelector(`[data-md-color-scheme="${savedTheme}"]`);
        if (themeToggle && !themeToggle.checked) {
          themeToggle.click();
        }
      }
    }
  };

  /**
   * Scroll reveal animations
   */
  const scrollReveal = {
    elements: [],
    
    init: function() {
      this.findElements();
      this.bindEvents();
      this.checkElements();
    },

    findElements: function() {
      this.elements = Array.from(document.querySelectorAll('.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .feature-card'));
    },

    bindEvents: function() {
      window.addEventListener('scroll', utils.throttle(() => {
        this.checkElements();
      }, 16)); // ~60fps
    },

    checkElements: function() {
      this.elements.forEach(element => {
        if (utils.isInViewport(element, 100)) {
          element.classList.add('revealed');
        }
      });
    }
  };

  /**
   * Reading progress indicator
   */
  const readingProgress = {
    progressBar: null,
    
    init: function() {
      this.createProgressBar();
      this.bindEvents();
      this.loadProgress();
    },

    createProgressBar: function() {
      this.progressBar = document.createElement('div');
      this.progressBar.className = 'reading-progress-bar';
      this.progressBar.innerHTML = '<div class="reading-progress-fill"></div>';
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .reading-progress-bar {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: rgba(103, 58, 183, 0.1);
          z-index: 1000;
          pointer-events: none;
        }
        .reading-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #673ab7, #9c27b0);
          width: 0%;
          transition: width 0.1s ease;
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(this.progressBar);
    },

    bindEvents: function() {
      window.addEventListener('scroll', utils.throttle(() => {
        this.updateProgress();
      }, 16));
      
      // Save progress when leaving page
      window.addEventListener('beforeunload', () => {
        this.saveProgress();
      });
    },

    updateProgress: function() {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = Math.min((scrollTop / scrollHeight) * 100, 100);
      
      const fill = this.progressBar.querySelector('.reading-progress-fill');
      fill.style.width = progress + '%';
    },

    saveProgress: function() {
      const progress = this.progressBar.querySelector('.reading-progress-fill').style.width;
      utils.storage.set(config.storage.readingProgress, {
        url: window.location.pathname,
        progress: progress,
        timestamp: Date.now()
      });
    },

    loadProgress: function() {
      const saved = utils.storage.get(config.storage.readingProgress);
      if (saved && saved.url === window.location.pathname) {
        // Auto-scroll to saved position if recent (within 24 hours)
        const isRecent = (Date.now() - saved.timestamp) < 24 * 60 * 60 * 1000;
        if (isRecent && parseFloat(saved.progress) > 10) {
          setTimeout(() => {
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const targetScroll = (parseFloat(saved.progress) / 100) * scrollHeight;
            window.scrollTo({ top: targetScroll, behavior: 'smooth' });
          }, 500);
        }
      }
    }
  };

  /**
   * Enhanced search functionality
   */
  const searchEnhancer = {
    searchInput: null,
    suggestions: [],
    
    init: function() {
      this.findSearchInput();
      if (this.searchInput) {
        this.enhanceSearch();
        this.addKeyboardShortcuts();
      }
    },

    findSearchInput: function() {
      // Try different selectors for MkDocs Material search
      const selectors = [
        '[data-md-component="search-query"]',
        '.md-search__input',
        'input[type="search"]'
      ];
      
      for (const selector of selectors) {
        this.searchInput = document.querySelector(selector);
        if (this.searchInput) break;
      }
    },

    enhanceSearch: function() {
      // Add search suggestions and recent searches
      this.searchInput.addEventListener('focus', () => {
        this.showRecentSearches();
      });

      this.searchInput.addEventListener('input', utils.debounce((e) => {
        this.handleSearch(e.target.value);
      }, config.debounceDelay));
    },

    addKeyboardShortcuts: function() {
      document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          this.searchInput.focus();
        }
        
        // Escape to close search
        if (e.key === 'Escape' && document.activeElement === this.searchInput) {
          this.searchInput.blur();
        }
      });
    },

    handleSearch: function(query) {
      if (query.length > 2) {
        this.saveRecentSearch(query);
      }
    },

    saveRecentSearch: function(query) {
      let recent = utils.storage.get('recent_searches') || [];
      recent = recent.filter(item => item !== query);
      recent.unshift(query);
      recent = recent.slice(0, 5); // Keep only last 5
      utils.storage.set('recent_searches', recent);
    },

    showRecentSearches: function() {
      const recent = utils.storage.get('recent_searches');
      if (recent && recent.length > 0) {
        // Implementation would depend on MkDocs Material's search interface
        console.log('Recent searches:', recent);
      }
    }
  };

  /**
   * Code block enhancements
   */
  const codeBlockEnhancer = {
    init: function() {
      this.enhanceCodeBlocks();
      this.addCopyButtons();
    },

    enhanceCodeBlocks: function() {
      const codeBlocks = document.querySelectorAll('pre code');
      codeBlocks.forEach((block, index) => {
        // Add line numbers if not present
        if (!block.classList.contains('has-line-numbers')) {
          this.addLineNumbers(block);
        }
        
        // Add language labels
        this.addLanguageLabel(block);
        
        // Add expand/collapse for long code blocks
        if (block.textContent.split('\n').length > 20) {
          this.addExpandCollapse(block);
        }
      });
    },

    addCopyButtons: function() {
      const codeBlocks = document.querySelectorAll('pre');
      codeBlocks.forEach(pre => {
        if (pre.querySelector('.copy-button')) return; // Already has copy button
        
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
          </svg>
        `;
        button.title = 'Copy to clipboard';
        
        button.addEventListener('click', () => {
          this.copyToClipboard(pre.querySelector('code').textContent, button);
        });
        
        pre.style.position = 'relative';
        pre.appendChild(button);
      });
      
      // Add CSS for copy buttons
      this.addCopyButtonStyles();
    },

    addCopyButtonStyles: function() {
      const style = document.createElement('style');
      style.textContent = `
        .copy-button {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          opacity: 0;
          transition: all 0.2s ease;
          z-index: 1;
        }
        pre:hover .copy-button {
          opacity: 1;
        }
        .copy-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .copy-button.copied {
          background: #4caf50;
        }
        .copy-button.copied svg {
          display: none;
        }
        .copy-button.copied::after {
          content: '✓';
          font-weight: bold;
        }
      `;
      document.head.appendChild(style);
    },

    copyToClipboard: function(text, button) {
      navigator.clipboard.writeText(text).then(() => {
        button.classList.add('copied');
        button.title = 'Copied!';
        setTimeout(() => {
          button.classList.remove('copied');
          button.title = 'Copy to clipboard';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    },

    addLineNumbers: function(block) {
      const lines = block.textContent.split('\n');
      if (lines.length > 5) {
        block.classList.add('has-line-numbers');
        // Implementation would depend on the specific highlighting library
      }
    },

    addLanguageLabel: function(block) {
      const language = this.detectLanguage(block);
      if (language) {
        const label = document.createElement('div');
        label.className = 'code-language-label';
        label.textContent = language;
        block.parentElement.insertBefore(label, block);
      }
    },

    detectLanguage: function(block) {
      const classes = block.className.split(' ');
      for (const cls of classes) {
        if (cls.startsWith('language-')) {
          return cls.replace('language-', '');
        }
        if (cls.startsWith('hljs-')) {
          return cls.replace('hljs-', '');
        }
      }
      return null;
    },

    addExpandCollapse: function(block) {
      const pre = block.parentElement;
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-expandable';
      
      const toggle = document.createElement('button');
      toggle.className = 'code-expand-toggle';
      toggle.textContent = 'Show more';
      
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);
      wrapper.appendChild(toggle);
      
      pre.classList.add('collapsed');
      
      toggle.addEventListener('click', () => {
        pre.classList.toggle('collapsed');
        toggle.textContent = pre.classList.contains('collapsed') ? 'Show more' : 'Show less';
      });
    }
  };

  /**
   * Navigation enhancements
   */
  const navigationEnhancer = {
    init: function() {
      this.addBreadcrumbs();
      this.enhanceTableOfContents();
      this.addNavigationShortcuts();
    },

    addBreadcrumbs: function() {
      const breadcrumbContainer = document.querySelector('.md-content');
      if (!breadcrumbContainer || document.querySelector('.breadcrumbs')) return;
      
      const path = window.location.pathname.split('/').filter(Boolean);
      if (path.length <= 2) return; // Don't show for root or single-level pages
      
      const breadcrumbs = document.createElement('nav');
      breadcrumbs.className = 'breadcrumbs';
      breadcrumbs.innerHTML = this.generateBreadcrumbHTML(path);
      
      breadcrumbContainer.insertBefore(breadcrumbs, breadcrumbContainer.firstChild);
    },

    generateBreadcrumbHTML: function(pathArray) {
      let html = '<ol class="breadcrumb-list">';
      let currentPath = '';
      
      pathArray.forEach((segment, index) => {
        currentPath += '/' + segment;
        const isLast = index === pathArray.length - 1;
        const displayName = segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        if (isLast) {
          html += `<li class="breadcrumb-item active">${displayName}</li>`;
        } else {
          html += `<li class="breadcrumb-item"><a href="${currentPath}/">${displayName}</a></li>`;
        }
      });
      
      html += '</ol>';
      return html;
    },

    enhanceTableOfContents: function() {
      const toc = document.querySelector('.md-nav--secondary');
      if (!toc) return;
      
      // Add smooth scrolling to TOC links
      const tocLinks = toc.querySelectorAll('a[href^="#"]');
      tocLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = document.querySelector(link.getAttribute('href'));
          if (target) {
            utils.scrollToElement(target, 80);
          }
        });
      });
      
      // Highlight current section in TOC
      this.highlightCurrentSection(tocLinks);
    },

    highlightCurrentSection: function(tocLinks) {
      const sections = Array.from(tocLinks).map(link => {
        const href = link.getAttribute('href');
        return document.querySelector(href);
      }).filter(Boolean);
      
      const updateHighlight = utils.throttle(() => {
        let currentSection = null;
        const scrollPosition = window.pageYOffset + 100;
        
        for (const section of sections) {
          if (section.offsetTop <= scrollPosition) {
            currentSection = section;
          }
        }
        
        tocLinks.forEach((link, index) => {
          const isActive = currentSection === sections[index];
          link.classList.toggle('current', isActive);
          if (isActive) {
            link.parentElement.classList.add('current');
          } else {
            link.parentElement.classList.remove('current');
          }
        });
      }, 16);
      
      window.addEventListener('scroll', updateHighlight);
      updateHighlight(); // Initial call
    },

    addNavigationShortcuts: function() {
      document.addEventListener('keydown', (e) => {
        // Alt + Left Arrow - Previous page
        if (e.altKey && e.key === 'ArrowLeft') {
          const prevLink = document.querySelector('a[title="Previous"]');
          if (prevLink) {
            prevLink.click();
          }
        }
        
        // Alt + Right Arrow - Next page
        if (e.altKey && e.key === 'ArrowRight') {
          const nextLink = document.querySelector('a[title="Next"]');
          if (nextLink) {
            nextLink.click();
          }
        }
      });
    }
  };

  /**
   * Performance monitoring
   */
  const performanceMonitor = {
    init: function() {
      this.trackPageLoad();
      this.trackInteractions();
    },

    trackPageLoad: function() {
      window.addEventListener('load', () => {
        const loadTime = performance.now();
        console.log(`MediaNest Docs loaded in ${loadTime.toFixed(2)}ms`);
        
        // Track to analytics if available
        if (typeof gtag !== 'undefined') {
          gtag('event', 'page_load_time', {
            value: Math.round(loadTime),
            custom_parameter: 'docs_performance'
          });
        }
      });
    },

    trackInteractions: function() {
      // Track copy button usage
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-button')) {
          if (typeof gtag !== 'undefined') {
            gtag('event', 'code_copy', {
              event_category: 'engagement',
              event_label: 'documentation'
            });
          }
        }
      });
    }
  };

  /**
   * Page analytics and insights
   */
  const analytics = {
    init: function() {
      this.trackPageVisit();
      this.trackScrollDepth();
      this.trackTimeOnPage();
    },

    trackPageVisit: function() {
      const currentPage = window.location.pathname;
      const lastVisited = utils.storage.get(config.storage.lastVisited);
      
      utils.storage.set(config.storage.lastVisited, {
        page: currentPage,
        timestamp: Date.now(),
        referrer: document.referrer
      });
      
      // Track returning visitors
      if (lastVisited && typeof gtag !== 'undefined') {
        const daysSinceLastVisit = (Date.now() - lastVisited.timestamp) / (1000 * 60 * 60 * 24);
        gtag('event', 'returning_visitor', {
          value: Math.round(daysSinceLastVisit),
          custom_parameter: 'days_since_last_visit'
        });
      }
    },

    trackScrollDepth: function() {
      const milestones = [25, 50, 75, 100];
      const tracked = new Set();
      
      const trackScroll = utils.throttle(() => {
        const scrollPercent = Math.round(
          (window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        
        milestones.forEach(milestone => {
          if (scrollPercent >= milestone && !tracked.has(milestone)) {
            tracked.add(milestone);
            if (typeof gtag !== 'undefined') {
              gtag('event', 'scroll_depth', {
                value: milestone,
                custom_parameter: 'percentage'
              });
            }
          }
        });
      }, 1000);
      
      window.addEventListener('scroll', trackScroll);
    },

    trackTimeOnPage: function() {
      const startTime = Date.now();
      
      // Track time when leaving page
      window.addEventListener('beforeunload', () => {
        const timeOnPage = Math.round((Date.now() - startTime) / 1000);
        if (typeof gtag !== 'undefined' && timeOnPage > 5) {
          gtag('event', 'time_on_page', {
            value: timeOnPage,
            custom_parameter: 'seconds'
          });
        }
      });
    }
  };

  /**
   * Initialize all features when DOM is ready
   */
  function initialize() {
    // Core features
    themeManager.init();
    scrollReveal.init();
    readingProgress.init();
    
    // Enhancement features
    searchEnhancer.init();
    codeBlockEnhancer.init();
    navigationEnhancer.init();
    
    // Analytics and performance
    performanceMonitor.init();
    analytics.init();
    
    console.log('MediaNest Documentation features initialized');
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Expose utilities for external use
  window.MediaNest.utils = utils;
  window.MediaNest.init = initialize;

})(window, document);