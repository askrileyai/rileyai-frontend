import React from 'react';
import { Card } from './Card';
import { colors, spacing, typography } from '../tokens';

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface StatsCardProps {
  label: string;
  value: string | number;
  trend?: {
    direction: TrendDirection;
    value: string;
  };
  icon?: React.ReactNode;
  description?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const getTrendColor = (direction: TrendDirection): string => {
  switch (direction) {
    case 'up':
      return colors.success;
    case 'down':
      return colors.error;
    case 'neutral':
      return colors.neutral[500];
  }
};

const TrendIcon: React.FC<{ direction: TrendDirection }> = ({ direction }) => {
  if (direction === 'neutral') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M3 8h10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transform: direction === 'down' ? 'rotate(180deg)' : 'none',
      }}
    >
      <path
        d="M8 4v8m0-8l4 4m-4-4L4 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const variantGradients: Record<string, string> = {
  default: 'none',
  primary: `linear-gradient(135deg, ${colors.primary.start} 0%, ${colors.primary.end} 100%)`,
  success: `linear-gradient(135deg, ${colors.success} 0%, #059669 100%)`,
  warning: `linear-gradient(135deg, ${colors.warning} 0%, #d97706 100%)`,
  danger: `linear-gradient(135deg, ${colors.error} 0%, #dc2626 100%)`,
};

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  trend,
  icon,
  description,
  variant = 'default',
}) => {
  const hasGradient = variant !== 'default';
  const textColor = hasGradient ? '#ffffff' : colors.neutral[900];
  const subTextColor = hasGradient ? 'rgba(255, 255, 255, 0.8)' : colors.neutral[600];

  return (
    <Card
      variant={hasGradient ? 'elevated' : 'default'}
      padding={6}
      style={{
        background: variantGradients[variant],
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: typography.fontSize.small,
              fontWeight: typography.fontWeight.medium,
              color: subTextColor,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {label}
          </span>
          {icon && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: hasGradient ? 'rgba(255, 255, 255, 0.2)' : colors.neutral[100],
                color: hasGradient ? '#ffffff' : colors.primary.solid,
              }}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <div
          style={{
            fontSize: typography.fontSize.h1,
            fontWeight: typography.fontWeight.bold,
            color: textColor,
            lineHeight: typography.lineHeight.tight,
          }}
        >
          {value}
        </div>

        {/* Trend or Description */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          {trend && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: spacing[1],
                color: hasGradient ? '#ffffff' : getTrendColor(trend.direction),
                fontSize: typography.fontSize.small,
                fontWeight: typography.fontWeight.medium,
              }}
            >
              <TrendIcon direction={trend.direction} />
              <span>{trend.value}</span>
            </div>
          )}
          {description && (
            <span
              style={{
                fontSize: typography.fontSize.small,
                color: subTextColor,
              }}
            >
              {description}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
