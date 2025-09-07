// MediaNest Documentation JavaScript Enhancements

document.addEventListener('DOMContentLoaded', function() {
  // Initialize all enhancements
  initializeCodeCopy();
  initializeSearchEnhancements();
  initializeNavigationEnhancements();
  initializeTooltips();
  initializeAnalytics();
  initializeDarkModeToggle();
});

// Enhanced code copying with syntax highlighting
function initializeCodeCopy() {
  // Add copy buttons to all code blocks
  document.querySelectorAll('pre > code').forEach(function(codeBlock) {
    const pre = codeBlock.parentNode;
    const button = document.createElement('button');
    button.className = 'md-clipboard md-icon';
    button.title = 'Copy to clipboard';
    button.innerHTML = '<svg><use href="#__md_clipboard_icon"></use></svg>';
    
    button.addEventListener('click', function() {
      navigator.clipboard.writeText(codeBlock.textContent).then(function() {
        showToast('Code copied to clipboard!');
        button.classList.add('md-clipboard--copied');
        setTimeout(() => button.classList.remove('md-clipboard--copied'), 2000);
      });
    });
    
    pre.appendChild(button);
  });
}

// Enhanced search with suggestions
function initializeSearchEnhancements() {
  const searchInput = document.querySelector('[data-md-component="search-query"]');
  if (!searchInput) return;
  
  // Add search suggestions
  const suggestions = [
    'docker installation',
    'api authentication',
    'media upload',
    'troubleshooting',
    'configuration',
    'database setup',
    'user guides'
  ];
  
  searchInput.addEventListener('focus', function() {
    if (this.value === '') {
      showSearchSuggestions(suggestions);
    }
  });
  
  searchInput.addEventListener('input', function() {
    const value = this.value.toLowerCase();
    const filtered = suggestions.filter(s => s.includes(value));
    if (filtered.length > 0) {
      showSearchSuggestions(filtered);
    }
  });
}

function showSearchSuggestions(suggestions) {
  // Implementation for search suggestions
  console.log('Search suggestions:', suggestions);
}

// Navigation enhancements
function initializeNavigationEnhancements() {
  // Add breadcrumb navigation
  const nav = document.querySelector('.md-nav--primary');
  if (nav) {
    addBreadcrumbs();
  }
  
  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
  
  // Add "Back to Top" button
  addBackToTopButton();
}

function addBreadcrumbs() {
  const main = document.querySelector('main');
  const article = main?.querySelector('article');
  if (!article) return;
  
  const breadcrumb = document.createElement('nav');
  breadcrumb.className = 'md-breadcrumb';
  breadcrumb.innerHTML = '<a href="/">Home</a>';
  
  const path = window.location.pathname.split('/').filter(Boolean);
  let currentPath = '/';
  
  path.forEach((segment, index) => {
    currentPath += segment + '/';
    const isLast = index === path.length - 1;
    const title = segment.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    if (isLast) {
      breadcrumb.innerHTML += ` > <span>${title}</span>`;
    } else {
      breadcrumb.innerHTML += ` > <a href="${currentPath}">${title}</a>`;
    }
  });
  
  article.insertBefore(breadcrumb, article.firstChild);
}

