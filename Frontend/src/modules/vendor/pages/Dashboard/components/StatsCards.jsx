import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrendingUp, FiChevronRight } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';

const StatsCards = memo(({ stats }) => {
  const navigate = useNavigate();

  const todayVal = Number(stats?.todayEarnings || 0);
  const monthVal = Number(stats?.monthEarnings || stats?.monthlyEarnings || 0);

  return (
    <div className="px-4 pt-1 pb-2">
      <div
        onClick={() => navigate('/vendor/wallet')}
        className="rounded-3xl p-4 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform shadow-lg"
        style={{ background: 'linear-gradient(135deg, #001947 0%, #003b77 55%, #0F766E 100%)' }}
      >
        {/* Decorative glows */}
        <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] text-white/70 font-semibold uppercase tracking-wider">Earnings Overview</p>
            <span className="flex items-center gap-0.5 text-[11px] font-semibold text-white/80">
              Wallet <FiChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-white/15">
            <div className="pr-3 min-w-0">
              <div className="flex items-center gap-1.5 text-white/70 text-xs font-medium mb-1">
                <FaWallet className="w-3 h-3" /> Today
              </div>
              <p className="text-2xl font-extrabold text-white leading-tight truncate">₹{todayVal.toLocaleString()}</p>
            </div>
            <div className="pl-4 min-w-0">
              <div className="flex items-center gap-1.5 text-white/70 text-xs font-medium mb-1">
                <FiTrendingUp className="w-3 h-3" /> This Month
              </div>
              <p className="text-2xl font-extrabold text-white leading-tight truncate">₹{monthVal.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

StatsCards.displayName = 'VendorStatsCards';

export default StatsCards;
