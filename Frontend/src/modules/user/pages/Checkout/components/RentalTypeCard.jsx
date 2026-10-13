import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiMap, FiCalendar, FiAlertTriangle, FiCheckCircle, FiLoader } from 'react-icons/fi';
import { bookingService } from '../../../../../services/bookingService';

/**
 * RentalTypeCard - Agriculture Equipment Rental Type Selector
 * Displays: Hourly / Land Based / Monthly options
 * Also checks equipment availability and shows "Next Available Slot" if booked
 *
 * Props:
 *   serviceId       {string}   - The equipment/service ID
 *   selectedDate    {Date}     - Date selected from TimeSlotModal
 *   selectedTime    {string}   - Time slot selected (e.g. "09:00")
 *   onRentalChange  {(type: string) => void}  - Callback when type changes
 */

const RENTAL_OPTIONS = [
    {
        value: 'hourly',
        label: 'Hourly',
        icon: FiClock,
        color: '#2563eb',
        bg: '#eff6ff',
        border: '#bfdbfe',
        desc: 'Pay per hour of usage'
    },
    {
        value: 'land_based',
        label: 'Land Based',
        icon: FiMap,
        color: '#16a34a',
        bg: '#f0fdf4',
        border: '#bbf7d0',
        desc: 'Pay per acre of land'
    },
    {
        value: 'daily',
        label: 'Daily',
        icon: FiCalendar,
        color: '#ea580c',
        bg: '#fff7ed',
        border: '#ffedd5',
        desc: 'Pay per day of usage'
    }
];

