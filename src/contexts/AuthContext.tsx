'use client';

// Authentication Context Provider
// Manages user authentication state across the application

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api';
import { setStoredToken, clearStoredToken } from '@/utils/token';
import { sendTokenToExtension, sendLogoutToExtension, listenForExtensionMessages, requestTokenFromExtension } from '@/lib/extensionSync';
import type { User, AuthResponse } from '@/types';

// ===== CONTEXT TYPE =====

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

// ===== CREATE CONTEXT =====

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ===== PROVIDER COMPONENT =====

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = user !== null;

  // ===== INITIALIZE AUTH STATE =====

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // First, try to get token from extension
        const extensionToken = await requestTokenFromExtension();
        if (extensionToken) {
          apiClient.setToken(extensionToken);
          setStoredToken(extensionToken);
        }

        // Check if we have a stored token
        const token = apiClient.getToken();
        if (!token) {
          setIsLoading(false);
          return;
        }

        // Validate token with backend
        const validationResult = await apiClient.validateToken();

        if (validationResult.valid && validationResult.user) {
          setUser(validationResult.user);
          // Sync token with extension
          await sendTokenToExtension(token);
        } else {
          // Token is invalid, clear it
          apiClient.setToken(null);
          clearStoredToken();
          await sendLogoutToExtension();
        }
      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        // Clear invalid token
        apiClient.setToken(null);
        clearStoredToken();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // ===== LISTEN FOR EXTENSION TOKEN UPDATES =====

  useEffect(() => {
    const cleanup = listenForExtensionMessages(
      async (token) => {
        if (token) {
          apiClient.setToken(token);
          setStoredToken(token);
          // Refresh user data with new token
          try {
            const updatedUser = await apiClient.getMe();
            setUser(updatedUser);
          } catch (error) {
            console.error('[Auth] Failed to refresh user from extension token:', error);
          }
        } else {
          // Extension sent logout signal
          setUser(null);
          apiClient.setToken(null);
          clearStoredToken();
        }
      },
      () => {
        console.log('[Auth] Extension is ready');
        // Send current token to extension if we have one
        const currentToken = apiClient.getToken();
        if (currentToken) {
          sendTokenToExtension(currentToken);
        }
      }
    );

    return cleanup;
  }, []);

  // ===== LOGIN =====

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response: AuthResponse = await apiClient.login(email, password);

      setUser(response.user);
      setStoredToken(response.token);
      await sendTokenToExtension(response.token);
    } catch (error: any) {
      const errorMessage = error.message || 'Login failed. Please check your credentials.';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ===== REGISTER =====

  const register = useCallback(async (email: string, password: string, name?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response: AuthResponse = await apiClient.register(email, password, name);

      setUser(response.user);
      setStoredToken(response.token);
      await sendTokenToExtension(response.token);
    } catch (error: any) {
      const errorMessage = error.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ===== LOGOUT =====

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
      setUser(null);
      clearStoredToken();
      await sendLogoutToExtension();
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      // Clear local state even if API call fails
      setUser(null);
      clearStoredToken();
      await sendLogoutToExtension();
    }
  }, []);

  // ===== REFRESH USER DATA =====

  const refreshUser = useCallback(async () => {
    try {
      const updatedUser = await apiClient.getMe();
      setUser(updatedUser);
    } catch (error) {
      console.error('[Auth] Failed to refresh user:', error);
      // If refresh fails, user might be logged out
      setUser(null);
      clearStoredToken();
    }
  }, []);

  // ===== CLEAR ERROR =====

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ===== CONTEXT VALUE =====

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshUser,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ===== CUSTOM HOOK =====

export function useAuthContext(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
