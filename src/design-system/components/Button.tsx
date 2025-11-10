import React from 'react';
import { colors, spacing, typography, borderRadius, shadows, transitions } from '../tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: `linear-gradient(135deg, ${colors.primary.start} 0%, ${colors.primary.end} 100%)`,
    color: '#ffffff',
    border: 'none',
    boxShadow: shadows.sm,
  },
  secondary: {
    background: colors.neutral[100],
    color: colors.neutral[900],
    border: `1px solid ${colors.neutral[300]}`,
    boxShadow: 'none',
  },
  ghost: {
    background: 'transparent',
    color: colors.neutral[700],
    border: 'none',
    boxShadow: 'none',
  },
  danger: {
    background: colors.error,
    color: '#ffffff',
    border: 'none',
    boxShadow: shadows.sm,
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    height: '32px',
    padding: `0 ${spacing[3]}`,
    fontSize: typography.fontSize.small,
    gap: spacing[1],
  },
  md: {
    height: '40px',
    padding: `0 ${spacing[4]}`,
    fontSize: typography.fontSize.body,
    gap: spacing[2],
  },
  lg: {
    height: '48px',
    padding: `0 ${spacing[6]}`,
    fontSize: typography.fontSize.body,
    gap: spacing[2],
  },
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  style,
  className = '',
  ...props
}) => {
  const buttonStyle: React.CSSProperties = {
    ...variantStyles[variant],
    ...sizeStyles[size],
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: typography.fontFamily.sans,
    fontWeight: typography.fontWeight.medium,
    borderRadius: borderRadius.md,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: `all ${transitions.normal}`,
    opacity: disabled || loading ? 0.6 : 1,
    width: fullWidth ? '100%' : 'auto',
    whiteSpace: 'nowrap',
    userSelect: 'none',
    ...style,
  };

  // Hover styles (applied via inline onMouseEnter/Leave for simplicity)
  const [isHovered, setIsHovered] = React.useState(false);

  const hoverStyle: React.CSSProperties = isHovered && !disabled && !loading ? {
    transform: 'translateY(-1px)',
    boxShadow: variant === 'primary' || variant === 'danger' ? shadows.md : shadows.sm,
    opacity: 0.9,
  } : {};

  return (
    <button
      style={{ ...buttonStyle, ...hoverStyle }}
      className={className}
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...props}
    >
      {loading && (
        <svg
          style={{
            animation: 'spin 1s linear infinite',
            width: '16px',
            height: '16px',
          }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            style={{ opacity: 0.25 }}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            style={{ opacity: 0.75 }}
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && leftIcon && <span style={{ display: 'flex' }}>{leftIcon}</span>}
      <span>{children}</span>
      {!loading && rightIcon && <span style={{ display: 'flex' }}>{rightIcon}</span>}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
};

export default Button;
