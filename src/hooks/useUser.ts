'use client';

// User Data Hooks
// React Query hooks for fetching and managing user data

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import type { User, UsageStats } from '@/types';

// ===== QUERY KEYS =====

export const userKeys = {
  all: ['user'] as const,
  profile: () => [...userKeys.all, 'profile'] as const,
  usage: () => [...userKeys.all, 'usage'] as const,
};

// ===== PROFILE HOOKS =====

export function useProfile() {
  return useQuery({
    queryKey: userKeys.profile(),
    queryFn: () => apiClient.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<User>) => apiClient.updateProfile(updates),
    onSuccess: (updatedUser) => {
      // Update cached profile data
      queryClient.setQueryData(userKeys.profile(), updatedUser);
    },
  });
}

// ===== USAGE STATS HOOKS =====

export function useUsageStats() {
  return useQuery({
    queryKey: userKeys.usage(),
    queryFn: () => apiClient.getUsageStats(),
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: 1,
  });
}

// ===== PLAN HOOKS =====

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planTier: string) => apiClient.updatePlan(planTier),
    onSuccess: () => {
      // Invalidate user data to trigger refetch
      queryClient.invalidateQueries({ queryKey: userKeys.profile() });
      queryClient.invalidateQueries({ queryKey: userKeys.usage() });
    },
  });
}