const RentalTypeCard = ({ serviceId, selectedDate, selectedTime, onRentalChange, initialRentalType, initialQuantity, landUnit = 'acre', pricing }) => {
    const [selectedRental, setSelectedRental] = useState(initialRentalType || 'hourly');
    const [quantity, setQuantity] = useState(initialQuantity || 1);
    const [checking, setChecking] = useState(false);
    const [availability, setAvailability] = useState(null);

    // Sync quantity when parent updates it (e.g. after TimeSlotModal saves)
    useEffect(() => {
        if (initialQuantity !== undefined && initialQuantity !== null && Number(initialQuantity) > 0) {
            setQuantity(Number(initialQuantity));
        }
    }, [initialQuantity]);

    // Check availability whenever date/time changes
    const checkAvailability = useCallback(async () => {
        const dateToUse = selectedDate || new Date();
        if (!serviceId || !dateToUse) return;

        try {
            setChecking(true);
            setAvailability(null);

            const dateStr = dateToUse instanceof Date
                ? dateToUse.toISOString().split('T')[0]
                : dateToUse;

            const res = await bookingService.checkEquipmentAvailability(serviceId, dateStr, selectedTime);

            if (res.success) {
                setAvailability({
                    available: res.available,
                    nextAvailableSlot: res.nextAvailableSlot || null,
                    message: res.message || ''
                });
            }
        } catch (err) {
            // Silently fail - availability check is non-blocking
            console.warn('Availability check failed (non-critical):', err);
        } finally {
            setChecking(false);
        }
    }, [serviceId, selectedDate, selectedTime]);

    useEffect(() => {
        checkAvailability();
    }, [checkAvailability]);

    const handleSelect = (value) => {
        setSelectedRental(value);
        // Reset quantity to 1 for new type or keep existing if it makes sense
        onRentalChange?.({ type: value, quantity: quantity });
    };

    const handleQuantityChange = (val) => {
        const num = parseFloat(val) || 0;
        setQuantity(num);
        onRentalChange?.({ type: selectedRental, quantity: num });
    };

    // Filter available options based on pricing prop
    const availableOptions = RENTAL_OPTIONS.filter(opt => {
        if (!pricing) return true; // If no pricing provided, show all
        // Return true if price is greater than 0
        return pricing[opt.value] > 0;
    });

    // If no valid options based on pricing, fallback to showing all
    const displayOptions = availableOptions.length > 0 ? availableOptions : RENTAL_OPTIONS;

    // Ensure selectedRental is valid
    useEffect(() => {
        if (!displayOptions.find(opt => opt.value === selectedRental) && displayOptions.length > 0) {
            handleSelect(displayOptions[0].value);
        }
    }, [pricing, selectedRental]);


    // Format today's date (fixed, non-changeable current date)
    const todayFormatted = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-3 mb-2.5 shadow-xs">
            {/* Header */}
            <div className="flex items-center gap-2 mb-2.5">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
                    <span className="text-sm">🚜</span>
                </div>
                <div>
                    <p className="text-xs font-extrabold text-gray-900 leading-tight">Equipment Rental Type</p>
                    <p className="text-[9px] text-gray-400 font-medium">Select how you want to rent this equipment</p>
                </div>
            </div>

            {/* Rental Type Pills */}
            <div className={`grid gap-1.5 mb-2.5`} style={{ gridTemplateColumns: `repeat(${displayOptions.length}, minmax(0, 1fr))` }}>
                {displayOptions.map((opt) => {
                    const isHourly = opt.value === 'hourly';
                    const Icon = isHourly ? FiCalendar : opt.icon;
                    const labelText = isHourly ? todayFormatted : opt.label;
                    const isSelected = selectedRental === opt.value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleSelect(opt.value)}
                            className="flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all active:scale-95"
                            style={{
                                borderColor: isSelected ? opt.color : '#e5e7eb',
                                background: isSelected ? opt.bg : '#fafafa',
                            }}
                        >
                            <Icon
                                className="w-4 h-4"
                                style={{ color: isSelected ? opt.color : '#9ca3af' }}
                            />
                            <span
                                className="text-[10px] font-black text-center leading-tight"
                                style={{ color: isSelected ? opt.color : '#6b7280' }}
                            >
                                {labelText}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Quantity Input based on Type */}
            <div className="mb-2.5 pt-2 border-t border-gray-50">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                        <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                            {selectedRental === 'hourly' && 'Estimated Hours'}
                            {selectedRental === 'land_based' && `Total Area (${landUnit})`}
                            {selectedRental === 'monthly' && 'Duration (Months)'}
                            {selectedRental === 'daily' && 'Number of Days'}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0.5"
                                step="0.1"
                                value={quantity}
                                onChange={(e) => handleQuantityChange(e.target.value)}
                                className="w-full pl-3 pr-10 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                                placeholder={selectedRental === 'land_based' ? "e.g. 5" : "1"}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-400 uppercase">
                                {selectedRental === 'hourly' && 'Hrs'}
                                {selectedRental === 'land_based' && landUnit}
                                {selectedRental === 'monthly' && 'Mo'}
                                {selectedRental === 'daily' && 'Days'}
                            </span>
                        </div>
                    </div>
                </div>
                <p className="text-[8px] text-gray-400 mt-1 italic">
                    * Final amount will be calculated by vendor based on actual {selectedRental === 'land_based' ? landUnit : 'usage'}.
                </p>
            </div>

            {/* Availability Status */}
            {(selectedDate || selectedRental === 'hourly') ? (
                <div className="rounded-lg border overflow-hidden">
                    {checking ? (
                        <div className="flex items-center gap-2 p-2 bg-gray-50">
                            <FiLoader className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                            <p className="text-[10px] text-gray-500 font-medium">Checking equipment availability...</p>
                        </div>
                    ) : availability ? (
                        availability.available ? (
                            <div className="flex items-center gap-2 p-2 bg-green-50 border-green-200">
                                <FiCheckCircle className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                                <div>
                                    <p className="text-[11px] font-bold text-green-800">✅ Equipment Available</p>
                                    <p className="text-[9px] text-green-600">
                                        Available for your selected date & time slot.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-2 bg-red-50 border-red-200">
                                <div className="flex items-center gap-2 mb-1">
                                    <FiAlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                    <p className="text-[11px] font-bold text-red-700">Equipment Already Booked</p>
                                </div>
                                <p className="text-[9px] text-red-600 mb-1.5">
                                    This slot is not available for the selected time.
                                </p>
                                {availability.nextAvailableSlot && (
                                    <div className="bg-white border border-red-100 rounded-lg p-2 flex items-center gap-2">
                                        <FiClock className="w-3 h-3 text-orange-500 flex-shrink-0" />
                                        <div>
                                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Next Available Slot</p>
                                            <p className="text-[11px] font-extrabold text-orange-700">{availability.nextAvailableSlot}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    ) : null}
                </div>
            ) : (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <FiAlertTriangle className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-[10px] text-gray-500 font-medium">
                        {selectedRental === 'monthly' ? 'Select a start date to check availability' : 'Select a date & time to check availability'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default RentalTypeCard;
