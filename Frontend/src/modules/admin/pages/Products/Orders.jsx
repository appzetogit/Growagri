import React, { useState, useEffect, useMemo } from 'react';
import {
    FiPackage,
    FiTruck,
    FiCheckCircle,
    FiSearch,
    FiFilter,
    FiX,
    FiTrendingUp,
    FiDollarSign,
    FiShoppingBag,
    FiArrowUp,
    FiArrowDown,
    FiHome,
    FiUser,
    FiCalendar,
    FiRotateCcw
} from 'react-icons/fi';
import adminProductService from '../../../../services/adminProductService';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

const EcommerceOrders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedShopFilter, setSelectedShopFilter] = useState('ALL');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
    const [sortBy, setSortBy] = useState('date_desc');
    const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'shop_profits'
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedOrder, setSelectedOrder] = useState(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedShopFilter, selectedStatusFilter, sortBy]);

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

    // Calculate High-level Dashboard Metrics
    const metrics = useMemo(() => {
        let totalOrders = orders.length;
        let totalGMV = 0;
        let totalAdminProfit = 0;
        let totalVendorPayout = 0;

        orders.forEach(o => {
            const isCancelled = o.deliveryStatus === 'cancelled' || o.paymentStatus === 'refunded';
            if (!isCancelled) {
                const orderTotal = o.pricing?.orderTotal || ((o.pricing?.itemsTotal || 0) + (o.pricing?.shippingCharges || 0));
                const comm = o.pricing?.adminCommission || 0;
                const vend = o.pricing?.vendorBalance || (orderTotal - comm);

                totalGMV += orderTotal;
                totalAdminProfit += comm;
                totalVendorPayout += vend;
            }
        });

        return {
            totalOrders,
            totalGMV,
            totalAdminProfit,
            totalVendorPayout
        };
    }, [orders]);

    // Compute Shop-wise Revenue & Profit Analytics
    const shopAnalytics = useMemo(() => {
        const map = {};
        orders.forEach(order => {
            const isCancelled = order.deliveryStatus === 'cancelled' || order.paymentStatus === 'refunded';
            const shopName = order.vendorId?.shopDetails?.shopName || order.vendorId?.businessName || 'Other Shop';
            const vendorName = order.vendorId?.name || 'Seller';
            const phone = order.vendorId?.phone || null;

            if (!map[shopName]) {
                map[shopName] = {
                    shopName,
                    vendorName,
                    phone,
                    orderCount: 0,
                    activeOrderCount: 0,
                    totalSales: 0,
                    adminProfit: 0,
                    vendorEarnings: 0
                };
            }

            map[shopName].orderCount += 1;
            if (!isCancelled) {
                map[shopName].activeOrderCount += 1;
                const orderTotal = order.pricing?.orderTotal || ((order.pricing?.itemsTotal || 0) + (order.pricing?.shippingCharges || 0));
                const comm = order.pricing?.adminCommission || 0;
                const vend = order.pricing?.vendorBalance || (orderTotal - comm);

                map[shopName].totalSales += orderTotal;
                map[shopName].adminProfit += comm;
                map[shopName].vendorEarnings += vend;
            }
        });

        return Object.values(map).sort((a, b) => b.adminProfit - a.adminProfit);
    }, [orders]);

    // Unique Shop Names for Dropdown Filter
    const uniqueShops = useMemo(() => {
        return Array.from(new Set(orders.map(o => o.vendorId?.shopDetails?.shopName || o.vendorId?.businessName).filter(Boolean))).sort();
    }, [orders]);

    // Filter & Sort Orders
    const processedOrders = useMemo(() => {
        return orders.filter(o => {
            const term = searchTerm.trim().toLowerCase();
            const shopName = (o.vendorId?.shopDetails?.shopName || o.vendorId?.businessName || '').toLowerCase();
            const vendorName = (o.vendorId?.name || '').toLowerCase();
            const userName = (o.userId?.name || '').toLowerCase();
            const orderId = (o._id || '').toLowerCase();

            const matchesSearch = !term || (
                orderId.includes(term) ||
                userName.includes(term) ||
                shopName.includes(term) ||
                vendorName.includes(term)
            );

            const currentShopName = o.vendorId?.shopDetails?.shopName || o.vendorId?.businessName;
            const matchesShop = selectedShopFilter === 'ALL' || currentShopName === selectedShopFilter;
            const matchesStatus = selectedStatusFilter === 'ALL' || 
                (selectedStatusFilter === 'refunded' ? o.paymentStatus === 'refunded' : o.deliveryStatus === selectedStatusFilter);

            return matchesSearch && matchesShop && matchesStatus;
        }).sort((a, b) => {
            const isCancelledA = a.deliveryStatus === 'cancelled' || a.paymentStatus === 'refunded';
            const isCancelledB = b.deliveryStatus === 'cancelled' || b.paymentStatus === 'refunded';
            const shopA = (a.vendorId?.shopDetails?.shopName || a.vendorId?.businessName || '').toLowerCase();
            const shopB = (b.vendorId?.shopDetails?.shopName || b.vendorId?.businessName || '').toLowerCase();
            const amountA = isCancelledA ? 0 : (a.pricing?.orderTotal || (a.pricing?.itemsTotal + (a.pricing?.shippingCharges || 0)) || 0);
            const amountB = isCancelledB ? 0 : (b.pricing?.orderTotal || (b.pricing?.itemsTotal + (b.pricing?.shippingCharges || 0)) || 0);
            const profitA = isCancelledA ? 0 : (a.pricing?.adminCommission || 0);
            const profitB = isCancelledB ? 0 : (b.pricing?.adminCommission || 0);
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();

            switch (sortBy) {
                case 'shop_asc':
                    return shopA.localeCompare(shopB);
                case 'shop_desc':
                    return shopB.localeCompare(shopA);
                case 'amount_desc':
                    return amountB - amountA;
                case 'amount_asc':
                    return amountA - amountB;
                case 'profit_desc':
                    return profitB - profitA;
                case 'date_asc':
                    return dateA - dateB;
                case 'date_desc':
                default:
                    return dateB - dateA;
            }
        });
    }, [orders, searchTerm, selectedShopFilter, selectedStatusFilter, sortBy]);

    const totalPages = Math.ceil(processedOrders.length / itemsPerPage);
    const currentOrders = processedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleSortToggle = (field) => {
        if (field === 'shop') {
            setSortBy(prev => prev === 'shop_asc' ? 'shop_desc' : 'shop_asc');
        } else if (field === 'amount') {
            setSortBy(prev => prev === 'amount_desc' ? 'amount_asc' : 'amount_desc');
        } else if (field === 'date') {
            setSortBy(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc');
        } else if (field === 'profit') {
            setSortBy(prev => prev === 'profit_desc' ? 'date_desc' : 'profit_desc');
        }
    };

    const handleFilterByShop = (shopName) => {
        setSelectedShopFilter(shopName);
        setActiveTab('orders');
    };

    const handleRefund = async (order) => {
        const refundAmt = order.paymentType === 'online_full'
            ? (order.pricing?.orderTotal || ((order.pricing?.itemsTotal || 0) + (order.pricing?.shippingCharges || 0)))
            : (order.pricing?.platformFee || 0);

        if (!window.confirm(`Are you sure you want to mark this order as Refunded (₹${refundAmt.toLocaleString()} transferred directly to customer's account)?`)) {
            return;
        }

        try {
            const res = await adminProductService.refundOrder(order._id);
            if (res.success) {
                toast.success(res.message || 'Order refunded successfully');
                if (selectedOrder && selectedOrder._id === order._id) {
                    setSelectedOrder({ ...selectedOrder, paymentStatus: 'refunded', deliveryStatus: 'cancelled' });
                }
                fetchOrders();
            } else {
                toast.error(res.message || 'Refund failed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Failed to refund order');
        }
    };

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedShopFilter('ALL');
        setSelectedStatusFilter('ALL');
        setSortBy('date_desc');
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen space-y-6">
            {/* Top Revenue & Performance Summary KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Orders */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 flex-shrink-0">
                        <FiShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Orders</p>
                        <p className="text-2xl font-black text-slate-800">{metrics.totalOrders}</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Global store sales</p>
                    </div>
                </div>

                {/* Total Sales GMV */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 flex-shrink-0">
                        <FiDollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales (GMV)</p>
                        <p className="text-2xl font-black text-slate-800">₹{metrics.totalGMV.toLocaleString()}</p>
                        <p className="text-[10px] text-indigo-500 font-bold mt-0.5">Order volume paid</p>
                    </div>
                </div>

                {/* Admin Profit (Commission) */}
                <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-5 rounded-3xl text-white shadow-lg shadow-emerald-500/20 flex items-center justify-between gap-4">
                    <div>
                        <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[9px] font-black uppercase tracking-wider mb-1">
                            Platform Revenue
                        </span>
                        <p className="text-2xl sm:text-3xl font-black tracking-tight">₹{metrics.totalAdminProfit.toLocaleString()}</p>
                        <p className="text-[10px] text-emerald-100 font-bold mt-0.5">Net Admin Profit</p>
                    </div>
                    <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center text-white flex-shrink-0 backdrop-blur-sm">
                        <FiTrendingUp className="w-6 h-6" />
                    </div>
                </div>

                {/* Vendor Payout Balance */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">
                        <FiTruck className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor Share</p>
                        <p className="text-2xl font-black text-slate-800">₹{metrics.totalVendorPayout.toLocaleString()}</p>
                        <p className="text-[10px] text-amber-600 font-bold mt-0.5">Sellers + Shipping</p>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs: Orders View vs Shop Profit Analytics */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'orders'
                                ? 'bg-[#2E7D32] text-white shadow-md shadow-emerald-700/20'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <FiPackage className="w-4 h-4" />
                        Orders List ({processedOrders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('shop_profits')}
                        className={`px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                            activeTab === 'shop_profits'
                                ? 'bg-[#2E7D32] text-white shadow-md shadow-emerald-700/20'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <FiHome className="w-4 h-4" />
                        Shop Profit Analytics ({shopAnalytics.length})
                    </button>
                </div>

                {/* Quick reset if any filter active */}
                {(searchTerm || selectedShopFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || sortBy !== 'date_desc') && (
                    <button
                        onClick={resetFilters}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                        <FiRotateCcw className="w-3 h-3" /> Reset Filters
                    </button>
                )}
            </div>

            {/* TAB 1: ORDERS LIST VIEW */}
            {activeTab === 'orders' && (
                <div className="space-y-4">
                    {/* Controls Bar: Search, Shop Filter, Status Filter, Sorting */}
                    <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="flex-1 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 flex items-center gap-2.5">
                            <FiSearch className="text-slate-400 w-4 h-4 flex-shrink-0" />
                            <input
                                type="text"
                                placeholder="Search by Order ID, Buyer Name, or Vendor Shop..."
                                className="flex-1 bg-transparent border-none outline-none font-bold text-xs text-slate-700 placeholder:text-slate-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                                    <FiX className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter & Sorting Controls */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            {/* Shop Name Filter */}
                            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100">
                                <FiHome className="w-3.5 h-3.5 text-slate-400" />
                                <select
                                    value={selectedShopFilter}
                                    onChange={(e) => setSelectedShopFilter(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                >
                                    <option value="ALL">All Shops ({uniqueShops.length})</option>
                                    {uniqueShops.map(shop => (
                                        <option key={shop} value={shop}>{shop}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100">
                                <FiFilter className="w-3.5 h-3.5 text-slate-400" />
                                <select
                                    value={selectedStatusFilter}
                                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer uppercase"
                                >
                                    <option value="ALL">All Status</option>
                                    <option value="ordered">Ordered</option>
                                    <option value="packed">Packed</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="refunded">Refunded</option>
                                </select>
                            </div>

                            {/* Sorting Dropdown */}
                            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort:</span>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                                >
                                    <option value="date_desc">Date: Newest First</option>
                                    <option value="date_asc">Date: Oldest First</option>
                                    <option value="shop_asc">Shop: A to Z</option>
                                    <option value="shop_desc">Shop: Z to A</option>
                                    <option value="amount_desc">Amount: High to Low</option>
                                    <option value="amount_asc">Amount: Low to High</option>
                                    <option value="profit_desc">Admin Profit: High to Low</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Orders Table */}
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/60 border-b border-slate-100 select-none">
                                        <th 
                                            onClick={() => handleSortToggle('date')}
                                            className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Order / Date</span>
                                                {sortBy.startsWith('date') && (
                                                    sortBy === 'date_desc' ? <FiArrowDown className="w-3 h-3 text-[#2E7D32]" /> : <FiArrowUp className="w-3 h-3 text-[#2E7D32]" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items / Qty</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Farmer & Address</th>
                                        <th 
                                            onClick={() => handleSortToggle('shop')}
                                            className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Vendor / Shop</span>
                                                {sortBy.startsWith('shop') && (
                                                    sortBy === 'shop_asc' ? <FiArrowUp className="w-3 h-3 text-[#2E7D32]" /> : <FiArrowDown className="w-3 h-3 text-[#2E7D32]" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSortToggle('amount')}
                                            className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Order Amount</span>
                                                {sortBy.startsWith('amount') && (
                                                    sortBy === 'amount_desc' ? <FiArrowDown className="w-3 h-3 text-[#2E7D32]" /> : <FiArrowUp className="w-3 h-3 text-[#2E7D32]" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            onClick={() => handleSortToggle('profit')}
                                            className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-slate-700 transition-colors"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Admin Profit</span>
                                                {sortBy === 'profit_desc' && <FiArrowDown className="w-3 h-3 text-emerald-600" />}
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loading ? (
                                        [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan="8" className="px-6 py-10 bg-slate-50/30"></td></tr>)
                                    ) : currentOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-6 py-12 text-center text-slate-400 font-bold text-sm">
                                                No orders found matching the filter criteria.
                                            </td>
                                        </tr>
                                    ) : currentOrders.map(order => {
                                        const isCancelled = order.deliveryStatus === 'cancelled' || order.paymentStatus === 'refunded';
                                        const actualTotal = order.pricing?.orderTotal || (order.pricing?.itemsTotal + (order.pricing?.shippingCharges || 0));
                                        const adminProfit = isCancelled ? 0 : (order.pricing?.adminCommission || 0);
                                        const shopName = order.vendorId?.shopDetails?.shopName || order.vendorId?.businessName || 'N/A';

                                        return (
                                            <tr key={order._id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-6 py-5">
                                                    <p className="font-black text-slate-800 text-sm">#{order._id.slice(-6).toUpperCase()}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase">{format(new Date(order.createdAt), 'dd MMM yyyy, hh:mm a')}</p>
                                                </td>
                                                <td className="px-6 py-5">
                                                    {order.items && order.items.length > 0 && (
                                                        <div className="text-[11px] font-bold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100/80 max-w-[200px] space-y-1">
                                                            {order.items.map((item, idx) => {
                                                                const unitStr = item.productId?.unit || 'bag';
                                                                const weightStr = item.bagWeight ? ` (${item.bagWeight}kg)` : '';
                                                                return (
                                                                    <div key={idx} className="line-clamp-2">
                                                                        {item.name} <span className="text-teal-700 font-black">x{item.quantity} {unitStr}{item.quantity > 1 ? 's' : ''}{weightStr}</span>
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
                                                    <p className="font-black text-slate-800 text-sm leading-tight">
                                                        {shopName}
                                                    </p>
                                                    {order.vendorId?.name && (
                                                        <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{order.vendorId.name}</p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-black text-slate-900 font-sans">
                                                            ₹{actualTotal.toLocaleString()}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase ${
                                                                order.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-700 border border-purple-200/80' :
                                                                order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {order.paymentStatus === 'refunded' ? 'REFUNDED' : order.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
                                                            </span>
                                                            {order.paymentMethod === 'wallet' || order.paymentType === 'wallet' ? (
                                                                <span className="inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200">
                                                                    WALLET
                                                                </span>
                                                            ) : order.paymentType === 'cod' ? (
                                                                <span className="inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                                                    COD
                                                                </span>
                                                            ) : (
                                                                <span className="inline-block px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                                                    ONLINE
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                {/* Admin Profit column */}
                                                <td className="px-6 py-5">
                                                    {isCancelled ? (
                                                        <div className="flex flex-col">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold line-through w-fit">
                                                                +₹{(order.pricing?.adminCommission || 0).toLocaleString()}
                                                            </span>
                                                            <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider mt-0.5">₹0 (Cancelled)</span>
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-xs font-black">
                                                            <FiTrendingUp className="w-3 h-3" /> +₹{adminProfit.toLocaleString()}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5">
                                                    {order.paymentStatus === 'refunded' ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                                                            <p className="text-[10px] font-black text-purple-700 uppercase tracking-widest">REFUNDED</p>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${
                                                                order.deliveryStatus === 'delivered' ? 'bg-green-500' :
                                                                order.deliveryStatus === 'shipped' ? 'bg-blue-500' :
                                                                order.deliveryStatus === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'
                                                            }`} />
                                                            <p className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{order.deliveryStatus}</p>
                                                        </div>
                                                    )}
                                                    {order.trackingDetails?.courierName && (
                                                        <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                            {order.trackingDetails.courierName}
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="flex flex-col items-center gap-1.5">
                                                        <button
                                                            onClick={() => setSelectedOrder(order)}
                                                            className="px-4 py-2 bg-[#2E7D32]/10 hover:bg-[#2E7D32]/25 text-[#2E7D32] rounded-xl font-bold text-xs active:scale-95 transition-all whitespace-nowrap cursor-pointer"
                                                        >
                                                            View Details
                                                        </button>
                                                        {/* Refund button for online cancelled orders */}
                                                        {order.paymentType !== 'cod' && (order.deliveryStatus === 'cancelled' || order.paymentStatus === 'refunded') && (
                                                            order.paymentStatus === 'refunded' ? (
                                                                <span className="text-[9px] font-extrabold text-purple-600 uppercase tracking-wider">
                                                                    ✓ Refunded
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleRefund(order)}
                                                                    className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-black text-[10px] uppercase tracking-wider shadow-sm active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                                                                >
                                                                    <FiRotateCcw className="w-2.5 h-2.5" /> Refund
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {!loading && processedOrders.length > 0 && (
                            <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/50">
                                <div className="flex items-center gap-4">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, processedOrders.length)} of {processedOrders.length}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows:</label>
                                        <select
                                            className="text-[10px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none cursor-pointer py-1 px-2"
                                            value={itemsPerPage}
                                            onChange={(e) => {
                                                setItemsPerPage(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <option value={10}>10</option>
                                            <option value={20}>20</option>
                                            <option value={50}>50</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: SHOP PROFIT & REVENUE ANALYTICS */}
            {activeTab === 'shop_profits' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h3 className="text-base font-black text-slate-800">Shop-wise Revenue & Admin Profit</h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Check total sales generated and exact commission profit earned by the platform per shop.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-4 py-2 rounded-2xl">
                            <FiTrendingUp className="text-emerald-700 w-4 h-4" />
                            <span className="text-xs font-black text-emerald-800">
                                Total Profit: ₹{metrics.totalAdminProfit.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {shopAnalytics.map((shop, idx) => {
                            const profitPercent = shop.totalSales > 0 ? ((shop.adminProfit / shop.totalSales) * 100).toFixed(1) : 0;
                            return (
                                <div 
                                    key={idx}
                                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#2E7D32] flex-shrink-0">
                                                <FiHome className="w-5 h-5" />
                                            </div>
                                            <span className="px-3 py-1 bg-slate-100 text-slate-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                                                {shop.activeOrderCount ?? shop.orderCount} Active ({shop.orderCount} Total)
                                            </span>
                                        </div>

                                        <h4 className="text-base font-black text-slate-900 leading-snug">{shop.shopName}</h4>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mt-1">
                                            <FiUser className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{shop.vendorName}</span>
                                            {shop.phone && <span>• {shop.phone}</span>}
                                        </div>
                                    </div>

                                    {/* Financial Breakdown for this Shop */}
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/80 space-y-2.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-bold">Total Sales (GMV):</span>
                                            <span className="text-slate-900 font-black">₹{shop.totalSales.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-bold">Vendor Payout:</span>
                                            <span className="text-slate-700 font-black">₹{shop.vendorEarnings.toLocaleString()}</span>
                                        </div>
                                        <div className="pt-2 border-t border-slate-200/60 flex justify-between items-center">
                                            <span className="text-xs font-black text-emerald-800 uppercase tracking-wider">Admin Profit:</span>
                                            <div className="text-right">
                                                <span className="text-base font-black text-emerald-600 font-sans">
                                                    +₹{shop.adminProfit.toLocaleString()}
                                                </span>
                                                <span className="block text-[9px] font-bold text-emerald-700">
                                                    ({profitPercent}% margin)
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => handleFilterByShop(shop.shopName)}
                                        className="w-full py-2.5 bg-slate-100 hover:bg-[#2E7D32] hover:text-white text-slate-700 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <FiPackage className="w-3.5 h-3.5" /> View Orders from this Shop
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
                                className="p-2 bg-white rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
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
                                            selectedOrder.paymentStatus === 'refunded' ? 'bg-purple-500' :
                                            selectedOrder.deliveryStatus === 'delivered' ? 'bg-green-500' :
                                            selectedOrder.deliveryStatus === 'shipped' ? 'bg-blue-500' :
                                            selectedOrder.deliveryStatus === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'
                                        }`} />
                                        <p className="font-extrabold text-slate-800 uppercase text-xs">
                                            {selectedOrder.paymentStatus === 'refunded' ? 'REFUNDED' : selectedOrder.deliveryStatus}
                                        </p>
                                    </div>
                                    {!['delivered', 'cancelled'].includes(selectedOrder.deliveryStatus) && selectedOrder.paymentStatus !== 'refunded' && (
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
                                            className="mt-2 w-full p-2 text-xs border border-slate-200 rounded-xl bg-white outline-none cursor-pointer"
                                        >
                                            <option value="">Update status...</option>
                                            {['packed', 'shipped', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    )}

                                    {/* Refund Action / Status in Delivery box */}
                                    {selectedOrder.paymentType !== 'cod' && (
                                        selectedOrder.paymentStatus === 'refunded' ? (
                                            <div className="mt-2.5 px-3 py-1.5 bg-purple-50 border border-purple-200/80 rounded-xl text-center">
                                                <p className="text-[10px] font-black text-purple-700 uppercase tracking-wider">
                                                    ✓ Refund Processed to Account
                                                </p>
                                            </div>
                                        ) : selectedOrder.deliveryStatus === 'cancelled' ? (
                                            <button
                                                onClick={() => handleRefund(selectedOrder)}
                                                className="mt-2.5 w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <FiRotateCcw className="w-3.5 h-3.5" /> Refund Order
                                            </button>
                                        ) : null
                                    )}
                                    {selectedOrder.paymentType === 'cod' && selectedOrder.deliveryStatus === 'cancelled' && (
                                        <div className="mt-2.5 px-2.5 py-1.5 bg-slate-100 rounded-xl text-center">
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                Cash On Delivery • No Refund Applicable
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Payment Method & Status</p>
                                    <div className="flex items-center gap-2 flex-wrap mt-1">
                                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                                            selectedOrder.paymentStatus === 'refunded' ? 'bg-purple-100 text-purple-700 border border-purple-200/80' :
                                            selectedOrder.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {selectedOrder.paymentStatus}
                                        </span>
                                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-slate-200/80 text-slate-800">
                                            {selectedOrder.paymentMethod === 'wallet' || selectedOrder.paymentType === 'wallet' 
                                                ? 'Paid via Wallet' 
                                                : selectedOrder.paymentType === 'cod' 
                                                    ? 'Cash on Delivery' 
                                                    : 'Paid Online (Razorpay)'}
                                        </span>
                                    </div>
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
                                    <h4 className="font-black text-slate-800 text-xs border-b border-slate-100 pb-1 uppercase tracking-wider">Vendor / Shop</h4>
                                    <p className="text-sm font-bold text-slate-800">
                                        {selectedOrder.vendorId?.shopDetails?.shopName || selectedOrder.vendorId?.businessName || 'N/A'}
                                    </p>
                                    {selectedOrder.vendorId?.shopDetails?.shopName && selectedOrder.vendorId?.businessName && selectedOrder.vendorId.shopDetails.shopName !== selectedOrder.vendorId.businessName && (
                                        <p className="text-xs font-bold text-slate-500">Business: {selectedOrder.vendorId.businessName}</p>
                                    )}
                                    <p className="text-xs font-bold text-slate-500">Owner: {selectedOrder.vendorId?.name || 'N/A'}</p>
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
                                {(selectedOrder.pricing?.shippingCharges || 0) > 0 && (
                                    <div className="flex justify-between">
                                        <span>Shipping Charges:</span>
                                        <span className="text-slate-800 font-black">₹{selectedOrder.pricing?.shippingCharges?.toLocaleString()}</span>
                                    </div>
                                )}
                                <div className="flex justify-between border-t border-slate-200/50 pt-2 font-black text-slate-800">
                                    <span>Customer Total Paid:</span>
                                    <span className="text-emerald-700 font-black">
                                        ₹{(selectedOrder.pricing?.orderTotal || (selectedOrder.pricing?.itemsTotal + (selectedOrder.pricing?.shippingCharges || 0)))?.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Admin Commission (Platform Profit):</span>
                                    {selectedOrder.deliveryStatus === 'cancelled' || selectedOrder.paymentStatus === 'refunded' ? (
                                        <span className="text-slate-400 font-bold">
                                            <span className="line-through mr-1.5">+₹{selectedOrder.pricing?.adminCommission?.toLocaleString()}</span>
                                            <span className="text-rose-500 font-black uppercase text-[10px]">(₹0 Cancelled)</span>
                                        </span>
                                    ) : (
                                        <span className="text-emerald-600 font-black">+₹{selectedOrder.pricing?.adminCommission?.toLocaleString()}</span>
                                    )}
                                </div>
                                <div className="flex justify-between border-t border-slate-200/50 pt-2 font-black text-slate-800">
                                    <span>Vendor Balance Due (with Shipping):</span>
                                    {selectedOrder.deliveryStatus === 'cancelled' || selectedOrder.paymentStatus === 'refunded' ? (
                                        <span className="text-slate-400 font-bold">
                                            <span className="line-through mr-1.5">₹{selectedOrder.pricing?.vendorBalance?.toLocaleString()}</span>
                                            <span className="text-rose-500 font-black uppercase text-[10px]">(₹0 Cancelled)</span>
                                        </span>
                                    ) : (
                                        <span className="text-blue-600 font-black">₹{selectedOrder.pricing?.vendorBalance?.toLocaleString()}</span>
                                    )}
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
