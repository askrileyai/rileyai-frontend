// Plan Configuration and Feature Gating
// Defines plan tiers, features, and access control logic

import type { PlanTier } from '@/types';

// ===== PLAN DEFINITIONS =====

export const PLAN_TIERS = {
  FREE: 'FREE',
  BASIC: 'BASIC',
  PRO: 'PRO',
  UNLIMITED: 'UNLIMITED',
  ELITE: 'ELITE', // Backend uses ELITE for UNLIMITED
} as const;

export interface PlanDetails {
  tier: PlanTier;
  displayName: string;
  price: number;
  monthlyHours: number;
  stripeMonthlyPriceId: string;
  stripeYearlyPriceId: string;
  yearlyPrice: number;
  features: string[];
  description: string;
  popular?: boolean;
}

export const PLAN_CONFIG: Record<string, PlanDetails> = {
  FREE: {
    tier: 'FREE',
    displayName: 'Free',
    price: 0,
    monthlyHours: 3,
    stripeMonthlyPriceId: '',
    stripeYearlyPriceId: '',
    yearlyPrice: 0,
    description: 'Perfect for trying out RileyAI',
    features: [
      '3 hours of AI analysis per month',
      'Basic chart analysis',
      'Community support',
      'Real-time market data',
      'Email notifications',
    ],
  },
  BASIC: {
    tier: 'BASIC',
    displayName: 'Basic',
    price: 39,
    monthlyHours: 30,
    stripeMonthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_MONTHLY || '',
    stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_YEARLY || '',
    yearlyPrice: 390, // ~17% discount
    description: 'For casual traders',
    features: [
      '30 hours of AI analysis per month',
      'Advanced chart analysis',
      'Real-time market data',
      'Email support',
      'Custom watchlists',
      'Basic strategy backtesting',
    ],
  },
  PRO: {
    tier: 'PRO',
    displayName: 'Pro',
    price: 89,
    monthlyHours: 100,
    stripeMonthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY || '',
    stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_YEARLY || '',
    yearlyPrice: 890, // ~17% discount
    description: 'For serious traders',
    popular: true,
    features: [
      '100 hours of AI analysis per month',
      'Real-time data + alerts',
      'Advanced strategy backtesting',
      'Portfolio tracking & analysis',
      'Priority support',
      'Plaid investment integration',
      'Custom trading strategies',
      'Performance analytics',
    ],
  },
  UNLIMITED: {
    tier: 'UNLIMITED',
    displayName: 'Unlimited',
    price: 199,
    monthlyHours: 999,
    stripeMonthlyPriceId: process.env.NEXT_PUBLIC_STRIPE_UNLIMITED_MONTHLY || '',
    stripeYearlyPriceId: process.env.NEXT_PUBLIC_STRIPE_UNLIMITED_YEARLY || '',
    yearlyPrice: 1990, // ~17% discount
    description: 'For professional traders',
    features: [
      'Unlimited AI analysis',
      'Everything in Pro',
      'API access',
      'White-glove support',
      'Advanced backtesting',
      'Multi-account management',
      'Custom indicators',
      'Priority feature requests',
    ],
  },
};

// ===== FEATURE DEFINITIONS =====

export enum Feature {
  // Analysis features
  BASIC_ANALYSIS = 'BASIC_ANALYSIS',
  ADVANCED_ANALYSIS = 'ADVANCED_ANALYSIS',
  UNLIMITED_ANALYSIS = 'UNLIMITED_ANALYSIS',

  // Data features
  REAL_TIME_DATA = 'REAL_TIME_DATA',
  HISTORICAL_DATA = 'HISTORICAL_DATA',
  MARKET_ALERTS = 'MARKET_ALERTS',

  // Strategy features
  BASIC_BACKTESTING = 'BASIC_BACKTESTING',
  ADVANCED_BACKTESTING = 'ADVANCED_BACKTESTING',
  CUSTOM_STRATEGIES = 'CUSTOM_STRATEGIES',
  STRATEGY_SIGNALS = 'STRATEGY_SIGNALS',

  // Portfolio features
  PORTFOLIO_TRACKING = 'PORTFOLIO_TRACKING',
  PLAID_INTEGRATION = 'PLAID_INTEGRATION',
  MULTI_ACCOUNT = 'MULTI_ACCOUNT',

  // Support features
  EMAIL_SUPPORT = 'EMAIL_SUPPORT',
  PRIORITY_SUPPORT = 'PRIORITY_SUPPORT',
  WHITEGLOVE_SUPPORT = 'WHITEGLOVE_SUPPORT',

  // Advanced features
  API_ACCESS = 'API_ACCESS',
  CUSTOM_INDICATORS = 'CUSTOM_INDICATORS',
}

