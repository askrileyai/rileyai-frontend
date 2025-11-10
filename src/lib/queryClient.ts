// React Query Client Configuration
// Configures React Query with proper defaults and error handling

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: How long data is considered fresh (default 0)
      staleTime: 1 * 60 * 1000, // 1 minute

      // Cache time: How long unused data stays in cache (default 5 minutes)
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)

      // Retry failed requests
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch on window focus
      refetchOnWindowFocus: false,

      // Refetch on reconnect
      refetchOnReconnect: true,

      // Refetch on mount
      refetchOnMount: true,
    },
    mutations: {
      // Retry failed mutations
      retry: 0,

      // Mutation callbacks
      onError: (error) => {
        console.error('[Mutation Error]', error);
      },
    },
  },
});

export default queryClient;
