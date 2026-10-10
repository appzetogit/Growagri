import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiFileText, FiCheckCircle, FiStar, FiCalendar, FiPercent, FiArrowRight } from 'react-icons/fi';
import { userAuthService } from '../../../../services/authService';
import LogoLoader from '../../../../components/common/LogoLoader';
import { themeColors } from '../../../../theme';

const MySubscription = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        setLoading(true);
        const res = await userAuthService.getProfile();
        if (res.success && res.user?.plans?.isActive) {
          setPlan(res.user.plans);
        } else {
          setPlan(null);
        }
      } catch (err) {
        console.error('Failed to fetch subscription status:', err);
        setPlan(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) return <LogoLoader />;

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-30">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-95"
            >
              <FiArrowLeft className="w-5 h-5 text-gray-800" />
            </button>
            <h1 className="text-xl font-black text-gray-900">My Subscription</h1>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto">
        {plan && plan.isActive ? (
          <div className="space-y-5">
            {/* Active Plan Card */}
            <div className="bg-gradient-to-br from-[#1b4332] to-[#2d6a4f] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  <FiCheckCircle className="w-3.5 h-3.5" /> Active Plan
                </span>
                <span className="text-2xl font-black text-amber-300">
                  ₹{plan.price || 0}
                </span>
              </div>

              <h2 className="text-2xl font-black mb-1 tracking-tight flex items-center gap-2">
                <FiStar className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                {plan.name || 'Membership Plan'}
              </h2>
              <p className="text-xs text-emerald-100/80 mb-6 font-medium">
                Exclusive benefits unlocked for all farming services
              </p>

              {/* Validity info */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <FiCalendar className="w-4 h-4 text-emerald-200" />
                  <span className="text-emerald-100 font-medium">Valid until:</span>
                </div>
                <span className="text-xs font-bold text-white">
                  {formatDate(plan.expiry)}
                </span>
              </div>
            </div>

            {/* Plan Perks */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">Your Active Benefits</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100/80">
                  <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
                    <FiPercent className="w-4 h-4" /> Machinery Rental
                  </div>
                  <p className="text-lg font-black text-emerald-800">
                    {plan.rentalDiscountPercentage || 0}% OFF
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-100/80">
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
                    <FiPercent className="w-4 h-4" /> Seeds & Inputs
                  </div>
                  <p className="text-lg font-black text-amber-800">
                    {plan.marketplaceDiscountPercentage || 0}% OFF
                  </p>
                </div>
              </div>
            </div>

            {/* Change or View Plans CTA */}
            <button
              onClick={() => navigate('/user/my-plan')}
              className="w-full py-4 rounded-2xl bg-[#2d6a4f] text-white font-black text-sm shadow-lg hover:bg-[#1b4332] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>Explore All Plans</span>
              <FiArrowRight />
            </button>
          </div>
        ) : (
          /* Real Empty State */
          <div className="flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-20 h-20 rounded-3xl bg-emerald-50 flex items-center justify-center mb-5 border border-emerald-100 shadow-sm">
              <FiFileText className="w-10 h-10 text-emerald-600" />
            </div>
            
            <h2 className="text-lg font-black text-gray-900 mb-1">No Active Subscription</h2>
            <p className="text-xs text-gray-500 max-w-xs mb-6 leading-relaxed">
              Subscribe to GrooAgri plans to enjoy up to 20% discount on machinery rentals, priority dispatch, and free soil testing support.
            </p>

            <button
              onClick={() => navigate('/user/my-plan')}
              className="px-6 py-3.5 rounded-2xl bg-[#2d6a4f] text-white font-black text-sm shadow-md hover:bg-[#1b4332] active:scale-95 transition-all flex items-center gap-2"
            >
              <span>Browse Subscription Plans</span>
              <FiArrowRight />
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default MySubscription;
