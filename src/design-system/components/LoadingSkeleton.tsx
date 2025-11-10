import React from 'react';
import { colors, borderRadius } from '../tokens';

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  variant?: 'text' | 'rectangular' | 'circular';
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  circle = false,
  variant = 'rectangular',
  style,
}) => {
  const getHeight = () => {
    if (variant === 'text') return '16px';
    if (variant === 'circular') return width;
    return height;
  };

  const getBorderRadius = () => {
    if (circle || variant === 'circular') return '50%';
    if (variant === 'text') return '4px';
    return borderRadius.md;
  };

  return (
    <div
      style={{
        width,
        height: getHeight(),
        background: `linear-gradient(90deg, ${colors.neutral[200]} 0%, ${colors.neutral[100]} 50%, ${colors.neutral[200]} 100%)`,
        backgroundSize: '200% 100%',
        borderRadius: getBorderRadius(),
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
};

export const TextSkeleton: React.FC<{ lines?: number; width?: string }> = ({
  lines = 3,
  width = '100%',
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div
      style={{
        padding: '24px',
        background: '#ffffff',
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: borderRadius.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Skeleton variant="circular" width="40px" />
        <div style={{ flex: 1 }}>
          <Skeleton variant="text" width="120px" height="16px" />
        </div>
      </div>
      <Skeleton height="120px" />
      <TextSkeleton lines={2} />
    </div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '12px' }}>
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={index} variant="text" height="20px" width={`${100 / columns}%`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} style={{ display: 'flex', gap: '12px' }}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} variant="text" height="16px" width={`${100 / columns}%`} />
          ))}
        </div>
      ))}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <Skeleton width="200px" height="32px" style={{ marginBottom: '8px' }} />
        <Skeleton width="300px" height="16px" />
      </div>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
        }}
      >
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      {/* Content Area */}
      <div
        style={{
          background: '#ffffff',
          border: `1px solid ${colors.neutral[200]}`,
          borderRadius: borderRadius.lg,
          padding: '24px',
        }}
      >
        <Skeleton width="150px" height="24px" style={{ marginBottom: '16px' }} />
        <TableSkeleton />
      </div>
    </div>
  );
};

export default Skeleton;
