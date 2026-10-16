import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    FiChevronLeft, 
    FiPackage, 
    FiTruck, 
    FiCheckCircle, 
    FiUser,
    FiPhone,
    FiMapPin,
    FiSearch
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import vendorProductService from '../../services/vendorProductService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion'; // eslint-disable-line no-unused-vars
import { format } from 'date-fns';

const StoreOrders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all'); // all, ordered, packed, shipped, delivered
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery]);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await vendorProductService.getMyOrders();
            if (res.success) setOrders(res.data || []);
        } catch {
            toast.error("Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (orderId, status, extra = {}) => {
        try {
            const res = await vendorProductService.updateOrderStatus(orderId, { status, ...extra });
            if (res.success) {
                toast.success(res.message || `Order marked as ${status}`);
                fetchOrders();
                return true;
            } else {
                toast.error(res.message || "Status update failed");
                return false;
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || "Status update failed";
            toast.error(errorMsg);
            return false;
        }
    };

    const filteredOrders = orders.filter(o => {
        const matchesTab = activeTab === 'all' || o.deliveryStatus === activeTab;
        if (!matchesTab) return false;

        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        
        const matchesId = o._id?.toLowerCase().includes(query);
        const matchesName = o.userId?.name?.toLowerCase().includes(query);
        const matchesPhone = o.userId?.phone?.toLowerCase().includes(query);
        const matchesItems = o.items?.some(item => item.name?.toLowerCase().includes(query));

        return matchesId || matchesName || matchesPhone || matchesItems;
    });

    const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
    const paginatedOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-100 flex items-center px-4 py-4 gap-4">
                <button onClick={() => navigate(-1)} className="p-2 bg-slate-100 rounded-xl">
                    <FiChevronLeft className="w-6 h-6 text-slate-600" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-black text-slate-800 leading-tight">Store Orders</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fulfillment Tracking</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white px-6 pt-2 border-b border-slate-100 sticky top-[73px] z-30">
                <div className="flex gap-6 overflow-x-auto scrollbar-hide">
                    {['all', 'ordered', 'packed', 'shipped', 'delivered', 'cancelled'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${
                                activeTab === tab ? 'text-[#2E7D32]' : 'text-slate-400'
                            }`}
                        >
                            {tab}
                            {activeTab === tab && (
                                <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#2E7D32] rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-4 md:p-6 pb-24">
                {/* Search Bar */}
                {(!loading || orders.length > 0) && (
                    <div className="mb-6 max-w-md">
                        <div className="relative">
                            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search orders (ID, customer name, phone, item)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/20 focus:border-[#2E7D32] transition-all text-xs font-bold text-slate-800 placeholder-slate-400"
                            />
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="py-20 flex justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#2E7D32] rounded-full animate-spin" /></div>
                ) : filteredOrders.length === 0 ? (
                    <div className="bg-white p-12 rounded-[40px] text-center border-2 border-dashed border-slate-100">
                        <FiPackage className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="font-black text-slate-400 uppercase text-xs tracking-widest">
                            {searchQuery.trim() ? `No orders matching "${searchQuery}"` : `No ${activeTab} orders`}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {paginatedOrders.map(order => {
                            const actualPaid = order.pricing?.orderTotal || (order.pricing?.itemsTotal + (order.pricing?.shippingCharges || 0)) || 0;
                            const fullAddress = typeof order.shippingAddress === 'object' && order.shippingAddress ? (() => {
                                const a = order.shippingAddress;
                                const parts = [
                                    a.addressLine1,
                                    a.city,
                                    a.state,
                                    a.pincode
                                ].filter(Boolean);
                                return parts.length > 0 ? parts.join(', ') : 'No Address';
                            })() : (order.shippingAddress || 'No Address');

                            const customerName = order.userId?.name || order.shippingAddress?.name || 'Customer';
                            const customerPhone = order.userId?.phone || order.shippingAddress?.phone || null;

                            return (
                                <div 
                                    key={order._id} 
                                    className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 hover:shadow-md transition-all space-y-4"
                                >
                                    {/* Card Header: Order ID, Date & Status Badges */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-xl">
                                                #{order._id.slice(-6).toUpperCase()}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-bold">
                                                {format(new Date(order.createdAt), 'dd MMM, hh:mm a')}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {/* Payment Type Badge */}
                                            {order.paymentType === 'cod' ? (
                                                <span className="text-[9px] font-black text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                    Cash On Delivery
                                                </span>
                                            ) : order.paymentMethod === 'wallet' || order.paymentType === 'wallet' ? (
                                                <span className="text-[9px] font-black text-purple-700 bg-purple-50 border border-purple-200/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                    Paid via Wallet
                                                </span>
                                            ) : order.paymentType === 'online_full' ? (
                                                <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                    Paid Online
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                    Platform Fee Paid
                                                </span>
                                            )}

                                            {/* Delivery Status Badge */}
                                            {order.deliveryStatus === 'cancelled' && (
                                                <span className="text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Cancelled
                                                </span>
                                            )}
                                            {order.deliveryStatus === 'ordered' && (
                                                <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                    Ordered
                                                </span>
                                            )}
                                            {order.deliveryStatus === 'packed' && (
                                                <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                    Packed
                                                </span>
                                            )}
                                            {order.deliveryStatus === 'shipped' && (
                                                <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                                    Shipped
                                                </span>
                                            )}
                                            {order.deliveryStatus === 'delivered' && (
                                                <span className="text-[9px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                                                    <FiCheckCircle className="w-3 h-3" /> Delivered
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Middle Section: Items Summary & Actual Price Paid */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className="w-12 h-12 bg-emerald-50 text-[#2E7D32] rounded-2xl flex items-center justify-center flex-shrink-0 border border-emerald-100">
                                                <FiPackage className="w-6 h-6" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-base font-black text-slate-800 truncate leading-tight">
                                                    {order.items[0]?.name || 'Item'} {order.items?.length > 1 && `(+${order.items.length - 1} more)`}
                                                </h4>
                                                <p className="text-xs text-slate-500 font-bold mt-1">
                                                    Qty: {order.items[0]?.quantity || 1} {order.items[0]?.productId?.unit || 'bag'}{order.items[0]?.quantity > 1 ? 's' : ''}
                                                    {order.items[0]?.bagWeight ? ` • ${order.items[0]?.bagWeight}kg` : ''}
                                                </p>
                                                {order.trackingDetails?.courierName && (
                                                    <div className="mt-2 bg-slate-50 border border-slate-100 p-2 rounded-xl inline-block text-[10px]">
                                                        <p className="font-black text-slate-700 uppercase">{order.trackingDetails.courierName}</p>
                                                        <p className="font-mono text-slate-500 font-bold tracking-wider">{order.trackingDetails.trackingNumber}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actual Price Paid by Customer */}
                                        <div className="text-right flex-shrink-0">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Paid</p>
                                            <p className="text-xl sm:text-2xl font-black text-[#2E7D32] font-sans">
                                                ₹{actualPaid}
                                            </p>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                                                {order.paymentType === 'cod' ? 'To Collect in Cash' : 'Paid in Full'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Customer & Address Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-50 bg-slate-50/60 p-3.5 rounded-2xl">
                                        {/* Customer Details */}
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                                <FiUser className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                                <span>{customerName}</span>
                                            </div>
                                            {customerPhone && (
                                                <a 
                                                    href={`tel:${customerPhone}`}
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline cursor-pointer"
                                                >
                                                    <FiPhone className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                                                    <span>{customerPhone}</span>
                                                </a>
                                            )}
                                        </div>

                                        {/* Delivery Address */}
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Delivery Address</p>
                                            <div className="flex items-start gap-1.5 text-xs font-medium text-slate-600">
                                                <FiMapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                                                <span className="line-clamp-2 leading-relaxed">
                                                    {fullAddress}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Button Section */}
                                    <div className="pt-1">
                                        {order.deliveryStatus === 'cancelled' && (
                                            <div className="w-full py-3 bg-rose-50 text-rose-700 rounded-2xl text-xs font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5 border border-rose-100">
                                                <span className="w-2 h-2 rounded-full bg-rose-500" /> Order Cancelled
                                            </div>
                                        )}
                                        {order.deliveryStatus === 'ordered' && (
                                            <button 
                                                onClick={() => handleUpdateStatus(order._id, 'packed')}
                                                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                Pack Order
                                            </button>
                                        )}
                                        {order.deliveryStatus === 'packed' && (
                                            <button 
                                                onClick={() => handleUpdateStatus(order._id, 'shipped')}
                                                className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                <FiTruck className="w-4 h-4" /> Mark as Shipped
                                            </button>
                                        )}
                                        {order.deliveryStatus === 'shipped' && (
                                            <DeliveryOtpModal 
                                                onConfirm={(otpData) => handleUpdateStatus(order._id, 'delivered', otpData)} 
                                                isCod={order.paymentType === 'cod'} 
                                                amount={actualPaid}
                                            />
                                        )}
                                        {order.deliveryStatus === 'delivered' && (
                                            <div className="w-full py-3 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-black uppercase tracking-wider text-center flex items-center justify-center gap-1.5 border border-emerald-100">
                                                <FiCheckCircle className="w-4 h-4 text-emerald-600" /> Order Completed & Delivered
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                
                {/* Pagination Controls */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-6">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-50 text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                        >
                            Previous
                        </button>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                            Page {currentPage} of {totalPages}
                        </span>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold disabled:opacity-50 text-[10px] uppercase tracking-widest active:scale-95 transition-all shadow-sm"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};


// Helper component for Delivery OTP
const DeliveryOtpModal = ({ onConfirm, isCod, amount }) => {
    const [show, setShow] = useState(false);
    const [otp, setOtp] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    useEffect(() => {
        if (show) document.body.style.overflow = 'hidden';
        else document.body.style.overflow = 'unset';
        return () => { document.body.style.overflow = 'unset'; }
    }, [show]);

    const handleVerify = async () => {
        if (otp.length !== 4) {
            toast.error("Please enter a valid 4-digit OTP");
            return;
        }

        try {
            setIsVerifying(true);
            const success = await onConfirm({ deliveryOtp: otp });
            if (success) {
                setShow(false);
                setOtp('');
            }
        } catch (error) {
            console.error("OTP Verification Error:", error);
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <>
            <button 
                onClick={() => setShow(true)}
                className={`px-4 py-3 ${isCod ? 'bg-orange-500 shadow-orange-500/20' : 'bg-green-600 shadow-green-600/20'} text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all w-full min-w-[160px] whitespace-nowrap mt-2`}
            >
                {isCod ? `Verify & Collect ₹${amount}` : 'Confirm Delivery'}
            </button>
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {show && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6" style={{ position: 'fixed' }}>
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                exit={{ opacity: 0 }} 
                                onClick={() => !isVerifying && setShow(false)} 
                                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
                            />
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                                animate={{ scale: 1, opacity: 1, y: 0 }} 
                                exit={{ scale: 0.9, opacity: 0, y: 20 }} 
                                className="relative bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl"
                            >
                                <h2 className="text-xl font-black text-slate-800">Delivery verification</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Ask buyer for OTP</p>
                                
                                {isCod && (
                                    <div className="bg-orange-50 rounded-2xl p-4 mb-6 border border-orange-100 text-center">
                                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Please collect cash first</p>
                                        <p className="text-3xl font-black text-orange-600">₹{amount}</p>
                                    </div>
                                )}
                                
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">4-Digit Code</label>
                                        <input 
                                            type="text" 
                                            maxLength={4} 
                                            disabled={isVerifying}
                                            className="w-full bg-slate-50 border-none rounded-xl py-4 px-5 font-bold outline-none text-center tracking-[1em] text-lg" 
                                            placeholder="1234" 
                                            value={otp} 
                                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} 
                                        />
                                    </div>
                                    <div className="flex gap-2 mt-6">
                                        {!isVerifying && (
                                            <button 
                                                onClick={() => setShow(false)}
                                                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-[24px] font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button 
                                            onClick={handleVerify}
                                            disabled={isVerifying}
                                            className="flex-1 py-4 bg-green-600 text-white rounded-[24px] font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isVerifying ? (
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                "Verify"
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}

export default StoreOrders;
