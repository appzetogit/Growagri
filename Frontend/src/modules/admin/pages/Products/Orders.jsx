import React, { useState, useEffect } from 'react';
import { 
    FiPackage, 
    FiTruck, 
    FiClock, 
    FiCheckCircle, 
    FiSearch,
    FiFilter,
    FiChevronLeft,
    FiX
} from 'react-icons/fi';
import adminProductService from '../../../../services/adminProductService';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const EcommerceOrders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await adminProductService.getEcommerceOrders();
            if (res.success) setOrders(res.data);
        } catch (err) {
            toast.error("Failed to load global orders");
        } finally {
            setLoading(false);
        }
    };

    const filteredOrders = orders.filter(o => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return true;
        return (
            o._id.toLowerCase().includes(term) ||
            o.userId?.name?.toLowerCase().includes(term) ||
            o.vendorId?.businessName?.toLowerCase().includes(term)
        );
    });

    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    const currentOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate(-1)} className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                    <FiChevronLeft className="w-5 h-5 text-slate-800" />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Global Ecommerce Orders</h1>
                    <p className="text-sm text-slate-500 font-medium">Monitor all physical product sales & fulfillment</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600"><FiPackage /></div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders</p>
                        <p className="text-2xl font-black text-slate-800">{orders.length}</p>
                    </div>
                </div>
                <div className="md:col-span-2 bg-white px-6 py-2 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-3">
                    <FiSearch className="text-slate-400 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Search by Order ID, Farmer Name, or Vendor Shop..." 
                        className="flex-1 bg-transparent border-none outline-none font-bold text-slate-700 placeholder:text-slate-300"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order / Date</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items / Qty</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Farmer & Address</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor / Shop</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Value (Split)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan="7" className="px-6 py-10 bg-slate-50/30"></td></tr>)
                            ) : currentOrders.map(order => (
                                <tr key={order._id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-5">
                                        <p className="font-black text-slate-800 text-sm">#{order._id.slice(-6).toUpperCase()}</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{format(new Date(order.createdAt), 'dd MMM yyyy')}</p>
                                    </td>
                                    <td className="px-6 py-5">
                                        {order.items && order.items.length > 0 && (
                                            <div className="text-[11px] font-bold text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-100/80 max-w-[200px] space-y-1">
                                                {order.items.map((item, idx) => {
                                                    const unitStr = item.productId?.unit || 'bag';
                                                    const weightStr = item.bagWeight ? ` (${item.bagWeight}kg)` : '';
                                                    return (
                                                        <div key={idx} className="line-clamp-2">
                                                            {item.name} <span className="text-teal-600 font-extrabold">x{item.quantity} {unitStr}{item.quantity > 1 ? 's' : ''}{weightStr}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="font-black text-slate-800 text-sm">{order.userId?.name || 'Unknown'}</p>
                                        <p className="text-[10px] font-medium text-slate-500 line-clamp-1 max-w-[200px] mt-1">
                                            {typeof order.shippingAddress === 'object' && order.shippingAddress ? (() => {
                                                const a = order.shippingAddress;
                                                const parts = [a.addressLine1, a.city, a.state, a.pincode].filter(Boolean);
                                                return parts.length > 0 ? parts.join(', ') : 'No Address';
                                            })() : (order.shippingAddress || 'No Address')}
                                        </p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="font-black text-slate-800 text-sm">{order.vendorId?.businessName || 'N/A'}</p>
                                        <p className="text-[10px] font-bold text-teal-600 mt-1 uppercase tracking-tighter">V: {order.vendorId?.name}</p>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="space-y-1">
                                            <p className="text-[11px] font-black text-slate-800">Total: ₹{order.pricing?.itemsTotal}</p>
                                            <div className="flex gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                                    order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    Fee: ₹{order.pricing?.platformFee} ({order.paymentStatus})
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[8px] font-black uppercase">
                                                    Vend: ₹{order.pricing?.vendorBalance}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                                order.deliveryStatus === 'delivered' ? 'bg-green-500' : 
                                                order.deliveryStatus === 'shipped' ? 'bg-blue-500' : 'bg-orange-500'
                                            }`} />
                                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{order.deliveryStatus}</p>
                                        </div>
                                        {order.trackingDetails?.courierName && (
                                            <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                {order.trackingDetails.courierName}
                                            </p>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <button 
                                            onClick={() => setSelectedOrder(order)}
                                            className="px-4 py-2 bg-[#2E7D32]/10 hover:bg-[#2E7D32]/25 text-[#2E7D32] rounded-xl font-bold text-xs active:scale-95 transition-all whitespace-nowrap"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && filteredOrders.length > 0 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-zinc-50/50">
                        <div className="flex items-center gap-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows per page:</label>
                                <select 
                                    className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none cursor-pointer py-1 px-2"
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1); // Reset to first page when changing size
                                    }}
                                >
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all"
                            >
                                Prev
                            </button>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="font-black text-slate-800 text-base">
                                    Order Details
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">
                                    #{selectedOrder._id}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="p-2 bg-white rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                <FiX className="w-5 h-5 text-slate-600" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Status Section */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Delivery Status</p>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2.5 h-2.5 rounded-full ${
                                            selectedOrder.deliveryStatus === 'delivered' ? 'bg-green-500' :
                                            selectedOrder.deliveryStatus === 'shipped' ? 'bg-blue-500' : 'bg-orange-500'
                                        }`} />
                                        <p className="font-extrabold text-slate-800 uppercase text-xs">{selectedOrder.deliveryStatus}</p>
                                    </div>
                                    {!['delivered', 'cancelled'].includes(selectedOrder.deliveryStatus) && (
                                        <select
                                            value=""
                                            onChange={async (e) => {
                                                const status = e.target.value;
                                                if (!status || !window.confirm(`Mark this order as ${status}?`)) return;
                                                try {
                                                    const res = await adminProductService.updateOrderStatus(selectedOrder._id, status);
                                                    toast.success(res.message || `Order ${status}`);
                                                    setSelectedOrder({ ...selectedOrder, deliveryStatus: status });
                                                    fetchOrders();
                                                } catch (err) {
                                                    toast.error(err.response?.data?.message || 'Failed to update order');
                                                }
                                            }}
                                            className="mt-2 w-full p-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                                        >
                                            <option value="">Update status...</option>
                                            {['packed', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Payment Status</p>
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                        selectedOrder.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                        {selectedOrder.paymentStatus} ({selectedOrder.paymentMethod || 'wallet'})
                                    </span>
                                </div>
                            </div>

                            {/* Farmer & Vendor Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Farmer info */}
                                <div className="space-y-3">
                                    <h4 className="font-black text-slate-800 text-xs border-b border-slate-100 pb-1 uppercase tracking-wider">Farmer (Buyer)</h4>
                                    <p className="text-sm font-bold text-slate-800">{selectedOrder.userId?.name || 'Unknown'}</p>
                                    <p className="text-xs font-bold text-slate-500">Phone: {selectedOrder.userId?.phone || 'No Phone'}</p>
                                    <div className="text-xs font-bold text-slate-500">
                                        <p className="text-slate-400 uppercase text-[9px] font-black mb-1">Shipping Address</p>
                                        <p className="leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100/50 font-semibold text-slate-600">
                                            {typeof selectedOrder.shippingAddress === 'object' && selectedOrder.shippingAddress ? (() => {
                                                const a = selectedOrder.shippingAddress;
                                                return [a.addressLine1, a.city, a.state, a.pincode].filter(Boolean).join(', ');
                                            })() : (selectedOrder.shippingAddress || 'No Address')}
                                        </p>
                                    </div>
                                </div>

                                {/* Vendor info */}
                                <div className="space-y-3">
                                    <h4 className="font-black text-slate-800 text-xs border-b border-slate-100 pb-1 uppercase tracking-wider">Vendor (Seller)</h4>
                                    <p className="text-sm font-bold text-slate-800">{selectedOrder.vendorId?.businessName || 'N/A'}</p>
                                    <p className="text-xs font-bold text-slate-500">Seller: {selectedOrder.vendorId?.name || 'N/A'}</p>
                                    <p className="text-xs font-bold text-slate-500">Phone: {selectedOrder.vendorId?.phone || 'N/A'}</p>
                                </div>
                            </div>

                            {/* Order Items */}
                            <div className="space-y-3">
                                <h4 className="font-black text-slate-800 text-xs border-b border-slate-100 pb-1 uppercase tracking-wider">Ordered Products</h4>
                                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/20">
                                    {selectedOrder.items?.map((item, idx) => (
                                        <div key={idx} className="p-4 flex items-center justify-between text-xs font-bold">
                                            <div>
                                                <p className="text-slate-800 font-extrabold text-sm">{item.name}</p>
                                                <p className="text-slate-400 mt-0.5 font-bold">
                                                    {item.productId?.unit || 'bag'}
                                                    {item.bagWeight ? ` • ${item.bagWeight}kg` : ''}
                                                    {` • ₹${item.price} per unit`}
                                                </p>
                                            </div>
                                            <p className="text-slate-800 font-black text-sm text-right">
                                                x{item.quantity} = ₹{(item.price * item.quantity).toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Pricing summary */}
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs font-bold text-slate-600">
                                <h4 className="font-black text-slate-800 text-xs border-b border-slate-100 pb-1.5 uppercase tracking-wider mb-2">Pricing Breakdown</h4>
                                <div className="flex justify-between">
                                    <span>Items Total:</span>
                                    <span className="text-slate-800 font-black">₹{selectedOrder.pricing?.itemsTotal?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Admin Commission:</span>
                                    <span className="text-slate-800 font-black">₹{selectedOrder.pricing?.adminCommission?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>GST Amount:</span>
                                    <span className="text-slate-800 font-black">₹{selectedOrder.pricing?.gstAmount?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200/50 pt-2 font-black text-slate-800">
                                    <span>Platform Fee Paid:</span>
                                    <span className="text-teal-600 font-black">₹{selectedOrder.pricing?.platformFee?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200/50 pt-2 font-black text-slate-800">
                                    <span>Vendor Balance Due:</span>
                                    <span className="text-blue-600 font-black">₹{selectedOrder.pricing?.vendorBalance?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EcommerceOrders;
