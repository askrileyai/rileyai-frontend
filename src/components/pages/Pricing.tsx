'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useCreateCheckoutSession } from '@/hooks/useStripe';
import { Card, Button, Badge } from '@/design-system';
import { colors, spacing, typography, gradients } from '@/design-system/tokens';

const Header = () => {
  const { user } = useAuth();

  return (
  <header style={{ position: 'sticky', top: 0, zIndex: 1100, background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${colors.neutral[200]}` }}>
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: `${spacing[4]} ${spacing[6]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <div style={{ width: '32px', height: '32px', background: gradients.primary, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>R</div>
        <span style={{ fontSize: typography.fontSize.h3, fontWeight: 700 }}>RileyAI</span>
      </div>
      <nav style={{ display: 'flex', gap: spacing[6] }}>
        <a href="/" style={{ color: colors.neutral[700], textDecoration: 'none' }}>Home</a>
        <a href="/features" style={{ color: colors.neutral[700], textDecoration: 'none' }}>Features</a>
        <a href="/pricing" style={{ color: colors.primary.solid, textDecoration: 'none', fontWeight: 500 }}>Pricing</a>
        <a href="/how-it-works" style={{ color: colors.neutral[700], textDecoration: 'none' }}>How It Works</a>
      </nav>
      <div style={{ display: 'flex', gap: spacing[3], alignItems: 'center' }}>
        {user ? (
          <>
            <a href="/dashboard" style={{ color: colors.neutral[600], textDecoration: 'none', fontSize: '14px' }}>
              Dashboard
            </a>
            <Badge variant="primary">{user.planTier === 'ELITE' ? 'UNLIMITED' : user.planTier}</Badge>
          </>
        ) : (
          <>
            <a href="/dashboard" style={{ color: colors.neutral[600], textDecoration: 'none', fontSize: '14px' }}>Login</a>
            <Button variant="primary">Install Extension</Button>
          </>
        )}
      </div>
    </div>
  </header>
  );
};

export const Pricing = () => {
  const { user } = useAuth();
  const { mutate: createCheckoutSession, isPending: isCreatingCheckout } = useCreateCheckoutSession();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  // Stripe Price IDs (these should match your Stripe product price IDs)
  const PRICE_IDS = {
    FREE: null,
    BASIC: process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID || 'price_basic',
    PRO: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || 'price_pro',
    UNLIMITED: process.env.NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID || 'price_unlimited',
  };

  const handlePlanSelection = (plan: string) => {
    const priceId = PRICE_IDS[plan as keyof typeof PRICE_IDS];

    // Handle FREE plan
    if (plan === 'FREE') {
      if (user) {
        window.location.href = '/dashboard';
      } else {
        window.location.href = '/register';
      }
      return;
    }

    // Handle UNLIMITED plan (contact sales)
    if (plan === 'UNLIMITED') {
      window.location.href = 'mailto:sales@askrileyai.com?subject=UNLIMITED Plan Inquiry';
      return;
    }

    // Handle paid plans - create Stripe checkout session
    if (!user) {
      // Redirect to registration if not logged in
      window.location.href = '/register';
      return;
    }

    if (priceId) {
      setSelectedPlan(plan);
      createCheckoutSession(priceId);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: colors.neutral[50] }}>
      <Header />
      
      {/* Hero */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, textAlign: 'center', background: '#ffffff' }}>
        <h1 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginBottom: spacing[3] }}>
          Simple, Transparent Pricing
        </h1>
        <p style={{ fontSize: typography.fontSize.h3, color: colors.neutral[600], marginBottom: spacing[6] }}>
          Choose the plan that fits your trading style
        </p>
        <p style={{ fontSize: typography.fontSize.body, color: colors.neutral[500] }}>
          Cancel anytime • 14-day money-back guarantee • No hidden fees
        </p>
      </section>

      {/* Pricing Cards */}
      <section style={{ padding: `${spacing[8]} ${spacing[6]} ${spacing[16]}`, background: colors.neutral[50] }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: spacing[6] }}>
            {[
              { plan: 'FREE', price: '$0', hours: '3 hours/month', features: ['Real-time AI analysis', 'Session management', 'TradingView integration', 'Chat & export'], cta: 'Get Started', popular: false },
              { plan: 'BASIC', price: '$39', hours: '30 hours/month', features: ['Everything in FREE', 'Multi-timeframe analysis', 'Chart snapshot analysis', 'Investment portfolio tracking', '2x API rate limit'], cta: 'Start Free Trial', popular: false },
              { plan: 'PRO', price: '$89', hours: '100 hours/month', features: ['Everything in BASIC', 'Trading strategy system', 'Smart alerts & notifications', 'Preference learning AI', 'Historical data access', '4x API rate limit'], cta: 'Start Free Trial', popular: true },
              { plan: 'UNLIMITED', price: '$199', hours: '999 hours/month', features: ['Everything in PRO', 'Unlimited usage', 'API access & integration', 'Priority support', 'White-glove onboarding', '10x API rate limit'], cta: 'Contact Sales', popular: false },
            ].map((tier, idx) => (
              <Card key={idx} variant="elevated" padding={8} style={{ position: 'relative', border: tier.popular ? `2px solid ${colors.primary.solid}` : 'none' }}>
                {tier.popular && (
                  <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: gradients.primary, color: '#ffffff', padding: `${spacing[1]} ${spacing[4]}`, borderRadius: '20px', fontSize: typography.fontSize.tiny, fontWeight: 600 }}>
                    MOST POPULAR
                  </div>
                )}
                
                <div style={{ textAlign: 'center', marginBottom: spacing[6] }}>
                  <h3 style={{ fontSize: typography.fontSize.h2, fontWeight: 700, marginBottom: spacing[3] }}>{tier.plan}</h3>
                  <div style={{ fontSize: '48px', fontWeight: 700, marginBottom: spacing[1] }}>
                    {tier.price}
                    <span style={{ fontSize: typography.fontSize.body, color: colors.neutral[600], fontWeight: 400 }}>/mo</span>
                  </div>
                  <p style={{ color: colors.neutral[600] }}>{tier.hours}</p>
                </div>

                <Button
                  variant={tier.popular ? 'primary' : 'secondary'}
                  fullWidth
                  style={{ marginBottom: spacing[6] }}
                  onClick={() => handlePlanSelection(tier.plan)}
                  disabled={isCreatingCheckout && selectedPlan === tier.plan}
                >
                  {isCreatingCheckout && selectedPlan === tier.plan ? 'Loading...' : tier.cta}
                </Button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
                  {tier.features.map((feature, i) => (
                    <div key={i} style={{ display: 'flex', gap: spacing[2], alignItems: 'flex-start' }}>
                      <span style={{ color: colors.success, fontSize: '18px' }}>✓</span>
                      <span style={{ fontSize: typography.fontSize.small, color: colors.neutral[700] }}>{feature}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Matrix */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, background: '#ffffff' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: typography.fontSize.display, fontWeight: 700, textAlign: 'center', marginBottom: spacing[12] }}>
            Complete Feature Comparison
          </h2>
          
          <Card variant="bordered" padding={6}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                  <th style={{ padding: spacing[4], textAlign: 'left', fontWeight: 600 }}>Feature</th>
                  <th style={{ padding: spacing[4], textAlign: 'center', fontWeight: 600 }}>FREE</th>
                  <th style={{ padding: spacing[4], textAlign: 'center', fontWeight: 600 }}>BASIC</th>
                  <th style={{ padding: spacing[4], textAlign: 'center', fontWeight: 600 }}>PRO</th>
                  <th style={{ padding: spacing[4], textAlign: 'center', fontWeight: 600 }}>UNLIMITED</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: 'Monthly Hours', free: '3', basic: '30', pro: '100', unlimited: '999' },
                  { feature: 'Real-time AI Analysis', free: '✓', basic: '✓', pro: '✓', unlimited: '✓' },
                  { feature: 'Multi-timeframe Analysis', free: '—', basic: '✓', pro: '✓', unlimited: '✓' },
                  { feature: 'Chart Snapshots', free: '—', basic: '✓', pro: '✓', unlimited: '✓' },
                  { feature: 'Investment Tracking', free: '—', basic: '✓', pro: '✓', unlimited: '✓' },
                  { feature: 'Trading Strategies', free: '—', basic: '—', pro: '✓', unlimited: '✓' },
                  { feature: 'Smart Alerts', free: '—', basic: '—', pro: '✓', unlimited: '✓' },
                  { feature: 'API Access', free: '—', basic: '—', pro: '—', unlimited: '✓' },
                  { feature: 'Priority Support', free: '—', basic: '—', pro: '—', unlimited: '✓' },
                ].map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                    <td style={{ padding: spacing[4] }}>{row.feature}</td>
                    <td style={{ padding: spacing[4], textAlign: 'center' }}>{row.free}</td>
                    <td style={{ padding: spacing[4], textAlign: 'center' }}>{row.basic}</td>
                    <td style={{ padding: spacing[4], textAlign: 'center' }}>{row.pro}</td>
                    <td style={{ padding: spacing[4], textAlign: 'center' }}>{row.unlimited}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: `${spacing[16]} ${spacing[6]}`, background: colors.neutral[50] }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: typography.fontSize.display, fontWeight: 700, textAlign: 'center', marginBottom: spacing[12] }}>
            Frequently Asked Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[6] }}>
            {[
              { q: 'How does hour-based pricing work?', a: 'Hours track active trading sessions on TradingView. Sessions auto-pause after 30 minutes of inactivity.' },
              { q: 'Can I upgrade or downgrade anytime?', a: 'Yes! Upgrade instantly or downgrade at the end of your billing cycle.' },
              { q: 'What happens if I run out of hours?', a: 'You can upgrade your plan or wait until next month. Your data and settings are always preserved.' },
              { q: 'Is there a free trial?', a: 'FREE plan includes 3 hours to try RileyAI. Paid plans include a 14-day money-back guarantee.' },
            ].map((faq, i) => (
              <Card key={i} variant="bordered" padding={6}>
                <h3 style={{ fontSize: typography.fontSize.h3, fontWeight: 600, marginBottom: spacing[3] }}>{faq.q}</h3>
                <p style={{ color: colors.neutral[700], lineHeight: 1.6 }}>{faq.a}</p>
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

export default Pricing;
