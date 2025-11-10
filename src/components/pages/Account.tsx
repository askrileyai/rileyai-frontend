'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscriptionStatus, useCreatePortalSession } from '@/hooks/useStripe';
import { usePortfolio } from '@/hooks/useInvestments';
import { Card, Button, Badge, Modal, LoadingSkeleton } from '@/design-system';
import { colors, spacing, typography } from '@/design-system/tokens';
import { hasFeatureAccess, Feature } from '@/utils/plans';

export const Account = () => {
  const { user } = useAuth();
  const { data: subscription, isLoading: loadingSubscription } = useSubscriptionStatus();
  const { data: portfolio } = usePortfolio();
  const { mutate: openPortal, isPending: openingPortal } = useCreatePortalSession();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement profile update API endpoint
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      alert('Profile update feature coming soon!');
    } catch (error) {
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManageBilling = () => {
    openPortal();
  };

  const getNextBillingDate = () => {
    if (!subscription?.currentPeriodEnd) return 'N/A';
    const date = new Date(subscription.currentPeriodEnd);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getPlanPrice = () => {
    // Use user plan tier to determine price
    if (!user) return '$0';
    const prices: Record<string, string> = {
      'FREE': '$0',
      'BASIC': '$39',
      'PRO': '$89',
      'ELITE': '$199',
      'UNLIMITED': '$199',
    };
    return prices[user.planTier] || '$0';
  };

  const displayPlan = user?.planTier === 'ELITE' ? 'UNLIMITED' : user?.planTier || 'FREE';
  const hasUnlimitedPlan = user?.planTier === 'ELITE';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <main style={{ flex: 1, padding: spacing[8], background: colors.neutral[50] }}>
        <div style={{ maxWidth: '1000px' }}>
          <h1 style={{ fontSize: typography.fontSize.display, fontWeight: 700, marginBottom: spacing[8] }}>Account Settings</h1>

          {/* Profile */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[6] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Profile</h2>
            <div style={{ display: 'grid', gap: spacing[4] }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: spacing[2], color: colors.neutral[700] }}>Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: spacing[3], border: `1px solid ${colors.neutral[300]}`, borderRadius: '8px', fontSize: '15px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: spacing[2], color: colors.neutral[700] }}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: spacing[3], border: `1px solid ${colors.neutral[300]}`, borderRadius: '8px', fontSize: '15px' }}
                />
              </div>
              <Button variant="primary" onClick={handleSaveProfile} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Card>

          {/* Subscription */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[6] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[6] }}>
              <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600 }}>Subscription & Billing</h2>
              <Badge variant="primary" size="lg">{displayPlan} PLAN</Badge>
            </div>

            {loadingSubscription ? (
              <LoadingSkeleton height="150px" style={{ marginBottom: spacing[6] }} />
            ) : (
              <div style={{ padding: spacing[6], background: colors.neutral[50], borderRadius: '12px', marginBottom: spacing[6] }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: spacing[6], marginBottom: spacing[4] }}>
                  <div>
                    <div style={{ fontSize: '11px', color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing[1] }}>Current Plan</div>
                    <div style={{ fontSize: typography.fontSize.h3, fontWeight: 700 }}>{displayPlan}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing[1] }}>Monthly Cost</div>
                    <div style={{ fontSize: typography.fontSize.h3, fontWeight: 700 }}>{getPlanPrice()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: colors.neutral[500], textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: spacing[1] }}>Next Billing</div>
                    <div style={{ fontSize: typography.fontSize.h3, fontWeight: 700 }}>{getNextBillingDate()}</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: colors.neutral[600] }}>
                  {user?.monthlyHoursLimit === 999 ? 'Unlimited hours' : `${user?.monthlyHoursLimit} hours/month`} • All {displayPlan} features included
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: spacing[3] }}>
              {!hasUnlimitedPlan && (
                <Button variant="primary" onClick={() => window.location.href = '/pricing'}>
                  Upgrade to UNLIMITED
                </Button>
              )}
              <Button variant="secondary" onClick={handleManageBilling} disabled={openingPortal}>
                {openingPortal ? 'Opening...' : 'Manage Billing'}
              </Button>
              {user?.planTier !== 'FREE' && (
                <Button variant="ghost" onClick={() => setCancelModalOpen(true)} style={{ color: colors.error }}>
                  Cancel Subscription
                </Button>
              )}
            </div>
          </Card>

          {/* Payment Method */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[6] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Payment Method</h2>
            {subscription?.hasSubscription ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: spacing[4], background: colors.neutral[50], borderRadius: '8px', marginBottom: spacing[4] }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
                    <div style={{ fontSize: '32px' }}>💳</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        Payment method on file
                      </div>
                      <div style={{ fontSize: '13px', color: colors.neutral[600] }}>
                        Managed through Stripe
                      </div>
                    </div>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                <Button variant="secondary" onClick={handleManageBilling}>Manage Payment</Button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: spacing[6], color: colors.neutral[500] }}>
                <p>No payment method on file</p>
                <Button variant="primary" style={{ marginTop: spacing[4] }} onClick={handleManageBilling}>
                  Add Payment Method
                </Button>
              </div>
            )}
          </Card>

          {/* Connected Accounts (Plaid) */}
          {hasFeatureAccess(user?.planTier || 'FREE', Feature.PORTFOLIO_TRACKING) && (
            <Card variant="elevated" padding={6} style={{ marginBottom: spacing[6] }}>
              <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Connected Investment Accounts</h2>
              {portfolio && portfolio.accounts.length > 0 ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[3], marginBottom: spacing[4] }}>
                    {portfolio.accounts.map((account: any) => (
                      <div key={account.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: spacing[4], background: colors.neutral[50], borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing[3] }}>
                          <div style={{ fontSize: '24px' }}>🏦</div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{account.name}</div>
                            <div style={{ fontSize: '13px', color: colors.neutral[600] }}>{account.type}</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" style={{ color: colors.error }}>Disconnect</Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="secondary">Connect New Account</Button>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: spacing[6], color: colors.neutral[500] }}>
                  <p>No investment accounts connected</p>
                  <Button variant="primary" style={{ marginTop: spacing[4] }} onClick={() => window.location.href = '/investments'}>
                    Connect First Account
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Preferences */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[6] }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, marginBottom: spacing[6] }}>Preferences</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing[4] }}>
              {[
                { label: 'Email Notifications', desc: 'Receive session summaries and alerts', checked: true },
                { label: 'Strategy Alerts', desc: 'Get notified when strategies generate signals', checked: true },
                { label: 'Session Auto-Pause', desc: 'Automatically pause sessions after 30 min inactivity', checked: true },
                { label: 'Marketing Emails', desc: 'Product updates and trading tips', checked: false },
              ].map((pref, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: spacing[4], background: colors.neutral[50], borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: spacing[1] }}>{pref.label}</div>
                    <div style={{ fontSize: '13px', color: colors.neutral[600] }}>{pref.desc}</div>
                  </div>
                  <input type="checkbox" defaultChecked={pref.checked} style={{ width: '20px', height: '20px' }} />
                </div>
              ))}
            </div>
          </Card>

          {/* API Keys (UNLIMITED only) */}
          <Card variant="elevated" padding={6} style={{ marginBottom: spacing[6] }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] }}>
              <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600 }}>API Keys</h2>
              <Badge variant="neutral">UNLIMITED Only</Badge>
            </div>
            {hasUnlimitedPlan ? (
              <>
                <p style={{ color: colors.neutral[600], marginBottom: spacing[4] }}>
                  Generate API keys to access RileyAI features programmatically.
                </p>
                <Button variant="primary">Generate API Key</Button>
              </>
            ) : (
              <>
                <p style={{ color: colors.neutral[600], marginBottom: spacing[4] }}>
                  API access is available on the UNLIMITED plan. Upgrade to get programmatic access to RileyAI features.
                </p>
                <Button variant="ghost" onClick={() => window.location.href = '/pricing'}>View UNLIMITED Plan</Button>
              </>
            )}
          </Card>

          {/* Danger Zone */}
          <Card variant="bordered" padding={6} style={{ border: `2px solid ${colors.error}` }}>
            <h2 style={{ fontSize: typography.fontSize.h2, fontWeight: 600, color: colors.error, marginBottom: spacing[4] }}>
              Danger Zone
            </h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: spacing[1] }}>Delete Account</div>
                <div style={{ fontSize: '13px', color: colors.neutral[600] }}>
                  Permanently delete your account and all data. This action cannot be undone.
                </div>
              </div>
              <Button variant="danger">Delete Account</Button>
            </div>
          </Card>
        </div>
      </main>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Subscription"
        description="Are you sure you want to cancel your PRO subscription?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>Keep Subscription</Button>
            <Button variant="danger" onClick={() => { setCancelModalOpen(false); alert('Subscription cancelled'); }}>
              Yes, Cancel
            </Button>
          </>
        }
      >
        <div style={{ padding: spacing[4] }}>
          <p style={{ color: colors.neutral[700], marginBottom: spacing[3] }}>
            If you cancel, you'll lose access to:
          </p>
          <ul style={{ paddingLeft: '20px', color: colors.neutral[700], lineHeight: 1.8 }}>
            <li>Trading strategy system</li>
            <li>Smart alerts</li>
            <li>100 hours/month</li>
            <li>AI preference learning</li>
          </ul>
          <p style={{ color: colors.neutral[600], marginTop: spacing[4], fontSize: '13px' }}>
            Your subscription will remain active until Dec 1, 2025.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Account;
