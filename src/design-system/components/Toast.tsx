'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { colors, spacing, typography, borderRadius, shadows, zIndex } from '../tokens';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

const variantStyles: Record<
  ToastVariant,
  { background: string; borderColor: string; iconColor: string }
> = {
  success: {
    background: '#ffffff',
    borderColor: colors.success,
    iconColor: colors.success,
  },
  error: {
    background: '#ffffff',
    borderColor: colors.error,
    iconColor: colors.error,
  },
  warning: {
    background: '#ffffff',
    borderColor: colors.warning,
    iconColor: colors.warning,
  },
  info: {
    background: '#ffffff',
    borderColor: colors.primary.solid,
    iconColor: colors.primary.solid,
  },
};

const ToastIcon: React.FC<{ variant: ToastVariant }> = ({ variant }) => {
  switch (variant) {
    case 'success':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path
            d="M7 10l2 2 4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'error':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M10 6v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="14" r="1" fill="currentColor" />
        </svg>
      );
    case 'warning':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2l8 14H2L10 2z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M10 8v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="14" r="1" fill="currentColor" />
        </svg>
      );
    case 'info':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M10 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="10" cy="7" r="1" fill="currentColor" />
        </svg>
      );
  }
};

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const styles = variantStyles[toast.variant];

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  return (
    <div
      style={{
        display: 'flex',
        gap: spacing[3],
        padding: spacing[4],
        background: styles.background,
        borderLeft: `3px solid ${styles.borderColor}`,
        borderRadius: borderRadius.lg,
        boxShadow: shadows.lg,
        minWidth: '320px',
        maxWidth: '420px',
        animation: 'slideIn 200ms ease',
      }}
    >
      <div style={{ color: styles.iconColor, flexShrink: 0 }}>
        <ToastIcon variant={toast.variant} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: spacing[1] }}>
        <div
          style={{
            fontSize: typography.fontSize.body,
            fontWeight: typography.fontWeight.semibold,
            color: colors.neutral[900],
          }}
        >
          {toast.title}
        </div>
        {toast.description && (
          <div
            style={{
              fontSize: typography.fontSize.small,
              color: colors.neutral[600],
              lineHeight: typography.lineHeight.relaxed,
            }}
          >
            {toast.description}
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: colors.neutral[400],
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M4 4l8 8m0-8l-8 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div
        style={{
          position: 'fixed',
          top: spacing[6],
          right: spacing[6],
          zIndex: zIndex.toast,
          display: 'flex',
          flexDirection: 'column',
          gap: spacing[3],
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default { ToastProvider, useToast };
