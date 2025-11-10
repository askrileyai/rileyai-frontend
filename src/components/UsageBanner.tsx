'use client';

// Usage Banner Component
// Displays usage stats and upgrade prompts when nearing limit

import { useUsageStats } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import {
  calculateUsagePercentage,
  getUsageColor,
  shouldShowUpgradePrompt,
  getUpgradeMessage,
  formatHours,
} from '@/utils/plans';

export default function UsageBanner() {
  const { user } = useAuth();
  const { data: usageStats, isLoading } = useUsageStats();

  // Don't show if not authenticated or loading
  if (!user || isLoading || !usageStats) {
    return null;
  }

  const { hoursUsed, hoursLimit } = usageStats;
  const percentage = calculateUsagePercentage(hoursUsed, hoursLimit);
  const color = getUsageColor(percentage);
  const shouldShowUpgrade = shouldShowUpgradePrompt(user.planTier, hoursUsed, hoursLimit);
  const upgradeMessage = getUpgradeMessage(user.planTier, hoursUsed, hoursLimit);

  // Don't show banner if usage is low and user is on unlimited
  if (percentage < 70 && (user.planTier === 'UNLIMITED' || user.planTier === 'ELITE')) {
    return null;
  }

  return (
    <div
      style={{
        background: shouldShowUpgrade ? '#fff7e6' : '#f5f5f5',
        borderLeft: `4px solid ${color}`,
        padding: '16px 24px',
        marginBottom: '24px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px',
          }}
        >
          <h4
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#1a1a1a',
              margin: 0,
            }}
          >
            Monthly Usage
          </h4>
          <span
            style={{
              fontSize: '12px',
              color: '#666',
              fontWeight: 500,
            }}
          >
            {hoursUsed.toFixed(1)} / {formatHours(hoursLimit)}
          </span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: '100%',
            height: '8px',
            background: '#e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: shouldShowUpgrade ? '8px' : '0',
          }}
        >
          <div
            style={{
              width: `${percentage}%`,
              height: '100%',
              background: color,
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Upgrade message */}
        {shouldShowUpgrade && upgradeMessage && (
          <p
            style={{
              fontSize: '13px',
              color: '#666',
              margin: 0,
            }}
          >
            {upgradeMessage}
          </p>
        )}
      </div>

      {/* Upgrade button */}
      {shouldShowUpgrade && (
        <a
          href="/pricing"
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          Upgrade
        </a>
      )}
    </div>
  );
}
