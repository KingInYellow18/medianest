/* MediaNest Documentation JavaScript Enhancements */

// Theme toggle enhancement
document.addEventListener('DOMContentLoaded', function() {
  // Add MediaNest branding animations
  const logo = document.querySelector('.md-header__button.md-logo');
  if (logo) {
    logo.addEventListener('mouseenter', function() {
      this.style.transform = 'scale(1.05)';
    });
    
    logo.addEventListener('mouseleave', function() {
      this.style.transform = 'scale(1)';
    });
  }

  // Enhanced search functionality
  const searchInput = document.querySelector('.md-search__input');
  if (searchInput) {
    searchInput.setAttribute('placeholder', 'Search MediaNest documentation...');
  }

  // Add copy code button enhancement
  const codeBlocks = document.querySelectorAll('pre code');
  codeBlocks.forEach(function(block) {
    const button = block.parentNode.querySelector('.md-clipboard');
    if (button) {
      button.addEventListener('click', function() {
        // Show feedback
        const originalText = this.textContent;
        this.textContent = 'Copied!';
        setTimeout(() => {
          this.textContent = originalText;
        }, 1000);
      });
    }
  });

  // Performance monitoring
  if ('performance' in window) {
    window.addEventListener('load', function() {
      const loadTime = performance.now();
      if (loadTime > 3000) {
        console.warn('MediaNest Docs: Page load time exceeded 3 seconds');
      }
    });
  }
});

// Analytics helper (respects privacy settings)
function trackEvent(action, category = 'Documentation') {
  if (typeof gtag !== 'undefined' && localStorage.getItem('cookie-consent') === 'accepted') {
    gtag('event', action, {
      event_category: category,
      event_label: window.location.pathname
    });
  }
}

// Export for external use
window.MediaNestDocs = {
  trackEvent: trackEvent
};