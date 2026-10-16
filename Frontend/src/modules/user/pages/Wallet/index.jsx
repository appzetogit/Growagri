import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { walletService } from '../../../../services/walletService';
import NotificationBell from '../../components/common/NotificationBell';
import { themeColors } from '../../../../theme';

const Wallet = () => {
  const navigate = useNavigate();
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [amountToAdd, setAmountToAdd] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Load Razorpay Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    const loadWalletData = async () => {
      try {
        setLoading(true);
        const balanceResponse = await walletService.getBalance();

        if (balanceResponse.success) {
          setWalletBalance(balanceResponse.data.balance || 0);
        }
      } catch (error) {
        toast.error('Failed to load wallet data');
      } finally {
        setLoading(false);
      }
    };

    loadWalletData();
  }, []);

  const handleAddMoney = async (e) => {
    e.preventDefault();
    if (!amountToAdd || isNaN(amountToAdd) || Number(amountToAdd) < 100) {
      return toast.error('Minimum amount to add is ₹100');
    }

    try {
      setIsProcessing(true);
      const res = await walletService.addMoney(Number(amountToAdd));
      
      if (res.success) {
        setShowAddMoney(false);
        const options = {
          key: res.data.key,
          amount: Math.round(res.data.amount * 100),
          currency: res.data.currency,
          name: 'GrooAgri',
          description: 'Wallet Top-up',
          order_id: res.data.orderId,
          handler: async function (response) {
            try {
              const verifyRes = await walletService.verifyTopup({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: Number(amountToAdd)
              });
              
              if (verifyRes.success) {
                toast.success('Money added to wallet successfully!');
                setWalletBalance(verifyRes.data.balance);
                setAmountToAdd('');
              }
            } catch (error) {
              toast.error('Payment verification failed');
            }
          },
          theme: { color: themeColors?.brand?.teal || '#347989' }
        };
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          toast.error(response.error.description || 'Payment Failed');
        });
        rzp.open();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to initiate payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 relative bg-white">
      {/* Refined Brand Mesh Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(at 0% 0%, ${themeColors?.brand?.teal || '#347989'}25 0%, transparent 70%),
              radial-gradient(at 100% 0%, ${themeColors?.brand?.yellow || '#D68F35'}20 0%, transparent 70%),
              radial-gradient(at 100% 100%, ${themeColors?.brand?.orange || '#BB5F36'}15 0%, transparent 75%),
              radial-gradient(at 0% 100%, ${themeColors?.brand?.teal || '#347989'}10 0%, transparent 70%),
              radial-gradient(at 50% 50%, ${themeColors?.brand?.teal || '#347989'}03 0%, transparent 100%),
              #FFFFFF
            `
          }}
        />
        {/* Elegant Dot Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(${themeColors?.brand?.teal || '#347989'} 0.8px, transparent 0.8px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      <div className="relative z-10">
        {/* Modern Glassmorphism Header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/40 border-b border-black/[0.03] px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-black/[0.02]"
            >
              <FiArrowLeft className="w-5 h-5 text-black" />
            </button>
            <h1 className="text-xl font-extrabold text-black tracking-tight">Wallet</h1>
          </div>
          <NotificationBell />
        </header>

        <main className="px-4 py-6">
          {/* Referral Banner */}
          <div className="bg-gray-100 rounded-xl p-4 mb-4 relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-lg font-bold text-black mb-1">Refer your friends and earn</h2>
              <p className="text-sm text-gray-700">They get ₹100 and you get ₹100</p>
            </div>
            {/* Gift Box Illustration */}
            <div className="absolute right-4 top-2 z-0">
              <div className="relative">
                <div className="w-20 h-20 bg-purple-400 rounded-lg flex items-center justify-center transform rotate-12 shadow-md">
                  <div className="w-16 h-16 bg-pink-300 rounded-lg flex items-center justify-center">
                    <span className="text-3xl">🎁</span>
                  </div>
                </div>
                {/* Sparkles */}
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-300 rounded-full"></div>
                <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-yellow-200 rounded-full"></div>
                <div className="absolute top-4 -left-2 w-2 h-2 bg-white rounded-full opacity-80"></div>
                <div className="absolute bottom-4 -right-2 w-2 h-2 bg-white rounded-full opacity-80"></div>
              </div>
            </div>
          </div>

          {/* Main Balance Card */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 mb-6 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>

            <div className="relative z-10 flex justify-between items-end">
              <div>
                <p className="text-gray-400 text-sm font-medium mb-1">Current Balance</p>
                <h2 className="text-4xl font-bold text-white">
                  ₹{walletBalance.toLocaleString('en-IN')}
                </h2>
              </div>
              <button 
                onClick={() => setShowAddMoney(true)}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center gap-1">
                <span className="text-lg leading-none">+</span> Add Money
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Add Money Modal */}
      {showAddMoney && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProcessing && setShowAddMoney(false)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-black">Add Money</h3>
              <button onClick={() => setShowAddMoney(false)} disabled={isProcessing} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
                ✕
              </button>
            </div>
            
            <form onSubmit={handleAddMoney}>
              <div className="mb-6">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block">Amount (₹)</label>
                <input 
                  type="number" 
                  value={amountToAdd}
                  onChange={(e) => setAmountToAdd(e.target.value)}
                  placeholder="Enter amount (Min ₹100)"
                  min="100"
                  required
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xl font-black outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[100, 500, 1000].map(amt => (
                  <button 
                    key={amt} type="button" 
                    onClick={() => setAmountToAdd(amt.toString())}
                    className="py-2.5 rounded-xl border-2 border-gray-100 text-sm font-bold text-gray-600 hover:border-teal-500 hover:text-teal-600 transition-colors">
                    +₹{amt}
                  </button>
                ))}
              </div>

              <button 
                type="submit" 
                disabled={isProcessing || !amountToAdd || Number(amountToAdd) < 100}
                className="w-full bg-teal-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-teal-600/20 disabled:opacity-50 active:scale-95 transition-all">
                {isProcessing ? 'Processing...' : 'Proceed to Pay'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;
