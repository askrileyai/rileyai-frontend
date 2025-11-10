'use client';

// Investments Hooks
// React Query hooks for managing investment portfolios and Plaid integration

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api';
import type { Portfolio } from '@/types';

// ===== QUERY KEYS =====

export const investmentKeys = {
  all: ['investments'] as const,
  portfolio: () => [...investmentKeys.all, 'portfolio'] as const,
};

// ===== PORTFOLIO HOOKS =====

export function usePortfolio() {
  return useQuery({
    queryKey: investmentKeys.portfolio(),
    queryFn: () => apiClient.getPortfolio(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

export function useRefreshInvestments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiClient.refreshInvestments(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.portfolio() });
    },
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accountId: string) => apiClient.disconnectAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: investmentKeys.portfolio() });
    },
  });
}

// ===== PLAID HOOKS =====

export function useCreatePlaidLinkToken() {
  return useMutation({
    mutationFn: () => apiClient.createPlaidLinkToken(),
  });
}

export function useExchangePlaidToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (publicToken: string) => apiClient.exchangePlaidToken(publicToken),
    onSuccess: () => {
      // Refresh portfolio data after connecting new account
      queryClient.invalidateQueries({ queryKey: investmentKeys.portfolio() });
    },
  });
}
