import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiSearch, FiCalendar, FiDownload, FiMoreVertical,
  FiClock, FiCheckCircle, FiBox, FiTruck, FiXCircle, FiRefreshCw, FiShoppingBag,
  FiNavigation, FiTrash2
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { adminBookingService } from '../../../../services/adminBookingService';
import adminVendorService from '../../../../services/adminVendorService';
import { getDashboardStats } from '../../../../services/adminDashboardService';
import BookingTrackingModal from './components/BookingTrackingModal';
import { bookingItems, paymentInfo, PAYMENT_TONES, titleCase } from './bookingDisplay';

const BookingStatsCard = ({ title, count, icon: Icon, colorClass, bgClass }) => (
  <div className={`px-2.5 py-2 rounded-lg border border-gray-100 shadow-sm flex items-center gap-2 min-w-0 ${bgClass}`}>
    <div className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center ${colorClass.replace('text-', 'bg-').replace('600', '100')}`}>
      <Icon className={`w-3 h-3 ${colorClass}`} />
    </div>
    <div className="min-w-0">
      <h3 className="text-gray-500 text-[9px] font-bold uppercase tracking-wider truncate">{title}</h3>
      <p className="text-sm font-bold text-gray-800 leading-tight">{count}</p>
    </div>
  </div>
);

const PAGE_SIZE = 15;
const isDeletable = (b) => ['completed', 'cancelled', 'rejected'].includes(b.status?.toLowerCase());

const Bookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrackingBooking, setSelectedTrackingBooking] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [moduleFilter, setModuleFilter] = useState('All Types');
  const [vendorFilter, setVendorFilter] = useState('');
  const [vendors, setVendors] = useState([]);

  // Vendor list for the "bookings of one vendor" filter (loaded once)
  useEffect(() => {
    adminVendorService.getAllVendors({ limit: 500 })
      .then(res => setVendors((res?.data || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))))
      .catch(() => {});
  }, []);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMatching, setTotalMatching] = useState(0);

  // Selection for delete (only finished bookings can be deleted; backend enforces it too)
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    pending: 0,
    confirmed: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    total: 0
  });

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Load Data
  const fetchData = async (refreshStats = false) => {
    try {
      setLoading(true);
      setSelectedIds([]);

      // 1. Fetch Bookings
      const params = {
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch.trim(),
        startDate,
        endDate
      };
      if (statusFilter !== 'All Status') {
        params.status = statusFilter;
      }
      
      if (vendorFilter) params.vendorId = vendorFilter;
      if (moduleFilter === 'Hourly Rent') params.rental_type = 'hourly';
      if (moduleFilter === 'Minute Rent') params.rental_type = 'minute';
      if (moduleFilter === 'Acre Rent') params.rental_type = 'acre';
      if (moduleFilter === 'Bigha Rent') params.rental_type = 'bigha';
      if (moduleFilter === 'Monthly Rent') params.rental_type = 'monthly';

      const res = await adminBookingService.getAllBookings(params);
      if (res.success) {
        setBookings(res.data);
        setTotalPages(res.pagination.pages);
        setTotalMatching(res.pagination.total);
      }

      // 2. Fetch Stats (first load, or after a delete)
      if (refreshStats || stats.total === 0) {
        const statsRes = await getDashboardStats();
        if (statsRes.success) {
          const s = statsRes.data.stats;
          setStats({
            pending: s.pendingBookings || 0,
            confirmed: 0,
            inProgress: 0,
            completed: s.completedBookings || 0,
            cancelled: s.cancelledBookings || 0,
            total: s.totalBookings || 0
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, debouncedSearch, statusFilter, moduleFilter, vendorFilter, startDate, endDate]);

  const deletableOnPage = bookings.filter(isDeletable).map(b => b._id);
  const allSelected = deletableOnPage.length > 0 && deletableOnPage.every(id => selectedIds.includes(id));
  const toggleSelect = (id) => setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const toggleSelectAll = () => setSelectedIds(allSelected ? [] : deletableOnPage);

  const handleDelete = async (ids) => {
    const label = ids.length === 1
      ? `booking #${bookings.find(b => b._id === ids[0])?.bookingNumber || ''}`
      : `${ids.length} bookings`;
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.\n\nThe vendor's earnings and cash dues from ${ids.length === 1 ? 'this booking' : 'these bookings'} will be reversed in their wallet.`)) return;

    try {
      setDeleting(true);
      const res = await adminBookingService.bulkDeleteBookings(ids);
      if (res.deleted?.length) toast.success(`${res.deleted.length} booking${res.deleted.length > 1 ? 's' : ''} deleted`);
      if (res.skipped?.length) {
        toast.error(res.skipped.map(s => `#${s.bookingNumber}: ${s.reason}`).join('\n'), { duration: 6000 });
      }
      // Step back a page if this one is now empty
      if (res.deleted?.length === bookings.length && page > 1) setPage(p => p - 1);
      else fetchData(true);
    } catch (error) {
      toast.error(error.message || 'Failed to delete bookings');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    const headers = ['Order ID', 'Farmer', 'Vendor', 'Vendor Phone', 'Equipment', 'Total', 'Payment', 'Status', 'Date'];
    const rows = bookings.map(b => [
      b.bookingNumber,
      b.userId?.name || 'Unknown',
      b.vendorId?.name || b.vendorId?.businessName || '',
      b.vendorId?.phone || '',
      bookingItems(b).main,
      b.finalAmount,
      `${paymentInfo(b).label} - ${paymentInfo(b).detail}`,
      b.status,
      new Date(b.createdAt).toLocaleDateString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "bookings.csv");
    document.body.appendChild(link);
    link.click();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        <BookingStatsCard title="Awaiting" count={stats.pending} icon={FiClock} bgClass="bg-yellow-50" colorClass="text-yellow-600" />
        <BookingStatsCard title="Confirmed" count={stats.pending} icon={FiCheckCircle} bgClass="bg-blue-50" colorClass="text-blue-600" />
        <BookingStatsCard title="In Progress" count={stats.inProgress} icon={FiBox} bgClass="bg-purple-50" colorClass="text-purple-600" />
        <BookingStatsCard title="Completed" count={stats.completed} icon={FiTruck} bgClass="bg-green-50" colorClass="text-green-600" />
        <BookingStatsCard title="Delivered" count={stats.completed} icon={FiCheckCircle} bgClass="bg-emerald-50" colorClass="text-emerald-600" />
        <BookingStatsCard title="Cancelled" count={stats.cancelled} icon={FiXCircle} bgClass="bg-red-50" colorClass="text-red-600" />
        <BookingStatsCard title="Returned" count={0} icon={FiRefreshCw} bgClass="bg-orange-50" colorClass="text-orange-600" />
        <BookingStatsCard title="Total Orders" count={stats.total} icon={FiShoppingBag} bgClass="bg-gray-50" colorClass="text-gray-600" />
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-3 justify-between items-center">
        <div className="relative w-full lg:w-80">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search bookings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-green-500 cursor-pointer"
          >
            <option>All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={vendorFilter}
            onChange={(e) => { setVendorFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:border-green-500 cursor-pointer max-w-[200px]"
            title="Show bookings of one vendor"
          >
            <option value="">All Vendors</option>
            {vendors.map(v => (
              <option key={v._id} value={v._id}>
                {v.name || v.businessName}{v.name && v.businessName ? ` (${v.businessName})` : ''}
              </option>
            ))}
          </select>

          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-blue-600 font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-sm"
          >
            <option>All Types</option>
            <option value="Hourly Rent">🚜 Hourly Rent</option>
            <option value="Minute Rent">⏱️ Minute Rent</option>
            <option value="Acre Rent">🌾 Acre Rent</option>
            <option value="Bigha Rent">🌱 Bigha Rent</option>
            <option value="Monthly Rent">📅 Monthly Rent</option>
          </select>

          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-[11px] text-gray-600 focus:outline-none w-20"
            />
            <span className="text-gray-400 text-[10px]">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-[11px] text-gray-600 focus:outline-none w-20"
            />
          </div>

          <button
            onClick={fetchData}
            className="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition-colors"
            title="Refresh Data"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {selectedIds.length > 0 && (
            <button
              onClick={() => handleDelete(selectedIds)}
              disabled={deleting}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <FiTrash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : `Delete selected (${selectedIds.length})`}
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm shadow-green-200"
          >
            <FiDownload className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="pl-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    disabled={loading || deletableOnPage.length === 0}
                    aria-label="Select all finished bookings on this page"
                    title="Select all finished bookings on this page"
                    className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer disabled:cursor-not-allowed"
                  />
                </th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Farmer</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Items</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total (₹)</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Order Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-xs text-gray-500">Loading bookings...</td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-8 text-center text-xs text-gray-500">No bookings found</td>
                </tr>
              ) : (
                bookings.map((booking) => (
                  <tr key={booking._id} className={`transition-colors ${selectedIds.includes(booking._id) ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>
                    <td className="pl-4 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(booking._id)}
                        onChange={() => toggleSelect(booking._id)}
                        disabled={!isDeletable(booking)}
                        aria-label={`Select booking ${booking.bookingNumber}`}
                        title={isDeletable(booking) ? 'Select' : 'Only completed/cancelled bookings can be deleted'}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/admin/bookings/${booking._id}`}>
                        <span className="font-bold text-blue-600 hover:underline text-xs cursor-pointer">
                          #{booking.bookingNumber || booking._id.slice(-6).toUpperCase()}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-bold text-gray-900 text-xs">{booking.userId?.name || 'Guest'}</p>
                        <p className="text-[10px] text-gray-400">{booking.userId?.phone || booking.customerPhone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {booking.vendorId ? (
                        <div>
                          <p className="font-bold text-gray-900 text-xs">{booking.vendorId.name || booking.vendorId.businessName}</p>
                          <p className="text-[10px] text-gray-400">
                            {booking.vendorId.phone}
                            {booking.vendorId.name && booking.vendorId.businessName && ` · ${booking.vendorId.businessName}`}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-400">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {(() => {
                        const { main, sub } = bookingItems(booking);
                        const rentalLabel = booking.rental_type === 'minute' ? 'Min'
                          : booking.rental_type === 'hourly' ? 'Hr'
                          : booking.rental_type === 'acre' ? 'Acre'
                          : booking.rental_type === 'bigha' ? 'Bigha'
                          : booking.rental_type ? titleCase(booking.rental_type) : null;
                        return (
                          <div className="min-w-0" title={[main, sub].filter(Boolean).join(' — ')}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-gray-900 text-xs truncate">{main}</p>
                              {rentalLabel && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 uppercase">
                                  {rentalLabel}
                                </span>
                              )}
                            </div>
                            {sub && <p className="text-[10px] text-gray-500 truncate">{sub}</p>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-gray-900 text-xs">₹{booking.finalAmount?.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider
                            ${booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                          booking.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          booking.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                            booking.status === 'in_progress' ? 'bg-purple-100 text-purple-700' :
                              'bg-yellow-100 text-yellow-700'}`}>
                        {booking.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const p = paymentInfo(booking);
                        return (
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${PAYMENT_TONES[p.tone]}`}>{p.label}</span>
                            <p className="text-[10px] text-gray-500 mt-0.5">{p.detail}</p>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] text-gray-600 font-medium">
                        {new Date(booking.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedTrackingBooking(booking)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition-all border border-blue-200 shadow-sm active:scale-95"
                          title="Track Booking Progress"
                        >
                          <FiNavigation className="w-3.5 h-3.5" />
                          Track
                        </button>
                        <button
                          onClick={() => handleDelete([booking._id])}
                          disabled={deleting || !isDeletable(booking)}
                          className="p-1.5 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={isDeletable(booking) ? 'Delete booking' : 'Only completed/cancelled bookings can be deleted'}
                          aria-label={`Delete booking ${booking.bookingNumber}`}
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && bookings.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
              Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + bookings.length} of {totalMatching} entries
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-bold mr-1">Page {page} of {Math.max(totalPages, 1)}</span>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-50 hover:bg-white transition-all"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-50 hover:bg-white transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking Tracking Modal */}
      <BookingTrackingModal
        isOpen={!!selectedTrackingBooking}
        onClose={() => setSelectedTrackingBooking(null)}
        booking={selectedTrackingBooking}
      />
    </motion.div>
  );
};

export default Bookings;
