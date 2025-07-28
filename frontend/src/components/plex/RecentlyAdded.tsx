'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useRef } from 'react';

import { useRecentlyAdded } from '@/hooks/usePlexLibrary';

import { MediaCard } from './MediaCard';
import { MediaCardSkeleton } from './MediaCardSkeleton';

interface RecentlyAddedProps {
  libraryKey: string;
}

export function RecentlyAdded({ libraryKey }: RecentlyAddedProps) {
  const { data, isLoading } = useRecentlyAdded(libraryKey);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;

    const scrollAmount = 300;
    const newPosition =
      scrollRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);

    scrollRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth',
    });
  };

  if (isLoading) {
    return <RecentlyAddedSkeleton />;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Recently Added</h2>
        <div className="flex gap-2">
          <button
            onClick={() => scroll('left')}
            className="p-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="p-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div ref={scrollRef} className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {data.map((item) => (
            <div key={item.key} className="flex-none w-40">
              <MediaCard
                media={item}
                onClick={() => {
                  // TODO: Implement media detail modal
                  console.log('Media clicked:', item);
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RecentlyAddedSkeleton() {
  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-32 bg-gray-800 rounded animate-pulse" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-none w-40">
            <MediaCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  );
}
