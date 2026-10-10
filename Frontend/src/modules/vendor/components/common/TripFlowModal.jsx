import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FiCamera, FiX, FiCheck, FiUpload, FiLoader, FiRefreshCw, FiImage, FiKey, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { uploadToCloudinary } from '../../../../utils/cloudinaryUpload';
import { flutterBridge } from '../../../../utils/flutterBridge';

/**
 * TripFlowModal - Unified single-screen modal for Start Trip / Handover / End Trip / Collect Equipment
 * Displays both photo capture inputs (Condition/KM & Evidence) + Farmer OTP on ONE screen.
 */
const TripFlowModal = ({
    isOpen,
    onClose,
    mode = 'start',
    onSubmit,
    rentalType,
    isMachinery = false,
    requiresDriver = true,
    trackingType = 'odometer',
    booking
}) => {
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoFile, setPhotoFile] = useState(null);
    const [evidencePreview, setEvidencePreview] = useState(null);
    const [evidenceFile, setEvidenceFile] = useState(null);
    const [otp, setOtp] = useState(['', '', '', '']);
    const [workUnits, setWorkUnits] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const kmInputRef = useRef(null);
    const evidenceInputRef = useRef(null);
    const otpRefs = [useRef(), useRef(), useRef(), useRef()];

    const isStart = mode === 'start';
    const skipOtpStep = isStart ? !booking?.driver_start_otp : !booking?.driver_end_otp;
    const isMeterBased = trackingType === 'odometer';

    const title = isStart
        ? (requiresDriver ? '🚜 Start Trip' : '📦 Handover Equipment')
        : (requiresDriver ? '🏁 End Trip' : '✅ Collect Equipment');

    const photo1Label = isStart
        ? (isMeterBased ? 'Starting Meter KM' : 'Condition Photo')
        : (isMeterBased ? 'Ending Meter KM' : 'Condition Photo');

    const photo2Label = isStart
        ? 'Handover Proof'
        : 'Work / Return Proof';

    const themeColor = isStart ? '#16a34a' : '#dc2626';

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setPhotoPreview(null);
            setPhotoFile(null);
            setEvidencePreview(null);
            setEvidenceFile(null);
            setOtp(['', '', '', '']);
            setSubmitting(false);

            if (!isStart && rentalType === 'land_based' && booking?.landSize) {
                const numericPart = parseFloat(String(booking.landSize));
                setWorkUnits(!isNaN(numericPart) ? String(numericPart) : '');
            } else {
                setWorkUnits('');
            }
        }
    }, [isOpen, mode]);

    // Camera handler
    const handleOpenCamera = async (target = 'km') => {
        if (flutterBridge.isFlutter) {
            try {
                const file = await flutterBridge.openCamera();
                if (!file) return;
                const reader = new FileReader();
                if (target === 'km') {
                    setPhotoFile(file);
                    reader.onloadend = () => setPhotoPreview(reader.result);
                } else {
                    setEvidenceFile(file);
                    reader.onloadend = () => setEvidencePreview(reader.result);
                }
                reader.readAsDataURL(file);
                flutterBridge.hapticFeedback('success');
            } catch (err) {
                console.error('[TripFlowModal] Native camera failed:', err);
                toast.error('Camera could not be opened, please retry');
            }
        } else {
            if (target === 'km') {
                kmInputRef.current?.click();
            } else {
                evidenceInputRef.current?.click();
            }
        }
    };

    const handlePhotoCapture = (e, target = 'km') => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        if (target === 'km') {
            setPhotoFile(file);
            reader.onloadend = () => setPhotoPreview(reader.result);
        } else {
            setEvidenceFile(file);
            reader.onloadend = () => setEvidencePreview(reader.result);
        }
        reader.readAsDataURL(file);
    };

    const handleOtpChange = (idx, val) => {
        if (!/^\d*$/.test(val)) return;

        // Handle pasting of full 4-digit OTP
        if (val.length > 1) {
            const digits = val.slice(0, 4).split('');
            const newOtp = [...otp];
            digits.forEach((d, i) => {
                if (i < 4) newOtp[i] = d;
            });
            setOtp(newOtp);
            const focusIdx = Math.min(digits.length, 3);
            otpRefs[focusIdx].current?.focus();
            return;
        }

        const newOtp = [...otp];
        newOtp[idx] = val;
        setOtp(newOtp);

        if (val && idx < 3) {
            otpRefs[idx + 1].current?.focus();
        }
    };

    const handleOtpKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
            otpRefs[idx - 1].current?.focus();
        }
    };

    const handleSubmit = async () => {
        const otpStr = otp.join('');
        if (!skipOtpStep && otpStr.length !== 4) {
            return toast.error('Please enter the 4-digit OTP from farmer');
        }

        if (!isStart && rentalType === 'land_based' && !workUnits) {
            return toast.error('Please enter total area covered');
        }

        try {
            setSubmitting(true);

            let photoUrl = '';
            let evidenceUrl = '';

            const uploadPromises = [];

            if (photoFile instanceof File) {
                uploadPromises.push(
                    uploadToCloudinary(photoFile, 'trips')
                        .then(url => { photoUrl = url; })
                );
            } else if (typeof photoFile === 'string') {
                photoUrl = photoFile;
            }

            if (evidenceFile instanceof File) {
                uploadPromises.push(
                    uploadToCloudinary(evidenceFile, 'evidence')
                        .then(url => { evidenceUrl = url; })
                );
            } else if (typeof evidenceFile === 'string') {
                evidenceUrl = evidenceFile;
            }

            if (uploadPromises.length > 0) {
                toast.loading('Uploading photos...', { id: 'upload-trip-photos' });
                await Promise.all(uploadPromises);
                toast.dismiss('upload-trip-photos');
            }

            await onSubmit(
                photoUrl || photoFile,
                otpStr,
                workUnits ? parseFloat(workUnits) : undefined,
                evidenceUrl || evidenceFile
            );

            onClose();
        } catch (err) {
            console.error('[TripFlowModal] Submit error:', err);
            toast.dismiss('upload-trip-photos');
            toast.error(err?.response?.data?.message || err?.message || 'Failed to submit. Try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-3 sm:px-4 py-4 backdrop-blur-sm"
                    onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 15 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 15 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                        className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-gray-100 my-auto"
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-5 pt-4 pb-3 bg-white sticky top-0 z-10"
                            style={{ borderBottom: `3px solid ${themeColor}` }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
                                    style={{ backgroundColor: themeColor }}
                                >
                                    <FiCheckCircle className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-lg font-black text-gray-900 leading-tight">
                                        {title}
                                    </h2>
                                    <p className="text-[11px] font-semibold text-gray-500">
                                        Fill photo details & verify OTP in one step
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                            >
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Content Body */}
                        <div className="overflow-y-auto px-5 py-4 space-y-4">

                            {/* Section 1: Both Photos Side-by-Side */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                                        <FiImage className="w-3.5 h-3.5 text-gray-500" />
                                        Equipment Photos (Optional)
                                    </label>
                                    <span className="text-[10px] text-gray-400 font-bold">2 Photos max</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Photo 1: Condition / KM Photo */}
                                    <div className="space-y-1.5">
                                        <p className="text-[11px] font-bold text-gray-600 truncate">{photo1Label}</p>
                                        {photoPreview ? (
                                            <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-sm bg-gray-50 h-32 group">
                                                <img src={photoPreview} alt="Photo 1" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => { setPhotoPreview(null); setPhotoFile(null); }}
                                                    className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors shadow"
                                                >
                                                    <FiRefreshCw className="w-3 h-3" />
                                                </button>
                                                <span className="absolute bottom-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                                                    <FiCheck className="w-2.5 h-2.5" /> Added
                                                </span>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenCamera('km')}
                                                className="w-full h-32 rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/20 bg-gray-50 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-98 group"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                                    <FiCamera className="w-4 h-4" />
                                                </div>
                                                <span className="text-[11px] font-extrabold text-gray-700">Take Photo</span>
                                                <span className="text-[9px] text-gray-400">Condition / Meter</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Photo 2: Proof / Return Photo */}
                                    <div className="space-y-1.5">
                                        <p className="text-[11px] font-bold text-gray-600 truncate">{photo2Label}</p>
                                        {evidencePreview ? (
                                            <div className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/40 shadow-sm bg-gray-50 h-32 group">
                                                <img src={evidencePreview} alt="Photo 2" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => { setEvidencePreview(null); setEvidenceFile(null); }}
                                                    className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors shadow"
                                                >
                                                    <FiRefreshCw className="w-3 h-3" />
                                                </button>
                                                <span className="absolute bottom-1.5 left-1.5 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                                                    <FiCheck className="w-2.5 h-2.5" /> Added
                                                </span>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenCamera('evidence')}
                                                className="w-full h-32 rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/20 bg-gray-50 flex flex-col items-center justify-center gap-1.5 transition-all active:scale-98 group"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                                    <FiCamera className="w-4 h-4" />
                                                </div>
                                                <span className="text-[11px] font-extrabold text-gray-700">Take Photo</span>
                                                <span className="text-[9px] text-gray-400">Proof / Handover</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Hidden file inputs */}
                            <input
                                ref={kmInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handlePhotoCapture(e, 'km')}
                            />
                            <input
                                ref={evidenceInputRef}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="hidden"
                                onChange={(e) => handlePhotoCapture(e, 'evidence')}
                            />

                            {/* Section 2: Area Covered (for land_based end trip) */}
                            {!isStart && rentalType === 'land_based' && (
                                <div className="space-y-1.5 p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200">
                                    <label className="text-xs font-black text-amber-900 block">
                                        Total Area Covered (Acres)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={workUnits}
                                            onChange={(e) => setWorkUnits(e.target.value)}
                                            placeholder="Enter total area..."
                                            className="w-full py-2.5 px-3.5 bg-white border border-amber-300 rounded-xl focus:outline-none text-base font-extrabold text-amber-900 shadow-sm"
                                        />
                                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-bold text-amber-700 text-xs">
                                            Acres
                                        </span>
                                    </div>
                                    {booking?.landSize && (
                                        <p className="text-[10px] text-amber-700 font-medium">
                                            📋 Booked Area: {booking.landSize}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Section 3: Farmer's OTP */}
                            <div className="p-4 bg-gray-50/90 rounded-2xl border border-gray-200/80 space-y-2.5">
                                {skipOtpStep ? (
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 py-1">
                                        <span className="text-base">ℹ️</span>
                                        <span>No OTP verification required. Verify details and submit.</span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="text-center space-y-0.5">
                                            <p className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center justify-center gap-1.5">
                                                <FiKey className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                                Enter Customer OTP
                                            </p>
                                            <p className="text-[11px] text-gray-500 font-medium">
                                                Ask the farmer for their 4-digit {isStart ? 'Start / Handover' : 'Return / End'} OTP
                                            </p>
                                        </div>

                                        <div className="flex justify-center gap-2.5 pt-1">
                                            {otp.map((digit, idx) => (
                                                <input
                                                    key={idx}
                                                    ref={otpRefs[idx]}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={4}
                                                    value={digit}
                                                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                                                    onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                                    className="w-12 h-12 sm:w-14 sm:h-14 text-center text-xl sm:text-2xl font-black border-2 rounded-xl focus:outline-none transition-all shadow-sm bg-white"
                                                    style={{
                                                        borderColor: digit ? themeColor : '#e5e7eb',
                                                        color: digit ? themeColor : '#111827'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                        </div>

                        {/* Footer Action Button */}
                        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50">
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={submitting || (!skipOtpStep && otp.join('').length < 4)}
                                className="w-full py-3.5 sm:py-4 rounded-2xl font-black text-white text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ background: themeColor }}
                            >
                                {submitting ? (
                                    <>
                                        <FiLoader className="w-4 h-4 animate-spin" />
                                        <span>Confirming...</span>
                                    </>
                                ) : (
                                    <>
                                        <FiCheck className="w-5 h-5" />
                                        <span>
                                            {isStart
                                                ? (requiresDriver ? 'Confirm & Start Engine' : 'Confirm & Handover Equipment')
                                                : (requiresDriver ? 'Confirm & End Trip' : 'Confirm & Collect Equipment')
                                            }
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};

export default TripFlowModal;
