/**
 * Push Notification Service
 * Handles FCM token registration and notification handling
 * 
 * NOTE: FCM Push Notifications are NOT supported on iOS Safari
 * (requires iOS 16.4+ AND app added to Home Screen as PWA).
 * All functions safely return/no-op on iOS to prevent hangs.
 */

import { messaging, getToken, onMessage } from '../firebase';

const VAPID_KEY = "BDhzn_g9ilMnVa2DuhfMoFxqXLZJhGv7NB2tWpQrdzRYlRoiU9ptryralC6IHuZ24AIm5CNP91AxePRf0GZw6Z8";

/**
 * Check if running on iOS (iPhone, iPad, iPod)
 * FCM Service Workers are not properly supported on iOS Safari.
 * @returns {boolean}
 */
function isIOS() {
  return /iP(hone|od|ad)/i.test(navigator.userAgent);
}

/**
 * Check if running inside Flutter WebView
 * @returns {boolean}
 */
function isFlutterWebView() {
  return !!(window.flutter_inappwebview && window.flutter_inappwebview.callHandler);
}

/**
 * Get the current platform type
 * @returns {'web' | 'mobile'}
 */
function getPlatformType() {
  return isFlutterWebView() ? 'mobile' : 'web';
}

/**
 * Register service worker for push notifications
 * Skipped on iOS — FCM service workers hang on iOS Safari.
 * @returns {Promise<ServiceWorkerRegistration>}
 */
async function registerServiceWorker() {
  // Skip on iOS — FCM SW registration hangs or fails on iOS Safari
  if (isIOS()) {
    throw new Error('FCM Service Workers not supported on iOS Safari');
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      // console.log('✅ Service Worker registered:', registration.scope);
      return registration;
    } catch (error) {
      // console.error('❌ Service Worker registration failed:', error);
      throw error;
    }
  } else {
    throw new Error('Service Workers are not supported in this browser');
  }
}

/**
 * Request notification permission from user
 * @returns {Promise<boolean>}
 */
async function requestNotificationPermission() {
  console.log('🔄 Requesting notification permission...');
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    console.log('Permission response:', permission);
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      return true;
    } else {
      console.warn('❌ Notification permission denied. Current status:', permission);
      return false;
    }
  }
  console.error('❌ Notifications not supported in this browser environment');
  return false;
}

/**
 * Safely purge conflicting FCM IndexedDB databases that trigger VersionError:
 * "The requested version (1) is less than the existing version (2)"
 */
