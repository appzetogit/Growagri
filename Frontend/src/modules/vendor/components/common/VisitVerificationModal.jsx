import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { FiX, FiCheckCircle } from 'react-icons/fi';
import { verifySelfVisit } from '../../services/bookingService';
import flutterBridge from '../../../../utils/flutterBridge';
import LocationAccessModal from '../../../../components/common/LocationAccessModal';

/**
 * Reusable Visit Verification Modal
 * Simple arrival confirmation (captures location) by vendors/workers
 * 
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Callback to close modal
 * @param {string} bookingId - The booking ID to verify
 * @param {function} onSuccess - Callback on successful verification
 */
const VisitVerificationModal = ({ isOpen, onClose, bookingId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [userType, setUserType] = useState('vendor');

  // Detect user type
  React.useEffect(() => {
    const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
    const workerData = JSON.parse(localStorage.getItem('workerData') || '{}');
    if (workerData._id || workerData.id) setUserType('worker');
    else if (vendorData._id || vendorData.id) setUserType('vendor');
  }, []);

  /**
   * Use robust Native Bridge with Browser Fallback
   */
  const getPosition = async () => {
    try {
      const location = await flutterBridge.getCurrentLocation();
      return location;
    } catch (error) {
      console.error("[VisitVerification] Location fetching failed:", error);
      throw error;
    }
  };

  const handleVerify = async () => {
    setLoading(true);

    if (!navigator.geolocation) {
      toast.error('Geolocation is required for verification');
      setLoading(false);
      return;
    }

    try {
      const locationData = await getPosition();
      const location = {
        lat: locationData.latitude,
        lng: locationData.longitude
      };

      const response = await verifySelfVisit(bookingId, location);

      if (response.success) {
        toast.success('Marked as reached!');
        onClose();
        onSuccess?.();
      } else {
        toast.error(response.message || 'Verification failed');
      }
    } catch (error) {
      console.error("Verification Error:", error);

      // Handle geolocation errors
      if (error.code === 1) {
        toast.error('Location permission denied. Requesting access...');
        setShowLocationModal(true);
      } else if (error.code === 2) {
        toast.error('Location unavailable. Check your GPS settings.');
      } else if (error.code === 3) {
        toast.error('Location timeout. Please try again.');
      } else {
        // API error or other
        toast.error(error.response?.data?.message || 'Verification failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSuccess = async (coords) => {
    setShowLocationModal(false);
    setLoading(true);
    try {
      const location = { lat: coords.latitude || coords.lat, lng: coords.longitude || coords.lng };
      const response = await verifySelfVisit(bookingId, location);

      if (response.success) {
        toast.success('Marked as reached!');
        onClose();
        onSuccess?.();
      } else {
        toast.error(response.message || 'Verification failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
            className="bg-white w-full max-w-sm rounded-[24px] p-8 shadow-2xl relative z-10"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 leading-tight">
                  Mark Arrival
                </h3>
                <p className="text-xs text-teal-600 font-bold uppercase tracking-wider mt-1">
                  Check-in Verification
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 disabled:opacity-50"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>

            {/* Description */}
            <div className="mb-8">
              <p className="text-gray-500 font-medium leading-relaxed">
                Confirm that you have <span className="text-gray-900 font-bold">reached the customer's location</span>.
              </p>
            </div>

            {/* Verify Button */}
            <button
              onClick={handleVerify}
              disabled={loading}
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-teal-600/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <FiCheckCircle className="w-5 h-5" />
                  <span>Mark Reached</span>
                </>
              )}
            </button>
          </motion.div>

          <LocationAccessModal
            isOpen={showLocationModal}
            onClose={() => setShowLocationModal(false)}
            onSuccess={handleLocationSuccess}
            userType={userType}
          />
        </div>
      )}
    </AnimatePresence>
  );
};

export default VisitVerificationModal;
