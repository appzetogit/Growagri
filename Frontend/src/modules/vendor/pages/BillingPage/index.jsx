import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheck, FiTool, FiArrowLeft, FiDollarSign, FiClock, FiKey } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import vendorBillService from '../../../../services/vendorBillService';
import vendorWalletService from '../../../../services/vendorWalletService';
import { getBookingById } from '../../services/bookingService';
import OtpVerificationModal from './OtpVerificationModal';

const BillingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);

  // OTP State
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Settings
  const [payoutSettings, setPayoutSettings] = useState({
    serviceGstPct: 0,
    partsGstPct: 0,
    servicePayoutPct: 90,
    partsPayoutPct: 100
  });

  // Fetch Data
  useEffect(() => {
    fetchData();
  }, [id]);

  // Scroll to top on mount
  useLayoutEffect(() => {
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      if (typeof document !== 'undefined' && document.body) {
        document.body.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    };

    scrollToTop();
    const timer = setTimeout(scrollToTop, 50);
    return () => clearTimeout(timer);
  }, [id, loading]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const bookingRes = await getBookingById(id);
      const bData = bookingRes.data || bookingRes;
      setBooking(bData);

      const isRental = !!(bData?.rental_type || bData?.equipmentId || bData?.landSize || (bData?.serviceCategory && (bData.serviceCategory.toLowerCase().includes('machinery') || bData.serviceCategory.toLowerCase().includes('tractor') || bData.serviceCategory.toLowerCase().includes('equipment') || bData.serviceCategory.toLowerCase().includes('agriculture'))));

      // Load settings from backend bill
      const billRes = await vendorBillService.getBill(id);
      if (billRes.success && billRes.bill && billRes.bill.payoutConfig) {
        const pc = billRes.bill.payoutConfig;
        let gst = pc.serviceGstPercentage;
        if ((gst === 0 || gst === undefined) && bData?.tax && bData?.basePrice) {
          gst = Math.round((bData.tax * 100) / bData.basePrice);
        }

        setPayoutSettings({
          serviceGstPct: gst ?? 0,
          partsGstPct: pc.partsGstPercentage ?? 0,
          servicePayoutPct: isRental ? (pc.serviceSplitPercentage ?? 90) : (pc.serviceSplitPercentage ?? 90),
          partsPayoutPct: pc.partsSplitPercentage ?? 10
        });
      } else {
        // Fallback global settings
        try {
          const token = localStorage.getItem('vendorAccessToken');
          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/vendors/settings`, { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (data.success && data.data?.global) {
            const g = data.data.global;
            let gst = isRental ? (g.rentalGstPercentage ?? 0) : (g.serviceGstPercentage ?? 0);
            if ((gst === 0 || gst === undefined) && bData?.tax && bData?.basePrice) {
              gst = Math.round((bData.tax * 100) / bData.basePrice);
            }

            setPayoutSettings({
              serviceGstPct: gst,
              partsGstPct: g.partsGstPercentage ?? 0,
              servicePayoutPct: isRental ? (g.rentalPayoutPercentage ?? 90) : (g.servicePayoutPercentage ?? 90),
              partsPayoutPct: g.partsPayoutPercentage ?? 10
            });
          }
        } catch (e) { console.error('Error fetching global settings:', e); }
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // --- CALCULATIONS ---
  const calculations = useMemo(() => {
    if (!booking) return null;

    const { servicePayoutPct } = payoutSettings;

    // Original booking base (service)
    const isPlanBooking = booking.paymentMethod === 'plan_benefit';
    const originalBase = isPlanBooking ? 0 : (booking.basePrice || 0);
    const visitingCharges = Number(booking.visitingCharges) || 0;

    const finalBillAmount = parseFloat((originalBase + visitingCharges).toFixed(2));

    // Vendor Earnings estimate
    const vendorServiceEarnings = parseFloat(((originalBase * servicePayoutPct) / 100).toFixed(2));
    const totalVendorEarnings = vendorServiceEarnings;

    return {
      originalBase,
      visitingCharges,
      finalBillAmount,
      totalVendorEarnings,
      vendorServiceEarnings,
      servicePayoutPct
    };
  }, [booking, payoutSettings]);

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await vendorBillService.createOrUpdateBill(id, {
        parts: [],
        customItems: [],
        transportCharges: 0
      });

      if (res.success) {
        toast.success('Bill generated successfully!');
        localStorage.removeItem(`billing_step_${id}`);
        localStorage.removeItem(`billing_max_step_${id}`);
        localStorage.removeItem(`billing_data_${id}`);
        navigate(`/vendor/booking/${id}`);
      } else {
        toast.error(res.message || 'Failed to generate bill');
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Submit bill error:', error);
      toast.error('An error occurred');
      setSubmitting(false);
    }
  };

  const handleSendOTP = async () => {
    try {
      setOtpLoading(true);
      
      // Update bill to ensure accurate amounts
      await vendorBillService.createOrUpdateBill(id, {
        parts: [],
        customItems: [],
        transportCharges: 0
      });

      const res = await vendorWalletService.initiateCashCollection(
        id,
        calculations.finalBillAmount,
        []
      );

      if (res.success) {
        setIsOtpSent(true);
        setShowOtpModal(true);
        toast.success('OTP sent to customer!');
      } else {
        toast.error(res.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toast.error('Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOTP = async (code) => {
    try {
      setOtpLoading(true);
      const res = await vendorWalletService.confirmCashCollection(
        id,
        calculations.finalBillAmount,
        code,
        []
      );

      if (res.success) {
        setShowOtpModal(false);
        toast.success('Payment verified successfully!');
        localStorage.removeItem(`billing_step_${id}`);
        localStorage.removeItem(`billing_max_step_${id}`);
        localStorage.removeItem(`billing_data_${id}`);
        navigate(`/vendor/booking/${id}`);
      } else {
        toast.error(res.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error('Verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!booking) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-0 flex flex-col">
      {/* Unified Sticky Header */}
      <div className="sticky top-0 z-50 bg-white">
        {/* Title Bar */}
        <div className="px-4 py-4 shadow-sm border-b border-slate-200 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-600 hover:bg-gray-100 rounded-full">
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Generate Bill</h1>
            <p className="text-xs text-slate-500">Booking #{booking.bookingNumber}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-48">
        {calculations && (
          <div className="animate-in fade-in slide-in-from-right-4 pb-10">
            <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-200 mb-6">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-6 text-white text-center">
                <p className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-1">TOTAL INVOICE AMOUNT</p>
                <h2 className="text-4xl font-black">₹{calculations.finalBillAmount.toFixed(2)}</h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs"><FiTool /></span>
                    Services
                  </h4>
                  <div className="space-y-2 text-sm pl-2">
                    <div className="flex justify-between text-slate-600">
                      <span>Original Booking : {booking.serviceName || 'Service'}</span>
                      {booking.paymentMethod === 'plan_benefit' ? (
                        <span className="text-green-600 font-bold">FREE (PLAN)</span>
                      ) : (
                        <span>₹{calculations.originalBase.toFixed(2)}</span>
                      )}
                    </div>

                    <div className="flex justify-between font-bold text-slate-800 border-t border-dashed border-slate-200 pt-2 mt-1">
                      <span>Total Service</span>
                      <span>₹{calculations.originalBase.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {booking.visitingCharges > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-900 flex items-center gap-2 mb-2 pb-2 border-b border-slate-200">
                      <span className="w-6 h-6 rounded-full bg-slate-50 text-slate-600 flex items-center justify-center text-xs"><FiClock /></span>
                      Visiting Charges
                    </h4>
                    <div className="flex justify-between text-sm pl-2 font-bold text-slate-800">
                      <span>Visiting Price</span>
                      <span>₹{Number(booking.visitingCharges).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Earnings Footer */}
              {booking.status === 'completed' ? (
                <div className="bg-emerald-50 px-6 py-4 border-t border-emerald-100">
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between items-center text-emerald-700 text-sm">
                      <span>Service Earnings ({calculations.servicePayoutPct}%)</span>
                      <span className="font-bold">₹{calculations.vendorServiceEarnings.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200/50">
                    <span className="text-emerald-800 font-bold text-xs uppercase tracking-wider">Total Net Earnings</span>
                    <span className="text-emerald-700 font-black text-xl">₹{calculations.totalVendorEarnings.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200/50 text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-2">
                    <FiClock className="w-3 h-3" />
                    Net Earnings will be revealed after completion
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-[72px] left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 flex gap-3">
        {booking.vendorBillId || booking.paymentMethod === 'cash' || booking.paymentMethod === 'pay_at_home' || booking.paymentMethod === 'plan_benefit' ? (
          isOtpSent ? (
            <button
              onClick={() => setShowOtpModal(true)}
              disabled={otpLoading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:scale-100"
            >
              <FiKey className="w-5 h-5" />
              {otpLoading ? 'Verifying...' : 'Enter OTP to Confirm Cash'}
            </button>
          ) : (
            <button
              onClick={handleSendOTP}
              disabled={otpLoading}
              className="w-full py-3.5 bg-blue-600 text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-70 disabled:scale-100"
            >
              {otpLoading ? 'Sending...' : <><FiDollarSign className="w-5 h-5" /> Collect Cash (Send OTP)</>}
            </button>
          )
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-bold rounded-xl shadow-xl flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {submitting ? 'Processing...' : <><FiCheck className="w-5 h-5" />Confirm & Generate Bill</>}
          </button>
        )}
      </div>

      <OtpVerificationModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onVerify={handleVerifyOTP}
        loading={otpLoading}
      />
    </div>
  );
};

export default BillingPage;
