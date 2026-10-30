import React, { useState, useEffect, useCallback } from 'react';
import { FiClock, FiAlertTriangle, FiCheckCircle, FiLoader, FiChevronDown } from 'react-icons/fi';
import { bookingService } from '../../../../../services/bookingService';

/**
 * RentalTypeCard - Agriculture Equipment Rental Type Selector
 * Allows user to select rental basis: Hour, Minute, Acre, Bigha from a dropdown
 * and enters the corresponding duration or land area directly below.
 * Also checks equipment availability and displays real-time slot status.
 */

const RENTAL_UNITS = [
    {
        value: 'hourly',
        label: 'Hour',
        suffix: 'HRS',
        helperUnit: 'hours',
        placeholder: 'e.g. 1',
        priceKey: 'hourly',
        rateSuffix: '/hr',
        defaultQty: 1
    },
    {
        value: 'minute',
        label: 'Minute',
        suffix: 'MINS',
        helperUnit: 'minutes',
        placeholder: 'e.g. 30',
        priceKey: 'minute',
        rateSuffix: '/min',
        defaultQty: 30
    },
    {
        value: 'acre',
        label: 'Acre',
        suffix: 'ACRES',
        helperUnit: 'acres',
        placeholder: 'e.g. 5',
        priceKey: 'acre',
        rateSuffix: '/acre',
        defaultQty: 1
    },
    {
        value: 'bigha',
        label: 'Bigha',
        suffix: 'BIGHAS',
        helperUnit: 'bighas',
        placeholder: 'e.g. 2',
        priceKey: 'bigha',
        rateSuffix: '/bigha',
        defaultQty: 1
    }
];

const RentalTypeCard = ({
    serviceId,
    selectedDate,
    selectedTime,
    onRentalChange,
    initialRentalType,
    initialQuantity,
    pricing
}) => {
    const normalizedInitial = initialRentalType === 'land_based' ? 'acre' : (initialRentalType || 'hourly');
    const [selectedRental, setSelectedRental] = useState(normalizedInitial);
    const [quantity, setQuantity] = useState(initialQuantity || (normalizedInitial === 'minute' ? 30 : 1));
    const [checking, setChecking] = useState(false);
    const [availability, setAvailability] = useState(null);

    // Sync when initialRentalType changes
    useEffect(() => {
        if (initialRentalType) {
            const norm = initialRentalType === 'land_based' ? 'acre' : initialRentalType;
            setSelectedRental(norm);
        }
    }, [initialRentalType]);

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

            // Local calendar day (toISOString would give the previous day before 5:30 AM IST)
            const dateStr = dateToUse instanceof Date
                ? `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}-${String(dateToUse.getDate()).padStart(2, '0')}`
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

    const options = [
        ...RENTAL_UNITS,
        ...(pricing?.daily > 0 || selectedRental === 'daily' ? [{
            value: 'daily',
            label: 'Day',
            suffix: 'DAYS',
            helperUnit: 'days',
            placeholder: 'e.g. 1',
            priceKey: 'daily',
            rateSuffix: '/day',
            defaultQty: 1
        }] : [])
    ];

    const currentConfig = options.find(opt => opt.value === selectedRental) || options[0];

    const handleSelect = (value) => {
        setSelectedRental(value);
        let newQty = quantity;
        if (value === 'minute' && (!quantity || Number(quantity) <= 1)) {
            newQty = 30;
        } else if (value !== 'minute' && Number(quantity) > 24) {
            newQty = 1;
        } else if (!newQty || Number(newQty) <= 0) {
            newQty = 1;
        }
        setQuantity(newQty);
        onRentalChange?.({ type: value, quantity: newQty });
    };

    const handleQuantityChange = (val) => {
        if (val === '') {
            setQuantity('');
            onRentalChange?.({ type: selectedRental, quantity: 0 });
            return;
        }
        const num = parseFloat(val);
        setQuantity(val);
        if (!isNaN(num)) {
            onRentalChange?.({ type: selectedRental, quantity: num });
        }
    };

    const handleQuantityBlur = () => {
        if (!quantity || parseFloat(quantity) <= 0) {
            const fallback = selectedRental === 'minute' ? 30 : 1;
            setQuantity(fallback);
            onRentalChange?.({ type: selectedRental, quantity: fallback });
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-3.5 mb-2.5 shadow-xs">
            {/* Header */}
            <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-base shadow-2xs">
                    🚜
                </div>
                <div>
                    <p className="text-xs font-black text-gray-900 leading-tight">Equipment Rental Type</p>
                    <p className="text-[10px] text-gray-500 font-medium">Select how you want to rent this equipment</p>
                </div>
            </div>

            {/* 1. Dropdown: Minute, Hour, Acre, Bigha */}
            <div className="mb-3">
                <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wider mb-1.5 block">
                    Select Rental Basis
                </label>
                <div className="relative">
                    <select
                        value={selectedRental}
                        onChange={(e) => handleSelect(e.target.value)}
                        className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg py-2.5 pl-3 pr-10 text-xs font-bold text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all appearance-none cursor-pointer"
                    >
                        {options.map((opt) => {
                            const priceVal = pricing?.[opt.priceKey];
                            const priceLabel = priceVal > 0 ? ` (₹${Number(priceVal).toLocaleString('en-IN')}${opt.rateSuffix})` : '';
                            return (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}{priceLabel}
                                </option>
                            );
                        })}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
                        <FiChevronDown className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* 2. Quantity Input Field Directly Below Dropdown */}
            <div className="mb-3 pt-2.5 border-t border-slate-100">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                        <label className="text-[10px] font-extrabold text-gray-700 uppercase tracking-wider mb-1.5 block">
                            {currentConfig.value === 'minute' && 'Enter Estimated Minutes'}
                            {currentConfig.value === 'hourly' && 'Enter Estimated Hours'}
                            {currentConfig.value === 'acre' && 'Enter Land Area (Acres)'}
                            {currentConfig.value === 'bigha' && 'Enter Land Area (Bighas)'}
                            {currentConfig.value === 'daily' && 'Enter Number of Days'}
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min={selectedRental === 'minute' ? "1" : "0.5"}
                                step={selectedRental === 'minute' ? "1" : "0.5"}
                                value={quantity}
                                onChange={(e) => handleQuantityChange(e.target.value)}
                                onBlur={handleQuantityBlur}
                                className="w-full pl-3 pr-16 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all shadow-2xs"
                                placeholder={currentConfig.placeholder}
                            />
                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-600 uppercase tracking-wider bg-slate-200/80 px-2 py-0.5 rounded">
                                {currentConfig.suffix}
                            </span>
                        </div>
                    </div>
                </div>
                <p className="text-[9px] text-gray-400 mt-1.5 italic">
                    * Final amount will be calculated by vendor based on actual {currentConfig.helperUnit}.
                </p>
            </div>

            {/* 3. Availability Status */}
            {(selectedDate || selectedRental === 'hourly' || selectedRental === 'minute' || selectedRental === 'acre' || selectedRental === 'bigha') ? (
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
                        Select a date & time to check availability
                    </p>
                </div>
            )}
        </div>
    );
};

export default RentalTypeCard;
