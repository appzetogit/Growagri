import React, { useEffect } from 'react'; // Updated index to .jsx
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import AppRoutes from './routes';
import { SocketProvider } from './context/SocketContext';
import { CartProvider } from './context/CartContext';
import { CityProvider } from './context/CityContext';
import { EcommerceCartProvider } from './context/EcommerceCartContext';
import { initializePushNotifications, setupForegroundNotificationHandler } from './services/pushNotificationService';
import AutoTranslator from './components/common/AutoTranslator';
// Global common imports removed here as they are now handled in AppRoutes.jsx for conditional rendering
// import { LocationPermissionChecker, Chatbot } from './components/common';

function App() {
  // Initialize push notifications on app load
  // NOTE: initializePushNotifications() safely returns early on iOS
  useEffect(() => {
    initializePushNotifications();

    // Only setup foreground handler if messaging is available (not iOS)
    // On iOS, messaging is null because FCM is not supported
    try {
      setupForegroundNotificationHandler((payload) => {
        console.log('🔔 [App.jsx] Foreground notification received in callback:', payload);
        const title = payload.notification?.title || payload.data?.title || 'New Notification';
        const body = payload.notification?.body || payload.data?.body || '';

        console.log(`🔔 [App.jsx] Attempting to display in-app toast for: "${title}"`);
        toast((t) => (
          <div className="flex flex-col">
            <span className="font-semibold text-green-600">{title}</span>
            <span className="text-xs text-gray-500 mt-1">{body}</span>
          </div>
        ), {
          icon: '🔔',
          duration: 4000
        });

        // Show native browser notification in foreground if permission is granted
        if ('Notification' in window && Notification.permission === 'granted') {
          console.log('🔔 [App.jsx] Displaying native browser notification...');
          try {
            new Notification(title, {
              body: body,
              icon: payload.notification?.icon || payload.data?.icon || '/grooAgri-logo.png'
            });
          } catch (e) {
            console.error('🔔 [App.jsx] Error showing native notification in foreground:', e);
          }
        } else {
          console.log('🔔 [App.jsx] Native browser notifications skipped. Permission status:', 'Notification' in window ? Notification.permission : 'Not supported');
        }

        // Dispatch update events for listening components to refresh UI
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
        window.dispatchEvent(new Event('workerJobsUpdated'));
        window.dispatchEvent(new Event('userBookingsUpdated'));
        window.dispatchEvent(new Event('appNotificationReceived'));
      });
    } catch (error) {
      // Silently ignore — expected on iOS where messaging is null
    }
  }, []);

  return (
    <BrowserRouter>
      <SocketProvider>
        <CityProvider>
          <CartProvider>
            <EcommerceCartProvider>
              <div className="App">
                <AutoTranslator />
                <AppRoutes />
                {/* Global components moved to routes/index.jsx */}
                <Toaster
                  position="top-center"
                  reverseOrder={false}
                  toastOptions={{
                    duration: 2000, // Global default (reduced from 3000)
                    style: {
                      background: '#333',
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '12px 20px',
                    },
                    success: {
                      duration: 1000, // 1 second as requested
                      style: {
                        background: '#10B981',
                      },
                    },
                    error: {
                      duration: 2000, // Reduced from 4000
                      style: {
                        background: '#EF4444',
                      },
                    },
                  }}
                />
              </div>
            </EcommerceCartProvider>
          </CartProvider>
        </CityProvider>
      </SocketProvider>
    </BrowserRouter>
  );
}

export default App;
