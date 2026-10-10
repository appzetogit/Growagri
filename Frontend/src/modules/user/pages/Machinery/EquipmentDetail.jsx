import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FiTruck, FiMapPin, FiStar, FiShield, 
  FiClock, FiCalendar, FiUser, FiPhone,
  FiArrowLeft, FiCheck, FiInfo, FiTag, FiPlus, FiMinus, FiLayers
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { publicEquipmentService } from '../../../../services/publicEquipmentService';
import LogoLoader from '../../../../components/common/LogoLoader';
import BreadcrumbsSchema from '../../../../components/common/BreadcrumbsSchema';
import ServiceSchema from '../../../../components/common/ServiceSchema';
import { toast } from 'react-hot-toast';
import { bookingService } from '../../../../services/bookingService';

const SLOTS = ['Early Morning (6AM-10AM)', 'Forenoon (10AM-2PM)', 'Afternoon (2PM-6PM)'];

const EquipmentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [equipment, setEquipment] = useState(null);
  const [selectedRateType, setSelectedRateType] = useState('hourly');
  const [quantity, setQuantity] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [blockedSlots, setBlockedSlots] = useState({}); // slot -> reason (booked / maintenance)

  // Check each slot against existing bookings + maintenance for the chosen date
  useEffect(() => {
    if (!selectedDate || !equipment?._id) return;
    let cancelled = false;
    Promise.all(SLOTS.map(slot =>
      bookingService.checkEquipmentAvailability(equipment._id, selectedDate, slot)
        .then(r => [slot, r.available === false ? (r.message || 'Not available') : null])
        .catch(() => [slot, null])
    )).then(results => {
      if (cancelled) return;
      const blocked = Object.fromEntries(results.filter(([, reason]) => reason));
      setBlockedSlots(blocked);
      if (blocked[selectedSlot]) setSelectedSlot('');
    });
    return () => { cancelled = true; };
  }, [selectedDate, equipment?._id]);
  const [selectedImplements, setSelectedImplements] = useState([]); // NEW: selected sub-categories

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await publicEquipmentService.getEquipmentById(id);
      if (res.success) {
        setEquipment(res.data);
        // Default rate type based on availability
        if (!res.data.pricing?.hourly?.isEnabled && res.data.pricing?.land_based?.isEnabled) {
          setSelectedRateType('land_based');
        }
      }
    } catch (err) {
      toast.error('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  // Toggle an implement selection
  const toggleImplement = (impl) => {
    setSelectedImplements(prev => {
      const exists = prev.find(i => i.subCategoryId === impl.subCategoryId);
      if (exists) {
        return prev.filter(i => i.subCategoryId !== impl.subCategoryId);
      }
      return [...prev, impl];
    });
  };

  // Calculate implement add-on cost for selected rate type
  const getImplementAddon = () => {
    return selectedImplements.reduce((sum, impl) => {
      const p = impl.pricing?.[selectedRateType];
      if (p?.isEnabled && p?.price > 0) {
        return sum + (p.price * quantity);
      }
      return sum;
    }, 0);
  };

  if (loading) return <LogoLoader />;
  if (!equipment) return <div className="text-center py-20">Equipment not found</div>;

  const currentRate = selectedRateType === 'hourly' 
    ? equipment.pricing?.hourly?.price 
    : selectedRateType === 'land_based'
    ? equipment.pricing?.land_based?.price
    : equipment.pricing?.daily?.price;

  const implementAddon = getImplementAddon();
  const baseTotal = (currentRate || 0) * quantity;
  const total = baseTotal + implementAddon;

  // Implements available for this equipment
  const availableImplements = Array.isArray(equipment.implements) ? equipment.implements : [];

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <Helmet>
        <title>{`${equipment.name} Booking | GrooAgri`}</title>
        <meta name="description" content={`Book ${equipment.name} machinery for your farm. Verified professional operator, affordable rates starting at ₹${currentRate}.`} />
        <link rel="canonical" href={`https://grooagri.com/user/machinery/${id}`} />
      </Helmet>

      {/* SEO Structured Data */}
      <BreadcrumbsSchema items={[
        { name: 'Home', item: '/' },
        { name: 'Machinery', item: '/user/machinery-explorer' },
        { name: equipment.categoryId?.title || 'Category', item: '/user/machinery-explorer' },
        { name: equipment.name, item: `/user/machinery/${id}` }
      ]} />
      <ServiceSchema data={equipment} />

      {/* Dynamic Navbar */}
      <div className="fixed top-0 inset-x-0 z-50 px-5 pt-4">
         <div className="max-w-xl mx-auto flex justify-between items-center bg-white/80 backdrop-blur-md p-2 rounded-3xl border border-white/20 shadow-sm">
            <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-2xl bg-white flex items-center justify-center shadow-sm text-slate-800">
               <FiArrowLeft />
            </button>
            <div className="text-center">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Machinery Detail</p>
               <h1 className="text-sm font-black text-slate-800 truncate max-w-[150px]">{equipment.name}</h1>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
               <FiTruck />
            </div>
         </div>
      </div>

      <div className="max-w-4xl mx-auto">
        {/* Images Frame */}
        <div className="h-[40vh] md:h-[50vh] relative bg-slate-200">
           {equipment.images?.[0] ? (
             <img src={equipment.images[0]} className="w-full h-full object-cover" />
           ) : (
             <div className="w-full h-full flex items-center justify-center"><FiTruck size={60} className="text-white" /></div>
           )}
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
           
           <div className="absolute bottom-10 left-6 right-6">
              <div className="flex items-center gap-2 mb-3">
                 <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-[9px] font-black uppercase tracking-widest">
                   {equipment.categoryId?.title}
                 </span>
                 <span className="px-3 py-1 bg-white/20 backdrop-blur-md text-white border border-white/10 rounded-full text-[9px] font-black uppercase tracking-widest">
                   Verified Asset
                 </span>
              </div>
              <h2 className="text-3xl font-black text-white leading-tight mb-2">{equipment.name}</h2>
              <div className="flex items-center gap-4 text-white/80 text-xs font-bold">
                 <span className="flex items-center gap-1.5"><FiMapPin className="text-orange-400" /> Nearby Available</span>
                 <span className="flex items-center gap-1.5"><FiStar className="text-amber-400 fill-amber-400" /> {equipment.vendorId?.rating || 'New'} Rating</span>
              </div>
           </div>
        </div>

        {/* Content Body */}
        <div className="px-6 -mt-6 relative z-10 space-y-6">
           {/* Section: Rate Selection */}
           <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-5">
                 <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><FiTag size={16}/></div>
                 <h3 className="text-base font-black text-slate-800">Select Rental Type</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 {equipment.pricing?.hourly?.isEnabled && (
                    <button 
                      onClick={() => setSelectedRateType('hourly')}
                      className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2
                        ${selectedRateType === 'hourly' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                       <FiClock className={selectedRateType === 'hourly' ? 'text-blue-600' : 'text-slate-400'} size={20} />
                       <div className="text-center">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${selectedRateType === 'hourly' ? 'text-blue-600' : 'text-slate-400'}`}>Hourly Rate</p>
                          <p className="text-lg font-black text-slate-800">₹{equipment.pricing.hourly.price}<span className="text-[10px] text-slate-400 ml-0.5">/hr</span></p>
                       </div>
                    </button>
                 )}
                 {equipment.pricing?.land_based?.isEnabled && (
                    <button 
                      onClick={() => setSelectedRateType('land_based')}
                      className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2
                        ${selectedRateType === 'land_based' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                       <FiMapPin className={selectedRateType === 'land_based' ? 'text-blue-600' : 'text-slate-400'} size={20} />
                       <div className="text-center">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${selectedRateType === 'land_based' ? 'text-blue-600' : 'text-slate-400'}`}>Acre Rate</p>
                          <p className="text-lg font-black text-slate-800">₹{equipment.pricing.land_based.price}<span className="text-[10px] text-slate-400 ml-0.5">/acre</span></p>
                       </div>
                    </button>
                 )}
                 {equipment.pricing?.daily?.isEnabled && (
                    <button 
                      onClick={() => setSelectedRateType('daily')}
                      className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-2
                        ${selectedRateType === 'daily' ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                       <FiCalendar className={selectedRateType === 'daily' ? 'text-blue-600' : 'text-slate-400'} size={20} />
                       <div className="text-center">
                          <p className={`text-[10px] font-black uppercase tracking-widest ${selectedRateType === 'daily' ? 'text-blue-600' : 'text-slate-400'}`}>Daily Rate</p>
                          <p className="text-lg font-black text-slate-800">₹{equipment.pricing.daily.price}<span className="text-[10px] text-slate-400 ml-0.5">/day</span></p>
                       </div>
                    </button>
                 )}
              </div>
           </div>

           {/* ============================================================ */}
           {/* NEW: Section: Add-on Implements (Sub-categories) Selection   */}
           {/* ============================================================ */}
           <AnimatePresence>
             {availableImplements.length > 0 && (
               <motion.div
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 exit={{ opacity: 0, y: -10 }}
                 className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100"
               >
                 <div className="flex items-center gap-2 mb-5">
                   <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                     <FiLayers size={16} />
                   </div>
                   <div>
                     <h3 className="text-base font-black text-slate-800">Add Implements</h3>
                     <p className="text-[10px] font-medium text-slate-400">Optional add-ons for this machine</p>
                   </div>
                 </div>

                 <div className="space-y-3">
                   {availableImplements.map((impl) => {
                     const isSelected = selectedImplements.some(i => i.subCategoryId === impl.subCategoryId);
                     const addonRate = impl.pricing?.[selectedRateType];
                     const hasPrice = addonRate?.isEnabled && addonRate?.price > 0;

                     return (
                       <motion.button
                         key={impl.subCategoryId}
                         type="button"
                         whileTap={{ scale: 0.98 }}
                         onClick={() => toggleImplement(impl)}
                         className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl border-2 transition-all text-left
                           ${isSelected 
                             ? 'border-violet-500 bg-violet-50/60 shadow-sm shadow-violet-100' 
                             : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}
                       >
                         <div className="flex items-center gap-3">
                           <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0
                             ${isSelected ? 'bg-violet-600' : 'bg-slate-200'}`}>
                             {isSelected 
                               ? <FiCheck className="text-white" size={12} />
                               : <FiPlus className="text-slate-400" size={12} />
                             }
                           </div>
                           <div>
                             <p className={`text-sm font-black ${isSelected ? 'text-violet-800' : 'text-slate-700'}`}>
                               {impl.title}
                             </p>
                             {!hasPrice && (
                               <p className="text-[10px] text-slate-400 font-medium">Included (no extra charge)</p>
                             )}
                           </div>
                         </div>
                         {hasPrice && (
                           <div className="text-right flex-shrink-0">
                             <p className={`text-[10px] font-black uppercase tracking-wide ${isSelected ? 'text-violet-500' : 'text-slate-400'}`}>
                               Add-on
                             </p>
                             <p className={`text-sm font-black ${isSelected ? 'text-violet-700' : 'text-slate-600'}`}>
                               +₹{addonRate.price}
                               <span className="text-[9px] font-bold ml-0.5 opacity-70">
                                 /{selectedRateType === 'hourly' ? 'hr' : selectedRateType === 'land_based' ? 'acre' : 'day'}
                               </span>
                             </p>
                           </div>
                         )}
                       </motion.button>
                     );
                   })}
                 </div>

                 {selectedImplements.length > 0 && (
                   <motion.div
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: 'auto' }}
                     className="mt-4 p-4 bg-violet-600 rounded-2xl"
                   >
                     <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mb-1">Selected Add-ons</p>
                     <div className="flex flex-wrap gap-2">
                       {selectedImplements.map(impl => (
                         <span key={impl.subCategoryId} className="px-3 py-1 bg-white/20 rounded-full text-white text-[10px] font-black">
                           {impl.title}
                         </span>
                       ))}
                     </div>
                     {implementAddon > 0 && (
                       <p className="text-white font-black text-sm mt-2">
                         Add-on total: +₹{implementAddon.toLocaleString()}
                       </p>
                     )}
                   </motion.div>
                 )}
               </motion.div>
             )}
           </AnimatePresence>

           {/* Section: Quantity & Driver */}
           <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                 <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-600"><FiInfo size={16}/></div>
                    <h3 className="text-base font-black text-slate-800">
                      {selectedRateType === 'hourly' ? 'Total Hours' : selectedRateType === 'land_based' ? 'Total Acres' : 'Total Days'}
                    </h3>
                 </div>
                 <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-2xl">
                    <button 
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-800 font-bold active:scale-90 transition-all shadow-sm"
                    >
                      <FiMinus size={14} />
                    </button>
                    <span className="text-lg font-black text-slate-800 w-8 text-center">{quantity}</span>
                    <button 
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-800 font-bold active:scale-90 transition-all shadow-sm"
                    >
                      <FiPlus size={14} />
                    </button>
                 </div>
              </div>

              {equipment.includesDriver && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-4 flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
                      <FiUser size={24} />
                   </div>
                   <div className="flex-1">
                      <p className="text-xs font-black text-slate-800">Operator Included</p>
                      <p className="text-[10px] font-medium text-slate-500">Expert driver will accompany the machinery.</p>
                   </div>
                   {(equipment.driver?.additionalCharge > 0) && (
                     <div className="text-right">
                        <p className="text-[10px] font-black text-blue-600 uppercase">Extra Charge</p>
                        <p className="text-sm font-black text-slate-800">+₹{equipment.driver?.additionalCharge}</p>
                     </div>
                   )}
                </div>
              )}
           </div>

           {/* Section: Availability Selection */}
           <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-5">
                 <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600"><FiCalendar size={16}/></div>
                 <h3 className="text-base font-black text-slate-800">Select Date & Slot</h3>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Booking Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-blue-500/20"
                      value={selectedDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setSelectedDate(e.target.value)}
                    />
                 </div>
                 <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Available Slots</label>
                    <div className="flex flex-wrap gap-2">
                       {SLOTS.map(slot => (
                          <button
                            key={slot}
                            disabled={!!blockedSlots[slot]}
                            title={blockedSlots[slot] || ''}
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all border disabled:opacity-40 disabled:line-through
                              ${selectedSlot === slot ? 'bg-purple-600 border-purple-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500'}`}
                          >
                            {slot}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>

           {/* Section: Specifications */}
           <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
              <h3 className="text-base font-black text-slate-800 mb-4">Specifications</h3>
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Model</p>
                    <p className="text-sm font-black text-slate-800">{equipment.modelNumber || 'N/A'}</p>
                 </div>
                 <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Mfg Year</p>
                    <p className="text-sm font-black text-slate-800">{equipment.year}</p>
                 </div>
              </div>
              <p className="mt-4 text-xs text-slate-500 font-medium leading-relaxed">
                 {equipment.description || "This verified professional machinery is well-maintained and ready for efficient field work. Certified by GrooAgri team."}
              </p>
           </div>
        </div>
      </div>

      {/* Floating Bottom Bar with price breakdown */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-100 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] rounded-t-[40px]">
        <div className="max-w-xl mx-auto">
          {/* Price Breakdown */}
          {implementAddon > 0 && (
            <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
              <span>Base: ₹{baseTotal.toLocaleString()}</span>
              <span>Implements: +₹{implementAddon.toLocaleString()}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Estimated</p>
                <h4 className="text-2xl font-black text-slate-800 leading-none">
                   ₹{total.toLocaleString()}<span className="text-sm text-slate-300 font-bold">.00</span>
                </h4>
             </div>
             <motion.button 
               whileHover={{ scale: 1.02 }}
               whileTap={{ scale: 0.98 }}
               onClick={() => {
                  if (!selectedDate || !selectedSlot) {
                    toast.error('Please select date and slot');
                    return;
                  }
                  navigate('/user/machinery/checkout', { 
                    state: { 
                      equipment, 
                      bookingData: {
                        rateType: selectedRateType,
                        quantity,
                        date: selectedDate,
                        slot: selectedSlot,
                        total,
                        selectedImplements  // NEW: pass selected implements
                      }
                    } 
                  });
               }}
               className="px-10 py-4 bg-emerald-600 text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl shadow-emerald-500/30 flex items-center gap-2"
             >
              <span>Book Now</span>
              <FiCheck size={18} />
             </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EquipmentDetail;
