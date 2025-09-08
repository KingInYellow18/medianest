import { useQuery } from '@tanstack/react-query';

import { useDebounce } from '@/hooks/useDebounce';
import { validateAndFetchMetadata, checkDuplicateURL } from '@/lib/api/youtube';

export function useYouTubeValidation(url: string) {
  const debouncedUrl = useDebounce(url, 500);

  const {
    data: metadata,
    isLoading: isValidatingMetadata,
    error: metadataError,
  } = useQuery({
    queryKey: ['youtube', 'validate', debouncedUrl],
    queryFn: () => validateAndFetchMetadata(debouncedUrl),
    enabled: !!debouncedUrl && debouncedUrl.length > 10,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  const {
    data: duplicateCheck,
    isLoading: isCheckingDuplicate,
    error: duplicateError,
  } = useQuery({
    queryKey: ['youtube', 'duplicate', debouncedUrl],
    queryFn: () => checkDuplicateURL(debouncedUrl),
    enabled: !!metadata && !metadataError, // Only check for duplicates if URL is valid
    staleTime: 1 * 60 * 1000, // 1 minute
    retry: false,
  });

  const isDuplicate = duplicateCheck?.isDuplicate || false;
  const isValidating = isValidatingMetadata || isCheckingDuplicate;
  const error =
    metadataError?.message ||
    (isDuplicate
      ? 'This URL is already in your download queue or history'
      : duplicateError?.message);

  return {
    metadata,
    isValidating,
    isValid: !!metadata && !metadataError && !isDuplicate,
    isDuplicate,
    existingDownload: duplicateCheck?.existingDownload,
    error,
  };
}
