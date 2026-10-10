import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FiX, FiLayers, FiArrowLeft, FiPlus, FiCheck } from 'react-icons/fi';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import { themeColors } from '../../../../../theme';
import { publicCatalogService } from '../../../../../services/catalogService';
import { useCart } from '../../../../../context/CartContext';
import { toast } from 'react-hot-toast';
import SlotPicker from '../../../components/booking/SlotPicker';

const toAssetUrl = (url) => {
  if (!url) return '';
  const clean = url.replace('/api/upload', '/upload');
  if (clean.startsWith('http')) return clean;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

const CategoryModal = React.memo(({ isOpen, onClose, category, currentCity }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [isClosing, setIsClosing] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const [view, setView] = useState('services'); // 'services' | 'attachments'
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [services, setServices] = useState([]); // Sub-services
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const cityId = currentCity?._id || currentCity?.id;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsClosing(false);
      // Reset state on close
      setTimeout(() => {
        setView('services');
        setSelectedBrand(null);
        setServices([]);
        setIsRedirecting(false);
      }, 300);
    } else if (category) {
      const slug = (category.slug || '').toLowerCase();
      const title = (category.title || '').toLowerCase();
      if (slug.includes('soil') || title.includes('soil')) {
        onClose();
        navigate('/user/soil-testing');
        return;
      }
      if (category.id || category._id) {
        // Fetch Services directly for this category
        fetchServicesDirectly();
      }
    }
  }, [isOpen, category?.id, category?._id, cityId]);

  const fetchServicesDirectly = async () => {
    try {
      setLoading(true);
      const response = await publicCatalogService.getServices({
        categoryId: category?.id || category?._id,
        cityId: cityId,
        forceRefresh: true
        // Don't filter by pricing_context — show all services for this category
      });
      if (response.success) {
        setServices(response.services || []);
      }
    } catch (error) {
      console.error("Failed to load services directly:", error);
    } finally {
      setLoading(false);
    }
  };


  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState(null);
  const [availableImplements, setAvailableImplements] = useState([]);
  const [selectedImplements, setSelectedImplements] = useState([]);

  const isRentalCategory = (categoryTitle) => {
    if (!categoryTitle) return false;
    const rentals = ['tractor', 'harvester', 'drone', 'heavy', 'planting', 'irrigation', 'crop protection', 'land preparation', 'modern equipment', 'machinery', 'agriculture'];
    return rentals.some(r => categoryTitle.toLowerCase().includes(r));
  };

  const handleServiceClick = async (service) => {
    // Check if we need to pick attachments (implements)
    if (isRentalCategory(category?.title)) {
      setSelectedServiceForBooking(service);
      setLoading(true);
      try {
        // Find attachments where parentSourceId matches the parent category ID
        const parentId = category?._id || category?.id;
        const res = await publicCatalogService.getServices({
          pricing_context: 'sub-category',
          parentSourceId: parentId
        });
        if (res?.success && res.services?.length > 0) {
          setAvailableImplements(res.services);
          setSelectedImplements([]);
          setView('attachments');
        } else {
          // No implements, direct add
          processAddToCart(service);
        }
      } catch (err) {
        console.error("Failed to fetch attachments:", err);
        processAddToCart(service);
      } finally {
        setLoading(false);
      }
    } else {
      // Direct add for non-rentals
      processAddToCart(service);
    }
  };

  const calculateTotals = () => {
    const parent = selectedServiceForBooking || {};
    const total = {
      hourly: parent.hourly_price || 0,
      land: parent.land_price || 0,
      daily: parent.daily_price || 0
    };

    selectedImplements.forEach(impl => {
      total.hourly += (impl.hourly_price || 0);
      total.land += (impl.land_price || 0);
      total.daily += (impl.daily_price || 0);
    });

    return total;
  };

  const toggleImplement = (impl) => {
    setSelectedImplements(prev => {
      const exists = prev.find(i => (i._id || i.id) === (impl._id || impl.id));
      if (exists) {
        return prev.filter(i => (i._id || i.id) !== (impl._id || impl.id));
      }
      return [...prev, impl];
    });
  };

  const handleProcessWithAttachments = () => {
    processAddToCart(selectedServiceForBooking, null, null, selectedImplements);
  };

  const processAddToCart = async (service, slot = null, date = null, implementsToAdd = []) => {
    // Add to cart logic
    try {
      if (service) {
        // Add parent machine first
        await addToCart({
          serviceId: service?._id || service?.id,
          equipmentId: service?.equipmentId || (service?.isVendorEquipment ? (service?._id || service?.id) : null),
          isVendorEquipment: !!service?.isVendorEquipment,
          vendorId: service?.vendorId || selectedBrand?._id || selectedBrand?.id || null,
          title: service.title,
          description: service.description || '',
          icon: toAssetUrl(service.icon || ''),
          price: service.hourly_price || service.price || service.discountPrice || service.basePrice || 0,
          hourly_price: service.hourly_price,
          land_price: service.land_price,
          land_unit: service.land_unit,
          daily_price: service.daily_price,
          categoryId: category?._id || category?.id,
          categoryTitle: category?.title || 'Agriculture',
          category: category?.title || 'Agriculture',
          brandId: selectedBrand?._id || selectedBrand?.id,
          sectionTitle: selectedBrand?.title || '',
          sectionIcon: toAssetUrl(selectedBrand?.iconUrl || selectedBrand?.icon || ''),
          scheduledDate: date,
          timeSlot: slot
        });

        // Add selected implements
        for (const impl of implementsToAdd) {
          await addToCart({
            serviceId: impl?._id || impl?.id,
            title: impl.title,
            description: impl.description || '',
            icon: toAssetUrl(impl.icon || ''),
            price: impl.hourly_price || impl.price || 0,
            hourly_price: impl.hourly_price,
            land_price: impl.land_price,
            land_unit: impl.land_unit,
            daily_price: impl.daily_price,
            pricing_context: 'sub-category',
            parentSourceId: service?._id || service?.id,
            categoryId: category?._id || category?.id,
            category: category?.title || 'Agriculture'
          });
        }
        
        setIsRedirecting(true);
        setTimeout(() => {
          setIsRedirecting(false);
          onClose();
          // Fast-track for rentals, regular flow for others
          const isRental = isRentalCategory(category?.title);
          if (isRental) {
            navigate('/user/checkout', {
              state: {
                category: category?.title,
                rentalType: 'hourly'
              }
            });
          } else {
            navigate('/user/cart');
          }
        }, 1200);
      }
    } catch {
      toast.error('Failed to add to cart. Try again.');
    }
  };


  if (!isOpen && !isClosing) return null;
  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 240 }}
          className="fixed inset-0 z-[9999] bg-[#F8FBFF] flex flex-col h-full w-full overflow-hidden"
        >
          {/* Top Sticky Navigation Bar */}
          <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (view === 'attachments' || view === 'slots') setView('services');
                  else onClose();
                }}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700 transition-all"
                aria-label="Back"
              >
                <FiArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="font-black text-slate-900 text-base sm:text-lg leading-tight line-clamp-1">
                  {view === 'attachments'
                    ? `Attachments for ${selectedServiceForBooking?.title}`
                    : (category?.title || 'Services')}
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                  {view === 'attachments' ? 'Step 2: Choose tools required' : 'Select a machine to continue'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {loading && (
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              )}
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-600 transition-all"
                aria-label="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Full-Page Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 py-6 pb-28">
            {isRedirecting ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6"
                >
                  <FiCheck className="w-10 h-10 text-green-500" />
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Service Added!</h3>
                <p className="text-gray-500 text-sm">Proceeding to checkout...</p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto">
                {loading && services.length === 0 ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 p-4" />
                    ))}
                  </div>
                ) : (
                  <>
                    {view === 'attachments' ? (
                      // Attachments View
                      <div className="space-y-6 pb-32">
                        {/* Machine Summary Snippet */}
                        <div className="bg-slate-50 p-4 rounded-[14px] border border-slate-100 flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm overflow-hidden">
                            {toAssetUrl(selectedServiceForBooking?.icon) ? (
                              <img src={toAssetUrl(selectedServiceForBooking?.icon)} className="w-full h-full object-cover" />
                            ) : <FiLayers className="w-6 h-6 text-slate-300" />}
                          </div>
                          <div>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Selected Machine</h4>
                            <h3 className="font-black text-slate-800 text-sm">{selectedServiceForBooking?.title}</h3>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 max-h-[40vh] overflow-y-auto pr-1">
                          {availableImplements.map((impl) => {
                            const isSelected = selectedImplements.some(i => (i._id || i.id) === (impl._id || impl.id));
                            return (
                              <div
                                key={impl.id || impl._id}
                                onClick={() => toggleImplement(impl)}
                                className={`p-4 border-2 rounded-[14px] flex flex-col gap-3 transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'border-emerald-600 bg-emerald-50/50 shadow-md' 
                                    : 'border-gray-100 bg-white hover:border-gray-200'
                                }`}
                              >
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <h3 className="font-extrabold text-gray-900 text-sm italic uppercase">{impl.title}</h3>
                                    <p className="text-[10px] text-gray-400 font-medium line-clamp-1">{impl.description || 'Rental implement attachment'}</p>
                                  </div>
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                    isSelected ? 'bg-emerald-600 border-emerald-600' : 'border-gray-200'
                                  }`}>
                                    {isSelected && <FiCheck className="w-4 h-4 text-white" />}
                                  </div>
                                </div>
                                
                                {/* Pricing Row */}
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {impl.hourly_price > 0 && (
                                    <div className="flex-1 min-w-[70px] flex flex-col bg-white p-2 rounded-xl border border-gray-100 items-center">
                                      <span className="text-[7px] font-black text-gray-400 uppercase">Hourly</span>
                                      <span className="text-[11px] font-black text-emerald-700">+₹{impl.hourly_price}</span>
                                    </div>
                                  )}
                                  {impl.land_price > 0 && (
                                    <div className="flex-1 min-w-[70px] flex flex-col bg-white p-2 rounded-xl border border-gray-100 items-center">
                                      <span className="text-[7px] font-black text-gray-400 uppercase">Land (/{impl.land_unit || 'Ac'})</span>
                                      <span className="text-[11px] font-black text-teal-700">+₹{impl.land_price}</span>
                                    </div>
                                  )}
                                  {impl.daily_price > 0 && (
                                    <div className="flex-1 min-w-[70px] flex flex-col bg-white p-2 rounded-xl border border-gray-100 items-center">
                                      <span className="text-[7px] font-black text-gray-400 uppercase">Daily</span>
                                      <span className="text-[11px] font-black text-blue-700">+₹{impl.daily_price}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Sticky Summary / Total Bar */}
                        <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-slate-100 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] z-50">
                          <div className="max-w-2xl mx-auto flex flex-col gap-4">
                            {/* Aggregated Prices Preview */}
                            <div className="flex items-center justify-between px-2">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hourly</span>
                                <span className="text-xl font-black text-slate-900">₹{calculateTotals().hourly}</span>
                              </div>
                              <div className="h-10 w-px bg-slate-100"></div>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Land</span>
                                <span className="text-xl font-black text-slate-900">₹{calculateTotals().land}</span>
                              </div>
                              <div className="h-10 w-px bg-slate-100"></div>
                              <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Daily</span>
                                <span className="text-xl font-black text-slate-900">₹{calculateTotals().daily}</span>
                              </div>
                            </div>

                            <button
                              onClick={handleProcessWithAttachments}
                              className="w-full py-4 rounded-2xl text-white font-extrabold text-base shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
                              style={{ 
                                backgroundColor: themeColors.button,
                                boxShadow: `0 8px 16px ${themeColors.brand.teal}3D`
                              }}
                            >
                              Proceed to Booking ({selectedImplements.length + 1} Items)
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Services List
                      services.length > 0 ? (
                        <div className="space-y-3">
                          {services.map((svc) => (
                            <div key={svc.id || svc._id} className="p-4 border border-gray-100 rounded-[14px] bg-white shadow-sm flex flex-col gap-3 hover:border-gray-200 transition-all">
                              <div className="flex items-start gap-3">
                                {toAssetUrl(svc.icon) ? (
                                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-50 flex-shrink-0 border border-slate-100">
                                    <img src={toAssetUrl(svc.icon)} alt={svc.title} className="w-full h-full object-cover" />
                                  </div>
                                ) : null}
                                <div className="flex-1 min-w-0 pr-2">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <h3 className="font-bold text-gray-900 text-base leading-snug">{svc.title}</h3>
                                    {svc.isVendorEquipment && (
                                      <span className="px-1.5 py-0.5 bg-orange-50 border border-orange-100 text-orange-600 rounded text-[9px] font-black uppercase tracking-wider">
                                        {svc.vendorName ? `By ${svc.vendorName}` : 'Verified Fleet'}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-400 font-medium line-clamp-1">{svc.description || 'Professional rental equipment service'}</p>
                                </div>
                                <button
                                  onClick={() => handleServiceClick(svc)}
                                  className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-black flex items-center gap-1.5 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm flex-shrink-0"
                                >
                                  <FiPlus className="w-4 h-4" /> Add
                                </button>
                              </div>

                              <div className="flex gap-2 py-3 px-2 bg-gray-50/50 rounded-lg border border-gray-50 overflow-x-auto">
                                {(svc.hourly_price > 0 || svc.basePrice > 0) && (
                                  <div className="flex-1 min-w-[70px] flex flex-col items-center">
                                    <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-wider">Hourly</span>
                                    <span className="text-[13px] font-extrabold text-gray-900">₹{svc.hourly_price || svc.basePrice}</span>
                                  </div>
                                )}
                                {svc.land_price > 0 && (
                                  <div className={`flex-1 min-w-[70px] flex flex-col items-center ${
                                    (svc.hourly_price > 0 || svc.basePrice > 0) ? 'border-l border-gray-100 pl-2' : ''
                                  }`}>
                                    <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-wider">Land ({svc.land_unit || 'Acre'})</span>
                                    <span className="text-[13px] font-extrabold text-gray-900">₹{svc.land_price}</span>
                                  </div>
                                )}
                                {svc.daily_price > 0 && (
                                  <div className={`flex-1 min-w-[70px] flex flex-col items-center ${
                                    (svc.hourly_price > 0 || svc.basePrice > 0 || svc.land_price > 0) ? 'border-l border-gray-100 pl-2' : ''
                                  }`}>
                                    <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-wider">Daily</span>
                                    <span className="text-[13px] font-extrabold text-gray-900">₹{svc.daily_price}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-20 text-gray-500">
                          <p>No equipment available in this category yet.</p>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
});

CategoryModal.displayName = 'CategoryModal';
export default CategoryModal;
