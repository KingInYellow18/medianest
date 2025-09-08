'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useDebounce } from '@/hooks/useDebounce';

interface LibrarySearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function LibrarySearch({ value, onChange, placeholder }: LibrarySearchProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, 300);

  useEffect(() => {
    onChange(debouncedValue);
  }, [debouncedValue, onChange]);

  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="block w-full pl-10 pr-10 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {localValue && (
        <button onClick={handleClear} className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <X className="h-5 w-5 text-gray-400 hover:text-white" />
        </button>
      )}
    </div>
  );
}
