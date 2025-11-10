'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStrategies, useActiveSignals } from '@/hooks/useStrategies';
import { Card, Button, Badge, UpgradePrompt, LoadingSkeleton, EmptyState } from '../design-system';
import { colors, spacing, typography } from '../design-system/tokens';
import { hasFeatureAccess, Feature } from '@/utils/plans';

export const TradingDesk = () => {
  const { user } = useAuth();
  const { data: strategies, isLoading: loadingStrategies } = useStrategies();
  const { data: activeSignals, isLoading: loadingSignals } = useActiveSignals();

  // Check if user has access to this feature
  const hasAccess = user && hasFeatureAccess(user.planTier, Feature.CUSTOM_STRATEGIES);

  if (!hasAccess) {
    return <UpgradePrompt feature="Trading Strategies" requiredPlan="PRO" />;
  }

  // Format time ago helper
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  // Loading state
  if (loadingStrategies) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50] }}>
          <div style={{ maxWidth: '1400px' }}>
            <LoadingSkeleton width="300px" height="40px" style={{ marginBottom: spacing[8] }} />
            <div style={{ display: 'grid', gap: spacing[4], marginBottom: spacing[8] }}>
              <LoadingSkeleton height="200px" />
              <LoadingSkeleton height="200px" />
            </div>
            <LoadingSkeleton height="400px" />
          </div>
        </main>
      </div>
    );
  }

  const activeStrategies = strategies?.filter((s: any) => s.isActive) || [];
  const activeStrategiesCount = activeStrategies.length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50] }}>
        <div style={{ maxWidth: '1400px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[8] }}>
            <h1 style={{ fontSize: typography.fontSize.display, fontWeight: 700 }}>Trading Desk</h1>
            <div style={{ display: 'flex', gap: spacing[3] }}>
              <Badge variant="success">{activeStrategiesCount} Active {activeStrategiesCount === 1 ? 'Strategy' : 'Strategies'}</Badge>
              <Button variant="primary">Create New Strategy</Button>
            </div>
          </div>

          {/* Active Strategies */}
          <div style={{ marginBottom: spacing[8] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[4] }}>
              Active Strategies (During Live Sessions)
            </h2>
            {strategies && strategies.length > 0 ? (
              <div style={{ display: 'grid', gap: spacing[4] }}>
                {strategies.map((strategy: any) => (
                  <Card key={strategy.id} variant="elevated" padding={6}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing[4] }}>
                      <div>
                        <h3 style={{ fontSize: typography.fontSize.h3, fontWeight: 600, marginBottom: spacing[2] }}>
                          {strategy.name}
                        </h3>
                        <div style={{ display: 'flex', gap: spacing[4], fontSize: '14px', color: colors.neutral[600] }}>
                          <span>Win Rate: <strong>{strategy.winRate ? `${strategy.winRate.toFixed(1)}%` : 'N/A'}</strong></span>
                          <span>Signals: <strong>{strategy.signalCount || 0} total</strong></span>
                        </div>
                      </div>
                      <Badge variant={strategy.isActive ? 'success' : 'neutral'}>
                        {strategy.isActive ? 'ON' : 'OFF'}
                      </Badge>
                    </div>
                    <div style={{ padding: spacing[3], background: colors.neutral[50], borderRadius: '8px', marginBottom: spacing[4] }}>
                      <div style={{ fontSize: '13px', color: colors.neutral[600], marginBottom: spacing[1] }}>Description</div>
                      <div style={{ fontWeight: 500 }}>{strategy.description || 'No description'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: spacing[3] }}>
                      <Button variant="secondary">View Details</Button>
                      <Button variant="ghost">{strategy.isActive ? 'Pause' : 'Activate'}</Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card variant="elevated" padding={6}>
                <EmptyState
                  title="No Strategies Created"
                  description="Create your first custom trading strategy to receive AI-powered signals during live sessions."
                  action={{
                    label: 'Create Strategy',
                    onClick: () => console.log('Create strategy'),
                  }}
                />
              </Card>
            )}
          </div>

          {/* Real-Time Signals */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[8] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Real-Time Signals</h2>
            {loadingSignals ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
                <LoadingSkeleton height="80px" />
                <LoadingSkeleton height="80px" />
              </div>
            ) : activeSignals && activeSignals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
                {activeSignals.map((signal: any) => {
                  const signalColor = signal.type === 'BUY' ? colors.success : colors.error;
                  const formatPrice = (price: number) => `$${price.toFixed(2)}`;

                  return (
                    <div key={signal.id} style={{ padding: spacing[4], background: colors.neutral[50], borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: spacing[4], alignItems: 'center' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: signalColor }} />
                        <div>
                          <div style={{ fontSize: typography.fontSize.h3, fontWeight: 600, color: signalColor }}>
                            {signal.type} {signal.symbol} @ {formatPrice(signal.price)}
                          </div>
                          <div style={{ fontSize: '13px', color: colors.neutral[600], marginTop: spacing[1] }}>
                            {signal.strategyName || 'Custom Strategy'} • {formatTimeAgo(signal.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: '13px' }}>
                        {signal.targetPrice && <div>Target: <strong>{formatPrice(signal.targetPrice)}</strong></div>}
                        {signal.stopLoss && <div>Stop: <strong>{formatPrice(signal.stopLoss)}</strong></div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: spacing[8], color: colors.neutral[500] }}>
                <p>No active signals</p>
                <p style={{ fontSize: '14px', marginTop: spacing[2] }}>
                  Signals will appear here during active trading sessions
                </p>
              </div>
            )}
          </Card>

          {/* Performance */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing[6] }}>
            <Card variant="elevated" padding={6}>
              <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Strategy Performance</h2>
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.neutral[400], background: colors.neutral[50], borderRadius: '8px' }}>
                [Win Rate Chart Over Time]
              </div>
            </Card>

            <Card variant="elevated" padding={6}>
              <h3 style={{ fontSize: typography.fontSize.h3, fontWeight: 600, marginBottom: spacing[4] }}>
                Multi-Timeframe Confluence
              </h3>
              <div style={{ fontSize: '13px', color: colors.neutral[600], marginBottom: spacing[4] }}>Current Symbol: AAPL</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[2] }}>
                {[
                  { tf: '1D', trend: '🟢 UP', score: '8/10', signal: 'Strong Buy' },
                  { tf: '4H', trend: '🟢 UP', score: '7/10', signal: 'Buy' },
                  { tf: '1H', trend: '🟡 Neut', score: '5/10', signal: 'Wait' },
                  { tf: '15M', trend: '🔴 Down', score: '4/10', signal: 'Pullback' },
                ].map((item, i) => (
                  <div key={i} style={{ padding: spacing[2], background: colors.neutral[50], borderRadius: '6px', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>{item.tf}</span>
                    <span>{item.trend}</span>
                    <span>{item.score}</span>
                    <span style={{ color: colors.neutral[600] }}>{item.signal}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: spacing[4], padding: spacing[3], background: colors.primary.solid + '20', borderRadius: '8px', textAlign: 'center', color: colors.primary.solid, fontWeight: 600 }}>
                Confluence Score: 7.2/10
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TradingDesk;
