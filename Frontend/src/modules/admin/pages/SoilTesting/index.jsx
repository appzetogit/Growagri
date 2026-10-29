import React, { useState, useEffect } from 'react';
import {
    FiSearch, FiFilter, FiTrash2, FiCheckCircle, FiClock,
    FiUser, FiMapPin, FiActivity, FiUpload, FiUserCheck, FiX,
    FiDollarSign, FiTrendingUp, FiCreditCard, FiPieChart,
    FiSettings, FiPlus, FiEdit2, FiLayers
} from 'react-icons/fi';
import adminSoilTestService from '../../../../services/adminSoilTestService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CONFIG = {
    pending:          { label: 'Pending',          color: 'amber' },
    assigned:         { label: 'Assigned',          color: 'blue' },
    sample_collected: { label: 'Sample Collected',  color: 'purple' },
    at_lab:           { label: 'At Lab',            color: 'indigo' },
    completed:        { label: 'Completed',         color: 'emerald' },
    cancelled:        { label: 'Cancelled',         color: 'slate' },
};

const REPORT_STATUS_CONFIG = {
    pending:  { label: 'No Report',  color: 'slate' },
    uploaded: { label: 'Needs Review', color: 'orange' },
    approved: { label: 'Approved ✓', color: 'emerald' },
    rejected: { label: 'Sent Back',   color: 'rose' },
};