function addBackToTopButton() {
  const button = document.createElement('button');
  button.className = 'back-to-top';
  button.innerHTML = '↑';
  button.title = 'Back to Top';
  button.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 100;
    background: var(--md-primary-fg-color);
    color: white;
    border: none;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    font-size: 1.5rem;
    cursor: pointer;
    opacity: 0;
    transform: translateY(100px);
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  
  button.addEventListener('click', function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  
  document.body.appendChild(button);
  
  // Show/hide based on scroll position
  window.addEventListener('scroll', function() {
    if (window.scrollY > 500) {
      button.style.opacity = '1';
      button.style.transform = 'translateY(0)';
    } else {
      button.style.opacity = '0';
      button.style.transform = 'translateY(100px)';
    }
  });
}

// Initialize tooltips for enhanced UX
function initializeTooltips() {
  document.querySelectorAll('[title]').forEach(function(element) {
    const tooltip = createTooltip(element.title);
    element.addEventListener('mouseenter', function() {
      showTooltip(element, tooltip);
    });
    element.addEventListener('mouseleave', function() {
      hideTooltip(tooltip);
    });
  });
}

function createTooltip(text) {
  const tooltip = document.createElement('div');
  tooltip.className = 'custom-tooltip';
  tooltip.textContent = text;
  tooltip.style.cssText = `
    position: absolute;
    background: #333;
    color: white;
    padding: 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    max-width: 200px;
    word-wrap: break-word;
  `;
  document.body.appendChild(tooltip);
  return tooltip;
}

function showTooltip(element, tooltip) {
  const rect = element.getBoundingClientRect();
  tooltip.style.top = (rect.top - tooltip.offsetHeight - 5) + 'px';
  tooltip.style.left = (rect.left + rect.width / 2 - tooltip.offsetWidth / 2) + 'px';
  tooltip.style.opacity = '1';
}

function hideTooltip(tooltip) {
  tooltip.style.opacity = '0';
}

// Analytics and usage tracking
function initializeAnalytics() {
  // Track page views
  trackPageView();
  
  // Track search queries
  const searchForm = document.querySelector('[data-md-component="search"]');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      const query = searchForm.querySelector('input').value;
      trackEvent('search', 'query', query);
    });
  }
  
  // Track external link clicks
  document.querySelectorAll('a[href^="http"]').forEach(function(link) {
    if (!link.href.includes(window.location.hostname)) {
      link.addEventListener('click', function() {
        trackEvent('external_link', 'click', link.href);
      });
    }
  });
  
  // Track time on page
  let startTime = Date.now();
  window.addEventListener('beforeunload', function() {
    const timeSpent = Date.now() - startTime;
    trackEvent('engagement', 'time_on_page', Math.round(timeSpent / 1000));
  });
}

function trackPageView() {
  // Only track if analytics is enabled
  if (window.gtag) {
    window.gtag('config', 'GA_MEASUREMENT_ID', {
      page_path: window.location.pathname
    });
  }
}

function trackEvent(category, action, label, value) {
  if (window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value
    });
  }
}

// Dark mode toggle enhancement
function initializeDarkModeToggle() {
  // Add system preference detection
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  
  mediaQuery.addListener(function(e) {
    if (e.matches) {
      document.body.setAttribute('data-md-color-scheme', 'slate');
    } else {
      document.body.setAttribute('data-md-color-scheme', 'default');
    }
  });
  
  // Apply initial theme
  if (mediaQuery.matches && !localStorage.getItem('data-md-color-scheme')) {
    document.body.setAttribute('data-md-color-scheme', 'slate');
  }
}

// Toast notification system
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    z-index: 1000;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 600;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    max-width: 300px;
  `;
  
  if (type === 'success') {
    toast.style.background = '#4caf50';
  } else if (type === 'error') {
    toast.style.background = '#f44336';
  } else if (type === 'warning') {
    toast.style.background = '#ff9800';
  }
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
  }, 100);
  
  // Auto remove
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Ctrl/Cmd + K for search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const searchInput = document.querySelector('[data-md-component="search-query"]');
    if (searchInput) {
      searchInput.focus();
    }
  }
  
  // Escape to close modals/search
  if (e.key === 'Escape') {
    const searchReset = document.querySelector('[data-md-component="search-reset"]');
    if (searchReset && searchReset.style.display !== 'none') {
      searchReset.click();
    }
  }
});

// Service worker for offline functionality
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

// Enhanced print functionality
function initializePrintEnhancements() {
  window.addEventListener('beforeprint', function() {
    // Expand all collapsible sections
    document.querySelectorAll('.md-nav__item--nested > .md-nav').forEach(function(nav) {
      nav.style.display = 'block';
    });
  });
  
  window.addEventListener('afterprint', function() {
    // Restore collapsed state
    document.querySelectorAll('.md-nav__item--nested > .md-nav').forEach(function(nav) {
      nav.style.display = '';
    });
  });
}

// Initialize print enhancements
initializePrintEnhancements();