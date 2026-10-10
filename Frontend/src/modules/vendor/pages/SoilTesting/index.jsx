import React, { useState, useEffect } from 'react';
import {
    FiChevronLeft, FiMapPin, FiUser, FiActivity,
    FiUpload, FiCheckCircle, FiClock, FiAlertCircle, FiX, FiFileText, FiDownload
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import vendorSoilTestService from '../../../../services/vendorSoilTestService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import api from '../../../../services/api';

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    assigned:         { label: 'Assigned — Ready to Start', color: 'blue',    icon: FiClock },
    sample_collected: { label: 'Sample Collected',            color: 'purple',  icon: FiActivity },
    at_lab:           { label: 'In Laboratory',               color: 'indigo',  icon: FiActivity },
    completed:        { label: 'Completed ✓',                 color: 'emerald', icon: FiCheckCircle },
    cancelled:        { label: 'Cancelled',                   color: 'slate',   icon: FiAlertCircle },
};

const TRACKING_STEPS = [
    { key: 'assigned',         label: 'Assigned' },
    { key: 'sample_collected', label: 'Collected' },
    { key: 'at_lab',           label: 'Lab Process' },
    { key: 'completed',        label: 'Finalized' },
];

const stepIndex = (status) => TRACKING_STEPS.findIndex(s => s.key === status);

