import React, { useState, useEffect } from 'react';
import { FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import adminSoilTestService from '../../../../services/adminSoilTestService';

const rupees = (n) => `₹${(Math.round((n || 0) * 100) / 100).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const vendorLabel = (v) => `${v.name || 'Vendor'}${v.labDetails?.labName ? ` (${v.labDetails.labName})` : ''}`;

// Revenue is earned when admin approves the report: that's when the vendor's share is credited
const isEarned = (r) => r.reportStatus === 'approved' && r.paymentStatus === 'paid' && r.vendorId?._id;

const SoilTestingRevenue = () => {
  const [requests, setRequests] = useState([]);
  const [vendorId, setVendorId] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminSoilTestService.getAll()
      .then(res => setRequests((res.data || []).filter(isEarned)))
      .catch(() => toast.error('Failed to load soil test revenue'))
      .finally(() => setLoading(false));
  }, []);

  const vendors = [...new Map(requests.map(r => [r.vendorId._id, r.vendorId])).values()];
  const rows = vendorId === 'all' ? requests : requests.filter(r => r.vendorId._id === vendorId);

  const totals = rows.reduce((t, r) => ({
    farmerPaid: t.farmerPaid + (r.totalAmount || 0),
    vendorEarning: t.vendorEarning + (r.vendorEarning || 0),
    commission: t.commission + (r.adminCommission || 0)
  }), { farmerPaid: 0, vendorEarning: 0, commission: 0 });

  const cards = [
    { label: 'Soil Tests', value: rows.length, color: 'text-gray-900' },
    { label: 'Farmer Paid', value: rupees(totals.farmerPaid), color: 'text-gray-900' },
    { label: 'Vendor Earning', value: rupees(totals.vendorEarning), color: 'text-blue-600' },
    { label: 'Admin Commission', value: rupees(totals.commission), color: 'text-green-600' }
  ];

  const th = 'px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="space-y-4 pt-2">
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <label className="block text-xs font-bold text-gray-700 mb-1">Select Lab Vendor</label>
        <select
          value={vendorId}
          onChange={(e) => setVendorId(e.target.value)}
          className="w-full md:w-96 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:ring-2 focus:ring-green-500 outline-none"
        >
          <option value="all">All Labs</option>
          {vendors.map(v => <option key={v._id} value={v._id}>{vendorLabel(v)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {cards.map(c => (
              <div key={c.label} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{c.label}</p>
                <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {rows.length === 0 ? (
              <div className="py-12 text-center">
                <FiTrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">No approved soil tests with earnings yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className={th}>Request</th>
                      <th className={th}>Farmer</th>
                      <th className={th}>Lab Vendor</th>
                      <th className={th}>Test</th>
                      <th className={th}>Payment</th>
                      <th className={`${th} text-right`}>Farmer Paid</th>
                      <th className={`${th} text-right`}>Vendor Earning</th>
                      <th className={`${th} text-right`}>Admin Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map(r => (
                      <tr key={r._id} className="hover:bg-gray-50/50 align-top">
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-bold text-gray-900">#{r._id.slice(-6).toUpperCase()}</p>
                          <p className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDate(r.updatedAt)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">{r.userId?.name || '—'}</p>
                          <p className="text-[11px] text-gray-500">{r.userId?.phone || r.phoneNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">{vendorLabel(r.vendorId)}</td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-800">{r.testType} Test</p>
                          <p className="text-[11px] text-gray-500">{r.landSize}{r.cropType ? ` · ${r.cropType}` : ''}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-100 capitalize">
                            {r.paymentMethod || 'paid'}
                          </span>
                          <p className="text-[11px] text-gray-500 mt-0.5">{r.commissionPercentage || 0}% commission</p>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{rupees(r.totalAmount)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">{rupees(r.vendorEarning)}</td>
                        <td className="px-4 py-3 text-right text-sm font-black text-green-600">{rupees(r.adminCommission)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-sm">
                      <td className="px-4 py-3" colSpan={5}>Total ({rows.length} soil tests)</td>
                      <td className="px-4 py-3 text-right">{rupees(totals.farmerPaid)}</td>
                      <td className="px-4 py-3 text-right text-blue-600">{rupees(totals.vendorEarning)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{rupees(totals.commission)}</td>
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

export default SoilTestingRevenue;
