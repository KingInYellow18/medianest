'use client';

import clsx from 'clsx';
import { Film, Tv, Youtube, Search } from 'lucide-react';
import React from 'react';
import Link from 'next/link';

import { PlexLibrary } from '@/types/plex';

const libraryIcons = {
  movie: Film,
  show: Tv,
  youtube: Youtube,
};

interface LibrarySelectorProps {
  libraries: PlexLibrary[];
  selectedLibrary?: string;
  onLibraryChange: (libraryKey: string) => void;
}

export function LibrarySelector({
  libraries,
  selectedLibrary,
  onLibraryChange,
}: LibrarySelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
        {libraries.map((library) => {
          const Icon = libraryIcons[library.type] || Film;
          const isSelected = selectedLibrary === library.key;

          return (
            <button
              key={library.key}
              onClick={() => onLibraryChange(library.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-all',
                isSelected ? 'bg-blue-500 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700',
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{library.title}</span>
              <span className="text-sm opacity-75">({library.itemCount})</span>
            </button>
          );
        })}
      </div>
      
      {/* Global Search Button */}
      <Link 
        href="/plex/search"
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-all whitespace-nowrap"
      >
        <Search className="w-4 h-4" />
        <span className="font-medium">Search All</span>
      </Link>
    </div>
  );
}
