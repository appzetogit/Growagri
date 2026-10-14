import React, { useState, useEffect } from 'react';
import {
    FiPlus,
    FiEdit2,
    FiTrash2,
    FiStar,
    FiSearch,
    FiPackage,
    FiFilter,
    FiMoreVertical,
    FiUploadCloud,
    FiUser,
    FiImage,
    FiEye,
    FiX
} from 'react-icons/fi';
import adminProductService from '../../../../services/adminProductService';
import { publicCatalogService } from '../../../../services/catalogService';
import { configService } from '../../../../services/configService';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const EcommerceManager = () => {
    const [products, setProducts] = useState([]);
    const [pendingProducts, setPendingProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);
    const [activeTab, setActiveTab] = useState('marketplace'); // 'marketplace' or 'pending'
    const [platformGst, setPlatformGst] = useState(18); // Settings se aayegi GST

    const [formData, setFormData] = useState({
        title: '',
        categoryId: '',
        brandName: '',
        description: '',
        price: '',
        discountPrice: '',
        unit: 'bag',
        stock: 0,
        imageUrl: '',
        images: [],
        isFeatured: false,
        specifications: [],
        gstPercentage: platformGst, // Settings se aata hai
        commissionPercentage: 10
    });

    useEffect(() => {
        fetchData();
        // Settings se platform GST fetch karo
        configService.getSettings().then(res => {
            if (res.success && res.settings?.serviceGstPercentage != null) {
                const gst = res.settings.serviceGstPercentage;
                setPlatformGst(gst);
                // formData mein bhi update karo taaki naye product form mein sahi GST aaye
                setFormData(prev => ({ ...prev, gstPercentage: gst }));
            }
        });
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [prodRes, pendingRes, catRes] = await Promise.all([
                adminProductService.getAll(),
                adminProductService.getVendorSubmissions('pending', 'physical_good'),
                publicCatalogService.getCategories()
            ]);
            // getAllProducts now returns both admin + approved vendor products
            if (prodRes.success) setProducts((prodRes.data || []).filter(p => p.type === 'physical_good'));
            // Pending tab: Only pending vendor submissions (not yet approved)
            if (pendingRes.success) setPendingProducts(pendingRes.data);
            if (catRes.success) {
                setCategories(catRes.categories || catRes.data || []);
            }
        } catch (err) {
            toast.error("Marketplace data load karne mein dikkat hui");
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        try {
            setUploading(true);
            const token = sessionStorage.getItem('adminAccessToken') || localStorage.getItem('adminAccessToken');
            const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

            const uploadedUrls = [];
            for (const file of files) {
                const uploadFormData = new FormData();
                uploadFormData.append('file', file);

                const res = await fetch(`${baseUrl}/admin/upload`, {
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
                setFormData(prev => ({
                    ...prev,
                    imageUrl: prev.imageUrl || uploadedUrls[0],
                    images: [...(prev.images || []), ...uploadedUrls]
                }));
                toast.success(`${uploadedUrls.length} images upload ho gayi!`);
            }
        } catch (err) {
            toast.error("Image upload fail ho gayi");
        } finally {
            setUploading(false);
        }
    };

    const handleToggleFeatured = async (id) => {
        try {
            const res = await adminProductService.update(id, { isFeatured: !products.find(p => p._id === id).isFeatured });
            if (res.success) {
                setProducts(products.map(p =>
                    p._id === id ? { ...p, isFeatured: res.data.isFeatured } : p
                ));
                toast.success("Featured status updated");
            }
        } catch (err) {
            toast.error("Status update nahi ho paya");
        }
    };

    // Approve straight away with the product's own commission/GST (editable via View before approving)
    const handleApproveClick = async (product) => {
        try {
            const res = await adminProductService.approveProduct(product._id, {
                commissionPercentage: product.commissionPercentage ?? 10,
                gstPercentage: product.gstPercentage ?? platformGst
            });
            if (res.success) {
                toast.success("Product approved and live!");
                fetchData();
            }
        } catch {
            toast.error("Approval failed");
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt("Enter reason for rejection:");
        if (reason === null) return;
        try {
            const res = await adminProductService.rejectProduct(id, reason);
            if (res.success) {
                toast.success("Product rejected");
                fetchData();
            }
        } catch (err) {
            toast.error("Rejection failed");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Kya aap waqai is product ko delete karna chahte hain?")) return;
        try {
            const res = await adminProductService.delete(id);
            if (res.success) {
                setProducts(products.filter(p => p._id !== id));
                toast.success("Product Deleted");
            }
        } catch (err) {
            toast.error("Delete nahi ho paya");
        }
    };

    const inputCls = 'w-full bg-white border border-slate-200 rounded-lg py-2.5 px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition';
    const labelCls = 'block text-sm font-medium text-slate-700 mb-1.5';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.price || !formData.unit) {
            return toast.error("Kripya Title, Price aur Unit bharein");
        }

        try {
            let res;
            if (editMode) {
                res = await adminProductService.update(currentProduct._id, formData);
            } else {
                res = await adminProductService.create(formData);
            }

            if (res.success) {
                toast.success(editMode ? "Product update ho gaya" : "Naya product add ho gaya");
                setShowModal(false);
                fetchData();
                resetForm();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Submit fail ho gaya");
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            categoryId: '',
            brandName: '',
            description: '',
            price: '',
            discountPrice: '',
            unit: 'bag',
            stock: 0,
            imageUrl: '',
            images: [],
            isFeatured: false,
            specifications: [],
            gstPercentage: 18,
            commissionPercentage: 10
        });
        setEditMode(false);
        setCurrentProduct(null);
    };

    const openEdit = (product) => {
        setCurrentProduct(product);
        setFormData({
            title: product.title,
            categoryId: product.categoryId?._id || product.categoryId,
            brandName: product.brandName || '',
            description: product.description || '',
            price: product.price,
            discountPrice: product.discountPrice || '',
            unit: product.unit,
            stock: product.stock,
            imageUrl: product.imageUrl || '',
            images: product.images || (product.imageUrl ? [product.imageUrl] : []),
            isFeatured: product.isFeatured || false,
            specifications: product.specifications || [],
            gstPercentage: product.gstPercentage ?? 18,
            commissionPercentage: product.commissionPercentage ?? 10
        });
        setEditMode(true);
        setShowModal(true);
    };

    const currentList = activeTab === 'marketplace' ? products : pendingProducts;
    const trimmedSearch = searchTerm.trim().toLowerCase();

    const filteredProducts = currentList.filter(p =>
        p.title?.toLowerCase().includes(trimmedSearch) ||
        p.brandName?.toLowerCase().includes(trimmedSearch)
    );

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-slate-800">Marketplace Management</h1>
                    <p className="text-sm text-slate-500 font-medium">Manage Seeds, Fertilizers & Crop Inputs</p>
                </div>
            </div>

            {/* Stats & Search */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Products</p>
                    <p className="text-2xl font-black text-slate-800">{products.length}</p>
                </div>
                <div className="bg-white p-5 rounded-[32px] border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Vendor Entries</p>
                    <p className="text-2xl font-black text-orange-600">{pendingProducts.length}</p>
                </div>
                <div className="md:col-span-2 bg-white px-5 py-2 rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-3">
                    <FiSearch className="text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search Seeds/Fertilizers..."
                        className="flex-1 bg-transparent border-none outline-none font-bold text-slate-700 placeholder:text-slate-300"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('marketplace')}
                    className={`pb-4 px-2 font-black text-sm uppercase tracking-wider transition-all relative ${activeTab === 'marketplace' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    Store Catalog ({products.length})
                    {activeTab === 'marketplace' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 rounded-t-full" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('pending')}
                    className={`pb-4 px-2 font-black text-sm uppercase tracking-wider transition-all relative flex items-center gap-2 ${activeTab === 'pending' ? 'text-orange-600' : 'text-slate-400 hover:text-slate-600'
                        }`}
                >
                    Marketplace Approvals
                    {pendingProducts.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${activeTab === 'pending' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}>
                            {pendingProducts.length}
                        </span>
                    )}
                    {activeTab === 'pending' && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-500 rounded-t-full" />
                    )}
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vendor / Shop</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Price</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                [1, 2, 3].map(i => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan="5" className="px-6 py-8 bg-slate-50/50"></td>
                                    </tr>
                                ))
                            ) : filteredProducts.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center font-bold text-slate-400">No marketplace items found</td>
                                </tr>
                            ) : filteredProducts.map((product) => (
                                <tr key={product._id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                                {product.imageUrl ? (
                                                    <img src={product.imageUrl} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    <FiPackage className="text-slate-400" />
                                                )}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm leading-tight">{product.title}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">{product.brandName || 'Local'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase">
                                            {product.categoryId?.title || 'Agri Item'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {product.vendorId ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                                                    <FiUser className="w-3 h-3 text-teal-600" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-700 text-xs leading-tight">{product.vendorId?.name || 'Vendor'}</p>
                                                    <p className="text-[10px] text-teal-600 font-bold">{product.vendorId?.shopDetails?.shopName || product.vendorId?.businessName || 'Shop'}</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase">Admin Store</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-black text-emerald-600 text-sm">₹{product.discountPrice > 0 ? product.discountPrice : product.price}</p>
                                        {product.discountPrice > 0 && (
                                            <p className="text-[10px] text-slate-300 line-through font-bold">₹{product.price}</p>
                                        )}
                                        <div className="flex gap-1.5 mt-1 text-[9px] font-black uppercase text-slate-400">
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-teal-600">COM: {product.commissionPercentage ?? 10}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className={`font-black text-sm ${product.stock > 10 ? 'text-slate-700' : product.stock > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                                            {product.stock} {product.unit}
                                        </p>
                                        {product.stock === 0 && (
                                            <p className="text-[9px] text-rose-500 font-black uppercase">Out of Stock</p>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {activeTab === 'pending' ? (
                                                <>
                                                    <button type="button" onClick={() => openEdit(product)} className="px-3 py-2 bg-blue-50 text-blue-600 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5"><FiEye className="w-3.5 h-3.5" /> View</button>
                                                    <button type="button" onClick={() => handleApproveClick(product)} className="px-4 py-2 bg-emerald-50 text-emerald-600 font-bold text-xs rounded-xl transition-all">Approve</button>
                                                    <button type="button" onClick={() => handleReject(product._id)} className="px-4 py-2 bg-rose-50 text-rose-600 font-bold text-xs rounded-xl transition-all">Reject</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button type="button" onClick={() => openEdit(product)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all" title="View Details"><FiEye className="w-4 h-4" /></button>
                                                    {!product.vendorId && (
                                                        <button type="button" onClick={() => openEdit(product)} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all" title="Edit"><FiEdit2 className="w-4 h-4" /></button>
                                                    )}
                                                    <button type="button" onClick={() => handleDelete(product._id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Delete"><FiTrash2 className="w-4 h-4" /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Product Modal */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-slate-900/50" />
                        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                            className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 40px)' }}>
                            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">{activeTab === 'pending' ? 'Review Submission' : (editMode ? 'Edit Product' : 'New Marketplace Item')}</h2>
                                    <p className="text-sm text-slate-500">Check the details and pricing before it goes live</p>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                                <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">
                                    {/* Vendor */}
                                    {currentProduct?.vendorId && (
                                        <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                            <div>
                                                <p className="text-xs text-slate-500">Submitted by</p>
                                                <p className="text-sm font-medium text-slate-900">
                                                    {currentProduct.vendorId.name || 'Vendor'}
                                                    {(currentProduct.vendorId.shopDetails?.shopName || currentProduct.vendorId.businessName) && <span className="font-normal text-slate-500"> · {currentProduct.vendorId.shopDetails?.shopName || currentProduct.vendorId.businessName}</span>}
                                                </p>
                                            </div>
                                            <p className="text-sm text-slate-500">{currentProduct.vendorId.phone || currentProduct.vendorId.phoneNumber || currentProduct.vendorId.email}</p>
                                        </div>
                                    )}

                                    {/* Photos */}
                                    <div>
                                        <p className={labelCls}>Product Photos</p>
                                        <div className="flex gap-3 overflow-x-auto pb-1">
                                            {(formData.images || []).map((img, idx) => (
                                                <div key={idx} className="relative w-20 h-20 flex-shrink-0 rounded-lg border border-slate-200 overflow-hidden group">
                                                    <img src={img} alt="" className="w-full h-full object-cover" />
                                                    <button type="button" onClick={() => setFormData({ ...formData, images: formData.images.filter((_, i) => i !== idx) })}
                                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Remove photo">
                                                        <FiTrash2 className="text-red-500 w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                            <label className="w-20 h-20 flex-shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-100 transition-colors">
                                                {uploading ? (
                                                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <FiImage className="w-5 h-5 text-slate-400" />
                                                        <span className="text-[11px] text-slate-500">Add</span>
                                                        <input type="file" className="hidden" onChange={handleImageUpload} accept="image/*" multiple />
                                                    </>
                                                )}
                                            </label>
                                        </div>
                                    </div>

                                    {/* Product details */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-slate-900">Product Details</h3>
                                        <div>
                                            <label className={labelCls}>Title <span className="text-red-500">*</span></label>
                                            <input required className={inputCls} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className={labelCls}>Brand</label>
                                                <input className={inputCls} value={formData.brandName} onChange={e => setFormData({ ...formData, brandName: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Unit <span className="text-red-500">*</span></label>
                                                <input required className={inputCls} placeholder="bag, kg" value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Stock</label>
                                                <input type="number" min="0" className={inputCls} value={formData.stock} onChange={e => setFormData({ ...formData, stock: e.target.value })} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Description</label>
                                            <textarea rows="3" className={`${inputCls} resize-none`} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                        </div>
                                    </div>

                                    {/* Pricing */}
                                    <div className="space-y-4">
                                        <h3 className="text-sm font-semibold text-slate-900">Pricing</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelCls}>Base Price (₹) <span className="text-red-500">*</span></label>
                                                <input type="number" min="0" required className={inputCls} value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className={labelCls}>Admin Commission (%)</label>
                                                <input type="number" min="0" className={inputCls} value={formData.commissionPercentage} onChange={e => setFormData({ ...formData, commissionPercentage: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                                    <button type="button" onClick={() => setShowModal(false)}
                                        className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={uploading}
                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                                        {editMode ? 'Save Changes' : 'Add to Marketplace'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EcommerceManager;
