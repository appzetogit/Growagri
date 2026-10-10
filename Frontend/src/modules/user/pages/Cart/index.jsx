import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShoppingCart, FiTrash2, FiPlus, FiMinus, FiLoader, FiBell } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../../theme';
import BottomNav from '../../components/layout/BottomNav';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useCart } from '../../../../context/CartContext';
import { useLanguage } from '../../../../context/LanguageContext';
import NotificationBell from '../../components/common/NotificationBell';

const toAssetUrl = (url) => {
  if (!url) return '';
  let clean = url.replace('/api/upload', '/upload');
  if (clean.startsWith('http')) return clean;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

const Cart = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { cartItems, isLoading: loading, removeItem, removeCategoryItems, updateItem, updateItemLocally } = useCart();

  const isMachinery = (item) => {
    return !!(item.hourly_price || item.land_price || item.daily_price || item.category === 'Agriculture' || item.categoryTitle === 'Agriculture');
  };

  const handleRentalTypeChange = (item, type) => {
    const itemId = item._id || item.id;
    let newPrice;
    if (type === 'hourly') newPrice = item.hourly_price || item.unitPrice || item.price;
    else if (type === 'land') newPrice = item.land_price || 0;
    else if (type === 'day') newPrice = item.daily_price || 0;
    else newPrice = item.price;

    // Only update local state — no server call needed for rental type preference
    updateItemLocally(itemId, {
      rentalType: type,
      price: newPrice,
      unitPrice: item.unitPrice || item.hourly_price || item.price, // preserve original unit price
    });
  };

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups = {};
    cartItems.forEach(item => {
      const category = item.category || 'Other';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(item);
    });
    return groups;
  }, [cartItems]);

  const cartCount = cartItems.length;

  const handleBack = () => {
    navigate(-1);
  };

  const handleDeleteCategory = async (category) => {
    try {
      const response = await removeCategoryItems(category);
      if (response.success) {
        toast.success('Category items removed');
      } else {
        toast.error(response.message || 'Failed to remove category items');
      }
    } catch (error) {
      toast.error('Failed to remove category items');
    }
  };

  const handleDelete = async (itemId) => {
    try {
      const response = await removeItem(itemId);
      if (response.success) {
        toast.success('Item removed from cart');
      } else {
        toast.error(response.message || 'Failed to remove item');
      }
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handleQuantityChange = async (itemId, change) => {
    try {
      const item = cartItems.find(i => (i._id || i.id) === itemId);
      if (!item) return;

      const newCount = Math.max(1, (item.serviceCount || 1) + change);
      const response = await updateItem(itemId, newCount);

      if (!response.success) {
        toast.error(response.message || 'Failed to update quantity');
      }
    } catch (error) {
      toast.error('Failed to update quantity');
    }
  };

  const handleAddServices = (category) => {
    // Navigate back to home with instructions to open the category modal
    const itemsInCategory = groupedItems[category];
    const categoryId = itemsInCategory?.[0]?.categoryId;

    navigate('/user', {
      state: {
        openCategoryId: categoryId,
        openCategoryName: category
      }
    });
  };

  const handleCategoryCheckout = (category) => {
    // Pass the selected rentalType from the first machinery item in this category
    const itemsInCategory = groupedItems[category] || [];
    const firstItem = itemsInCategory[0];
    const cartRentalType = firstItem?.rentalType || 'hourly';

    // Map Cart codes → Checkout codes
    const rentalTypeMap = {
      'hourly':  'hourly',
      'land':    'land_based',
      'day':     'daily',
      'daily':   'daily',
      'monthly': 'monthly',
    };
    const checkoutRentalType = rentalTypeMap[cartRentalType] || 'hourly';

    navigate('/user/checkout', {
      state: {
        category,
        rentalType: checkoutRentalType,
      }
    });
  };

  const handleCartClick = () => {
    // Already on cart page
  };

  // Calculate totals for all items
  const totalPrice = cartItems.reduce((sum, item) => sum + (item.price || 0), 0);
  const totalOriginalPrice = cartItems.reduce((sum, item) => {
    const unitOriginalPrice = item.originalPrice || (item.unitPrice || (item.price / (item.serviceCount || 1)));
    return sum + (unitOriginalPrice * (item.serviceCount || 1));
  }, 0);
  return (
    <div className="min-h-screen pb-32 relative bg-white">
      {/* Refined Brand Mesh Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(at 0% 0%, ${themeColors?.brand?.teal || '#347989'}25 0%, transparent 70%),
              radial-gradient(at 100% 0%, ${themeColors?.brand?.yellow || '#D68F35'}20 0%, transparent 70%),
              radial-gradient(at 100% 100%, ${themeColors?.brand?.orange || '#BB5F36'}15 0%, transparent 75%),
              radial-gradient(at 0% 100%, ${themeColors?.brand?.teal || '#347989'}10 0%, transparent 70%),
              radial-gradient(at 50% 50%, ${themeColors?.brand?.teal || '#347989'}03 0%, transparent 100%),
              #FFFFFF
            `
          }}
        />
        {/* Elegant Dot Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(${themeColors?.brand?.teal || '#347989'} 0.8px, transparent 0.8px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Modern Glassmorphism Header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/40 border-b border-black/[0.03] px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-black/[0.02]"
            >
              <FiArrowLeft className="w-5 h-5 text-black" />
            </button>
            <div className="flex items-center gap-2">
              <FiShoppingCart className="w-5 h-5" style={{ color: themeColors.button }} />
              <h1 className="text-xl font-extrabold text-black">{t('Your Cart')}</h1>
              {cartCount > 0 && (
                <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">
                  {cartCount}
                </span>
              )}
            </div>
          </div>
          <NotificationBell />
        </header>

        {/* Cart Items - Grouped by Category */}
        <main className="px-4 py-4" style={{ paddingBottom: cartItems.length > 0 ? '70px' : '100px' }}>
          {loading ? (
            <div className="space-y-6">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
                  {/* Category Header Skeleton */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-gray-200 rounded"></div>
                      <div className="h-3 w-24 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  {/* Items Skeleton */}
                  <div className="space-y-3">
                    <div className="h-10 w-full bg-gray-100 rounded"></div>
                    <div className="h-10 w-full bg-gray-100 rounded"></div>
                  </div>
                  {/* Buttons Skeleton */}
                  <div className="flex gap-2 mt-4">
                    <div className="flex-1 h-10 bg-gray-200 rounded-xl"></div>
                    <div className="flex-1 h-10 bg-gray-300 rounded-xl"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : cartItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <FiShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg font-medium">Your cart is empty</p>
              <p className="text-gray-400 text-sm mt-2">Add services to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([category, items]) => {
                const categoryTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
                const categoryIcon = toAssetUrl(items[0]?.icon || items[0]?.image);
                const serviceCount = items.reduce((sum, item) => sum + (item.serviceCount || 1), 0);

                return (
                  <div
                    key={category}
                    className="bg-white rounded-2xl shadow-md border border-gray-100"
                    style={{
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
                      padding: '16px'
                    }}
                  >
                    {/* Category Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        {/* Category Icon */}
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
                          style={{
                            backgroundColor: `${themeColors.brand.teal}15`,
                            border: `2px solid ${themeColors.brand.teal}20`
                          }}
                        >
                          <img
                            src={categoryIcon}
                            alt={category}
                            className="w-12 h-12 object-contain"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                          <div
                            className="hidden items-center justify-center"
                            style={{
                              width: '48px',
                              height: '48px',
                              display: 'none'
                            }}
                          >
                            <FiShoppingCart className="w-8 h-8" style={{ color: themeColors.button }} />
                          </div>
                        </div>

                        {/* Category Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-black mb-1">{category}</h3>
                          <p className="text-sm text-gray-600">
                            {serviceCount} {serviceCount === 1 ? 'service' : 'services'} • ₹{categoryTotal.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>

                      {/* Delete Category Button */}
                      <button
                        onClick={() => handleDeleteCategory(category)}
                        className="p-2 hover:bg-red-50 rounded-full transition-colors shrink-0"
                      >
                        <FiTrash2 className="w-5 h-5 text-red-500" />
                      </button>
                    </div>

                    {/* Services List */}
                    <div className="mb-4 space-y-3">
                      {items.map((item) => {
                        const isAgri = isMachinery(item);
                        const currentType = item.rentalType || 'hourly';

                        return (
                          <div key={item._id || item.id} className="flex flex-col py-3 border-b border-gray-100 last:border-0 gap-2">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm text-gray-800 font-extrabold uppercase tracking-tight">
                                  {item.title}
                                </p>
                                {item.description && (
                                  <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-black text-emerald-600">
                                    ₹{(item.price || 0).toLocaleString('en-IN')}
                                  </span>
                                  {isAgri && (
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                                      {currentType === 'hourly' ? 'per hour' : currentType === 'land' ? `per ${item.land_unit || 'acre'}` : 'per day'}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDelete(item._id || item.id)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                >
                                  <FiTrash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </div>

                            {isAgri && (
                              <div className="flex flex-col gap-2 bg-gray-50/50 p-2 rounded-xl border border-gray-100">
                                <p className="text-[9px] font-black text-gray-400 uppercase ml-1">Select Rental Type</p>
                                <div className="flex gap-1.5 overflow-x-auto">
                                  {[
                                    { id: 'hourly', label: 'Hourly', price: item.hourly_price || item.unitPrice },
                                    { id: 'land', label: 'Land', price: item.land_price },
                                    { id: 'day', label: 'Daily', price: item.daily_price }
                                  ].filter(opt => opt.price > 0).map((opt) => (
                                    <button
                                      key={opt.id}
                                      onClick={() => handleRentalTypeChange(item, opt.id)}
                                      className={`flex-1 min-w-[70px] flex flex-col items-center py-1.5 rounded-lg border transition-all ${
                                        currentType === opt.id 
                                          ? 'bg-emerald-600 border-emerald-600 shadow-sm shadow-emerald-200' 
                                          : 'bg-white border-gray-200 hover:border-emerald-300'
                                      }`}
                                    >
                                      <span className={`text-[8px] font-black uppercase tracking-tighter ${currentType === opt.id ? 'text-emerald-50' : 'text-gray-400'}`}>
                                        {opt.label}
                                      </span>
                                      <span className={`text-[11px] font-black ${currentType === opt.id ? 'text-white' : 'text-gray-800'}`}>
                                        ₹{opt.price || 0}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddServices(category)}
                        className="flex-1 px-4 py-2.5 bg-white border-2 border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all active:scale-95"
                      >
                        {t('Add Services')}
                      </button>
                      <button
                        onClick={() => handleCategoryCheckout(category)}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 shadow-md"
                        style={{
                          backgroundColor: themeColors.button,
                          boxShadow: `0 2px 6px ${themeColors.brand.teal}4D`
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = themeColors.brand.teal;
                          e.target.style.boxShadow = `0 4px 12px ${themeColors.brand.teal}66`;
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = themeColors.button;
                          e.target.style.boxShadow = `0 2px 6px ${themeColors.brand.teal}4D`;
                        }}
                      >
                        {t('Book')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

      </div>
    </div>
  );
};

export default Cart;
