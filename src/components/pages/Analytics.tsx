'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsageStats } from '@/hooks/useUser';
import { useSessions } from '@/hooks/useSessions';
import { Card, ProgressBar, Badge, LoadingSkeleton } from '@/design-system';
import { colors, spacing, typography } from '@/design-system/tokens';
import { formatHours } from '@/utils/plans';

export const Analytics = () => {
  const { user } = useAuth();
  const { data: usageStats, isLoading: loadingUsage } = useUsageStats();
  const { data: sessions, isLoading: loadingSessions } = useSessions();

  // Calculate billing period
  const getBillingPeriod = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.toLocaleString('default', { month: 'short' });
    const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate();
    return `${month} 1-${daysInMonth}, ${year}`;
  };

  // Calculate days remaining in month
  const getDaysRemaining = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.ceil((lastDay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loadingUsage || loadingSessions) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50] }}>
          <div style={{ maxWidth: '1200px' }}>
            <LoadingSkeleton width="300px" height="40px" style={{ marginBottom: spacing[8] }} />
            <LoadingSkeleton height="300px" style={{ marginBottom: spacing[8] }} />
            <LoadingSkeleton height="400px" />
          </div>
        </main>
      </div>
    );
  }

  const hoursUsed = usageStats?.hoursUsed || 0;
  const hoursLimit = usageStats?.hoursLimit || 100;
  const hoursRemaining = hoursLimit - hoursUsed;
  const percentageUsed = usageStats?.percentageUsed || 0;
  const daysRemaining = getDaysRemaining();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50] }}>
        <div style={{ maxWidth: '1200px' }}>
          <div style={{ marginBottom: spacing[8] }}>
            <h1 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginBottom: spacing[2] }}>Usage Analytics</h1>
            <p style={{ color: colors.neutral[600] }}>Billing Period: {getBillingPeriod()}</p>
          </div>

          {/* Hours This Month */}
          <Card variant="elevated" padding={8} style={{ marginBottom: spacing[8] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[8], textAlign: 'center' }}>
              ⏱️ Hours This Month
            </h2>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: spacing[6] }}>
              <ProgressBar variant="circular" value={100 - percentageUsed} max={100} label="Hours Remaining" size={200} />
            </div>
            <div style={{ textAlign: 'center', color: colors.neutral[600] }}>
              <p>{hoursRemaining.toFixed(1)} hours left ({daysRemaining} days remaining)</p>
              <p style={{ marginTop: spacing[2], fontSize: '14px' }}>
                {hoursUsed.toFixed(1)} / {formatHours(hoursLimit)} used
              </p>
            </div>
          </Card>

          {/* Daily Usage Pattern */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[8] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Daily Usage Pattern</h2>
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.neutral[50], borderRadius: '8px', color: colors.neutral[400] }}>
              [Bar Chart: Hours per day this month]
            </div>
          </Card>

          {/* Session History */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[8] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Session History</h2>
            {sessions && sessions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3] }}>
                {sessions.slice(0, 10).map((session: any) => (
                  <div key={session.id} style={{ padding: spacing[4], background: colors.neutral[50], borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{formatDate(session.startedAt)}</div>
                      <div style={{ fontSize: '13px', color: colors.neutral[600], marginTop: spacing[1] }}>
                        {session.symbol}{session.timeframe ? ` (${session.timeframe})` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                      <Badge variant={session.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">
                        {session.status}
                      </Badge>
                      <Badge variant="primary">{session.totalHours.toFixed(1)} hours</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: spacing[8], color: colors.neutral[500] }}>
                <p>No sessions yet</p>
                <p style={{ fontSize: '14px', marginTop: spacing[2] }}>
                  Your trading sessions will appear here
                </p>
              </div>
            )}
          </Card>

          {/* Trading Performance Metrics */}
          <Card variant="elevated" padding={6}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Trading Performance Metrics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing[6] }}>
              <div style={{ padding: spacing[4], background: colors.neutral[50], borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing[2] }}>
                  Total Sessions
                </div>
                <div style={{ fontSize: typography.fontSize.h2, fontWeight: 700, color: colors.neutral[900] }}>
                  {usageStats?.sessionsCount || 0}
                </div>
              </div>
              <div style={{ padding: spacing[4], background: colors.neutral[50], borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing[2] }}>
                  Most Active Symbol
                </div>
                <div style={{ fontSize: typography.fontSize.h2, fontWeight: 700, color: colors.neutral[900] }}>
                  {sessions && sessions.length > 0 ? sessions[0].symbol : 'N/A'}
                </div>
              </div>
              <div style={{ padding: spacing[4], background: colors.neutral[50], borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing[2] }}>
                  Avg Session Length
                </div>
                <div style={{ fontSize: typography.fontSize.h2, fontWeight: 700, color: colors.neutral[900] }}>
                  {sessions && sessions.length > 0
                    ? (sessions.reduce((sum: number, s: any) => sum + s.totalHours, 0) / sessions.length).toFixed(1) + ' hours'
                    : 'N/A'}
                </div>
              </div>
              <div style={{ padding: spacing[4], background: colors.neutral[50], borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing[2] }}>
                  Hours This Month
                </div>
                <div style={{ fontSize: typography.fontSize.h2, fontWeight: 700, color: colors.neutral[900] }}>
                  {hoursUsed.toFixed(1)}h
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
