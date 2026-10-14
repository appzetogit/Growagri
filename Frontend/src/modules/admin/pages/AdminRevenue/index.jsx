import React, { useState, useEffect } from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import adminSettlementService from '../../../../services/adminSettlementService';
import { paymentInfo, PAYMENT_TONES } from '../Bookings/bookingDisplay';

const rupees = (n) => `₹${(Math.round((n || 0) * 100) / 100).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

// One earnings_credit transaction = one booking whose earning reached the vendor.
// VendorBill is the source of truth; booking fields are the fallback for old bookings without a bill.
const toRow = (txn) => {
  const b = txn.bookingId || {};
  const bill = b.vendorBillId || {};
  const farmerPaid = bill.grandTotal ?? b.finalAmount ?? 0;
  const gst = bill.totalGST ?? b.tax ?? 0;
  const vendorEarning = txn.amount || 0;
  return {
    id: txn._id,
    bookingNumber: b.bookingNumber,
    date: b.completedAt || txn.createdAt,
    farmer: b.userId,
    equipment: b.equipmentId?.name || b.serviceName,
    rentalType: b.rental_type,
    duration: b.estimatedDuration,
    payment: paymentInfo(b),
    farmerPaid,
    gst,
    vendorEarning,
    commission: farmerPaid - gst - vendorEarning,
    adminTotal: farmerPaid - vendorEarning
  };
};

const AdminRevenue = () => {
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminSettlementService.getVendorBalances({ limit: 1000 })
      .then(res => setVendors(res.data || []))
      .catch(() => toast.error('Failed to load vendors'));
  }, []);

  useEffect(() => {
    if (!vendorId) { setRows([]); return; }
    setLoading(true);
    adminSettlementService.getVendorLedger(vendorId, { type: 'earnings_credit', limit: 1000 })
      // Skip credits whose booking no longer exists (deleted/unlinked) — nothing to break down
      .then(res => setRows((res.data || []).filter(t => t.bookingId?._id).map(toRow)))
      .catch(() => toast.error('Failed to load bookings'))
      .finally(() => setLoading(false));
  }, [vendorId]);

  const totals = rows.reduce((t, r) => ({
    farmerPaid: t.farmerPaid + r.farmerPaid,
    gst: t.gst + r.gst,
    vendorEarning: t.vendorEarning + r.vendorEarning,
    commission: t.commission + r.commission,
    adminTotal: t.adminTotal + r.adminTotal
  }), { farmerPaid: 0, gst: 0, vendorEarning: 0, commission: 0, adminTotal: 0 });

  const cards = [
    { label: 'Bookings', value: rows.length, color: 'text-gray-900' },
    { label: 'Farmer Paid', value: rupees(totals.farmerPaid), color: 'text-gray-900' },
    { label: 'Vendor Earning', value: rupees(totals.vendorEarning), color: 'text-blue-600' },
    { label: 'GST', value: rupees(totals.gst), color: 'text-amber-600' },
    { label: 'Admin Commission', value: rupees(totals.commission), color: 'text-green-600' },
    { label: 'Admin Total (Comm. + GST)', value: rupees(totals.adminTotal), color: 'text-emerald-700' }
  ];

  const th = 'px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="space-y-4 pt-2">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <label className="block text-xs font-bold text-gray-700 mb-1">Select Vendor</label>
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="w-full md:w-96 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 outline-none"
        >
          <option value="">— Choose a vendor —</option>
          {vendors.map(v => (
            <option key={v._id} value={v._id}>
              {v.name}{v.businessName ? ` (${v.businessName})` : ''}{v.phone ? ` · ${v.phone}` : ''}
            </option>
          ))}
        </select>
      </div>

      {!vendorId ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 py-16 text-center">
          <FiTrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm font-medium">Select a vendor to see booking-wise revenue details</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {cards.map(c => (
              <div key={c.label} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
                <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {rows.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-12">No completed bookings with earnings for this vendor yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className={th}>Booking</th>
                      <th className={th}>Farmer</th>
                      <th className={th}>Equipment</th>
                      <th className={th}>Payment</th>
                      <th className={`${th} text-right`}>Farmer Paid</th>
                      <th className={`${th} text-right`}>Vendor Earning</th>
                      <th className={`${th} text-right`}>GST</th>
                      <th className={`${th} text-right`}>Admin Commission</th>
                      <th className={`${th} text-right`}>Admin Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50/50 align-top">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-gray-900">#{r.bookingNumber || '—'}</p>
                          <p className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDate(r.date)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">{r.farmer?.name || '—'}</p>
                          <p className="text-[11px] text-gray-500">{r.farmer?.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-800">{r.equipment || '—'}</p>
                          {r.rentalType && (
                            <p className="text-[11px] text-gray-500 capitalize">{r.rentalType.replace('_', ' ')}{r.duration ? ` · ${r.duration}` : ''}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${PAYMENT_TONES[r.payment.tone]}`}>{r.payment.label}</span>
                          <p className="text-[11px] text-gray-500 mt-0.5">{r.payment.detail}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{rupees(r.farmerPaid)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">{rupees(r.vendorEarning)}</td>
                        <td className="px-4 py-3 text-right text-sm text-amber-600">{rupees(r.gst)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">{rupees(r.commission)}</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-emerald-700">{rupees(r.adminTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-sm">
                      <td className="px-4 py-3" colSpan={4}>Total ({rows.length} bookings)</td>
                      <td className="px-4 py-3 text-right">{rupees(totals.farmerPaid)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{rupees(totals.vendorEarning)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{rupees(totals.gst)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{rupees(totals.commission)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{rupees(totals.adminTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default AdminRevenue;
