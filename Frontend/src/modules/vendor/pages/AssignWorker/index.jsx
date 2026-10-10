import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiUser, FiCheck, FiArrowRight, FiUserPlus, FiCamera } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { getBookingById, assignWorker as assignWorkerApi } from '../../services/bookingService';
import { createWorker } from '../../services/workerService';
import maintenanceService from '../../services/maintenanceService';
import { isWithinInterval, parseISO } from 'date-fns';
import api from '../../../../services/api';

const AssignWorker = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [assignToSelf, setAssignToSelf] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState([]);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = themeColors.backgroundGradient;

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load booking details
        const bookingRes = await getBookingById(id);
        if (bookingRes.booking || bookingRes.data) {
          setBooking(bookingRes.booking || bookingRes.data);
        } else {
          throw new Error('Booking not found');
        }

        // Load maintenance
        const maintRes = await maintenanceService.getSchedules();
        setMaintenanceSchedules(maintRes.data || []);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load booking details');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id]);

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/image/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (!data.success) throw new Error(data.message || 'Upload failed');
    return data.imageUrl;
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleAssign = async () => {
    try {
      setAssigning(true);

      let workerId;

      if (assignToSelf) {
        workerId = 'SELF';
      } else {
        if (!newDriverName.trim()) {
          toast.error('Please enter driver name');
          setAssigning(false);
          return;
        }
        if (!newDriverPhone.trim() || !/^\d{10}$/.test(newDriverPhone)) {
          toast.error('Please enter a valid 10-digit mobile number');
          setAssigning(false);
          return;
        }

        let profilePhotoUrl = null;
        if (photoFile) {
          try {
            profilePhotoUrl = await uploadFile(photoFile);
          } catch (uploadErr) {
            console.error('Photo upload failed:', uploadErr);
            toast.error('Failed to upload driver photo, continuing without photo.');
          }
        }

        const workerPayload = {
          name: newDriverName.trim(),
          phone: newDriverPhone.trim(),
          status: 'ONLINE',
          isTemporary: true,
          profilePhoto: profilePhotoUrl
        };

        const createRes = await createWorker(workerPayload);
        if (createRes && createRes.success) {
          const newWorker = createRes.data || createRes.worker;
          workerId = newWorker._id || newWorker.id;
        } else {
          throw new Error(createRes?.message || 'Failed to create driver');
        }
      }

      const response = await assignWorkerApi(id, workerId);

      if (response && response.success) {
        toast.success('Worker assigned successfully');
        // Notify other components
        window.dispatchEvent(new Event('vendorJobsUpdated'));
        navigate(`/vendor/booking/${id}`);
      } else {
        throw new Error(response?.message || 'Failed to assign worker');
      }
    } catch (error) {
      console.error('Error assigning worker:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to assign worker. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  if (loading || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: themeColors.backgroundGradient }}>
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: themeColors.button }}></div>
          <p className="text-gray-600">Loading details...</p>
        </div>
      </div>
    );
  }

  // Helper for address display
  const getAddressString = (addr) => {
    if (!addr) return 'Address not available';
    if (typeof addr === 'string') return addr;
    return `${addr.addressLine1 || ''}, ${addr.city || ''} ${addr.pincode || ''}`;
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Assign Operator" />

      <main className="px-4 py-6">
        {/* Booking Summary */}
        <div
          className="bg-white rounded-xl p-4 mb-6 shadow-md"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="font-bold text-gray-800 mb-2">{booking.serviceName || booking.serviceId?.title || 'Service'}</h3>
          <p className="text-sm text-gray-600">{getAddressString(booking.address || booking.location)}</p>
          <p className="text-sm font-semibold mt-2" style={{ color: themeColors.button }}>
            ₹{booking.finalAmount || booking.price || 0}
          </p>

          {/* Maintenance Warning */}
          {maintenanceSchedules.some(m => 
            String(m.equipmentId?._id || m.equipmentId) === String(booking.serviceId?._id || booking.serviceId) &&
            isWithinInterval(new Date(), {
              start: parseISO(m.startDate),
              end: parseISO(m.endDate)
            })
          ) && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="text-lg">⚠️</span>
              </div>
              <div>
                <p className="text-xs font-black text-rose-700 uppercase tracking-tight">Machine is in Maintenance</p>
                <p className="text-[10px] text-rose-600 font-medium">This machine is currently scheduled for downtime. Assigning now might lead to delays.</p>
              </div>
            </div>
          )}
        </div>

        {/* Self Assignment Option */}
        <div className="mb-6">
          <button
            onClick={() => {
              setAssignToSelf(true);
            }}
            className={`w-full p-4 rounded-xl text-left transition-all ${assignToSelf
              ? 'border-2'
              : 'bg-white border border-gray-200'
              }`}
            style={
              assignToSelf
                ? {
                  borderColor: themeColors.button,
                  background: `${themeColors.button}10`,
                }
                : {
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }
            }
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${assignToSelf ? 'bg-white' : 'bg-gray-100'
                  }`}
                style={
                  assignToSelf
                    ? {
                      border: `3px solid ${themeColors.button}`,
                    }
                    : {}
                }
              >
                {assignToSelf ? (
                  <FiCheck className="w-6 h-6" style={{ color: themeColors.button }} />
                ) : (
                  <FiUser className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">I'll do this job myself</h3>
                <p className="text-sm text-gray-600">Assign the booking to yourself</p>
              </div>
            </div>
          </button>
        </div>

        {/* Current Operator Option */}
        <div className="mb-6">
          <button
            onClick={() => {
              setAssignToSelf(false);
            }}
            className={`w-full p-4 rounded-xl text-left transition-all ${!assignToSelf
              ? 'border-2'
              : 'bg-white border border-gray-200'
              }`}
            style={
              !assignToSelf
                ? {
                  borderColor: themeColors.button,
                  background: `${themeColors.button}10`,
                }
                : {
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                }
            }
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${!assignToSelf ? 'bg-white' : 'bg-gray-100'
                  }`}
                style={
                  !assignToSelf
                    ? {
                      border: `3px solid ${themeColors.button}`,
                    }
                    : {}
                }
              >
                {!assignToSelf ? (
                  <FiCheck className="w-6 h-6" style={{ color: themeColors.button }} />
                ) : (
                  <FiUserPlus className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">Assign Current Operator</h3>
                <p className="text-sm text-gray-600">Enter driver details for this booking</p>
              </div>
            </div>
          </button>

          {/* Form fields for new driver */}
          {!assignToSelf && (
            <div className="mt-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-4">
              {/* Photo Upload Avatar */}
              <div className="flex flex-col items-center justify-center mb-2">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100 flex items-center justify-center">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Driver Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                        <FiUser className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <label htmlFor="driver-photo-upload" className="absolute bottom-0 right-0 p-2 rounded-full cursor-pointer shadow-md transition-transform active:scale-95 hover:scale-105" style={{ background: themeColors.button }}>
                    <FiCamera className="w-4 h-4 text-white" />
                    <input id="driver-photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                </div>
                <p className="text-gray-400 text-[10px] mt-2 font-medium">Add Driver Photo</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Driver Name *</label>
                <input
                  type="text"
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  placeholder="Enter driver's full name"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Driver Phone *</label>
                <input
                  type="tel"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100 text-sm"
                  maxLength={10}
                />
              </div>
            </div>
          )}
        </div>

        {/* Assign Button */}
        <div className="mt-8">
          <button
            onClick={handleAssign}
            disabled={assigning}
            className="w-full py-4 rounded-xl font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: themeColors.button,
              boxShadow: `0 4px 12px ${themeColors.button}40`,
            }}
          >
            {assigning ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Assigning...</span>
              </>
            ) : (
              <>
                <span>Assign Operator</span>
                <FiArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default AssignWorker;
