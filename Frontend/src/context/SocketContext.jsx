/* eslint-disable react-hooks/set-state-in-effect */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { motion, useMotionValue, useTransform } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { toast } from 'react-hot-toast';
import { playNotificationSound, isSoundEnabled, playAlertRing } from '../utils/notificationSound';
import { registerFCMToken } from '../services/pushNotificationService';

const SwipeableNotification = ({ t, data, onClick }) => {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-200, 0, 200], [0, 1, 0]);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      style={{ x, opacity }}
      onDragEnd={(e, { offset }) => {
        if (Math.abs(offset.x) > 80) { // Threshold
          toast.dismiss(t.id);
        }
      }}
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{
        opacity: t.visible ? 1 : 0,
        y: t.visible ? 0 : -20,
        scale: t.visible ? 1 : 0.95
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      whileTap={{ scale: 0.98 }}
      className="max-w-md w-full bg-white/95 backdrop-blur-sm shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-gray-900/5 cursor-pointer dark:bg-gray-800 dark:ring-gray-700"
      onClick={onClick}
    >
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <span className="text-lg">🔔</span>
            </div>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {data.title}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {data.message}
            </p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-gray-200 dark:border-gray-700">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toast.dismiss(t.id);
          }}
          className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-gray-400 hover:text-gray-500 focus:outline-none"
        >
          ✕
        </button>
      </div>
    </motion.div>
  );
};

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [reminderAlert, setReminderAlert] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Determine user type based on path
  const getUserType = (path) => {
    if (path.startsWith('/vendor')) return 'vendor';
    if (path.startsWith('/worker')) return 'worker';
    if (path.startsWith('/admin')) return 'admin';
    return 'user';
  };

  const userType = getUserType(location.pathname);

  // Compute token to reactively trigger socket connection/disconnection on auth state change
  const token = (() => {
    if (!userType) return null;
    let tokenKey = 'accessToken';
    switch (userType) {
      case 'vendor':
        tokenKey = 'vendorAccessToken';
        break;
      case 'worker':
        tokenKey = 'workerAccessToken';
        break;
      case 'admin':
        tokenKey = 'adminAccessToken';
        break;
      case 'user':
      default:
        tokenKey = 'accessToken';
        break;
    }
    return localStorage.getItem(tokenKey);
  })();

  useEffect(() => {
    if (!userType) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // For vendor/worker/admin, token is strictly required. For user, allow guest connection for public events.
    if (!token && userType !== 'user') {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Disconnect previous if any
    if (socket) {
      socket.disconnect();
    }

    // Use HTTP URL for socket.io client - it handles WS upgrade automatically
    const socketBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';

    const newSocket = io(socketBaseUrl, {
      auth: {
        token: token || ''
      },
      transports: ['websocket', 'polling'], // WebSocket first for instant real-time alerts
      path: '/socket.io/',
      secure: true,
      rejectUnauthorized: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
      autoConnect: true
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      // console.log(`✅ ${userType.toUpperCase()} App Socket connected`);

      // Register FCM token for push notifications (on page load/refresh)
      if (userType && token) {
        // console.log(`[SocketContext] Registering FCM token for ${userType}...`);
        registerFCMToken(userType, true).then((fcmToken) => {
          if (fcmToken) {
            // console.log(`[SocketContext] ✅ FCM token registered for ${userType}`);
          } else {
            // console.log(`[SocketContext] ⚠️ FCM token registration returned null for ${userType}`);
          }
        }).catch(() => {});
      }

      // If vendor, join vendor-specific room just in case backend expects it
      if (userType === 'vendor') {
        const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
        const vendorId = vendorData.id || vendorData._id;
        if (vendorId) {
          newSocket.emit('join_vendor_room', vendorId);
        }
      }

      const selectedCityId = localStorage.getItem('selectedCityId');
      if (selectedCityId) {
        newSocket.emit('join_city', selectedCityId);
      }
    });

    // Real-time Catalog & Home Content synchronization
    newSocket.on('home_content_updated', (data) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('home_content_updated', { detail: data }));
      }
    });

    newSocket.on('categories_updated', (data) => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('categories_updated', { detail: data }));
      }
    });

    newSocket.on('disconnect', () => {
      // console.log(`❌ ${userType.toUpperCase()} App Socket disconnected`);
    });

    newSocket.on('connect_error', () => {});

    // Listen for generic notifications
    newSocket.on('notification', (data) => {
      // console.log('🔔 App Notification received:', data);

      if (isSoundEnabled(userType)) {
        playNotificationSound();
      }

      if (data.type === 'booking_approaching' || data.type === 'booking_ending') {
        setReminderAlert({
          title: data.title,
          message: data.message,
          relatedId: data.relatedId,
          type: data.type
        });
      }

      // Show custom toast for all notifications
      toast.custom((t) => (
        <SwipeableNotification
          t={t}
          data={data}
          onClick={() => {
            toast.dismiss(t.id);
            // Optional: navigate based on relatedId
            if (data.relatedId || data.type?.includes('ecommerce') || data.type?.includes('order')) {
              if (userType === 'vendor') {
                if (data.type?.includes('ecommerce') || data.type?.includes('order')) {
                  navigate('/vendor/store/orders');
                } else {
                  navigate(`/vendor/booking/${data.relatedId}`);
                }
              } else if (userType === 'worker') {
                navigate(`/worker/job/${data.relatedId}`);
              } else {
                if (data.type?.includes('ecommerce') || data.type?.includes('order')) {
                  navigate('/user/my-agri-orders');
                } else {
                  navigate(`/user/booking/${data.relatedId}`);
                }
              }
            }
          }}
        />
      ), {
        id: 'socket-notification', // Prevent stacking
        duration: 3500, // Slightly longer to allow interaction/reading since it's dismissible
        position: 'top-right'
      });

      // Dispatch update events to refresh UI components
      if (userType === 'worker') window.dispatchEvent(new Event('workerJobsUpdated'));
      if (userType === 'vendor') {
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorNotificationsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
      }
      if (userType === 'user') {
        window.dispatchEvent(new Event('userBookingsUpdated'));
      }
    });

    // Listen for real-time booking updates
    newSocket.on('booking_updated', () => {
      // console.log('Booking Updated:', data);
      if (userType === 'user') window.dispatchEvent(new Event('userBookingsUpdated'));
      if (userType === 'vendor') window.dispatchEvent(new Event('vendorJobsUpdated'));
      if (userType === 'worker') window.dispatchEvent(new Event('workerJobsUpdated'));
    });

    // Listen for special Vendor Booking Requests
    if (userType === 'vendor') {
      newSocket.on('new_booking_request', (data) => {
        // console.log('🚨 New Booking Request Alert:', data);

        // Play urgent alert ring
        playAlertRing();

        // Save to localStorage for the Alert screen and Dashboard to read
        // Note: Even though we are moving to backend, keeping this for immediate UI responsiveness before potential refresh lag
        const newJob = {
          ...data,
          id: data.bookingId,
          serviceType: data.serviceName,
          location: {
            address: data.address?.addressLine1 || 'Location shared',
            distance: (data.distance !== undefined && data.distance !== null && !isNaN(Number(data.distance)))
              ? (Number(data.distance) < 1
                ? `${Math.round(Number(data.distance) * 1000)} m`
                : `${Number(data.distance).toFixed(1)} km`)
              : (data.distance || 'Near you')
          },
          timeSlot: {
            date: new Date(data.scheduledDate).toLocaleDateString(),
            time: data.scheduledTime
          },
          status: 'requested',
          createdAt: new Date().toISOString()
        };

        const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        if (!pendingJobs.find(job => job.id === newJob.id)) {
          pendingJobs.unshift(newJob);
          localStorage.setItem('vendorPendingJobs', JSON.stringify(pendingJobs));

          // Update stats
          const stats = JSON.parse(localStorage.getItem('vendorStats') || '{}');
          stats.pendingAlerts = (stats.pendingAlerts || 0) + 1;
          localStorage.setItem('vendorStats', JSON.stringify(stats));
        }

        // Notify app components to refresh
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
        window.dispatchEvent(new Event('vendorNotificationsUpdated'));

        // If on Dashboard, show modal there instead of navigating
        const isDashboard = window.location.pathname.replace(/\/$/, '') === '/vendor/dashboard';
        if (isDashboard) {
          const event = new CustomEvent('showDashboardBookingAlert', { detail: newJob });
          window.dispatchEvent(event);
        } else {
          // Navigate to Alert Page (using replace to avoid history loops)
          navigate(`/vendor/booking-alert/${data.bookingId}`, { replace: true });
        }
      });

      // Listen for booking_taken - when another vendor accepts a job
      newSocket.on('booking_taken', (data) => {
        // console.log('⚡ Booking taken by another vendor:', data);
        const takenBookingId = String(data.bookingId);

        // Remove from localStorage
        const pendingJobs = JSON.parse(localStorage.getItem('vendorPendingJobs') || '[]');
        const updatedPending = pendingJobs.filter(job => {
          const jobId = String(job.id || job._id);
          return jobId !== takenBookingId;
        });
        localStorage.setItem('vendorPendingJobs', JSON.stringify(updatedPending));

        // Update stats
        const stats = JSON.parse(localStorage.getItem('vendorStats') || '{}');
        if (stats.pendingAlerts > 0) {
          stats.pendingAlerts = Math.max(0, (stats.pendingAlerts || 0) - 1);
          localStorage.setItem('vendorStats', JSON.stringify(stats));
        }

        // Show toast notification
        toast.error(data.message || 'Job taken by another vendor', { icon: '⚡' });

        // Dispatch specific remove event for instant UI update
        window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: takenBookingId } }));

        // Notify app components to refresh
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        window.dispatchEvent(new Event('vendorStatsUpdated'));
      });
    }

    return () => {
      newSocket.disconnect();
    };
  }, [userType, token]); // Re-run if userType or token changes. Navigate is stable.

  return (
    <SocketContext.Provider value={socket}>
      {children}

      {/* Booking Slot Reminder Alert Modal Pop-up */}
      {reminderAlert && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setReminderAlert(null)}
          />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-gray-100 animate-slide-up">
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                reminderAlert.type === 'booking_ending' 
                  ? 'bg-orange-50 text-orange-600 border border-orange-100' 
                  : 'bg-teal-50 text-teal-600 border border-teal-100'
              }`}>
                {reminderAlert.type === 'booking_ending' ? (
                  <span className="text-3xl">⏳</span>
                ) : (
                  <span className="text-3xl">⏰</span>
                )}
              </div>
              
              <h3 className="text-lg font-black text-gray-900 mb-2 uppercase tracking-tight">
                {reminderAlert.title}
              </h3>
              <p className="text-sm text-gray-500 mb-6 font-medium leading-relaxed">
                {reminderAlert.message}
              </p>
              
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setReminderAlert(null)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    const bookingId = reminderAlert.relatedId;
                    setReminderAlert(null);
                    if (bookingId) {
                      if (userType === 'vendor') {
                        navigate(`/vendor/booking/${bookingId}`);
                      } else if (userType === 'worker') {
                        navigate(`/worker/job/${bookingId}`);
                      } else {
                        navigate(`/user/booking/${bookingId}`);
                      }
                    }
                  }}
                  className={`flex-1 py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all ${
                    reminderAlert.type === 'booking_ending'
                      ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/10'
                      : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/10'
                  }`}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);
