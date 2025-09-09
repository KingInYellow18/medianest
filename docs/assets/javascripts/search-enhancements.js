/* Enhanced Search Features for MediaNest Documentation */

document.addEventListener('DOMContentLoaded', function() {
  // Search result enhancement
  const searchResults = document.querySelector('.md-search-result');
  if (searchResults) {
    // Add keyboard navigation
    document.addEventListener('keydown', function(e) {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.md-search__input');
        if (searchInput) {
          searchInput.focus();
        }
      }
    });
  }

  // Search analytics
  const searchForm = document.querySelector('.md-search__form');
  if (searchForm) {
    searchForm.addEventListener('submit', function(e) {
      const query = e.target.querySelector('input').value;
      if (query.trim()) {
        window.MediaNestDocs?.trackEvent('search', 'Documentation', query);
      }
    });
  }
});