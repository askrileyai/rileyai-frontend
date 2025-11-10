import React from 'react';
import { Card, Button, Badge } from '@/design-system';
import { colors, spacing, typography, gradients } from '@/design-system/tokens';

const Header = () => (
  <header style={{ position: 'sticky', top: 0, zIndex: 1100, background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${colors.neutral[200]}` }}>
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: `${spacing[4]} ${spacing[6]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <div style={{ width: '32px', height: '32px', background: gradients.primary, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>R</div>
        <span style={{ fontSize: typography.fontSize.h3, fontWeight: 700 }}>RileyAI</span>
      </div>
      <nav style={{ display: 'flex', gap: spacing[6] }}>
        <a href="/" style={{ color: colors.neutral[700], textDecoration: 'none' }}>Home</a>
        <a href="/features" style={{ color: colors.primary.solid, textDecoration: 'none', fontWeight: 500 }}>Features</a>
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

export const Features = () => {
  return (
    <div style={{ minHeight: '100vh', background: colors.neutral[50] }}>
      <Header />
      
      {/* Hero */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, textAlign: 'center', background: '#ffffff' }}>
        <h1 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginBottom: spacing[3] }}>
          Powerful Features for Every Trader
        </h1>
        <p style={{ fontSize: typography.fontSize.h3, color: colors.neutral[600], maxWidth: '700px', margin: `0 auto` }}>
          From beginners to professionals, RileyAI adapts to your trading style
        </p>
      </section>

      {/* Core Features (All Plans) */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, background: colors.neutral[50] }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: spacing[12] }}>
            <Badge variant="primary" size="lg">AVAILABLE ON ALL PLANS</Badge>
            <h2 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginTop: spacing[4] }}>Core Trading Features</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: spacing[8] }}>
            {[
              { icon: '💬', title: 'Real-Time AI Analysis', desc: 'Chat with Riley about any chart on TradingView. Get instant insights on price action, support/resistance levels, and trade ideas. Riley analyzes candle closes in real-time and provides contextual recommendations.', tier: 'FREE+' },
              { icon: '⏱️', title: 'Session Management', desc: 'Hour-based usage tracking with intelligent auto-idle detection. Sessions automatically pause after 30 minutes of inactivity with a 5-minute warning. Track all your sessions and see detailed analytics.', tier: 'FREE+' },
              { icon: '🎨', title: 'TradingView Integration', desc: 'Seamlessly integrated Chrome extension that works directly on TradingView. Track recent symbols, access popular tickers quickly, and see real-time market hours and price statistics.', tier: 'FREE+' },
            ].map((f, i) => (
              <Card key={i} variant="elevated" padding={6}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[4] }}>
                  <div style={{ fontSize: '48px' }}>{f.icon}</div>
                  <Badge variant="neutral" size="sm">{f.tier}</Badge>
                </div>
                <h3 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[3] }}>{f.title}</h3>
                <p style={{ color: colors.neutral[700], lineHeight: 1.6 }}>{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* BASIC+ Features */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: spacing[12] }}>
            <Badge variant="primary" size="lg">BASIC+ FEATURES ($39/month)</Badge>
            <h2 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginTop: spacing[4] }}>Advanced Analysis Tools</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: spacing[8] }}>
            {[
              { icon: '📈', title: 'Multi-Timeframe Confluence', desc: 'Analyze multiple timeframes simultaneously (1m, 5m, 15m, 1h, 4h, 1D). Get confluence scoring to identify high-probability trade setups where multiple timeframes align. Perfect for finding entries with the best risk/reward.', tier: 'BASIC+' },
              { icon: '📸', title: 'Chart Snapshot Analysis', desc: 'Capture your TradingView chart with drawings and indicators, then get AI analysis on your setup. Riley evaluates your chart analysis, provides feedback on entry/exit points, and assesses risk/reward ratios.', tier: 'BASIC+' },
              { icon: '📊', title: 'Investment Portfolio Tracking', desc: 'Connect investment accounts via Plaid integration. Track real-time portfolio performance, get AI-powered recommendations, set financial goals with Monte Carlo projections, and monitor diversification metrics.', tier: 'BASIC+' },
            ].map((f, i) => (
              <Card key={i} variant="elevated" padding={6}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[4] }}>
                  <div style={{ fontSize: '48px' }}>{f.icon}</div>
                  <Badge variant="primary" size="sm">{f.tier}</Badge>
                </div>
                <h3 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[3] }}>{f.title}</h3>
                <p style={{ color: colors.neutral[700], lineHeight: 1.6 }}>{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* PRO+ Features */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, background: colors.neutral[50] }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: spacing[12] }}>
            <Badge variant="success" size="lg">PRO+ FEATURES ($89/month)</Badge>
            <h2 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginTop: spacing[4] }}>Professional Trading Automation</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: spacing[8] }}>
            {[
              { icon: '🎯', title: 'Trading Strategy System', desc: 'Pre-built strategies (Mean Reversion, EMA Crossover, Supply/Demand) with real-time signal generation. Create custom strategies, backtest on historical data, and track performance metrics with win rates and profit factors.', tier: 'PRO+' },
              { icon: '⚡', title: 'Smart Alerts & Notifications', desc: 'Volume spike alerts, price breakout notifications, economic event reminders, strategy signal alerts, and support/resistance level hits. Stay informed without watching charts constantly.', tier: 'PRO+' },
              { icon: '🧠', title: 'Preference Learning AI', desc: 'Riley learns your trading preferences over time, remembers favorite symbols, adapts analysis style to your strategy, provides personalized risk assessments, and delivers contextual recommendations based on past sessions.', tier: 'PRO+' },
              { icon: '📜', title: 'Historical Data Access', desc: 'Access complete historical market data, backtest strategies on past data, replay market conditions, and study historical setups to validate strategies before risking capital.', tier: 'PRO+' },
            ].map((f, i) => (
              <Card key={i} variant="elevated" padding={6}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[4] }}>
                  <div style={{ fontSize: '48px' }}>{f.icon}</div>
                  <Badge variant="success" size="sm">{f.tier}</Badge>
                </div>
                <h3 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[3] }}>{f.title}</h3>
                <p style={{ color: colors.neutral[700], lineHeight: 1.6 }}>{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* UNLIMITED Features */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: spacing[12] }}>
            <Badge variant="warning" size="lg">UNLIMITED FEATURES ($199/month)</Badge>
            <h2 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginTop: spacing[4] }}>Enterprise & Developer Tools</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: spacing[8] }}>
            {[
              { icon: '🔌', title: 'API Access', desc: 'Programmatic access to all RileyAI features. Integrate with custom trading bots, build custom dashboards, automate workflows, and access 10x higher rate limits for high-frequency use cases.', tier: 'UNLIMITED' },
              { icon: '👔', title: 'Priority Support', desc: 'Faster response times, dedicated support channel, feature requests prioritized, and white-glove onboarding to get your team up and running quickly.', tier: 'UNLIMITED' },
              { icon: '♾️', title: 'Unlimited Usage', desc: '999 hours per month (effectively unlimited), never worry about running out of hours, perfect for full-time traders and trading firms, and future-proof with all upcoming features included.', tier: 'UNLIMITED' },
            ].map((f, i) => (
              <Card key={i} variant="elevated" padding={6}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[4] }}>
                  <div style={{ fontSize: '48px' }}>{f.icon}</div>
                  <Badge variant="warning" size="sm">{f.tier}</Badge>
                </div>
                <h3 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[3] }}>{f.title}</h3>
                <p style={{ color: colors.neutral[700], lineHeight: 1.6 }}>{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, background: gradients.primary, textAlign: 'center' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: typography.fontSize.display, fontWeight: 700, color: '#ffffff', marginBottom: spacing[4] }}>
            Ready to Start Trading Smarter?
          </h2>
          <p style={{ fontSize: typography.fontSize.h3, color: 'rgba(255, 255, 255, 0.9)', marginBottom: spacing[8] }}>
            Install the extension and get 3 free hours to try all features
          </p>
          <div style={{ display: 'flex', gap: spacing[4], justifyContent: 'center' }}>
            <Button variant="secondary" size="lg">Install Free Extension</Button>
            <Button variant="ghost" size="lg" style={{ color: '#ffffff', borderColor: '#ffffff' }}>View Pricing</Button>
          </div>
        </div>
      </section>

      <footer style={{ padding: `${spacing[8]} ${spacing[6]}`, background: colors.neutral[900], color: colors.neutral[300], textAlign: 'center' }}>
        <p>© 2025 RileyAI. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Features;
