import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../components/layout/AdminLayout';
import ProtectedRoute from '../../../components/auth/ProtectedRoute';
import PublicRoute from '../../../components/auth/PublicRoute';
import useAppNotifications from '../../../hooks/useAppNotifications.jsx';

// Login page (not lazy loaded for faster initial access)
import Login from '../pages/login';

// Lazy load admin pages for code splitting
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Settings = lazy(() => import('../pages/Settings'));
const UserCategories = lazy(() => import('../pages/UserCategories'));
const Users = lazy(() => import('../pages/Users'));
const Vendors = lazy(() => import('../pages/Vendors'));
const Bookings = lazy(() => import('../pages/Bookings'));
const BookingTracking = lazy(() => import('../pages/Bookings/Tracking'));
const BookingNotifications = lazy(() => import('../pages/Bookings/BookingNotifications'));
const BookingKmPhotos = lazy(() => import('../pages/Bookings/BookingKmPhotos'));
const BookingDetailsPage = lazy(() => import('../pages/Bookings/BookingDetailsPage'));
const KycVerification = lazy(() => import('../pages/Users/KycVerification'));
const Payments = lazy(() => import('../pages/Payments'));
const Reports = lazy(() => import('../pages/Reports'));
const Notifications = lazy(() => import('../pages/Notifications'));

const Plans = lazy(() => import('../pages/Plans/Plans'));

const Settlements = lazy(() => import('../pages/Settlements'));
const Reviews = lazy(() => import('../pages/Reviews'));
const Products = lazy(() => import('../pages/Products'));
const EcommerceOrders = lazy(() => import('../pages/Products/Orders'));
const Marketplace = lazy(() => import('../pages/Products/EcommerceManager'));
const StoreApprovals = lazy(() => import('../pages/Products/StoreApprovals'));
const RegisteredShops = lazy(() => import('../pages/Products/RegisteredShops'));
const SoilTesting = lazy(() => import('../pages/SoilTesting'));
const Disputes = lazy(() => import('../pages/Disputes'));
const SchemeManagement = lazy(() => import('../pages/Schemes'));
const WebsiteSettings = lazy(() => import('../pages/WebsiteSettings'));
const EquipmentApproval = lazy(() => import('../pages/EquipmentApproval'));
const Support = lazy(() => import('../pages/Support'));
const Workers = lazy(() => import('../pages/Workers'));



// Loading fallback component
import LogoLoader from '../../../components/common/LogoLoader';

const LoadingFallback = () => (
  <LogoLoader />
);

const AdminRoutes = () => {
  // Enable global notifications for admin
  // Global notifications are now handled by SocketProvider at App level
  // useAppNotifications('admin');

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Login route - outside of layout (public) */}
        <Route path="/login" element={<PublicRoute userType="admin"><Login /></PublicRoute>} />

        {/* Protected routes - inside layout */}
        <Route path="/" element={
          <ProtectedRoute userType="admin">
            <AdminLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="users/*" element={<Users />} />
          <Route path="vendors/*" element={<Vendors />} />
          <Route path="workers" element={<Workers />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="bookings/:id" element={<BookingDetailsPage />} />
          <Route path="bookings/tracking" element={<Navigate to="/admin/bookings" replace />} />
          <Route path="bookings/km-photos" element={<Navigate to="/admin/bookings" replace />} />
          <Route path="users/kyc" element={<KycVerification />} />
          <Route path="equipment-catalog/*" element={<UserCategories />} />
          <Route path="equipment-approvals/*" element={<EquipmentApproval />} />
          <Route path="payments/*" element={<Payments />} />
          <Route path="reports/*" element={<Reports />} />
          <Route path="notifications/*" element={<Notifications />} />

          <Route path="plans" element={<Plans />} />
          <Route path="reviews" element={<Reviews />} />
          <Route path="products" element={<Products />} />
          <Route path="products/orders" element={<EcommerceOrders />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="marketplace/store-approvals" element={<StoreApprovals />} />
          <Route path="marketplace/registered-shops" element={<RegisteredShops />} />
          <Route path="soil-tests" element={<SoilTesting />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="schemes" element={<SchemeManagement />} />
          <Route path="settlements/*" element={<Settlements />} />
          <Route path="manage-website/*" element={<WebsiteSettings />} />
          <Route path="support" element={<Support />} />
          <Route path="settings/*" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AdminRoutes;

