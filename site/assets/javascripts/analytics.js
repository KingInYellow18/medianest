/* MediaNest Documentation Analytics - Privacy Focused */

// Privacy-first analytics implementation
(function() {
  'use strict';

  // Check for user consent before loading analytics
  function loadAnalytics() {
    if (localStorage.getItem('cookie-consent') !== 'accepted') {
      return;
    }

    // Only load if Google Analytics is configured
    const gaKey = document.querySelector('meta[name="google-analytics"]');
    if (!gaKey) return;

    // Load Google Analytics script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaKey.content}`;
    document.head.appendChild(script);

    // Initialize GA
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', gaKey.content, {
      anonymize_ip: true,
      respect_dnt: true,
      cookie_flags: 'secure;samesite=strict'
    });

    // Track custom events
    gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      content_group1: 'MediaNest Documentation'
    });
  }

  // Load analytics if consent is already given
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAnalytics);
  } else {
    loadAnalytics();
  }

  // Listen for consent changes
  window.addEventListener('storage', function(e) {
    if (e.key === 'cookie-consent' && e.newValue === 'accepted') {
      loadAnalytics();
    }
  });
})();