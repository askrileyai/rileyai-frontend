/**
 * RileyAI Design System
 * $10M Budget Aesthetic
 * 
 * Import everything you need from this single entry point:
 * import { Button, Card, colors, spacing } from '@/design-system';
 */

// Design Tokens
export * from './tokens';

// Core Components
export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button';

export { Card } from './components/Card';
export type { CardProps, CardVariant } from './components/Card';

export { StatsCard } from './components/StatsCard';
export type { StatsCardProps, TrendDirection } from './components/StatsCard';

export { LinearProgress, CircularProgress, ProgressBar } from './components/ProgressBar';
export type { ProgressBarProps, LinearProgressProps, CircularProgressProps } from './components/ProgressBar';

export { Badge, MetricBadge } from './components/Badge';
export type { BadgeProps, MetricBadgeProps, BadgeVariant, BadgeSize } from './components/Badge';

export { UpgradePrompt } from './components/UpgradePrompt';
export type { UpgradePromptProps, PlanTier } from './components/UpgradePrompt';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';

export { ToastProvider, useToast } from './components/Toast';
export type { Toast, ToastVariant } from './components/Toast';

export { Skeleton, TextSkeleton, CardSkeleton, TableSkeleton, DashboardSkeleton } from './components/LoadingSkeleton';
export { Skeleton as LoadingSkeleton } from './components/LoadingSkeleton';
export type { SkeletonProps } from './components/LoadingSkeleton';

export { Modal, ConfirmModal } from './components/Modal';
export type { ModalProps } from './components/Modal';

// Utility exports
export const designSystem = {
  version: '1.0.0',
  name: 'RileyAI Design System',
  description: '$10M Budget Aesthetic - Inspired by Stripe, Linear, and Plaid',
} as const;
