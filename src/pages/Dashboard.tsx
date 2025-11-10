'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUsageStats } from '@/hooks/useUser';
import { useSessions } from '@/hooks/useSessions';
import { Card, StatsCard, Button, ProgressBar, Badge, LoadingSkeleton } from '../design-system';
import { colors, spacing, typography } from '../design-system/tokens';
import { formatHours, calculateUsagePercentage } from '@/utils/plans';
import UsageBanner from '@/components/UsageBanner';

const DashboardSidebar = ({ currentPath }: { currentPath: string }) => {
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/investments', label: 'Investments', icon: '📊', badge: 'PRO+' },
    { path: '/trading-desk', label: 'Trading Desk', icon: '📈', badge: 'PRO+' },
    { path: '/analytics', label: 'Analytics', icon: '📉' },
    { path: '/account', label: 'Account', icon: '⚙️' },
  ];

  const displayPlan = user?.planTier === 'ELITE' ? 'UNLIMITED' : user?.planTier;

  return (
    <aside style={{ width: '260px', height: '100vh', position: 'sticky', top: 0, background: '#fff', borderRight: `1px solid ${colors.neutral[200]}`, padding: spacing[6], display: 'flex', flexDirection: 'column', gap: spacing[6] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
        <div style={{ width: '32px', height: '32px', background: `linear-gradient(135deg, ${colors.primary.start}, ${colors.primary.end})`, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>R</div>
        <span style={{ fontSize: '20px', fontWeight: 700 }}>RileyAI</span>
      </div>

      {user && (
        <div style={{ padding: spacing[4], background: colors.neutral[50], borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing[2] }}>
            <span style={{ fontSize: '13px', color: colors.neutral[600] }}>{user.name || 'User'}</span>
            <Badge variant="primary" size="sm">{displayPlan}</Badge>
          </div>
          <div><span style={{ fontSize: '11px', color: colors.neutral[500] }}>Hours Remaining</span></div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>
            {formatHours(user.monthlyHoursLimit - user.monthlyHoursUsed)}
          </div>
        </div>
      )}

      <nav style={{ display: 'flex', flexDirection: 'column', gap: spacing[1], flex: 1 }}>
        {navItems.map(item => (
          <a key={item.path} href={item.path} style={{
              display: 'flex', alignItems: 'center', gap: spacing[3], padding: `${spacing[3]} ${spacing[4]}`,
              borderRadius: '8px', textDecoration: 'none', background: currentPath === item.path ? colors.primary.solid : 'transparent',
              color: currentPath === item.path ? '#fff' : colors.neutral[700], fontWeight: 500,
            }}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && <Badge variant="neutral" size="sm">{item.badge}</Badge>}
          </a>
        ))}
      </nav>

      <Button variant="ghost" fullWidth onClick={logout}>
        Logout
      </Button>
    </aside>
  );
};

export const Dashboard = () => {
  const { user } = useAuth();
  const { data: usageStats, isLoading: loadingUsage } = useUsageStats();
  const { data: sessions, isLoading: loadingSessions } = useSessions();

  const recentSessions = sessions?.slice(0, 3) || [];

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <DashboardSidebar currentPath="/dashboard" />

      <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50] }}>
        <div style={{ maxWidth: '1200px' }}>
          <div style={{ marginBottom: spacing[8] }}>
            <h1 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginBottom: spacing[2] }}>
              Welcome back{user?.name ? `, ${user.name}` : ''}! 👋
            </h1>
            {usageStats?.lastSession && (
              <p style={{ color: colors.neutral[600] }}>
                Last session: {formatTimeAgo(usageStats.lastSession.startedAt)}
              </p>
            )}
          </div>

          <UsageBanner />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing[6], marginBottom: spacing[8] }}>
            {loadingUsage ? (
              <>
                <LoadingSkeleton height="120px" />
                <LoadingSkeleton height="120px" />
                <LoadingSkeleton height="120px" />
              </>
            ) : (
              <>
                <StatsCard
                  label="Hours Used"
                  value={`${usageStats?.hoursUsed.toFixed(1) || '0'} / ${formatHours(usageStats?.hoursLimit || 0)}`}
                  description={`${usageStats?.percentageUsed || 0}% used this month`}
                />
                <StatsCard
                  label="Active Sessions"
                  value={usageStats?.sessionsCount.toString() || '0'}
                  description="Total sessions this month"
                />
                <StatsCard
                  label="Plan"
                  value={user?.planTier === 'ELITE' ? 'UNLIMITED' : user?.planTier || 'FREE'}
                  description={user?.isActive ? 'Active' : 'Inactive'}
                  variant="success"
                />
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: spacing[6], marginBottom: spacing[8] }}>
            <Card variant="elevated" padding={6}>
              <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Recent Sessions</h2>
              {loadingSessions ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
                  <LoadingSkeleton height="60px" />
                  <LoadingSkeleton height="60px" />
                  <LoadingSkeleton height="60px" />
                </div>
              ) : recentSessions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
                  {recentSessions.map((session) => (
                    <div key={session.id} style={{ display: 'flex', justifyContent: 'space-between', padding: spacing[3], background: colors.neutral[50], borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontWeight: 500 }}>
                          {session.symbol} {session.timeframe && `(${session.timeframe})`}
                        </div>
                        <div style={{ fontSize: '13px', color: colors.neutral[500] }}>
                          {formatTimeAgo(session.startedAt)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: spacing[2] }}>
                        <Badge variant={session.status === 'ACTIVE' ? 'success' : 'secondary'} size="sm">
                          {session.status}
                        </Badge>
                        <span style={{ color: colors.neutral[600] }}>
                          {session.totalHours.toFixed(1)}h
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: spacing[8], color: colors.neutral[500] }}>
                  <p>No sessions yet</p>
                  <p style={{ fontSize: '14px', marginTop: spacing[2] }}>
                    Start your first trading session to see activity here
                  </p>
                </div>
              )}
            </Card>

            <Card variant="elevated" padding={6}>
              <h3 style={{ fontSize: typography.fontSize.h3, fontWeight: 600, marginBottom: spacing[4] }}>💬 Quick Tip</h3>
              <p style={{ color: colors.neutral[700], marginBottom: spacing[4], lineHeight: 1.6 }}>
                Connect your investment accounts to get AI-powered portfolio analysis and personalized recommendations.
              </p>
              <Button variant="primary" fullWidth onClick={() => window.location.href = '/investments'}>
                Connect Accounts
              </Button>
            </Card>
          </div>

          <Card variant="elevated" padding={6}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Quick Actions</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: spacing[4] }}>
              <Button variant="primary" onClick={() => window.location.href = '/analytics'}>
                View Analytics
              </Button>
              <Button variant="secondary" onClick={() => window.location.href = '/investments'}>
                View Investments
              </Button>
              <Button variant="secondary" onClick={() => window.location.href = '/trading-desk'}>
                View Strategies
              </Button>
              <Button variant="ghost" onClick={() => window.location.href = '/pricing'}>
                Upgrade Plan
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
