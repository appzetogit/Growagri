import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiCheck, FiX, FiChevronRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

// NotificationWindow now controlled by parent (AdminHeader)
const NotificationWindow = ({
  isOpen,
  onClose,
  position = 'right',
  notifications = [],
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete
}) => {
  const navigate = useNavigate();
  const windowRef = useRef(null);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (windowRef.current && !windowRef.current.contains(event.target)) {
        if (!event.target.closest('[data-notification-button]')) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleNotificationClick = (notification) => {
    if (!notification.isRead && onMarkAsRead) {
      onMarkAsRead(notification._id || notification.id);
    }

    const type = (notification.type || '').toLowerCase();
    const relatedType = (notification.relatedType || '').toLowerCase();
    const title = (notification.title || '').toLowerCase();

    // Redirection logic for Admin
    if (relatedType === 'booking' || type.includes('booking')) {
      navigate('/admin/bookings');
    } else if (relatedType === 'soil' || type.includes('soil') || title.includes('soil')) {
      navigate('/admin/soil-tests');
    } else if (relatedType === 'scrap' || type.includes('scrap')) {
      navigate('/admin/scrap');
    } else if (type.includes('payment')) {
      navigate('/admin/payments');
    } else if (type.includes('kyc') || type.includes('verification')) {
      navigate('/admin/vendors/all'); // owner KYC is reviewed on the owners page
    } else if (type.includes('withdraw') || type.includes('settlement')) {
      navigate('/admin/settlements');
    } else if (type.includes('store') || type.includes('shop')) {
      navigate('/admin/marketplace/store-approvals');
    }

    onClose();
  };

  const positionClasses = {
    right: 'right-0',
    left: 'left-0',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-[9999] lg:hidden"
          />

          <motion.div
            ref={windowRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed lg:absolute ${positionClasses[position]} top-[calc(4rem-40px)] lg:top-full lg:-mt-[38px] right-[11px] lg:-right-[5px] z-[10000] w-[calc(100vw-2rem)] sm:w-96 max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 max-h-[calc(100vh-8rem)] flex flex-col overflow-hidden`}
            style={{ willChange: 'transform' }}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-800">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllAsRead}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="text-lg" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-admin">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <FiBell className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="font-semibold">No notifications</p>
                  <p className="text-sm mt-1">You're all caught up.</p>
                </div>
              ) : (
                <div className="p-2">
                  {notifications.map((n) => (
                    <div
                      key={n._id || n.id}
                      className={`p-3 rounded-xl border mb-2 cursor-pointer transition-all hover:shadow-md ${n.isRead ? 'bg-white border-gray-100' : 'bg-primary-50 border-primary-200'
                        }`}
                      onClick={() => handleNotificationClick(n)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Notification Icon */}
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <FiBell className="text-gray-500 w-5 h-5" />
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {(n.title || '').toLowerCase().includes('reject') && <span className="text-sm">🚫</span>}
                            <p className="font-bold text-gray-800 text-sm truncate">{n.title}</p>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1.5 font-medium">{new Date(n.createdAt || Date.now()).toLocaleString()}</p>
                        </div>

                        {/* Actions: Red X and Gray Arrow (Side-by-Side as per screenshot) */}
                        <div className="flex items-center gap-2 flex-shrink-0 ml-1">
                          {/* Delete Button (Red X) */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const id = n._id || n.id;
                              if (onDelete && id) onDelete(id);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <FiX className="w-4 h-4" />
                          </button>

                          {/* Arrow Icon */}
                          <div className="text-gray-300 group-hover:text-gray-500 transition-colors">
                            <FiChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationWindow;


