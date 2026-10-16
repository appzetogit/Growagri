import React, { useState, useEffect } from 'react';
import {
    FiChevronLeft,
    FiShoppingCart,
    FiTrash2,
    FiPlus,
    FiMinus,
    FiPackage,
    FiMapPin,
    FiArrowLeft,
    FiShield,
    FiHome,
    FiCreditCard,
    FiTruck
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useEcommerceCart } from '../../../../context/EcommerceCartContext';
import ecommerceService from '../../../../services/ecommerceService';
import { walletService } from '../../../../services/walletService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import LocationPicker from '../Checkout/components/LocationPicker';
import { startEcommercePayment } from '../../../../utils/razorpay';

const AgriCart = () => {
    const navigate = useNavigate();
    const { cartItems, fetchCart, updateItem, removeItem, clearCart, isLoading } = useEcommerceCart();

    // Instant React State for Full-Page Checkout
    const [showCheckout, setShowCheckout] = useState(false);
    const [address, setAddress] = useState(null); // {addressLine1, city, state, pincode, lat, lng}
    const [paymentType, setPaymentType] = useState('online_full'); // 'online_full', 'cod', 'wallet'
    const [walletBalance, setWalletBalance] = useState(0);
    const [placingOrder, setPlacingOrder] = useState(false);

    useEffect(() => {
        fetchCart();
    }, [fetchCart]);

    useEffect(() => {
        const fetchWalletBalance = async () => {
            try {
                const res = await walletService.getBalance();
                if (res.success) {
                    setWalletBalance(res.data.balance || 0);
                }
            } catch (err) {
                console.warn('Failed to fetch wallet balance in AgriCart:', err);
            }
        };
        fetchWalletBalance();
    }, []);

    // Handle browser back button and body scroll lock for full-page checkout
    useEffect(() => {
        if (showCheckout) {
            document.body.style.overflow = 'hidden';
            window.history.pushState({ checkoutOpen: true }, '');
            const onPopState = () => {
                setShowCheckout(false);
            };
            window.addEventListener('popstate', onPopState);
            return () => {
                document.body.style.overflow = 'unset';
                window.removeEventListener('popstate', onPopState);
            };
        } else {
            document.body.style.overflow = 'unset';
        }
    }, [showCheckout]);

    const handleCloseCheckout = () => {
        if (window.history.state?.checkoutOpen) {
            window.history.back();
        } else {
            setShowCheckout(false);
        }
    };

    // Handle item quantity change
    const handleQtyChange = async (item, change) => {
        const newQty = (item.quantity || 1) + change;
        if (newQty < 1) return;
        if (newQty > (item.productId?.stock || 0)) {
            toast.error(`Only ${item.productId?.stock} units available in stock`);
            return;
        }
        try {
            await updateItem(item._id, newQty);
            toast.success("Quantity updated");
        } catch (err) {
            toast.error("Failed to update quantity");
        }
    };

    // Handle remove item
    const handleRemoveItem = async (itemId) => {
        if (!window.confirm("Are you sure you want to remove this item?")) return;
        try {
            await removeItem(itemId);
            toast.success("Item removed from cart");
        } catch (err) {
            toast.error("Failed to remove item");
        }
    };

    // Calculations based on backend logic
    const calculateTotals = () => {
        let itemsTotal = 0;
        let shippingCharges = 0;

        cartItems.forEach(item => {
            const product = item.productId;
            if (product) {
                const subtotal = (product.price || 0) * (item.quantity || 1);
                itemsTotal += subtotal;
                shippingCharges += (product.shippingCharge || 0) * (item.quantity || 1);
            }
        });

        const orderTotal = itemsTotal + shippingCharges;

        return {
            itemsTotal,
            shippingCharges,
            orderTotal
        };
    };

    const totals = calculateTotals();

    // Group items by vendorId
    const getGroupedItems = () => {
        const groups = {};
        cartItems.forEach(item => {
            const vendorId = item.productId?.vendorId || 'central';
            if (!groups[vendorId]) {
                groups[vendorId] = [];
            }
            groups[vendorId].push(item);
        });
        return groups;
    };

    const groupedItems = getGroupedItems();

    // Checkout / Order placement
    const handlePlaceOrder = async () => {
        if (!address || !address.addressLine1) {
            return toast.error("Please pin your location on the map and confirm your address");
        }
        try {
            setPlacingOrder(true);

            if (paymentType === 'wallet' && walletBalance < totals.orderTotal) {
                toast.error(`Insufficient wallet balance (₹${walletBalance.toLocaleString('en-IN')}). Please add money or choose another payment method.`);
                setPlacingOrder(false);
                return;
            }

            const res = await ecommerceService.placeOrder({
                shippingAddress: address,
                paymentType,
                paymentMethod: paymentType === 'wallet' ? 'wallet' : (paymentType === 'cod' ? 'cash' : 'razorpay')
            });

            if (res.success) {
                if (paymentType === 'wallet') {
                    await clearCart();
                    setShowCheckout(false);
                    toast.success("Order Placed & Paid Successfully from Wallet!");
                    navigate('/user/my-agri-orders');
                    return;
                }

                // If multiple orders are created, redirect to orders tracking page
                if (res.orders && res.orders.length > 1) {
                    await clearCart();
                    setShowCheckout(false);
                    toast("Created separate orders for different vendors. You can pay from My Orders.", { icon: '📦' });
                    navigate('/user/my-agri-orders');
                    return;
                }

                const singleOrder = res.data || (res.orders && res.orders[0]);

                if (paymentType === 'cod') {
                    await clearCart();
                    setShowCheckout(false);
                    toast.success("Order Placed Successfully!");
                    navigate('/user/my-agri-orders');
                    return;
                }

                // Direct online payment: trigger Razorpay modal right here end-to-end
                try {
                    await startEcommercePayment(singleOrder._id);
                    // On payment & verification success:
                    await clearCart();
                    setShowCheckout(false);
                    toast.success("Payment Successful! Order Confirmed.");
                    navigate('/user/my-agri-orders');
                } catch (payErr) {
                    await clearCart();
                    setShowCheckout(false);
                    if (payErr?.dismissed) {
                        toast("Order placed. You can complete payment anytime from My Orders.", { icon: '📦' });
                    } else {
                        toast.error(payErr?.message || "Payment cancelled or failed");
                    }
                    navigate('/user/my-agri-orders');
                }
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Order placement failed");
        } finally {
            setPlacingOrder(false);
        }
    };

    if (isLoading && cartItems.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-12">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-teal-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white px-6 pt-12 pb-6 border-b border-slate-100 flex items-center gap-4 sticky top-0 z-40">
                <button onClick={() => navigate('/user/agri-marketplace')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer active:scale-95 transition-all">
                    <FiChevronLeft className="w-6 h-6 text-slate-800" />
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-black text-slate-800 leading-tight flex items-center gap-2">
                        <FiShoppingCart className="w-5 h-5 text-teal-600" /> Cart
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Seeds & Fertilizers Cart</p>
                </div>
            </div>

            {cartItems.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center min-h-[60vh] bg-white m-6 rounded-[32px] border border-slate-100 shadow-sm">
                    <FiShoppingCart className="w-16 h-16 text-slate-200 mb-4" />
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-wide">Your cart is empty</h3>
                    <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed">Add seeds, fertilizers, and crop nutrition products from the Agri Market to checkout.</p>
                    <button onClick={() => navigate('/user/agri-marketplace')} className="mt-8 px-6 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-teal-500/20">
                        Browse Marketplace
                    </button>
                </div>
            ) : (
                <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-48">
                    {/* Cart Items List */}
                    <div className="space-y-6">
                        {Object.entries(groupedItems).map(([vendorId, items]) => (
                            <div key={vendorId} className="bg-white rounded-[32px] p-5 shadow-sm border border-slate-100 space-y-4">
                                <div className="border-b border-slate-50 pb-3 flex items-center justify-between">
                                    <span className="text-[9px] font-black text-teal-600 uppercase tracking-widest">
                                        {vendorId === 'central' ? 'GrooAgri Central Store' : `Seller Store #${vendorId.slice(-6).toUpperCase()}`}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        {items.length} {items.length === 1 ? 'Item' : 'Items'}
                                    </span>
                                </div>
                                <div className="divide-y divide-slate-50 space-y-3">
                                    {items.map(item => {
                                        const product = item.productId;
                                        if (!product) return null;
                                        return (
                                            <div key={item._id} className="flex gap-4 pt-3 first:pt-0">
                                                <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                                                    {product.imageUrl ? (
                                                        <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-200"><FiPackage /></div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                    <div>
                                                        <h4 className="text-xs font-black text-slate-800 line-clamp-1 uppercase tracking-tight">{product.title}</h4>
                                                        <p className="text-[9px] font-black text-slate-400 mt-0.5 uppercase tracking-widest">{product.brandName || 'Agri Brand'}</p>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-2">
                                                        <p className="text-sm font-black text-slate-800">
                                                            ₹{product.price} <span className="text-[9px] font-bold text-slate-400">/ {product.unit}</span>
                                                        </p>

                                                        {/* Quantity Changer */}
                                                        <div className="flex items-center gap-3 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100">
                                                            <button
                                                                onClick={() => handleQtyChange(item, -1)}
                                                                className="text-slate-400 hover:text-slate-800 p-0.5"
                                                            >
                                                                <FiMinus className="w-3 h-3" />
                                                            </button>
                                                            <span className="text-xs font-black text-slate-800 font-sans min-w-[15px] text-center">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                onClick={() => handleQtyChange(item, 1)}
                                                                className="text-slate-400 hover:text-slate-800 p-0.5"
                                                            >
                                                                <FiPlus className="w-3 h-3" />
                                                            </button>
                                                        </div>

                                                        {/* Remove Button */}
                                                        <button
                                                            onClick={() => handleRemoveItem(item._id)}
                                                            className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors active:scale-95"
                                                        >
                                                            <FiTrash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary Card */}
                    <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 space-y-4">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-3">Bill Details</h4>

                        <div className="space-y-2.5 text-xs font-bold text-slate-500">
                            <div className="flex justify-between">
                                <span>Items Subtotal</span>
                                <span className="text-slate-800 font-sans">₹{totals.itemsTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Shipping charges</span>
                                <span className="text-slate-800 font-sans">
                                    {totals.shippingCharges > 0 ? `₹${totals.shippingCharges.toFixed(2)}` : 'FREE'}
                                </span>
                            </div>
                            <div className="flex justify-between border-t border-slate-100 pt-3 text-sm font-black text-slate-800">
                                <span>Grand Total</span>
                                <span className="text-teal-600 font-sans">₹{totals.orderTotal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Sticky Checkout Button */}
                    <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-50 border-t border-slate-100 z-30">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex justify-between items-center mb-3 px-2">
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Payable</p>
                                    <p className="text-xl font-black text-slate-800">₹{totals.orderTotal.toFixed(2)}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCheckout(true)}
                                className="w-full py-4.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-[28px] font-black text-sm uppercase tracking-wider active:scale-95 transition-all shadow-xl shadow-green-950/10 flex items-center justify-center gap-2 cursor-pointer"
                            >
                                Proceed to Checkout
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─────────────────────────────────────────────────────────────
                FULL-PAGE / FULL-SCREEN CHECKOUT VIEW (Instant 0ms React State)
               ───────────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {showCheckout && (
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 15 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto flex flex-col"
                    >
                        {/* Full-Page Checkout Header */}
                        <header className="bg-white px-4 sm:px-8 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 z-40 shadow-xs">
                            <div className="flex items-center gap-3 sm:gap-4">
                                <button
                                    onClick={handleCloseCheckout}
                                    className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-2xl cursor-pointer active:scale-95 transition-all text-slate-700 flex items-center justify-center border border-slate-200/60"
                                    title="Back to Cart"
                                >
                                    <FiArrowLeft className="w-5 h-5 text-slate-700" />
                                </button>
                                <div>
                                    <h1 className="text-lg sm:text-xl font-black text-slate-800 leading-tight">Confirm E-Commerce Order</h1>
                                    <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Pin location & choose payment type</p>
                                </div>
                            </div>
                            <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-emerald-50 text-[#2E7D32] rounded-full text-xs font-bold border border-emerald-100">
                                <FiShield className="w-4 h-4 text-[#2E7D32]" />
                                <span>100% Secure Checkout</span>
                            </div>
                        </header>

                        {/* Main Full-Page Content Layout */}
                        <main className="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 pb-36 lg:pb-12">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                {/* Left Side: Map Location, Address & Payment Method (7 cols on lg) */}
                                <div className="lg:col-span-7 space-y-6">

                                    {/* Card 1: Map Location Picker */}
                                    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-[#2E7D32] flex items-center justify-center">
                                                    <FiMapPin className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Pin Location on Map</h3>
                                                </div>
                                            </div>
                                            {address?.lat && address?.lng && (
                                                <span className="text-[10px] font-bold text-[#2E7D32] bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
                                                    Location Pinned
                                                </span>
                                            )}
                                        </div>

                                        <div className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative isolate" style={{ width: "100%", maxWidth: "100%", overflow: "hidden" }}>
                                            <LocationPicker onLocationSelect={(loc) => {
                                                let city = '', state = '', pincode = '';
                                                if (loc.components && Array.isArray(loc.components)) {
                                                    loc.components.forEach(comp => {
                                                        if (comp.types.includes('locality')) city = comp.long_name;
                                                        if (comp.types.includes('administrative_area_level_1')) state = comp.long_name;
                                                        if (comp.types.includes('postal_code')) pincode = comp.long_name;
                                                    });
                                                }
                                                setAddress({
                                                    addressLine1: loc.address || '',
                                                    city,
                                                    state,
                                                    pincode,
                                                    lat: loc.lat || null,
                                                    lng: loc.lng || null
                                                });
                                            }} />
                                        </div>
                                    </div>

                                    {/* Card 2: Complete Address Details */}
                                    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4">
                                        <div className="flex items-center gap-2.5 border-b border-slate-50 pb-3">
                                            <div className="w-9 h-9 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <FiHome className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Complete Address Details</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">House / Plot no, landmark, road or area name</p>
                                            </div>
                                        </div>

                                        <div className="relative">
                                            <textarea
                                                rows="3"
                                                className="w-full bg-slate-50/60 hover:bg-white focus:bg-white border border-slate-200 rounded-2xl py-3.5 px-4 font-medium outline-none text-sm text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#2E7D32]/25 focus:border-[#2E7D32] transition-all resize-none shadow-xs"
                                                placeholder="Add house/plot no, building name, landmark, village/area..."
                                                value={address?.addressLine1 || ''}
                                                onChange={e => setAddress(prev => ({ ...(prev || {}), addressLine1: e.target.value }))}
                                            />
                                        </div>

                                        {(address?.city || address?.state || address?.pincode) && (
                                            <div className="flex flex-wrap gap-2 pt-1">
                                                {address.city && (
                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                                                        City: {address.city}
                                                    </span>
                                                )}
                                                {address.state && (
                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                                                        State: {address.state}
                                                    </span>
                                                )}
                                                {address.pincode && (
                                                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg">
                                                        PIN: {address.pincode}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Order Summary -> Bill Details -> Payment Method (5 cols on lg) */}
                                <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-24">
                                    {/* 1. Order Summary */}
                                    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                                            <div className="flex items-center gap-2">
                                                <FiPackage className="text-[#2E7D32]" />
                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Order Summary</h4>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                {cartItems.length} {cartItems.length === 1 ? 'Product' : 'Products'}
                                            </span>
                                        </div>

                                        <div className="max-h-64 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                                            {cartItems.map((item) => {
                                                const product = item.productId;
                                                if (!product) return null;
                                                return (
                                                    <div key={item._id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                                                        <div className="w-12 h-12 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                                                            {product.imageUrl ? (
                                                                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                                    <FiPackage />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h5 className="text-xs font-bold text-slate-800 truncate">{product.title}</h5>
                                                            <p className="text-[10px] text-slate-400 font-medium">{product.unit || 'Unit'} • Qty: {item.quantity}</p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <p className="text-xs font-black text-slate-800">₹{((product.price || 0) * (item.quantity || 1)).toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 2. Bill Details */}
                                    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-50 pb-3">
                                            Bill Details
                                        </h4>

                                        <div className="space-y-3 text-xs font-bold text-slate-500">
                                            <div className="flex justify-between items-center">
                                                <span>Items Subtotal</span>
                                                <span className="text-slate-800 font-sans font-bold">₹{totals.itemsTotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="flex items-center gap-1.5">
                                                    <FiTruck className="w-3.5 h-3.5 text-slate-400" />
                                                    Shipping Charges
                                                </span>
                                                <span className="text-slate-800 font-sans font-bold">
                                                    {totals.shippingCharges > 0 ? `₹${totals.shippingCharges.toFixed(2)}` : 'FREE'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center border-t border-slate-100 pt-3 text-base font-black text-slate-800">
                                                <span>Total Payable</span>
                                                <span className="text-[#2E7D32] font-sans text-xl">₹{totals.orderTotal.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Payment Method */}
                                    <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-100 space-y-4">
                                        <div className="flex items-center gap-2.5 border-b border-slate-50 pb-3">
                                            <div className="w-9 h-9 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                                <FiCreditCard className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Payment Method</h3>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Choose your preferred payment mode</p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label
                                                onClick={() => setPaymentType('online_full')}
                                                className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentType === 'online_full'
                                                        ? 'border-[#2E7D32] bg-emerald-50/40 shadow-sm'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${paymentType === 'online_full' ? 'border-[#2E7D32]' : 'border-slate-300'
                                                    }`}>
                                                    {paymentType === 'online_full' && <div className="w-2.5 h-2.5 bg-[#2E7D32] rounded-full" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-black text-slate-800">Pay Full Amount Online</p>
                                                        <span className="text-[9px] font-bold text-[#2E7D32] bg-emerald-100/70 px-2.5 py-0.5 rounded-full uppercase">Instant & Secure</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
                                                        Pay ₹{totals.orderTotal.toFixed(2)} securely now. Nothing to pay on delivery.
                                                    </p>
                                                </div>
                                            </label>

                                            <label
                                                onClick={() => setPaymentType('cod')}
                                                className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentType === 'cod'
                                                        ? 'border-[#2E7D32] bg-emerald-50/40 shadow-sm'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${paymentType === 'cod' ? 'border-[#2E7D32]' : 'border-slate-300'
                                                    }`}>
                                                    {paymentType === 'cod' && <div className="w-2.5 h-2.5 bg-[#2E7D32] rounded-full" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-black text-slate-800">Cash on Delivery</p>
                                                        <span className="text-[9px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full uppercase">Pay at Doorstep</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
                                                        Pay ₹{totals.orderTotal.toFixed(2)} to vendor upon delivery.
                                                    </p>
                                                </div>
                                            </label>

                                            {/* Wallet Option (Under Cash on Delivery) */}
                                            <label
                                                onClick={() => setPaymentType('wallet')}
                                                className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${paymentType === 'wallet'
                                                        ? 'border-[#2E7D32] bg-emerald-50/40 shadow-sm'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${paymentType === 'wallet' ? 'border-[#2E7D32]' : 'border-slate-300'
                                                    }`}>
                                                    {paymentType === 'wallet' && <div className="w-2.5 h-2.5 bg-[#2E7D32] rounded-full" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-black text-slate-800">Pay using Wallet</p>
                                                        <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                                                            walletBalance >= totals.orderTotal 
                                                                ? 'text-[#2E7D32] bg-emerald-100/80' 
                                                                : 'text-amber-700 bg-amber-100/80'
                                                        }`}>
                                                            {walletBalance >= totals.orderTotal ? 'Instant Pay' : 'Low Balance'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className="text-xs font-bold text-slate-600">
                                                            Available Balance: <span className="font-sans font-black text-slate-900">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-500 mt-0.5 leading-relaxed">
                                                        {walletBalance >= totals.orderTotal 
                                                            ? `₹${totals.orderTotal.toFixed(2)} will be debited directly from your wallet balance.` 
                                                            : `Insufficient balance. Need ₹${(totals.orderTotal - walletBalance).toFixed(2)} more.`}
                                                    </p>
                                                </div>
                                            </label>
                                        </div>

                                        <div className="pt-2 text-center text-[10px] font-bold text-slate-400 flex items-center justify-center gap-2">
                                            <FiShield className="text-[#2E7D32] w-3.5 h-3.5" />
                                            <span>Safe & Secure Payments • Agri Quality Guaranteed</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </main>

                        {/* Floating Sticky Checkout Bar */}
                        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-100 z-30 shadow-xl">
                            <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 sm:gap-6">
                                <div>
                                    <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Payable</p>
                                    <p className="text-lg sm:text-2xl font-black text-[#2E7D32]">₹{totals.orderTotal.toFixed(2)}</p>
                                </div>
                                <button
                                    disabled={placingOrder || (paymentType === 'wallet' && walletBalance < totals.orderTotal)}
                                    onClick={handlePlaceOrder}
                                    className="flex-1 sm:flex-initial sm:min-w-[260px] py-3.5 sm:py-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider active:scale-95 transition-all shadow-lg shadow-green-950/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {placingOrder ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            <span className="text-xs uppercase font-black tracking-wider">
                                                {paymentType === 'wallet' ? 'Paying from Wallet...' : paymentType === 'cod' ? 'Placing Order...' : 'Opening Razorpay...'}
                                            </span>
                                        </div>
                                    ) : (
                                        <>
                                            {paymentType === 'wallet'
                                                ? (walletBalance < totals.orderTotal ? 'Insufficient Wallet Balance' : `Pay ₹${totals.orderTotal.toFixed(2)} via Wallet`)
                                                : paymentType === 'cod'
                                                    ? 'Confirm Order'
                                                    : `Pay ₹${totals.orderTotal.toFixed(2)}`
                                            }
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AgriCart;
