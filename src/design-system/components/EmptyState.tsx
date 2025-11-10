import React from 'react';
import { Button } from './Button';
import { colors, spacing, typography } from '../tokens';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

const DefaultIcon: React.FC = () => (
  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="30" stroke={colors.neutral[300]} strokeWidth="2" strokeDasharray="4 4" />
    <path
      d="M32 24v16m-8-8h16"
      stroke={colors.neutral[400]}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing[12],
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <div
        style={{
          marginBottom: spacing[6],
          color: colors.neutral[400],
        }}
      >
        {icon || <DefaultIcon />}
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: typography.fontSize.h2,
          fontWeight: typography.fontWeight.semibold,
          color: colors.neutral[900],
          marginBottom: spacing[2],
        }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        style={{
          fontSize: typography.fontSize.body,
          color: colors.neutral[600],
          maxWidth: '400px',
          lineHeight: typography.lineHeight.relaxed,
          marginBottom: action || secondaryAction ? spacing[6] : 0,
        }}
      >
        {description}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div
          style={{
            display: 'flex',
            gap: spacing[3],
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {action && (
            <Button variant="primary" size="lg" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" size="lg" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EmptyState;
