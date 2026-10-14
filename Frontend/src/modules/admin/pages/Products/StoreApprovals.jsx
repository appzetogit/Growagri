import React, { useState, useEffect } from 'react';
import { FiCheck, FiX, FiExternalLink, FiFileText, FiInbox } from 'react-icons/fi';
import api from '../../../../services/api';
import { toast } from 'react-hot-toast';

const isPdf = (url) => url?.toLowerCase().includes('.pdf');

const StoreApprovals = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actingId, setActingId] = useState(null);

    const statusOf = (req) => req.shopDetails?.storeApprovalStatus;
    const visible = requests; // API returns pending registrations only
    const STATUS_BADGE = {
        pending: 'bg-amber-50 text-amber-700 border-amber-100',
        approved: 'bg-green-50 text-green-700 border-green-100',
        rejected: 'bg-red-50 text-red-700 border-red-100'
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await api.get('/admin/vendors/shop-approvals');
            if (res.data.success) setRequests(res.data.data);
        } catch {
            toast.error('Failed to load shop approvals');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (req, status) => {
        let remarks = '';
        if (status === 'rejected') {
            remarks = window.prompt(`Reason for rejecting "${req.shopDetails?.shopName}" (sent to the vendor):`);
            if (remarks === null) return; // cancelled
        }
        try {
            setActingId(req._id);
            const res = await api.post(`/admin/vendors/shop-approvals/${req._id}`, { status, remarks });
            if (res.data.success) {
                toast.success(`Shop ${status} successfully`);
                fetchRequests();
            }
        } catch {
            toast.error('Action failed');
        } finally {
            setActingId(null);
        }
    };

    const th = 'px-4 py-3 text-xs font-medium text-gray-500 whitespace-nowrap';

    return (
        <div className="p-6">
            <div className="flex items-end justify-between mb-4">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">Shop Registration Requests</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Approve or reject vendor agri-store registrations</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 border-[3px] border-gray-200 border-t-green-600 rounded-full animate-spin" />
                    </div>
                ) : visible.length === 0 ? (
                    <div className="py-16 text-center">
                        <FiInbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No pending shop registrations</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[1000px]">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className={th}>Shop</th>
                                    <th className={th}>Vendor</th>
                                    <th className={th}>Shop Address</th>
                                    <th className={th}>License</th>
                                    <th className={th}>Status</th>
                                    <th className={`${th} text-right`}>Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visible.map(req => {
                                    const shop = req.shopDetails || {};
                                    const busy = actingId === req._id;
                                    const status = statusOf(req);
                                    return (
                                        <tr key={req._id} className="hover:bg-gray-50/60 align-top">
                                            <td className="px-4 py-3">
                                                <p className="text-sm font-medium text-gray-900">{shop.shopName || '—'}</p>
                                                {req.businessName && <p className="text-xs text-gray-500">{req.businessName}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-sm text-gray-900">{req.name}</p>
                                                <p className="text-xs text-gray-500">{req.phone}</p>
                                            </td>
                                            <td className="px-4 py-3 max-w-xs">
                                                <p className="text-sm text-gray-700 line-clamp-2" title={shop.shopAddress}>{shop.shopAddress || '—'}</p>
                                                {shop.shopLocation?.lat && (
                                                    <a href={`https://www.google.com/maps?q=${shop.shopLocation.lat},${shop.shopLocation.lng}`}
                                                        target="_blank" rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline">
                                                        View on map <FiExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {shop.licenseDocument && (
                                                        <a href={shop.licenseDocument} target="_blank" rel="noopener noreferrer" title="Open license document"
                                                            className="w-12 h-12 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50 flex-shrink-0">
                                                            {isPdf(shop.licenseDocument)
                                                                ? <FiFileText className="text-gray-400" />
                                                                : <img src={shop.licenseDocument} alt="License" className="w-full h-full object-cover" />}
                                                        </a>
                                                    )}
                                                    <div>
                                                        <p className="text-sm font-mono text-gray-900">{shop.shopLicense || 'N/A'}</p>
                                                        {shop.licenseDocument
                                                            ? <a href={shop.licenseDocument} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">View document</a>
                                                            : <p className="text-xs text-gray-400">No document</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 max-w-[200px]">
                                                <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-medium capitalize ${STATUS_BADGE[status] || ''}`}>{status}</span>
                                                {status === 'rejected' && shop.remarks && (
                                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2" title={shop.remarks}>{shop.remarks}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-end gap-2">
                                                    {status !== 'rejected' && (
                                                        <button onClick={() => handleAction(req, 'rejected')} disabled={busy}
                                                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                                            <FiX className="w-4 h-4" /> Reject
                                                        </button>
                                                    )}
                                                    {status !== 'approved' && (
                                                        <button onClick={() => handleAction(req, 'approved')} disabled={busy}
                                                            className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                                                            <FiCheck className="w-4 h-4" /> Approve
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StoreApprovals;
