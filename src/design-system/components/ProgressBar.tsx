import React from 'react';
import { colors, spacing, typography, borderRadius } from '../tokens';

export type ProgressVariant = 'linear' | 'circular';
export type ProgressColor = 'primary' | 'success' | 'warning' | 'danger';

interface BaseProgressProps {
  value: number; // 0-100
  max?: number;
  color?: ProgressColor;
  showLabel?: boolean;
  label?: string;
}

export interface LinearProgressProps extends BaseProgressProps {
  variant: 'linear';
  height?: number;
}

export interface CircularProgressProps extends BaseProgressProps {
  variant: 'circular';
  size?: number;
  strokeWidth?: number;
}

export type ProgressBarProps = LinearProgressProps | CircularProgressProps;

const colorMap: Record<ProgressColor, string> = {
  primary: colors.primary.solid,
  success: colors.success,
  warning: colors.warning,
  danger: colors.error,
};

const getColorForValue = (value: number, max: number): ProgressColor => {
  const percentage = (value / max) * 100;
  if (percentage <= 20) return 'danger';
  if (percentage <= 50) return 'warning';
  return 'primary';
};

export const LinearProgress: React.FC<LinearProgressProps> = ({
  value,
  max = 100,
  color,
  showLabel = false,
  label,
  height = 8,
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const autoColor = color || getColorForValue(value, max);
  const barColor = colorMap[autoColor];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span
            style={{
              fontSize: typography.fontSize.small,
              fontWeight: typography.fontWeight.medium,
              color: colors.neutral[700],
            }}
          >
            {label || 'Progress'}
          </span>
          <span
            style={{
              fontSize: typography.fontSize.small,
              fontWeight: typography.fontWeight.semibold,
              color: colors.neutral[900],
            }}
          >
            {value.toFixed(1)} / {max}
          </span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: `${height}px`,
          background: colors.neutral[100],
          borderRadius: borderRadius.full,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${barColor} 0%, ${barColor}dd 100%)`,
            borderRadius: borderRadius.full,
            transition: 'width 300ms ease',
          }}
        />
      </div>
    </div>
  );
};

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  max = 100,
  color,
  showLabel = true,
  label,
  size = 120,
  strokeWidth = 8,
}) => {
  const percentage = Math.min((value / max) * 100, 100);
  const autoColor = color || getColorForValue(value, max);
  const barColor = colorMap[autoColor];

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing[3],
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colors.neutral[100]}
            strokeWidth={strokeWidth}
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={barColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 300ms ease',
            }}
          />
        </svg>
        {/* Center label */}
        {showLabel && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: typography.fontSize.h2,
                fontWeight: typography.fontWeight.bold,
                color: colors.neutral[900],
                lineHeight: typography.lineHeight.tight,
              }}
            >
              {value.toFixed(1)}
            </div>
            <div
              style={{
                fontSize: typography.fontSize.small,
                color: colors.neutral[600],
                marginTop: spacing[1],
              }}
            >
              / {max}
            </div>
          </div>
        )}
      </div>
      {label && (
        <div
          style={{
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.medium,
            color: colors.neutral[700],
            textAlign: 'center',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

export const ProgressBar: React.FC<ProgressBarProps> = (props) => {
  if (props.variant === 'circular') {
    return <CircularProgress {...props} />;
  }
  return <LinearProgress {...props} />;
};

export default ProgressBar;
