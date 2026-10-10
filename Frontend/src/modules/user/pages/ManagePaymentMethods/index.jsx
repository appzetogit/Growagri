import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiChevronRight, FiCheckCircle } from 'react-icons/fi';
import { MdAccountBalanceWallet } from 'react-icons/md';
import { walletService } from '../../../../services/walletService';
import { themeColors } from '../../../../theme';

// Cards are entered in Razorpay checkout each time; we don't store card details.
const ManagePaymentMethods = () => {
  const navigate = useNavigate();
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Fetch real wallet balance
  useEffect(() => {
    const fetchWallet = async () => {
      try {
        setLoadingWallet(true);
        const res = await walletService.getBalance();
        if (res.success) {
          setWalletBalance(res.data?.balance || 0);
        }
      } catch (err) {
        console.error('Failed to load wallet balance:', err);
      } finally {
        setLoadingWallet(false);
      }
    };
    fetchWallet();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
          >
            <FiArrowLeft className="w-5 h-5 text-gray-800" />
          </button>
          <h1 className="text-xl font-black text-gray-900">Manage Payment Methods</h1>
        </div>
      </header>

      <main className="px-4 py-5 max-w-lg mx-auto space-y-6">
        {/* Real GrooAgri Wallet Section */}
        <div>
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-3">Default Balance</h2>
          <div
            onClick={() => navigate('/user/wallet')}
            className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-teal-700"
                style={{ backgroundColor: `${themeColors.brand.teal || '#347989'}18` }}
              >
                <MdAccountBalanceWallet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">GrooAgri Wallet</p>
                <p className="text-xl font-black text-gray-900 mt-0.5">
                  ₹{walletBalance.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-full border border-teal-100">
                Top Up
              </span>
              <FiChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        {/* UPI & Netbanking Notice */}
        <div className="bg-emerald-50/70 border border-emerald-100/80 rounded-2xl p-4 flex items-start gap-3">
          <FiCheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-emerald-900">UPI & Online Payments Supported</p>
            <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
              Google Pay, PhonePe, Paytm, and Netbanking are securely processed through Razorpay at checkout without requiring saved credentials.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ManagePaymentMethods;
