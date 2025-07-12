'use client';

import { useRef, useState, useEffect } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

import { SearchSuggestion } from '@/types/plex-search';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  suggestions?: SearchSuggestion[];
  isLoading?: boolean;
  placeholder?: string;
}

export function SearchBar({ 
  value, 
  onChange, 
  onClear, 
  suggestions = [], 
  isLoading = false,
  placeholder = "Search movies, shows, actors..."
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const showSuggestions = isFocused && (suggestions.length > 0 || value.length > 0);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showSuggestions) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && suggestions[selectedIndex]) {
            onChange(suggestions[selectedIndex].text);
            setIsFocused(false);
          }
          break;
        case 'Escape':
          setIsFocused(false);
          inputRef.current?.blur();
          break;
      }
    };
    
    if (isFocused) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFocused, selectedIndex, suggestions, onChange]);

  // Reset selected index when suggestions change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          placeholder={placeholder}
          className="block w-full pl-10 pr-10 py-3 text-base 
                     bg-gray-800 border border-gray-700 rounded-lg
                     text-white placeholder-gray-400
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-all duration-150"
          aria-label="Search"
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={showSuggestions}
        />
        
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-2">
          {isLoading && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          )}
          
          {value && (
            <button
              onClick={onClear}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            ref={suggestionsRef}
            id="search-suggestions"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden"
          >
            {suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.text}`}
                  onClick={() => {
                    onChange(suggestion.text);
                    setIsFocused(false);
                  }}
                  className={clsx(
                    'w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-700 transition-colors text-left',
                    selectedIndex === index && 'bg-gray-700'
                  )}
                >
                  {suggestion.type === 'history' && (
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  {suggestion.type === 'suggestion' && (
                    <TrendingUp className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  )}
                  <span className="text-white flex-1">{suggestion.text}</span>
                  {suggestion.type === 'filter' && suggestion.metadata?.type && (
                    <span className="text-xs text-gray-400">{suggestion.metadata.type}</span>
                  )}
                </button>
              ))
            ) : value.length > 0 ? (
              <div className="px-4 py-3 text-gray-400 text-sm">
                No suggestions found
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}