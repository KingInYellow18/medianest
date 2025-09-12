/**
 * MediaNest Documentation - Advanced Search Enhancements
 * Enhanced search functionality with filtering, suggestions, and smart features
 */

(function () {
  'use strict';

  class AdvancedSearch {
    constructor() {
      this.searchInput = null;
      this.searchResults = null;
      this.searchOverlay = null;
      this.searchHistory = [];
      this.searchSuggestions = [];
      this.filters = new Map();
      this.searchIndex = new Map();
      this.init();
    }

    init() {
      document.addEventListener('DOMContentLoaded', () => {
        this.initializeElements();
        this.setupSearchEnhancements();
        this.loadSearchData();
        this.setupKeyboardShortcuts();
        this.setupSearchFilters();
        this.setupSmartSuggestions();
      });
    }

    initializeElements() {
      this.searchInput = document.querySelector('.md-search__input');
      this.searchResults = document.querySelector('.md-search-result');
      this.searchOverlay = document.querySelector('.md-search__overlay');

      if (!this.searchInput) {
        console.warn('Search input not found');
        return;
      }
    }

    setupSearchEnhancements() {
      // Enhanced search input with real-time suggestions
      this.searchInput.addEventListener(
        'input',
        this.debounce((e) => {
          this.handleSearchInput(e.target.value);
        }, 150),
      );

      // Search history navigation
      this.searchInput.addEventListener('keydown', (e) => {
        this.handleKeyNavigation(e);
      });

      // Focus enhancements
      this.searchInput.addEventListener('focus', () => {
        this.showSearchEnhancements();
      });

      this.searchInput.addEventListener('blur', () => {
        setTimeout(() => this.hideSearchEnhancements(), 150);
      });
    }

    setupKeyboardShortcuts() {
      document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          this.focusSearch();
        }

        // Escape to close search
        if (e.key === 'Escape' && document.activeElement === this.searchInput) {
          this.clearSearch();
        }

        // Ctrl/Cmd + / for search shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
          e.preventDefault();
          this.showSearchShortcuts();
        }
      });
    }

    setupSearchFilters() {
      this.filters.set('type', {
        api: 'API Documentation',
        guide: 'User Guides',
        tutorial: 'Tutorials',
        reference: 'Reference',
        example: 'Examples',
      });

      this.filters.set('category', {
        setup: 'Setup & Installation',
        config: 'Configuration',
        security: 'Security',
        performance: 'Performance',
        troubleshooting: 'Troubleshooting',
      });

      this.filters.set('difficulty', {
        beginner: 'Beginner',
        intermediate: 'Intermediate',
        advanced: 'Advanced',
      });
    }

    setupSmartSuggestions() {
      this.searchSuggestions = [
        // Common search terms
        'Docker installation',
        'API authentication',
        'Plex integration setup',
        'Database configuration',
        'Environment variables',
        'Security settings',
        'Performance optimization',
        'Troubleshooting guide',
        'User management',
        'File organization',

        // API endpoints
        'GET /api/media',
        'POST /api/auth/login',
        'GET /api/dashboard',
        'GET /api/plex/libraries',
        'PUT /api/users/{id}',

        // Configuration examples
        'docker-compose.yml',
        '.env configuration',
        'nginx setup',
        'ssl certificate',
        'backup strategy',

        // Error messages
        '403 forbidden',
        '500 internal server error',
        'connection refused',
        'database connection error',
        'authentication failed',
      ];
    }

    handleSearchInput(query) {
      if (query.length === 0) {
        this.showDefaultSuggestions();
        return;
      }

      if (query.length < 2) {
        this.showQuickSuggestions(query);
        return;
      }

      // Save to search history
      this.addToSearchHistory(query);

      // Parse search query for filters
      const parsedQuery = this.parseSearchQuery(query);

      // Show filtered suggestions
      this.showFilteredSuggestions(parsedQuery);

      // Trigger smart search
      this.performSmartSearch(parsedQuery);
    }

    parseSearchQuery(query) {
      const filters = {};
      let cleanQuery = query;

      // Parse filter syntax: type:api, category:setup, etc.
      const filterPattern = /(\w+):(\w+)/g;
      let match;

      while ((match = filterPattern.exec(query)) !== null) {
        const [fullMatch, filterType, filterValue] = match;
        filters[filterType] = filterValue;
        cleanQuery = cleanQuery.replace(fullMatch, '').trim();
      }

      return {
        query: cleanQuery,
        filters: filters,
        original: query,
      };
    }

    performSmartSearch(parsedQuery) {
      // Enhanced search with context awareness
      const results = this.searchWithContext(parsedQuery);
      this.displayEnhancedResults(results);
    }

    searchWithContext(parsedQuery) {
      const { query, filters } = parsedQuery;
      const results = [];

      // Search through indexed content
      for (const [content, metadata] of this.searchIndex) {
        const score = this.calculateRelevanceScore(content, metadata, query, filters);
        if (score > 0) {
          results.push({
            content,
            metadata,
            score,
            highlights: this.generateHighlights(content, query),
          });
        }
      }

      // Sort by relevance score
      return results.sort((a, b) => b.score - a.score);
    }

    calculateRelevanceScore(content, metadata, query, filters) {
      let score = 0;
      const queryLower = query.toLowerCase();
      const contentLower = content.toLowerCase();

      // Exact phrase match
      if (contentLower.includes(queryLower)) {
        score += 100;
      }

      // Title match bonus
      if (metadata.title && metadata.title.toLowerCase().includes(queryLower)) {
        score += 50;
      }

      // Word matches
      const queryWords = queryLower.split(/\s+/);
      queryWords.forEach((word) => {
        if (word.length > 2 && contentLower.includes(word)) {
          score += 10;
        }
      });

      // Filter matches
      Object.entries(filters).forEach(([filterType, filterValue]) => {
        if (metadata[filterType] === filterValue) {
          score += 25;
        }
      });

      // Freshness bonus
      if (metadata.lastModified) {
        const daysSinceModified =
          (Date.now() - new Date(metadata.lastModified)) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 30) {
          score += 5;
        }
      }

      return score;
    }

    generateHighlights(content, query) {
      const queryWords = query.toLowerCase().split(/\s+/);
      let highlighted = content;

      queryWords.forEach((word) => {
        if (word.length > 2) {
          const regex = new RegExp(`(${word})`, 'gi');
          highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        }
      });

      return highlighted;
    }

    showDefaultSuggestions() {
      const suggestions = [
        ...this.getRecentSearches(),
        ...this.getPopularSearches(),
        ...this.getQuickLinks(),
      ];

      this.displaySuggestions(suggestions, 'Recent & Popular');
    }

    showQuickSuggestions(query) {
      const quickSuggestions = this.searchSuggestions
        .filter((suggestion) => suggestion.toLowerCase().startsWith(query.toLowerCase()))
        .slice(0, 8);

      this.displaySuggestions(quickSuggestions, 'Quick Suggestions');
    }

    showFilteredSuggestions(parsedQuery) {
      const { query, filters } = parsedQuery;

      if (Object.keys(filters).length > 0) {
        this.showFilterChips(filters);
      }

      const suggestions = this.searchSuggestions
        .filter((suggestion) => {
          const suggestionLower = suggestion.toLowerCase();
          const queryLower = query.toLowerCase();

          return (
            suggestionLower.includes(queryLower) ||
            queryLower.split(' ').some((word) => word.length > 2 && suggestionLower.includes(word))
          );
        })
        .slice(0, 6);

      this.displaySuggestions(suggestions, 'Suggestions');
    }

    showFilterChips(filters) {
      const chipsContainer = this.getOrCreateChipsContainer();
      chipsContainer.innerHTML = '';

      Object.entries(filters).forEach(([filterType, filterValue]) => {
        const chip = this.createFilterChip(filterType, filterValue);
        chipsContainer.appendChild(chip);
      });
    }

    createFilterChip(filterType, filterValue) {
      const chip = document.createElement('span');
      chip.className = 'search-filter-chip';
      chip.innerHTML = `
                ${filterType}:${filterValue}
                <button onclick="this.parentNode.remove()" aria-label="Remove filter">✕</button>
            `;
      chip.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                padding: 0.25rem 0.5rem;
                margin: 0.125rem;
                background: var(--md-accent-fg-color--transparent);
                color: var(--md-accent-fg-color);
                border-radius: 1rem;
                font-size: 0.75rem;
                font-weight: 500;
            `;

      return chip;
    }

    getOrCreateChipsContainer() {
      let container = document.querySelector('.search-filter-chips');
      if (!container) {
        container = document.createElement('div');
        container.className = 'search-filter-chips';
        container.style.cssText = `
                    padding: 0.5rem;
                    border-bottom: 1px solid var(--md-default-fg-color--lightest);
                `;

        const searchForm = this.searchInput.closest('.md-search__form');
        if (searchForm) {
          searchForm.appendChild(container);
        }
      }
      return container;
    }

    displaySuggestions(suggestions, title) {
      const container = this.getOrCreateSuggestionsContainer();

      container.innerHTML = `
                <div class="search-suggestions-header">
                    <h4>${title}</h4>
                </div>
                <div class="search-suggestions-list">
                    ${suggestions
                      .map(
                        (suggestion) => `
                        <div class="search-suggestion-item" data-suggestion="${suggestion}">
                            <span class="suggestion-text">${suggestion}</span>
                            <span class="suggestion-action">↵</span>
                        </div>
                    `,
                      )
                      .join('')}
                </div>
            `;

      // Add click handlers
      container.querySelectorAll('.search-suggestion-item').forEach((item) => {
        item.addEventListener('click', () => {
          this.selectSuggestion(item.getAttribute('data-suggestion'));
        });
      });
    }

    getOrCreateSuggestionsContainer() {
      let container = document.querySelector('.search-suggestions-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'search-suggestions-container';
        container.style.cssText = `
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: var(--md-default-bg-color);
                    border: 1px solid var(--md-default-fg-color--lightest);
                    border-top: none;
                    border-radius: 0 0 0.5rem 0.5rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    z-index: 1000;
                    max-height: 400px;
                    overflow-y: auto;
                `;

        const searchForm = this.searchInput.closest('.md-search__form');
        if (searchForm) {
          searchForm.style.position = 'relative';
          searchForm.appendChild(container);
        }
      }
      return container;
    }

    selectSuggestion(suggestion) {
      this.searchInput.value = suggestion;
      this.searchInput.dispatchEvent(new Event('input'));
      this.searchInput.focus();
      this.hideSearchEnhancements();
    }

    showSearchEnhancements() {
      const container = this.getOrCreateSuggestionsContainer();
      container.style.display = 'block';

      if (this.searchInput.value.length === 0) {
        this.showDefaultSuggestions();
      }
    }

    hideSearchEnhancements() {
      const container = document.querySelector('.search-suggestions-container');
      if (container) {
        container.style.display = 'none';
      }
    }

    focusSearch() {
      if (this.searchInput) {
        this.searchInput.focus();
        this.searchInput.select();
        this.showSearchEnhancements();
      }
    }

    clearSearch() {
      if (this.searchInput) {
        this.searchInput.value = '';
        this.searchInput.blur();
        this.hideSearchEnhancements();
      }
    }

    handleKeyNavigation(e) {
      const suggestions = document.querySelectorAll('.search-suggestion-item');
      const activeSuggestion = document.querySelector('.search-suggestion-item.active');

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateSuggestions(suggestions, activeSuggestion, 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateSuggestions(suggestions, activeSuggestion, -1);
      } else if (e.key === 'Enter' && activeSuggestion) {
        e.preventDefault();
        this.selectSuggestion(activeSuggestion.getAttribute('data-suggestion'));
      } else if (e.key === 'Tab' && suggestions.length > 0) {
        e.preventDefault();
        this.selectSuggestion(suggestions[0].getAttribute('data-suggestion'));
      }
    }

    navigateSuggestions(suggestions, activeSuggestion, direction) {
      if (suggestions.length === 0) return;

      // Remove current active state
      if (activeSuggestion) {
        activeSuggestion.classList.remove('active');
      }

      // Find next suggestion
      let nextIndex = 0;
      if (activeSuggestion) {
        const currentIndex = Array.from(suggestions).indexOf(activeSuggestion);
        nextIndex = (currentIndex + direction + suggestions.length) % suggestions.length;
      }

      // Activate next suggestion
      suggestions[nextIndex].classList.add('active');
      suggestions[nextIndex].scrollIntoView({ block: 'nearest' });
    }

    addToSearchHistory(query) {
      if (query.length < 3) return;

      // Remove if already exists
      this.searchHistory = this.searchHistory.filter((item) => item.query !== query);

      // Add to beginning
      this.searchHistory.unshift({
        query: query,
        timestamp: Date.now(),
      });

      // Keep only last 20 searches
      this.searchHistory = this.searchHistory.slice(0, 20);

      // Save to localStorage
      try {
        localStorage.setItem('medianest-search-history', JSON.stringify(this.searchHistory));
      } catch (e) {
        console.warn('Could not save search history:', e);
      }
    }

    getRecentSearches() {
      try {
        const saved = localStorage.getItem('medianest-search-history');
        this.searchHistory = saved ? JSON.parse(saved) : [];
        return this.searchHistory.slice(0, 5).map((item) => item.query);
      } catch (e) {
        console.warn('Could not load search history:', e);
        return [];
      }
    }

    getPopularSearches() {
      // In production, this would come from analytics
      return [
        'Docker setup',
        'API authentication',
        'Plex integration',
        'Environment configuration',
        'User management',
      ];
    }

    getQuickLinks() {
      return [
        'Getting Started',
        'API Reference',
        'Installation Guide',
        'Configuration',
        'Troubleshooting',
      ];
    }

    showSearchShortcuts() {
      const modal = this.createShortcutsModal();
      document.body.appendChild(modal);
    }

    createShortcutsModal() {
      const modal = document.createElement('div');
      modal.className = 'search-shortcuts-modal';
      modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;

      const content = document.createElement('div');
      content.style.cssText = `
                background: var(--md-default-bg-color);
                padding: 2rem;
                border-radius: 8px;
                max-width: 500px;
                max-height: 80vh;
                overflow-y: auto;
            `;

      content.innerHTML = `
                <h3>Search Shortcuts</h3>
                <div class="shortcuts-list">
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + K</kbd>
                        <span>Focus search</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Ctrl/Cmd + /</kbd>
                        <span>Show shortcuts</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>↑/↓</kbd>
                        <span>Navigate suggestions</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Enter</kbd>
                        <span>Select suggestion</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Tab</kbd>
                        <span>Select first suggestion</span>
                    </div>
                    <div class="shortcut-item">
                        <kbd>Escape</kbd>
                        <span>Clear search</span>
                    </div>
                </div>
                <h4>Search Filters</h4>
                <div class="filters-list">
                    <div class="filter-item">
                        <code>type:api</code>
                        <span>API documentation</span>
                    </div>
                    <div class="filter-item">
                        <code>category:setup</code>
                        <span>Setup guides</span>
                    </div>
                    <div class="filter-item">
                        <code>difficulty:beginner</code>
                        <span>Beginner content</span>
                    </div>
                </div>
                <button onclick="this.closest('.search-shortcuts-modal').remove()" 
                        style="margin-top: 1rem; padding: 0.5rem 1rem; border: none; background: var(--md-accent-fg-color); color: var(--md-accent-bg-color); border-radius: 4px; cursor: pointer;">
                    Close
                </button>
            `;

      modal.appendChild(content);

      // Close on backdrop click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });

      return modal;
    }

    loadSearchData() {
      // In production, this would load search index from API
      // For now, we'll extract from current page content
      this.indexCurrentPage();
    }

    indexCurrentPage() {
      const sections = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li');
      sections.forEach((section) => {
        const content = section.textContent.trim();
        if (content.length > 10) {
          this.searchIndex.set(content, {
            title: this.findSectionTitle(section),
            type: this.detectContentType(section),
            url: window.location.pathname,
            element: section,
          });
        }
      });
    }

    findSectionTitle(element) {
      let current = element;
      while (current && current !== document.body) {
        if (current.tagName && current.tagName.match(/^H[1-6]$/)) {
          return current.textContent.trim();
        }
        current = current.previousElementSibling || current.parentElement;
      }
      return document.title;
    }

    detectContentType(element) {
      const text = element.textContent.toLowerCase();

      if (text.includes('api') || text.includes('endpoint')) return 'api';
      if (text.includes('install') || text.includes('setup')) return 'setup';
      if (text.includes('config') || text.includes('environment')) return 'config';
      if (text.includes('example') || text.includes('sample')) return 'example';
      if (text.includes('tutorial') || text.includes('walkthrough')) return 'tutorial';

      return 'guide';
    }

    displayEnhancedResults(results) {
      // This would integrate with MkDocs Material's search results
      // For now, we'll enhance the existing results display
      if (results.length > 0) {
        console.log('Enhanced search results:', results);
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

  // Add enhanced search styles
  const style = document.createElement('style');
  style.textContent = `
        .search-suggestions-container {
            font-family: var(--md-text-font-family);
        }
        
        .search-suggestions-header h4 {
            margin: 0;
            padding: 0.75rem 1rem 0.5rem;
            font-size: 0.8rem;
            font-weight: 600;
            color: var(--md-default-fg-color--light);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .search-suggestion-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem 1rem;
            cursor: pointer;
            transition: background-color 0.2s ease;
            border-bottom: 1px solid var(--md-default-fg-color--lightest);
        }
        
        .search-suggestion-item:hover,
        .search-suggestion-item.active {
            background: var(--md-accent-fg-color--transparent);
        }
        
        .search-suggestion-item:last-child {
            border-bottom: none;
        }
        
        .suggestion-text {
            flex: 1;
            font-size: 0.9rem;
        }
        
        .suggestion-action {
            font-size: 0.8rem;
            color: var(--md-default-fg-color--light);
            font-family: var(--md-code-font-family);
        }
        
        .search-filter-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.25rem;
        }
        
        .search-filter-chip button {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 0;
            margin: 0;
            font-size: 0.7rem;
            opacity: 0.7;
        }
        
        .search-filter-chip button:hover {
            opacity: 1;
        }
        
        .shortcuts-list,
        .filters-list {
            display: grid;
            gap: 0.5rem;
            margin: 1rem 0;
        }
        
        .shortcut-item,
        .filter-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.5rem;
            background: var(--md-code-bg-color);
            border-radius: 4px;
        }
        
        .shortcut-item kbd {
            background: var(--md-default-fg-color);
            color: var(--md-default-bg-color);
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            font-size: 0.75rem;
            font-family: var(--md-code-font-family);
        }
        
        .filter-item code {
            background: var(--md-accent-fg-color--transparent);
            color: var(--md-accent-fg-color);
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            font-size: 0.75rem;
        }
    `;
  document.head.appendChild(style);

  // Initialize enhanced search
  const advancedSearch = new AdvancedSearch();

  // Make available globally
  window.MediaNestDocs = window.MediaNestDocs || {};
  window.MediaNestDocs.advancedSearch = advancedSearch;
})();
