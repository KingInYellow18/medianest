'use client';

export function CollectionCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border animate-pulse">
      <div className="aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-t-lg" />
      <div className="p-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded mb-2 w-3/4" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
      </div>
    </div>
  );
}