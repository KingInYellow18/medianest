'use client';

import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { PlexCollectionSummary } from '@/types/plex';

interface CollectionCardProps {
  collection: PlexCollectionSummary;
  onClick: () => void;
}

export function CollectionCard({ collection, onClick }: CollectionCardProps) {
  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
      onClick={onClick}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-t-lg">
        {collection.thumb ? (
          <Image
            src={collection.thumb}
            alt={collection.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-2xl mb-2">📚</div>
              <div className="text-sm">Collection</div>
            </div>
          </div>
        )}

        {/* Item count badge */}
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
          {collection.childCount} items
        </div>
      </div>

      <CardContent className="p-4">
        <h3 className="font-semibold text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
          {collection.title}
        </h3>

        {collection.summary && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3 mb-2">
            {collection.summary}
          </p>
        )}

        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Added {collection.addedAt.toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
