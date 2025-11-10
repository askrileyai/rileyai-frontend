'use client';

// Trading Sessions Hooks
// React Query hooks for managing trading sessions

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import type { TradingSession } from '@/types';

// ===== QUERY KEYS =====

export const sessionKeys = {
  all: ['sessions'] as const,
  list: () => [...sessionKeys.all, 'list'] as const,
  active: () => [...sessionKeys.all, 'active'] as const,
  detail: (id: number) => [...sessionKeys.all, 'detail', id] as const,
};

// ===== SESSION LIST HOOKS =====

export function useSessions() {
  return useQuery({
    queryKey: sessionKeys.list(),
    queryFn: () => apiClient.getSessions(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}

export function useActiveSession() {
  return useQuery({
    queryKey: sessionKeys.active(),
    queryFn: () => apiClient.getActiveSession(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds when active
    retry: 1,
  });
}

// ===== SESSION MUTATIONS =====

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ symbol, timeframe }: { symbol: string; timeframe?: string }) =>
      apiClient.createSession(symbol, timeframe),
    onSuccess: () => {
      // Invalidate session queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
      queryClient.invalidateQueries({ queryKey: sessionKeys.active() });
    },
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => apiClient.endSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
      queryClient.invalidateQueries({ queryKey: sessionKeys.active() });
    },
  });
}

export function usePauseSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => apiClient.pauseSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
      queryClient.invalidateQueries({ queryKey: sessionKeys.active() });
    },
  });
}

export function useResumeSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => apiClient.resumeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.list() });
      queryClient.invalidateQueries({ queryKey: sessionKeys.active() });
    },
  });
}
