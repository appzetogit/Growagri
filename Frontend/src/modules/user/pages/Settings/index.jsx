import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiBell, FiMail, FiPhone, FiMessageCircle, FiShield, FiChevronRight, FiLogOut, FiTrash2, FiGlobe } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../../theme';
import { userAuthService } from '../../../../services/authService';
import { registerFCMToken, removeFCMToken } from '../../../../services/pushNotificationService';
import { useLanguage } from '../../../../context/LanguageContext';
import BottomNav from '../../components/layout/BottomNav';

const Settings = () => {
  const navigate = useNavigate();
  const { language, languages, t } = useLanguage();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // State for notification toggles
  const [notifications, setNotifications] = useState({
    push: true,
    email: true,
  });

  // Load user settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await userAuthService.getProfile();
      if (response.success && response.user?.settings) {
        setNotifications(prev => ({
          ...prev,
          push: response.user.settings.notifications ?? true
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleToggle = async (key) => {
    // Optimistic update
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));

    // Handle Push Toggle specifically
    if (key === 'push') {
      const newState = !notifications.push;
      const toastId = toast.loading(newState ? 'Enabling notifications...' : 'Disabling notifications...');

      try {
        if (newState) {
          // Enable
          const { isFlutterWebView } = await import('../../../../services/pushNotificationService');
          const token = await registerFCMToken('user', true);
          if (!token) {
            if (isFlutterWebView()) {
              toast.error('Failed to enable. Please check mobile app notification permissions in your phone settings.', { id: toastId, duration: 5000 });
            } else {
              toast.error('Failed to enable. Check browser permissions.', { id: toastId });
            }
            // Revert state
            setNotifications(prev => ({ ...prev, push: false }));
            return;
          }
        } else {
          // Disable
          await removeFCMToken('user');
        }

        // Persist preference to backend
        await userAuthService.updateProfile({
          settings: { notifications: newState }
        });

        toast.success(newState ? 'Notifications enabled' : 'Notifications disabled', { id: toastId });

      } catch (error) {
        console.error('Error updating notification settings:', error);
        toast.error('Failed to update settings', { id: toastId });
        // Revert
        setNotifications(prev => ({ ...prev, push: !newState }));
      }
    }
  };

  const handlePrivacyClick = () => {
    navigate('/user/privacy');
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-black" />
            </button>
            <h1 className="text-xl font-bold text-black">{t('Settings')}</h1>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Language Selection Section */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-black mb-3">{t('Language')}</h2>
          <button
            onClick={() => navigate('/user/language')}
            className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:bg-gray-50 active:scale-[0.98] transition-all shadow-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-50 text-emerald-700">
                <FiGlobe className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold text-black block">
                  {languages[language]?.nativeLabel || language}
                </span>
                <span className="text-xs text-gray-500">
                  {languages[language]?.label || 'Change language'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                {languages[language]?.nativeLabel || language}
              </span>
              <FiChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>
        </div>

        {/* Order Related Messages Section */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-black mb-2">{t('Order related messages')}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t("Order related messages can't be turned off as they are important for service experience.")}
          </p>
        </div>

        {/* Notifications & Reminders Section */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-black mb-4">{t('Notifications & reminders')}</h2>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Push Notifications */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 166, 166, 0.1)' }}>
                  <FiBell className="w-5 h-5" style={{ color: themeColors.button }} />
                </div>
                <span className="text-sm font-medium text-black">{t('Push Notifications')}</span>
              </div>
              <button
                onClick={() => handleToggle('push')}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${notifications.push ? 'bg-green-700' : 'bg-gray-300'
                  }`}
                style={notifications.push ? { backgroundColor: '#15803d' } : {}}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${notifications.push ? 'translate-x-6' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 166, 166, 0.1)' }}>
                  <FiMail className="w-5 h-5" style={{ color: themeColors.button }} />
                </div>
                <span className="text-sm font-medium text-black">{t('Email')}</span>
              </div>
              <button
                onClick={() => handleToggle('email')}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${notifications.email ? 'bg-green-700' : 'bg-gray-300'
                  }`}
                style={notifications.email ? { backgroundColor: '#15803d' } : {}}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-200 ${notifications.email ? 'translate-x-6' : 'translate-x-0'
                    }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Account Actions Section */}
        <div className="mb-6">
          <h2 className="text-base font-bold text-black mb-4">{t('Account')}</h2>
          <div className="space-y-3">
            <button
              onClick={async () => {
                const confirmed = window.confirm('Are you sure you want to log out?');
                if (confirmed) {
                  await userAuthService.logout();
                  navigate('/user/login');
                  toast.success('Logged out successfully');
                }
              }}
              className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-50">
                <FiLogOut className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-sm font-medium text-red-600">{t('Log Out')}</span>
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full bg-white rounded-xl border border-red-200 p-4 flex items-center gap-3 hover:bg-red-50 active:scale-[0.98] transition-all"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-50">
                <FiTrash2 className="w-5 h-5 text-red-500" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-red-600 block">{t('Delete Account')}</span>
                <span className="text-xs text-red-400">Permanently remove your account & data</span>
              </div>
            </button>

          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                <FiTrash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">Delete Account?</h3>
              <p className="text-sm text-gray-500 text-center mb-6">
                Yeh action permanent hai. Aapka account aur saara data delete ho jayega.
                Is number se dobara login karne ke liye aapko <strong>nayi registration</strong> karni padegi.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const response = await userAuthService.deleteAccount();
                      if (response.success) {
                        toast.success('Account deleted successfully.');
                        navigate('/user/login', { replace: true });
                      } else {
                        toast.error(response.message || 'Failed to delete account.');
                        setIsDeleting(false);
                        setShowDeleteConfirm(false);
                      }
                    } catch (error) {
                      toast.error('Failed to delete account. Please try again.');
                      setIsDeleting(false);
                      setShowDeleteConfirm(false);
                    }
                  }}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm hover:bg-red-600 transition-all disabled:opacity-60"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy & Data Section */}
        <div className="space-y-4 mb-6">
          <button
            onClick={handlePrivacyClick}
            className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 166, 166, 0.1)' }}>
                <FiShield className="w-5 h-5" style={{ color: themeColors.button }} />
              </div>
              <span className="text-sm font-medium text-black">{t('Privacy & data')}</span>
            </div>
            <FiChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* Diagnostic Test Button */}
          <button
            onClick={async () => {
              try {
                const { registerFCMToken, isFlutterWebView } = await import('../../../../services/pushNotificationService');
                const toastId = toast.loading('Attempting to register for notifications...');
                const inWebView = isFlutterWebView();

                // 1. Register Token (Optional inside WebView)
                let token = null;
                try {
                  token = await registerFCMToken('user', true);
                } catch (e) {
                  console.warn('FCM registration skipped or failed:', e);
                }

                if (!token && !inWebView) {
                  toast.error('Could not register. Check browser permissions.', { id: toastId });
                  return;
                }

                // 2. Send Test Notification from Backend
                toast.loading('Sending test notification...', { id: toastId });

                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/users/fcm-tokens/test`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                  }
                });

                const data = await response.json();

                if (data.success) {
                  toast.success(`Sent! Success: ${data.successCount}`, { id: toastId });
                } else {
                  toast.error(`Failed to send: ${data.message || 'Unknown error'}`, { id: toastId });
                }

              } catch (err) {
                toast.error('Test failed. See console.', { id: toastId });
                console.error(err);
              }
            }}
            className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:bg-gray-50 active:scale-[0.98] transition-all"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 166, 166, 0.1)' }}>
              <FiBell className="w-5 h-5" style={{ color: themeColors.button }} />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium text-black block">Test Push Notifications</span>
              <span className="text-xs text-gray-500">Tap to register & simulate alert</span>
            </div>
          </button>
        </div>
      </main>

      {/* BottomNav hidden on this page */}
    </div>
  );
};

export default Settings;
