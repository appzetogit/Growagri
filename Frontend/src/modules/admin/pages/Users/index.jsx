import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiShoppingBag, FiActivity, FiDollarSign } from 'react-icons/fi';

// Import sub-components
// Import sub-components
import AllFarmers from './AllFarmers';
import FarmerBookings from './FarmerBookings';
import FarmerAnalytics from './FarmerAnalytics';
import Transactions from './Transactions';

const Users = () => {
  const location = useLocation();

  const navTabs = [
    { name: 'All Farmers', path: '/admin/users/all', icon: FiUsers },
    { name: 'Farmer Bookings', path: '/admin/users/bookings', icon: FiShoppingBag },
    { name: 'Farmer Analytics', path: '/admin/users/analytics', icon: FiActivity },
    { name: 'Farmer Transactions', path: '/admin/users/transactions', icon: FiDollarSign },
  ];

  const getPageTitle = () => {
    const currentTab = navTabs.find(tab => location.pathname === tab.path);
    return currentTab ? currentTab.name : 'Farmer Management';
  };

  return (
    <div className="space-y-6">
      {/* Content Area */}
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="all" replace />} />
          <Route path="all" element={<AllFarmers />} />
          <Route path="bookings" element={<FarmerBookings />} />
          <Route path="analytics" element={<FarmerAnalytics />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="*" element={<Navigate to="all" replace />} />
        </Routes>
      </motion.div>
    </div>
  );
};

export default Users;
