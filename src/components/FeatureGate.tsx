'use client';

// Feature Gate Component
// Shows upgrade prompts for features not available in user's plan

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hasFeatureAccess, Feature, FEATURE_REQUIREMENTS, getPlanDetails } from '@/utils/plans';

interface FeatureGateProps {
  feature: Feature;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export default function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: FeatureGateProps) {
  const { user } = useAuth();

  // If no user, show fallback or nothing
  if (!user) {
    return fallback ? <>{fallback}</> : null;
  }

  // Check if user has access to this feature
  const hasAccess = hasFeatureAccess(user.planTier, feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Show upgrade prompt if feature is locked
  if (showUpgradePrompt) {
    const requiredPlan = FEATURE_REQUIREMENTS[feature];
    const planDetails = getPlanDetails(requiredPlan);

    return (
      <UpgradePrompt
        featureName={getFeatureName(feature)}
        requiredPlan={planDetails.displayName}
        price={planDetails.price}
      />
    );
  }

  // Show custom fallback or nothing
  return fallback ? <>{fallback}</> : null;
}

// ===== UPGRADE PROMPT COMPONENT =====

interface UpgradePromptProps {
  featureName: string;
  requiredPlan: string;
  price: number;
}

function UpgradePrompt({ featureName, requiredPlan, price }: UpgradePromptProps) {
  return (
    <div
      style={{
        padding: '32px',
        textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(102, 126, 234, 0.2)',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          margin: '0 auto 16px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
        }}
      >
        🔒
      </div>

      <h3
        style={{
          fontSize: '24px',
          fontWeight: 700,
          marginBottom: '8px',
          color: '#1a1a1a',
        }}
      >
        {featureName} Locked
      </h3>

      <p
        style={{
          fontSize: '16px',
          color: '#666',
          marginBottom: '24px',
        }}
      >
        Upgrade to <strong>{requiredPlan}</strong> to unlock this feature
        {price > 0 && ` for just $${price}/month`}.
      </p>

      <a
        href="/pricing"
        style={{
          display: 'inline-block',
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 600,
          textDecoration: 'none',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 20px rgba(102, 126, 234, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        View Plans
      </a>
    </div>
  );
}

// ===== HELPER FUNCTIONS =====

function getFeatureName(feature: Feature): string {
  const names: Record<Feature, string> = {
    [Feature.BASIC_ANALYSIS]: 'Basic Analysis',
    [Feature.ADVANCED_ANALYSIS]: 'Advanced Analysis',
    [Feature.UNLIMITED_ANALYSIS]: 'Unlimited Analysis',
    [Feature.REAL_TIME_DATA]: 'Real-Time Data',
    [Feature.HISTORICAL_DATA]: 'Historical Data',
    [Feature.MARKET_ALERTS]: 'Market Alerts',
    [Feature.BASIC_BACKTESTING]: 'Basic Backtesting',
    [Feature.ADVANCED_BACKTESTING]: 'Advanced Backtesting',
    [Feature.CUSTOM_STRATEGIES]: 'Custom Strategies',
    [Feature.STRATEGY_SIGNALS]: 'Strategy Signals',
    [Feature.PORTFOLIO_TRACKING]: 'Portfolio Tracking',
    [Feature.PLAID_INTEGRATION]: 'Plaid Integration',
    [Feature.MULTI_ACCOUNT]: 'Multi-Account Management',
    [Feature.EMAIL_SUPPORT]: 'Email Support',
    [Feature.PRIORITY_SUPPORT]: 'Priority Support',
    [Feature.WHITEGLOVE_SUPPORT]: 'White-Glove Support',
    [Feature.API_ACCESS]: 'API Access',
    [Feature.CUSTOM_INDICATORS]: 'Custom Indicators',
  };

  return names[feature] || 'This Feature';
}
