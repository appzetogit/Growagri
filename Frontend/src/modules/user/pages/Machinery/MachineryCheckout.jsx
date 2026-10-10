import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  FiMapPin, FiTruck, FiCalendar, FiClock, 
  FiCheckCircle, FiShield, FiCreditCard, FiArrowLeft, FiDollarSign
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { bookingService } from '../../../../services/bookingService';
import AddressSelectionModal from '../Checkout/components/AddressSelectionModal';

const MachineryCheckout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { equipment, bookingData } = location.state || {};
    const selectedImplements = bookingData?.selectedImplements || [];

    const [selectedAddress, setSelectedAddress] = useState(null);
    const [showAddressModal, setShowAddressModal] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState('cash'); // Defaulting to COD
    const [submitting, setSubmitting] = useState(false);
    const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false); // Payment confirmation modal

    if (!equipment || !bookingData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-10 text-center">
                <FiTruck size={50} className="text-slate-200 mb-4" />
                <h2 className="text-xl font-black text-slate-800">No Booking Data</h2>
                <button onClick={() => navigate('/user/machinery-explorer')} className="mt-4 text-blue-600 font-bold underline">Go Back</button>
            </div>
        );
    }

    const { rateType, quantity, date, slot, total } = bookingData;

    const handleConfirmBooking = async () => {
        if (!selectedAddress) {
            toast.error('Please select an address first');
            setShowAddressModal(true);
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                serviceId: equipment._id,
                vendorId: equipment.vendorId?._id || equipment.vendorId,
                categoryId: equipment.categoryId?._id || equipment.categoryId,
                bookingType: date ? 'scheduled' : 'instant',
                rental_type: rateType,
                landSize: rateType === 'land_based' ? quantity : undefined,
                estimatedDuration: rateType !== 'land_based' ? quantity : undefined,
                scheduledDate: date,
                scheduledTime: slot,
                timeSlot: { start: slot, end: slot, date, time: slot },
                address: {
                    addressLine1: selectedAddress.addressLine1,
                    addressLine2: selectedAddress.addressLine2 || '',
                    city: selectedAddress.city,
                    state: selectedAddress.state,
                    pincode: selectedAddress.pincode,
                    lat: selectedAddress.lat,
                    lng: selectedAddress.lng
                },
                paymentMethod,
                amount: total,
                basePrice: total,
                // Selected implements (sub-categories like Rotavator, Cultivator etc.)
                selectedImplements: selectedImplements.map(impl => ({
                    subCategoryId: impl.subCategoryId,
                    title: impl.title,
                    pricing: impl.pricing
                })),
                bookedItems: [
                    {
                        title: equipment.name,
                        price: rateType === 'hourly'
                            ? equipment.pricing?.hourly?.price
                            : rateType === 'land_based'
                            ? equipment.pricing?.land_based?.price
                            : equipment.pricing?.daily?.price,
                        quantity: 1,
                        description: `${quantity} ${rateType === 'hourly' ? 'Hours' : rateType === 'land_based' ? 'Acres' : 'Days'}`
                    }
                ]
            };

            const res = await bookingService.create(payload);
            if (res.success) {
                toast.success('Booking Successful!');
                navigate('/user/my-bookings');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Booking failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-32">
            {/* Header */}
            <div className="bg-white border-b border-slate-100 p-5 sticky top-0 z-40">
                <div className="flex items-center gap-4 max-w-xl mx-auto">
                    <button onClick={() => navigate(-1)} className="p-2 bg-slate-50 rounded-xl"><FiArrowLeft/></button>
                    <h1 className="text-lg font-black text-slate-800">Final Confirmation</h1>
                </div>
            </div>

            <div className="max-w-xl mx-auto p-5 space-y-6">
                {/* Address Selection */}
                <div 
                  onClick={() => setShowAddressModal(true)}
                  className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 cursor-pointer hover:border-blue-200 transition-all"
                >
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                            <FiMapPin className="text-blue-500" />
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Farm Address</h3>
                        </div>
                        <span className="text-[10px] font-black text-blue-600 uppercase">Change</span>
                    </div>
                    {selectedAddress ? (
                        <div className="space-y-1">
                            <p className="font-bold text-slate-800 text-sm">{selectedAddress.addressLine1}</p>
                            <p className="text-xs text-slate-400 font-medium">{selectedAddress.city}, {selectedAddress.state} - {selectedAddress.pincode}</p>
                        </div>
                    ) : (
                        <p className="text-sm font-bold text-orange-500">Pick the work location...</p>
                    )}
                </div>

                {/* Booking Summary Card */}
                <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                       <FiTruck size={100} />
                    </div>
                    
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                       <FiCheckCircle className="text-emerald-500" /> Summary
                    </h3>

                    <div className="flex gap-4 mb-6">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0">
                           <img src={equipment.images?.[0]} className="w-full h-full object-cover" />
                        </div>
                        <div>
                             <h4 className="text-sm font-black text-slate-800">{equipment.name}</h4>
                             <p className="text-[10px] font-bold text-slate-400 uppercase">{equipment.categoryId?.title}</p>
                        </div>
                    </div>

                    <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-dotted border-slate-200">
                        <div className="flex justify-between text-xs">
                           <span className="font-bold text-slate-400">Date</span>
                           <span className="font-black text-slate-800 flex items-center gap-1.5"><FiCalendar/> {date}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                           <span className="font-bold text-slate-400">Slot</span>
                           <span className="font-black text-slate-800 flex items-center gap-1.5"><FiClock/> {slot}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                           <span className="font-bold text-slate-400">Duration/Area</span>
                           <span className="font-black text-slate-800 uppercase">{quantity} {rateType}</span>
                        </div>
                        {selectedImplements.length > 0 && (
                          <div className="flex justify-between text-xs pt-2 border-t border-slate-200">
                            <span className="font-bold text-slate-400">Add-ons</span>
                            <span className="font-black text-violet-700 text-right max-w-[60%]">
                              {selectedImplements.map(i => i.title).join(', ')}
                            </span>
                          </div>
                        )}
                    </div>
                </div>

                {/* Payment Logic */}
                <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-100">
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-5 flex items-center gap-2">
                       <FiCreditCard className="text-purple-500" /> Payment Method
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        <button 
                          onClick={() => setPaymentMethod('cash')}
                          className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left
                            ${paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === 'cash' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>₹</div>
                                <span className={`text-sm font-black ${paymentMethod === 'cash' ? 'text-emerald-800' : 'text-slate-400'}`}>Pay After Work (Cash)</span>
                            </div>
                            {paymentMethod === 'cash' && <FiCheckCircle className="text-emerald-500" />}
                        </button>

                        <button 
                          onClick={() => setPaymentMethod('online')}
                          className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left
                            ${paymentMethod === 'online' ? 'border-purple-500 bg-purple-50/50' : 'border-slate-50'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${paymentMethod === 'online' ? 'bg-purple-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <FiCreditCard className="w-4 h-4" />
                                </div>
                                <span className={`text-sm font-black ${paymentMethod === 'online' ? 'text-purple-800' : 'text-slate-400'}`}>Pay Online</span>
                            </div>
                            {paymentMethod === 'online' && <FiCheckCircle className="text-purple-500" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Price Footer */}
            <div className="fixed bottom-0 inset-x-0 bg-white p-6 shadow-2xl rounded-t-[40px] border-t border-slate-100">
                <div className="max-w-xl mx-auto flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Final Amount</p>
                        <h4 className="text-2xl font-black text-slate-800 leading-none">₹{total}</h4>
                    </div>
                    <button
                        onClick={() => setShowPaymentConfirmModal(true)}
                        disabled={submitting}
                        className={`px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl transition-all
                          ${submitting ? 'bg-slate-200 text-slate-400 scale-95' : 'bg-slate-800 text-white active:scale-95 shadow-slate-200'}`}
                    >
                        {submitting ? 'Processing...' : 'Confirm Rental'}
                    </button>
                </div>
            </div>

            <AddressSelectionModal 
              isOpen={showAddressModal}
              onClose={() => setShowAddressModal(false)}
              onSelect={(addr) => setSelectedAddress(addr)}
            />

            {/* ══════════ Payment Confirmation Modal ══════════ */}
            {showPaymentConfirmModal && (
              <div className="fixed inset-0 z-[9999] flex items-end justify-center">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/50 backdrop-blur-[3px]"
                  onClick={() => setShowPaymentConfirmModal(false)}
                />

                {/* Bottom Sheet */}
                <div className="relative bg-white w-full rounded-t-[32px] shadow-2xl z-10 overflow-hidden" style={{ maxHeight: '90vh' }}>
                  {/* Top accent strip */}
                  <div className="h-1 w-full bg-gradient-to-r from-slate-700 to-slate-900" />

                  {/* Drag pill */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1.5 bg-gray-200 rounded-full" />
                  </div>

                  <div className="px-6 pb-8 pt-2">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">Confirm Payment</h3>
                        <p className="text-[11px] text-slate-400 font-medium mt-0.5">Review or change your payment method</p>
                      </div>
                      <button
                        onClick={() => setShowPaymentConfirmModal(false)}
                        className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Amount Banner */}
                    <div className="rounded-2xl px-5 py-4 mb-5 flex items-center justify-between bg-slate-50 border border-slate-200">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Amount</p>
                        <p className="text-2xl font-black text-slate-800">₹{total}</p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-800">
                        <FiTruck className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    {/* Payment Options */}
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Select Payment Method</p>
                    <div className="flex flex-col gap-3 mb-6">
                      {/* Pay After Work (Cash) - shown first as default for machinery */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left ${
                          paymentMethod === 'cash'
                            ? 'border-emerald-500 bg-emerald-50/50 shadow-sm shadow-emerald-100'
                            : 'border-slate-100 hover:border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            paymentMethod === 'cash' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <FiDollarSign className="w-5 h-5" />
                          </div>
                          <div>
                            <span className={`text-sm font-black block ${ paymentMethod === 'cash' ? 'text-emerald-800' : 'text-slate-600'}`}>Pay After Work (Cash)</span>
                            <span className="text-[10px] font-medium text-slate-400">Pay cash directly to operator</span>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-200'
                        }`}>
                          {paymentMethod === 'cash' && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </button>

                      {/* Pay Online */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('online')}
                        className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all text-left ${
                          paymentMethod === 'online'
                            ? 'border-purple-500 bg-purple-50/50 shadow-sm shadow-purple-100'
                            : 'border-slate-100 hover:border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                            paymentMethod === 'online' ? 'bg-purple-500 text-white shadow-md shadow-purple-200' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <FiCreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <span className={`text-sm font-black block ${ paymentMethod === 'online' ? 'text-purple-800' : 'text-slate-600'}`}>Pay Online</span>
                            <span className="text-[10px] font-medium text-slate-400">UPI · Cards · Netbanking</span>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          paymentMethod === 'online' ? 'border-purple-500 bg-purple-500' : 'border-slate-200'
                        }`}>
                          {paymentMethod === 'online' && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                      </button>
                    </div>

                    {/* Confirm Button */}
                    <button
                      onClick={() => {
                        setShowPaymentConfirmModal(false);
                        setTimeout(() => handleConfirmBooking(), 150);
                      }}
                      disabled={submitting}
                      className="w-full py-4 rounded-2xl text-white font-black text-sm tracking-wide transition-all active:scale-95 shadow-lg"
                      style={{
                        background: paymentMethod === 'online'
                          ? 'linear-gradient(135deg, #7c3aed, #9333ea)'
                          : 'linear-gradient(135deg, #059669, #10b981)',
                        boxShadow: paymentMethod === 'online'
                          ? '0 8px 24px #7c3aed44'
                          : '0 8px 24px #05966944'
                      }}
                    >
                      {submitting ? 'Processing...' : paymentMethod === 'online'
                        ? `✦ Proceed to Pay ₹${total}`
                        : `✦ Confirm Rental (Cash) ₹${total}`}
                    </button>

                    <p className="text-center text-[10px] text-slate-400 font-medium mt-3">
                      🔒 Your rental is secured & protected
                    </p>
                  </div>
                </div>
              </div>
            )}
        </div>
    );
};

export default MachineryCheckout;
