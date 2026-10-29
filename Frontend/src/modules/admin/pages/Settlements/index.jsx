import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiDollarSign, FiCheck, FiX, FiEye, FiClock, FiUsers, FiTrendingUp, FiAlertCircle, FiSliders, FiEdit2 } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import adminSettlementService from '../../../../services/adminSettlementService';
import { getSettings } from '../../services/settingsService';

const SettlementManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  // Two views only: 'withdrawals' (Vendor Withdraw page) and 'owners' (everything settlement-related)
  const [activeTab, setActiveTab] = useState(() => location.pathname.endsWith('/withdrawals') ? 'withdrawals' : 'owners');
  const [dashboard, setDashboard] = useState(null);
  const [pendingSettlements, setPendingSettlements] = useState([]);
  const [owners, setOwners] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState([]);
  const [withdrawView, setWithdrawView] = useState('pending'); // 'pending' | 'history'
  const [actionLoading, setActionLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [minWithdrawalLimit, setMinWithdrawalLimit] = useState(100);
  const [minLimitInput, setMinLimitInput] = useState('100');
  const [savingLimit, setSavingLimit] = useState(false);

  // Modal State
  const [activeModal, setActiveModal] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalInput, setModalInput] = useState('');
  const [modalInput2, setModalInput2] = useState('');
  const [cashLedger, setCashLedger] = useState({ loading: false, rows: [] });
  const [settleHistory, setSettleHistory] = useState({ loading: false, rows: [] });

  // Keep the view in sync with the URL
  useEffect(() => {
    setActiveTab(location.pathname.endsWith('/withdrawals') ? 'withdrawals' : 'owners');
  }, [location.pathname]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Always load dashboard
      const dashRes = await adminSettlementService.getDashboard();
      if (dashRes.success) {
        setDashboard(dashRes.data);
      }

      if (activeTab === 'owners') {
        const [pendingRes, ownersRes] = await Promise.all([
          adminSettlementService.getPendingSettlements(),
          adminSettlementService.getVendorBalances({ filterDue: 'true' })
        ]);
        if (pendingRes.success) setPendingSettlements(pendingRes.data || []);
        if (ownersRes.success) setOwners(ownersRes.data || []);
      } else if (activeTab === 'withdrawals') {
        const [res, setRes, historyRes] = await Promise.all([
          adminSettlementService.getWithdrawalRequests(),
          adminSettlementService.getWithdrawalSettings().catch(() => getSettings()),
          adminSettlementService.getWithdrawalRequests({ status: 'history', limit: 50 }).catch(() => null)
        ]);
        if (res.success) setWithdrawals(res.data || []);
        if (historyRes?.success) setWithdrawalHistory(historyRes.data || []);

        const settingsData = setRes?.data || setRes?.settings;
        if (settingsData) {
          setSettings(settingsData);
          const limit = settingsData.minWithdrawalAmount ?? 100;
          setMinWithdrawalLimit(limit);
          setMinLimitInput(String(limit));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // --- Modal Openers ---
  const openApproveSettlement = (item) => {
    setSelectedItem(item);
    setActiveModal('approve_settlement');
  };

  const openRejectSettlement = (item) => {
    setSelectedItem(item);
    setModalInput('');
    setActiveModal('reject_settlement');
  };

  const openBlockVendor = (vendor) => {
    setSelectedItem(vendor);
    setModalInput('');
    setActiveModal('block_owner');
  };

  const openUnblockVendor = (vendor) => {
    setSelectedItem(vendor);
    setActiveModal('unblock_owner');
  };

  const openUpdateLimit = (vendor) => {
    setSelectedItem(vendor);
    setModalInput(vendor.cashLimit || 10000);
    setActiveModal('update_limit');
  };

  const openApproveWithdrawal = (item) => {
    setSelectedItem(item);
    setModalInput('');
    setActiveModal('approve_withdrawal');
  };

  const openRejectWithdrawal = (item) => {
    setSelectedItem(item);
    setModalInput('');
    setActiveModal('reject_withdrawal');
  };

  // Which bookings this owner collected cash for (cash_collected ledger entries + booking details)
  const openCashLedger = async (vendor) => {
    setSelectedItem(vendor);
    setActiveModal('cash_ledger');
    setCashLedger({ loading: true, rows: [] });
    try {
      const res = await adminSettlementService.getVendorLedger(vendor._id, { type: 'cash_collected', limit: 200 });
      setCashLedger({ loading: false, rows: res.data || [] });
    } catch (error) {
      toast.error('Failed to load cash bookings');
      setCashLedger({ loading: false, rows: [] });
    }
  };

  // Every dues payment this owner made (online or recorded by admin), newest first
  const openSettleHistory = async (vendor) => {
    setSelectedItem(vendor);
    setActiveModal('settle_history');
    setSettleHistory({ loading: true, rows: [] });
    try {
      const res = await adminSettlementService.getSettlementHistory({ vendorId: vendor._id, limit: 200 });
      setSettleHistory({ loading: false, rows: res.data || [] });
    } catch (error) {
      toast.error('Failed to load settlement history');
      setSettleHistory({ loading: false, rows: [] });
    }
  };

  const closeModals = () => {
    setActiveModal(null);
    setSelectedItem(null);
    setModalInput('');
    setModalInput2('');
  };

  // --- Action Handlers ---
  const handleApproveSettlement = async () => {
    try {
      setActionLoading(true);
      const res = await adminSettlementService.approveSettlement(selectedItem._id);
      if (res.success) {
        toast.success('Settlement approved!');
        loadData();
        closeModals();
      } else {
        toast.error(res.message || 'Failed to approve');
      }
    } catch (error) {
      toast.error('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSettlement = async () => {
    if (!modalInput.trim()) return toast.error('Rejection reason is required');
    try {
      setActionLoading(true);
      const res = await adminSettlementService.rejectSettlement(selectedItem._id, modalInput);
      if (res.success) {
        toast.success('Settlement rejected');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockVendor = async () => {
    if (!modalInput.trim()) return toast.error('Blocking reason is required');
    try {
      setActionLoading(true);
      const res = await adminSettlementService.blockVendor(selectedItem._id, modalInput);
      if (res.success) {
        toast.success('Owner blocked');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to block');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateLimitSubmit = async () => {
    if (!modalInput || isNaN(modalInput)) return toast.error('Valid limit required');
    try {
      setActionLoading(true);
      const res = await adminSettlementService.updateCashLimit(selectedItem._id, parseInt(modalInput));
      if (res.success) {
        toast.success('Limit updated');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to update limit');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockVendorSubmit = async () => {
    try {
      setActionLoading(true);
      const res = await adminSettlementService.unblockVendor(selectedItem._id);
      if (res.success) {
        toast.success('Owner unblocked');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to unblock');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveWithdrawalSubmit = async () => {
    const ref = modalInput.trim() || `MANUAL-${Date.now()}`;
    try {
      setActionLoading(true);
      const res = await adminSettlementService.approveWithdrawal(selectedItem._id, { transactionReference: ref });
      if (res.success) {
        toast.success('Withdrawal approved');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectWithdrawalSubmit = async () => {
    if (!modalInput.trim()) return toast.error('Rejection reason required');
    try {
      setActionLoading(true);
      const res = await adminSettlementService.rejectWithdrawal(selectedItem._id, modalInput);
      if (res.success) {
        toast.success('Withdrawal rejected');
        loadData();
        closeModals();
      }
    } catch (error) {
      toast.error('Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateMinLimit = async (customAmount) => {
    const rawVal = customAmount !== undefined ? customAmount : minLimitInput;
    const amountToSave = Number(rawVal);
    if (isNaN(amountToSave) || amountToSave < 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }
    try {
      setSavingLimit(true);
      const res = await adminSettlementService.updateMinWithdrawalLimit(amountToSave);
      if (res.success) {
        setMinWithdrawalLimit(amountToSave);
        setMinLimitInput(String(amountToSave));
        setSettings(prev => ({ ...(prev || {}), minWithdrawalAmount: amountToSave }));
        toast.success(res.message || `Minimum withdrawal limit set to ₹${amountToSave.toLocaleString()}`);
        if (activeModal === 'update_min_withdrawal') {
          closeModals();
        }
      } else {
        toast.error(res.message || 'Failed to update minimum withdrawal limit');
      }
    } catch (error) {
      console.error('Error updating minimum withdrawal limit:', error);
      toast.error(error.response?.data?.message || 'Failed to update limit');
    } finally {
      setSavingLimit(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  /* --- Dynamic Dashboard Card Renderer --- */
  const renderDashboardCards = () => {
    if (loading && !dashboard) return null;

    let cards = [];

    if (activeTab === 'withdrawals') {
      // Withdrawals specific stats
      const pendingCount = withdrawals.length;
      const pendingAmount = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);

      const withdrawalCards = [
        {
          title: 'Total Pending Amount',
          value: `₹${pendingAmount.toLocaleString()}`,
          icon: FiDollarSign,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-100'
        },
        {
          title: 'Pending Requests',
          value: pendingCount,
          icon: FiClock,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100'
        },
        {
          title: 'Avg. Payout',
          value: pendingCount > 0 ? `₹${Math.round(pendingAmount / pendingCount).toLocaleString()}` : '₹0',
          icon: FiTrendingUp,
          color: 'text-green-600',
          bg: 'bg-green-50',
          border: 'border-green-100'
        }
      ];

      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
            {withdrawalCards.map((card, index) => (
              <div
                key={index}
                className={`bg-white rounded-xl px-4 py-3 shadow-sm border ${card.border}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{card.title}</p>
                    <h3 className="text-lg font-black text-gray-800 tracking-tight leading-tight">{card.value}</h3>
                  </div>
                  <div className={`p-2 rounded-lg shrink-0 ${card.bg} ${card.color}`}>
                    <card.icon className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}

          {/* Min. withdrawal limit: own row on small screens, 4th column on xl */}
          <div className="sm:col-span-3 xl:col-span-1 bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Min. Withdrawal Limit</span>
              <span className="text-xs font-bold text-emerald-600">Active: ₹{minWithdrawalLimit.toLocaleString()}</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdateMinLimit();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minLimitInput}
                  onChange={(e) => setMinLimitInput(e.target.value)}
                  placeholder="100"
                  className="w-28 pl-6 pr-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all shadow-inner"
                />
              </div>
              <button
                type="submit"
                disabled={savingLimit || Number(minLimitInput) === minWithdrawalLimit}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                  Number(minLimitInput) !== minWithdrawalLimit
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 shadow-emerald-600/20 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {savingLimit ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <FiCheck className="w-3.5 h-3.5" />
                    <span>Update Limit</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      );
    } else if (activeTab === 'owners' || activeTab === 'vendors') {
      // Owner Payables stats
      const totalOwners = owners.length;
      const totalDue = owners.reduce((sum, v) => sum + (v.amountDue || 0), 0);
      const blockedCount = owners.filter(v => v.isBlocked).length;
      const totalLimit = owners.reduce((sum, v) => sum + (v.cashLimit || 0), 0);

      cards = [
        {
          title: 'Total Due from Owners',
          value: `₹${totalDue.toLocaleString()}`,
          icon: FiDollarSign,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-100'
        },
        {
          title: 'Owners with Dues',
          value: totalOwners,
          icon: FiUsers,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100'
        },
        {
          title: 'Blocked Owners',
          value: blockedCount,
          icon: FiAlertCircle,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-100'
        },
        {
          title: 'Total Cash Limit',
          value: `₹${(totalLimit / 100000).toFixed(1)}L`,
          icon: FiCheck,
          color: 'text-indigo-600',
          bg: 'bg-indigo-50',
          border: 'border-indigo-100'
        }
      ];
    } else {
      // Default Pending Tab (use dashboard data)
      if (!dashboard) return null;
      cards = [
        {
          title: 'Total Due to Admin',
          value: `₹${dashboard.totalDueToAdmin?.toLocaleString() || 0}`,
          icon: FiDollarSign,
          color: 'text-red-600',
          bg: 'bg-red-50',
          border: 'border-red-100'
        },
        {
          title: 'Pending Settlements',
          value: dashboard.pendingSettlements?.count || 0,
          icon: FiClock,
          color: 'text-orange-600',
          bg: 'bg-orange-50',
          border: 'border-orange-100'
        },
        {
          title: "Today's Collection",
          value: `₹${dashboard.todayCashCollected?.amount?.toLocaleString() || 0}`,
          icon: FiTrendingUp,
          color: 'text-blue-600',
          bg: 'bg-blue-50',
          border: 'border-blue-100'
        },
        {
          title: 'Settled (Last 7 Days)',
          value: `₹${dashboard.weeklySettlements?.amount?.toLocaleString() || 0}`,
          icon: FiCheck,
          color: 'text-green-600',
          bg: 'bg-green-50',
          border: 'border-green-100'
        }
      ];
    }

    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, index) => (
          <div
            key={index}
            onClick={card.onClick}
            className={`bg-white rounded-xl px-3 py-2.5 shadow-sm border ${card.border} ${
              card.onClick ? 'cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider truncate">{card.title}</p>
                  {card.actionText && (
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      {card.actionText}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-gray-800 tracking-tight leading-tight">{card.value}</h3>
              </div>
              <div className={`p-2 rounded-lg shrink-0 ${card.bg} ${card.color}`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };
  // --- Render Helpers ---

  const renderPendingSettlements = () => (
    pendingSettlements.length === 0 ? (
      <div className="text-center py-10">
        <FiClock className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 text-sm font-medium">No pending settlements</p>
        <p className="text-gray-400 text-xs mt-1">Requests appear here when an owner submits a payment for approval.</p>
        {dashboard?.vendorsWithDue > 0 && (
          <button
            onClick={() => navigate('/admin/settlements/vendors')}
            className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
          >
            {dashboard.vendorsWithDue} owner{dashboard.vendorsWithDue > 1 ? 's' : ''} owe ₹{dashboard.totalDueToAdmin?.toLocaleString()} — view owners with due
          </button>
        )}
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingSettlements.map(settlement => (
          <div key={settlement._id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900">{settlement.vendorId?.name || 'Unknown Owner'}</h3>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">{settlement.vendorId?.businessName}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <p className="text-2xl font-bold text-blue-600">₹{settlement.amount?.toLocaleString()}</p>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded">{settlement.paymentMethod}</span>
                </div>

                {settlement.paymentReference && (
                  <p className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded inline-block">Ref: {settlement.paymentReference}</p>
                )}

                <p className="text-xs text-gray-400 mt-2">{formatDate(settlement.createdAt)}</p>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {settlement.paymentProof && (
                  <a
                    href={settlement.paymentProof}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-200 text-center transition-colors mb-2"
                  >
                    View Proof
                  </a>
                )}
                <button
                  onClick={() => openApproveSettlement(settlement)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-green-700 shadow-sm transition-all"
                >
                  Approve
                </button>
                <button
                  onClick={() => openRejectSettlement(settlement)}
                  className="px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold uppercase hover:bg-red-50 transition-all"
                >
                  Reject
                </button>
              </div>
            </div>
            {settlement.vendorNotes && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-500 italic">"{settlement.vendorNotes}"</p>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  );

  const renderOwnersList = () => (
    owners.length === 0 ? (
      <div className="text-center py-10">
        <FiCheck className="w-12 h-12 mx-auto mb-3 text-gray-200" />
        <p className="text-gray-500 text-sm font-medium">All owners are settled!</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Owner Details</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Cash Limit Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount Due</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {owners.map(vendor => (
              <tr key={vendor._id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${vendor.isBlocked ? 'bg-red-500' : 'bg-blue-600'}`}>
                      {vendor.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{vendor.name}</p>
                      <p className="text-xs text-gray-500">{vendor.businessName} • {vendor.phone}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex flex-col items-end">
                    <p className="text-xs font-semibold text-gray-700 mb-1">
                      ₹{(vendor.amountDue || 0).toLocaleString()} <span className="text-gray-400">/</span> ₹{vendor.cashLimit?.toLocaleString()}
                    </p>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${vendor.isBlocked ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min((vendor.amountDue / vendor.cashLimit) * 100, 100)}%` }}
                      />
                    </div>
                    {vendor.isBlocked && <span className="text-[10px] text-red-600 font-bold mt-1 uppercase tracking-wide">Blocked</span>}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="font-bold text-red-600 text-base">
                    ₹{vendor.amountDue?.toLocaleString() || 0}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openCashLedger(vendor)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Cash bookings"
                    >
                      <FiEye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openUpdateLimit(vendor)}
                      className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Update Limit"
                    >
                      <FiDollarSign className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openSettleHistory(vendor)}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Settlement history"
                      aria-label={`Settlement history of ${vendor.name}`}
                    >
                      <FiClock className="w-4 h-4" />
                    </button>
                    {vendor.isBlocked ? (
                      <button
                        onClick={() => openUnblockVendor(vendor)}
                        className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-xs font-bold uppercase hover:bg-orange-200 transition-colors"
                      >
                        Unblock
                      </button>
                    ) : (
                      <button
                        onClick={() => openBlockVendor(vendor)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase hover:bg-red-100 transition-colors"
                      >
                        Block
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  const renderBankCell = (bank = {}) => (
    <td className="px-4 py-4 text-xs text-gray-700 space-y-0.5">
      {bank.accountHolderName && <p className="font-semibold text-gray-900">{bank.accountHolderName}</p>}
      {bank.bankName && <p>{bank.bankName}</p>}
      {bank.accountNumber && <p>A/C: <span className="font-medium">{bank.accountNumber}</span></p>}
      {bank.ifscCode && <p>IFSC: <span className="font-medium">{bank.ifscCode}</span></p>}
      {bank.upiId && <p>UPI: <span className="font-medium">{bank.upiId}</span></p>}
      {!bank.accountNumber && !bank.upiId && <p className="text-gray-400">Not provided</p>}
    </td>
  );

  const renderWithdrawalHistory = () => (
    withdrawalHistory.length === 0 ? (
      <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
        <FiClock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-600 text-sm font-semibold">No processed withdrawals yet.</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Owner</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Bank Details</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Amount</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Net Paid</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Requested / Processed</th>
              <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Reference / Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {withdrawalHistory.map(w => {
              const approved = w.status === 'approved';
              return (
                <tr key={w._id} className="hover:bg-gray-50/50 transition-colors align-top">
                  <td className="px-4 py-4">
                    <p className="font-bold text-gray-900 text-sm">{w.vendorId?.name}</p>
                    <p className="text-xs text-gray-500">{w.vendorId?.businessName}</p>
                  </td>
                  {renderBankCell(w.bankDetails)}
                  <td className="px-4 py-4 text-right font-bold text-gray-900">₹{w.amount?.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right text-sm">
                    {approved ? (
                      <>
                        <p className="font-bold text-green-600">₹{(w.netAmount || w.amount)?.toLocaleString()}</p>
                        {w.platformFeeAmount > 0 && <p className="text-[11px] text-gray-400">Fee ₹{w.platformFeeAmount.toLocaleString()}</p>}
                      </>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {approved ? 'Paid' : 'Rejected'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-600 whitespace-nowrap">
                    <p>{formatDate(w.requestDate)}</p>
                    <p className="text-gray-400">{w.processedDate ? formatDate(w.processedDate) : '—'}</p>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-600 max-w-[220px] break-words">
                    {approved ? (w.transactionReference || '—') : (w.rejectionReason || '—')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );

  const renderWithdrawalsList = () => (
    <div className="space-y-4">
      {/* Tabs: Pending / History */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <div className="flex gap-2">
          {[
            { id: 'pending', label: 'Pending Withdrawals', count: withdrawals.length },
            { id: 'history', label: 'History', count: withdrawalHistory.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setWithdrawView(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                withdrawView === tab.id ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label} {tab.count > 0 && `(${tab.count})`}
            </button>
          ))}
        </div>
        {settings?.platformFeePercentage != null && (
          <span className="text-xs text-gray-400">
            Platform Fee: {settings.platformFeePercentage}%
          </span>
        )}
      </div>

      {withdrawView === 'history' ? renderWithdrawalHistory() : withdrawals.length === 0 ? (
        <div className="text-center py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
          <FiCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-600 text-sm font-semibold">No pending withdrawal requests. All settled!</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Bank Details</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Requested</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Available Earnings</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Requested On</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {withdrawals.map(request => {
                const bank = request.bankDetails || {};
                return (
                  <tr key={request._id} className="hover:bg-gray-50/50 transition-colors align-top">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center font-bold shrink-0">
                          {request.vendorId?.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{request.vendorId?.name}</p>
                          <p className="text-xs text-gray-500">{request.vendorId?.businessName}</p>
                          {request.adminNotes && <p className="text-[11px] text-gray-400 italic mt-0.5">"{request.adminNotes}"</p>}
                        </div>
                      </div>
                    </td>
                    {renderBankCell(bank)}
                    <td className="px-4 py-4 text-right">
                      <span className="font-bold text-green-600 text-base">₹{request.amount?.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-semibold text-gray-700">
                      ₹{request.vendorId?.wallet?.earnings?.toLocaleString() || 0}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">{formatDate(request.requestDate)}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openApproveWithdrawal(request)}
                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold uppercase hover:bg-green-700 transition-colors whitespace-nowrap"
                        >
                          Approve & Pay
                        </button>
                        <button
                          onClick={() => openRejectWithdrawal(request)}
                          className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase hover:bg-red-100 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    )}
  </div>
);

  return (
    <div className="space-y-4">
      {/* Dynamic Dashboard Cards */}
      {renderDashboardCards()}

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 mt-4 font-medium">Loading data...</p>
          </div>
        ) : (
          <div className="p-6">
            {activeTab === 'withdrawals' ? renderWithdrawalsList() : (
              <>
                {pendingSettlements.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">
                      Payment requests awaiting approval ({pendingSettlements.length})
                    </h3>
                    {renderPendingSettlements()}
                  </div>
                )}
                {renderOwnersList()}
              </>
            )}
          </div>
        )}
      </div>

      {/* --- Modals --- */}
      {/* Approve Settlement Modal */}
      <Modal
        isOpen={activeModal === 'approve_settlement'}
        onClose={closeModals}
        title="Approve Settlement"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to approve this settlement of
            <span className="font-bold text-gray-900 mx-1">₹{selectedItem?.amount?.toLocaleString()}</span>
            from {selectedItem?.vendorId?.name || selectedItem?.name}?
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleApproveSettlement}
              isLoading={actionLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm Approval
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Settlement Modal */}
      <Modal
        isOpen={activeModal === 'reject_settlement'}
        onClose={closeModals}
        title="Reject Settlement"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Please provide a reason for rejecting this settlement.</p>
          <textarea
            value={modalInput}
            onChange={(e) => setModalInput(e.target.value)}
            placeholder="e.g., Transaction ID not found, Invalid screenshot..."
            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
            rows={3}
          />
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleRejectSettlement}
              isLoading={actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Reject Settlement
            </Button>
          </div>
        </div>
      </Modal>

      {/* Block Vendor Modal */}
      <Modal
        isOpen={activeModal === 'block_owner'}
        onClose={closeModals}
        title="Block Owner"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Blocking <span className="font-bold">{selectedItem?.name}</span> will prevent them from accepting new cash jobs.
          </p>
          <textarea
            value={modalInput}
            onChange={(e) => setModalInput(e.target.value)}
            placeholder="Reason for blocking..."
            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
            rows={3}
          />
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleBlockVendor}
              isLoading={actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Block Owner
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unblock Owner Modal */}
      <Modal
        isOpen={activeModal === 'unblock_owner'}
        onClose={closeModals}
        title="Unblock Owner"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to unblock <span className="font-bold text-gray-900">{selectedItem?.name}</span>?
            Their cash limit and blocking status will be reset.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleUnblockVendorSubmit}
              isLoading={actionLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Confirm Unblock
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cash Bookings Modal (eye icon) */}
      <Modal
        isOpen={activeModal === 'cash_ledger'}
        onClose={closeModals}
        title={`Cash collected by ${selectedItem?.name || 'owner'}`}
        size="xl"
      >
        {(() => {
          const rows = cashLedger.rows;
          const active = rows.filter(t => t.status === 'completed');
          const totalCash = active.reduce((s, t) => s + (t.amount || 0), 0);
          const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
          const rupees = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

          return (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ['Owner', `${selectedItem?.name || '—'}`, selectedItem?.businessName ? `${selectedItem.businessName} • ${selectedItem?.phone || ''}` : selectedItem?.phone],
                  ['Cash bookings', active.length, null],
                  ['Cash collected', rupees(totalCash), null],
                  ['Amount due now', rupees(selectedItem?.amountDue), 'Owes admin']
                ].map(([label, value, sub]) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
                    <p className="text-sm font-black text-gray-900 truncate">{value}</p>
                    {sub && <p className="text-[10px] text-gray-500 truncate">{sub}</p>}
                  </div>
                ))}
              </div>

              {cashLedger.loading ? (
                <p className="py-10 text-center text-sm text-gray-500">Loading cash bookings...</p>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">This owner hasn't collected cash for any booking.</p>
              ) : (
                <div className="space-y-2">
                  {rows.map((t) => {
                    const b = t.bookingId && typeof t.bookingId === 'object' ? t.bookingId : null;
                    const bill = b?.vendorBillId && typeof b.vendorBillId === 'object' ? b.vendorBillId : null;
                    const reversed = t.status !== 'completed';
                    const items = (b?.bookedItems || []).map(i => i.card?.title).filter(Boolean).join(', ');
                    const address = [b?.address?.addressLine1, b?.address?.city, b?.address?.state].filter(Boolean).join(', ');

                    return (
                      <div key={t._id} className={`rounded-xl border p-3 ${reversed ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200 bg-white'}`}>
                        {/* Top line */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-black text-blue-600 text-sm">#{b?.bookingNumber || 'Deleted booking'}</span>
                            {b?.status && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-green-100 text-green-700">{b.status.replace(/_/g, ' ')}</span>
                            )}
                            {reversed && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-gray-200 text-gray-600">Reversed</span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-red-600">{rupees(t.amount)} cash</p>
                            <p className="text-[10px] text-gray-500">Collected {fmtDate(b?.cashCollectedAt || t.createdAt)}{b?.cashCollectedBy ? ` by ${b.cashCollectedBy}` : ''}</p>
                          </div>
                        </div>

                        {b ? (
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mt-2 pt-2 border-t border-gray-100 text-[11px]">
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase text-gray-400">Farmer</p>
                              <p className="font-semibold text-gray-900 truncate">{b.userId?.name || '—'}</p>
                              <p className="text-gray-500">{b.userId?.phone || ''}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase text-gray-400">Equipment</p>
                              <p className="font-semibold text-gray-900 truncate">{b.equipmentId?.name || b.serviceName || '—'}</p>
                              <p className="text-gray-500 truncate">
                                {items || b.serviceName}
                                {b.rental_type ? ` • ${b.rental_type.replace(/_/g, ' ')}` : ''}
                                {b.rental_type === 'minute' && b.estimatedDuration ? ` • ${b.estimatedDuration} mins` : ''}
                                {b.rental_type === 'hourly' && b.estimatedDuration ? ` • ${b.estimatedDuration} hr` : ''}
                                {(b.rental_type === 'acre' || b.rental_type === 'land_based') && (b.landSize || b.estimatedDuration) ? ` • ${b.landSize || b.estimatedDuration} acre` : ''}
                                {b.rental_type === 'bigha' && (b.landSize || b.estimatedDuration) ? ` • ${b.landSize || b.estimatedDuration} bigha` : ''}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase text-gray-400">Schedule</p>
                              <p className="font-semibold text-gray-900">{fmtDate(b.scheduledDate).split(',').slice(0, 1)[0]} • {b.scheduledTime || '—'}</p>
                              <p className="text-gray-500 truncate" title={address}>{address || '—'}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold uppercase text-gray-400">Payment</p>
                              <p className="font-semibold text-gray-900">{rupees(b.finalAmount)} • Pay at Home (Cash)</p>
                              {bill ? (
                                <p className="text-gray-500">
                                  Vendor {rupees(bill.vendorTotalEarning)} • Admin {rupees(bill.companyRevenue)}{bill.totalGST ? ` (incl. GST ${rupees(bill.totalGST)})` : ''}
                                </p>
                              ) : (
                                <p className="text-gray-500">Bill not generated</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-500 mt-1">{t.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="text-[10px] text-gray-400">
                "Amount due now" is what the owner still has to pay admin after any settlements. Reversed entries belong to deleted bookings and don't count.
              </p>
            </div>
          );
        })()}
      </Modal>

      {/* Settlement History Modal (clock icon) */}
      <Modal
        isOpen={activeModal === 'settle_history'}
        onClose={closeModals}
        title={`Settlement history: ${selectedItem?.name || 'owner'}`}
        size="lg"
      >
        {(() => {
          const rows = settleHistory.rows;
          const done = rows.filter(s => ['completed', 'approved'].includes(s.status));
          const totalSettled = done.reduce((sum, s) => sum + (s.amount || 0), 0);
          const rupees = (n) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
          const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
          const statusStyle = (s) => (['completed', 'approved'].includes(s) ? 'bg-green-100 text-green-700'
            : s === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700');

          return (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Payments made', done.length],
                  ['Total settled', rupees(totalSettled)],
                  ['Still due', rupees(selectedItem?.amountDue)]
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
                    <p className="text-sm font-black text-gray-900">{value}</p>
                  </div>
                ))}
              </div>

              {settleHistory.loading ? (
                <p className="py-10 text-center text-sm text-gray-500">Loading history...</p>
              ) : rows.length === 0 ? (
                <p className="py-10 text-center text-sm text-gray-500">This owner hasn't settled any dues yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 pr-3 text-right">Amount</th>
                        <th className="py-2 pr-3">Method</th>
                        <th className="py-2 pr-3">Due before → after</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2">Reference / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map(s => (
                        <tr key={s._id} className="align-top">
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">{fmtDate(s.processedAt || s.createdAt)}</td>
                          <td className="py-2 pr-3 text-right font-black text-green-700 whitespace-nowrap">{rupees(s.amount)}</td>
                          <td className="py-2 pr-3 capitalize text-gray-700">{(s.paymentMethod || '—').replace(/_/g, ' ')}</td>
                          <td className="py-2 pr-3 text-gray-700 whitespace-nowrap">
                            {s.balanceBefore != null ? `${rupees(s.balanceBefore)} → ${rupees(s.balanceAfter)}` : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusStyle(s.status)}`}>{s.status}</span>
                          </td>
                          <td className="py-2 text-gray-600">
                            {s.paymentReference && <p className="font-mono text-[10px] break-all">{s.paymentReference}</p>}
                            {s.paymentProof && (
                              <a href={s.paymentProof} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-[10px] font-bold">View proof</a>
                            )}
                            {(s.vendorNotes || s.adminNotes || s.rejectionReason) && (
                              <p className="text-[10px] text-gray-500">{s.rejectionReason || s.adminNotes || s.vendorNotes}</p>
                            )}
                            {s.processedBy?.name && <p className="text-[10px] text-gray-400">By {s.processedBy.name}</p>}
                            {!s.paymentReference && !s.paymentProof && !s.vendorNotes && !s.adminNotes && !s.rejectionReason && !s.processedBy?.name && '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Update Limit Modal */}
      <Modal
        isOpen={activeModal === 'update_limit'}
        onClose={closeModals}
        title="Update Cash Limit"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Set a new cash collection limit for {selectedItem?.name}.</p>
          <div className="relative">
            <span className="absolute left-3 top-3 text-gray-500 font-bold">₹</span>
            <input
              type="number"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              className="w-full p-3 pl-8 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleUpdateLimitSubmit}
              isLoading={actionLoading}
            >
              Update Limit
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approve Withdrawal Modal */}
      <Modal
        isOpen={activeModal === 'approve_withdrawal'}
        onClose={closeModals}
        title="Approve Withdrawal"
        size="md"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-black text-sm">
              {selectedItem?.vendorId?.name?.charAt(0) || 'V'}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">{selectedItem?.vendorId?.name}</p>
              <p className="text-xs text-gray-500">{selectedItem?.vendorId?.businessName}</p>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Payout Breakdown</h4>

            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Gross Amount</span>
              <span className="font-bold text-gray-900">₹{selectedItem?.amount?.toLocaleString()}</span>
            </div>

            {/* No TDS on withdrawals; only the platform fee (same math as the server) */}
            {(() => {
              const feeRate = settings?.platformFeePercentage ?? 1;
              const fee = Math.round(((selectedItem?.amount || 0) * feeRate) / 100);
              return (
                <>
                  {fee > 0 && (
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-600">Platform Charge</span>
                        <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">{feeRate}%</span>
                      </div>
                      <span className="font-bold text-red-600">-₹{fee.toLocaleString()}</span>
                    </div>
                  )}

                  <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="font-bold text-gray-800">Final Net Payout</span>
                    <span className="text-xl font-black text-green-600">₹{((selectedItem?.amount || 0) - fee).toLocaleString()}</span>
                  </div>
                </>
              );
            })()}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Reference</label>
            <input
              type="text"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder="Enter Transaction ID / Ref No."
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Reference ID for the manual bank transfer.</p>
          </div>

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleApproveWithdrawalSubmit}
              isLoading={actionLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject Withdrawal Modal */}
      <Modal
        isOpen={activeModal === 'reject_withdrawal'}
        onClose={closeModals}
        title="Reject Withdrawal"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Reason for rejection:</p>
          <textarea
            value={modalInput}
            onChange={(e) => setModalInput(e.target.value)}
            placeholder="Reason for rejecting withdrawal..."
            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
            rows={3}
          />
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={handleRejectWithdrawalSubmit}
              isLoading={actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Reject Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* Update Min Withdrawal Limit Modal */}
      <Modal
        isOpen={activeModal === 'update_min_withdrawal'}
        onClose={closeModals}
        title="Set Vendor Minimum Withdrawal Limit"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            Set the minimum earnings a vendor must accumulate before they can request a withdrawal payout.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Minimum Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-base">₹</span>
              <input
                type="number"
                min="0"
                step="1"
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="e.g. 500"
                className="w-full pl-8 pr-4 py-3 bg-white border border-gray-300 rounded-xl text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-gray-100">
            <Button variant="ghost" onClick={closeModals}>Cancel</Button>
            <Button
              onClick={() => handleUpdateMinLimit(modalInput)}
              isLoading={savingLimit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Save Limit
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default SettlementManagement;
