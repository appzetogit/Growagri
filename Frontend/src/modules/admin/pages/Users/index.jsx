import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiUsers, FiActivity } from 'react-icons/fi';

// Import sub-components
import AllFarmers from './AllFarmers';
import FarmerAnalytics from './FarmerAnalytics';

const Users = () => {
  const location = useLocation();

  const navTabs = [
    { name: 'All Farmers', path: '/admin/users/all', icon: FiUsers },
    { name: 'Farmer Analytics', path: '/admin/users/analytics', icon: FiActivity },
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
          <Route path="analytics" element={<FarmerAnalytics />} />
          <Route path="*" element={<Navigate to="all" replace />} />
        </Routes>
      </motion.div>
    </div>
  );
};

export default Users;
