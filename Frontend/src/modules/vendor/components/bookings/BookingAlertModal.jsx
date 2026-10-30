import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiX, FiMapPin, FiClock, FiDollarSign, FiArrowRight, FiBell, FiAlertCircle, FiMinimize2, FiUsers } from 'react-icons/fi';
import { FaRupeeSign } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { vendorTheme as themeColors } from '../../../../theme';
import { playAlertRing, stopAlertRing } from '../../../../utils/notificationSound';

const BookingAlertCard = ({ booking, onAccept, onReject, onAssign, initialTimeLeft = 60, servicePayoutPct = 70 }) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);
  const [loadingAction, setLoadingAction] = useState(null);

  const handleAction = async (actionFn, actionType) => {
    if (loadingAction) return;
    setLoadingAction(actionType);
    const bookingId = booking?.id || booking?._id;
    localStorage.removeItem(`alert_start_${bookingId}`);
    try {
      if (actionFn) await actionFn(bookingId, actionType);
    } catch (error) {
      console.error(error);
    } finally {
      if (typeof window !== 'undefined') {
        setLoadingAction(null);
      }
    }
  };

  useEffect(() => {
    if (!booking) return;

    const bookingId = booking.id || booking._id;
    const storageKey = `alert_start_${bookingId}`;
    let startTime = parseInt(localStorage.getItem(storageKey));

    if (!startTime) {
      startTime = Date.now();
      localStorage.setItem(storageKey, startTime.toString());
      setTimeLeft(initialTimeLeft);
    } else {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remaining = initialTimeLeft - elapsedSeconds;

      if (remaining <= 0) {
        setTimeLeft(0);
        onReject?.(bookingId);
        localStorage.removeItem(storageKey);
        return;
      }
      setTimeLeft(remaining);
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
        const currentRemaining = initialTimeLeft - currentElapsed;

        if (currentRemaining <= 0) {
          clearInterval(timer);
          onReject?.(bookingId);
          localStorage.removeItem(storageKey);
          return 0;
        }
        return currentRemaining;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [booking, onReject, initialTimeLeft]);

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = (timeLeft / initialTimeLeft) * circumference;
  const dashoffset = circumference - progress;

  const serviceName = booking.serviceName || booking.serviceType || 'Service Request';
  const categoryName = booking.serviceCategory || booking.categoryName || booking.categoryId?.title;
  const showCategory = categoryName && categoryName.toLowerCase() !== serviceName.toLowerCase();

  return (
    <div className="bg-white w-[85vw] max-w-[310px] flex-none rounded-[2rem] overflow-hidden max-h-[88vh] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative flex flex-col scrollbar-hide snap-center">
      {/* Header Section */}
      <div className="relative h-24 bg-gradient-to-br from-teal-600 to-emerald-700 flex flex-col items-center justify-start pt-3 shrink-0 overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute -top-10 -left-10 w-40 h-40 bg-white rounded-full"
          />
          <motion.div
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.2, 0.1] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute -bottom-10 -right-10 w-48 h-48 bg-white rounded-full"
          />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="w-8 h-8 bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 flex items-center justify-center relative">
            <FiBell className="w-4 h-4 text-white animate-bounce" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          </div>
          <h2 className="text-white text-lg font-black tracking-tight">New Order Alert!</h2>
        </div>
        <div className="relative z-10 px-2.5 py-0.5 mt-1.5 bg-white/20 rounded-full text-[8px] font-bold text-white uppercase tracking-widest">
          Action Required Immediately
        </div>
      </div>

      {/* Timer - outside the scroll area so it is not clipped */}
      <div className="relative z-10 flex justify-center -mt-8 shrink-0">
        <div className="relative w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl">
          <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="6" />
            <motion.circle
              cx="40" cy="40" r={radius} fill="none"
              stroke={timeLeft <= 10 ? '#EF4444' : '#059669'} strokeWidth="6"
              strokeDasharray={circumference} strokeDashoffset={dashoffset}
              strokeLinecap="round" className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="text-center">
            <span className={`text-lg font-black block leading-none ${timeLeft <= 10 ? 'text-red-500' : 'text-emerald-600'}`}>{timeLeft}</span>
            <span className="text-[7px] font-bold text-gray-400 uppercase">Sec left</span>
          </div>
          {timeLeft <= 10 && <div className="absolute inset-0 rounded-full border-2 border-red-500/30 animate-ping" />}
        </div>
      </div>

      {/* Body Section - Scrollable */}
      <div className="px-4 pt-3 pb-4 overflow-y-auto flex-1 scrollbar-hide space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-emerald-50/60 py-2 px-1 rounded-xl border border-emerald-100 text-center">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Distance</span>
            <div className="text-base font-black text-emerald-600 flex items-center gap-1 justify-center">
              <FiMapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {(() => {
                  const distVal = booking.location?.distance || booking.distance;
                  if (distVal === undefined || distVal === null) return 'Near You';
                  if (typeof distVal === 'string') {
                    if (distVal.includes('km') || distVal.includes('m') || distVal.toLowerCase().includes('near')) {
                      return distVal;
                    }
                  }
                  const numDist = Number(distVal);
                  if (isNaN(numDist)) return 'Near You';
                  if (numDist < 1) {
                    return `${Math.round(numDist * 1000)} m`;
                  }
                  return `${numDist.toFixed(1)} km`;
                })()}
              </span>
            </div>
          </div>
          <div className="bg-blue-50/60 py-2 px-1 rounded-xl border border-blue-100 text-center">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">You Earn ({servicePayoutPct}%)</span>
            <div className="text-base font-black text-blue-600 flex items-center gap-0.5 justify-center">
              <FaRupeeSign className="w-3 h-3 shrink-0" />
              <span>{Math.round((booking.basePrice || booking.price || booking.totalAmount || booking.finalAmount || 0) * (servicePayoutPct / 100)).toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* Service Details Card */}
        <div className="bg-white rounded-2xl p-3 border border-teal-100 shadow-[0_6px_20px_-6px_rgba(20,184,166,0.2)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-400 to-emerald-500" />

          <div className="pl-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[9px] font-black text-teal-600/80 uppercase tracking-[0.15em]">Service Requested</p>
              <span className="text-[9px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-md shrink-0">
                <FiBell className="w-3 h-3 animate-pulse" /> Urgent
              </span>
            </div>
            <h4 className="text-[15px] font-black text-gray-900 leading-tight">{serviceName}</h4>
            {showCategory && (
              <div className="flex items-center gap-1.5 mt-1">
                {booking.categoryIcon && <img src={booking.categoryIcon} alt="" className="w-4 h-4 object-contain" />}
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider truncate">{categoryName}</span>
              </div>
            )}

            {/* Agriculture/Drone Specific Details */}
            {(booking.landSize || booking.cropType || booking.chemicalUsed || booking.estimatedDuration || booking.rental_type) && (
              <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-teal-50">
                {booking.rental_type === 'hourly' && booking.estimatedDuration ? (
                  <div className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                    <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">Duration:</span>
                    <span className="text-[11px] font-black text-blue-800">{booking.estimatedDuration} Hour(s)</span>
                  </div>
                ) : booking.rental_type === 'minute' && booking.estimatedDuration ? (
                  <div className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                    <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">Duration:</span>
                    <span className="text-[11px] font-black text-blue-800">{booking.estimatedDuration} Min(s)</span>
                  </div>
                ) : booking.landSize ? (
                  <div className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1">
                    <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Area:</span>
                    <span className="text-[11px] font-black text-emerald-800">{booking.landSize} {booking.landUnit || (booking.rental_type === 'bigha' ? 'Bigha' : 'Acre(s)')}</span>
                  </div>
                ) : null}
                {booking.cropType && (
                  <div className="bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1">
                    <span className="text-[9px] text-amber-600 font-bold uppercase tracking-wider">Crop:</span>
                    <span className="text-[11px] font-black text-amber-800">{booking.cropType}</span>
                  </div>
                )}
                {booking.chemicalUsed && (
                  <div className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                    <span className="text-[9px] text-blue-600 font-bold uppercase tracking-wider">Chem:</span>
                    <span className="text-[11px] font-black text-blue-800">{booking.chemicalUsed}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-3 border border-gray-100 space-y-2">
          <div className="flex items-start gap-2">
            <FiMapPin className="text-gray-400 w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Arrival Location</p>
              <p className="text-[11px] font-bold text-gray-800 line-clamp-2">{booking.location?.address || booking.address?.addressLine1 || 'Address not available'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FiClock className="text-gray-400 w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Scheduled Time</p>
              <p className="text-[11px] font-bold text-gray-800">
                {booking.timeSlot?.date || (booking.scheduledDate ? new Date(booking.scheduledDate).toLocaleDateString() : '')} {booking.timeSlot?.time || booking.scheduledTime || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            disabled={!!loadingAction}
            onClick={() => handleAction(onAccept, 'accept')}
            className="w-full py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-black text-base shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100">
            {loadingAction === 'accept' ? 'Accepting...' : 'Accept (Myself)'} {loadingAction !== 'accept' && <FiArrowRight className="w-4 h-4" />}
          </button>

          <button
            disabled={!!loadingAction}
            onClick={() => handleAction(onReject, 'reject')}
            className="w-full py-2 rounded-xl bg-red-50 border border-red-100 text-red-500 font-bold text-[11px] active:scale-95 transition-all uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:active:scale-100">
            {loadingAction === 'reject' ? 'Declining...' : <><FiX className="w-3.5 h-3.5" /> Decline Order</>}
          </button>
        </div>
      </div>
    </div>
  );
};

const BookingAlertModal = ({ isOpen, booking, bookings, onAccept, onReject, onAssign, onMinimize, timeLeft = 60 }) => {
  const alertsArray = bookings || (booking ? [booking] : []);
  const [servicePayoutPct, setServicePayoutPct] = useState(70);

  useEffect(() => {
    let isMounted = true;
    const fetchPayoutSettings = async () => {
      try {
        const token = localStorage.getItem('vendorAccessToken');
        if (!token) return;
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/vendors/settings`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (isMounted && data.success && data.data?.global) {
          const globalSettings = data.data.global;
          const commission = globalSettings.bookingCommissionPercentage ?? (100 - (globalSettings.servicePayoutPercentage ?? 90));
          setServicePayoutPct(100 - commission);
        }
      } catch (error) {
        console.error('Error fetching global vendor settings in modal:', error);
      }
    };

    if (isOpen) {
      fetchPayoutSettings();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && alertsArray.length > 0) {
      playAlertRing(true);
    } else {
      stopAlertRing();
    }
    return () => stopAlertRing();
  }, [isOpen, alertsArray.length]);

  if (!isOpen || alertsArray.length === 0) return null;

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
        {onMinimize && (
          <button onClick={() => { stopAlertRing(); onMinimize(); }} className="absolute top-4 right-4 z-50 p-2 bg-black/20 hover:bg-black/30 backdrop-blur-md rounded-full text-white transition-all active:scale-95" title="Minimize Alert">
            <FiMinimize2 className="w-5 h-5" />
          </button>
        )}

        <div className="w-full overflow-x-auto snap-x snap-mandatory scrollbar-hide flex gap-4 px-4 items-center h-full">
          <div className="flex gap-4 m-auto">
            {alertsArray.filter(b => b).map(b => (
              <BookingAlertCard
                key={b?.id || b?._id || Math.random().toString()}
                booking={b}
                onAccept={onAccept}
                onReject={onReject}
                onAssign={onAssign}
                initialTimeLeft={timeLeft}
                servicePayoutPct={servicePayoutPct}
              />
            ))}
          </div>
        </div>

        {alertsArray.length > 1 && (
          <div className="absolute bottom-10 left-0 right-0 flex justify-center text-white text-sm font-medium animate-pulse drop-shadow-lg">
            Swipe to see all {alertsArray.length} alerts →
          </div>
        )}
      </div>
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default BookingAlertModal;
