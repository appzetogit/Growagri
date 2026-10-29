import React, { useState, useEffect, useMemo } from 'react';
import {
    FiChevronLeft,
    FiMapPin,
    FiMaximize,
    FiSend,
    FiActivity,
    FiCheckCircle,
    FiClock,
    FiFileText,
    FiInfo,
    FiDownload,
    FiShield,
    FiTarget,
    FiAlertCircle
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import soilTestService from '../../../../services/soilTestService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import flutterBridge from '../../../../utils/flutterBridge';

const SoilTesting = () => {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    
    // Instant SWR state: Load cached requests & prices for 0ms initial render
    const [requests, setRequests] = useState(() => {
        try {
            const cached = localStorage.getItem('cached_soil_requests');
            return cached ? JSON.parse(cached) : [];
        } catch {
            return [];
        }
    });
    const [prices, setPrices] = useState(() => {
        try {
            const cached = localStorage.getItem('cached_soil_prices');
            return cached ? JSON.parse(cached) : { basicPrice: 0, advancedPrice: 0 };
        } catch {
            return { basicPrice: 0, advancedPrice: 0 };
        }
    });
    const [loading, setLoading] = useState(() => {
        try {
            return !localStorage.getItem('cached_soil_requests');
        } catch {
            return false;
        }
    });
    const [showForm, setShowForm] = useState(false);
    const [editingRequestId, setEditingRequestId] = useState(null);
    const [showPayOptions, setShowPayOptions] = useState(false);
    const [processingPayment, setProcessingPayment] = useState(false);

    const [fetchingLocation, setFetchingLocation] = useState(false);
    const [formData, setFormData] = useState({
        landSize: '',
        location: localStorage.getItem('currentAddress') || '',
        latitude: null,
        longitude: null,
        cropType: '',
        testType: 'Basic',
        phoneNumber: JSON.parse(localStorage.getItem('userData') || '{}').phone || ''
    });

    const inputClass = 'w-full bg-white border border-slate-200 rounded-xl py-3 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-green-100 transition';

    const testOptions = useMemo(() => {
        if (prices.testTypes && prices.testTypes.length > 0) {
            return prices.testTypes.filter(t => t.isActive !== false).map(t => ({
                value: t.title || t.name,
                label: t.title || t.name,
                desc: t.description || '',
                price: Number(t.price) || 0
            }));
        }
        return [
            { value: 'Basic Test (3 Parameters - NPK)', label: 'Basic Test (3 Parameters - NPK)', desc: 'Tests Nitrogen, Phosphorus, and Potassium', price: Number(prices.basicPrice) || 100 },
            { value: 'Advanced Test (12 Parameters - Govt. Standard)', label: 'Advanced Test (12 Parameters - Govt. Standard)', desc: 'Complete analysis including pH, EC, OC, NPK & Micro-nutrients', price: Number(prices.advancedPrice) || 1000 }
        ];
    }, [prices]);

    const fetchPrices = async () => {
        try {
            const res = await soilTestService.getPrices();
            if (res.success && res.data) {
                setPrices(res.data);
                if (res.data.testTypes && res.data.testTypes.length > 0) {
                    const activeTypes = res.data.testTypes.filter(t => t.isActive !== false);
                    const firstOption = activeTypes[0] || res.data.testTypes[0];
                    if (firstOption) {
                        setFormData(prev => {
                            const stillValid = activeTypes.some(t => (t.title || t.name) === prev.testType);
                            return {
                                ...prev,
                                testType: stillValid ? prev.testType : (firstOption.title || firstOption.name)
                            };
                        });
                    }
                }
                try {
                    localStorage.setItem('cached_soil_prices', JSON.stringify(res.data));
                } catch {}
            }
        } catch (err) {
            console.error('Failed to fetch soil test prices:', err);
        }
    };

    useEffect(() => {
        fetchMyRequests(false);
        fetchPrices();

        // Auto-update status and pricing every 15 seconds
        const interval = setInterval(() => {
            fetchMyRequests(true);
            fetchPrices();
        }, 15000);
        return () => clearInterval(interval);
    }, []);

    // Prevent background scrolling when modals are open
    useEffect(() => {
        if (showForm) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showForm]);

    const fetchMyRequests = async (isPolling = false) => {
        try {
            if (!isPolling && requests.length === 0) setLoading(true);
            const res = await soilTestService.getMyRequests();
            if (res.success) {
                setRequests(res.data);
                try {
                    localStorage.setItem('cached_soil_requests', JSON.stringify(res.data));
                } catch {}
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    const handleGetLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser");
            return;
        }
        
        setFetchingLocation(true);
        const toastId = toast.loading("Detecting your field location...");
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData({
                    ...formData,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                });
                toast.success("Location acquired successfully!", { id: toastId });
                setFetchingLocation(false);
            },
            (error) => {
                console.error("Error getting location:", error);
                toast.error("Please allow location access in your browser/device settings.", { id: toastId });
                setFetchingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingRequestId(null);
    };

    const openNewRequest = (presetTestType = null) => {
        fetchPrices();
        setEditingRequestId(null);
        setFormData(prev => ({
            landSize: '',
            location: localStorage.getItem('currentAddress') || '',
            latitude: null,
            longitude: null,
            cropType: '',
            testType: presetTestType || prev.testType || testOptions[0]?.value || 'Basic Test',
            phoneNumber: JSON.parse(localStorage.getItem('userData') || '{}').phone || ''
        }));
        setShowForm(true);
    };

    const selectedOption = useMemo(() => {
        return testOptions.find(o =>
            o.value === formData.testType ||
            o.label === formData.testType ||
            (formData.testType === 'Basic' && o.label?.includes('Basic')) ||
            (formData.testType === 'Advanced' && o.label?.includes('Advanced'))
        ) || testOptions[0];
    }, [testOptions, formData.testType]);

    const selectedPrice = selectedOption ? selectedOption.price : (formData.testType === 'Advanced' ? prices.advancedPrice : prices.basicPrice);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!editingRequestId) {
            if (!(selectedPrice > 0)) return toast.error('Soil testing is not available right now. Please try again later.');
            setShowPayOptions(true);
            return;
        }
        try {
            setSubmitting(true);
            const res = await soilTestService.update(editingRequestId, formData);
            if (res.success) {
                toast.success("Request updated successfully!");
                closeForm();
                fetchMyRequests(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Update failed. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleEditRequest = (req) => {
        setFormData({
            landSize: req.landSize || '',
            location: req.location || '',
            latitude: req.latitude || null,
            longitude: req.longitude || null,
            cropType: req.cropType || '',
            testType: req.testType || 'Basic',
            phoneNumber: req.phoneNumber || ''
        });
        setEditingRequestId(req._id);
        setShowForm(true);
    };

    const onPaidAndSubmitted = () => {
        toast.success('Payment successful! Your soil test request is submitted.');
        setShowPayOptions(false);
        closeForm();
        fetchMyRequests(false);
    };

    // Pay first; the request is submitted only once payment succeeds
    const payAndSubmit = async (paymentMethod) => {
        try {
            setProcessingPayment(true);
            const res = await soilTestService.request({ ...formData, paymentMethod });
            if (!res.success) return;

            if (paymentMethod === 'wallet') return onPaidAndSubmitted();

            const { requestId, orderId, amount, currency, key } = res.data;
            const rzp = new window.Razorpay({
                key,
                amount: amount * 100,
                currency,
                name: 'GrooAgri',
                description: `${formData.testType} Soil Test`,
                order_id: orderId,
                handler: async (response) => {
                    try {
                        const verifyRes = await soilTestService.verifyPayment(requestId, {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature
                        });
                        if (verifyRes.success) onPaidAndSubmitted();
                    } catch (verifyErr) {
                        toast.error(verifyErr.response?.data?.message || 'Payment verification failed');
                    }
                },
                prefill: {
                    name: JSON.parse(localStorage.getItem('userData') || '{}').name || 'Farmer',
                    contact: formData.phoneNumber
                },
                theme: { color: '#2E7D32' }
            });
            rzp.on('payment.failed', (response) => toast.error('Payment failed: ' + response.error.description));
            rzp.open();
        } catch (error) {
            toast.error(error.response?.data?.needsOnlinePayment
                ? 'Not enough wallet balance. Please pay online.'
                : error.response?.data?.message || 'Payment failed. Please try again.');
        } finally {
            setProcessingPayment(false);
        }
    };

    const TRACKING_STEPS = [
        { key: 'pending',          label: 'Submitted' },
        { key: 'assigned',         label: 'Assigned' },
        { key: 'sample_collected', label: 'Sample Collected' },
        { key: 'at_lab',           label: 'At Lab' },
        { key: 'completed',        label: 'Approved' },
    ];

    const stepIndex = (status) => TRACKING_STEPS.findIndex(s => s.key === status);

    const TrackingBar = ({ status }) => {
        const current = stepIndex(status);
        return (
            <div className="flex items-center gap-0.5 mt-4">
                {TRACKING_STEPS.map((step, i) => (
                    <React.Fragment key={step.key}>
                        <div className="flex flex-col items-center">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold transition-all
                                ${i <= current ? 'bg-[#2E7D32] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                {i < current ? '✓' : i + 1}
                            </div>
                            <p className={`text-[9px] mt-1 font-medium text-center leading-tight max-w-[44px]
                                ${i <= current ? 'text-slate-700' : 'text-slate-400'}`}>
                                {step.label}
                            </p>
                        </div>
                        {i < TRACKING_STEPS.length - 1 && (
                            <div className={`flex-1 h-0.5 mb-4 rounded-full transition-all ${
                                i < current ? 'bg-[#2E7D32]' : 'bg-slate-100'}`} />
                        )}
                    </React.Fragment>
                ))}
            </div>
        );
    };

    const StatusBadge = ({ status }) => {
        const styles = {
            pending:          'bg-amber-50 text-amber-600 border-amber-100',
            assigned:         'bg-blue-50 text-blue-600 border-blue-100',
            sample_collected: 'bg-purple-50 text-purple-600 border-purple-100',
            at_lab:           'bg-indigo-50 text-indigo-600 border-indigo-100',
            completed:        'bg-emerald-50 text-emerald-600 border-emerald-100',
            cancelled:        'bg-slate-50 text-slate-400 border-slate-100',
        };
        const labels = {
            pending:          'Pending',
            assigned:         'Assigned',
            sample_collected: 'Sample Collected',
            at_lab:           'At Lab',
            completed:        'Approved',
            cancelled:        'Cancelled',
        };

        return (
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap flex-shrink-0 ${styles[status] || styles.pending}`}>
                {labels[status] || status}
            </span>
        );
    };

    const handleDownload = async (url) => {
        const fileName = `soil_report_${Date.now()}${url.toLowerCase().includes('.pdf') ? '.pdf' : '.jpg'}`;
        try {
            const result = await flutterBridge.downloadFile(url, fileName);
            if (result && result.success) {
                toast.success("Download started...");
            }
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };


    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Navbar */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 flex items-center px-4 py-3 gap-3">
                <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg active:bg-slate-100">
                    <FiChevronLeft className="w-6 h-6 text-slate-700" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold text-slate-900 leading-tight">Soil Testing</h1>
                    <p className="text-xs text-slate-500">Lab-tested soil health reports</p>
                </div>
            </div>

            <div className="p-4 space-y-5">
                {/* Hero Header */}
                <div className="bg-[#2E7D32] rounded-2xl p-5 text-white">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                            <FiActivity className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold">Get your soil tested</h2>
                            <p className="text-white/80 text-sm leading-snug mt-0.5">Know your soil nutrients and use the right fertilizer.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => openNewRequest()}
                        className="w-full bg-white text-[#2E7D32] py-2.5 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
                    >
                        Request Soil Test
                    </button>
                </div>

                {/* Available Test Packages */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900">Available Soil Test Packages</h2>
                            <p className="text-xs text-slate-500">Pick a package according to your soil testing needs</p>
                        </div>
                        <span className="text-xs font-semibold text-[#2E7D32] bg-green-50 border border-green-100 px-2 py-0.5 rounded-lg">
                            {testOptions.length} Packages
                        </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                        {testOptions.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => openNewRequest(opt.value)}
                                className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-[#2E7D32] hover:shadow-sm cursor-pointer transition-all active:scale-[0.99] flex items-center justify-between gap-3"
                            >
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-slate-900">{opt.label}</h3>
                                    {opt.desc && (
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{opt.desc}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-base font-bold text-[#2E7D32]">₹{opt.price}</span>
                                    <button
                                        type="button"
                                        className="px-3 py-1.5 bg-[#2E7D32] hover:bg-green-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
                                    >
                                        Book
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Features */}
                <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                    <div className="flex items-center gap-3 p-4">
                        <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                            <FiCheckCircle className="text-[#2E7D32]" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-sm">Verified Labs</h3>
                            <p className="text-xs text-slate-500">Tested by certified laboratories for accurate reports.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-4">
                        <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                            <FiClock className="text-[#2E7D32]" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-sm">Report in 3-5 Days</h3>
                            <p className="text-xs text-slate-500">Get your soil report within 3-5 working days.</p>
                        </div>
                    </div>
                </div>

                {/* Previous Requests */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-semibold text-slate-900">My Requests</h2>
                        {requests.length > 0 && <span className="text-xs text-slate-500">{requests.length} total</span>}
                    </div>

                    {loading ? (
                        <div className="py-16 flex justify-center">
                            <div className="w-8 h-8 border-[3px] border-slate-200 border-t-[#2E7D32] rounded-full animate-spin"></div>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                            <FiFileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                            <p className="font-semibold text-slate-800 text-sm">No requests yet</p>
                            <p className="text-xs text-slate-500 mt-1">Your soil test requests will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {requests.map(req => (
                                <div key={req._id} className="bg-white p-4 rounded-2xl border border-slate-200">
                                    <div className="flex justify-between items-start gap-3 mb-2">
                                        <div className="min-w-0">
                                            <p className="text-[11px] text-slate-400 mb-0.5">#{req._id.slice(-8).toUpperCase()}</p>
                                            <h4 className="font-semibold text-slate-900 text-sm">{req.landSize?.replace(/Arce/g, 'Acre')} Land — {req.cropType || 'General'}</h4>
                                            <p className="text-xs font-medium text-[#2E7D32] mt-0.5">{req.testType || 'Soil Test'}</p>
                                        </div>
                                        <StatusBadge status={req.status} />
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-500">
                                        <FiMapPin className="flex-shrink-0 w-3.5 h-3.5" />
                                        <p className="text-xs truncate">{req.location}</p>
                                    </div>

                                    {/* Real-time Tracking Bar */}
                                    {req.status !== 'cancelled' && <TrackingBar status={req.status} />}


                                    {/* Rejection Reason */}
                                    {req.status === 'cancelled' && req.rejectionReason && (
                                        <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 flex gap-2.5">
                                            <FiAlertCircle className="text-red-600 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-xs font-semibold text-red-800 mb-0.5">Request Rejected</p>
                                                <p className="text-xs text-red-600 leading-relaxed">{req.rejectionReason}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Approved — Verified Report Badge + Download */}
                                    {req.status === 'completed' && req.reportStatus === 'approved' && req.reportUrl && (
                                        <div className="mt-3 space-y-2">
                                            <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FiShield className="text-[#2E7D32] w-4 h-4 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-semibold text-slate-900">Report Ready</p>
                                                        <p className="text-[11px] text-slate-500">Verified by Admin</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDownload(req.reportUrl)}
                                                    className="flex items-center gap-1.5 bg-[#2E7D32] text-white px-3 py-2 rounded-lg font-semibold text-xs active:scale-95 transition-transform flex-shrink-0">
                                                    <FiDownload /> Download
                                                </button>
                                            </div>
                                            {/* Show Admin Notes to the Farmer if available */}
                                            {req.adminNotes && (
                                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs">
                                                    <p className="font-semibold text-slate-700 mb-0.5">Admin Note</p>
                                                    <p className="text-slate-600 leading-relaxed">{req.adminNotes}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between gap-2">
                                        <p className="text-[11px] text-slate-400">
                                            {new Date(req.createdAt).toLocaleDateString()}
                                            {req.paymentStatus === 'paid' && req.totalAmount > 0 && <> · Paid ₹{req.totalAmount}</>}
                                        </p>
                                        {req.status === 'pending' && !req.vendorId && (
                                            <button onClick={() => handleEditRequest(req)}
                                                className="px-4 py-1.5 bg-white text-slate-700 rounded-lg font-medium text-xs border border-slate-200 active:bg-slate-50 transition-colors">
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Pay & Submit - payment method choice */}
            <AnimatePresence>
                {showPayOptions && (
                    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => !processingPayment && setShowPayOptions(false)} className="absolute inset-0 bg-slate-900/50" />
                        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                            className="relative bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5">
                            <h3 className="text-base font-semibold text-slate-900">Pay & Submit</h3>
                            <p className="text-xs text-slate-500 mt-0.5 mb-4">Your request is submitted as soon as the payment is done.</p>

                            <div className="flex justify-between items-center bg-slate-50 rounded-xl px-4 py-3 mb-4">
                                <span className="text-sm text-slate-600 truncate max-w-[200px]">{selectedOption?.label || formData.testType || 'Soil Test'}</span>
                                <span className="text-base font-semibold text-slate-900">₹{selectedPrice}</span>
                            </div>

                            <div className="space-y-2">
                                <button onClick={() => payAndSubmit('online')} disabled={processingPayment}
                                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white active:bg-slate-50 disabled:opacity-50 text-left">
                                    <span>
                                        <span className="block text-sm font-medium text-slate-900">Pay Online</span>
                                        <span className="block text-xs text-slate-500">UPI, Cards, Netbanking</span>
                                    </span>
                                    <FiChevronLeft className="rotate-180 text-slate-400" />
                                </button>
                                <button onClick={() => payAndSubmit('wallet')} disabled={processingPayment}
                                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-white active:bg-slate-50 disabled:opacity-50 text-left">
                                    <span>
                                        <span className="block text-sm font-medium text-slate-900">GrooAgri Wallet</span>
                                        <span className="block text-xs text-slate-500">Pay from your wallet balance</span>
                                    </span>
                                    <FiChevronLeft className="rotate-180 text-slate-400" />
                                </button>
                            </div>

                            <button onClick={() => setShowPayOptions(false)} disabled={processingPayment}
                                className="w-full mt-3 py-2.5 text-sm font-medium text-slate-500">
                                {processingPayment ? 'Processing...' : 'Cancel'}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Request Form - Full Page */}
            {showForm && (
                <div className="fixed inset-0 z-[60] bg-slate-50 overflow-y-auto">
                    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 flex items-center px-4 py-3 gap-3">
                        <button type="button" onClick={closeForm} className="p-1.5 -ml-1.5 rounded-lg active:bg-slate-100">
                            <FiChevronLeft className="w-6 h-6 text-slate-700" />
                        </button>
                        <div className="flex-1">
                            <h1 className="text-lg font-semibold text-slate-900 leading-tight">{editingRequestId ? 'Edit Request' : 'Request Soil Test'}</h1>
                            <p className="text-xs text-slate-500">{editingRequestId ? 'Update your request details' : 'Fill in your field details'}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 pb-28 space-y-4">
                        {/* Field Details */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                            <h2 className="text-sm font-semibold text-slate-900">Field Details</h2>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Land Size <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <FiMaximize className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        required
                                        type="text"
                                        className={`${inputClass} pl-10`}
                                        placeholder="e.g. 5 Acre or 10 Bigha"
                                        value={formData.landSize}
                                        onChange={e => setFormData({ ...formData, landSize: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-sm font-medium text-slate-700">Field Address <span className="text-red-500">*</span></label>
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        disabled={fetchingLocation}
                                        className={`text-xs font-medium flex items-center gap-1 ${formData.latitude && formData.longitude ? 'text-[#2E7D32]' : 'text-blue-600'}`}
                                    >
                                        {fetchingLocation ? (
                                            <><div className="w-3 h-3 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" /> Detecting...</>
                                        ) : formData.latitude && formData.longitude ? (
                                            <><FiCheckCircle /> Location added</>
                                        ) : (
                                            <><FiTarget /> Use current location</>
                                        )}
                                    </button>
                                </div>
                                <div className="relative">
                                    <FiMapPin className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <textarea
                                        required
                                        rows="3"
                                        className={`${inputClass} pl-10 resize-none`}
                                        placeholder="Village, tehsil, district"
                                        value={formData.location}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Crop to Grow <span className="text-slate-400 font-normal">(optional)</span></label>
                                <input
                                    type="text"
                                    className={inputClass}
                                    placeholder="e.g. Wheat, Soybean"
                                    value={formData.cropType}
                                    onChange={e => setFormData({ ...formData, cropType: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Test Type */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                            <h2 className="text-sm font-semibold text-slate-900">Test Type</h2>
                            {editingRequestId && <p className="text-xs text-slate-500 -mt-1">Test type can't be changed after payment.</p>}
                            {testOptions.map(option => {
                                const selected = (formData.testType === option.value ||
                                    formData.testType === option.label ||
                                    (formData.testType === 'Basic' && option.label?.includes('Basic')) ||
                                    (formData.testType === 'Advanced' && option.label?.includes('Advanced')));
                                const price = option.price;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        disabled={!!editingRequestId}
                                        onClick={() => setFormData({ ...formData, testType: option.value })}
                                        className={`w-full text-left p-3.5 rounded-xl border flex items-start gap-3 transition-colors disabled:cursor-not-allowed
                                            ${selected ? 'border-[#2E7D32] bg-green-50' : 'border-slate-200 bg-white'} ${editingRequestId && !selected ? 'opacity-50' : ''}`}
                                    >
                                        <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                                            ${selected ? 'border-[#2E7D32]' : 'border-slate-300'}`}>
                                            {selected && <span className="w-2 h-2 rounded-full bg-[#2E7D32]" />}
                                        </span>
                                        <span className="flex-1">
                                            <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                                            {option.desc && <span className="block text-xs text-slate-500 mt-0.5">{option.desc}</span>}
                                        </span>
                                        {price > 0 && <span className="text-sm font-semibold text-slate-900 flex-shrink-0">₹{price}</span>}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Contact */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                            <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number <span className="text-red-500">*</span></label>
                                <input
                                    required
                                    type="tel"
                                    inputMode="numeric"
                                    className={inputClass}
                                    placeholder="10-digit mobile number"
                                    value={formData.phoneNumber}
                                    onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2.5 items-start px-1">
                            <FiInfo className="text-slate-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Our team will contact you and collect the soil sample from your field. You will get a notification once the lab report is ready.
                            </p>
                        </div>

                        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-[#2E7D32] py-3 rounded-xl font-semibold text-white text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {submitting ? 'Saving...' : editingRequestId
                                    ? <><FiSend /> Update Request</>
                                    : <>Pay ₹{selectedPrice} & Submit</>}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <BottomNav />
        </div>
    );
};

export default SoilTesting;
