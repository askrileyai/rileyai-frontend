'use client';

// Stripe Hooks
// React Query hooks for managing Stripe payments and subscriptions

import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api';

// ===== QUERY KEYS =====

export const stripeKeys = {
  all: ['stripe'] as const,
  subscription: () => [...stripeKeys.all, 'subscription'] as const,
};

// ===== SUBSCRIPTION HOOKS =====

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: stripeKeys.subscription(),
    queryFn: () => apiClient.getSubscriptionStatus(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

// ===== CHECKOUT HOOKS =====

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (priceId: string) => apiClient.createCheckoutSession(priceId),
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: () => apiClient.createPortalSession(),
    onSuccess: (data) => {
      // Redirect to Stripe customer portal
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });
}
