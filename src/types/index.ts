// RileyAI TypeScript Types

export type PlanTier = 'FREE' | 'BASIC' | 'PRO' | 'UNLIMITED' | 'ELITE';

export type PlanStatus = 'active' | 'pending_payment' | 'incomplete' | 'canceled';

export interface User {
  id: number;
  email: string;
  name?: string | null;
  plan: PlanTier;
  planTier: PlanTier;
  planStatus?: PlanStatus;
  monthlyHoursUsed: number;
  monthlyHoursLimit: number;
  isActive: boolean;
  isAdmin?: boolean;
  emailVerified?: boolean;
  createdAt?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TradingSession {
  id: number;
  userId: number;
  symbol: string;
  timeframe?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  startedAt: string;
  endedAt?: string | null;
  totalHours: number;
  lastActivityAt?: string;
}

export interface UsageStats {
  hoursUsed: number;
  hoursLimit: number;
  percentageUsed: number;
  sessionsCount: number;
  lastSession?: TradingSession;
}

export interface Investment {
  id: string;
  accountId: string;
  name: string;
  ticker?: string;
  quantity: number;
  currentPrice: number;
  currentValue: number;
  costBasis?: number;
  gainLoss?: number;
  gainLossPercent?: number;
}

export interface Portfolio {
  totalValue: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  accounts: InvestmentAccount[];
  holdings: Investment[];
}

export interface InvestmentAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  holdings: Investment[];
}

export interface Strategy {
  id: number;
  name: string;
  description: string;
  type: 'MEAN_REVERSION' | 'EMA_CROSSOVER' | 'SUPPLY_DEMAND' | 'CUSTOM';
  isActive: boolean;
  winRate?: number;
  profitFactor?: number;
  totalTrades?: number;
}

export interface StrategySignal {
  id: number;
  strategyId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  confidence: number;
  timestamp: string;
  status: 'ACTIVE' | 'FILLED' | 'EXPIRED';
}

export interface ApiError {
  error: string;
  message: string;
  statusCode?: number;
}

export interface PlanFeature {
  name: string;
  description: string;
  available: boolean;
  requiredPlan?: PlanTier;
}

export interface PlanDetails {
  tier: PlanTier;
  name: string;
  price: number;
  monthlyHours: number;
  features: PlanFeature[];
  stripePriceId?: string;
}
