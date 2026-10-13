import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiUsers, FiBell, FiArrowRight, FiUser, FiClock, FiMapPin, FiCheckCircle, FiTrendingUp, FiChevronRight, FiAlertTriangle, FiActivity, FiShoppingBag } from 'react-icons/fi';
import { FaWallet } from 'react-icons/fa';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import { vendorDashboardService } from '../../services/dashboardService';
import { acceptBooking, rejectBooking, assignWorker } from '../../services/bookingService';
import { BookingAlertModal } from '../../components/bookings';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';
import maintenanceService from '../../services/maintenanceService';
import { isWithinInterval, parseISO } from 'date-fns';

import { registerFCMToken } from '../../../../services/pushNotificationService';
import LogoLoader from '../../../../components/common/LogoLoader';
import StatsCards from './components/StatsCards';
import { useVendorDashboard } from '../../../../context/VendorDashboardContext';
// PendingBookings import removed


const SOCKET_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/api$/, '') || 'http://localhost:5000';

const Dashboard = memo(() => {
  const navigate = useNavigate();

  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const {
    stats,
    recentJobs,
    pendingBookings,
    activeAlertBookings,
    setActiveAlertBookings,
    loading,
    error,
    loadDashboardData
  } = useVendorDashboard();

  const handleAcceptAlert = async (bookingId) => {
    // Immediately mark as ignored so API refresh doesn't bring it back
    window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: String(bookingId) } }));
    try {
      await acceptBooking(bookingId);
      toast.success('Booking accepted successfully');
    } catch (error) {
      const status = error?.response?.status;
      if (status === 409) {
        toast.error('This job was already accepted by another vendor.');
      } else {
        toast.error('Failed to accept booking');
      }
    } finally {
      window.dispatchEvent(new Event('vendorStatsUpdated'));
    }
  };

  const handleRejectAlert = async (bookingId) => {
    // Immediately mark as ignored so API refresh doesn't bring it back
    window.dispatchEvent(new CustomEvent('removeVendorBooking', { detail: { id: String(bookingId) } }));
    try {
      const result = await rejectBooking(bookingId);
      if (result?.alreadyTaken) {
        toast.error('This job was already accepted by another vendor.');
      } else {
        toast.success('Booking declined');
      }
    } catch (error) {
      // Silently ignore — booking is already removed from modal
      console.error('Reject booking error (modal already closed):', error);
    } finally {
      window.dispatchEvent(new Event('vendorStatsUpdated'));
    }
  };
  
  const handleAssignAlert = (bookingId) => {
    navigate(`/vendor/booking/${bookingId}`);
  };

  // Set background gradient
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = themeColors.backgroundGradient;

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  // Memoize quickActions to prevent recreation on every render
  const quickActions = useMemo(() => [
    {
      title: 'Field Operations',
      icon: FiBriefcase,
      color: '#00a6a6',
      path: '/vendor/jobs',
      count: stats.activeJobs,
      subtitle: `${stats.activeJobs} on field`,
    },
    {
      title: 'Wallet',
      icon: FaWallet,
      color: '#F59E0B',
      path: '/vendor/wallet',
      subtitle: `₹${stats.totalEarnings.toLocaleString()} total`,
    },
    {
      title: 'Soil Testing',
      icon: FiActivity,
      color: '#347989',
      path: '/vendor/soil-tests',
      subtitle: 'Manage Tests',
    },
    {
      title: 'Agri Market',
      icon: FiShoppingBag,
      color: '#E11D48',
      path: '/vendor/store/orders',
      subtitle: `₹${(stats.ecommerceEarnings || 0).toLocaleString()} Earnings`,
    },
  ], [stats.activeJobs, stats.totalEarnings, stats.ecommerceEarnings]);

  const getStatusColor = (status) => {
    const s = String(status).toLowerCase();
    const statusColors = {
      'accepted': '#3B82F6',
      'confirmed': '#10B981',
      'assigned': '#8B5CF6',
      'journey_started': '#F59E0B',
      'visited': '#F59E0B',
      'in_progress': '#F59E0B',
      'work_done': '#10B981',
      'completed': '#10B981',
      'worker_paid': '#06B6D4',
      'settlement_pending': '#F97316',
    };
    return statusColors[s] || '#6B7280';
  };

  const getStatusLabel = (status) => {
    const s = String(status).toLowerCase();
    const labels = {
      'requested': 'New Order',
      'searching': 'Finding Hub',
      'accepted': 'Accepted',
      'confirmed': 'Order Confirmed',
      'assigned': 'Driver Assigned',
      'journey_started': 'Heading to Farm',
      'visited': 'At Farm',
      'in_progress': 'Operating',
      'work_done': 'Work Completed',
      'completed': 'Job Done',
      'worker_paid': 'Driver Paid',
      'settlement_pending': 'Settlement',
      'cancelled': 'Cancelled',
      'rejected': 'Rejected'
    };
    return labels[s] || status;
  };



  // Show error state
  if (error) {
    return (
      <div className="min-h-screen pb-20 flex items-center justify-center" style={{ background: themeColors.backgroundGradient }}>
        <div className="text-center px-6">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <h2 className="text-white text-xl font-semibold mb-2">Failed to Load Dashboard</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => loadDashboardData(true, true)}
            className="bg-white text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 overflow-x-hidden" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Dashboard" showBack={false} notificationCount={stats.pendingAlerts} />

      <main className="pt-2">

        {/* Compliance Alerts Section */}
        {stats.complianceAlerts && stats.complianceAlerts.length > 0 && (
          <div className="px-4 pt-2 -mb-2">
            <div
              onClick={() => navigate('/vendor/compliance')}
              className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r shadow-sm cursor-pointer hover:bg-red-100 transition-colors"
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FiAlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-bold text-red-700">Compliance Alert</p>
                  <p className="text-sm text-red-600">
                    {stats.complianceAlerts[0].message}
                    {stats.complianceAlerts.length > 1 && ` (+${stats.complianceAlerts.length - 1} more)`}
                  </p>
                </div>
                <div className="ml-auto">
                  <FiArrowRight className="h-4 w-4 text-red-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="px-4 py-2 grid grid-cols-1 gap-2.5">
          {quickActions.map((action, index) => (
            <div
              key={index}
              onClick={() => navigate(action.path)}
              className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-100 active:scale-98 transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0"
                  style={{ backgroundColor: action.color }}
                >
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 leading-tight">
                    {action.title}
                  </p>
                  <p className="text-xs text-gray-500 font-medium truncate mt-0.5">{action.subtitle}</p>
                </div>
              </div>
              <FiChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </div>
          ))}
        </div>

        {/* Stats Cards - Today's & Monthly Earnings */}
        <StatsCards stats={stats} />
      </main>

      <BookingAlertModal 
        isOpen={activeAlertBookings && activeAlertBookings.length > 0}
        bookings={activeAlertBookings}
        onAccept={handleAcceptAlert}
        onReject={handleRejectAlert}
        onAssign={handleAssignAlert}
        onMinimize={() => setActiveAlertBookings([])}
        servicePayoutPct={stats?.servicePayoutPercentage || 70}
      />
    </div>
  );
});

export default Dashboard;
