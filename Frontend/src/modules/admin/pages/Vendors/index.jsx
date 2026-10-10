import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FiUsers,
  FiBriefcase,
  FiActivity,
  FiDollarSign,
  FiChevronRight
} from 'react-icons/fi';

// Import sub-components
// Import sub-components
import AllOwners from './AllOwners';
import OwnerBookings from './OwnerBookings';
import OwnerAnalytics from './OwnerAnalytics';
import OwnerPayments from './OwnerPayments';

const Vendors = () => {
  const location = useLocation();

  const navTabs = [
    { name: 'All Owners', path: '/admin/vendors/all', icon: FiUsers },
    { name: 'Owner Bookings', path: '/admin/vendors/bookings', icon: FiBriefcase },
    { name: 'Owner Analytics', path: '/admin/vendors/analytics', icon: FiActivity },
    { name: 'Owner Payments', path: '/admin/vendors/payments', icon: FiDollarSign },
  ];

  const getPageTitle = () => {
    const currentTab = navTabs.find(tab => location.pathname === tab.path);
    return currentTab ? currentTab.name : 'Equipment Owner Management';
  };

  return (
    <div className="space-y-6">
      {/* Page Content */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="all" replace />} />
          <Route path="all" element={<AllOwners />} />
          <Route path="bookings" element={<OwnerBookings />} />
          <Route path="analytics" element={<OwnerAnalytics />} />
          <Route path="payments" element={<OwnerPayments />} />
        </Routes>
      </motion.div>
    </div>
  );
};

export default Vendors;
