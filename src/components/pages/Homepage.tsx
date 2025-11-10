'use client';

import React from 'react';
import { Button, Card, Badge } from '@/design-system';
import { colors, spacing, typography, gradients } from '@/design-system/tokens';

const Header = () => {
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 1100, background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${colors.neutral[200]}` }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: `${spacing[4]} ${spacing[6]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
          <div style={{ width: '32px', height: '32px', background: gradients.primary, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>R</div>
          <span style={{ fontSize: typography.fontSize.h3, fontWeight: 700 }}>RileyAI</span>
        </div>
        <nav style={{ display: 'flex', gap: spacing[6] }}>
          <a href="/" style={{ color: colors.primary.solid, textDecoration: 'none', fontWeight: 500 }}>Home</a>
          <a href="/features" style={{ color: colors.neutral[700], textDecoration: 'none' }}>Features</a>
          <a href="/pricing" style={{ color: colors.neutral[700], textDecoration: 'none' }}>Pricing</a>
          <a href="/how-it-works" style={{ color: colors.neutral[700], textDecoration: 'none' }}>How It Works</a>
        </nav>
        <div style={{ display: 'flex', gap: spacing[3], alignItems: 'center' }}>
          <a href="/dashboard" style={{ color: colors.neutral[600], textDecoration: 'none', fontSize: '14px' }}>Login</a>
          <Button variant="primary">Install Extension</Button>
        </div>
      </div>
    </header>
  );
};

export const Homepage = () => {
  return (
    <div style={{ minHeight: '100vh', background: colors.neutral[50] }}>
      <Header />
      
      <section style={{ padding: `${spacing[24]} ${spacing[6]}`, background: `linear-gradient(135deg, ${colors.neutral[50]} 0%, #ffffff 100%)` }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <Badge variant="primary" size="lg">✨ New: Investment Portfolio Tracking</Badge>
          <h1 style={{ fontSize: '56px', fontWeight: 700, color: colors.neutral[900], marginTop: spacing[6], marginBottom: spacing[4], lineHeight: 1.1 }}>
            Your AI Trading Coach<br />
            <span style={{ background: gradients.primary, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Inside TradingView</span>
          </h1>
          <p style={{ fontSize: typography.fontSize.h3, color: colors.neutral[600], marginBottom: spacing[8], maxWidth: '700px', margin: `0 auto ${spacing[8]}` }}>
            Real-time AI analysis, trading strategies, and portfolio insights—all within your favorite charting platform.
          </p>
          <div style={{ display: 'flex', gap: spacing[4], justifyContent: 'center' }}>
            <Button variant="primary" size="lg">Install Free Extension</Button>
            <Button variant="secondary" size="lg">Watch Demo</Button>
          </div>
          <p style={{ fontSize: '13px', color: colors.neutral[500], marginTop: spacing[4] }}>No credit card required • 3 hours free</p>
        </div>
      </section>

      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: typography.fontSize.display, fontWeight: 700, textAlign: 'center', marginBottom: spacing[12] }}>
            Everything You Need to Trade Smarter
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: spacing[6] }}>
            {[
              { icon: '💬', title: 'Real-Time AI Analysis', desc: 'Chat with Riley about any chart, get instant insights on price action and trade ideas.' },
              { icon: '📊', title: 'Portfolio Tracking', desc: 'Connect investment accounts and get AI-powered portfolio analysis and recommendations.' },
              { icon: '🎯', title: 'Trading Strategies', desc: 'Automated strategy signals with real-time alerts for Mean Reversion, EMA Cross, and more.' },
              { icon: '📈', title: 'Multi-Timeframe Analysis', desc: 'See confluence across multiple timeframes to find high-probability setups.' },
              { icon: '📸', title: 'Chart Snapshots', desc: 'Capture your analysis and get AI feedback on your drawings and indicators.' },
              { icon: '⚡', title: 'Smart Alerts', desc: 'Volume spikes, breakouts, strategy signals—never miss an opportunity.' },
            ].map((f, i) => (
              <Card key={i} variant="elevated" padding={6}>
                <div style={{ fontSize: '48px', marginBottom: spacing[4] }}>{f.icon}</div>
                <h3 style={{ fontSize: typography.fontSize.h3, fontWeight: 600, marginBottom: spacing[2] }}>{f.title}</h3>
                <p style={{ color: colors.neutral[600] }}>{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ padding: `${spacing[8]} ${spacing[6]}`, background: colors.neutral[900], color: colors.neutral[300], textAlign: 'center' }}>
        <p>© 2025 RileyAI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Homepage;
