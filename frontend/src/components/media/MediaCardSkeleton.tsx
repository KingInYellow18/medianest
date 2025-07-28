'use client';

export function MediaCardSkeleton() {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
      {/* Poster skeleton */}
      <div className="aspect-[2/3] bg-gray-700" />

      {/* Info skeleton */}
      <div className="p-4">
        {/* Title */}
        <div className="h-5 bg-gray-700 rounded mb-3" />

        {/* Meta info */}
        <div className="flex items-center gap-4 mb-3">
          <div className="h-4 w-12 bg-gray-700 rounded" />
          <div className="h-4 w-8 bg-gray-700 rounded" />
          <div className="h-4 w-16 bg-gray-700 rounded" />
        </div>

        {/* Button */}
        <div className="h-9 bg-gray-700 rounded" />
      </div>
    </div>
  );
}
