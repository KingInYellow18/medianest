/**
 * MediaNest Documentation - Advanced Analytics & User Insights
 * Comprehensive analytics tracking for documentation usage and user behavior
 */

(function(window, document) {
  'use strict';

  window.MediaNest = window.MediaNest || {};
  window.MediaNest.Analytics = {

    // Configuration
    config: {
      trackingId: null, // Will be set from environment
      apiEndpoint: '/api/analytics', // Custom analytics endpoint if needed
      storagePrefix: 'medianest_analytics_',
      batchSize: 10,
      flushInterval: 30000, // 30 seconds
      sessionTimeout: 1800000 // 30 minutes
    },

    // Session data
    session: {
      id: null,
      startTime: null,
      pageViews: 0,
      interactions: 0,
      scrollDepth: 0,
      timeOnPage: 0
    },

    // Event queue for batching
    eventQueue: [],
    
    // Performance metrics
    performance: {
      loadTime: 0,
      firstContentfulPaint: 0,
      largestContentfulPaint: 0,
      cumulativeLayoutShift: 0,
      firstInputDelay: 0
    },

    // User behavior tracking
    behavior: {
      clicks: {},
      hovers: {},
      scrollPattern: [],
      exitIntent: false,
      returnVisitor: false
    },

    /**
     * Initialize analytics system
     */
    init: function() {
      this.setupSession();
      this.setupEventTracking();
      this.setupPerformanceTracking();
      this.setupUserBehaviorTracking();
      this.setupHeatmapTracking();
      this.setupCustomEvents();
      this.startSessionTimer();
      
      console.log('MediaNest Analytics initialized');
    },

    /**
     * Setup session tracking
     */
    setupSession: function() {
      this.session.id = this.generateSessionId();
      this.session.startTime = Date.now();
      
      // Check if returning visitor
      const lastVisit = this.getStorageItem('last_visit');
      this.behavior.returnVisitor = !!lastVisit;
      
      // Store current visit
      this.setStorageItem('last_visit', Date.now());
      
      // Track session start
      this.trackEvent('session_start', {
        session_id: this.session.id,
        return_visitor: this.behavior.returnVisitor,
        referrer: document.referrer,
        user_agent: navigator.userAgent,
        screen_resolution: `${screen.width}x${screen.height}`,
        viewport_size: `${window.innerWidth}x${window.innerHeight}`
      });
    },

    /**
     * Setup event tracking
     */
    setupEventTracking: function() {
      // Page view tracking
      this.trackPageView();
      
      // Navigation tracking
      this.trackNavigation();
      
      // Link click tracking
      this.trackLinkClicks();
      
      // Form interaction tracking
      this.trackFormInteractions();
      
      // Error tracking
      this.trackErrors();
      
      // Visibility tracking
      this.trackVisibilityChanges();
    },

    /**
     * Setup performance tracking
     */
    setupPerformanceTracking: function() {
      // Track page load metrics
      window.addEventListener('load', () => {
        this.collectPerformanceMetrics();
      });

      // Track Core Web Vitals
      this.trackCoreWebVitals();
      
      // Track resource loading
      this.trackResourceLoading();
    },

    /**
     * Setup user behavior tracking
     */
    setupUserBehaviorTracking: function() {
      // Scroll tracking
      this.trackScrollBehavior();
      
      // Mouse movement tracking (sampled)
      this.trackMouseMovement();
      
      // Keyboard interaction tracking
      this.trackKeyboardInteractions();
      
      // Exit intent tracking
      this.trackExitIntent();
      
      // Time on page tracking
      this.trackTimeOnPage();
    },

    /**
     * Setup heatmap tracking
     */
    setupHeatmapTracking: function() {
      // Click heatmap
      document.addEventListener('click', (e) => {
        const rect = e.target.getBoundingClientRect();
        const clickData = {
          x: rect.left + e.offsetX,
          y: rect.top + e.offsetY,
          element: e.target.tagName.toLowerCase(),
          class: e.target.className,
          timestamp: Date.now()
        };
        
        this.trackEvent('heatmap_click', clickData);
      });

      // Hover tracking (throttled)
      let hoverTimeout;
      document.addEventListener('mouseover', (e) => {
        clearTimeout(hoverTimeout);
        hoverTimeout = setTimeout(() => {
          if (e.target.tagName === 'A' || e.target.classList.contains('md-nav__link')) {
            this.trackEvent('element_hover', {
              element: e.target.tagName.toLowerCase(),
              class: e.target.className,
              text: e.target.textContent.slice(0, 50),
              href: e.target.href
            });
          }
        }, 1000);
      });
    },

    /**
     * Setup custom MediaNest-specific events
     */
    setupCustomEvents: function() {
      // Documentation-specific tracking
      this.trackDocumentationUsage();
      
      // Search tracking (enhanced)
      this.trackSearchBehavior();
      
      // Code interaction tracking
      this.trackCodeInteractions();
      
      // Download tracking
      this.trackDownloads();
      
      // External link tracking
      this.trackExternalLinks();
    },

    /**
     * Track page view
     */
    trackPageView: function() {
      this.session.pageViews++;
      
      const pageData = {
        page_title: document.title,
        page_url: window.location.href,
        page_path: window.location.pathname,
        page_referrer: document.referrer,
        page_view_number: this.session.pageViews,
        session_id: this.session.id
      };

      this.trackEvent('page_view', pageData);
    },

    /**
     * Track navigation patterns
     */
    trackNavigation: function() {
      // Track navigation clicks
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
          const isInternal = link.href.includes(window.location.origin);
          const navSection = this.getNavigationSection(link);
          
          this.trackEvent('navigation_click', {
            link_text: link.textContent.trim(),
            link_url: link.href,
            link_type: isInternal ? 'internal' : 'external',
            nav_section: navSection,
            current_page: window.location.pathname
          });
        }
      });

      // Track back/forward navigation
      window.addEventListener('popstate', () => {
        this.trackEvent('browser_navigation', {
          type: 'popstate',
          url: window.location.href,
          session_id: this.session.id
        });
      });
    },

    /**
     * Get navigation section for link
     */
    getNavigationSection: function(link) {
      const nav = link.closest('.md-nav');
      if (nav) {
        const title = nav.querySelector('.md-nav__title');
        return title ? title.textContent.trim() : 'unknown';
      }
      
      if (link.closest('.md-tabs')) return 'main_tabs';
      if (link.closest('.md-header')) return 'header';
      if (link.closest('.md-footer')) return 'footer';
      
      return 'content';
    },

    /**
     * Track link clicks with enhanced data
     */
    trackLinkClicks: function() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
          const linkData = {
            link_text: link.textContent.trim(),
            link_url: link.href,
            link_target: link.target,
            is_external: !link.href.includes(window.location.origin),
            position_x: e.clientX,
            position_y: e.clientY,
            timestamp: Date.now()
          };
          
          this.trackEvent('link_click', linkData);
        }
      });
    },

    /**
     * Track form interactions
     */
    trackFormInteractions: function() {
      // Search form tracking
      const searchForms = document.querySelectorAll('form[role="search"], .md-search__form');
      searchForms.forEach(form => {
        const input = form.querySelector('input[type="search"]');
        if (input) {
          let searchStartTime;
          
          input.addEventListener('focus', () => {
            searchStartTime = Date.now();
            this.trackEvent('search_focus');
          });
          
          input.addEventListener('input', (e) => {
            if (e.target.value.length >= 3) {
              this.trackEvent('search_query', {
                query_length: e.target.value.length,
                query_hash: this.hashString(e.target.value), // Hash for privacy
                time_since_focus: searchStartTime ? Date.now() - searchStartTime : 0
              });
            }
          });
          
          form.addEventListener('submit', (e) => {
            this.trackEvent('search_submit', {
              query_length: input.value.length,
              query_hash: this.hashString(input.value),
              search_duration: searchStartTime ? Date.now() - searchStartTime : 0
            });
          });
        }
      });
    },

    /**
     * Track JavaScript errors
     */
    trackErrors: function() {
      window.addEventListener('error', (e) => {
        this.trackEvent('javascript_error', {
          message: e.message,
          filename: e.filename,
          line: e.lineno,
          column: e.colno,
          stack: e.error ? e.error.stack : null,
          user_agent: navigator.userAgent
        });
      });

      window.addEventListener('unhandledrejection', (e) => {
        this.trackEvent('promise_rejection', {
          reason: e.reason ? e.reason.toString() : 'Unknown',
          stack: e.reason && e.reason.stack ? e.reason.stack : null
        });
      });
    },

    /**
     * Track visibility changes
     */
    trackVisibilityChanges: function() {
      document.addEventListener('visibilitychange', () => {
        this.trackEvent('visibility_change', {
          visibility_state: document.visibilityState,
          hidden: document.hidden,
          session_id: this.session.id
        });
      });
    },

    /**
     * Collect performance metrics
     */
    collectPerformanceMetrics: function() {
      if ('performance' in window) {
        const perfData = performance.getEntriesByType('navigation')[0];
        
        if (perfData) {
          this.performance.loadTime = perfData.loadEventEnd - perfData.fetchStart;
          
          this.trackEvent('page_performance', {
            load_time: this.performance.loadTime,
            dom_content_loaded: perfData.domContentLoadedEventEnd - perfData.fetchStart,
            first_byte: perfData.responseStart - perfData.fetchStart,
            dns_lookup: perfData.domainLookupEnd - perfData.domainLookupStart,
            tcp_connection: perfData.connectEnd - perfData.connectStart,
            server_response: perfData.responseEnd - perfData.responseStart
          });
        }
      }
    },

    /**
     * Track Core Web Vitals
     */
    trackCoreWebVitals: function() {
      // First Contentful Paint
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.name === 'first-contentful-paint') {
                this.performance.firstContentfulPaint = entry.startTime;
                this.trackEvent('core_web_vitals', {
                  metric: 'first_contentful_paint',
                  value: entry.startTime
                });
              }
            }
          });
          observer.observe({ entryTypes: ['paint'] });
        } catch (e) {
          console.warn('PerformanceObserver not fully supported:', e);
        }
      }

      // Largest Contentful Paint
      this.trackLargestContentfulPaint();
      
      // Cumulative Layout Shift
      this.trackCumulativeLayoutShift();
      
      // First Input Delay
      this.trackFirstInputDelay();
    },

    /**
     * Track Largest Contentful Paint
     */
    trackLargestContentfulPaint: function() {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.performance.largestContentfulPaint = lastEntry.startTime;
            
            this.trackEvent('core_web_vitals', {
              metric: 'largest_contentful_paint',
              value: lastEntry.startTime
            });
          });
          observer.observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
          console.warn('LCP tracking not supported:', e);
        }
      }
    },

    /**
     * Track Cumulative Layout Shift
     */
    trackCumulativeLayoutShift: function() {
      if ('PerformanceObserver' in window) {
        try {
          let clsValue = 0;
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            
            this.performance.cumulativeLayoutShift = clsValue;
            this.trackEvent('core_web_vitals', {
              metric: 'cumulative_layout_shift',
              value: clsValue
            });
          });
          observer.observe({ entryTypes: ['layout-shift'] });
        } catch (e) {
          console.warn('CLS tracking not supported:', e);
        }
      }
    },

    /**
     * Track First Input Delay
     */
    trackFirstInputDelay: function() {
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              this.performance.firstInputDelay = entry.processingStart - entry.startTime;
              
              this.trackEvent('core_web_vitals', {
                metric: 'first_input_delay',
                value: this.performance.firstInputDelay
              });
            }
          });
          observer.observe({ entryTypes: ['first-input'] });
        } catch (e) {
          console.warn('FID tracking not supported:', e);
        }
      }
    },

    /**
     * Track resource loading performance
     */
    trackResourceLoading: function() {
      window.addEventListener('load', () => {
        const resources = performance.getEntriesByType('resource');
        const slowResources = resources.filter(resource => resource.duration > 1000);
        
        if (slowResources.length > 0) {
          this.trackEvent('slow_resources', {
            count: slowResources.length,
            slowest: Math.max(...slowResources.map(r => r.duration)),
            resources: slowResources.map(r => ({
              name: r.name,
              duration: r.duration,
              size: r.transferSize
            }))
          });
        }
      });
    },

    /**
     * Track scroll behavior
     */
    trackScrollBehavior: function() {
      let scrollTimeout;
      let maxScroll = 0;
      const scrollMilestones = [25, 50, 75, 90, 100];
      const reachedMilestones = new Set();
      
      window.addEventListener('scroll', () => {
        const scrollPercent = Math.round(
          (window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight)) * 100
        );
        
        maxScroll = Math.max(maxScroll, scrollPercent);
        this.session.scrollDepth = maxScroll;
        
        // Track scroll milestones
        scrollMilestones.forEach(milestone => {
          if (scrollPercent >= milestone && !reachedMilestones.has(milestone)) {
            reachedMilestones.add(milestone);
            this.trackEvent('scroll_depth', {
              depth_percent: milestone,
              time_to_depth: Date.now() - this.session.startTime
            });
          }
        });
        
        // Debounced scroll tracking
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.behavior.scrollPattern.push({
            position: scrollPercent,
            timestamp: Date.now() - this.session.startTime
          });
          
          // Keep only last 10 scroll positions to prevent memory bloat
          if (this.behavior.scrollPattern.length > 10) {
            this.behavior.scrollPattern.shift();
          }
        }, 100);
      });
    },

    /**
     * Track mouse movement (sampled)
     */
    trackMouseMovement: function() {
      let mouseTimeout;
      let sampleCount = 0;
      const maxSamples = 50; // Limit to prevent performance issues
      
      document.addEventListener('mousemove', (e) => {
        if (sampleCount >= maxSamples) return;
        
        clearTimeout(mouseTimeout);
        mouseTimeout = setTimeout(() => {
          sampleCount++;
          this.trackEvent('mouse_movement', {
            x: e.clientX,
            y: e.clientY,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            sample_number: sampleCount
          });
        }, 2000); // Sample every 2 seconds at most
      });
    },

    /**
     * Track keyboard interactions
     */
    trackKeyboardInteractions: function() {
      const trackedKeys = ['Tab', 'Enter', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      
      document.addEventListener('keydown', (e) => {
        if (trackedKeys.includes(e.key) || (e.ctrlKey || e.metaKey)) {
          this.trackEvent('keyboard_interaction', {
            key: e.key,
            ctrl_key: e.ctrlKey,
            alt_key: e.altKey,
            shift_key: e.shiftKey,
            meta_key: e.metaKey,
            target_element: e.target.tagName.toLowerCase()
          });
        }
      });
    },

    /**
     * Track exit intent
     */
    trackExitIntent: function() {
      document.addEventListener('mouseout', (e) => {
        if (e.clientY <= 0 && !this.behavior.exitIntent) {
          this.behavior.exitIntent = true;
          this.trackEvent('exit_intent', {
            time_on_page: Date.now() - this.session.startTime,
            scroll_depth: this.session.scrollDepth,
            interactions: this.session.interactions
          });
        }
      });
    },

    /**
     * Track time on page
     */
    trackTimeOnPage: function() {
      setInterval(() => {
        if (document.visibilityState === 'visible') {
          this.session.timeOnPage += 1000;
        }
      }, 1000);
      
      // Track when leaving page
      window.addEventListener('beforeunload', () => {
        this.trackEvent('page_exit', {
          time_on_page: this.session.timeOnPage,
          scroll_depth: this.session.scrollDepth,
          interactions: this.session.interactions,
          page_views: this.session.pageViews
        });
        
        this.flushEvents();
      });
    },

    /**
     * Track documentation-specific usage
     */
    trackDocumentationUsage: function() {
      // Track section expansions
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('md-nav__link') || 
            e.target.closest('.md-nav__item--nested')) {
          this.trackEvent('section_expand', {
            section_name: e.target.textContent.trim(),
            section_url: e.target.href || null
          });
        }
      });
      
      // Track code block interactions
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-button')) {
          const codeBlock = e.target.closest('pre');
          const language = this.getCodeLanguage(codeBlock);
          
          this.trackEvent('code_copy', {
            language: language,
            code_length: codeBlock.textContent.length,
            page_section: this.getCurrentSection()
          });
        }
      });
    },

    /**
     * Track search behavior
     */
    trackSearchBehavior: function() {
      // Enhanced search tracking is handled in search-enhancements.js
      // This provides basic fallback tracking
      
      const searchInputs = document.querySelectorAll('input[type="search"]');
      searchInputs.forEach(input => {
        let queryStartTime;
        
        input.addEventListener('focus', () => {
          queryStartTime = Date.now();
        });
        
        input.addEventListener('blur', () => {
          if (queryStartTime) {
            const focusTime = Date.now() - queryStartTime;
            this.trackEvent('search_session', {
              focus_time: focusTime,
              final_query_length: input.value.length
            });
          }
        });
      });
    },

    /**
     * Track code interactions
     */
    trackCodeInteractions: function() {
      // Track hover over code blocks
      let codeHoverTimeout;
      document.addEventListener('mouseenter', (e) => {
        if (e.target.tagName === 'CODE' || e.target.closest('pre')) {
          codeHoverTimeout = setTimeout(() => {
            const codeBlock = e.target.tagName === 'CODE' ? e.target.closest('pre') : e.target;
            const language = this.getCodeLanguage(codeBlock);
            
            this.trackEvent('code_hover', {
              language: language,
              code_length: codeBlock.textContent.length,
              hover_duration: 2000 // minimum hover time to trigger
            });
          }, 2000);
        }
      }, true);
      
      document.addEventListener('mouseleave', (e) => {
        if (e.target.tagName === 'CODE' || e.target.closest('pre')) {
          clearTimeout(codeHoverTimeout);
        }
      }, true);
    },

    /**
     * Track downloads
     */
    trackDownloads: function() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href) {
          const downloadExtensions = ['.pdf', '.zip', '.tar.gz', '.json', '.yaml', '.yml'];
          const isDownload = downloadExtensions.some(ext => link.href.includes(ext));
          
          if (isDownload || link.download) {
            this.trackEvent('file_download', {
              file_url: link.href,
              file_name: link.download || link.href.split('/').pop(),
              link_text: link.textContent.trim(),
              page_section: this.getCurrentSection()
            });
          }
        }
      });
    },

    /**
     * Track external links
     */
    trackExternalLinks: function() {
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link && link.href && !link.href.includes(window.location.origin)) {
          this.trackEvent('external_link_click', {
            external_url: link.href,
            link_text: link.textContent.trim(),
            opens_new_tab: link.target === '_blank',
            page_section: this.getCurrentSection()
          });
        }
      });
    },

    /**
     * Track an analytics event
     */
    trackEvent: function(eventName, eventData = {}) {
      const event = {
        event: eventName,
        timestamp: Date.now(),
        session_id: this.session.id,
        page_url: window.location.href,
        page_title: document.title,
        ...eventData
      };
      
      // Add to queue for batching
      this.eventQueue.push(event);
      
      // Track with Google Analytics if available
      if (typeof gtag !== 'undefined') {
        gtag('event', eventName, eventData);
      }
      
      // Console log for debugging (only in development)
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('Analytics Event:', eventName, eventData);
      }
      
      // Flush queue if it's getting large
      if (this.eventQueue.length >= this.config.batchSize) {
        this.flushEvents();
      }
    },

    /**
     * Flush events to analytics endpoint
     */
    flushEvents: function() {
      if (this.eventQueue.length === 0) return;
      
      const events = [...this.eventQueue];
      this.eventQueue = [];
      
      // Send to custom analytics endpoint if configured
      if (this.config.apiEndpoint) {
        this.sendToCustomEndpoint(events);
      }
      
      // Store locally as backup
      this.storeEventsLocally(events);
    },

    /**
     * Send events to custom analytics endpoint
     */
    sendToCustomEndpoint: function(events) {
      if ('navigator' in window && 'sendBeacon' in navigator) {
        // Use sendBeacon for reliability
        const data = JSON.stringify({ events });
        navigator.sendBeacon(this.config.apiEndpoint, data);
      } else {
        // Fallback to fetch
        fetch(this.config.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events })
        }).catch(e => console.warn('Failed to send analytics:', e));
      }
    },

    /**
     * Store events locally as backup
     */
    storeEventsLocally: function(events) {
      try {
        const stored = this.getStorageItem('events_backup') || [];
        stored.push(...events);
        
        // Keep only last 1000 events
        const trimmed = stored.slice(-1000);
        this.setStorageItem('events_backup', trimmed);
      } catch (e) {
        console.warn('Failed to store analytics locally:', e);
      }
    },

    /**
     * Start session timer
     */
    startSessionTimer: function() {
      setInterval(() => {
        this.flushEvents();
      }, this.config.flushInterval);
    },

    /**
     * Utility functions
     */
    generateSessionId: function() {
      return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    hashString: function(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return hash.toString(36);
    },

    getCodeLanguage: function(codeBlock) {
      if (!codeBlock) return 'unknown';
      
      const code = codeBlock.querySelector('code');
      if (code) {
        const classes = code.className.split(' ');
        for (const cls of classes) {
          if (cls.startsWith('language-')) {
            return cls.replace('language-', '');
          }
        }
      }
      return 'unknown';
    },

    getCurrentSection: function() {
      const activeNav = document.querySelector('.md-nav__link--active');
      return activeNav ? activeNav.textContent.trim() : 'unknown';
    },

    setStorageItem: function(key, value) {
      try {
        localStorage.setItem(this.config.storagePrefix + key, JSON.stringify(value));
      } catch (e) {
        console.warn('Failed to set storage item:', e);
      }
    },

    getStorageItem: function(key) {
      try {
        const item = localStorage.getItem(this.config.storagePrefix + key);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        console.warn('Failed to get storage item:', e);
        return null;
      }
    }
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.MediaNest.Analytics.init();
    });
  } else {
    window.MediaNest.Analytics.init();
  }

})(window, document);