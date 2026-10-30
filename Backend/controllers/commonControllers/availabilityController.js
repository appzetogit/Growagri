const mongoose = require('mongoose');
const { istDayKey, slotStartInstant, findEquipmentConflict } = require('../../services/bookingSlotService');

// Standard Agri Slots (farm-local IST times)
const STANDARD_SLOTS = [
    { id: 'morning', label: 'Morning (6:00 AM - 12:00 PM)', start: '06:00', end: '12:00' },
    { id: 'afternoon', label: 'Afternoon (1:00 PM - 6:00 PM)', start: '13:00', end: '18:00' },
    { id: 'full_day', label: 'Full Day (6:00 AM - 6:00 PM)', start: '06:00', end: '18:00' }
];

/**
 * Get available time slots for a specific service (equipment)
 * GET /api/availabilities?serviceId=...&date=YYYY-MM-DD
 */
const getAvailableSlots = async (req, res) => {
    try {
        const { serviceId, date } = req.query;

        if (typeof serviceId !== 'string' || typeof date !== 'string' || !istDayKey(date)) {
            return res.status(400).json({ success: false, message: 'ServiceId and Date are required' });
        }

        // Only a specific machine can be fully booked; catalog services go to any nearby vendor
        const VendorEquipment = require('../../models/VendorEquipment');
        const isSpecificMachine = mongoose.isValidObjectId(serviceId) && await VendorEquipment.exists({ _id: serviceId });

        const now = Date.now();
        const slotsWithAvailability = await Promise.all(STANDARD_SLOTS.map(async (slot) => {
            // Slots that already started today can't be booked
            if (slotStartInstant(date, slot.start).getTime() < now) {
                return { ...slot, isAvailable: false, reason: 'past' };
            }
            if (!isSpecificMachine) return { ...slot, isAvailable: true };

            const conflict = await findEquipmentConflict({ equipmentId: serviceId, scheduledDate: date, timeSlot: slot });
            return {
                ...slot,
                isAvailable: !conflict,
                ...(conflict ? { reason: conflict.maintenance ? 'maintenance' : 'booked' } : {})
            };
        }));

        res.status(200).json({
            success: true,
            data: slotsWithAvailability
        });

    } catch (error) {
        console.error('Availability API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch availability' });
    }
};

module.exports = {
    getAvailableSlots
};
