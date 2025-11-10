import React from 'react';
import { colors, spacing, borderRadius, shadows } from '../tokens';

export type CardVariant = 'default' | 'elevated' | 'bordered' | 'glass';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: keyof typeof spacing;
  hoverable?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<CardVariant, React.CSSProperties> = {
  default: {
    background: '#ffffff',
    border: `1px solid ${colors.neutral[200]}`,
    boxShadow: shadows.sm,
  },
  elevated: {
    background: '#ffffff',
    border: 'none',
    boxShadow: shadows.md,
  },
  bordered: {
    background: '#ffffff',
    border: `1px solid ${colors.neutral[300]}`,
    boxShadow: 'none',
  },
  glass: {
    background: 'rgba(255, 255, 255, 0.8)',
    border: `1px solid ${colors.neutral[200]}`,
    backdropFilter: 'blur(12px) saturate(180%)',
    boxShadow: shadows.sm,
  },
};

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 6,
  hoverable = false,
  children,
  style,
  className = '',
  ...props
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const cardStyle: React.CSSProperties = {
    ...variantStyles[variant],
    padding: spacing[padding],
    borderRadius: borderRadius.lg,
    transition: 'all 200ms ease',
    ...style,
  };

  const hoverStyle: React.CSSProperties = hoverable && isHovered ? {
    transform: 'translateY(-2px)',
    boxShadow: shadows.lg,
  } : {};

  return (
    <div
      style={{ ...cardStyle, ...hoverStyle }}
      className={className}
      onMouseEnter={hoverable ? () => setIsHovered(true) : undefined}
      onMouseLeave={hoverable ? () => setIsHovered(false) : undefined}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