const StatusBadge = ({ status, config }) => {
    const cfg = config[status] || { label: status, color: 'slate' };
    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider border bg-${cfg.color}-50 text-${cfg.color}-600 border-${cfg.color}-100`}>
            {cfg.label}
        </span>
    );
};

const ManageSoilTests = () => {
    const [requests, setRequests]         = useState([]);
    const [vendors, setVendors]           = useState([]);
    const [loading, setLoading]           = useState(true);
    const [searchTerm, setSearchTerm]     = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [viewMode, setViewMode]         = useState('requests'); // 'requests' | 'transactions'

    // Vendor matching filters
    const [filterByState, setFilterByState] = useState(false);
    const [filterByDistrict, setFilterByDistrict] = useState(false);

    // Modal states
    const [assignModal, setAssignModal]   = useState(null); // request object
    const [approveModal, setApproveModal] = useState(null); // request object
    const [selectedVendorId, setSelectedVendorId] = useState('');
    const [approveNotes, setApproveNotes]           = useState('');
    const [previewUrl, setPreviewUrl]               = useState(null);
    const [saving, setSaving]             = useState(false);
    const [pricing, setPricing]           = useState({ basicPrice: '', advancedPrice: '', commissionPercentage: 10, testTypes: [] });
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsModalOpen, setSettingsModalOpen] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        commissionPercentage: 10,
        testTypes: []
    });
    const [editingTestTypeIndex, setEditingTestTypeIndex] = useState(null);
    const [testTypeDraft, setTestTypeDraft] = useState({
        name: '',
        title: '',
        description: '',
        price: '',
        isActive: true
    });

    const vendorShare = (price) => {
        const p = Number(price) || 0;
        return (p - Math.round(p * (Number(pricing.commissionPercentage) || 0)) / 100).toFixed(2);
    };

    useEffect(() => {
        fetchRequests(false);
        fetchVendors();
        adminSoilTestService.getSettings().then(res => {
            if (res.success && res.data) {
                setPricing(res.data);
                setSettingsForm({
                    commissionPercentage: res.data.commissionPercentage ?? 10,
                    testTypes: res.data.testTypes || []
                });
            }
        }).catch(() => {});

        // Auto-update status every 15 seconds
        const interval = setInterval(() => fetchRequests(true), 15000);
        return () => clearInterval(interval);
    }, []);

    // Prevent background scrolling when a modal is open
    useEffect(() => {
        if (assignModal || approveModal || settingsModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [assignModal, approveModal, settingsModalOpen]);

    const fetchRequests = async (isPolling = false) => {
        try {
            if (!isPolling) setLoading(true);
            const res = await adminSoilTestService.getAll();
            if (res.success) setRequests(res.data);
        } catch {
            if (!isPolling) toast.error('Failed to fetch requests');
        } finally {
            if (!isPolling) setLoading(false);
        }
    };

    const fetchVendors = async () => {
        try {
            const res = await adminSoilTestService.getVendors();
            if (res.success) {
                const allVendors = res.data || res.vendors || [];
                // Filter to only include vendors who are marked as a 'soil_testing' service
                // Note: approvalStatus check removed - admin has already verified via the toggle
                // Only vendors registered as a soil lab (not machinery categories like "Lab soil testing")
                const soilLabs = allVendors.filter(v =>
                    Array.isArray(v.service) ? v.service.includes('soil_testing') : v.service === 'soil_testing'
                );
                setVendors(soilLabs);
            }
        } catch {
            // silently fail — vendor list optional
        }
    };

    const handleAssignVendor = async (vendorId) => {
        const vId = vendorId || selectedVendorId;
        if (!vId) return toast.error('Please select a vendor');
        try {
            setSaving(true);
            const res = await adminSoilTestService.assignVendor(assignModal._id, vId);
            if (res.success) {
                toast.success('Vendor assigned successfully!');
                setAssignModal(null);
                setSelectedVendorId('');
                setFilterByState(false);
                setFilterByDistrict(false);
                fetchRequests(false);
            }
        } catch { toast.error('Failed to assign vendor'); }
        finally { setSaving(false); }
    };

    const handleSaveSettings = async () => {
        try {
            setSavingSettings(true);
            const payload = {
                commissionPercentage: Number(settingsForm.commissionPercentage) || 0,
                testTypes: settingsForm.testTypes
            };
            const res = await adminSoilTestService.updateSettings(payload);
            if (res.success) {
                toast.success('Soil testing settings & packages saved');
                setPricing(res.data);
                setSettingsModalOpen(false);
                setEditingTestTypeIndex(null);
            }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to save settings'); }
        finally { setSavingSettings(false); }
    };

    const handleApproveReport = async () => {
        try {
            setSaving(true);
            const res = await adminSoilTestService.approveReport(approveModal._id, approveNotes);
            if (res.success) {
                toast.success(res.message || 'Report approved');
                setApproveModal(null);
                setApproveNotes('');
                fetchRequests(false);
            }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to approve report'); }
        finally { setSaving(false); }
    };

    const handleRejectReport = async () => {
        if (!approveNotes.trim()) return toast.error('Please write a reason for the vendor');
        try {
            setSaving(true);
            const res = await adminSoilTestService.rejectReport(approveModal._id, approveNotes);
            if (res.success) {
                toast.success('Report sent back to vendor');
                setApproveModal(null);
                setApproveNotes('');
                fetchRequests(false);
            }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to reject report'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure?')) return;
        try {
            const res = await adminSoilTestService.delete(id);
            if (res.success) { toast.success('Request deleted'); fetchRequests(false); }
        } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    };

    const handleDownload = async (url) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', `soil_report_${Date.now()}${isPDF(url) ? '.pdf' : '.jpg'}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(url, '_blank');
        }
    };

    const isPDF = (url) => url?.toLowerCase().includes('.pdf');

    const filteredRequests = requests.filter(req => {
        const lowerSearch = searchTerm.trim().toLowerCase();
        const matchesSearch =
            (req.userId?.name || '').toLowerCase().includes(lowerSearch) ||
            req._id.toLowerCase().includes(lowerSearch);
        const matchesStatus = filterStatus === 'all' || req.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const paidRequests = requests.filter(r => r.paymentStatus === 'paid');
    const txnStats = {
        transactions: paidRequests.length,
        collections: paidRequests.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0),
        revenue: paidRequests.reduce((acc, curr) => acc + (curr.adminCommission || 0), 0),
        payouts: paidRequests.reduce((acc, curr) => acc + (curr.vendorEarning || 0), 0),
    };

    const filteredTransactions = paidRequests.filter(req => {
        const lowerSearch = searchTerm.trim().toLowerCase();
        return (req.userId?.name || '').toLowerCase().includes(lowerSearch) ||
               (req.transactionId || '').toLowerCase().includes(lowerSearch) ||
               req._id.toLowerCase().includes(lowerSearch);
    });

    return (
        <div className="p-8">
            {/* Header: title + Settings button */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Soil Testing</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Review requests, assign labs, and track revenue</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            adminSoilTestService.getSettings().then(res => {
                                if (res.success && res.data) {
                                    setPricing(res.data);
                                    setSettingsForm({
                                        commissionPercentage: res.data.commissionPercentage ?? 10,
                                        testTypes: res.data.testTypes || []
                                    });
                                }
                            }).catch(() => {});
                            setSettingsModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95"
                    >
                        <FiSettings className="w-4 h-4 text-slate-500" />
                        <span>Settings</span>
                    </button>
                </div>
            </div>

            {/* Tabs + filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div className="bg-slate-100 p-1 rounded-lg flex">
                    {[['requests', 'Requests'], ['transactions', 'Transactions']].map(([mode, label]) => (
                        <button key={mode} onClick={() => { setViewMode(mode); setSearchTerm(''); }}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === mode ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input type="text"
                            placeholder={viewMode === 'requests' ? 'Search farmer or request ID' : 'Search farmer or transaction ID'}
                            className="w-72 bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    {viewMode === 'requests' && (
                        <select className="bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm text-slate-700 outline-none focus:border-blue-500"
                            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="assigned">Assigned</option>
                            <option value="sample_collected">Sample Collected</option>
                            <option value="at_lab">At Lab</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    )}
                </div>
            </div>

            {viewMode === 'requests' ? (
                <>
            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            {['Farmer', 'Details', 'Status', 'Report', 'Actions'].map(h => (
                                <th key={h} className="px-5 py-3 text-xs font-medium text-slate-500">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" className="p-16 text-center text-sm text-slate-400">Loading...</td></tr>
                        ) : filteredRequests.length === 0 ? (
                            <tr><td colSpan="5" className="p-16 text-center text-sm text-slate-400">No requests found.</td></tr>
                        ) : filteredRequests.map(req => (
                            <tr key={req._id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
                                <td className="px-5 py-4 align-top">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center">
                                            <FiUser className="text-teal-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-800">{req.userId?.name || 'Unknown'}</p>
                                            <p className="text-xs font-bold text-slate-400">{req.phoneNumber}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-5 py-4 align-top">
                                    <p className="font-bold text-slate-800 text-sm">{req.landSize?.replace(/Arce/g, 'Acre')} — {req.cropType || 'General'}</p>
                                    <p className="text-[10px] font-semibold text-teal-600 mb-1">{req.testType || 'Soil Test'}</p>
                                    <div className="flex items-center gap-1 text-slate-400">
                                        <FiMapPin className="text-[10px]" />
                                        <p className="text-[10px] font-medium truncate max-w-[180px]">{req.location}</p>
                                    </div>
                                    {req.latitude && req.longitude && (
                                        <a href={`https://www.google.com/maps?q=${req.latitude},${req.longitude}`} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md hover:bg-blue-100 transition-colors">
                                            View on Map 🗺️
                                        </a>
                                    )}
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        {new Date(req.createdAt).toLocaleDateString()}
                                        {req.paymentStatus === 'paid' && req.totalAmount > 0 && <span className="ml-1.5 font-bold text-emerald-600">· Paid ₹{req.totalAmount}</span>}
                                    </p>
                                </td>
                                <td className="px-5 py-4 align-top">
                                    <StatusBadge status={req.status} config={STATUS_CONFIG} />
                                    {['cancelled', 'pending'].includes(req.status) && req.rejectionReason && (
                                        <p className="text-[9px] font-bold text-rose-500 mt-2 bg-rose-50 p-2 rounded-lg border border-rose-100 leading-tight">
                                            {req.status === 'pending' ? 'Lab declined: ' : 'Reason: '}{req.rejectionReason}
                                        </p>
                                    )}
                                    {req.vendorId && req.status !== 'cancelled' && (() => {
                                        const vId = typeof req.vendorId === 'object' ? req.vendorId._id || req.vendorId.id : req.vendorId;
                                        const assignedV = vendors.find(v => v._id === vId);
                                        const vName = assignedV ? (assignedV.labDetails?.labName || assignedV.name) : 
                                            (typeof req.vendorId === 'object' && req.vendorId.name ? req.vendorId.name : 'Vendor Assigned');
                                        return (
                                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-bold">
                                                <FiUserCheck className="text-teal-500 flex-shrink-0" /> <span className="truncate">{vName}</span>
                                            </p>
                                        );
                                    })()}
                                </td>
                                <td className="px-5 py-4 align-top">
                                    <div className="flex flex-col gap-2 items-start">
                                        <StatusBadge status={req.reportStatus || 'pending'} config={REPORT_STATUS_CONFIG} />
                                        {req.reportUrl && (
                                            <button 
                                                onClick={() => setPreviewUrl(req.reportUrl)}
                                                className="text-[10px] text-teal-600 font-semibold hover:bg-teal-50 px-2 py-1 rounded-lg border border-teal-100 transition-all flex items-center gap-1">
                                                View Report ↗
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td className="px-5 py-4 align-top">
                                    <div className="flex flex-col gap-2">
                                        {['pending', 'assigned', 'cancelled'].includes(req.status) && (
                                            <button onClick={() => { setAssignModal(req); setSelectedVendorId(req.vendorId?._id || req.vendorId || ''); }}
                                                className="px-3 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <FiUserCheck className="text-xs" /> {['assigned', 'cancelled'].includes(req.status) ? 'Re-assign Lab' : 'Assign Lab'}
                                            </button>
                                        )}
                                        {req.reportStatus === 'uploaded' && (
                                            <button onClick={() => { setApproveModal(req); setApproveNotes(''); }}
                                                className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-semibold active:scale-95 transition-all flex items-center justify-center gap-2">
                                                <FiCheckCircle className="text-xs" /> Review Report
                                            </button>
                                        )}
                                        {req.paymentStatus !== 'paid' && (
                                            <button onClick={() => handleDelete(req._id)}
                                                className="px-3 py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-semibold hover:bg-rose-50 hover:text-rose-500 transition-all flex items-center justify-center gap-2">
                                                <FiTrash2 className="text-xs" /> Delete
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            </>
            ) : (
                <>
                    {/* Transaction Stats */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        {[
                            { label: 'Total Transactions', value: txnStats.transactions, color: 'blue', icon: FiCreditCard, prefix: '' },
                            { label: 'Total Collections', value: txnStats.collections.toFixed(2), color: 'emerald', icon: FiDollarSign, prefix: '₹' },
                            { label: 'Platform Revenue', value: txnStats.revenue.toFixed(2), color: 'teal', icon: FiTrendingUp, prefix: '₹' },
                            { label: 'Vendor Payouts', value: txnStats.payouts.toFixed(2), color: 'orange', icon: FiPieChart, prefix: '₹' },
                        ].map((s, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl border border-slate-200">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl bg-${s.color}-50 flex items-center justify-center`}>
                                        <s.icon className={`text-${s.color}-600 w-6 h-6`} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{s.label}</p>
                                        <p className="text-2xl font-semibold text-slate-800">{s.prefix}{s.value}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>


                    {/* Transactions Table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                    {['Date & Txn ID', 'Farmer Details', 'Payment Method', 'Amounts (₹)'].map(h => (
                                        <th key={h} className="px-5 py-3 text-xs font-medium text-slate-500">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="4" className="p-16 text-center text-sm text-slate-400">Loading...</td></tr>
                                ) : filteredTransactions.length === 0 ? (
                                    <tr><td colSpan="4" className="p-16 text-center text-sm text-slate-400">No transactions found.</td></tr>
                                ) : filteredTransactions.map(req => (
                                    <tr key={req._id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition-colors">
                                        <td className="px-5 py-4 align-top">
                                            <p className="font-semibold text-slate-800">{new Date(req.updatedAt).toLocaleDateString()}</p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{req.transactionId || req._id.slice(-8)}</p>
                                            <span className="inline-block px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[9px] font-semibold uppercase mt-2 border border-emerald-100">Paid ✓</span>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                                                    <FiUser className="text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800">{req.userId?.name || 'Unknown'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">{req.phoneNumber}</p>
                                                    <p className="text-[9px] font-semibold text-blue-600 mt-0.5">REQ: {req._id.slice(-6).toUpperCase()}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                                                    <FiCreditCard className="text-slate-500 w-4 h-4" />
                                                </div>
                                                <p className="font-bold text-slate-700 capitalize">{req.paymentMethod || 'Wallet'}</p>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 align-top">
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-xs w-48">
                                                    <span className="text-slate-400 font-bold">Collected:</span>
                                                    <span className="font-semibold text-slate-800">₹{req.totalAmount?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs w-48 border-b border-slate-100 pb-1.5">
                                                    <span className="text-slate-400 font-bold">Vendor ({req.commissionPercentage ? 100 - req.commissionPercentage : 90}%):</span>
                                                    <span className="font-semibold text-orange-500">₹{req.vendorEarning?.toFixed(2) || '0.00'}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs w-48 pt-0.5">
                                                    <span className="text-teal-600 font-semibold">Platform Cut:</span>
                                                    <span className="font-semibold text-teal-600">₹{req.adminCommission?.toFixed(2) || '0.00'}</span>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ── Assign Vendor Modal ── */}
            <AnimatePresence>
                {assignModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setAssignModal(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 md:p-8 overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 py-2 border-b border-transparent">
                                <h2 className="text-xl font-semibold text-slate-800">Assign Lab Vendor</h2>
                                <button onClick={() => { setAssignModal(null); setFilterByState(false); setFilterByDistrict(false); }} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                                    <FiX />
                                </button>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
                                <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Request Details</p>
                                <p className="font-semibold text-slate-800 text-sm">{assignModal.userId?.name} — {assignModal.landSize}</p>
                                <div className="text-[10px] text-slate-400 flex flex-col gap-1 mt-1">
                                    <p className="flex items-center gap-1"><FiMapPin className="text-[10px]" /> {assignModal.location}</p>
                                    {assignModal.latitude && assignModal.longitude && (
                                        <a href={`https://www.google.com/maps?q=${assignModal.latitude},${assignModal.longitude}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline w-max">
                                            View Field on Map ↗
                                        </a>
                                    )}
                                </div>
                            </div>

                            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-3 ml-1">Location Filters</p>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                <label className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer ${filterByState ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white'}`}>
                                    <input type="checkbox" className="w-4 h-4 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={filterByState} onChange={e => setFilterByState(e.target.checked)} />
                                    <div>
                                        <p className="font-semibold text-slate-800 text-[11px]">Same State Only</p>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Matches State</p>
                                    </div>
                                </label>
                                <label className={`flex items-center gap-3 p-3 rounded-2xl border-2 transition-all cursor-pointer ${filterByDistrict ? 'border-teal-500 bg-teal-50' : 'border-slate-100 bg-white'}`}>
                                    <input type="checkbox" className="w-4 h-4 rounded-lg border-slate-300 text-teal-600 focus:ring-teal-500"
                                        checked={filterByDistrict} onChange={e => setFilterByDistrict(e.target.checked)} />
                                    <div>
                                        <p className="font-semibold text-slate-800 text-[11px]">Same District Only</p>
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Matches City</p>
                                    </div>
                                </label>
                            </div>

                            <div className="flex justify-between items-center mb-3 px-1">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Available Labs</p>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {vendors.filter(v => {
                                        if (!filterByState && !filterByDistrict) return true;
                                        const reqLocParts = (assignModal.location || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
                                        const vState = (v.address?.state || '').toLowerCase().trim();
                                        const vCity = (v.address?.city || '').toLowerCase().trim();
                                        if (filterByState && vState && !reqLocParts.some(p => vState.includes(p) || p.includes(vState))) return false;
                                        if (filterByDistrict && vCity && !reqLocParts.some(p => vCity.includes(p) || p.includes(vCity))) return false;
                                        return true;
                                    }).length} Found
                                </span>
                            </div>

                            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {vendors.length === 0 ? (
                                    <div className="py-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-2">No Lab Vendors</p>
                                        <p className="text-[10px] font-bold text-slate-400">No vendors have been approved as soil labs yet</p>
                                    </div>
                                ) : (
                                    <>
                                        {vendors.filter(v => {
                                            if (!filterByState && !filterByDistrict) return true; // Show all if no filter
                                            const reqLocParts = (assignModal.location || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
                                            const vState = (v.address?.state || '').toLowerCase().trim();
                                            const vCity = (v.address?.city || '').toLowerCase().trim();
                                            
                                            if (filterByState && vState) {
                                                // Check if any part of the request location matches the vendor state
                                                const stateMatches = reqLocParts.some(part => 
                                                    vState.includes(part) || part.includes(vState)
                                                );
                                                if (!stateMatches) return false;
                                            }
                                            if (filterByDistrict && vCity) {
                                                // Check if any part of the request location matches the vendor city
                                                const cityMatches = reqLocParts.some(part => 
                                                    vCity.includes(part) || part.includes(vCity)
                                                );
                                                if (!cityMatches) return false;
                                            }
                                            return true;
                                        }).map(v => (
                                            <div key={v._id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-white hover:shadow-md transition-all group">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800 text-xs truncate">{v.name}</p>
                                                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                                        <FiMapPin className="text-[9px]" /> {v.address?.city || '—'}, {v.address?.state || '—'}
                                                    </p>
                                                    {v.labDetails?.labName && (
                                                        <p className="text-[9px] text-teal-600 font-bold mt-0.5">🧪 {v.labDetails.labName}</p>
                                                    )}
                                                </div>
                                                <button 
                                                    onClick={() => { setSelectedVendorId(v._id); handleAssignVendor(v._id); }}
                                                    disabled={saving}
                                                    className="ml-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-semibold shadow-lg shadow-blue-500/20 active:scale-95 transition-all group-hover:bg-blue-700">
                                                    {saving && selectedVendorId === v._id ? '...' : 'Assign'}
                                                </button>
                                            </div>
                                        ))}

                                        {vendors.filter(v => {
                                            if (!filterByState && !filterByDistrict) return true;
                                            const reqLocParts = (assignModal.location || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
                                            const vState = (v.address?.state || '').toLowerCase().trim();
                                            const vCity = (v.address?.city || '').toLowerCase().trim();
                                            if (filterByState && vState) {
                                                const stateMatches = reqLocParts.some(part => vState.includes(part) || part.includes(vState));
                                                if (!stateMatches) return false;
                                            }
                                            if (filterByDistrict && vCity) {
                                                const cityMatches = reqLocParts.some(part => vCity.includes(part) || part.includes(vCity));
                                                if (!cityMatches) return false;
                                            }
                                            return true;
                                        }).length === 0 && (filterByState || filterByDistrict) && (
                                            <div className="py-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                                                <p className="text-xs font-bold text-slate-400">No matching labs found</p>
                                                <p className="text-[10px] text-slate-300 mt-1">Try relaxing the location filters</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Approve Report Modal ── */}
            <AnimatePresence>
                {approveModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setApproveModal(null)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                            <div className="flex justify-between items-center mb-5 sticky top-0 bg-white z-10 py-2 border-b border-transparent">
                                <h2 className="text-xl font-semibold text-slate-800">Review Report</h2>
                                <button onClick={() => setApproveModal(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors">
                                    <FiX />
                                </button>
                            </div>
                            <div className="bg-emerald-50 rounded-2xl p-4 mb-5 border border-emerald-100 mt-2">
                                <p className="text-[10px] font-semibold text-emerald-600 uppercase mb-1">📄 Vendor Report</p>
                                <a href={approveModal.reportUrl} target="_blank" rel="noreferrer"
                                    className="text-teal-600 font-bold text-sm hover:underline flex items-center gap-1">
                                    View / Download Lab Report ↗
                                </a>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-xl mb-4 space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Farmer paid</span>
                                    <span className="font-semibold text-slate-900">₹{(approveModal.totalAmount || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Admin commission ({approveModal.commissionPercentage || 0}%)</span>
                                    <span className="font-semibold text-slate-900">₹{(approveModal.adminCommission || 0).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                                    <span className="text-slate-500">Vendor wallet credit on approval</span>
                                    <span className="font-semibold text-emerald-600">₹{(approveModal.paymentStatus === 'paid' ? approveModal.vendorEarning || 0 : 0).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="space-y-1 mb-5">
                                <label className="block text-sm font-medium text-slate-700">Remarks</label>
                                <textarea rows="3" placeholder="Approve: optional note for the farmer. Reject: reason for the vendor (required)."
                                    className="w-full border border-slate-200 rounded-xl py-2.5 px-3.5 text-sm outline-none resize-none focus:border-blue-500"
                                    value={approveNotes} onChange={e => setApproveNotes(e.target.value)} />
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleRejectReport} disabled={saving}
                                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 transition-colors disabled:opacity-50">
                                    Reject & Send Back
                                </button>
                                <button onClick={handleApproveReport} disabled={saving}
                                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50">
                                    {saving ? 'Saving...' : 'Approve Report'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            {/* ── Report Preview Modal ── */}
            <AnimatePresence>
                {previewUrl && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setPreviewUrl(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white w-full max-w-5xl h-full max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                            
                            <div className="p-6 flex justify-between items-center border-b border-slate-100">
                                <h2 className="text-xl font-semibold text-slate-800">Report Preview</h2>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => handleDownload(previewUrl)}
                                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all">
                                        Download
                                    </button>
                                    <button onClick={() => setPreviewUrl(null)} className="w-10 h-10 rounded-full bg-slate-100 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-all">
                                        <FiX className="text-xl" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 bg-slate-50 p-4 md:p-8 overflow-auto flex items-center justify-center">
                                {isPDF(previewUrl) ? (
                                    <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full rounded-2xl border-none bg-white shadow-inner" title="PDF Preview" />
                                ) : (
                                    <img src={previewUrl} alt="Report Preview" className="max-w-full max-h-full object-contain rounded-2xl shadow-xl bg-white" />
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Settings Modal ── */}
            <AnimatePresence>
                {settingsModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => !savingSettings && setSettingsModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <FiSettings className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">Soil Testing Settings</h2>
                                        <p className="text-xs text-slate-500">Configure platform commission & dynamic soil test packages</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !savingSettings && setSettingsModalOpen(false)}
                                    className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto space-y-6">
                                {/* Platform Commission Section */}
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-800">Admin Commission Percentage</label>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Cut deducted from each booking. Lab vendor receives remaining {100 - (Number(settingsForm.commissionPercentage) || 0)}% upon report approval.
                                            </p>
                                        </div>
                                        <div className="relative w-28 flex-shrink-0">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-3 pr-7 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500"
                                                value={settingsForm.commissionPercentage}
                                                onChange={e => setSettingsForm({ ...settingsForm, commissionPercentage: e.target.value })}
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Test Packages Section */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900">Soil Test Packages</h3>
                                            <p className="text-xs text-slate-500">Add or edit test packages available to farmers</p>
                                        </div>
                                        {editingTestTypeIndex === null && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTestTypeDraft({
                                                        name: '',
                                                        title: '',
                                                        description: '',
                                                        price: '',
                                                        isActive: true
                                                    });
                                                    setEditingTestTypeIndex(-1); // -1 indicates adding new
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold transition-colors"
                                            >
                                                <FiPlus className="w-3.5 h-3.5" />
                                                <span>Add Test Type</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Add / Edit Form */}
                                    {editingTestTypeIndex !== null && (
                                        <div className="mb-4 bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                                                    {editingTestTypeIndex === -1 ? 'New Test Package' : 'Edit Test Package'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Package Name / Title *</label>
                                                    <input
                                                        type="text"
                                                        placeholder="e.g. Basic Test (3 Parameters - NPK)"
                                                        className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-blue-500"
                                                        value={testTypeDraft.title || testTypeDraft.name}
                                                        onChange={e => setTestTypeDraft({ ...testTypeDraft, title: e.target.value, name: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-600 mb-1">Farmer Price (₹) *</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            placeholder="e.g. 500"
                                                            className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-7 pr-3 text-sm outline-none focus:border-blue-500 font-semibold"
                                                            value={testTypeDraft.price}
                                                            onChange={e => setTestTypeDraft({ ...testTypeDraft, price: e.target.value })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-600 mb-1">Description / Parameters Included</label>
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Tests Nitrogen, Phosphorus, Potassium & Organic Carbon"
                                                    className="w-full bg-white border border-slate-200 rounded-lg py-2 px-3 text-sm outline-none focus:border-blue-500"
                                                    value={testTypeDraft.description}
                                                    onChange={e => setTestTypeDraft({ ...testTypeDraft, description: e.target.value })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between pt-1">
                                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={testTypeDraft.isActive}
                                                        onChange={e => setTestTypeDraft({ ...testTypeDraft, isActive: e.target.checked })}
                                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                    />
                                                    <span>Active (Visible for farmers to select)</span>
                                                </label>
                                                <div className="text-xs text-slate-500">
                                                    Vendor gets: <strong className="text-emerald-600">₹{(Number(testTypeDraft.price || 0) * (1 - (Number(settingsForm.commissionPercentage) || 0) / 100)).toFixed(2)}</strong>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-blue-100">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingTestTypeIndex(null)}
                                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const name = (testTypeDraft.title || testTypeDraft.name || '').trim();
                                                        if (!name) return toast.error('Package name is required');
                                                        const price = Number(testTypeDraft.price);
                                                        if (!Number.isFinite(price) || price < 0) return toast.error('Valid price is required');

                                                        const updatedItem = {
                                                            name,
                                                            title: name,
                                                            description: (testTypeDraft.description || '').trim(),
                                                            price,
                                                            isActive: testTypeDraft.isActive !== false
                                                        };

                                                        let newTypes = [...(settingsForm.testTypes || [])];
                                                        if (editingTestTypeIndex === -1) {
                                                            newTypes.push(updatedItem);
                                                            toast.success(`"${name}" added. Click "Save Settings" below to publish.`);
                                                        } else {
                                                            newTypes[editingTestTypeIndex] = updatedItem;
                                                            toast.success(`"${name}" updated. Click "Save Settings" below to publish.`);
                                                        }
                                                        setSettingsForm({ ...settingsForm, testTypes: newTypes });
                                                        setEditingTestTypeIndex(null);
                                                    }}
                                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                                >
                                                    {editingTestTypeIndex === -1 ? 'Add Package' : 'Update Package'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* List of Test Types */}
                                    <div className="space-y-2">
                                        {(!settingsForm.testTypes || settingsForm.testTypes.length === 0) ? (
                                            <p className="text-center py-6 text-xs text-slate-400 border border-dashed rounded-xl">
                                                No test types configured. Click "+ Add Test Type" to create one.
                                            </p>
                                        ) : (
                                            settingsForm.testTypes.map((type, idx) => {
                                                const price = Number(type.price) || 0;
                                                const commRate = Number(settingsForm.commissionPercentage) || 0;
                                                const vendorAmt = (price * (1 - commRate / 100)).toFixed(2);
                                                const adminAmt = (price * (commRate / 100)).toFixed(2);
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                                                            type.isActive !== false ? 'bg-white border-slate-200 hover:border-slate-300' : 'bg-slate-50 border-slate-200 opacity-60'
                                                        }`}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold text-sm text-slate-900 truncate">
                                                                    {type.title || type.name}
                                                                </span>
                                                                {type.isActive === false && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-600">
                                                                        Inactive
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {type.description && (
                                                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{type.description}</p>
                                                            )}
                                                            <p className="text-[11px] text-slate-400 mt-1">
                                                                Vendor: <span className="font-medium text-emerald-600">₹{vendorAmt}</span> · Commission: <span className="font-medium text-slate-600">₹{adminAmt}</span>
                                                            </p>
                                                        </div>

                                                        <div className="flex items-center gap-3 flex-shrink-0">
                                                            <span className="text-base font-bold text-slate-900">
                                                                ₹{price}
                                                            </span>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setTestTypeDraft({
                                                                            name: type.name || '',
                                                                            title: type.title || type.name || '',
                                                                            description: type.description || '',
                                                                            price: type.price !== undefined ? type.price : '',
                                                                            isActive: type.isActive !== false
                                                                        });
                                                                        setEditingTestTypeIndex(idx);
                                                                    }}
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                    title="Edit Package"
                                                                >
                                                                    <FiEdit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        if (settingsForm.testTypes.length <= 1) {
                                                                            return toast.error('At least one test type package must be configured.');
                                                                        }
                                                                        if (window.confirm(`Delete "${type.title || type.name}" package?`)) {
                                                                            const newTypes = settingsForm.testTypes.filter((_, i) => i !== idx);
                                                                            setSettingsForm({ ...settingsForm, testTypes: newTypes });
                                                                            if (editingTestTypeIndex === idx) setEditingTestTypeIndex(null);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                                    title="Delete Package"
                                                                >
                                                                    <FiTrash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                <p className="text-xs text-slate-500">
                                    Total {settingsForm.testTypes?.length || 0} packages configured
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={savingSettings}
                                        onClick={() => {
                                            setSettingsModalOpen(false);
                                            setEditingTestTypeIndex(null);
                                        }}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={savingSettings}
                                        onClick={handleSaveSettings}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                    >
                                        {savingSettings ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Saving...</span>
                                            </>
                                        ) : (
                                            <span>Save Settings</span>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ManageSoilTests;