async function resetFCMIndexedDB() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) return;

  const targetDatabases = [
    'firebase-messaging-database',
    'fcm_token_details_db',
    'fcm_vapid_details_db',
    'firebase-installations-database'
  ];

  try {
    if (indexedDB.databases) {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name && (db.name.includes('firebase') || db.name.includes('fcm'))) {
          if (!targetDatabases.includes(db.name)) {
            targetDatabases.push(db.name);
          }
        }
      }
    }
  } catch (err) {
    // Silent fail if browser restricts indexedDB.databases()
  }

  for (const dbName of targetDatabases) {
    await new Promise((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

/**
 * Get FCM token from Firebase with automated IndexedDB VersionError recovery
 * @param {number} retryCount
 * @returns {Promise<string|null>}
 */
async function getFCMToken(retryCount = 0) {
  try {
    if (!messaging) {
      console.warn('[FCM] Firebase messaging not initialized');
      return null;
    }

    const registration = await registerServiceWorker();
    if (registration) {
      try {
        await registration.update();
      } catch {
        // Silent on background update
      }
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('✅ FCM Token obtained:', token.substring(0, 20) + '...');
      return token;
    } else {
      console.log('ℹ️ No FCM token available');
      return null;
    }
  } catch (error) {
    const isVersionError =
      error?.name === 'VersionError' ||
      String(error?.message || '').includes('VersionError') ||
      String(error?.message || '').includes('less than the existing version');

    if (isVersionError && retryCount === 0) {
      console.warn('[FCM] 🔄 VersionError detected in browser IndexedDB. Purging conflicting database and auto-retrying...');
      await resetFCMIndexedDB();
      // Retry once with clean IndexedDB
      return await getFCMToken(1);
    }

    console.warn('[FCM] ⚠️ FCM token unavailable:', error?.message || error);
    return null;
  }
}

/**
 * Register FCM token with backend
 * @param {string} userType - 'user', 'vendor', or 'worker'
 * @param {boolean} forceUpdate - Force token update
 * @returns {Promise<string|null>}
 */
async function registerFCMToken(userType = 'user', forceUpdate = false) {
  try {
    console.log(`[FCM] Starting registration for ${userType}, forceUpdate: ${forceUpdate}`);

    const platform = getPlatformType();

    // Check if running in Flutter WebView
    if (isFlutterWebView()) {
      console.log('[FCM] Running inside Flutter WebView. Checking for native FCM token bridge...');
      try {
        const result = await window.flutter_inappwebview.callHandler('getFCMToken');
        if (result && result.success && result.token) {
          console.log('[FCM] ✅ Got native FCM token from Flutter Bridge:', result.token.substring(0, 20) + '...');
          return await saveTokenToBackend(result.token, userType, 'mobile');
        }
      } catch (err) {
        console.warn('[FCM] Native getFCMToken bridge call failed or not implemented:', err);
      }
      
      console.log('[FCM] ℹ️ Skipping Web FCM registration in WebView. Native app will handle notifications.');
      return null;
    }

    // Check if already registered
    const storageKey = `fcm_token_${userType}_web`;
    const savedToken = localStorage.getItem(storageKey);
    if (savedToken && !forceUpdate) {
      console.log('[FCM] Token already registered in localStorage');
      return savedToken;
    }

    // Request permission
    console.log('[FCM] Requesting notification permission...');
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('[FCM] ❌ Notification permission not granted, skipping FCM registration');
      return null;
    }

    // Get token
    console.log('[FCM] Getting FCM token from Firebase...');
    const token = await getFCMToken();
    if (!token) {
      console.log('[FCM] ℹ️ FCM token could not be obtained at this time');
      return null;
    }
    console.log('[FCM] ✅ Got FCM token:', token.substring(0, 30) + '...');

    return await saveTokenToBackend(token, userType, 'web');
  } catch (error) {
    console.warn('[FCM] ⚠️ FCM registration skipped:', error?.message || error);
    return null;
  }
}

/**
 * Helper to save FCM token to the backend
 * @param {string} token 
 * @param {string} userType 
 * @param {'web'|'mobile'} platform 
 */
async function saveTokenToBackend(token, userType, platform) {
  try {
    let endpoint;
    let authTokenKey;
    switch (userType) {
      case 'vendor':
        endpoint = '/vendors/fcm-tokens/save';
        authTokenKey = 'vendorAccessToken';
        break;
      case 'worker':
        endpoint = '/workers/fcm-tokens/save';
        authTokenKey = 'workerAccessToken';
        break;
      case 'user':
        endpoint = '/users/fcm-tokens/save';
        authTokenKey = 'accessToken';
        break;
      default:
        endpoint = '/users/fcm-tokens/save';
        authTokenKey = 'accessToken';
    }

    // Get auth token
    const authToken = localStorage.getItem(authTokenKey);
    if (!authToken) {
      console.log(`[FCM] ❌ No auth token found for ${userType} (${authTokenKey}), skipping registration`);
      return null;
    }

    // Save to backend
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    console.log(`[FCM] Saving token (${platform}) to backend: ${baseUrl}${endpoint}`);

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        token: token,
        platform: platform
      })
    });

    if (response.ok) {
      const storageKey = `fcm_token_${userType}_${platform}`;
      localStorage.setItem(storageKey, token);
      console.log(`[FCM] ✅ FCM token registered with backend successfully for platform: ${platform}`);
      return token;
    } else {
      const error = await response.json();
      console.error('[FCM] ❌ Failed to register token with backend:', error);
      return null;
    }
  } catch (error) {
    console.error('[FCM] ❌ Error in saveTokenToBackend:', error);
    return null;
  }
}

