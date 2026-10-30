const Booking = require('../models/Booking');
const { BOOKING_STATUS } = require('../utils/constants');

/**
 * Slot scheduling helpers. Slots ("07:00"-"08:00", "06:00"-"18:00", full day "00:00"-"23:59") are
 * farm-local (IST) times, so day boundaries and slot instants are computed in IST no matter what
 * timezone the server runs in.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;

// Statuses where the machine is still committed to the slot
const FREED_STATUSES = [BOOKING_STATUS.CANCELLED, BOOKING_STATUS.COMPLETED, BOOKING_STATUS.REJECTED, BOOKING_STATUS.WORK_DONE];

// Unpaid Pay Now drafts hold the slot briefly so two people can't pay for the same machine slot
const DRAFT_HOLD_MS = 30 * 60 * 1000;

/** IST calendar day ("YYYY-MM-DD") of a date input; a bare "YYYY-MM-DD" string is taken as that IST day */
const istDayKey = (input) => {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
};

/** UTC instants of the start/end of an IST day */
const istDayBounds = (input) => {
  const key = istDayKey(input);
  if (!key) return null;
  const start = new Date(Date.parse(`${key}T00:00:00.000Z`) - IST_OFFSET_MS);
  return { key, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) };
};

/** "07:00" / "7:30 AM" -> minutes after midnight, or null for "Now", "ASAP", labels */
const toMinutes = (value) => {
  const match = typeof value === 'string' && value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (match[3]) hours = (hours % 12) + (match[3].toUpperCase() === 'PM' ? 12 : 0);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

/** The instant a booking's slot starts (IST day of scheduledDate + slot start time) */
const slotStartInstant = (scheduledDate, timeStr, fallback = '09:00') => {
  const bounds = istDayBounds(scheduledDate);
  if (!bounds) return null;
  const minutes = toMinutes(timeStr) ?? toMinutes(fallback);
  return new Date(bounds.start.getTime() + minutes * 60 * 1000);
};

/** Do two time slots on the same day overlap? Unparseable slots only clash on an identical start label. */
const slotsOverlap = (a = {}, b = {}) => {
  const aStart = toMinutes(a.start);
  const bStart = toMinutes(b.start);
  if (aStart === null || bStart === null) return !!a.start && a.start === b.start;
  // A missing or non-increasing end (e.g. start === end) is treated as a one-hour slot
  const endOf = (slot, start) => {
    const end = toMinutes(slot.end);
    return end !== null && end > start ? end : start + 60;
  };
  return aStart < endOf(b, bStart) && bStart < endOf(a, aStart);
};

const hhmm = (minutes) => `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * A comparable { start, end } slot. Instant bookings ("Now") use the time they were scheduled for,
 * and old label slots like "Forenoon (10AM-2PM)" use the hours in the label.
 */
const effectiveSlot = (timeSlot, scheduledDate) => {
  if (toMinutes(timeSlot?.start) !== null) return timeSlot;
  const label = String(timeSlot?.start || '').match(/(\d{1,2})\s*(AM|PM)\s*-\s*(\d{1,2})\s*(AM|PM)/i);
  if (label) {
    const h = (hour, ampm) => (parseInt(hour, 10) % 12) + (ampm.toUpperCase() === 'PM' ? 12 : 0);
    return { start: hhmm(h(label[1], label[2]) * 60), end: hhmm(h(label[3], label[4]) * 60) };
  }
  const d = new Date(scheduledDate);
  if (timeSlot?.start && !isNaN(d.getTime())) {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
    return { start: hhmm(minutes), end: hhmm(Math.min(minutes + 60, 23 * 60 + 59)) };
  }
  return timeSlot;
};

/** IST day keys a booking occupies (scheduledDate .. endDate for multi-day rentals) */
const occupiedDays = (scheduledDate, endDate) => {
  const first = istDayBounds(scheduledDate);
  if (!first) return [];
  const last = endDate ? istDayBounds(endDate) : first;
  const days = [];
  for (let t = first.start.getTime(); t <= Math.max(first.start.getTime(), last.start.getTime()) && days.length < 366; t += 86400000) {
    days.push(istDayKey(new Date(t)));
  }
  return days;
};

/**
 * Find an active booking that already holds this machine for an overlapping slot.
 * A machine booking is identified by equipmentId, or by serviceId for bookings made on the machine itself.
 * Returns the clashing booking (or a maintenance record as { maintenance }) or null.
 */
const findEquipmentConflict = async ({ equipmentId, scheduledDate, endDate, timeSlot, excludeBookingId }) => {
  const wantedDays = occupiedDays(scheduledDate, endDate);
  if (!equipmentId || wantedDays.length === 0) return null;

  const rangeStart = istDayBounds(wantedDays[0]).start;
  const rangeEnd = istDayBounds(wantedDays[wantedDays.length - 1]).end;

  const Maintenance = require('../models/Maintenance');
  const maintenance = await Maintenance.findOne({
    equipmentId,
    status: 'active',
    startDate: { $lte: rangeEnd },
    endDate: { $gte: rangeStart }
  });
  if (maintenance) return { maintenance };

  const filter = {
    $or: [{ equipmentId }, { serviceId: equipmentId }],
    status: { $nin: FREED_STATUSES },
    scheduledDate: { $lte: rangeEnd },
    // Multi-day bookings that started earlier can still cover the wanted days
    $and: [{ $or: [{ endDate: { $gte: rangeStart } }, { scheduledDate: { $gte: rangeStart } }] }]
  };
  if (excludeBookingId) filter._id = { $ne: excludeBookingId };

  const BookingDraft = require('../models/BookingDraft');
  const [bookings, drafts] = await Promise.all([
    Booking.find(filter).select('scheduledDate endDate timeSlot scheduledTime bookingNumber'),
    BookingDraft.find({ ...filter, createdAt: { $gte: new Date(Date.now() - DRAFT_HOLD_MS) } }).select('scheduledDate endDate timeSlot scheduledTime')
  ]);

  const wanted = new Set(wantedDays);
  const wantedSlot = effectiveSlot(timeSlot, scheduledDate);
  return [...bookings, ...drafts].find(b => {
    const sharesDay = occupiedDays(b.scheduledDate, b.endDate).some(day => wanted.has(day));
    return sharesDay && slotsOverlap(wantedSlot, effectiveSlot(b.timeSlot?.start ? b.timeSlot : { start: b.scheduledTime }, b.scheduledDate));
  }) || null;
};

module.exports = {
  IST_OFFSET_MS,
  istDayKey,
  istDayBounds,
  toMinutes,
  slotStartInstant,
  slotsOverlap,
  effectiveSlot,
  occupiedDays,
  findEquipmentConflict
};
