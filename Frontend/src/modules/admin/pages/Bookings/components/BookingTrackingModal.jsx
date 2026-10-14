import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiX, FiNavigation, FiCheckCircle, FiTruck, FiPackage, 
  FiClock, FiMapPin, FiUser, FiPhone, FiMail, FiDollarSign, 
  FiCamera, FiExternalLink, FiTool, FiCheck, FiAlertTriangle,
  FiShield, FiCalendar
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { adminBookingService } from '../../../../../services/adminBookingService';
import { bookingItems, paymentInfo, rupees, PAYMENT_TONES } from '../bookingDisplay';

const MoneyRow = ({ label, value, strong, tone = 'text-gray-900', hint }) => (
  <div className="flex items-baseline justify-between gap-2 py-1">
    <span className={`text-[11px] ${strong ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
      {label}{hint && <span className="text-gray-400"> · {hint}</span>}
    </span>
    <span className={`text-xs ${strong ? 'font-black' : 'font-semibold'} ${tone}`}>{value}</span>
  </div>
);

const getStatusBadge = (status) => {
  switch (status?.toLowerCase()) {
    case 'completed':
      return { label: 'Completed', bg: 'bg-green-100 text-green-700 border-green-200' };
    case 'work_done':
      return { label: 'Work Done', bg: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    case 'in_progress':
      return { label: 'In Progress', bg: 'bg-purple-100 text-purple-700 border-purple-200' };
    case 'journey_started':
      return { label: 'Journey Started', bg: 'bg-blue-100 text-blue-700 border-blue-200' };
    case 'visited':
      return { label: 'Site Visited', bg: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    case 'assigned':
      return { label: 'Operator Assigned', bg: 'bg-sky-100 text-sky-700 border-sky-200' };
    case 'confirmed':
    case 'accepted':
      return { label: 'Confirmed', bg: 'bg-teal-100 text-teal-700 border-teal-200' };
    case 'cancelled':
      return { label: 'Cancelled', bg: 'bg-red-100 text-red-700 border-red-200' };
    case 'rejected':
      return { label: 'Rejected', bg: 'bg-rose-100 text-rose-700 border-rose-200' };
    default:
      return { label: status || 'Pending', bg: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  }
};

const BookingTrackingModal = ({ isOpen, onClose, booking: initialBooking }) => {
  const navigate = useNavigate();
  const [booking, setBooking] = useState(initialBooking);
  const [loading, setLoading] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState(null);

  useEffect(() => {
    if (isOpen && initialBooking?._id) {
      setBooking(initialBooking);
      const fetchFullDetails = async () => {
        try {
          setLoading(true);
          const res = await adminBookingService.getBookingById(initialBooking._id);
          if (res?.success && res?.data) {
            setBooking(res.data);
          }
        } catch (e) {
          console.error('Error fetching deep booking tracking details:', e);
        } finally {
          setLoading(false);
        }
      };
      fetchFullDetails();
    }
  }, [isOpen, initialBooking?._id]);

  if (!isOpen || !booking) return null;

  const currentStatus = booking.status?.toLowerCase() || 'pending';
  const isCancelled = ['cancelled', 'rejected'].includes(currentStatus);

  const getStepIndex = (status) => {
    switch (status) {
      case 'requested':
      case 'searching': return 0;
      case 'confirmed':
      case 'accepted': return 1;
      case 'assigned': return 2;
      case 'journey_started':
      case 'visited': return 3;
      case 'in_progress': return 4;
      case 'work_done': return 5;
      case 'completed': return 6;
      default: return 1;
    }
  };

  const currentStep = getStepIndex(currentStatus);

  const trackingSteps = [
    {
      title: 'Booking Placed',
      description: 'Farmer initiated the booking request',
      timestamp: booking.createdAt ? new Date(booking.createdAt).toLocaleString() : null,
      icon: FiClock,
    },
    {
      title: 'Booking Confirmed',
      description: 'Accepted by equipment vendor',
      timestamp: booking.acceptedAt ? new Date(booking.acceptedAt).toLocaleString() : null,
      icon: FiCheckCircle,
    },
    {
      title: 'Operator Assigned',
      description: booking.workerId?.name
        ? `Driver: ${booking.workerId.name}`
        : (booking.assignedAt ? `Owner doing it himself: ${booking.vendorId?.name || 'Owner'}` : 'Awaiting driver allocation'),
      timestamp: booking.assignedAt ? new Date(booking.assignedAt).toLocaleString() : null,
      icon: FiUser,
    },
    {
      title: 'Journey & Arrival',
      description: currentStep >= 3 ? 'Operator started journey to site' : 'Pending journey start',
      timestamp: booking.startedAt ? new Date(booking.startedAt).toLocaleString() : null,
      icon: FiTruck,
    },
    {
      title: 'Work / Rental Active',
      description: currentStep >= 4 ? 'Equipment handover completed / Engine running' : 'Awaiting field activation',
      timestamp: null,
      icon: FiTool,
    },
    {
      title: 'Work Done / Return',
      description: currentStep >= 5 ? 'Work completed & equipment return recorded' : 'Work in progress',
      timestamp: null,
      icon: FiPackage,
    },
    {
      title: 'Completed & Settled',
      description: currentStep >= 6 ? (booking.finalSettlementStatus === 'DONE' ? 'Settlement Done & Closed' : 'Booking Completed') : 'Pending completion',
      timestamp: booking.completedAt ? new Date(booking.completedAt).toLocaleString() : null,
      icon: FiCheck,
    },
  ];

  const statusBadge = getStatusBadge(booking.status);
  const payment = paymentInfo(booking);

  const { main: equipmentTitle, sub: equipmentSub } = bookingItems(booking);
  const farmerName = booking.userId?.name || 'Farmer';
  const farmerPhone = booking.userId?.phone || booking.customerPhone || 'N/A';
  const farmerAddress = booking.address?.addressLine1 || booking.location?.address || 'Location provided on map';

  // Owner's own name; the business/farm name is secondary
  const vendorName = booking.vendorId?.name || booking.vendorId?.businessName || 'Not assigned';
  const vendorBusiness = booking.vendorId?.name && booking.vendorId?.businessName;
  const vendorPhone = booking.vendorId?.phone || 'N/A';

  // workerId empty + assignedAt set = the owner took the job himself
  const isSelfJob = !booking.workerId && !!booking.assignedAt;
  const workerName = booking.workerId?.name || (isSelfJob ? vendorName : 'Not assigned');
  const workerPhone = booking.workerId?.phone || (isSelfJob ? vendorPhone : 'N/A');

  // Money split comes from the vendor bill (source of truth); absent until the bill is generated
  const bill = booking.vendorBillId && typeof booking.vendorBillId === 'object' ? booking.vendorBillId : null;
  const totalAmount = bill?.grandTotal ?? booking.finalAmount ?? 0;
  const gst = bill?.totalGST || 0;
  const extraCharges = (bill?.visitingCharges || 0) + (bill?.transportCharges || 0);
  const commission = bill ? Math.max(0, bill.companyRevenue - gst) : 0;
  const vendorPct = bill?.payoutConfig?.serviceSplitPercentage;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-100">
        
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-gray-100 bg-gradient-to-r from-blue-50/70 via-white to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200">
              <FiNavigation className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-gray-900 tracking-tight">
                  Track Booking #{booking.bookingNumber || booking._id?.slice(-6).toUpperCase()}
                </h2>
                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusBadge.bg}`}>
                  {statusBadge.label}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">
                Real-time booking progress and trip verification
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-3">

          {/* Quick Summary Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {/* Equipment Card */}
            <div className="bg-gray-50/80 rounded-xl px-3 py-2 border border-gray-200/60 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Equipment</span>
                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded capitalize">
                  {booking.rental_type || 'Hourly'}
                </span>
              </div>
              <p className="font-black text-gray-900 text-xs truncate mt-0.5" title={equipmentTitle}>{equipmentTitle}</p>
              <p className="text-[10px] text-gray-500 truncate">{equipmentSub || `${rupees(totalAmount)} Total`}</p>
            </div>

            {/* Farmer Card */}
            <div className="bg-gray-50/80 rounded-xl px-3 py-2 border border-gray-200/60 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Farmer</span>
              <p className="font-black text-gray-900 text-xs truncate mt-0.5">{farmerName}</p>
              <p className="text-[10px] text-gray-600 flex items-center gap-1">
                <FiPhone className="w-2.5 h-2.5 text-gray-400" /> {farmerPhone}
              </p>
            </div>

            {/* Owner/Vendor Card */}
            <div className="bg-gray-50/80 rounded-xl px-3 py-2 border border-gray-200/60 min-w-0">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Equipment Owner</span>
              <p className="font-black text-gray-900 text-xs truncate mt-0.5" title={vendorBusiness ? `${vendorName} (${vendorBusiness})` : vendorName}>
                {vendorName}
              </p>
              <p className="text-[10px] text-gray-600 flex items-center gap-1 truncate">
                <FiPhone className="w-2.5 h-2.5 text-gray-400 shrink-0" /> {vendorPhone}
                {vendorBusiness && <span className="text-gray-400 truncate">· {vendorBusiness}</span>}
              </p>
            </div>

            {/* Operator Card */}
            <div className="bg-gray-50/80 rounded-xl px-3 py-2 border border-gray-200/60 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Assigned Operator</span>
                {(isSelfJob || booking.workerId) && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isSelfJob ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
                    {isSelfJob ? 'Self' : 'Driver'}
                  </span>
                )}
              </div>
              <p className="font-black text-gray-900 text-xs truncate mt-0.5">{workerName}</p>
              <p className="text-[10px] text-gray-600 flex items-center gap-1">
                <FiPhone className="w-2.5 h-2.5 text-gray-400" /> {workerPhone}
              </p>
            </div>
          </div>

          {/* Cancellation Alert if cancelled */}
          {isCancelled && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <FiAlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-red-800 uppercase tracking-wide">Booking {currentStatus}</p>
                <p className="text-xs text-red-600 mt-0.5">
                  {booking.cancellationReason || 'This booking was cancelled and is no longer active.'}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Timeline Tracking */}
          <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200/80 p-3 shadow-sm">
            <h3 className="text-[11px] font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2">
              <FiNavigation className="text-blue-600 w-3.5 h-3.5" />
              Timeline & Journey Progress
            </h3>

            <div className="relative pl-7 space-y-2.5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
              {trackingSteps.map((step, idx) => {
                const isStepCompleted = !isCancelled && idx <= currentStep;
                const isCurrentStep = !isCancelled && idx === currentStep;
                const StepIcon = step.icon;

                return (
                  <div key={idx} className="relative">
                    {/* Circle Node */}
                    <div 
                      className={`absolute -left-7 top-0 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                        isStepCompleted
                          ? 'bg-green-600 border-green-600 text-white shadow-sm shadow-green-200'
                          : isCurrentStep
                          ? 'bg-blue-600 border-blue-600 text-white animate-pulse shadow-md shadow-blue-300'
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {isStepCompleted ? (
                        <FiCheck className="w-3 h-3 stroke-[3]" />
                      ) : (
                        <StepIcon className="w-3 h-3" />
                      )}
                    </div>

                    {/* Step Content */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className={`text-xs font-bold leading-tight ${isStepCompleted ? 'text-gray-900' : isCurrentStep ? 'text-blue-600' : 'text-gray-400'}`}>
                          {step.title}
                        </h4>
                        <p className="text-[10px] text-gray-500 truncate">
                          {step.description}
                        </p>
                      </div>

                      {step.timestamp && (
                        <span className="text-[9px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded shrink-0 border border-gray-200/60">
                          {step.timestamp}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column: payment summary + address */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-200/60">
              <div className="flex items-center justify-between mb-1.5">
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                  <FiDollarSign className="text-gray-400" /> Payment Status
                </h4>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${payment.paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {payment.paid ? 'Paid' : 'Pending'}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${PAYMENT_TONES[payment.tone]}`}>{payment.label}</span>
                <span className="text-[10px] text-gray-500">{payment.detail}</span>
              </div>

              {/* Summary */}
              <div className="border-t border-gray-200 pt-1.5">
                <MoneyRow label="Booking amount" value={rupees(totalAmount)} strong hint="paid by farmer" />
                {bill ? (
                  <>
                    <MoneyRow label="Service charge" value={rupees(bill.totalServiceBase)} />
                    {bill.totalPartsBase > 0 && <MoneyRow label="Parts" value={rupees(bill.totalPartsBase)} />}
                    {extraCharges > 0 && <MoneyRow label="Visiting / transport" value={rupees(extraCharges)} />}
                    {gst > 0 && <MoneyRow label="GST" value={rupees(gst)} />}
                    <div className="border-t border-dashed border-gray-200 my-1" />
                    <MoneyRow label="Vendor received" value={rupees(bill.vendorTotalEarning)} strong tone="text-green-700" hint={vendorPct ? `${vendorPct}% of service` : null} />
                    <MoneyRow label="Admin commission" value={rupees(commission)} strong tone="text-blue-700" hint={vendorPct ? `${100 - vendorPct}% of service` : null} />
                    {gst > 0 && <MoneyRow label="GST collected by admin" value={rupees(gst)} />}
                    <MoneyRow label="Admin total" value={rupees(bill.companyRevenue)} strong />
                  </>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-1">Vendor/admin split will show once the vendor generates the bill.</p>
                )}
              </div>
            </div>

            <div className="bg-gray-50/80 rounded-xl p-3 border border-gray-200/60">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
                <FiMapPin className="text-gray-400" /> Farm / Delivery Address
              </h4>
              <p className="text-[11px] text-gray-800 font-semibold leading-snug">{farmerAddress}</p>
            </div>
          </div>
          </div>

          {/* Trip & Workspace Verification Photos: 2 at handover + 2 at return */}
          {(() => {
            const verificationPhotos = [
              { src: booking.start_kilometer_photo, title: '🚜 Condition Photo', note: 'Equipment condition at handover / start meter' },
              { src: booking.handover_proof_photo, title: '🤝 Handover Proof', note: 'Proof of equipment handed to farmer' },
              { src: booking.end_kilometer_photo, title: '🏁 After-work Condition', note: 'Equipment condition after work / end meter' },
              { src: booking.work_evidence_photo || booking.workPhotos?.[0], title: '🌾 Return / Work Proof', note: 'Equipment returned & work evidence' }
            ];
            if (!verificationPhotos.some(p => p.src)) return null;

            return (
            <div className="bg-white rounded-xl border border-gray-200/80 p-3 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                  <FiCamera className="text-blue-600 w-4 h-4" />
                  Trip & Workspace Verification Photos
                </h3>
                <span className="text-[10px] font-bold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                  {verificationPhotos.filter(p => p.src).length} / {verificationPhotos.length} Uploaded
                </span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {verificationPhotos.map(({ src, title, note }) => (
                  <div key={title} className="bg-gray-50 rounded-xl p-2.5 border border-gray-200/80 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[11px] font-bold text-gray-800 truncate">{title}</span>
                        {src ? (
                          <span className="text-[9px] font-bold text-green-600 flex items-center gap-0.5 shrink-0">
                            <FiCheckCircle /> Uploaded
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5 shrink-0">
                            <FiAlertTriangle /> Pending
                          </span>
                        )}
                      </div>
                      {src ? (
                        <img
                          src={src}
                          alt={title}
                          onClick={() => setZoomPhoto(src)}
                          className="w-full h-24 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-gray-200 shadow-sm"
                        />
                      ) : (
                        <div className="h-24 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 text-[10px]">
                          <FiCamera className="w-5 h-5 mb-1 text-gray-300" />
                          Not uploaded
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1.5 font-medium leading-tight">{note}</p>
                  </div>
                ))}
              </div>

              {/* Additional Photos if more than 1 in workPhotos */}
              {booking.workPhotos && booking.workPhotos.length > 1 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-[11px] font-bold text-gray-600 mb-2">Additional Field Photos ({booking.workPhotos.length - 1}):</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {booking.workPhotos.slice(1).map((photo, pIdx) => (
                      <img 
                        key={pIdx} 
                        src={photo} 
                        alt={`Additional proof ${pIdx + 1}`} 
                        onClick={() => setZoomPhoto(photo)}
                        className="w-20 h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 border border-gray-200 flex-shrink-0 shadow-sm"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })()}

        </div>

        {/* Footer Actions */}
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500 font-medium hidden sm:block">
            Booking ID: <span className="font-mono font-bold text-gray-800">{booking.bookingNumber || booking._id}</span>
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-white transition-all shadow-sm"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                navigate(`/admin/bookings/${booking._id}`);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-200 transition-all flex items-center gap-1.5"
            >
              <FiExternalLink className="w-3.5 h-3.5" />
              View Full Booking Page
            </button>
          </div>
        </div>

      </div>

      {/* Image Zoom Modal */}
      {zoomPhoto && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/80 flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={zoomPhoto} alt="Full Size" className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" />
            <button
              onClick={() => setZoomPhoto(null)}
              className="absolute -top-3 -right-3 p-2 bg-white text-gray-800 rounded-full shadow-lg hover:bg-gray-100"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingTrackingModal;
