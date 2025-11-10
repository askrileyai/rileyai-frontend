import React, { useState } from 'react';
import { Button } from '../design-system';
import { colors, spacing, typography, zIndex } from '../design-system/tokens';

export interface HeaderProps {
  transparent?: boolean;
  currentPath?: string;
}

const Logo: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
    <div style={{
        width: '32px', height: '32px',
        background: `linear-gradient(135deg, ${colors.primary.start} 0%, ${colors.primary.end} 100%)`,
        borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#ffffff', fontWeight: typography.fontWeight.bold, fontSize: '16px',
      }}>R</div>
    <span style={{ fontSize: typography.fontSize.h3, fontWeight: typography.fontWeight.bold, color: colors.neutral[900] }}>
      RileyAI
    </span>
  </div>
);

const NavLink: React.FC<{ href: string; active?: boolean; children: React.ReactNode }> = ({ href, active, children }) => {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <a href={href} style={{
        fontSize: typography.fontSize.body, fontWeight: typography.fontWeight.medium,
        color: active ? colors.primary.solid : colors.neutral[700], textDecoration: 'none',
        padding: `${spacing[2]} ${spacing[3]}`, borderRadius: '8px', transition: 'all 200ms ease',
        background: isHovered ? colors.neutral[100] : 'transparent',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >{children}</a>
  );
};

export const Header: React.FC<HeaderProps> = ({ transparent = false, currentPath = '/' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header style={{
          position: 'sticky', top: 0, zIndex: zIndex.sticky,
          background: transparent ? 'rgba(255, 255, 255, 0.8)' : '#ffffff',
          backdropFilter: 'blur(12px)', borderBottom: `1px solid ${colors.neutral[200]}`,
        }}>
        <div style={{
            maxWidth: '1280px', margin: '0 auto', padding: `${spacing[4]} ${spacing[6]}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
          <a href="/" style={{ textDecoration: 'none' }}><Logo /></a>
          <nav style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }} className="desktop-nav">
            <NavLink href="/" active={currentPath === '/'}>Home</NavLink>
            <NavLink href="/features" active={currentPath === '/features'}>Features</NavLink>
            <NavLink href="/pricing" active={currentPath === '/pricing'}>Pricing</NavLink>
            <NavLink href="/how-it-works" active={currentPath === '/how-it-works'}>How It Works</NavLink>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }} className="desktop-cta">
            <a href="/dashboard" style={{ fontSize: typography.fontSize.small, color: colors.neutral[600], textDecoration: 'none' }}>Login</a>
            <Button variant="primary" onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}>Install Extension</Button>
          </div>
          <button style={{ display: 'none', background: 'none', border: 'none', padding: spacing[2], cursor: 'pointer', color: colors.neutral[700] }}
            className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {mobileMenuOpen && (
          <div style={{ background: '#ffffff', borderTop: `1px solid ${colors.neutral[200]}`, padding: spacing[4] }} className="mobile-menu">
            <nav style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
              <NavLink href="/">Home</NavLink>
              <NavLink href="/features">Features</NavLink>
              <NavLink href="/pricing">Pricing</NavLink>
              <NavLink href="/how-it-works">How It Works</NavLink>
              <div style={{ borderTop: `1px solid ${colors.neutral[200]}`, marginTop: spacing[2], paddingTop: spacing[2] }}>
                <a href="/dashboard" style={{ display: 'block', padding: spacing[3], color: colors.neutral[700], textDecoration: 'none' }}>Login</a>
                <Button variant="primary" fullWidth>Install Extension</Button>
              </div>
            </nav>
          </div>
        )}
      </header>
      <style>{`@media (max-width: 768px) { .desktop-nav, .desktop-cta { display: none !important; } .mobile-menu-btn { display: block !important; } }`}</style>
    </>
  );
};

export default Header;