// Map features to minimum required plan tier
export const FEATURE_REQUIREMENTS: Record<Feature, PlanTier> = {
  [Feature.BASIC_ANALYSIS]: 'FREE',
  [Feature.ADVANCED_ANALYSIS]: 'BASIC',
  [Feature.UNLIMITED_ANALYSIS]: 'UNLIMITED',

  [Feature.REAL_TIME_DATA]: 'FREE',
  [Feature.HISTORICAL_DATA]: 'BASIC',
  [Feature.MARKET_ALERTS]: 'PRO',

  [Feature.BASIC_BACKTESTING]: 'BASIC',
  [Feature.ADVANCED_BACKTESTING]: 'PRO',
  [Feature.CUSTOM_STRATEGIES]: 'PRO',
  [Feature.STRATEGY_SIGNALS]: 'PRO',

  [Feature.PORTFOLIO_TRACKING]: 'PRO',
  [Feature.PLAID_INTEGRATION]: 'PRO',
  [Feature.MULTI_ACCOUNT]: 'UNLIMITED',

  [Feature.EMAIL_SUPPORT]: 'BASIC',
  [Feature.PRIORITY_SUPPORT]: 'PRO',
  [Feature.WHITEGLOVE_SUPPORT]: 'UNLIMITED',

  [Feature.API_ACCESS]: 'UNLIMITED',
  [Feature.CUSTOM_INDICATORS]: 'UNLIMITED',
};

// ===== PLAN HIERARCHY =====

const PLAN_HIERARCHY: PlanTier[] = ['FREE', 'BASIC', 'PRO', 'UNLIMITED', 'ELITE'];

function getPlanLevel(tier: PlanTier): number {
  // ELITE is treated as UNLIMITED
  const normalizedTier = tier === 'ELITE' ? 'UNLIMITED' : tier;
  return PLAN_HIERARCHY.indexOf(normalizedTier);
}

// ===== ACCESS CONTROL FUNCTIONS =====

/**
 * Check if a user's plan has access to a specific feature
 */
export function hasFeatureAccess(userPlan: PlanTier, feature: Feature): boolean {
  const requiredPlan = FEATURE_REQUIREMENTS[feature];
  const userLevel = getPlanLevel(userPlan);
  const requiredLevel = getPlanLevel(requiredPlan);

  return userLevel >= requiredLevel;
}

/**
 * Check if user can upgrade to a specific plan
 */
export function canUpgradeTo(currentPlan: PlanTier, targetPlan: PlanTier): boolean {
  const currentLevel = getPlanLevel(currentPlan);
  const targetLevel = getPlanLevel(targetPlan);

  return targetLevel > currentLevel;
}

/**
 * Get the next available upgrade plan
 */
export function getNextUpgradePlan(currentPlan: PlanTier): PlanTier | null {
  const currentLevel = getPlanLevel(currentPlan);
  const nextLevel = currentLevel + 1;

  if (nextLevel >= PLAN_HIERARCHY.length) {
    return null; // Already at highest plan
  }

  return PLAN_HIERARCHY[nextLevel];
}

/**
 * Get plan details for a specific tier
 */
export function getPlanDetails(tier: PlanTier): PlanDetails {
  // Normalize ELITE to UNLIMITED for display
  const displayTier = tier === 'ELITE' ? 'UNLIMITED' : tier;
  return PLAN_CONFIG[displayTier];
}

/**
 * Get all available plans
 */
export function getAllPlans(): PlanDetails[] {
  return Object.values(PLAN_CONFIG);
}

/**
 * Get upgrade plans available to user
 */
export function getUpgradePlans(currentPlan: PlanTier): PlanDetails[] {
  return getAllPlans().filter((plan) => canUpgradeTo(currentPlan, plan.tier));
}

/**
 * Format hours for display
 */
export function formatHours(hours: number): string {
  if (hours >= 999) return 'Unlimited';
  return `${hours} hours`;
}

/**
 * Calculate usage percentage
 */
export function calculateUsagePercentage(used: number, limit: number): number {
  if (limit >= 999) return 0; // Unlimited
  return Math.min(Math.round((used / limit) * 100), 100);
}

/**
 * Get usage status color
 */
export function getUsageColor(percentage: number): string {
  if (percentage >= 90) return '#d32f2f'; // Red
  if (percentage >= 70) return '#ff9800'; // Orange
  return '#4caf50'; // Green
}

/**
 * Check if user should see upgrade prompt
 */
export function shouldShowUpgradePrompt(
  userPlan: PlanTier,
  hoursUsed: number,
  hoursLimit: number
): boolean {
  // Don't show for unlimited users
  if (userPlan === 'UNLIMITED' || userPlan === 'ELITE') return false;

  // Show if usage is above 80%
  const percentage = calculateUsagePercentage(hoursUsed, hoursLimit);
  return percentage >= 80;
}

/**
 * Get upgrade message based on usage
 */
export function getUpgradeMessage(
  userPlan: PlanTier,
  hoursUsed: number,
  hoursLimit: number
): string | null {
  if (!shouldShowUpgradePrompt(userPlan, hoursUsed, hoursLimit)) {
    return null;
  }

  const nextPlan = getNextUpgradePlan(userPlan);
  if (!nextPlan) return null;

  const nextPlanDetails = getPlanDetails(nextPlan);
  const percentage = calculateUsagePercentage(hoursUsed, hoursLimit);

  if (percentage >= 95) {
    return `You've used ${percentage}% of your monthly hours. Upgrade to ${nextPlanDetails.displayName} for ${formatHours(nextPlanDetails.monthlyHours)}.`;
  }

  return `You're at ${percentage}% usage. Consider upgrading to ${nextPlanDetails.displayName} for more hours.`;
}
