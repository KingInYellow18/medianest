/**
 * MediaNest Documentation - Advanced Search Enhancements
 * Provides intelligent search suggestions, filters, and enhanced search UX
 */

(function(window, document) {
  'use strict';

  window.MediaNest = window.MediaNest || {};
  window.MediaNest.Search = {

    // Configuration
    config: {
      minQueryLength: 2,
      maxSuggestions: 8,
      searchDelay: 300,
      highlightClass: 'search-highlight',
      storageKey: 'medianest_search_history'
    },

    // Search history and statistics
    searchData: {
      history: [],
      popularTerms: {},
      recentSearches: []
    },

    // Search filters and categories
    filters: {
      categories: ['all', 'api', 'guides', 'installation', 'troubleshooting', 'reference'],
      currentCategory: 'all',
      showFilters: false
    },

    /**
     * Initialize search enhancements
     */
    init: function() {
      this.loadSearchData();
      this.enhanceSearchInterface();
      this.addSearchFilters();
      this.bindSearchEvents();
      this.addKeyboardNavigation();
      this.setupSearchAnalytics();
      console.log('MediaNest Search enhancements initialized');
    },

    /**
     * Load search history and popular terms from storage
     */
    loadSearchData: function() {
      try {
        const stored = localStorage.getItem(this.config.storageKey);
        if (stored) {
          this.searchData = { ...this.searchData, ...JSON.parse(stored) };
        }
      } catch (e) {
        console.warn('Failed to load search data:', e);
      }
    },

    /**
     * Save search data to storage
     */
    saveSearchData: function() {
      try {
        localStorage.setItem(this.config.storageKey, JSON.stringify(this.searchData));
      } catch (e) {
        console.warn('Failed to save search data:', e);
      }
    },

    /**
     * Enhance the existing search interface
     */
    enhanceSearchInterface: function() {
      const searchInput = document.querySelector('.md-search__input');
      if (!searchInput) return;

      // Add search container enhancements
      const searchForm = searchInput.closest('.md-search__form');
      if (searchForm) {
        // Add clear button
        this.addClearButton(searchForm);
        
        // Add search suggestions container
        this.addSuggestionsContainer(searchForm);
        
        // Add search stats
        this.addSearchStats(searchForm);
      }

      // Enhance search input
      searchInput.setAttribute('autocomplete', 'off');
      searchInput.setAttribute('spellcheck', 'false');
      searchInput.placeholder = 'Search documentation... (Ctrl+K)';

      // Add search enhancement styles
      this.addSearchStyles();
    },

    /**
     * Add clear button to search
     */
    addClearButton: function(searchForm) {
      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'md-search__clear';
      clearButton.innerHTML = '×';
      clearButton.title = 'Clear search';
      clearButton.style.display = 'none';

      clearButton.addEventListener('click', (e) => {
        e.preventDefault();
        const input = searchForm.querySelector('.md-search__input');
        input.value = '';
        input.focus();
        clearButton.style.display = 'none';
        this.hideSuggestions();
      });

      searchForm.appendChild(clearButton);

      // Show/hide clear button based on input
      const input = searchForm.querySelector('.md-search__input');
      input.addEventListener('input', (e) => {
        clearButton.style.display = e.target.value ? 'block' : 'none';
      });
    },

    /**
     * Add suggestions container
     */
    addSuggestionsContainer: function(searchForm) {
      const container = document.createElement('div');
      container.className = 'md-search__suggestions';
      container.innerHTML = `
        <div class="search-suggestions-header">
          <span class="suggestions-title">Suggestions</span>
          <button class="suggestions-close">×</button>
        </div>
        <div class="search-suggestions-content">
          <div class="recent-searches">
            <h4>Recent Searches</h4>
            <ul class="recent-list"></ul>
          </div>
          <div class="popular-searches">
            <h4>Popular</h4>
            <ul class="popular-list"></ul>
          </div>
          <div class="quick-links">
            <h4>Quick Links</h4>
            <ul class="quick-list"></ul>
          </div>
        </div>
      `;

      searchForm.parentNode.insertBefore(container, searchForm.nextSibling);

      // Bind close button
      container.querySelector('.suggestions-close').addEventListener('click', () => {
        this.hideSuggestions();
      });

      // Populate quick links
      this.populateQuickLinks(container.querySelector('.quick-list'));
    },

    /**
     * Add search statistics
     */
    addSearchStats: function(searchForm) {
      const stats = document.createElement('div');
      stats.className = 'md-search__stats';
      searchForm.parentNode.appendChild(stats);
    },

    /**
     * Add search category filters
     */
    addSearchFilters: function() {
      const searchContainer = document.querySelector('.md-search');
      if (!searchContainer) return;

      const filterContainer = document.createElement('div');
      filterContainer.className = 'md-search__filters';
      filterContainer.innerHTML = `
        <div class="search-filters">
          <button class="filters-toggle" aria-label="Show search filters">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            Filters
          </button>
          <div class="filters-dropdown">
            <div class="filter-group">
              <label>Category:</label>
              <div class="filter-options">
                ${this.filters.categories.map(cat => 
                  `<label class="filter-option">
                    <input type="radio" name="category" value="${cat}" ${cat === 'all' ? 'checked' : ''}>
                    <span>${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                  </label>`
                ).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      searchContainer.appendChild(filterContainer);

      // Bind filter events
      this.bindFilterEvents(filterContainer);
    },

    /**
     * Bind filter events
     */
    bindFilterEvents: function(container) {
      const toggle = container.querySelector('.filters-toggle');
      const dropdown = container.querySelector('.filters-dropdown');

      toggle.addEventListener('click', () => {
        this.filters.showFilters = !this.filters.showFilters;
        dropdown.style.display = this.filters.showFilters ? 'block' : 'none';
        toggle.classList.toggle('active', this.filters.showFilters);
      });

      // Category filter changes
      container.addEventListener('change', (e) => {
        if (e.target.name === 'category') {
          this.filters.currentCategory = e.target.value;
          this.applyFilters();
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target) && this.filters.showFilters) {
          this.filters.showFilters = false;
          dropdown.style.display = 'none';
          toggle.classList.remove('active');
        }
      });
    },

    /**
     * Apply current filters to search results
     */
    applyFilters: function() {
      const results = document.querySelectorAll('.md-search-result');
      const category = this.filters.currentCategory;

      results.forEach(result => {
        if (category === 'all') {
          result.style.display = '';
        } else {
          // Check if result matches category (implementation depends on your content structure)
          const matchesCategory = this.resultMatchesCategory(result, category);
          result.style.display = matchesCategory ? '' : 'none';
        }
      });

      this.updateSearchStats();
    },

    /**
     * Check if search result matches category
     */
    resultMatchesCategory: function(result, category) {
      const title = result.querySelector('.md-search-result__title')?.textContent.toLowerCase() || '';
      const url = result.querySelector('a')?.href || '';

      switch (category) {
        case 'api':
          return url.includes('/api/') || title.includes('api');
        case 'guides':
          return url.includes('/user-guides/') || url.includes('/guides/') || title.includes('guide');
        case 'installation':
          return url.includes('/installation/') || title.includes('install') || title.includes('setup');
        case 'troubleshooting':
          return url.includes('/troubleshooting/') || title.includes('troubleshoot') || title.includes('problem');
        case 'reference':
          return url.includes('/reference/') || title.includes('reference');
        default:
          return true;
      }
    },

    /**
     * Bind search-related events
     */
    bindSearchEvents: function() {
      const searchInput = document.querySelector('.md-search__input');
      if (!searchInput) return;

      let searchTimeout;

      // Input events
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length >= this.config.minQueryLength) {
          searchTimeout = setTimeout(() => {
            this.handleSearch(query);
          }, this.config.searchDelay);
        } else if (query.length === 0) {
          this.hideSuggestions();
        }
      });

      // Focus events
      searchInput.addEventListener('focus', () => {
        const query = searchInput.value.trim();
        if (query.length === 0) {
          this.showRecentSearches();
        }
      });

      // Search form submission
      const searchForm = searchInput.closest('form');
      if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
          const query = searchInput.value.trim();
          if (query) {
            this.recordSearch(query);
            this.trackSearchEvent(query, 'search_submit');
          }
        });
      }

      // Hide suggestions when clicking outside
      document.addEventListener('click', (e) => {
        const searchContainer = document.querySelector('.md-search');
        if (searchContainer && !searchContainer.contains(e.target)) {
          this.hideSuggestions();
        }
      });
    },

    /**
     * Handle search query
     */
    handleSearch: function(query) {
      this.showSearchSuggestions(query);
      this.trackSearchEvent(query, 'search_input');
    },

    /**
     * Show search suggestions
     */
    showSearchSuggestions: function(query) {
      const container = document.querySelector('.md-search__suggestions');
      if (!container) return;

      // Generate suggestions based on query
      const suggestions = this.generateSuggestions(query);
      
      if (suggestions.length > 0) {
        this.renderSuggestions(suggestions, container);
        container.style.display = 'block';
      } else {
        this.hideSuggestions();
      }
    },

    /**
     * Generate search suggestions
     */
    generateSuggestions: function(query) {
      const suggestions = [];
      const lowerQuery = query.toLowerCase();

      // Add matching recent searches
      this.searchData.recentSearches
        .filter(term => term.toLowerCase().includes(lowerQuery) && term !== query)
        .slice(0, 3)
        .forEach(term => suggestions.push({ type: 'recent', text: term }));

      // Add matching popular terms
      Object.keys(this.searchData.popularTerms)
        .filter(term => term.toLowerCase().includes(lowerQuery) && term !== query)
        .sort((a, b) => this.searchData.popularTerms[b] - this.searchData.popularTerms[a])
        .slice(0, 3)
        .forEach(term => suggestions.push({ type: 'popular', text: term }));

      // Add smart suggestions based on query patterns
      this.getSmartSuggestions(query).forEach(suggestion => {
        suggestions.push({ type: 'smart', text: suggestion });
      });

      return suggestions.slice(0, this.config.maxSuggestions);
    },

    /**
     * Get smart suggestions based on query patterns
     */
    getSmartSuggestions: function(query) {
      const suggestions = [];
      const lowerQuery = query.toLowerCase();

      // API-related suggestions
      if (lowerQuery.includes('api') || lowerQuery.includes('endpoint')) {
        suggestions.push('API Authentication', 'API Rate Limiting', 'API Endpoints');
      }

      // Installation-related suggestions
      if (lowerQuery.includes('install') || lowerQuery.includes('setup')) {
        suggestions.push('Docker Installation', 'Manual Installation', 'Configuration');
      }

      // Error-related suggestions
      if (lowerQuery.includes('error') || lowerQuery.includes('problem') || lowerQuery.includes('issue')) {
        suggestions.push('Common Issues', 'Troubleshooting Guide', 'Error Codes');
      }

      // Media-related suggestions
      if (lowerQuery.includes('media') || lowerQuery.includes('file') || lowerQuery.includes('video')) {
        suggestions.push('Media Management', 'File Organization', 'Supported Formats');
      }

      // Plex-related suggestions
      if (lowerQuery.includes('plex')) {
        suggestions.push('Plex Integration', 'Plex Authentication', 'Plex Setup Guide');
      }

      return suggestions;
    },

    /**
     * Render suggestions in the container
     */
    renderSuggestions: function(suggestions, container) {
      const content = container.querySelector('.search-suggestions-content');
      
      const html = `
        <div class="live-suggestions">
          <h4>Suggestions</h4>
          <ul class="suggestions-list">
            ${suggestions.map((suggestion, index) => `
              <li class="suggestion-item" data-index="${index}" data-type="${suggestion.type}">
                <button class="suggestion-button">
                  <span class="suggestion-icon">${this.getSuggestionIcon(suggestion.type)}</span>
                  <span class="suggestion-text">${this.highlightQuery(suggestion.text, this.getCurrentQuery())}</span>
                </button>
              </li>
            `).join('')}
          </ul>
        </div>
      `;

      content.innerHTML = html;

      // Bind suggestion click events
      this.bindSuggestionEvents(content);
    },

    /**
     * Get icon for suggestion type
     */
    getSuggestionIcon: function(type) {
      switch (type) {
        case 'recent': return '🕒';
        case 'popular': return '🔥';
        case 'smart': return '💡';
        default: return '🔍';
      }
    },

    /**
     * Highlight query in suggestion text
     */
    highlightQuery: function(text, query) {
      if (!query) return text;
      
      const regex = new RegExp(`(${query})`, 'gi');
      return text.replace(regex, `<mark class="${this.config.highlightClass}">$1</mark>`);
    },

    /**
     * Get current search query
     */
    getCurrentQuery: function() {
      const input = document.querySelector('.md-search__input');
      return input ? input.value.trim() : '';
    },

    /**
     * Bind suggestion click events
     */
    bindSuggestionEvents: function(container) {
      const suggestions = container.querySelectorAll('.suggestion-button');
      suggestions.forEach((button, index) => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const text = button.querySelector('.suggestion-text').textContent;
          this.selectSuggestion(text);
          this.trackSearchEvent(text, 'suggestion_click');
        });
      });
    },

    /**
     * Select a suggestion
     */
    selectSuggestion: function(text) {
      const input = document.querySelector('.md-search__input');
      if (input) {
        input.value = text;
        input.focus();
        this.hideSuggestions();
        
        // Trigger search
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
      }
    },

    /**
     * Show recent searches when input is empty
     */
    showRecentSearches: function() {
      const container = document.querySelector('.md-search__suggestions');
      if (!container) return;

      this.populateRecentSearches(container.querySelector('.recent-list'));
      this.populatePopularSearches(container.querySelector('.popular-list'));
      container.style.display = 'block';
    },

    /**
     * Populate recent searches list
     */
    populateRecentSearches: function(list) {
      if (!list) return;

      const recent = this.searchData.recentSearches.slice(0, 5);
      list.innerHTML = recent.map(term => 
        `<li><button class="recent-search-item" data-term="${term}">${term}</button></li>`
      ).join('');

      // Bind click events
      list.addEventListener('click', (e) => {
        if (e.target.classList.contains('recent-search-item')) {
          const term = e.target.dataset.term;
          this.selectSuggestion(term);
          this.trackSearchEvent(term, 'recent_search_click');
        }
      });
    },

    /**
     * Populate popular searches list
     */
    populatePopularSearches: function(list) {
      if (!list) return;

      const popular = Object.entries(this.searchData.popularTerms)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([term]) => term);

      list.innerHTML = popular.map(term => 
        `<li><button class="popular-search-item" data-term="${term}">${term} (${this.searchData.popularTerms[term]})</button></li>`
      ).join('');

      // Bind click events
      list.addEventListener('click', (e) => {
        if (e.target.classList.contains('popular-search-item')) {
          const term = e.target.dataset.term;
          this.selectSuggestion(term);
          this.trackSearchEvent(term, 'popular_search_click');
        }
      });
    },

    /**
     * Populate quick links
     */
    populateQuickLinks: function(list) {
      if (!list) return;

      const quickLinks = [
        { text: 'Getting Started', url: '/getting-started/' },
        { text: 'API Reference', url: '/api/' },
        { text: 'Installation Guide', url: '/installation/' },
        { text: 'Troubleshooting', url: '/troubleshooting/' },
        { text: 'User Guides', url: '/user-guides/' }
      ];

      list.innerHTML = quickLinks.map(link => 
        `<li><a href="${link.url}" class="quick-link-item">${link.text}</a></li>`
      ).join('');
    },

    /**
     * Hide suggestions container
     */
    hideSuggestions: function() {
      const container = document.querySelector('.md-search__suggestions');
      if (container) {
        container.style.display = 'none';
      }
    },

    /**
     * Record a search query
     */
    recordSearch: function(query) {
      if (!query || query.length < this.config.minQueryLength) return;

      // Update recent searches
      this.searchData.recentSearches = this.searchData.recentSearches.filter(term => term !== query);
      this.searchData.recentSearches.unshift(query);
      this.searchData.recentSearches = this.searchData.recentSearches.slice(0, 20);

      // Update popular terms
      this.searchData.popularTerms[query] = (this.searchData.popularTerms[query] || 0) + 1;

      // Save to storage
      this.saveSearchData();
    },

    /**
     * Add keyboard navigation for search
     */
    addKeyboardNavigation: function() {
      let selectedIndex = -1;

      document.addEventListener('keydown', (e) => {
        const container = document.querySelector('.md-search__suggestions');
        const isVisible = container && container.style.display !== 'none';
        
        if (!isVisible) return;

        const suggestions = container.querySelectorAll('.suggestion-button');
        
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
            this.highlightSuggestion(suggestions, selectedIndex);
            break;
            
          case 'ArrowUp':
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
            this.highlightSuggestion(suggestions, selectedIndex);
            break;
            
          case 'Enter':
            if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
              e.preventDefault();
              suggestions[selectedIndex].click();
              selectedIndex = -1;
            }
            break;
            
          case 'Escape':
            this.hideSuggestions();
            selectedIndex = -1;
            break;
        }
      });
    },

    /**
     * Highlight selected suggestion
     */
    highlightSuggestion: function(suggestions, index) {
      suggestions.forEach((suggestion, i) => {
        suggestion.classList.toggle('selected', i === index);
      });
    },

    /**
     * Update search statistics
     */
    updateSearchStats: function() {
      const stats = document.querySelector('.md-search__stats');
      if (!stats) return;

      const results = document.querySelectorAll('.md-search-result:not([style*="display: none"])');
      const total = document.querySelectorAll('.md-search-result').length;
      const filtered = total - results.length;

      stats.innerHTML = `
        <span class="search-results-count">${results.length} result${results.length !== 1 ? 's' : ''}</span>
        ${filtered > 0 ? `<span class="search-filtered-count">(${filtered} filtered)</span>` : ''}
      `;
    },

    /**
     * Setup search analytics
     */
    setupSearchAnalytics: function() {
      // Track search performance
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.target.classList.contains('md-search-result__list')) {
            this.updateSearchStats();
          }
        });
      });

      const resultsContainer = document.querySelector('.md-search-result__list');
      if (resultsContainer) {
        observer.observe(resultsContainer, { childList: true, subtree: true });
      }
    },

    /**
     * Track search events for analytics
     */
    trackSearchEvent: function(query, action) {
      // Track with Google Analytics if available
      if (typeof gtag !== 'undefined') {
        gtag('event', action, {
          event_category: 'search',
          event_label: query,
          custom_parameter: 'docs_search'
        });
      }

      // Console log for debugging
      console.log(`Search event: ${action} - "${query}"`);
    },

    /**
     * Add search-specific styles
     */
    addSearchStyles: function() {
      const style = document.createElement('style');
      style.textContent = `
        /* Search enhancements styles */
        .md-search__clear {
          position: absolute;
          top: 50%;
          right: 2.2rem;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--md-default-fg-color--light);
          cursor: pointer;
          font-size: 1.2rem;
          padding: 0;
          width: 1rem;
          height: 1rem;
          z-index: 1;
        }

        .md-search__clear:hover {
          color: var(--md-default-fg-color);
        }

        .md-search__suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--md-default-bg-color);
          border: 1px solid var(--md-default-fg-color--lightest);
          border-radius: 0.25rem;
          box-shadow: var(--md-shadow-z2);
          max-height: 400px;
          overflow-y: auto;
          z-index: 1000;
          display: none;
        }

        .search-suggestions-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--medianest-primary);
          color: white;
        }

        .suggestions-title {
          font-weight: 600;
          font-size: 0.875rem;
        }

        .suggestions-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 1.2rem;
          padding: 0;
        }

        .search-suggestions-content {
          padding: 1rem;
        }

        .search-suggestions-content h4 {
          margin: 0 0 0.5rem 0;
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--md-default-fg-color--light);
          font-weight: 600;
        }

        .suggestions-list,
        .recent-list,
        .popular-list,
        .quick-list {
          list-style: none;
          padding: 0;
          margin: 0 0 1rem 0;
        }

        .suggestion-button,
        .recent-search-item,
        .popular-search-item {
          width: 100%;
          padding: 0.5rem;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          border-radius: 0.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--md-default-fg-color);
        }

        .suggestion-button:hover,
        .suggestion-button.selected,
        .recent-search-item:hover,
        .popular-search-item:hover {
          background: var(--md-accent-fg-color--transparent);
        }

        .suggestion-icon {
          font-size: 0.875rem;
        }

        .search-highlight {
          background: var(--medianest-primary);
          color: white;
          padding: 0.125rem 0.25rem;
          border-radius: 0.125rem;
        }

        .quick-link-item {
          display: block;
          padding: 0.5rem;
          color: var(--md-default-fg-color);
          text-decoration: none;
          border-radius: 0.25rem;
        }

        .quick-link-item:hover {
          background: var(--md-accent-fg-color--transparent);
          color: var(--md-accent-fg-color);
        }

        .md-search__filters {
          padding: 0.5rem 0;
          border-top: 1px solid var(--md-default-fg-color--lightest);
        }

        .filters-toggle {
          background: none;
          border: 1px solid var(--md-default-fg-color--lighter);
          padding: 0.5rem 0.75rem;
          border-radius: 0.25rem;
          color: var(--md-default-fg-color);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .filters-toggle:hover,
        .filters-toggle.active {
          background: var(--medianest-primary);
          color: white;
          border-color: var(--medianest-primary);
        }

        .filters-dropdown {
          display: none;
          position: absolute;
          top: 100%;
          left: 0;
          background: var(--md-default-bg-color);
          border: 1px solid var(--md-default-fg-color--lightest);
          border-radius: 0.25rem;
          box-shadow: var(--md-shadow-z2);
          padding: 1rem;
          min-width: 200px;
          z-index: 1000;
        }

        .filter-group label {
          font-weight: 600;
          font-size: 0.875rem;
          margin-bottom: 0.5rem;
          display: block;
        }

        .filter-options {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .filter-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .md-search__stats {
          padding: 0.5rem 0;
          font-size: 0.75rem;
          color: var(--md-default-fg-color--light);
        }

        .search-filtered-count {
          margin-left: 0.5rem;
          opacity: 0.7;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .md-search__suggestions {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            border-radius: 1rem 1rem 0 0;
            max-height: 60vh;
          }

          .search-suggestions-content {
            padding: 0.5rem;
          }

          .filters-dropdown {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            max-width: 90vw;
          }
        }
      `;
      document.head.appendChild(style);
    }
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.MediaNest.Search.init();
    });
  } else {
    window.MediaNest.Search.init();
  }

})(window, document);