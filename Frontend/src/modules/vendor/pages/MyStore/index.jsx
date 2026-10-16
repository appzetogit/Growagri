import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiSearch,
    FiChevronLeft,
    FiImage,
    FiTrendingUp,
    FiPackage,
    FiInfo,
    FiAlertCircle,
    FiShoppingBag,
    FiMapPin,
    FiFileText,
    FiClock
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import vendorProductService from '../../services/vendorProductService';
import { publicCatalogService } from '../../../../services/catalogService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const MyStore = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [shopStatus, setShopStatus] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showDocModal, setShowDocModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        categoryId: '',
        brandName: '',
        description: '',
        price: '',
        unit: 'bag',
        bagWeight: 50,
        stock: 1,
        shippingCharge: 0,
        imageUrl: '',
        images: [],
        specifications: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    // Lock background scroll when any modal is open
    useEffect(() => {
        if (showModal || showDocModal) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [showModal, showDocModal]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [prodRes, catRes, shopRes] = await Promise.all([
                vendorProductService.getMyProducts(),
                publicCatalogService.getCategories({ type: 'product' }),
                vendorProductService.getShopStatus()
            ]);
            if (prodRes.success) setProducts(prodRes.data || []);
            if (catRes.success) setCategories(catRes.categories || catRes.data || []);
            if (shopRes.success) setShopStatus(shopRes.data);
        } catch (err) {
            toast.error("Data load karne mein dikkat hui");
        } finally {
            setLoading(false);
        }
    };

    const handleQuickStockUpdate = async (product) => {
        const newStock = prompt(`Enter new stock quantity for "${product.title}":`, product.stock);
        if (newStock === null) return;
        const stockVal = parseInt(newStock, 10);
        if (isNaN(stockVal) || stockVal < 0) {
            toast.error("Please enter a valid stock number");
            return;
        }
        try {
            const res = await vendorProductService.updateProduct(product._id, { ...product, stock: stockVal });
            if (res.success) {
                toast.success("Stock updated successfully");
                fetchData();
            } else {
                toast.error(res.message || "Failed to update stock");
            }
        } catch (err) {
            toast.error("Error updating stock");
        }
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            setUploading(true);
            const token = sessionStorage.getItem('vendorAccessToken') || localStorage.getItem('vendorAccessToken');
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

            const uploadedUrls = [];
            for (const file of files) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', file);

                const res = await fetch(`${baseUrl}/upload`, { 
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: uploadFormData
                });
                const data = await res.json();
                if (data.success) {
                    uploadedUrls.push(data.imageUrl);
                }
            }

            if (uploadedUrls.length > 0) {
                setFormData(prev => {
                    const newImages = [...(prev.images || []), ...uploadedUrls];
                    return {
                        ...prev,
                        imageUrl: newImages[0] || prev.imageUrl,
                        images: newImages
                    };
                });
                toast.success(`${uploadedUrls.length} image(s) uploaded!`);
            }
        } catch (err) {
            toast.error("Image upload failed");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.price) {
            return toast.error("Please fill Title and Price");
        }

        try {
            let res;
            if (editMode) {
                res = await vendorProductService.updateProduct(formData._id, formData);
            } else {
                res = await vendorProductService.addProduct(formData);
            }

            if (res.success) {
                toast.success(res.message || (editMode ? "Product updated successfully" : "Product submitted for review"));
                setShowModal(false);
                fetchData();
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || "Action failed";
            toast.error(errMsg);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Kaya aap is product ko delete karna chahte hain?")) return;
        try {
            const res = await vendorProductService.deleteProduct(id);
            if (res.success) {
                setProducts(products.filter(p => p._id !== id));
                toast.success("Product removed");
            }
        } catch (err) {
            toast.error("Delete failed");
        }
    };

    const openEdit = (product) => {
        setFormData({
            ...product,
            images: product.images && product.images.length > 0 ? product.images : (product.imageUrl ? [product.imageUrl] : []),
            specifications: product.specifications || [],
            categoryId: product.categoryId?._id || product.categoryId
        });
        setEditMode(true);
        setShowModal(true);
    };

    if (!loading && !shopStatus?.isStoreApproved) {
        const approval = shopStatus?.storeApprovalStatus;
        const state = approval === 'pending'
            ? { icon: FiClock, tone: 'bg-amber-50 text-amber-600', title: 'Verification in Progress', text: 'Your shop registration is under review. We will notify you once admin approves it.' }
            : approval === 'rejected'
                ? { icon: FiAlertCircle, tone: 'bg-red-50 text-red-600', title: 'Registration Rejected', text: shopStatus?.remarks || 'Please check your shop details and submit again for approval.' }
                : { icon: FiShoppingBag, tone: 'bg-green-50 text-[#2E7D32]', title: 'Register Your Shop', text: 'To sell seeds and fertilizers, register your shop and get it verified by admin.' };
        const steps = ['Submit shop name, location & license', 'Admin verifies your details', 'Add products and start selling'];

        return (
            <div className="min-h-screen bg-slate-50 pb-24">
                <div className="sticky top-0 z-40 bg-white border-b border-slate-200 flex items-center px-4 py-3 gap-3">
                    <button onClick={() => navigate('/vendor/profile')} className="p-1.5 -ml-1.5 rounded-lg active:bg-slate-100">
                        <FiChevronLeft className="w-6 h-6 text-slate-700" />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-semibold text-slate-900 leading-tight">My Agri-Store</h1>
                        <p className="text-xs text-slate-500">Seeds & fertilizer store</p>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <div className="flex items-start gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${state.tone}`}>
                                <state.icon className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">{state.title}</h2>
                                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{state.text}</p>
                            </div>
                        </div>

                        {approval !== 'pending' && (
                            <button
                                onClick={() => navigate('/vendor/store/registration')}
                                className="w-full mt-5 py-3 bg-[#2E7D32] text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
                            >
                                {approval === 'rejected' ? 'Update & Resubmit' : 'Register My Shop'}
                            </button>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                        <h3 className="text-sm font-semibold text-slate-900 mb-3">How it works</h3>
                        <ol className="space-y-3">
                            {steps.map((step, i) => {
                                const done = approval === 'pending' && i === 0;
                                return (
                                    <li key={step} className="flex items-center gap-3">
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${done ? 'bg-[#2E7D32] text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {done ? '✓' : i + 1}
                                        </span>
                                        <span className={`text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{step}</span>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>

                    <button
                        onClick={() => navigate('/vendor/profile')}
                        className="w-full py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium text-sm active:bg-slate-50 transition-colors"
                    >
                        Back to Profile
                    </button>
                </div>
            </div>
        );
    }

    const inputClass = 'w-full bg-white border border-slate-200 rounded-xl py-3 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-green-100 transition';
    const labelClass = 'block text-sm font-medium text-slate-700 mb-1.5';
    const liveCount = products.filter(p => p.approvalStatus === 'approved').length;
    const productBadge = (product) => {
        if (product.approvalStatus === 'rejected') return { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-100' };
        if (product.approvalStatus !== 'approved') return { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-100' };
        if (product.stock <= 0) return { label: 'Out of Stock', cls: 'bg-red-50 text-red-700 border-red-100' };
        return { label: 'Live', cls: 'bg-green-50 text-green-700 border-green-100' };
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 flex items-center px-4 py-3 gap-3">
                <button onClick={() => navigate('/vendor/profile')} className="p-1.5 -ml-1.5 rounded-lg active:bg-slate-100">
                    <FiChevronLeft className="w-6 h-6 text-slate-700" />
                </button>
                <div className="flex-1">
                    <h1 className="text-lg font-semibold text-slate-900 leading-tight">My Agri-Store</h1>
                    <p className="text-xs text-slate-500">Seeds & fertilizers inventory</p>
                </div>
            </div>

            <div className="p-4 space-y-4 pb-32">
                {/* Shop Information */}
                {shopStatus && (
                    <div className="bg-white rounded-2xl border border-slate-200">
                        <div className="flex items-start justify-between gap-3 p-4">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                                    <FiShoppingBag className="text-[#2E7D32] w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-semibold text-slate-900 truncate">{shopStatus.shopName}</p>
                                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-green-50 text-green-700 border border-green-100 flex-shrink-0">Verified</span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed flex gap-1">
                                        <FiMapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                                        <span>{shopStatus.shopAddress}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => navigate('/vendor/store/registration')}
                                className="p-2 rounded-lg border border-slate-200 text-slate-600 active:bg-slate-50 flex-shrink-0"
                                title="Edit shop info"
                            >
                                <FiEdit2 className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                            <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                <FiFileText className="w-3.5 h-3.5 text-slate-400" />
                                License <span className="font-mono text-slate-700">{shopStatus.shopLicense}</span>
                            </span>
                            {shopStatus.licenseDocument && (
                                <button onClick={() => setShowDocModal(true)} className="text-xs font-medium text-blue-600">
                                    View Document
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="bg-white rounded-2xl border border-slate-200 grid grid-cols-2 divide-x divide-slate-100">
                    <div className="p-4">
                        <p className="text-xs text-slate-500">Total Products</p>
                        <p className="text-xl font-semibold text-slate-900 mt-0.5">{products.length}</p>
                    </div>
                    <div className="p-4">
                        <p className="text-xs text-slate-500">Live Products</p>
                        <p className="text-xl font-semibold text-[#2E7D32] mt-0.5">{liveCount}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={() => {
                            setEditMode(false);
                            setFormData({
                                title: '', categoryId: '', brandName: '', description: '', price: '', unit: 'bag', bagWeight: 50, stock: 1,
                                shippingCharge: 0, imageUrl: '', images: [], specifications: []
                            });
                            setShowModal(true);
                        }}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white bg-[#2E7D32] active:scale-[0.98] transition-transform"
                    >
                        <FiPlus className="w-4 h-4" /> Add Product
                    </button>
                    <button
                        onClick={() => navigate('/vendor/store/orders')}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-slate-700 bg-white border border-slate-200 active:bg-slate-50 transition-colors"
                    >
                        <FiPackage className="w-4 h-4" /> Shop Orders
                    </button>
                </div>

                {/* Inventory */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between pt-1">
                        <h2 className="text-base font-semibold text-slate-900">Inventory</h2>
                        {products.length > 0 && <span className="text-xs text-slate-500">{products.length} items</span>}
                    </div>

                    {loading ? (
                        <div className="py-16 flex justify-center">
                            <div className="w-8 h-8 border-[3px] border-slate-200 border-t-[#2E7D32] rounded-full animate-spin"></div>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
                            <FiPackage className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                            <p className="font-semibold text-slate-800 text-sm">No products added</p>
                            <p className="text-xs text-slate-500 mt-1">Add seeds or fertilizers to start selling.</p>
                        </div>
                    ) : (
                        products.map(product => {
                            const badge = productBadge(product);
                            return (
                                <div key={product._id} className="bg-white p-3 rounded-2xl border border-slate-200">
                                    <div className="flex gap-3">
                                        <div className="w-16 h-16 rounded-xl bg-slate-50 flex-shrink-0 overflow-hidden border border-slate-100">
                                            {product.imageUrl ? (
                                                <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <FiImage className="w-6 h-6" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-slate-900 text-sm truncate">{product.title}</h3>
                                                    <p className="text-xs text-slate-500">{product.brandName || 'Local Brand'} · {product.bagWeight} kg</p>
                                                </div>
                                                <p className="font-semibold text-slate-900 text-sm flex-shrink-0">₹{product.price}</p>
                                            </div>
                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.cls}`}>{badge.label}</span>
                                                    <button
                                                        onClick={() => handleQuickStockUpdate(product)}
                                                        className="text-xs text-slate-600 flex items-center gap-1"
                                                        title="Update stock"
                                                    >
                                                        Stock: {product.stock} {product.unit}s <FiEdit2 className="w-3 h-3 text-slate-400" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => openEdit(product)} className="p-1.5 text-slate-500 rounded-lg active:bg-slate-100" title="Edit">
                                                        <FiEdit2 className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(product._id)} className="p-1.5 text-red-500 rounded-lg active:bg-red-50" title="Delete">
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    {product.approvalStatus === 'rejected' && product.rejectionReason && (
                                        <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">Reason: {product.rejectionReason}</p>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Add/Edit Product - Full Page */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {showModal && (
                        <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.25 }}
                            className="fixed inset-0 z-[100] bg-slate-50 flex flex-col">
                            <div className="bg-white border-b border-slate-200 flex items-center px-4 py-3 gap-3 flex-shrink-0">
                                <button type="button" onClick={() => setShowModal(false)} className="p-1.5 -ml-1.5 rounded-lg active:bg-slate-100">
                                    <FiChevronLeft className="w-6 h-6 text-slate-700" />
                                </button>
                                <div className="flex-1">
                                    <h1 className="text-lg font-semibold text-slate-900 leading-tight">{editMode ? 'Edit Product' : 'Add Product'}</h1>
                                    <p className="text-xs text-slate-500">Seeds & fertilizers details</p>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {/* Photos */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-4">
                                        <h2 className="text-sm font-semibold text-slate-900">Product Photos</h2>
                                        <p className="text-xs text-slate-500 mb-3">Add clear photos of the pack. First photo is shown to farmers.</p>
                                        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                                            {(formData.images || []).map((img, idx) => (
                                                <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                                    <button type="button" onClick={() => setFormData({ ...formData, images: formData.images.filter((_, i) => i !== idx) })}
                                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center" title="Remove photo">
                                                        <FiTrash2 className="text-red-500 w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <label className="w-20 h-20 flex-shrink-0 rounded-xl border border-dashed border-slate-300 bg-slate-50 relative flex flex-col items-center justify-center gap-1 cursor-pointer">
                                                {uploading ? (
                                                    <div className="w-5 h-5 border-2 border-[#2E7D32] border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <FiPlus className="w-5 h-5 text-slate-400" />
                                                        <span className="text-[11px] text-slate-500">Add photo</span>
                                                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" multiple />
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                                        <h2 className="text-sm font-semibold text-slate-900">Product Details</h2>
                                        <div>
                                            <label className={labelClass}>Product Name <span className="text-red-500">*</span></label>
                                            <input required type="text" className={inputClass} placeholder="e.g. Zinc Phosphide, Wheat Seeds" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Brand <span className="text-slate-400 font-normal">(optional)</span></label>
                                            <input type="text" className={inputClass} placeholder="e.g. IFFCO, Bayer" value={formData.brandName} onChange={e => setFormData({ ...formData, brandName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Description <span className="text-slate-400 font-normal">(optional)</span></label>
                                            <textarea rows="3" className={`${inputClass} resize-none`} placeholder="Usage, dosage, suitable crops..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                        </div>
                                    </div>

                                    {/* Price & Stock */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
                                        <h2 className="text-sm font-semibold text-slate-900">Price & Stock</h2>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={labelClass}>Base Price <span className="text-red-500">*</span></label>
                                                <div className="relative">
                                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                                    <input required type="number" min="0" inputMode="decimal" className={`${inputClass} pl-8`} placeholder="0" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Sold per <span className="text-red-500">*</span></label>
                                                <select required className={inputClass} value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })}>
                                                    <option value="bag">Bag</option>
                                                    <option value="packet">Packet</option>
                                                    <option value="kg">KG</option>
                                                    <option value="litre">Litre</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className={labelClass}>Weight (kg) <span className="text-red-500">*</span></label>
                                                <input required type="number" min="0" inputMode="decimal" className={inputClass} value={formData.bagWeight} onChange={e => setFormData({ ...formData, bagWeight: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className={labelClass}>Stock ({formData.unit}s) <span className="text-red-500">*</span></label>
                                                <input required type="number" min="0" inputMode="numeric" className={inputClass} value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                                            </div>
                                        </div>
                                        {/* Shipping Charge - full width */}
                                        <div className="col-span-2">
                                            <label className={labelClass}>Shipping Charge <span className="text-slate-400 font-normal">(optional)</span></label>
                                            <div className="relative">
                                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₹</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    inputMode="decimal"
                                                    className={`${inputClass} pl-8`}
                                                    placeholder="0"
                                                    value={formData.shippingCharge ?? 0}
                                                    onChange={e => setFormData({ ...formData, shippingCharge: e.target.value })}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1 ml-0.5">Amount charged for delivery per unit sold.</p>
                                        </div>
                                        <p className="text-xs text-slate-500 flex gap-1.5 col-span-2">
                                            <FiInfo className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                                            Admin adds GST and commission to your base price before the product goes live.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-white border-t border-slate-200 p-4 flex gap-3 flex-shrink-0">
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium text-sm active:bg-slate-50 transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={uploading}
                                        className="flex-[2] py-3 bg-[#2E7D32] text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50">
                                        {editMode ? 'Update Product' : 'Submit for Review'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
            {/* Document Viewer Modal */}
            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {showDocModal && shopStatus?.licenseDocument && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                exit={{ opacity: 0 }} 
                                onClick={() => setShowDocModal(false)} 
                                className="absolute inset-0 bg-slate-900/90 backdrop-blur-md" 
                            />
                            <motion.div 
                                initial={{ scale: 0.9, opacity: 0 }} 
                                animate={{ scale: 1, opacity: 1 }} 
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="relative w-full max-w-lg bg-white rounded-[40px] overflow-hidden shadow-2xl"
                            >
                                <div className="p-6 flex items-center justify-between border-b border-slate-50">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800">Shop License</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Document</p>
                                    </div>
                                    <button 
                                        onClick={() => setShowDocModal(false)}
                                        className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center font-bold text-slate-400 hover:text-slate-800 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="p-4 bg-slate-50">
                                    <div className="rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-white min-h-[300px] flex items-center justify-center">
                                        <img 
                                            src={shopStatus.licenseDocument} 
                                            alt="License" 
                                            className="max-w-full max-h-[60vh] object-contain"
                                        />
                                    </div>
                                </div>
                                <div className="p-6">
                                    <button 
                                        onClick={() => setShowDocModal(false)}
                                        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[11px]"
                                    >
                                        Close Viewer
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

export default MyStore;
