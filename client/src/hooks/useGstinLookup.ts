/**
 * useGstinLookup Hook
 *
 * React Query mutation hook for GSTIN lookup with error handling
 */

import { useMutation } from '@tanstack/react-query';
import type { GstinDetails } from '@/lib/gst-utils';

interface GstinLookupError {
  message: string;
  status?: number;
}

/**
 * Fetch GSTIN details from the API
 */
async function lookupGstin(gstin: string): Promise<GstinDetails> {
  const response = await fetch(`/api/gst/gstin/lookup/${encodeURIComponent(gstin)}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error: GstinLookupError = {
      message: errorData.error || 'Failed to lookup GSTIN',
      status: response.status,
    };
    throw error;
  }

  return response.json();
}

interface UseGstinLookupOptions {
  onSuccess?: (data: GstinDetails) => void;
  onError?: (error: GstinLookupError) => void;
}

/**
 * Hook for GSTIN lookup with React Query mutation
 *
 * @example
 * const { lookup, isLoading, data, error } = useGstinLookup({
 *   onSuccess: (details) => {
 *     form.setValue('name', details.legalName);
 *     form.setValue('address', formatGstinAddress(details));
 *   },
 *   onError: (error) => {
 *     toast({ title: 'Lookup failed', description: error.message, variant: 'destructive' });
 *   },
 * });
 */
export function useGstinLookup(options: UseGstinLookupOptions = {}) {
  const mutation = useMutation<GstinDetails, GstinLookupError, string>({
    mutationFn: lookupGstin,
    onSuccess: options.onSuccess,
    onError: options.onError,
  });

  return {
    lookup: mutation.mutate,
    lookupAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    data: mutation.data,
    error: mutation.error,
    reset: mutation.reset,
  };
}

export type { GstinDetails, GstinLookupError };
