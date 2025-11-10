// RileyAI API Client
// Central API communication layer for backend integration

import type {
  User,
  AuthResponse,
  TradingSession,
  UsageStats,
  Portfolio,
  Strategy,
  StrategySignal,
  ApiError
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ===== API ERROR CLASS =====

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// ===== BASE API CLIENT =====

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Initialize token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('rileyai_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('rileyai_token', token);
      } else {
        localStorage.removeItem('rileyai_token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Add authorization token if available
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
          throw new ApiClientError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          );
        }
        return {} as T;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new ApiClientError(
          data.message || data.error || 'Request failed',
          response.status,
          data
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      // Network or parsing errors
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Network request failed'
      );
    }
  }

  // ===== AUTH ENDPOINTS =====

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async validateToken(): Promise<{ valid: boolean; user?: User }> {
    try {
      const response = await this.request<{ valid: boolean; user: User }>('/auth/validate', {
        method: 'GET',
      });
      return response;
    } catch (error) {
      // If validation fails, clear the invalid token
      this.setToken(null);
      return { valid: false };
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me', {
      method: 'GET',
    });
  }

  async updatePlan(planTier: string): Promise<{ success: boolean; plan: string }> {
    return this.request('/auth/plan', {
      method: 'PUT',
      body: JSON.stringify({ planTier }),
    });
  }

  async logout(): Promise<void> {
    this.setToken(null);
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    return this.request('/auth/reset-password/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  // ===== USER ENDPOINTS =====

  async getProfile(): Promise<User> {
    return this.request<User>('/user/profile', {
      method: 'GET',
    });
  }

  async updateProfile(updates: Partial<User>): Promise<User> {
    return this.request<User>('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async getUsageStats(): Promise<UsageStats> {
    return this.request<UsageStats>('/user/usage', {
      method: 'GET',
    });
  }

  // ===== SESSIONS ENDPOINTS =====

  async getSessions(): Promise<TradingSession[]> {
    return this.request<TradingSession[]>('/sessions', {
      method: 'GET',
    });
  }

  async getActiveSession(): Promise<TradingSession | null> {
    return this.request<TradingSession | null>('/sessions/active', {
      method: 'GET',
    });
  }

  async createSession(symbol: string, timeframe?: string): Promise<TradingSession> {
    return this.request<TradingSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ symbol, timeframe }),
    });
  }

  async endSession(sessionId: number): Promise<{ success: boolean }> {
    return this.request(`/sessions/${sessionId}/end`, {
      method: 'PUT',
    });
  }

  async pauseSession(sessionId: number): Promise<{ success: boolean }> {
    return this.request(`/sessions/${sessionId}/pause`, {
      method: 'PUT',
    });
  }

  async resumeSession(sessionId: number): Promise<{ success: boolean }> {
    return this.request(`/sessions/${sessionId}/resume`, {
      method: 'PUT',
    });
  }

  // ===== INVESTMENTS ENDPOINTS =====

  async getPortfolio(): Promise<Portfolio> {
    return this.request<Portfolio>('/investments/portfolio', {
      method: 'GET',
    });
  }

  async createPlaidLinkToken(): Promise<{ link_token: string }> {
    return this.request('/investments/plaid/create-link-token', {
      method: 'POST',
    });
  }

  async exchangePlaidToken(publicToken: string): Promise<{ success: boolean; account_id: string }> {
    return this.request('/investments/plaid/exchange-token', {
      method: 'POST',
      body: JSON.stringify({ public_token: publicToken }),
    });
  }

  async refreshInvestments(): Promise<{ success: boolean; message: string }> {
    return this.request('/investments/refresh', {
      method: 'POST',
    });
  }

  async disconnectAccount(accountId: string): Promise<{ success: boolean }> {
    return this.request(`/investments/accounts/${accountId}`, {
      method: 'DELETE',
    });
  }

  // ===== STRATEGIES ENDPOINTS =====

  async getStrategies(): Promise<Strategy[]> {
    return this.request<Strategy[]>('/strategies', {
      method: 'GET',
    });
  }

  async getStrategy(strategyId: number): Promise<Strategy> {
    return this.request<Strategy>(`/strategies/${strategyId}`, {
      method: 'GET',
    });
  }

  async createStrategy(strategyData: Partial<Strategy>): Promise<Strategy> {
    return this.request<Strategy>('/strategies', {
      method: 'POST',
      body: JSON.stringify(strategyData),
    });
  }

  async updateStrategy(strategyId: number, updates: Partial<Strategy>): Promise<Strategy> {
    return this.request<Strategy>(`/strategies/${strategyId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteStrategy(strategyId: number): Promise<{ success: boolean }> {
    return this.request(`/strategies/${strategyId}`, {
      method: 'DELETE',
    });
  }

  async getStrategySignals(strategyId: number): Promise<StrategySignal[]> {
    return this.request<StrategySignal[]>(`/strategies/${strategyId}/signals`, {
      method: 'GET',
    });
  }

  async getActiveSignals(): Promise<StrategySignal[]> {
    return this.request<StrategySignal[]>('/strategies/signals/active', {
      method: 'GET',
    });
  }

  async backtestStrategy(strategyId: number, params: any): Promise<any> {
    return this.request(`/strategies/${strategyId}/backtest`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // ===== STRIPE ENDPOINTS =====

  async createCheckoutSession(priceId: string): Promise<{ sessionId: string; url: string }> {
    return this.request('/stripe/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    });
  }

  async createPortalSession(): Promise<{ url: string }> {
    return this.request('/stripe/create-portal-session', {
      method: 'POST',
    });
  }

  async getSubscriptionStatus(): Promise<{
    hasSubscription: boolean;
    status?: string;
    planTier?: string;
    currentPeriodEnd?: string;
  }> {
    return this.request('/stripe/subscription-status', {
      method: 'GET',
    });
  }

  // ===== ADMIN ENDPOINTS =====

  async getAllUsers(): Promise<User[]> {
    return this.request<User[]>('/admin/users', {
      method: 'GET',
    });
  }

  async updateUserPlan(userId: number, planTier: string): Promise<{ success: boolean }> {
    return this.request(`/admin/users/${userId}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ planTier }),
    });
  }

  async deleteUser(userId: number): Promise<{ success: boolean }> {
    return this.request(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }
}

// ===== EXPORT SINGLETON =====

const apiClient = new ApiClient(API_BASE_URL);

export default apiClient;
