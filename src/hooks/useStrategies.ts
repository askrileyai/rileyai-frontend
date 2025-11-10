'use client';

// Trading Strategies Hooks
// React Query hooks for managing trading strategies and signals

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import type { Strategy, StrategySignal } from '@/types';

// ===== QUERY KEYS =====

export const strategyKeys = {
  all: ['strategies'] as const,
  list: () => [...strategyKeys.all, 'list'] as const,
  detail: (id: number) => [...strategyKeys.all, 'detail', id] as const,
  signals: (id: number) => [...strategyKeys.all, 'signals', id] as const,
  activeSignals: () => [...strategyKeys.all, 'signals', 'active'] as const,
};

// ===== STRATEGY LIST HOOKS =====

export function useStrategies() {
  return useQuery({
    queryKey: strategyKeys.list(),
    queryFn: () => apiClient.getStrategies(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useStrategy(strategyId: number) {
  return useQuery({
    queryKey: strategyKeys.detail(strategyId),
    queryFn: () => apiClient.getStrategy(strategyId),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!strategyId,
    retry: 1,
  });
}

// ===== STRATEGY MUTATIONS =====

export function useCreateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (strategyData: Partial<Strategy>) => apiClient.createStrategy(strategyData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.list() });
    },
  });
}

export function useUpdateStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ strategyId, updates }: { strategyId: number; updates: Partial<Strategy> }) =>
      apiClient.updateStrategy(strategyId, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.list() });
      queryClient.invalidateQueries({ queryKey: strategyKeys.detail(variables.strategyId) });
    },
  });
}

export function useDeleteStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (strategyId: number) => apiClient.deleteStrategy(strategyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: strategyKeys.list() });
    },
  });
}

// ===== SIGNALS HOOKS =====

export function useStrategySignals(strategyId: number) {
  return useQuery({
    queryKey: strategyKeys.signals(strategyId),
    queryFn: () => apiClient.getStrategySignals(strategyId),
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: !!strategyId,
    retry: 1,
  });
}

export function useActiveSignals() {
  return useQuery({
    queryKey: strategyKeys.activeSignals(),
    queryFn: () => apiClient.getActiveSignals(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 1 * 60 * 1000, // Refetch every 1 minute
    retry: 1,
  });
}

// ===== BACKTEST HOOKS =====

export function useBacktestStrategy() {
  return useMutation({
    mutationFn: ({ strategyId, params }: { strategyId: number; params: any }) =>
      apiClient.backtestStrategy(strategyId, params),
  });
}
