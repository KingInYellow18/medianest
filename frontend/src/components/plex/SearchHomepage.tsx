'use client';

import { Clock, TrendingUp } from 'lucide-react';

interface SearchHomepageProps {
  recentSearches: string[];
  onSearchSelect: (query: string) => void;
}

export function SearchHomepage({ recentSearches, onSearchSelect }: SearchHomepageProps) {
  const popularSearches = [
    'Marvel',
    'Star Wars',
    'Comedy',
    'Action',
    'Drama',
    'Horror',
    '2023',
    '2024',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Recent Searches</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.slice(0, 6).map((search) => (
              <button
                key={search}
                onClick={() => onSearchSelect(search)}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
              >
                {search}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Popular Searches */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Popular Searches</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {popularSearches.map((search) => (
            <button
              key={search}
              onClick={() => onSearchSelect(search)}
              className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            >
              {search}
            </button>
          ))}
        </div>
      </section>

      {/* Tips */}
      <section className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Search Tips</h2>
        <div className="space-y-2 text-sm text-gray-300">
          <p>• Search by title, actor, director, or genre</p>
          <p>• Use filters to narrow down results by year, rating, or content type</p>
          <p>• Try searching for specific years like "2023" or "2024"</p>
          <p>• Search works across all your Plex libraries</p>
        </div>
      </section>
    </div>
  );
}
