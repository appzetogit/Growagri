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
    assigned:         { label: 'Assigned',         color: 'blue',    icon: FiClock },
    sample_collected: { label: 'Sample Collected',            color: 'purple',  icon: FiActivity },
    at_lab:           { label: 'At Lab',           color: 'indigo',  icon: FiActivity },
    completed:        { label: 'Completed',        color: 'emerald', icon: FiCheckCircle },
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
        <div className="flex items-center gap-1 mt-4">
            {TRACKING_STEPS.map((step, i) => (
                <React.Fragment key={step.key}>
                    <div className="flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold transition-all
                            ${i <= current ? 'bg-[#2E7D32] text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {i < current ? '✓' : i + 1}
                        </div>
                        <p className={`text-[9px] mt-1 font-medium text-center leading-tight max-w-[48px]
                            ${i <= current ? 'text-slate-700' : 'text-slate-400'}`}>
                            {step.label}
                        </p>
                    </div>
                    {i < TRACKING_STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mb-4 rounded-full transition-all ${i < current ? 'bg-[#2E7D32]' : 'bg-slate-100'}`} />
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
        const cfg = STATUS_CONFIG[status] || { label: status, color: 'slate' };
        return (
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap flex-shrink-0 bg-${cfg.color}-50 text-${cfg.color}-700 border-${cfg.color}-100`}>
                {cfg.label}
            </span>
        );
    };

    const getNextStatuses = (status) => {
        if (status === 'assigned')         return [{ value: 'sample_collected', label: 'Mark Sample Collected' }];
        if (status === 'sample_collected') return [{ value: 'at_lab', label: 'Mark Received at Lab' }];
        return [];
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 pb-28">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 flex items-center px-4 py-3 gap-3">
                <button onClick={() => navigate(-1)} className="p-1.5 -ml-1.5 rounded-lg active:bg-slate-100">
                    <FiChevronLeft className="w-6 h-6 text-slate-700" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold text-slate-900 leading-tight">Soil Test Requests</h1>
                    <p className="text-xs text-slate-500">Requests assigned to your lab</p>
                </div>
                {requests.length > 0 && <span className="text-xs text-slate-500">{requests.length} total</span>}
            </div>

            <div className="p-4 space-y-3">
                {loading ? (
                    <div className="py-24 flex justify-center">
                        <div className="w-8 h-8 border-[3px] border-slate-200 border-t-[#2E7D32] rounded-full animate-spin" />
                    </div>
                ) : requests.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center mt-2">
                        <FiFileText className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                        <p className="font-semibold text-slate-800 text-sm">No requests assigned yet</p>
                        <p className="text-xs text-slate-500 mt-1">Requests will appear here once admin assigns them to you.</p>
                    </div>
                ) : requests.map(req => (
                    <div key={req._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4">
                            <div className="flex justify-between items-start gap-3 mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                                        <FiUser className="text-[#2E7D32] w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-900 text-sm truncate">{req.userId?.name || 'Farmer'}</p>
                                        <p className="text-xs text-slate-500">{req.userId?.phoneNumber || req.phoneNumber} · #{req._id.slice(-6).toUpperCase()}</p>
                                    </div>
                                </div>
                                <StatusBadge status={req.status} />
                            </div>

                            <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                                <p className="text-sm font-medium text-slate-900">
                                    {req.testType || 'Soil Test'}
                                </p>
                                <p className="text-xs text-slate-600">{req.landSize} · {req.cropType || 'General Crop'}</p>
                                <div className="flex items-start gap-1.5 text-xs text-slate-600">
                                    <FiMapPin className="flex-shrink-0 mt-0.5 w-3.5 h-3.5 text-slate-400" />
                                    <span className="flex-1">{req.location}</span>
                                    {req.latitude && req.longitude && (
                                        <a href={`https://www.google.com/maps?q=${req.latitude},${req.longitude}`} target="_blank" rel="noopener noreferrer"
                                            className="text-blue-600 font-medium flex-shrink-0">
                                            Open Map
                                        </a>
                                    )}
                                </div>
                            </div>

                            {req.vendorEarning > 0 && (
                                <div className="flex items-center justify-between mt-3 text-xs">
                                    <span className="text-slate-500">Your earning</span>
                                    <span className={`font-semibold ${req.reportStatus === 'approved' ? 'text-[#2E7D32]' : 'text-slate-900'}`}>
                                        ₹{req.vendorEarning} {req.reportStatus === 'approved' ? '· Credited' : '· On approval'}
                                    </span>
                                </div>
                            )}

                            {!['cancelled'].includes(req.status) && (
                                <TrackingBar status={req.status} />
                            )}
                        </div>

                        {req.reportStatus === 'rejected' && (
                            <div className="mx-4 mb-3 rounded-xl bg-red-50 border border-red-100 p-3">
                                <p className="text-xs font-semibold text-red-700">Report rejected by admin — please upload again</p>
                                {req.reportRejectionReason && <p className="text-xs text-red-600 mt-0.5">Reason: {req.reportRejectionReason}</p>}
                            </div>
                        )}
                        {['uploaded', 'approved'].includes(req.reportStatus) && (
                            <div className={`mx-4 mb-3 rounded-xl p-3 border ${req.reportStatus === 'approved' ? 'bg-green-50 border-green-100' : 'bg-amber-50 border-amber-100'}`}>
                                <p className={`text-xs font-semibold ${req.reportStatus === 'approved' ? 'text-[#2E7D32]' : 'text-amber-700'}`}>
                                    {req.reportStatus === 'approved'
                                        ? `Report approved${req.vendorEarning > 0 ? ` — ₹${req.vendorEarning} credited to your wallet` : ''}`
                                        : 'Report submitted — waiting for admin review'}
                                </p>
                            </div>
                        )}

                        <div className="px-4 pb-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                            <button onClick={() => openDetailsModal(req)}
                                className="flex-1 min-w-[90px] py-2.5 bg-white text-slate-700 rounded-xl font-medium text-sm border border-slate-200 active:bg-slate-50 transition-colors flex items-center justify-center gap-1.5">
                                <FiFileText className="w-4 h-4" /> Details
                            </button>
                            {!['completed', 'cancelled'].includes(req.status) && getNextStatuses(req.status).length > 0 && (
                                <button onClick={() => openStatusModal(req)}
                                    className="flex-[2] min-w-[150px] py-2.5 bg-[#2E7D32] text-white rounded-xl font-medium text-sm active:scale-[0.98] transition-transform">
                                    {getNextStatuses(req.status)[0].label}
                                </button>
                            )}
                            {!['completed', 'cancelled'].includes(req.status) && ['at_lab', 'sample_collected'].includes(req.status) && ['pending', 'rejected'].includes(req.reportStatus) && (
                                <button onClick={() => openReportModal(req)}
                                    className="flex-[2] min-w-[150px] py-2.5 bg-[#2E7D32] text-white rounded-xl font-medium text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5">
                                    <FiUpload className="w-4 h-4" /> {req.reportStatus === 'rejected' ? 'Re-upload Report' : 'Upload Report'}
                                </button>
                            )}
                        </div>
                    </div>
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
                                className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 overflow-hidden z-10">
                                    
                                    {/* Header */}
                                    <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                                        <h2 className="text-lg font-semibold text-slate-900">Request Details</h2>
                                        <button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                            <FiX />
                                        </button>
                                    </div>

                                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                        {/* ID and Status */}
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase">ID: {activeRequest._id.slice(-8)}</span>
                                            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase border border-blue-100">
                                                {activeRequest.status}
                                            </span>
                                        </div>

                                        {/* Farmer Info */}
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 mb-1.5">Farmer Info</p>
                                            <p className="font-semibold text-slate-800 text-sm">{activeRequest.userId?.name || 'Farmer'}</p>
                                            <p className="text-xs text-slate-500 font-bold mt-0.5">{activeRequest.userId?.phoneNumber || activeRequest.phoneNumber}</p>
                                            <p className="text-xs text-slate-500 font-medium mt-1 flex items-start gap-1">
                                                <FiMapPin className="mt-0.5 flex-shrink-0 text-slate-400" />
                                                <span>{activeRequest.location}</span>
                                            </p>
                                        </div>

                                        {/* Land & Crop Info */}
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 mb-1.5">Test details</p>
                                            <div className="grid grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <p className="text-slate-400 font-bold">Land Size</p>
                                                    <p className="font-semibold text-slate-700">{activeRequest.landSize}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 font-bold">Crop Type</p>
                                                    <p className="font-semibold text-slate-700">{activeRequest.cropType || 'General Crop'}</p>
                                                </div>
                                                <div className="col-span-2 mt-1">
                                                    <p className="text-slate-400 font-bold">Test Tier</p>
                                                    <p className="font-semibold text-teal-600">{activeRequest.testType || 'Soil Test'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Payment Ledger */}
                                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 mb-2">Earnings Ledger</p>
                                            
                                            {(!activeRequest.totalAmount || activeRequest.totalAmount === 0) ? (
                                                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl text-xs font-semibold leading-relaxed">
                                                    No earnings recorded for this request.
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5 text-xs">

                                                    <div className="flex justify-between text-slate-800 font-bold">
                                                        <span>Your Earnings</span>
                                                        <span className="text-emerald-600 font-semibold">₹{activeRequest.vendorEarning || 0}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {activeRequest.vendorEarning > 0 && (
                                                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                                    <span className="text-slate-400 font-bold">Farmer has paid</span>
                                                    <span className={`px-2 py-0.5 rounded font-semibold ${
                                                        activeRequest.reportStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                                    }`}>
                                                        {activeRequest.reportStatus === 'approved' ? 'Credited to Wallet' : 'Credited on Approval'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Report Details */}
                                        {activeRequest.reportUrl && (
                                            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                                <p className="text-xs font-medium text-slate-500 mb-1.5">Lab Report</p>
                                                <p className="text-xs text-slate-500 font-bold">Uploaded on: {activeRequest.reportDate ? new Date(activeRequest.reportDate).toLocaleDateString() : 'N/A'}</p>
                                                <a href={activeRequest.reportUrl} target="_blank" rel="noopener noreferrer" 
                                                    className="mt-2.5 w-full py-2 bg-[#2E7D32] text-white rounded-xl text-center font-bold text-xs hover:bg-teal-700 transition-all flex items-center justify-center gap-1.5 font-mono">
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
                                className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6">
                                <div className="flex justify-between items-center mb-5">
                                    <h2 className="text-lg font-semibold text-slate-900">Update Status</h2>
                                    <button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                        <FiX />
                                    </button>
                                </div>
                                <div className="bg-slate-50 rounded-2xl p-4 mb-5">
                                    <p className="text-xs font-bold text-slate-400">Current: <span className="text-slate-700 uppercase">{activeRequest.status}</span></p>
                                    <p className="font-semibold text-slate-800 mt-1">{activeRequest.userId?.name} — {activeRequest.landSize}</p>
                                </div>
                                <div className="space-y-3">
                                    {getNextStatuses(activeRequest.status).map(s => (
                                        <button key={s.value} onClick={() => handleUpdateStatus(s.value)}
                                            disabled={saving}
                                            className="w-full py-4 bg-[#2E7D32] text-white rounded-xl font-semibold active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3 text-sm">
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
                                className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-5">
                                <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 pb-2">
                                    <h2 className="text-lg font-semibold text-slate-900">Lab Report Upload</h2>
                                    <button onClick={closeModal} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                        <FiX />
                                    </button>
                                </div>
                                <div className="bg-green-50 rounded-xl p-3 border border-green-100 mb-4">
                                    <p className="text-xs text-green-800 leading-relaxed">
                                        📎 Upload the lab report (PDF or image). Admin will verify it — once approved, the farmer can download it and your earning is credited to your wallet.
                                    </p>
                                </div>
                                <form onSubmit={(e) => { e.preventDefault(); handleUploadReport(); }} className="space-y-4">
                                    <div className="space-y-3">
                                        <label className="text-xs font-medium text-slate-500 ml-1">
                                            Select Report File (PDF / Image)
                                        </label>
                                        <label className="relative block h-32 border-2 border-dashed border-slate-200 rounded-xl overflow-hidden bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer group">
                                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                                            {filePreview ? (
                                                <div className="absolute inset-0">
                                                    <img src={filePreview} className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-all flex items-center justify-center">
                                                        <p className="bg-white/90 px-4 py-2 rounded-xl text-[10px] font-semibold uppercase text-slate-800 shadow-xl">Tap to Change</p>
                                                    </div>
                                                </div>
                                            ) : selectedFile ? (
                                                <div className="flex flex-col items-center justify-center h-full gap-2">
                                                    <div className="w-10 h-10 bg-teal-100 rounded-2xl flex items-center justify-center">
                                                        <FiFileText className="text-teal-600 text-lg" />
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-600 truncate max-w-[200px]">{selectedFile.name}</p>
                                                    <p className="text-[9px] font-bold text-slate-400">Tap to Change File</p>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center justify-center h-full gap-2">
                                                    <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        <FiUpload className="text-slate-400 text-lg" />
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-600">Select File from Device</p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Max Size: 10MB</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={closeModal}
                                            className="flex-1 py-3.5 rounded-2xl font-semibold text-slate-500 bg-slate-100 active:scale-95 transition-all text-sm">Cancel</button>
                                        <button type="submit" disabled={saving || !selectedFile}
                                            className="flex-1 py-3.5 rounded-xl font-semibold text-white bg-[#2E7D32] disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5 text-sm px-1">
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
                                className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-5">
                                <div className="flex justify-between items-center mb-3 sticky top-0 bg-white z-10 pb-2">
                                    <h2 className="text-lg font-semibold text-slate-900">Reject Request</h2>
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
                                        <label className="text-xs font-medium text-slate-500 ml-1">Reason for rejection</label>
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
                                            className="flex-1 py-3.5 rounded-2xl font-semibold text-slate-500 bg-slate-100 active:scale-95 transition-all text-sm">Cancel</button>
                                        <button onClick={handleReject} disabled={saving || !rejectionReason.trim()}
                                            className="flex-1 py-3.5 rounded-xl font-semibold text-white bg-red-600 disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center gap-1.5 text-sm px-1">
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
