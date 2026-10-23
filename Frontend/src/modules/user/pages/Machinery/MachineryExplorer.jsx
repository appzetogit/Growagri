import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiSearch, FiFilter, FiMapPin, FiTruck, 
  FiClock, FiStar, FiChevronRight, FiMap, FiArrowLeft 
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { publicEquipmentService } from '../../../../services/publicEquipmentService';
import { useCity } from '../../../../context/CityContext';
import LogoLoader from '../../../../components/common/LogoLoader';
import { themeColors } from '../../../../theme';

const MachineryExplorer = () => {
  const navigate = useNavigate();
  const { currentCity } = useCity();

  // Instant SWR state: Initialize from cache for 0ms frame 1 render
  const [equipment, setEquipment] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_machinery_equipment');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [categories, setCategories] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_machinery_categories');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('cached_machinery_equipment');
    } catch {
      return true;
    }
  });

  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [currentCity, selectedCat]);

  const fetchData = async () => {
    try {
      if (equipment.length === 0) setLoading(true);
      const cityId = currentCity?._id || currentCity?.id;
      
      const [equipsRes, catsRes] = await Promise.all([
        publicEquipmentService.getAllEquipment({ 
          cityId, 
          categoryId: selectedCat?._id || selectedCat?.id 
        }),
        publicEquipmentService.getMachineryCategories(cityId)
      ]);

      if (equipsRes.success) {
        setEquipment(equipsRes.data);
        if (!selectedCat) {
          try {
            localStorage.setItem('cached_machinery_equipment', JSON.stringify(equipsRes.data));
          } catch {}
        }
      }
      if (catsRes.success) {
        setCategories(catsRes.data);
        try {
          localStorage.setItem('cached_machinery_categories', JSON.stringify(catsRes.data));
        } catch {}
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = equipment.filter(e => 
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#F8FBFF' }}>
      <Helmet>
        <title>Rent Agriculture Machinery | {currentCity?.name ? `In ${currentCity.name}` : 'GrooAgri'}</title>
        <meta name="description" content={`Rent top-quality tractors, harvesters, and tools ${currentCity?.name ? `in ${currentCity.name}` : ''}. Verified machinery from professional vendors on GrooAgri.`} />
      </Helmet>
      {/* Header Sticky Container */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-100 px-5 pt-4 pb-4">
        <div className="max-w-xl mx-auto space-y-4">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/user')}
                  className="w-10 h-10 rounded-2xl bg-white border border-slate-200/80 hover:bg-slate-50 active:scale-95 flex items-center justify-center text-slate-700 transition-all shadow-sm"
                  aria-label="Back"
                >
                  <FiArrowLeft size={18} />
                </button>
                <div>
                  <h1 className="text-xl font-black text-slate-800 tracking-tight">Machinery Catalog</h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <FiMapPin className="text-orange-500" /> {currentCity?.name || 'Globally Available'}
                  </p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                <FiTruck size={20} />
              </div>
           </div>

           {/* Search Box */}
           <div className="relative">
             <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
               type="text" 
               placeholder="Search Tractors, Harvesters..."
               className="w-full bg-slate-100 border-none rounded-2xl p-3.5 pl-12 text-sm font-bold focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
           </div>

           {/* Horizontal Category Chips */}
           <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
              <button 
                onClick={() => setSelectedCat(null)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap
                  ${!selectedCat ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
              >
                All Machinery
              </button>
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCat(cat)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap
                    ${selectedCat?.id === cat.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100'}`}
                >
                  {cat.title}
                </button>
              ))}
           </div>
        </div>
      </div>

      {/* Background sync micro indicator */}
      {loading && equipment.length > 0 && (
        <div className="h-0.5 bg-blue-100 overflow-hidden">
          <div className="h-full bg-blue-500 w-1/3 animate-pulse" />
        </div>
      )}

      {loading && equipment.length === 0 ? (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-[40px] border border-slate-100 p-4 space-y-4 shadow-sm">
              <div className="h-48 bg-slate-100 rounded-3xl w-full" />
              <div className="h-6 bg-slate-100 rounded-xl w-3/4" />
              <div className="h-4 bg-slate-100 rounded-lg w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {filtered.length === 0 ? (
            <div className="col-span-full py-20 text-center space-y-4">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto scale-110">
                 <FiTruck className="text-slate-200 text-3xl" />
               </div>
               <div>
                  <p className="text-slate-600 font-black text-lg">No Results Found</p>
                  <p className="text-xs text-slate-400 font-medium">Try changing the category or search term.</p>
               </div>
            </div>
          ) : (
            filtered.map(item => (
              <motion.div 
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                onClick={() => navigate(`/user/machinery/${item._id}`)}
                className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden group active:scale-95 transition-all cursor-pointer"
              >
                {/* Hero Asset Frame */}
                <div className="h-56 relative bg-slate-50 overflow-hidden">
                   {item.images?.[0] ? (
                     <img 
                       src={item.images[0]} 
                       className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                     />
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-slate-100"><FiTruck size={40} className="text-slate-200" /></div>
                   )}
                   
                   {/* Badges */}
                   <div className="absolute top-4 left-4 flex gap-2">
                      <span className="px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[8px] font-black uppercase tracking-widest text-blue-600 shadow-sm border border-white/20">
                        {item.categoryId?.title}
                      </span>
                   </div>

                   <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <div className="bg-white/90 backdrop-blur-md rounded-2xl px-3 py-1.5 shadow-sm border border-white/20">
                         <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-0.5">Starting at</p>
                         <p className="text-sm font-black text-emerald-600 leading-none">
                            ₹{item.pricing?.hourly?.price || item.pricing?.land_based?.price || 'Negotiable'}
                         </p>
                      </div>
                      <div className="bg-blue-600 text-white w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                         <FiChevronRight />
                      </div>
                   </div>
                </div>

                {/* Content Panel */}
                <div className="p-6">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 leading-tight truncate max-w-[200px]">{item.name}</h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight flex items-center gap-1.5">
                           {item.modelNumber} • {item.year} Mfg
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-black text-slate-800 bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                         <FiStar className="fill-amber-400 text-amber-400" />
                         <span>{item.vendorId?.rating || 'New'}</span>
                      </div>
                   </div>

                   <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500 border-t border-slate-50 pt-4">
                      <div className="flex items-center gap-1.5">
                         <FiClock className="text-blue-500" />
                         <span>Fast Booking</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                         <FiMap className="text-emerald-500" />
                         <span>Certified Driver</span>
                      </div>
                   </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default MachineryExplorer;
