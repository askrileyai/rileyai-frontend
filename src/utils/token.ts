// Token Management Utilities
// Handles JWT token storage, validation, and synchronization

export const TOKEN_STORAGE_KEY = 'rileyai_token';
export const TOKEN_EXPIRY_KEY = 'rileyai_token_expiry';

// ===== TOKEN STORAGE =====

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;

  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);

    // Store expiry time (JWT tokens typically expire in 1-24 hours)
    // We'll assume 24 hours unless we parse the token
    const expiryTime = Date.now() + (24 * 60 * 60 * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }
}

export function clearStoredToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

export function isTokenExpired(): boolean {
  if (typeof window === 'undefined') return true;

  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryStr) return true;

  const expiryTime = parseInt(expiryStr, 10);
  return Date.now() >= expiryTime;
}

// ===== TOKEN PARSING =====

interface JWTPayload {
  id: number;
  email: string;
  exp?: number;
  iat?: number;
}

export function parseJWT(token: string): JWTPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Decode the payload (base64)
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('[Token] Failed to parse JWT:', error);
    return null;
  }
}

export function getTokenExpiry(token: string): number | null {
  const payload = parseJWT(token);
  if (!payload || !payload.exp) return null;

  // JWT exp is in seconds, convert to milliseconds
  return payload.exp * 1000;
}

export function isTokenValid(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return false;

  return Date.now() < expiry;
}

// ===== EXTENSION SYNC =====

/**
 * Sync token with Chrome extension
 * @deprecated Use sendTokenToExtension from @/lib/extensionSync instead
 */
export function syncTokenWithExtension(token: string | null): void {
  if (typeof window === 'undefined') return;
  console.log('[Token] syncTokenWithExtension is deprecated, use sendTokenToExtension instead');
}

/**
 * Listen for token updates from Chrome extension
 * @deprecated Use listenForExtensionMessages from @/lib/extensionSync instead
 */
export function listenForExtensionToken(onTokenUpdate: (token: string | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  console.log('[Token] listenForExtensionToken is deprecated, use listenForExtensionMessages instead');
  return () => {};
}

// ===== TOKEN REFRESH =====

/**
 * Check if token needs refresh
 * Returns true if token expires in less than 1 hour
 */
export function shouldRefreshToken(token: string): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return false;

  const oneHour = 60 * 60 * 1000;
  const timeUntilExpiry = expiry - Date.now();

  return timeUntilExpiry < oneHour;
}

/**
 * Auto-refresh token if needed
 * Returns true if refresh was initiated
 */
export async function autoRefreshToken(
  refreshFunction: () => Promise<string>
): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  if (shouldRefreshToken(token)) {
    try {
      const newToken = await refreshFunction();
      setStoredToken(newToken);
      syncTokenWithExtension(newToken);
      return true;
    } catch (error) {
      console.error('[Token] Auto-refresh failed:', error);
      return false;
    }
  }

  return false;
}

// ===== UTILITY FUNCTIONS =====

export function getUserIdFromToken(token: string): number | null {
  const payload = parseJWT(token);
  return payload?.id || null;
}

export function getEmailFromToken(token: string): string | null {
  const payload = parseJWT(token);
  return payload?.email || null;
}
