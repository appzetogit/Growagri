import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  FiUser, 
  FiBriefcase, 
  FiShoppingBag, 
  FiDollarSign, 
  FiActivity,
  FiTruck,
  FiClock,
  FiCheckCircle,
  FiPackage,
  FiShoppingCart,
  FiAward,
  FiCreditCard,
  FiDroplet
} from 'react-icons/fi';
import TimePeriodFilter from '../../components/dashboard/TimePeriodFilter';
import { formatCurrency } from '../../utils/adminHelpers';
import { getDashboardStats } from '../../../../services/adminDashboardService';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalVendors: 0,
    totalBookings: 0,
    activeBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    bookingRevenue: 0,
    bookingGst: 0,
    soilTestRevenue: 0,
    ecommerceRevenue: 0,
    totalMachinery: 0,
    pendingWithdrawals: 0,
    pendingStoreRequests: 0,
    approvedStores: 0,
    totalMarketplaceProducts: 0,
    totalAgriOrders: 0,
    soilTestBookings: 0,
    totalSchemes: 0,
    todayRevenue: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        let startDate = new Date();
        const endDate = new Date().toISOString();

        if (period === 'year') {
          startDate.setFullYear(startDate.getFullYear() - 1);
        } else if (period === 'week') {
          startDate.setDate(startDate.getDate() - 7);
        } else if (period === 'month') {
          startDate.setDate(startDate.getDate() - 30);
        } else if (period === 'today') {
          startDate.setHours(0, 0, 0, 0); 
        } else {
          startDate.setDate(startDate.getDate() - 1);
        }

        const startISO = startDate.toISOString();

        const statsRes = await getDashboardStats({ startDate: startISO, endDate });
        if (statsRes.success) {
          const s = statsRes.data.stats;
          setStats({
            totalUsers: s.totalUsers || 0,
            totalVendors: s.totalVendors || 0,
            totalBookings: s.totalBookings || 0,
            activeBookings: s.pendingBookings || 0,
            completedBookings: s.completedBookings || 0,
            totalRevenue: s.totalRevenue || 0,
            bookingRevenue: s.bookingRevenue || 0,
            bookingGst: s.bookingGst || 0,
            soilTestRevenue: s.soilTestRevenue || 0,
            ecommerceRevenue: s.ecommerceRevenue || 0,
            totalMachinery: s.totalMachinery || 0,
            pendingWithdrawals: s.pendingWithdrawals || 0,
            pendingStoreRequests: s.pendingStoreRequests || 0,
            approvedStores: s.approvedStores || 0,
            totalMarketplaceProducts: s.totalMarketplaceProducts || 0,
            totalAgriOrders: s.totalAgriOrders || 0,
            soilTestBookings: s.soilTestBookings || 0,
            totalSchemes: s.totalSchemes || 0,
            todayRevenue: 0,
          });
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchData();
  }, [period]);

  const statsCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue || 0),
      icon: FiDollarSign,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-green-500 to-emerald-600',
      cardBg: 'bg-gradient-to-br from-green-50/90 to-emerald-50/60 border-emerald-100/70',
      link: '/admin/reports/revenue'
    },
    {
      title: 'Booking Revenue',
      value: formatCurrency(stats.bookingRevenue || 0),
      icon: FiDollarSign,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-indigo-500 to-blue-600',
      cardBg: 'bg-gradient-to-br from-indigo-50/90 to-blue-50/60 border-indigo-100/70',
      link: '/admin/reports/revenue'
    },
    {
      title: 'Booking GST Earning',
      value: formatCurrency(stats.bookingGst || 0),
      icon: FiDollarSign,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-amber-500 to-yellow-600',
      cardBg: 'bg-gradient-to-br from-amber-50/90 to-yellow-50/60 border-amber-200/70',
      link: '/admin/reports/revenue'
    },
    {
      title: 'Soil Test Revenue',
      value: formatCurrency(stats.soilTestRevenue || 0),
      icon: FiDroplet,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-teal-500 to-emerald-600',
      cardBg: 'bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border-teal-100/70',
      link: '/admin/soil-testing-revenue'
    },
    {
      title: 'E-commerce Revenue',
      value: formatCurrency(stats.ecommerceRevenue || 0),
      icon: FiShoppingBag,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-rose-500 to-pink-600',
      cardBg: 'bg-gradient-to-br from-rose-50/90 to-pink-50/60 border-rose-100/70',
      link: '/admin/products/orders'
    },
    {
      title: 'Total Farmers',
      value: (stats.totalUsers || 0).toLocaleString(),
      icon: FiUser,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-orange-500 to-amber-600',
      cardBg: 'bg-gradient-to-br from-orange-50/90 to-amber-50/60 border-orange-100/70',
      link: '/admin/users/all'
    },
    {
      title: 'Total Equipment Owners',
      value: (stats.totalVendors || 0).toLocaleString(),
      icon: FiBriefcase,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-teal-500 to-cyan-600',
      cardBg: 'bg-gradient-to-br from-teal-50/90 to-cyan-50/60 border-teal-100/70',
      link: '/admin/vendors/all'
    },
    {
      title: 'Total Machinery',
      value: (stats.totalMachinery || 0).toLocaleString(),
      icon: FiTruck,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-blue-500 to-cyan-600',
      cardBg: 'bg-gradient-to-br from-blue-50/90 to-cyan-50/60 border-blue-100/70',
      link: '/admin/products'
    },
    {
      title: 'Total Bookings',
      value: (stats.totalBookings || 0).toLocaleString(),
      icon: FiShoppingBag,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-purple-500 to-violet-600',
      cardBg: 'bg-gradient-to-br from-purple-50/90 to-violet-50/60 border-purple-100/70',
      link: '/admin/bookings'
    },
    {
      title: 'Total Vendor Withdraw Pending',
      value: (stats.pendingWithdrawals || 0).toLocaleString(),
      icon: FiCreditCard,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-amber-500 to-red-500',
      cardBg: 'bg-gradient-to-br from-amber-50/90 to-red-50/60 border-amber-200/70',
      link: '/admin/settlements/withdrawals'
    },
    {
      title: 'Agri Stores Request Pending',
      value: (stats.pendingStoreRequests || 0).toLocaleString(),
      icon: FiClock,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-yellow-500 to-amber-600',
      cardBg: 'bg-gradient-to-br from-yellow-50/90 to-amber-50/60 border-yellow-200/70',
      link: '/admin/marketplace/store-approvals'
    },
    {
      title: 'Agri Stores Approved',
      value: (stats.approvedStores || 0).toLocaleString(),
      icon: FiCheckCircle,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      cardBg: 'bg-gradient-to-br from-emerald-50/90 to-teal-50/60 border-emerald-100/70',
      link: '/admin/marketplace/registered-shops'
    },
    {
      title: 'Total Agri Marketplace Products',
      value: (stats.totalMarketplaceProducts || 0).toLocaleString(),
      icon: FiPackage,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-fuchsia-500 to-pink-600',
      cardBg: 'bg-gradient-to-br from-fuchsia-50/90 to-pink-50/60 border-fuchsia-100/70',
      link: '/admin/marketplace'
    },
    {
      title: 'Total Agri Orders',
      value: (stats.totalAgriOrders || 0).toLocaleString(),
      icon: FiShoppingCart,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-sky-500 to-indigo-600',
      cardBg: 'bg-gradient-to-br from-sky-50/90 to-indigo-50/60 border-sky-100/70',
      link: '/admin/products/orders'
    },
    {
      title: 'Soil Testing Booking',
      value: (stats.soilTestBookings || 0).toLocaleString(),
      icon: FiActivity,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-lime-500 to-emerald-600',
      cardBg: 'bg-gradient-to-br from-lime-50/90 to-emerald-50/60 border-lime-100/70',
      link: '/admin/soil-tests'
    },
    {
      title: 'Total Scheme Management',
      value: (stats.totalSchemes || 0).toLocaleString(),
      icon: FiAward,
      color: 'text-white',
      bgColor: 'bg-gradient-to-br from-violet-500 to-purple-600',
      cardBg: 'bg-gradient-to-br from-violet-50/90 to-purple-50/60 border-violet-100/70',
      link: '/admin/schemes'
    },
  ];

  const handleExportCsv = () => {
    try {
      const rows = statsCards.map((c) => ({
        Metric: c.title,
        Value: c.value,
      }));

      const headers = ['Metric', 'Value'];
      const csv = [
        headers.join(','),
        ...rows.map((row) => headers.map((h) => JSON.stringify(row[h] ?? '')).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin_dashboard_stats_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('CSV export failed', e);
      alert('Export failed.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex flex-col gap-3">
        <div className="w-full">
          <TimePeriodFilter
            selectedPeriod={period}
            onPeriodChange={setPeriod}
            onExport={handleExportCsv}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-3 sm:gap-4">
        {statsCards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.3 }}
              onClick={() => card.link && navigate(card.link)}
              className={`${card.cardBg} border rounded-2xl p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden cursor-pointer group flex flex-col justify-between`}
            >
              <div className={`absolute top-0 right-0 w-24 h-24 ${card.bgColor} opacity-10 rounded-full -mr-10 -mt-10 group-hover:scale-125 transition-transform duration-300 pointer-events-none`} />

              <div className="flex items-center justify-between mb-2 relative z-10">
                <div className={`${card.bgColor} p-2 rounded-xl shadow-sm text-white flex items-center justify-center`}>
                  <Icon className="text-base sm:text-lg" />
                </div>
              </div>

              <div className="relative z-10">
                <h3 className="text-gray-600 text-[11px] sm:text-xs font-semibold mb-1 line-clamp-2 min-h-[30px] flex items-center leading-tight">
                  {card.title}
                </h3>
                <p className="text-gray-900 text-lg sm:text-2xl font-black tracking-tight">{card.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
