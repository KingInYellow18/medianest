'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Youtube, Link, Download } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/Select';
import { useDebounce } from '@/hooks/useDebounce';
import { validateYouTubeURL } from '@/lib/api/youtube';
import type { DownloadFormat, UserQuota } from '@/types/youtube';

import { QuotaDisplay } from './QuotaDisplay';

const formSchema = z.object({
  url: z
    .string()
    .min(1, 'URL is required')
    .refine((url) => validateYouTubeURL(url), 'Invalid YouTube URL'),
  quality: z.enum(['best', '1080p', '720p', '480p']),
  container: z.enum(['mp4', 'mkv']),
});

type FormData = z.infer<typeof formSchema>;

interface URLSubmissionFormProps {
  onSubmit: (url: string, format: DownloadFormat) => Promise<void>;
  userQuota: UserQuota;
  onUrlChange?: (url: string) => void;
  onRefreshQuota: () => void;
}

export function URLSubmissionForm({
  onSubmit,
  userQuota = { canDownload: false, limit: 0, used: 0, resetAt: new Date() },
  onUrlChange,
  onRefreshQuota,
}: URLSubmissionFormProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [urlError, setUrlError] = useState<string>();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      quality: 'best',
      container: 'mp4',
    },
  });

  const urlValue = watch('url');
  const qualityValue = watch('quality');
  const containerValue = watch('container');
  const debouncedUrl = useDebounce(urlValue, 500);

  // Validate URL in real-time
  useEffect(() => {
    if (!debouncedUrl) {
      setUrlError(undefined);
      return;
    }

    setIsValidating(true);

    try {
      const isValid = validateYouTubeURL(debouncedUrl);
      setUrlError(isValid ? undefined : 'Invalid YouTube URL format');
    } catch {
      setUrlError('Invalid URL format');
    } finally {
      setIsValidating(false);
    }
  }, [debouncedUrl]);

  // Notify parent of URL changes
  useEffect(() => {
    if (onUrlChange) {
      onUrlChange(urlValue || '');
    }
  }, [urlValue, onUrlChange]);

  const onFormSubmit = async (data: FormData) => {
    if (!userQuota?.canDownload) {
      setUrlError('Download quota exceeded. Please try again later.');
      return;
    }

    try {
      await onSubmit(data.url, {
        quality: data.quality,
        container: data.container,
      });
      reset();
    } catch (error: any) {
      setUrlError(error.message || 'Failed to queue download');
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Youtube className="w-6 h-6 text-red-500" />
          <h2 className="text-lg font-semibold text-white">Submit YouTube URL</h2>
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Video or Playlist URL</label>
          <div className="relative">
            <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              {...register('url')}
              placeholder="https://youtube.com/watch?v=... or playlist?list=..."
              className="pl-10"
              disabled={isSubmitting}
            />
            {isValidating && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          {(errors.url || urlError) && (
            <p className="text-sm text-red-500">{errors.url?.message || urlError}</p>
          )}
        </div>

        {/* Format Options */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Quality</label>
            <Select
              value={qualityValue}
              onChange={(value) => setValue('quality', value as any)}
              options={[
                { value: 'best', label: 'Best Available' },
                { value: '1080p', label: '1080p' },
                { value: '720p', label: '720p' },
                { value: '480p', label: '480p' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-gray-400">Format</label>
            <Select
              value={containerValue}
              onChange={(value) => setValue('container', value as any)}
              options={[
                { value: 'mp4', label: 'MP4' },
                { value: 'mkv', label: 'MKV' },
              ]}
            />
          </div>
        </div>

        {/* Quota Display */}
        <div className="mt-6">
          <QuotaDisplay quota={userQuota} onRefresh={onRefreshQuota} />
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="default"
          className="w-full mt-6"
          disabled={!userQuota?.canDownload || isSubmitting || isValidating || !!urlError}
        >
          <Download className="w-4 h-4 mr-2" />
          {isSubmitting ? 'Queuing Download...' : 'Queue Download'}
        </Button>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-4 text-center">
          Downloads will be automatically added to your Plex library when complete
        </p>
      </div>
    </form>
  );
}
