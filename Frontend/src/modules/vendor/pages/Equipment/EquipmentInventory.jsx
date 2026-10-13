import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiPlus, FiTruck, FiSettings, FiTrash2, FiEdit2, 
  FiClock, FiAlertCircle, FiCheckCircle, FiChevronLeft 
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import vendorEquipmentService from '../../../../services/vendorEquipmentService';
import LogoLoader from '../../../../components/common/LogoLoader';

const EquipmentInventory = () => {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      setLoading(true);
      const res = await vendorEquipmentService.getMyEquipment();
      if (res.success) setEquipment(res.data);
    } catch (err) {
      toast.error('Failed to load your equipment');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this machine?')) return;
    try {
      const res = await vendorEquipmentService.delete(id);
      if (res.success) {
        toast.success('Machine removed');
        setEquipment(prev => prev.filter(e => e._id !== id));
      }
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  // Off = farmers can't see or book this machine, so no bookings come for it
  const handleToggleAvailable = async (item) => {
    const next = item.isAvailable === false;
    const setAvailable = (value) => setEquipment(prev => prev.map(e => e._id === item._id ? { ...e, isAvailable: value } : e));
    setAvailable(next); // optimistic
    try {
      const res = await vendorEquipmentService.update(item._id, { isAvailable: next });
      if (!res.success) throw new Error(res.message);
      toast.success(next ? 'Machine is ON — bookings will come' : 'Machine is OFF — no bookings will come');
    } catch {
      setAvailable(!next);
      toast.error('Could not update. Please try again.');
    }
  };

  const StatusBadge = ({ status }) => {
    const configs = {
      pending: { color: 'bg-amber-50 text-amber-600 border-amber-100', icon: FiClock, label: 'Pending Verification' },
      approved: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: FiCheckCircle, label: 'Verified & Live' },
      active: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: FiCheckCircle, label: 'Live' },
      rejected: { color: 'bg-red-50 text-red-600 border-red-100', icon: FiAlertCircle, label: 'Rejected' },
      inactive: { color: 'bg-slate-50 text-slate-400 border-slate-100', icon: FiSettings, label: 'Offline' }
    };
    const cfg = configs[status] || configs.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${cfg.color}`}>
        <cfg.icon className="w-3 h-3" /> {cfg.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FBFF] pb-28">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-black/[0.03] px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/vendor/dashboard')} className="p-2 bg-slate-100 rounded-xl">
              <FiChevronLeft className="w-6 h-6 text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-tight">My Machinery</h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rentable Inventory</p>
            </div>
          </div>
          <div className="w-12 h-12 bg-slate-200 rounded-2xl animate-pulse"></div>
        </div>
        <div className="p-5 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-[32px] border border-slate-100 p-5 flex gap-4 animate-pulse">
               <div className="w-24 h-24 rounded-[24px] bg-slate-200 flex-shrink-0"></div>
               <div className="flex-1 space-y-3 py-2">
                 <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                 <div className="h-6 bg-slate-200 rounded w-2/3"></div>
                 <div className="h-4 bg-slate-200 rounded w-1/2"></div>
               </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FBFF] pb-28">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-black/[0.03] px-5 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/vendor/dashboard')} className="p-2 bg-slate-100 rounded-xl">
            <FiChevronLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-800 leading-tight">My Machinery</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rentable Inventory</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/vendor/equipment/add')}
          className="bg-blue-600 text-white p-3 rounded-2xl shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
        >
          <FiPlus className="w-6 h-6" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {equipment.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-200 rounded-[40px] p-16 text-center mt-8">
            <FiTruck className="w-14 h-14 text-slate-200 mx-auto mb-4" />
            <p className="font-black text-slate-600 text-lg">No machinery added</p>
            <p className="text-sm text-slate-400 font-medium mt-1">Add your tractors, tools, or harvesters to start receiving rent bookings.</p>
            <button 
              onClick={() => navigate('/vendor/equipment/add')}
              className="mt-6 px-8 py-4 bg-blue-600 text-white rounded-[24px] font-black text-sm shadow-xl shadow-blue-500/20"
            >
              Add My First Machine
            </button>
          </div>
        ) : (
          equipment.map(item => (
            <motion.div 
              key={item._id} layout
              className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden group"
            >
              <div className="p-5 flex gap-4">
                {/* Machine Image */}
                <div className="w-24 h-24 rounded-[24px] overflow-hidden bg-slate-50 flex-shrink-0 border border-slate-100">
                  {item.images && item.images[0] ? (
                    <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-200">
                      <FiTruck className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-0.5">
                        {item.categoryId?.title || 'Machinery'}
                      </p>
                      <h3 className="font-black text-slate-800 text-base truncate">{item.name}</h3>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/vendor/equipment/edit/${item._id}`)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors">
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item._id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors">
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={item.status} />
                    {/* Implements (new schema) */}
                    {item.implements?.map(impl => (
                      <span key={impl._id || impl.subCategoryId?._id} className="inline-block px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 text-[9px] font-bold border border-slate-100">
                        + {impl.subCategoryId?.title || 'Implement'}
                      </span>
                    ))}
                    {/* Legacy subCategoryIds */}
                    {!item.implements?.length && item.subCategoryIds?.map(sub => (
                      <span key={sub._id} className="inline-block px-2 py-0.5 rounded-lg bg-slate-50 text-slate-500 text-[9px] font-bold border border-slate-100">
                        + {sub.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-700">Accept bookings</p>
                  <p className="text-[10px] font-medium text-slate-400">
                    {item.isAvailable === false ? 'Off — no bookings will come for this machine' : 'On — farmers can book this machine'}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.isAvailable !== false}
                  aria-label={`Accept bookings for ${item.name}`}
                  onClick={() => handleToggleAvailable(item)}
                  className={`relative w-12 h-6 rounded-full flex-shrink-0 transition-colors duration-200 ${item.isAvailable === false ? 'bg-slate-300' : 'bg-emerald-500'}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${item.isAvailable === false ? 'translate-x-0' : 'translate-x-6'}`}
                  />
                </button>
              </div>

              {item.status === 'rejected' && item.rejectionReason && (
                <div className="px-5 py-3 bg-red-50 border-t border-red-100">
                  <p className="text-[10px] font-bold text-red-600">
                    <span className="font-black uppercase">Reason:</span> {item.rejectionReason}
                  </p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export default EquipmentInventory;
