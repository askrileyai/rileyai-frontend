import React from 'react';
import { colors, spacing, typography, borderRadius } from '../tokens';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, { background: string; color: string }> = {
  default: {
    background: colors.neutral[100],
    color: colors.neutral[700],
  },
  primary: {
    background: `${colors.primary.solid}20`,
    color: colors.primary.solid,
  },
  secondary: {
    background: colors.neutral[200],
    color: colors.neutral[600],
  },
  success: {
    background: `${colors.success}20`,
    color: colors.success,
  },
  warning: {
    background: `${colors.warning}20`,
    color: colors.warning,
  },
  danger: {
    background: `${colors.error}20`,
    color: colors.error,
  },
  neutral: {
    background: colors.neutral[200],
    color: colors.neutral[700],
  },
};

const sizeStyles: Record<BadgeSize, { fontSize: string; padding: string; height: string }> = {
  sm: {
    fontSize: typography.fontSize.tiny,
    padding: `0 ${spacing[2]}`,
    height: '20px',
  },
  md: {
    fontSize: typography.fontSize.small,
    padding: `0 ${spacing[3]}`,
    height: '24px',
  },
  lg: {
    fontSize: typography.fontSize.body,
    padding: `0 ${spacing[4]}`,
    height: '32px',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  icon,
}) => {
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[1],
        fontFamily: typography.fontFamily.sans,
        fontSize: sizeStyle.fontSize,
        fontWeight: typography.fontWeight.medium,
        padding: sizeStyle.padding,
        height: sizeStyle.height,
        background: variantStyle.background,
        color: variantStyle.color,
        borderRadius: borderRadius.md,
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
};

export interface MetricBadgeProps {
  label: string;
  value: string | number;
  trend?: 'up' | 'down' | 'neutral';
  variant?: BadgeVariant;
}

export const MetricBadge: React.FC<MetricBadgeProps> = ({
  label,
  value,
  trend,
  variant = 'default',
}) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    
    if (trend === 'up') {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 3v6m0-6l3 3m-3-3L3 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    
    if (trend === 'down') {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 9V3m0 6l3-3m-3 3L3 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    
    return null;
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing[2],
        padding: spacing[3],
        background: variantStyles[variant].background,
        borderRadius: borderRadius.md,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
        <span
          style={{
            fontSize: typography.fontSize.tiny,
            fontWeight: typography.fontWeight.medium,
            color: colors.neutral[600],
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[1] }}>
          <span
            style={{
              fontSize: typography.fontSize.h3,
              fontWeight: typography.fontWeight.bold,
              color: variantStyles[variant].color,
            }}
          >
            {value}
          </span>
          {trend && (
            <span style={{ color: variantStyles[variant].color, display: 'flex' }}>
              {getTrendIcon()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Badge;
