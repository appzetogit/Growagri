import React, { useState, useEffect } from 'react';
import { FiSearch, FiEye, FiEdit2, FiCreditCard, FiAlertCircle, FiUsers, FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import Modal from '../../components/Modal';
import adminSettlementService from '../../../../services/adminSettlementService';

const rupees = (n) => `₹${(Math.round((n || 0) * 100) / 100).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

const PAGE_SIZE = 15;

const VendorWallets = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Modals
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState(null); // 'earnings' | 'edit'
  const [earningsRows, setEarningsRows] = useState({ loading: false, rows: [] });
  const [form, setForm] = useState({ earnings: '', dues: '', cashLimit: '', reason: '' });
  const [saving, setSaving] = useState(false);

  // Pagination (15 per page) + platform-wide totals from the server
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [summary, setSummary] = useState({});

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const res = await adminSettlementService.getVendorBalances({ page, limit: PAGE_SIZE, search: debouncedSearch || undefined });
      setVendors(res.data || []);
      setPagination({ total: res.pagination?.total || 0, pages: res.pagination?.pages || 1 });
      setSummary(res.summary || {});
    } catch {
      toast.error('Failed to load vendor wallets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVendors(); }, [debouncedSearch, page]);

  const close = () => { setMode(null); setSelected(null); };

  // Eye: earnings credited per booking
  const openEarnings = async (vendor) => {
    setSelected(vendor);
    setMode('earnings');
    setEarningsRows({ loading: true, rows: [] });
    try {
      const res = await adminSettlementService.getVendorLedger(vendor._id, { type: 'earnings_credit', limit: 200 });
      // Reversed credits belong to deleted bookings; they don't count, so don't list them
      setEarningsRows({ loading: false, rows: (res.data || []).filter(t => t.status === 'completed') });
    } catch {
      toast.error('Failed to load earnings');
      setEarningsRows({ loading: false, rows: [] });
    }
  };

  const openEdit = (vendor) => {
    setSelected(vendor);
    setMode('edit');
    setForm({ earnings: String(vendor.earnings), dues: String(vendor.amountDue), cashLimit: String(vendor.cashLimit), reason: '' });
  };

  const saveWallet = async () => {
    if (!form.reason.trim()) return toast.error('Please write the reason for this change');
    try {
      setSaving(true);
      await adminSettlementService.updateVendorWallet(selected._id, {
        earnings: Number(form.earnings),
        dues: Number(form.dues),
        cashLimit: Number(form.cashLimit),
        expectedEarnings: selected.earnings,
        expectedDues: selected.amountDue,
        reason: form.reason.trim()
      });
      toast.success('Wallet updated');
      close();
      loadVendors();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update wallet');
    } finally {
      setSaving(false);
    }
  };

  // Totals cover all owners, not just the current page
  const cards = [
    { title: 'Owners', value: summary.totalVendors || 0, icon: FiUsers, tone: 'bg-blue-50 text-blue-600' },
    { title: 'Payable to owners', value: rupees(summary.totalPayableToVendors), icon: FiTrendingUp, tone: 'bg-green-50 text-green-600' },
    { title: 'Cash due to admin', value: rupees(summary.totalDueToAdmin), icon: FiCreditCard, tone: 'bg-red-50 text-red-600' },
    { title: 'Blocked owners', value: summary.blockedVendors || 0, icon: FiAlertCircle, tone: 'bg-orange-50 text-orange-600' }
  ];

  const earnedTotal = earningsRows.rows.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.title} className="bg-white rounded-xl px-3 py-2.5 shadow-sm border border-gray-100 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{c.title}</p>
              <h3 className="text-lg font-black text-gray-800 leading-tight">{c.value}</h3>
            </div>
            <div className={`p-2 rounded-lg shrink-0 ${c.tone}`}><c.icon className="w-4 h-4" /></div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
        <div className="relative w-full md:w-80">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search owner, farm or phone..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                {['Owner', 'Available earnings', 'Cash due / limit', 'Cash to collect', 'Withdrawn', 'Settled', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider ${i === 6 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-xs text-gray-500">Loading wallets...</td></tr>
              ) : vendors.length === 0 ? (
                <tr><td colSpan="7" className="px-4 py-8 text-center text-xs text-gray-500">No owners found</td></tr>
              ) : vendors.map(v => {
                const usedPct = Math.min(((v.amountDue || 0) / (v.cashLimit || 1)) * 100, 100);
                return (
                  <tr key={v._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900 text-xs">{v.name}</p>
                      <p className="text-[10px] text-gray-500">{v.businessName}{v.phone ? ` • ${v.phone}` : ''}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{v.email}</p>
                      {v.isBlocked && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-red-100 text-red-700" title={v.blockReason || ''}>Blocked</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-black text-green-700">{rupees(v.earnings)}</td>
                    <td className="px-4 py-3">
                      <p className="text-[11px] font-semibold text-gray-800">{rupees(v.amountDue)} <span className="text-gray-400 font-normal">/ {rupees(v.cashLimit)}</span></p>
                      <div className="w-28 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div className={`h-full rounded-full ${usedPct >= 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${usedPct}%` }} />
                      </div>
                    </td>
                    {/* What admin still has to collect from this owner now (cash dues after settlements) */}
                    <td className="px-4 py-3" title={`Total cash collected so far: ${rupees(v.totalCashCollected)}`}>
                      <p className={`text-xs font-black ${v.amountDue > 0 ? 'text-red-600' : 'text-gray-500'}`}>{rupees(v.amountDue)}</p>
                      <p className="text-[10px] text-gray-400">{v.amountDue > 0 ? 'pending from vendor' : 'nothing pending'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">{rupees(v.totalWithdrawn)}</td>
                    <td className="px-4 py-3 text-xs text-gray-700">{rupees(v.totalSettled)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => openEarnings(v)} title="Earnings per booking" aria-label={`Earnings per booking of ${v.name}`}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <FiEye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(v)} title="Edit wallet" aria-label={`Edit wallet of ${v.name}`}
                          className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && vendors.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/30">
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">
              Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + vendors.length} of {pagination.total} owners
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500 font-bold mr-1">Page {page} of {Math.max(pagination.pages, 1)}</span>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-50 hover:bg-white transition-all"
              >
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 disabled:opacity-50 hover:bg-white transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Earnings per booking */}
      <Modal isOpen={mode === 'earnings'} onClose={close} title={`Earnings of ${selected?.name || 'owner'}`} size="xl">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Bookings earned from', earningsRows.rows.length],
              ['Total vendor earned', rupees(earnedTotal)],
              ['Available in wallet now', rupees(selected?.earnings)]
            ].map(([label, value]) => (
              <div key={label} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
                <p className="text-sm font-black text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {earningsRows.loading ? (
            <p className="py-10 text-center text-sm text-gray-500">Loading earnings...</p>
          ) : earningsRows.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">No earnings yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="py-2 pr-3">Booking</th>
                    <th className="py-2 pr-3">Farmer</th>
                    <th className="py-2 pr-3">Equipment</th>
                    <th className="py-2 pr-3 text-right">Booking amount</th>
                    <th className="py-2 pr-3">Payment</th>
                    <th className="py-2 pr-3 text-right">Vendor earned</th>
                    <th className="py-2">Credited on</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {earningsRows.rows.map(t => {
                    const b = t.bookingId && typeof t.bookingId === 'object' ? t.bookingId : null;
                    const payAtHome = b && (b.paymentMode === 'pay_at_home' || (!b.paymentMode && (b.cashCollected || ['pay_at_home', 'cash'].includes(b.paymentMethod))));
                    return (
                      <tr key={t._id}>
                        <td className="py-2 pr-3">
                          <span className="font-bold text-blue-600">#{b?.bookingNumber || '—'}</span>
                        </td>
                        <td className="py-2 pr-3">{b?.userId?.name || '—'}<p className="text-[10px] text-gray-400">{b?.userId?.phone || ''}</p></td>
                        <td className="py-2 pr-3">{b?.equipmentId?.name || b?.serviceName || '—'}</td>
                        <td className="py-2 pr-3 text-right">{b ? rupees(b.finalAmount) : '—'}</td>
                        <td className="py-2 pr-3">
                          {b ? (payAtHome ? `Pay at Home${b.cashCollected ? ' (Cash)' : ''}` : 'Online') : '—'}
                        </td>
                        <td className="py-2 pr-3 text-right font-black text-green-700">{rupees(t.amount)}</td>
                        <td className="py-2 text-gray-600 whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[10px] text-gray-400">"Available in wallet now" can be lower than total vendor earned after withdrawals or admin edits.</p>
        </div>
      </Modal>

      {/* Edit wallet */}
      <Modal isOpen={mode === 'edit'} onClose={close} title={`Edit wallet: ${selected?.name || ''}`} size="md">
        <div className="space-y-3">
          {[
            ['earnings', 'Available earnings (admin owes owner)'],
            ['dues', 'Cash due to admin (owner owes admin)'],
            ['cashLimit', 'Cash collection limit']
          ].map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs font-semibold text-gray-700">{label}</span>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-bold">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form[key]}
                  onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              {key !== 'cashLimit' && String(selected?.[key === 'dues' ? 'amountDue' : key]) !== form[key] && (
                <span className="text-[10px] text-amber-600">Was {rupees(selected?.[key === 'dues' ? 'amountDue' : key])}</span>
              )}
            </label>
          ))}
          <label className="block">
            <span className="text-xs font-semibold text-gray-700">Reason (required, saved in the owner's ledger)</span>
            <textarea
              rows={2}
              value={form.reason}
              onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="e.g. Correction for booking BKGA002"
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={close} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={saveWallet} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VendorWallets;
