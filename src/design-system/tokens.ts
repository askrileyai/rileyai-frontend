/**
 * RileyAI Design System Tokens
 * $10M Budget Aesthetic - Inspired by Stripe, Linear, Plaid
 */

export const colors = {
  // Primary Gradient
  primary: {
    start: '#667eea',
    end: '#764ba2',
    solid: '#6b7de8', // Mid-point for solid uses
  },
  
  // Semantic Colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  
  // Neutral Scale
  neutral: {
    900: '#0f172a', // Darkest text
    800: '#1e293b',
    700: '#334155',
    600: '#475569',
    500: '#64748b',
    400: '#94a3b8',
    300: '#cbd5e1',
    200: '#e2e8f0',
    100: '#f1f5f9',
    50: '#f8fafc',  // Lightest bg
  },
  
  // Trading-Specific Colors
  trading: {
    bullish: '#10b981',
    bearish: '#ef4444',
    neutral: '#64748b',
    volume: '#8b5cf6',
  },
  
  // Chart Colors
  chart: {
    line1: '#667eea',
    line2: '#10b981',
    line3: '#f59e0b',
    line4: '#ef4444',
    line5: '#8b5cf6',
    grid: '#e2e8f0',
    axis: '#94a3b8',
  },
} as const;

export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
} as const;

export const typography = {
  // Font Families
  fontFamily: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif",
    mono: "'SF Mono', 'Monaco', 'Consolas', monospace",
  },
  
  // Font Sizes
  fontSize: {
    tiny: '11px',      // 11-12px
    small: '13px',     // 13-14px
    body: '15px',      // 15-16px
    h3: '20px',        // 20-24px
    h2: '28px',        // 28-32px
    h1: '36px',        // 36-42px
    display: '48px',   // 48-72px
  },
  
  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
  
  // Font Weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
} as const;

export const borderRadius = {
  none: '0px',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const;

export const shadows = {
  // Subtle elevation
  sm: '0 1px 2px 0 rgba(15, 23, 42, 0.05)',
  
  // Default card elevation
  md: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)',
  
  // Prominent elevation (modals, dropdowns)
  lg: '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
  
  // Maximum elevation
  xl: '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 10px 10px -5px rgba(15, 23, 42, 0.04)',
  
  // Glowing primary (for CTAs)
  primary: '0 0 0 3px rgba(102, 126, 234, 0.15)',
  
  // Focus ring
  focus: '0 0 0 3px rgba(102, 126, 234, 0.25)',
} as const;

export const transitions = {
  fast: '150ms ease',
  normal: '200ms ease',
  slow: '300ms ease',
} as const;

export const breakpoints = {
  sm: '640px',   // Small devices
  md: '768px',   // Tablets
  lg: '1024px',  // Laptops
  xl: '1280px',  // Desktops
  '2xl': '1536px', // Large desktops
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  toast: 1400,
  tooltip: 1500,
} as const;

// Glass morphism effect
export const glassMorphism = {
  background: 'rgba(248, 250, 252, 0.8)',
  backdropFilter: 'blur(12px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.5)',
} as const;

// Gradient utilities
export const gradients = {
  primary: `linear-gradient(135deg, ${colors.primary.start} 0%, ${colors.primary.end} 100%)`,
  success: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  warning: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  error: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
  neutral: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
} as const;
