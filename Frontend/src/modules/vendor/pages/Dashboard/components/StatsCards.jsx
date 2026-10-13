import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrendingUp } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';

const StatsCards = memo(({ stats }) => {
  const navigate = useNavigate();

  const todayVal = Number(stats?.todayEarnings || 0);
  const monthVal = Number(stats?.monthEarnings || stats?.monthlyEarnings || 0);

  const cards = [
    {
      title: "Today's Earn",
      value: `₹${todayVal.toLocaleString()}`,
      icon: FaWallet,
      gradient: 'linear-gradient(135deg, #001947 0%, #003b77 100%)',
      onClick: () => navigate('/vendor/wallet')
    },
    {
      title: 'Monthly Earn',
      value: `₹${monthVal.toLocaleString()}`,
      icon: FiTrendingUp,
      gradient: 'linear-gradient(135deg, #0F766E 0%, #115E59 100%)',
      onClick: () => navigate('/vendor/wallet')
    }
  ];

  return (
    <div className="px-4 py-2">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {cards.map((card, index) => {
          const IconComponent = card.icon;

          return (
            <div
              key={index}
              onClick={card.onClick}
              className="rounded-2xl p-3.5 sm:p-4 relative overflow-hidden cursor-pointer active:scale-95 transition-all shadow-md"
              style={{
                background: card.gradient,
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              {/* Decorative Subtle Pattern */}
              <div
                className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(255, 255, 255, 0.5) 0%, transparent 70%)',
                  transform: 'translate(15px, -15px)',
                }}
              />
              <div className="relative z-10 flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-[11px] sm:text-xs text-white/80 font-semibold mb-1 uppercase tracking-wider truncate">
                    {card.title}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold text-white leading-tight truncate">
                    {card.value}
                  </p>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'rgba(255, 255, 255, 0.22)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                  }}
                >
                  <IconComponent className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

StatsCards.displayName = 'VendorStatsCards';

export default StatsCards;
