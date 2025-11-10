// Extension Synchronization
// Handles bidirectional token sync between website and Chrome extension

import { setStoredToken, clearStoredToken } from '@/utils/token';

// Declare chrome API types for TypeScript
declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage: (
          extensionId: string,
          message: any,
          responseCallback?: (response: any) => void
        ) => void;
        onMessageExternal?: {
          addListener: (callback: (message: any, sender: any, sendResponse: (response?: any) => void) => boolean | void) => void;
          removeListener: (callback: any) => void;
        };
        lastError?: {
          message: string;
        };
        MessageSender: any;
      };
    };
  }
}

declare const chrome: typeof window.chrome;

// Define MessageSender type
interface ChromeMessageSender {
  id?: string;
  url?: string;
  origin?: string;
}

export const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID || '';

// Message types
export enum MessageType {
  // Website → Extension
  TOKEN_UPDATE = 'TOKEN_UPDATE',
  LOGOUT = 'LOGOUT',
  USER_UPDATE = 'USER_UPDATE',

  // Extension → Website
  TOKEN_SYNC = 'TOKEN_SYNC',
  EXTENSION_READY = 'EXTENSION_READY',
}

export interface ExtensionMessage {
  type: MessageType;
  token?: string | null;
  user?: any;
  source?: 'website' | 'extension';
}

// ===== SEND TO EXTENSION =====

/**
 * Send token update to Chrome extension
 */
export function sendTokenToExtension(token: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.chrome?.runtime) {
      console.log('[Extension Sync] Chrome extension API not available');
      resolve();
      return;
    }

    if (!EXTENSION_ID) {
      console.log('[Extension Sync] Extension ID not configured');
      resolve();
      return;
    }

    const message: ExtensionMessage = {
      type: MessageType.TOKEN_UPDATE,
      token,
      source: 'website',
    };

    try {
      if (!chrome?.runtime?.sendMessage) {
        resolve();
        return;
      }

      chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
        if (chrome?.runtime?.lastError) {
          console.log('[Extension Sync] Extension not installed or not responding:', chrome.runtime.lastError.message);
          resolve(); // Don't reject - extension might not be installed
        } else {
          console.log('[Extension Sync] Token sent to extension:', response);
          resolve();
        }
      });
    } catch (error) {
      console.error('[Extension Sync] Error sending to extension:', error);
      resolve(); // Don't reject - fail silently
    }
  });
}

/**
 * Send logout signal to Chrome extension
 */
export function sendLogoutToExtension(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.chrome?.runtime) {
      resolve();
      return;
    }

    if (!EXTENSION_ID) {
      resolve();
      return;
    }

    const message: ExtensionMessage = {
      type: MessageType.LOGOUT,
      source: 'website',
    };

    try {
      if (!chrome?.runtime?.sendMessage) {
        resolve();
        return;
      }

      chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
        if (chrome?.runtime?.lastError) {
          console.log('[Extension Sync] Extension not available for logout');
        }
        resolve();
      });
    } catch (error) {
      console.error('[Extension Sync] Error sending logout to extension:', error);
      resolve();
    }
  });
}

// ===== RECEIVE FROM EXTENSION =====

/**
 * Listen for messages from Chrome extension
 */
export function listenForExtensionMessages(
  onTokenReceived: (token: string | null) => void,
  onExtensionReady?: () => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  // Listen for chrome.runtime messages
  const handleChromeMessage = (
    message: ExtensionMessage,
    sender: ChromeMessageSender,
    sendResponse: (response?: any) => void
  ) => {
    console.log('[Extension Sync] Received message from extension:', message);

    // Verify message is from our extension
    if (sender.id !== EXTENSION_ID && EXTENSION_ID) {
      console.warn('[Extension Sync] Message from unknown extension:', sender.id);
      return;
    }

    switch (message.type) {
      case MessageType.TOKEN_SYNC:
        if (message.token) {
          setStoredToken(message.token);
          onTokenReceived(message.token);
          sendResponse({ success: true, message: 'Token synced' });
        } else {
          clearStoredToken();
          onTokenReceived(null);
          sendResponse({ success: true, message: 'Token cleared' });
        }
        break;

      case MessageType.EXTENSION_READY:
        console.log('[Extension Sync] Extension is ready');
        onExtensionReady?.();
        sendResponse({ success: true, message: 'Website ready' });
        break;

      default:
        console.log('[Extension Sync] Unknown message type:', message.type);
        sendResponse({ success: false, message: 'Unknown message type' });
    }

    return true; // Keep message channel open for async response
  };

  // Listen for postMessage events (fallback)
  const handlePostMessage = (event: MessageEvent) => {
    // Verify origin if needed
    // if (event.origin !== 'expected-origin') return;

    const message = event.data as ExtensionMessage;

    if (message.source !== 'extension') {
      return;
    }

    console.log('[Extension Sync] Received postMessage from extension:', message);

    switch (message.type) {
      case MessageType.TOKEN_SYNC:
        if (message.token) {
          setStoredToken(message.token);
          onTokenReceived(message.token);
        } else {
          clearStoredToken();
          onTokenReceived(null);
        }
        break;

      case MessageType.EXTENSION_READY:
        console.log('[Extension Sync] Extension is ready (postMessage)');
        onExtensionReady?.();
        break;
    }
  };

  // Add listeners
  if (chrome?.runtime?.onMessageExternal) {
    chrome.runtime.onMessageExternal.addListener(handleChromeMessage);
  }
  window.addEventListener('message', handlePostMessage);

  // Return cleanup function
  return () => {
    if (chrome?.runtime?.onMessageExternal) {
      chrome.runtime.onMessageExternal.removeListener(handleChromeMessage);
    }
    window.removeEventListener('message', handlePostMessage);
  };
}

// ===== CHECK EXTENSION STATUS =====

/**
 * Check if Chrome extension is installed
 */
export async function isExtensionInstalled(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.chrome?.runtime || !EXTENSION_ID) {
    return false;
  }

  return new Promise((resolve) => {
    try {
      if (!chrome?.runtime?.sendMessage) {
        resolve(false);
        return;
      }

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: 'PING', source: 'website' },
        (response) => {
          if (chrome?.runtime?.lastError) {
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Request token from extension (useful on website load)
 */
export async function requestTokenFromExtension(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.chrome?.runtime || !EXTENSION_ID) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      if (!chrome?.runtime?.sendMessage) {
        resolve(null);
        return;
      }

      chrome.runtime.sendMessage(
        EXTENSION_ID,
        { type: 'GET_TOKEN', source: 'website' },
        (response) => {
          if (chrome?.runtime?.lastError || !response?.token) {
            resolve(null);
          } else {
            resolve(response.token);
          }
        }
      );
    } catch (error) {
      console.error('[Extension Sync] Error requesting token:', error);
      resolve(null);
    }
  });
}

// ===== EXTENSION DETECTION =====

/**
 * Show extension install prompt if not installed
 */
export function showExtensionPrompt(): void {
  if (typeof window === 'undefined') return;

  // Check if we should show the prompt (not shown in last 7 days)
  const lastPrompt = localStorage.getItem('extension_prompt_shown');
  if (lastPrompt) {
    const daysSincePrompt = (Date.now() - parseInt(lastPrompt)) / (1000 * 60 * 60 * 24);
    if (daysSincePrompt < 7) {
      return;
    }
  }

  // Check if extension is installed
  isExtensionInstalled().then((installed) => {
    if (!installed) {
      console.log('[Extension Sync] Extension not installed - consider showing prompt');
      localStorage.setItem('extension_prompt_shown', Date.now().toString());
      // You can show a UI prompt here
    }
  });
}
