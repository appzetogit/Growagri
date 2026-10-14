import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PaymentOverview from './PaymentOverview';

const Payments = () => {
  return (
    <div className="space-y-6">
      {/* Content */}
      <div className="min-h-[400px]">
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<PaymentOverview />} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      </div>
    </div>
  );
};

export default Payments;