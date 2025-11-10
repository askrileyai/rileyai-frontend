'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePortfolio, useCreatePlaidLinkToken, useExchangePlaidToken, useRefreshInvestments } from '@/hooks/useInvestments';
import { Card, StatsCard, Button, EmptyState, Badge, LoadingSkeleton } from '../design-system';
import { colors, spacing, typography } from '../design-system/tokens';
import { hasFeatureAccess, Feature } from '@/utils/plans';

export const Investments = () => {
  const { user } = useAuth();
  const { data: portfolio, isLoading, refetch } = usePortfolio();
  const { mutateAsync: createLinkToken } = useCreatePlaidLinkToken();
  const { mutateAsync: exchangeToken } = useExchangePlaidToken();
  const { mutate: refreshInvestments, isPending: isRefreshing } = useRefreshInvestments();

  // Check if user has access to this feature
  const hasAccess = user && hasFeatureAccess(user.planTier, Feature.PORTFOLIO_TRACKING);

  // Feature gate for users without access
  if (!hasAccess) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', padding: spacing[8], background: colors.neutral[50] }}>
        <Card variant="elevated" padding={8} style={{ maxWidth: '500px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: spacing[4] }}>📊</div>
          <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 700, marginBottom: spacing[3] }}>
            Investment Tracking
          </h2>
          <p style={{ color: colors.neutral[600], marginBottom: spacing[6], lineHeight: 1.6 }}>
            Connect your investment accounts and get AI-powered portfolio analysis, risk assessment, and personalized recommendations.
          </p>
          <p style={{ color: colors.neutral[700], fontWeight: 600, marginBottom: spacing[4] }}>
            Requires PRO plan or higher
          </p>
          <Button variant="primary" onClick={() => window.location.href = '/pricing'}>
            Upgrade to PRO
          </Button>
        </Card>
      </div>
    );
  }

  const handleConnectPlaid = async () => {
    try {
      const { link_token } = await createLinkToken();

      // Load Plaid Link (would need to add Plaid script to the page)
      // For now, just show a message
      alert('Plaid Link integration coming soon! Link token created: ' + link_token.substring(0, 20) + '...');
    } catch (error) {
      console.error('Error creating Plaid link token:', error);
      alert('Failed to initialize Plaid. Please try again.');
    }
  };

  const handleRefresh = () => {
    refreshInvestments();
  };

  // No accounts connected yet
  if (!isLoading && (!portfolio || portfolio.accounts.length === 0)) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Card variant="elevated" padding={8} style={{ maxWidth: '600px', textAlign: 'center' }}>
            <EmptyState
              title="No Investment Accounts Connected"
              description="Connect your brokerage, retirement, or robo-advisor accounts to start tracking your portfolio with AI-powered insights."
              action={{
                label: 'Connect with Plaid',
                onClick: handleConnectPlaid,
              }}
            />
            <div style={{ marginTop: spacing[6], padding: spacing[4], background: colors.neutral[50], borderRadius: '12px' }}>
              <p style={{ fontSize: '14px', color: colors.neutral[600], marginBottom: spacing[2] }}>
                <strong>Supported Brokers:</strong>
              </p>
              <p style={{ fontSize: '13px', color: colors.neutral[500] }}>
                Fidelity, Charles Schwab, TD Ameritrade, Robinhood, E*TRADE, Vanguard, and 12,000+ institutions
              </p>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50] }}>
          <div style={{ marginBottom: spacing[6] }}>
            <LoadingSkeleton width="300px" height="40px" />
            <LoadingSkeleton width="200px" height="20px" style={{ marginTop: spacing[2] }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing[6], marginBottom: spacing[8] }}>
            <LoadingSkeleton height="120px" />
            <LoadingSkeleton height="120px" />
            <LoadingSkeleton height="120px" />
          </div>
          <LoadingSkeleton height="400px" />
        </main>
      </div>
    );
  }

  // Accounts connected - show portfolio
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercent = (percent: number) => {
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50] }}>
        <div style={{ maxWidth: '1200px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[8] }}>
            <div>
              <h1 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginBottom: spacing[2] }}>
                Investment Portfolio
              </h1>
              <p style={{ color: colors.neutral[600] }}>
                {portfolio?.accounts.length} account{portfolio?.accounts.length !== 1 ? 's' : ''} connected
              </p>
            </div>
            <div style={{ display: 'flex', gap: spacing[3] }}>
              <Button variant="secondary" onClick={handleRefresh} disabled={isRefreshing}>
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button variant="primary" onClick={handleConnectPlaid}>
                Add Account
              </Button>
            </div>
          </div>

          {/* Portfolio Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: spacing[6], marginBottom: spacing[8] }}>
            <StatsCard
              label="Total Value"
              value={formatCurrency(portfolio?.totalValue || 0)}
              trend={portfolio && portfolio.totalGainLoss !== 0 ? {
                direction: portfolio.totalGainLoss >= 0 ? 'up' : 'down',
                value: formatPercent(portfolio.totalGainLossPercent)
              } : undefined}
              variant="primary"
            />
            <StatsCard
              label="Total Gain/Loss"
              value={formatCurrency(Math.abs(portfolio?.totalGainLoss || 0))}
              variant={portfolio && portfolio.totalGainLoss >= 0 ? 'success' : 'danger'}
            />
            <StatsCard
              label="Number of Holdings"
              value={portfolio?.holdings.length.toString() || '0'}
              description="Across all accounts"
            />
          </div>

          {/* Connected Accounts */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[8] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>
              Connected Accounts
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
              {portfolio?.accounts.map((account) => (
                <div key={account.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: spacing[4],
                  background: colors.neutral[50],
                  borderRadius: '12px',
                }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: spacing[1] }}>{account.name}</div>
                    <div style={{ fontSize: '14px', color: colors.neutral[500] }}>{account.type}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: '18px' }}>{formatCurrency(account.balance)}</div>
                    <div style={{ fontSize: '13px', color: colors.neutral[500] }}>
                      {account.holdings.length} holding{account.holdings.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Holdings Table */}
          <Card variant="elevated" padding={6}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>
              All Holdings
            </h2>
            {portfolio && portfolio.holdings.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.neutral[200]}` }}>
                      <th style={{ padding: spacing[3], textAlign: 'left', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: spacing[3], textAlign: 'left', fontWeight: 600 }}>Symbol</th>
                      <th style={{ padding: spacing[3], textAlign: 'right', fontWeight: 600 }}>Quantity</th>
                      <th style={{ padding: spacing[3], textAlign: 'right', fontWeight: 600 }}>Current Price</th>
                      <th style={{ padding: spacing[3], textAlign: 'right', fontWeight: 600 }}>Value</th>
                      <th style={{ padding: spacing[3], textAlign: 'right', fontWeight: 600 }}>Gain/Loss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.holdings.map((holding) => (
                      <tr key={holding.id} style={{ borderBottom: `1px solid ${colors.neutral[100]}` }}>
                        <td style={{ padding: spacing[3] }}>{holding.name}</td>
                        <td style={{ padding: spacing[3] }}>
                          {holding.ticker && <Badge variant="secondary" size="sm">{holding.ticker}</Badge>}
                        </td>
                        <td style={{ padding: spacing[3], textAlign: 'right' }}>{holding.quantity}</td>
                        <td style={{ padding: spacing[3], textAlign: 'right' }}>{formatCurrency(holding.currentPrice)}</td>
                        <td style={{ padding: spacing[3], textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(holding.currentValue)}
                        </td>
                        <td style={{
                          padding: spacing[3],
                          textAlign: 'right',
                          color: holding.gainLoss && holding.gainLoss >= 0 ? colors.success : colors.error,
                          fontWeight: 600,
                        }}>
                          {holding.gainLoss !== undefined ? (
                            <>
                              {formatCurrency(Math.abs(holding.gainLoss))}
                              {holding.gainLossPercent !== undefined && (
                                <span style={{ fontSize: '13px', marginLeft: spacing[1] }}>
                                  ({formatPercent(holding.gainLossPercent)})
                                </span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No Holdings"
                description="Your connected accounts don't have any holdings yet."
              />
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Investments;
