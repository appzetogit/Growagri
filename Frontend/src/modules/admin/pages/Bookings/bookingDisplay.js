// Shared display helpers for the admin bookings table and tracking modal

export const titleCase = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export const rupees = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

// Equipment name first, then the booked line items (snapshot taken at booking time)
export const bookingItems = (b) => {
  const items = (b.bookedItems || [])
    .filter(i => i.card?.title || i.serviceName)
    .map(i => `${i.card?.title || i.serviceName}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`);
  const equipment = b.equipmentId?.name;
  if (equipment) return { main: equipment, sub: items.join(', ') };
  return { main: items[0] || b.serviceName || b.serviceId?.title || 'Equipment', sub: items.slice(1).join(', ') };
};

// paymentMode = what the farmer chose; paymentMethod/cashCollected = how it was actually paid.
// Older bookings have no paymentMode, so infer it.
export const paymentInfo = (b) => {
  const method = b.paymentMethod;
  const mode = b.paymentMode
    || (['pay_at_home', 'cash'].includes(method) || b.cashCollected ? 'pay_at_home'
      : method === 'plan_benefit' ? 'plan' : 'online');
  const paid = b.paymentStatus === 'success' || b.cashCollected;
  const onlineVia = ['razorpay', 'wallet', 'upi', 'card'].includes(method) ? titleCase(method) : null;

  if (mode === 'plan') return { label: 'Plan Benefit', detail: paid ? 'Covered' : 'Pending', tone: 'purple', paid };
  if (mode === 'pay_at_home') {
    const via = b.cashCollected ? 'Cash' : onlineVia ? `Online (${onlineVia})` : null;
    return { label: 'Pay at Home', detail: paid && via ? `Paid: ${via}` : 'Not paid yet', tone: 'amber', paid };
  }
  return { label: 'Online', detail: paid ? `Paid via ${onlineVia || 'online'}` : 'Pending', tone: 'blue', paid };
};

export const PAYMENT_TONES = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100'
};
