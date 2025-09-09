/* MediaNest Documentation Performance Monitor - 2025 Enhanced */

(function() {
    'use strict';

    // Performance monitoring configuration
    const PERFORMANCE_CONFIG = {
        thresholds: {
            loadTime: 3000,        // 3 seconds
            firstPaint: 1500,      // 1.5 seconds
            largestContentful: 2500, // 2.5 seconds
            firstInput: 100,       // 100ms
            cumulativeLayout: 0.1  // 0.1 score
        },
        reportUrl: '/api/performance-metrics',
        enabled: true
    };

    class MediaNestPerformanceMonitor {
        constructor() {
            this.metrics = {};
            this.observer = null;
            this.init();
        }

        init() {
            if (!PERFORMANCE_CONFIG.enabled || !('performance' in window)) {
                return;
            }

            // Monitor Web Vitals
            this.observeWebVitals();
            
            // Monitor page load performance
            this.monitorPageLoad();
            
            // Monitor resource loading
            this.monitorResources();
            
            // Set up periodic reporting
            this.setupReporting();
        }

        observeWebVitals() {
            // Largest Contentful Paint (LCP)
            if ('PerformanceObserver' in window) {
                this.observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        if (entry.entryType === 'largest-contentful-paint') {
                            this.recordMetric('lcp', entry.startTime);
                            this.checkThreshold('lcp', entry.startTime, PERFORMANCE_CONFIG.thresholds.largestContentful);
                        }
                        
                        if (entry.entryType === 'first-input') {
                            this.recordMetric('fid', entry.processingStart - entry.startTime);
                            this.checkThreshold('fid', entry.processingStart - entry.startTime, PERFORMANCE_CONFIG.thresholds.firstInput);
                        }
                        
                        if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
                            this.recordMetric('cls', entry.value, true); // cumulative
                        }
                    });
                });

                try {
                    this.observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
                } catch (e) {
                    console.warn('MediaNest Performance: Observer not supported', e);
                }
            }
        }

        monitorPageLoad() {
            window.addEventListener('load', () => {
                // Record load time
                const loadTime = performance.now();
                this.recordMetric('loadTime', loadTime);
                this.checkThreshold('loadTime', loadTime, PERFORMANCE_CONFIG.thresholds.loadTime);

                // Record navigation timing
                if (performance.getEntriesByType) {
                    const [navigation] = performance.getEntriesByType('navigation');
                    if (navigation) {
                        this.recordMetric('domContentLoaded', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
                        this.recordMetric('domInteractive', navigation.domInteractive - navigation.navigationStart);
                        this.recordMetric('ttfb', navigation.responseStart - navigation.requestStart);
                    }
                }

                // Record paint timing
                if (performance.getEntriesByType) {
                    const paintEntries = performance.getEntriesByType('paint');
                    paintEntries.forEach(entry => {
                        if (entry.name === 'first-contentful-paint') {
                            this.recordMetric('fcp', entry.startTime);
                            this.checkThreshold('fcp', entry.startTime, PERFORMANCE_CONFIG.thresholds.firstPaint);
                        }
                    });
                }
            });
        }

        monitorResources() {
            if ('PerformanceObserver' in window) {
                const resourceObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (entry.duration > 1000) { // Resources taking more than 1 second
                            console.warn(`MediaNest Performance: Slow resource: ${entry.name} took ${entry.duration}ms`);
                            this.recordMetric('slowResources', {
                                name: entry.name,
                                duration: entry.duration,
                                size: entry.transferSize
                            }, true);
                        }
                    });
                });

                try {
                    resourceObserver.observe({ entryTypes: ['resource'] });
                } catch (e) {
                    console.warn('MediaNest Performance: Resource observer not supported', e);
                }
            }
        }

        recordMetric(name, value, cumulative = false) {
            if (cumulative) {
                if (!this.metrics[name]) {
                    this.metrics[name] = [];
                }
                this.metrics[name].push(value);
            } else {
                this.metrics[name] = value;
            }

            // Store in sessionStorage for debugging
            try {
                sessionStorage.setItem('medianest-perf-metrics', JSON.stringify(this.metrics));
            } catch (e) {
                // Silently fail if storage is not available
            }
        }

        checkThreshold(metric, value, threshold) {
            if (value > threshold) {
                console.warn(`MediaNest Performance Warning: ${metric} (${value}ms) exceeded threshold (${threshold}ms)`);
                
                // Show user-friendly notification for severe performance issues
                if (value > threshold * 2) {
                    this.showPerformanceWarning(metric, value);
                }
            }
        }

        showPerformanceWarning(metric, value) {
            // Only show warning once per session
            const warningKey = `perf-warning-${metric}`;
            if (sessionStorage.getItem(warningKey)) {
                return;
            }

            // Create subtle performance notification
            const notification = document.createElement('div');
            notification.className = 'medianest-performance-notification';
            notification.innerHTML = `
                <div class="medianest-perf-content">
                    <span class="medianest-perf-icon">⚡</span>
                    <span class="medianest-perf-text">Loading may be slower than expected. Check your connection.</span>
                    <button class="medianest-perf-close" onclick="this.parentNode.parentNode.remove()">×</button>
                </div>
            `;

            // Add styles
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #673ab7, #9c27b0);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(103, 58, 183, 0.3);
                z-index: 10000;
                font-family: 'Roboto', sans-serif;
                font-size: 14px;
                max-width: 300px;
                animation: slideIn 0.3s ease-out;
            `;

            document.body.appendChild(notification);

            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);

            sessionStorage.setItem(warningKey, 'shown');
        }

        setupReporting() {
            // Report metrics when page is hidden/unloaded
            const reportMetrics = () => {
                if (Object.keys(this.metrics).length === 0) return;

                // Calculate final CLS score
                if (this.metrics.cls && Array.isArray(this.metrics.cls)) {
                    const clsScore = this.metrics.cls.reduce((sum, value) => sum + value, 0);
                    this.metrics.clsFinal = clsScore;
                    this.checkThreshold('cls', clsScore, PERFORMANCE_CONFIG.thresholds.cumulativeLayout);
                }

                // Add page context
                const report = {
                    metrics: this.metrics,
                    page: {
                        url: window.location.href,
                        referrer: document.referrer,
                        userAgent: navigator.userAgent,
                        timestamp: Date.now(),
                        connection: navigator.connection ? {
                            effectiveType: navigator.connection.effectiveType,
                            downlink: navigator.connection.downlink
                        } : null
                    }
                };

                // Send to analytics (if available and consent given)
                if (window.gtag && localStorage.getItem('cookie-consent') === 'accepted') {
                    gtag('event', 'performance_metrics', {
                        custom_parameter: JSON.stringify(report.metrics)
                    });
                }

                // Console log for development
                console.log('MediaNest Performance Report:', report);
            };

            // Use Page Visibility API
            if ('visibilitychange' in document) {
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden') {
                        reportMetrics();
                    }
                });
            }

            // Fallback for older browsers
            window.addEventListener('beforeunload', reportMetrics);
            window.addEventListener('pagehide', reportMetrics);
        }

        // Public API
        getMetrics() {
            return { ...this.metrics };
        }

        resetMetrics() {
            this.metrics = {};
            try {
                sessionStorage.removeItem('medianest-perf-metrics');
            } catch (e) {
                // Silently fail
            }
        }
    }

    // Initialize performance monitor
    let performanceMonitor;
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            performanceMonitor = new MediaNestPerformanceMonitor();
        });
    } else {
        performanceMonitor = new MediaNestPerformanceMonitor();
    }

    // Export for external use
    window.MediaNestPerformance = {
        getMetrics: () => performanceMonitor?.getMetrics() || {},
        resetMetrics: () => performanceMonitor?.resetMetrics(),
        isSupported: () => 'performance' in window && 'PerformanceObserver' in window
    };

    // Add CSS for animations and notifications
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .medianest-perf-content {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .medianest-perf-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-size: 18px;
            padding: 0;
            margin-left: auto;
        }
        
        .medianest-perf-close:hover {
            opacity: 0.8;
        }
    `;
    document.head.appendChild(style);

})();