// ─── TrackingBar ─────────────────────────────────────────────────────────────
// Defined OUTSIDE VendorSoilTests to avoid being recreated on every re-render.
// Re-creating it caused React to clash with GSAP's DOM mutations → removeChild crash.
const TrackingBar = ({ status }) => {
    const current = stepIndex(status);
    return (
        <div className="flex items-center gap-1 mt-3">
            {TRACKING_STEPS.map((step, i) => (
                <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all
                            ${i <= current ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {i < current ? '✓' : i + 1}
                        </div>
                        <p className={`text-[8px] mt-1 font-bold text-center leading-tight max-w-[40px]
                            ${i <= current ? 'text-teal-600' : 'text-slate-300'}`}>
                            {step.label}
                        </p>
                    </div>
                    {i < TRACKING_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mb-4 rounded-full transition-all ${i < current ? 'bg-teal-500' : 'bg-slate-100'}`} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );
};

// ─── Component ────────────────────────────────────────────────────────────────
const VendorSoilTests = () => {
    const navigate = useNavigate();
    const [requests, setRequests]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [activeRequest, setActive]      = useState(null);
    const [reportUrl, setReportUrl]       = useState('');
    const [saving, setSaving]             = useState(false);
    const [modalType, setModalType]       = useState(''); // 'status' | 'report' | 'reject'
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview]   = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    // Track visual viewport height so modals adjust when iOS keyboard opens
    const [vpHeight, setVpHeight]         = useState(() => window.visualViewport?.height ?? window.innerHeight);

    useEffect(() => {
        fetchMyRequests(false);

        const pollInterval = setInterval(() => fetchMyRequests(true), 30000);

        // GSAP CLEANUP: Kill orphaned ScrollTrigger instances to prevent removeChild crash
        try {
            import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
                ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load' });
                ScrollTrigger.getAll().forEach(t => t.kill());
            }).catch(() => {});
        } catch (e) {}

        return () => clearInterval(pollInterval);
    }, []);

    // Lock body scroll and prevent layout viewport shifting (e.g. keyboard autoscorll) when modal is open
    useEffect(() => {
        if (!modalType) {
            document.body.style.overflow = 'unset';
            return;
        }

        document.body.style.overflow = 'hidden';

        if (modalType === 'details') {
            return () => {
                document.body.style.overflow = 'unset';
            };
        }

        const resetScroll = () => {
            if (window.scrollY > 0 || document.documentElement.scrollTop > 0) {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
            }
        };

        // Reset scroll position immediately
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;

        window.addEventListener('scroll', resetScroll, { passive: true });
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('scroll', resetScroll);
        };
    }, [modalType]);

    // Track visual viewport height — iOS keyboard shrinks visualViewport, not window
    useEffect(() => {
        if (!modalType) {
            setVpHeight(window.visualViewport?.height ?? window.innerHeight);
            return;
        }
        const vp = window.visualViewport;
        if (!vp) return;
        const onResize = () => {
            setVpHeight(vp.height);
            if (modalType !== 'details') {
                window.scrollTo(0, 0);
                document.documentElement.scrollTop = 0;
            }
        };
        setVpHeight(vp.height);
        vp.addEventListener('resize', onResize);
        vp.addEventListener('scroll', onResize);
        return () => {
            vp.removeEventListener('resize', onResize);
            vp.removeEventListener('scroll', onResize);
        };
    }, [modalType]);

    const fetchMyRequests = async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const res = await vendorSoilTestService.getMyRequests();
            if (res.success) setRequests(res.data);
        } catch {
            if (!isPolling) toast.error('Failed to load requests');
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    const openStatusModal = (req) => { setActive(req); setModalType('status'); };
    const openReportModal = (req) => {
        setActive(req);
        setReportUrl('');
        setSelectedFile(null);
        setFilePreview(null);
        setModalType('report');
    };
    const openRejectModal = (req) => {
        setActive(req);
        setRejectionReason('');
        setModalType('reject');
    };
    const openDetailsModal = (req) => {
        setActive(req);
        setModalType('details');
    };
    const closeModal = () => { setActive(null); setModalType(''); setSelectedFile(null); setFilePreview(null); setRejectionReason(''); };

    const handleUpdateStatus = async (newStatus) => {
        try {
            setSaving(true);
            const res = await vendorSoilTestService.updateStatus(activeRequest._id, newStatus);
            if (res.success) {
                toast.success('Status updated successfully!');
                closeModal();
                fetchMyRequests(false);
            }
        } catch { toast.error('Failed to update status'); }
        finally { setSaving(false); }
    };

    const uploadFile = async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await api.post('/image/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (!data.success) throw new Error(data.message || 'Upload failed');
        return data.imageUrl;
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) return toast.error('Maximum file size is 10MB');
            setSelectedFile(file);
            if (file.type.startsWith('image/')) {
                setFilePreview(URL.createObjectURL(file));
            } else {
                setFilePreview(null);
            }
        }
    };

    const handleUploadReport = async () => {
        if (!selectedFile && !reportUrl.trim()) return toast.error('Please select a file to upload');
        try {
            setSaving(true);
            let finalUrl = reportUrl.trim();
            if (selectedFile) {
                const uploadToastId = toast.loading('Uploading report...');
                try {
                    finalUrl = await uploadFile(selectedFile);
                    toast.success('File uploaded successfully!', { id: uploadToastId });
                } catch (err) {
                    toast.error('Upload failed: ' + err.message, { id: uploadToastId });
                    setSaving(false);
                    return;
                }
            }
            const res = await vendorSoilTestService.uploadReport(activeRequest._id, finalUrl);
            if (res.success) {
                toast.success('Report submitted for Admin review!');
                closeModal();
                fetchMyRequests(false);
            }
        } catch {
            toast.error('Submission failed');
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) return toast.error('Please provide a reason for rejection');
        try {
            setSaving(true);
            const res = await vendorSoilTestService.rejectRequest(activeRequest._id, rejectionReason);
            if (res.success) {
                toast.success('Request rejected. Admin has been notified.');
                closeModal();
                fetchMyRequests(false);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reject request');
        } finally {
            setSaving(false);
        }
    };

    const StatusBadge = ({ status }) => {
        const cfg = STATUS_CONFIG[status] || { label: status, color: 'slate', icon: FiActivity };
        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border bg-${cfg.color}-50 text-${cfg.color}-600 border-${cfg.color}-100`}>
                <cfg.icon className="w-3 h-3" /> {cfg.label}
            </span>
        );
    };

    const getNextStatuses = (status) => {
        if (status === 'assigned')         return [{ value: 'sample_collected', label: '🧪 Sample Collected' }];
        if (status === 'sample_collected') return [{ value: 'at_lab', label: '🔬 Received at Lab' }];
        return [];
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-[#F0F7FF] pb-28">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-black/[0.03] flex items-center px-4 py-4 gap-4">
                <button onClick={() => navigate(-1)} className="p-2 bg-slate-100 rounded-xl">
                    <FiChevronLeft className="w-6 h-6 text-slate-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-black text-slate-800 leading-tight">Soil Test Requests</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manage your assigned requests</p>
                </div>
                <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-black">
                    {requests.length} Total
                </div>
            </div>

            <div className="p-5 space-y-4">
                {loading ? (
                    <div className="py-24 flex justify-center">
                        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-16 text-center mt-8">
                        <FiActivity className="w-14 h-14 text-slate-200 mx-auto mb-4" />
                        <p className="font-black text-slate-600 text-lg">No requests assigned yet</p>
                        <p className="text-sm text-slate-400 font-medium mt-1">Pending requests will appear here once assigned by admin</p>
                    </div>
                ) : requests.map(req => (
                    <motion.div key={req._id} layout
                        className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                                        ID: {req._id.slice(-8)}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <FiUser className="text-blue-600 w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-800 text-sm">{req.userId?.name || 'Farmer'}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{req.userId?.phoneNumber || req.phoneNumber}</p>
                                        </div>
                                    </div>
                                </div>
                                <StatusBadge status={req.status} />
                            </div>

                            <div className="flex items-center gap-2 text-slate-500 mb-1">
                                <FiMapPin className="flex-shrink-0 text-xs" />
                                <p className="text-xs font-bold truncate">{req.location}</p>
                                {req.latitude && req.longitude && (
                                    <a href={`https://www.google.com/maps?q=${req.latitude},${req.longitude}`} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors shrink-0">
                                        View on Map 🗺️
                                    </a>
                                )}
                            </div>
                            <div className="ml-5 space-y-0.5">
                                <p className="text-xs text-slate-400 font-bold">
                                    {req.landSize} — {req.cropType || 'General Crop'}
                                </p>
                                <p className="text-[10px] font-black text-teal-600">
                                    {req.testType === 'Advanced' ? 'Advanced Test (12 Param)' : 'Basic Test (3 Param)'}
                                </p>
                            </div>

                            <div className="ml-5 mt-2 flex items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    req.paymentStatus === 'paid'
                                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                        : 'bg-amber-50 text-amber-600 border border-amber-100'
                                }`}>
                                    💰 Payment: {req.paymentStatus === 'paid' ? 'Received (Wallet Credited)' : 'Pending'}
                                </span>
                            </div>

                            {!['cancelled'].includes(req.status) && (
                                <TrackingBar status={req.status} />
                            )}
                        </div>

                        {req.reportStatus && req.reportStatus !== 'pending' && (
                            <div className={`px-5 py-2 border-t border-slate-50 flex items-center justify-between
                                ${req.reportStatus === 'approved' ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                                <p className={`text-xs font-black ${req.reportStatus === 'approved' ? 'text-emerald-700' : 'text-orange-600'}`}>
                                    {req.reportStatus === 'approved'
                                        ? '✅ Admin approved the report — Farmer can now download it'
                                        : '⏳ Report is under review by the Admin...'}
                                </p>
                            </div>
                        )}

                        <div className="px-5 pb-5 border-t border-slate-50 pt-4 space-y-3">
                            <button onClick={() => openDetailsModal(req)}
                                className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-slate-200/50">
                                <FiFileText className="w-4 h-4" /> View Details
                            </button>
                            
                            {!['completed', 'cancelled'].includes(req.status) && (
                                <div className="flex gap-3">
                                    {req.status === 'assigned' && (
                                        <button onClick={() => openRejectModal(req)}
                                            className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/10">
                                            <FiX className="w-3.5 h-3.5" /> Reject
                                        </button>
                                    )}
                                    {getNextStatuses(req.status).length > 0 && (
                                        <button onClick={() => openStatusModal(req)}
                                            className="flex-1 py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-blue-500/15 active:scale-95 transition-all">
                                            Update Status →
                                        </button>
                                    )}
                                    {['at_lab', 'sample_collected'].includes(req.status) && req.reportStatus === 'pending' && (
                                        <button onClick={() => openReportModal(req)}
                                            className="flex-1 py-3.5 bg-teal-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-teal-600/15 active:scale-95 transition-all flex items-center justify-center gap-1.5">
                                            <FiUpload className="w-3.5 h-3.5" /> Upload Report
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* ── Details Modal ── */}
            {createPortal(
                <AnimatePresence>
                    {modalType === 'details' && activeRequest && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={closeModal} className="absolute inset-0" />
                            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-6 overflow-hidden z-10">
                                    
                                    {/* Header */}
                                    <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                                        <h2 className="text-xl font-black text-slate-800">Request Details</h2>
                                        <button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                            <FiX />
                                        </button>
                                    </div>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                        {/* ID and Status */}
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">ID: {activeRequest._id.slice(-8)}</span>
                                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase border border-blue-100">
                                                {activeRequest.status}
                                            </span>
                                        </div>

                                        {/* Farmer Info */}
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Farmer Info</p>
                                            <p className="font-black text-slate-800 text-sm">{activeRequest.userId?.name || 'Farmer'}</p>
                                            <p className="text-xs text-slate-500 font-bold mt-0.5">{activeRequest.userId?.phoneNumber || activeRequest.phoneNumber}</p>
                                            <p className="text-xs text-slate-500 font-medium mt-1 flex items-start gap-1">
                                                <FiMapPin className="mt-0.5 flex-shrink-0 text-slate-400" />
                                                <span>{activeRequest.location}</span>
                                            </p>
                                        </div>

                                        {/* Land & Crop Info */}
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Test details</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <p className="text-slate-400 font-bold">Land Size</p>
                                                    <p className="font-black text-slate-700">{activeRequest.landSize}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-bold">Crop Type</p>
                                                    <p className="font-black text-slate-700">{activeRequest.cropType || 'General Crop'}</p>
                                                </div>
                                                <div className="col-span-2 mt-1">
                                                    <p className="text-slate-400 font-bold">Test Tier</p>
                                                    <p className="font-black text-teal-600">{activeRequest.testType === 'Advanced' ? 'Advanced Test (12 Param)' : 'Basic Test (3 Param)'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Ledger */}
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Earnings Ledger</p>
                                            
                                            {(!activeRequest.totalAmount || activeRequest.totalAmount === 0) ? (
                                                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs font-semibold leading-relaxed">
                                                    ⚠️ Earnings will be set by admin after the lab report is uploaded.
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5 text-xs">

                                                    <div className="flex justify-between text-slate-800 font-bold">
                                                        <span>Your Earnings</span>
                                                        <span className="text-emerald-600 font-black">₹{activeRequest.vendorEarning || 0}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {activeRequest.paymentStatus && (
                                                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                                    <span className="text-slate-400 font-bold">Method: {activeRequest.paymentMethod?.toUpperCase() || 'N/A'}</span>
                                                    <span className={`px-2 py-0.5 rounded font-black ${
                                                        activeRequest.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                    }`}>
                                                        {activeRequest.paymentStatus === 'paid' ? 'Paid to Wallet' : 'Payment Pending'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Report Details */}
                                        {activeRequest.reportUrl && (
                                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Lab Report</p>
                                                <p className="text-xs text-slate-500 font-bold">Uploaded on: {activeRequest.reportDate ? new Date(activeRequest.reportDate).toLocaleDateString() : 'N/A'}</p>
                                                <a href={activeRequest.reportUrl} target="_blank" rel="noopener noreferrer" 
                                                    className="mt-2.5 w-full py-2 bg-teal-600 text-white rounded-xl text-center font-bold text-xs hover:bg-teal-700 transition-all flex items-center justify-center gap-1.5 font-mono">
                                                    <FiDownload className="w-3.5 h-3.5" /> View Report PDF
                                                </a>
                                            </div>
                                        )}

                                        {/* Rejection Info */}
                                        {activeRequest.rejectionReason && (
                                            <div className="p-3 bg-red-50 text-red-700 rounded-2xl border border-red-100 text-xs">
                                                <p className="font-bold uppercase text-[9px] mb-1">Rejection Reason</p>
                                                <p>{activeRequest.rejectionReason}</p>
                                            </div>
                                        )}
                                    </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* ── Status Update Modal ── */}
            <AnimatePresence>
                {modalType === 'status' && activeRequest && (
                    <div className="fixed inset-x-0 top-0 z-[100]" style={{ height: vpHeight }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={closeModal} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        {/* Container limited to space above BottomNav — centers modal in visible area */}
                        <div className={`absolute inset-x-0 top-0 flex justify-center p-4 overflow-y-auto ${vpHeight < window.innerHeight - 150 ? 'items-start pt-4' : 'items-center'}`} style={{ height: vpHeight - (vpHeight < window.innerHeight - 150 ? 0 : 96) }}>
                            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-6">
                                <div className="flex justify-between items-center mb-5">
                                    <h2 className="text-xl font-black text-slate-800">Update Status</h2>
                                    <button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                        <FiX />
                                    </button>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 mb-5">
                                    <p className="text-xs font-bold text-slate-400">Current: <span className="text-slate-700 uppercase">{activeRequest.status}</span></p>
                                    <p className="font-black text-slate-800 mt-1">{activeRequest.userId?.name} — {activeRequest.landSize}</p>
                                </div>
                                <div className="space-y-3">
                                    {getNextStatuses(activeRequest.status).map(s => (
                                        <button key={s.value} onClick={() => handleUpdateStatus(s.value)}
                                            disabled={saving}
                                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-[24px] font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-sm">
                                            {saving ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Updating...
                                                </>
                                            ) : s.label}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Upload Report Modal ── */}
            <AnimatePresence>
                {modalType === 'report' && activeRequest && (
                    <div className="fixed inset-x-0 top-0 z-[100]" style={{ height: vpHeight }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={closeModal} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        <div className={`absolute inset-x-0 top-0 flex justify-center p-4 overflow-y-auto custom-scrollbar ${vpHeight < window.innerHeight - 150 ? 'items-start pt-4' : 'items-center'}`} style={{ height: vpHeight - (vpHeight < window.innerHeight - 150 ? 0 : 96) }}>
                            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-5">
                                <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 pb-2">
                                    <h2 className="text-xl font-black text-slate-800">Lab Report Upload</h2>
                                    <button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                        <FiX />
                                    </button>
                                </div>
                                <div className="bg-teal-50 rounded-2xl p-3 border border-teal-100 mb-4">
                                    <p className="text-xs font-bold text-teal-700 leading-relaxed">
                                        📎 Upload the report (PDF/Image) to a cloud service (like Cloudinary) and paste the link below. The report will be available to the farmer once verified by the Admin.
                                    </p>
                                </div>
                                <form onSubmit={(e) => { e.preventDefault(); handleUploadReport(); }} className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Select Report File (PDF / Image)
                                        </label>
                                        <label className="relative block h-32 border-2 border-dashed border-slate-200 rounded-[24px] overflow-hidden bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer group">
                                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                                            {filePreview ? (
                                                <div className="absolute inset-0">
                                                    <img src={filePreview} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                                        <p className="bg-white/90 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-800 shadow-xl">Tap to Change</p>
                                                    </div>
                                                </div>
                                            ) : selectedFile ? (
                                                <div className="flex flex-col items-center justify-center h-full gap-2">
                                                    <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
                                                        <FiFileText className="text-teal-600 text-lg" />
                                                    </div>
                                                    <p className="text-xs font-black text-slate-600 truncate max-w-[200px]">{selectedFile.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400">Tap to Change File</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full gap-2">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <FiUpload className="text-slate-400 text-lg" />
                                                    </div>
                                                    <p className="text-xs font-black text-slate-600">Select File from Device</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Max Size: 10MB</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={closeModal}
                                            className="flex-1 py-3.5 rounded-2xl font-black text-slate-500 bg-slate-100 active:scale-95 transition-all text-sm">Cancel</button>
                                        <button type="submit" disabled={saving || !selectedFile}
                                            className="flex-1 py-3.5 rounded-[20px] font-black text-white bg-teal-600 shadow-xl shadow-teal-500/30 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5 text-sm px-1">
                                            {saving ? (
                                                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" /><span className="truncate">Submitting</span></>
                                            ) : (
                                                <><FiCheckCircle className="text-lg shrink-0" /><span className="truncate">Submit</span></>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Reject Reason Modal ── */}
            <AnimatePresence>
                {modalType === 'reject' && activeRequest && (
                    <div className="fixed inset-x-0 top-0 z-[100]" style={{ height: vpHeight }}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={closeModal} className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        <div className={`absolute inset-x-0 top-0 flex justify-center p-4 overflow-y-auto custom-scrollbar ${vpHeight < window.innerHeight - 150 ? 'items-start pt-4' : 'items-center'}`} style={{ height: vpHeight - (vpHeight < window.innerHeight - 150 ? 0 : 96) }}>
                            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl p-5">
                                <div className="flex justify-between items-center mb-3 sticky top-0 bg-white z-10 pb-2">
                                    <h2 className="text-xl font-black text-slate-800">Reject Request</h2>
                                    <button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                        <FiX />
                                    </button>
                                </div>
                                <div className="bg-red-50 rounded-2xl p-3 border border-red-100 mb-3">
                                    <p className="text-[11px] font-bold text-red-700 leading-relaxed">
                                        ⚠️ If you cannot fulfill this request, please provide a reason. The request will be sent back to the Admin for re-assignment.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason for rejection</label>
                                        <textarea
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 text-sm font-medium focus:ring-2 focus:ring-red-500 outline-none min-h-[80px]"
                                            placeholder="e.g. Too far from my location, Schedule already full, etc."
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            onFocus={() => {
                                                setTimeout(() => {
                                                    window.scrollTo(0, 0);
                                                    document.documentElement.scrollTop = 0;
                                                    document.body.scrollTop = 0;
                                                }, 100);
                                            }}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={closeModal}
                                            className="flex-1 py-3.5 rounded-2xl font-black text-slate-500 bg-slate-100 active:scale-95 transition-all text-sm">Cancel</button>
                                        <button onClick={handleReject} disabled={saving || !rejectionReason.trim()}
                                            className="flex-1 py-3.5 rounded-[20px] font-black text-white bg-red-600 shadow-xl shadow-red-500/30 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5 text-sm px-1">
                                            {saving ? (
                                                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" /><span className="truncate">Rejecting</span></>
                                            ) : (
                                                <><FiX className="text-lg shrink-0" /><span className="truncate">Reject</span></>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VendorSoilTests;
