import React from 'react';
import { Card } from './Card';
import { Button } from './Button';
import { colors, spacing, typography, gradients } from '../tokens';

export type PlanTier = 'FREE' | 'BASIC' | 'PRO' | 'UNLIMITED';

export interface UpgradePromptProps {
  feature: string;
  requiredPlan: Exclude<PlanTier, 'FREE'>;
  benefits?: string[];
  onUpgrade?: () => void;
}

const planInfo: Record<Exclude<PlanTier, 'FREE'>, { price: string; color: string }> = {
  BASIC: { price: '$39', color: colors.primary.solid },
  PRO: { price: '$89', color: colors.success },
  UNLIMITED: { price: '$199', color: colors.warning },
};

const LockIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <rect
      x="5"
      y="11"
      width="14"
      height="10"
      rx="2"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 11V7a4 4 0 018 0v4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill={colors.success} fillOpacity="0.2" />
    <path
      d="M6 10l2.5 2.5L14 7"
      stroke={colors.success}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  requiredPlan,
  benefits,
  onUpgrade,
}) => {
  const plan = planInfo[requiredPlan];

  const defaultBenefits: Record<Exclude<PlanTier, 'FREE'>, string[]> = {
    BASIC: [
      'Multi-Timeframe Confluence Analysis',
      'Chart Snapshot Analysis',
      'Investment Portfolio Tracking',
      '30 hours of trading analysis per month',
    ],
    PRO: [
      'Trading Strategy System',
      'Smart Alerts & Notifications',
      'Preference Learning AI',
      'Historical Data Access',
      '100 hours per month',
    ],
    UNLIMITED: [
      'Unlimited trading hours (999/month)',
      'API Access for automation',
      'Priority Support',
      'All current & future features',
    ],
  };

  const displayBenefits = benefits || defaultBenefits[requiredPlan];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: spacing[6],
      }}
    >
      <Card
        variant="elevated"
        padding={8}
        style={{
          maxWidth: '600px',
          textAlign: 'center',
        }}
      >
        {/* Lock Icon */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: spacing[4],
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: `${plan.color}20`,
              color: plan.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockIcon />
          </div>
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: typography.fontSize.h1,
            fontWeight: typography.fontWeight.bold,
            color: colors.neutral[900],
            marginBottom: spacing[2],
            lineHeight: typography.lineHeight.tight,
          }}
        >
          Unlock {feature}
        </h2>

        {/* Description */}
        <p
          style={{
            fontSize: typography.fontSize.body,
            color: colors.neutral[600],
            marginBottom: spacing[6],
            lineHeight: typography.lineHeight.relaxed,
          }}
        >
          Upgrade to <strong style={{ color: plan.color }}>{requiredPlan}</strong> to access this
          professional trading feature.
        </p>

        {/* Benefits List */}
        <div
          style={{
            textAlign: 'left',
            marginBottom: spacing[6],
            padding: spacing[6],
            background: colors.neutral[50],
            borderRadius: '12px',
          }}
        >
          <h3
            style={{
              fontSize: typography.fontSize.h3,
              fontWeight: typography.fontWeight.semibold,
              color: colors.neutral[900],
              marginBottom: spacing[4],
            }}
          >
            What's included in {requiredPlan}:
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
            {displayBenefits.map((benefit, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: spacing[3],
                }}
              >
                <CheckIcon />
                <span
                  style={{
                    fontSize: typography.fontSize.body,
                    color: colors.neutral[700],
                    lineHeight: typography.lineHeight.relaxed,
                  }}
                >
                  {benefit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div
          style={{
            marginBottom: spacing[6],
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: spacing[2],
            }}
          >
            <span
              style={{
                fontSize: typography.fontSize.display,
                fontWeight: typography.fontWeight.bold,
                color: colors.neutral[900],
              }}
            >
              {plan.price}
            </span>
            <span
              style={{
                fontSize: typography.fontSize.body,
                color: colors.neutral[600],
              }}
            >
              / month
            </span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div
          style={{
            display: 'flex',
            gap: spacing[3],
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Button
            variant="primary"
            size="lg"
            onClick={onUpgrade || (() => (window.location.href = '/account?upgrade=true'))}
          >
            Upgrade to {requiredPlan}
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={() => (window.location.href = '/pricing')}
          >
            Compare All Plans
          </Button>
        </div>

        {/* Footer Note */}
        <p
          style={{
            fontSize: typography.fontSize.small,
            color: colors.neutral[500],
            marginTop: spacing[6],
          }}
        >
          Cancel anytime • 14-day money-back guarantee
        </p>
      </Card>
    </div>
  );
};

export default UpgradePrompt;
