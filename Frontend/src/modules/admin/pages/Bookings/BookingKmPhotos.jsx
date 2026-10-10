import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCamera, FiSearch, FiEye, FiRefreshCw, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { adminBookingService } from '../../../../services/adminBookingService';
import CardShell from '../UserCategories/components/CardShell';
import Modal from '../UserCategories/components/Modal';

const PhotoCard = ({ src, label, missing = false }) => {
    if (missing || !src) {
        return (
            <div className="flex flex-col items-center justify-center h-36 bg-red-50 rounded-xl border-2 border-dashed border-red-200">
                <FiAlertTriangle className="w-6 h-6 text-red-400 mb-1" />
                <p className="text-[10px] font-bold text-red-500">{label}</p>
                <p className="text-[9px] text-red-400">Not uploaded</p>
            </div>
        );
    }
    return (
        <div>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
            <img src={src} alt={label} className="w-full h-36 object-cover rounded-xl border-2 border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(src, '_blank')} />
            <p className="text-[9px] text-blue-600 mt-1 cursor-pointer" onClick={() => window.open(src, '_blank')}>
                🔍 View Full Size
            </p>
        </div>
    );
};

const BookingKmPhotos = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');    // 'all' | 'missing' | 'complete'
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const loadBookings = async () => {
        try {
            setLoading(true);
            const res = await adminBookingService.getAllBookings({
                page, limit: 50,
                status: 'completed,in_progress,work_done,journey_started,visited,confirmed,assigned'
            });
            if (res.success) {
                setBookings(res.data);
                setTotalPages(res.pagination?.pages || 1);
            }
        } catch (err) {
            toast.error('Failed to load bookings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadBookings(); }, [page]);

    const filteredBookings = bookings.filter(b => {
        const hasStart = !!b.start_kilometer_photo;
        const hasEnd = !!b.end_kilometer_photo;

        const matchSearch = (b.bookingNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (b.userId?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (b.serviceName || b.serviceId?.title || b.serviceCategory || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchFilter =
            filterType === 'all' ? true :
                filterType === 'complete' ? (hasStart && hasEnd) :
                    filterType === 'missing' ? (!hasStart || !hasEnd) : true;

        return matchSearch && matchFilter;
    });

    const completeCount = bookings.filter(b => b.start_kilometer_photo && b.end_kilometer_photo).length;
    const missingCount = bookings.filter(b => !b.start_kilometer_photo || !b.end_kilometer_photo).length;

    return (
        <div className="space-y-4">
            <CardShell icon={FiCamera} title="KM Photo Monitoring"
                subtitle="Verify driver's start & end kilometer photos to prevent fraud">

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                        <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Total Tracked</div>
                        <div className="text-2xl font-bold text-blue-900">{bookings.length}</div>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                        <FiCheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
                        <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-0.5">Both Photos</div>
                        <div className="text-2xl font-bold text-green-900">{completeCount}</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                        <FiAlertTriangle className="w-4 h-4 text-red-500 mx-auto mb-1" />
                        <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-0.5">Missing Photo</div>
                        <div className="text-2xl font-bold text-red-900">{missingCount}</div>
                    </div>
                </div>

                {/* Search + Filter */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input type="text" placeholder="Search by booking ID or farmer..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-xs"
                        />
                    </div>
                    <div className="flex gap-1.5">
                        {[
                            { val: 'all', label: 'All' },
                            { val: 'complete', label: '✅ Complete' },
                            { val: 'missing', label: '⚠️ Missing' },
                        ].map(f => (
                            <button key={f.val} onClick={() => setFilterType(f.val)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${filterType === f.val ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                {f.label}
                            </button>
                        ))}
                        <button onClick={loadBookings} className="px-3 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
                            <FiRefreshCw className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Booking</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Farmer</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Equipment</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Start KM Photo</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">End KM Photo</th>
                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loading ? (
                                    <tr><td colSpan="6" className="px-4 py-8 text-center text-xs text-gray-500">Loading bookings...</td></tr>
                                ) : filteredBookings.length === 0 ? (
                                    <tr><td colSpan="6" className="px-4 py-8 text-center text-xs text-gray-500">No bookings found</td></tr>
                                ) : filteredBookings.map(booking => {
                                    const hasStart = !!booking.start_kilometer_photo;
                                    const hasEnd = !!booking.end_kilometer_photo;
                                    const allGood = hasStart && hasEnd;
                                    return (
                                        <motion.tr key={booking._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                            className={`hover:bg-gray-50 transition-colors ${!allGood ? 'bg-red-50/30' : ''}`}>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-gray-900 text-xs">#{booking.bookingNumber || booking._id?.slice(-6).toUpperCase()}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-gray-900 text-xs">{booking.userId?.name || 'Customer'}</p>
                                                <p className="text-[10px] text-gray-400">{booking.userId?.phone || 'N/A'}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-xs text-gray-700 font-medium">{booking.serviceName || booking.serviceId?.title || booking.serviceCategory || 'Equipment Rental'}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                {hasStart
                                                    ? <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold"><FiCheckCircle className="w-3 h-3" /> Uploaded</span>
                                                    : <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold"><FiAlertTriangle className="w-3 h-3" /> Missing</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3">
                                                {hasEnd
                                                    ? <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold"><FiCheckCircle className="w-3 h-3" /> Uploaded</span>
                                                    : <span className="flex items-center gap-1 text-[10px] text-red-500 font-bold"><FiAlertTriangle className="w-3 h-3" /> Missing</span>
                                                }
                                            </td>
                                            <td className="px-4 py-3">
                                                <button onClick={() => { setSelectedBooking(booking); setModalOpen(true); }}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="View Photos">
                                                    <FiEye className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {!loading && filteredBookings.length > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
                            <p className="text-[10px] text-gray-500 font-bold uppercase">Page {page} of {totalPages}</p>
                            <div className="flex gap-1.5">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-50 hover:bg-white transition-all">
                                    Prev
                                </button>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-50 hover:bg-white transition-all">
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </CardShell>

            {/* KM Photo Detail Modal */}
            <Modal isOpen={modalOpen} onClose={() => { setModalOpen(false); setSelectedBooking(null); }}
                title="KM Photo Verification" size="lg">
                {selectedBooking && (
                    <div className="space-y-5">
                        {/* Booking Info */}
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-gray-500 font-semibold">Booking ID:</span>
                                    <span className="ml-2 font-bold text-gray-900">#{selectedBooking.bookingNumber}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 font-semibold">Equipment:</span>
                                    <span className="ml-2 font-bold text-gray-900">{selectedBooking.serviceName || selectedBooking.serviceId?.title || selectedBooking.serviceCategory || 'Equipment Rental'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 font-semibold">Farmer:</span>
                                    <span className="ml-2 font-bold text-gray-900">{selectedBooking.userId?.name || 'Customer'}</span>
                                </div>
                                <div>
                                    <span className="text-gray-500 font-semibold">Amount:</span>
                                    <span className="ml-2 font-bold text-green-700">₹{(selectedBooking.finalAmount || selectedBooking.price || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* KM Photos */}
                        <div className="grid grid-cols-2 gap-4">
                            <PhotoCard src={selectedBooking.start_kilometer_photo} label="🚜 Start KM Photo"
                                missing={!selectedBooking.start_kilometer_photo} />
                            <PhotoCard src={selectedBooking.end_kilometer_photo} label="🏁 End KM Photo"
                                missing={!selectedBooking.end_kilometer_photo} />
                        </div>

                        {/* Fraud Alert Banner */}
                        {(!selectedBooking.start_kilometer_photo || !selectedBooking.end_kilometer_photo) && (
                            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                                <FiAlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                                <div>
                                    <p className="text-xs font-bold text-red-700">⚠️ Incomplete Verification</p>
                                    <p className="text-[10px] text-red-600">
                                        {!selectedBooking.start_kilometer_photo && !selectedBooking.end_kilometer_photo
                                            ? 'Both start and end KM photos are missing.'
                                            : !selectedBooking.start_kilometer_photo
                                                ? 'Start KM photo is missing. Driver may not have documented correctly.'
                                                : 'End KM photo is missing. Work completion could not be verified.'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {selectedBooking.start_kilometer_photo && selectedBooking.end_kilometer_photo && (
                            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                                <FiCheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                <p className="text-xs font-semibold text-green-700">✅ Both KM photos verified. Trip looks legitimate.</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default BookingKmPhotos;