/**
 * Remove FCM token from backend (removes specific token for current device)
 * @param {string} userType - 'user', 'vendor', or 'worker'
 */
async function removeFCMToken(userType = 'user') {
  try {
    // Detect platform automatically
    const platform = getPlatformType();
    const storageKey = `fcm_token_${userType}_${platform}`;
    const tokenToRemove = localStorage.getItem(storageKey);

    if (!tokenToRemove) {
      // console.log('[FCM] No token found in localStorage to remove');
      return;
    }

    // console.log(`[FCM] Removing ${platform} token for ${userType}...`);

    // Determine API endpoint based on user type
    let endpoint;
    let authTokenKey;
    switch (userType) {
      case 'vendor':
        endpoint = '/vendors/fcm-tokens/remove';
        authTokenKey = 'vendorAccessToken';
        break;
      case 'worker':
        endpoint = '/workers/fcm-tokens/remove';
        authTokenKey = 'workerAccessToken';
        break;
      default:
        endpoint = '/users/fcm-tokens/remove';
        authTokenKey = 'accessToken';
    }

    const authToken = localStorage.getItem(authTokenKey);
    // If we have an auth token, try to remove from backend
    if (authToken) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

      // Call remove endpoint with specific token
      await fetch(`${baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          token: tokenToRemove,
          platform: platform
        })
      });
      console.log(`[FCM] ✅ Token removed from backend`);
    }

    // Always remove from local storage
    localStorage.removeItem(storageKey);
    console.log(`[FCM] Token cleared from localStorage`);
  } catch (error) {
    console.error('[FCM] Error removing FCM token:', error);
    // Ensure local cleanup happens even on error
    const platform = getPlatformType();
    const storageKey = `fcm_token_${userType}_${platform}`;
    localStorage.removeItem(storageKey);
  }
}

/**
 * Setup foreground notification handler
 * @param {Function} handler - Custom handler function
 */
function setupForegroundNotificationHandler(handler) {
  if (!messaging) {
    // console.error('Firebase messaging not initialized');
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('📬 [FCM Service] Foreground message received:', payload);

    const data = payload.data || {};
    const notification = payload.notification || {};

    // Use notification fields first, then data fields as fallback (for data-only messages)
    const title = notification.title || data.title || 'New Notification';
    const body = notification.body || data.body || '';
    const icon = notification.icon || data.icon || '/HomeBuddy-header-logo.png';
    const type = data.type || data.notificationType || 'default';

    console.log(`[FCM Service] Parsed Notification -> Title: "${title}", Body: "${body}", Type: "${type}"`);

    // Call custom handler (e.g. for toast)
    if (handler) {
      handler(payload);
    }
  });
}

/**
 * Initialize push notifications
 * Call this on app load
 * Safely skipped on iOS to prevent hanging.
 */
async function initializePushNotifications() {
  try {
    // Skip entirely on iOS — FCM is not supported
    if (isIOS()) {
      // console.log('ℹ️ iOS detected — Push Notifications skipped (not supported without PWA install)');
      return;
    }

    if (!('serviceWorker' in navigator)) {
      // console.log('Service workers not supported');
      return;
    }

    if (!('Notification' in window)) {
      // console.log('Notifications not supported');
      return;
    }

    await registerServiceWorker();
    // console.log('✅ Push notifications initialized');
  } catch (error) {
    // console.error('Error initializing push notifications:', error);
  }
}

export {
  initializePushNotifications,
  registerFCMToken,
  removeFCMToken,
  setupForegroundNotificationHandler,
  requestNotificationPermission,
  getFCMToken,
  isFlutterWebView
};
