import React, { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import PageTransition from '../components/common/PageTransition';
import ErrorBoundary from '../components/common/ErrorBoundary';
import ProtectedRoute from '../../../components/auth/ProtectedRoute';
import PublicRoute from '../../../components/auth/PublicRoute';
import Login from '../pages/login';
import { scheduleIdlePrefetch } from '../../../utils/routePrefetcher';

// Lazy load secondary persistent widgets to keep login page chunk tiny
const BottomNav = lazy(() => import('../components/layout/BottomNav'));
import useAppNotifications from '../../../hooks/useAppNotifications.jsx';

// Lazy load wrapper with error handling
const lazyLoad = (importFunc) => {
  return lazy(() => {
    return Promise.resolve(importFunc()).catch((error) => {
      // Failed to load user page
      // Return a fallback component wrapped in a Promise
      return Promise.resolve({
        default: () => (
          <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="text-center p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Failed to load page</h2>
              <p className="text-gray-600 mb-4">Please refresh the page or try again later.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 rounded-xl text-white font-semibold transition-all duration-300 hover:opacity-90"
                style={{ backgroundColor: '#00a6a6' }}
              >
                Refresh Page
              </button>
            </div>
          </div>
        ),
      });
    });
  });
};

// Lazy load all user pages for code splitting with error handling
const Home = lazyLoad(() => import('../pages/Home'));
const Rewards = lazyLoad(() => import('../pages/Rewards'));
const Account = lazyLoad(() => import('../pages/Account'));
const MySubscription = lazyLoad(() => import('../pages/MySubscription'));
const Cart = lazyLoad(() => import('../pages/Cart'));
const Checkout = lazyLoad(() => import('../pages/Checkout'));
const MyBookings = lazyLoad(() => import('../pages/MyBookings'));
const BookingDetails = lazyLoad(() => import('../pages/BookingDetails'));
const BookingTrack = lazyLoad(() => import('../pages/BookingTrack'));
const BookingConfirmation = lazyLoad(() => import('../pages/BookingConfirmation'));
const Settings = lazyLoad(() => import('../pages/Settings'));
const Language = lazyLoad(() => import('../pages/Language'));
const ManagePaymentMethods = lazyLoad(() => import('../pages/ManagePaymentMethods'));
const ManageAddresses = lazyLoad(() => import('../pages/ManageAddresses'));
const Wallet = lazyLoad(() => import('../pages/Wallet'));
const MyPlan = lazyLoad(() => import('../pages/MyPlan'));
const PlanDetails = lazyLoad(() => import('../pages/MyPlan/PlanDetails'));
const MyRating = lazyLoad(() => import('../pages/MyRating'));
const AboutGroo = lazyLoad(() => import('../pages/AboutHomster'));
const HowToUse = lazyLoad(() => import('../pages/HowToUse'));
const UpdateProfile = lazyLoad(() => import('../pages/UpdateProfile'));
const Privacy = lazyLoad(() => import('../pages/Privacy'));

const Notifications = lazyLoad(() => import('../pages/Notifications'));
const FAQ = lazyLoad(() => import('../pages/FAQ'));
const HelpSupport = lazyLoad(() => import('../pages/HelpSupport'));
const CancellationPolicy = lazyLoad(() => import('../pages/CancellationPolicy'));
const WeatherReport = lazyLoad(() => import('../pages/WeatherReport'));
const Marketplace = lazyLoad(() => import('../pages/Marketplace'));
const MachineryExplorer = lazyLoad(() => import('../pages/Machinery/MachineryExplorer'));
const EquipmentDetail = lazyLoad(() => import('../pages/Machinery/EquipmentDetail'));
const MachineryCheckout = lazyLoad(() => import('../pages/Machinery/MachineryCheckout'));
const SoilTesting = lazyLoad(() => import('../pages/SoilTesting'));
const AgriMarket = lazyLoad(() => import('../pages/AgriMarket'));
const AgriProductDetail = lazyLoad(() => import('../pages/AgriMarket/ProductDetail'));
const MyAgriOrders = lazyLoad(() => import('../pages/AgriMarket/MyOrders'));
const AgriCart = lazyLoad(() => import('../pages/AgriMarket/AgriCart'));
const SchemeDetails = lazyLoad(() => import('../pages/Schemes/SchemeDetails'));

// Ultra-fast top indeterminate progress bar + skeleton (Zero-Jank transitions)
const LoadingFallback = () => (
  <div className="w-full relative min-h-[50vh]">
    {/* Micro Top Progress Bar */}
    <div className="fixed top-0 left-0 right-0 h-[3px] bg-emerald-100 z-[99999] overflow-hidden">
      <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 w-1/3 animate-pulse" />
    </div>
    {/* Lightweight subtle skeleton pulse */}
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4 animate-pulse">
      <div className="h-16 bg-slate-100/80 rounded-2xl w-full" />
      <div className="h-32 bg-slate-100/80 rounded-3xl w-full" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-28 bg-slate-100/70 rounded-2xl" />
        <div className="h-28 bg-slate-100/70 rounded-2xl" />
      </div>
    </div>
  </div>
);

// Lazy load Live Booking Card so it is excluded from public/login chunks
const LiveBookingCard = lazy(() => import('../components/booking/LiveBookingCard'));

const UserRoutes = () => {
  const location = useLocation();

  // Enable global notifications for user
  // Global notifications are now handled by SocketProvider at App level
  // useAppNotifications('user');

  // Pages where BottomNav should be shown
  const bottomNavPages = ['/user', '/user/', '/user/my-bookings', '/user/cart', '/user/account', '/user/weather'];
  const shouldShowBottomNav = bottomNavPages.includes(location.pathname);

  // Check if we hide the live booking card (e.g. if we are on the specific booking details or track page)
  const isBookingDetailsPage = location.pathname.match(/^\/user\/booking\/[a-zA-Z0-9]+(\/track)?$/);
  const isBookingConfirmationPage = location.pathname.includes('/booking-confirmation');


  // Check if we are on public pages (login/signup) where we shouldn't fetch bookings
  const isPublicPage = location.pathname.includes('/login') ||
    location.pathname.includes('/signup') ||
    location.pathname.includes('/privacy') ||
    location.pathname.includes('/faq') ||
    location.pathname.includes('/help-support') ||
    location.pathname.includes('/cancellation-policy') ||
    location.pathname.includes('/schemes');

  // Predictive background prefetch for high-traffic subroutes when browser is idle
  useEffect(() => {
    if (!isPublicPage) {
      scheduleIdlePrefetch(['bookings', 'cart', 'account', 'agri-market', 'machinery', 'weather'], 800);
    }
  }, [isPublicPage]);

  return (
    <ErrorBoundary>
      {/* Main content area - leaves space for bottom nav when needed */}
      <div className={shouldShowBottomNav ? "pb-20" : ""}>
        <Suspense fallback={<LoadingFallback />}>
          <PageTransition>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<PublicRoute userType="user"><Login /></PublicRoute>} />
              <Route path="/signup" element={<Navigate to="/user/login" replace />} />

              {/* Protected routes (auth required) */}
              <Route path="/" element={<ProtectedRoute userType="user"><Home /></ProtectedRoute>} />
              <Route path="/my-subscription" element={<ProtectedRoute userType="user"><MySubscription /></ProtectedRoute>} />

              <Route path="/rewards" element={<ProtectedRoute userType="user"><Rewards /></ProtectedRoute>} />
              <Route path="/account" element={<ProtectedRoute userType="user"><Account /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute userType="user"><Cart /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute userType="user"><Checkout /></ProtectedRoute>} />
              <Route path="/my-bookings" element={<ProtectedRoute userType="user"><MyBookings /></ProtectedRoute>} />
              <Route path="/booking/:id" element={<ProtectedRoute userType="user"><BookingDetails /></ProtectedRoute>} />
              <Route path="/booking/:id/track" element={<ProtectedRoute userType="user"><BookingTrack /></ProtectedRoute>} />
              <Route path="/booking-confirmation/:id" element={<ProtectedRoute userType="user"><BookingConfirmation /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute userType="user"><Settings /></ProtectedRoute>} />
              <Route path="/language" element={<Language />} />
              <Route path="/manage-payment-methods" element={<ProtectedRoute userType="user"><ManagePaymentMethods /></ProtectedRoute>} />
              <Route path="/manage-addresses" element={<ProtectedRoute userType="user"><ManageAddresses /></ProtectedRoute>} />
              <Route path="/wallet" element={<ProtectedRoute userType="user"><Wallet /></ProtectedRoute>} />
              <Route path="/my-plan" element={<ProtectedRoute userType="user"><MyPlan /></ProtectedRoute>} />
              <Route path="/my-plan/:id" element={<ProtectedRoute userType="user"><PlanDetails /></ProtectedRoute>} />
              <Route path="/my-rating" element={<ProtectedRoute userType="user"><MyRating /></ProtectedRoute>} />
              <Route path="/about-groo" element={<ProtectedRoute userType="user"><AboutGroo /></ProtectedRoute>} />
              <Route path="/how-to-use" element={<ProtectedRoute userType="user"><HowToUse /></ProtectedRoute>} />
              <Route path="/update-profile" element={<ProtectedRoute userType="user"><UpdateProfile /></ProtectedRoute>} />
              <Route path="/privacy" element={<Privacy />} />

              <Route path="/notifications" element={<ProtectedRoute userType="user"><Notifications /></ProtectedRoute>} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/help-support" element={<HelpSupport />} />
              <Route path="/cancellation-policy" element={<CancellationPolicy />} />
              <Route path="/weather" element={<ProtectedRoute userType="user"><WeatherReport /></ProtectedRoute>} />
              <Route path="/marketplace" element={<ProtectedRoute userType="user"><Marketplace /></ProtectedRoute>} />
              <Route path="/machinery-explorer" element={<ProtectedRoute userType="user"><MachineryExplorer /></ProtectedRoute>} />
              <Route path="/machinery/checkout" element={<ProtectedRoute userType="user"><MachineryCheckout /></ProtectedRoute>} />
              <Route path="/machinery/:id" element={<ProtectedRoute userType="user"><EquipmentDetail /></ProtectedRoute>} />
              <Route path="/soil-testing" element={<ProtectedRoute userType="user"><SoilTesting /></ProtectedRoute>} />
              <Route path="/agri-marketplace" element={<ProtectedRoute userType="user"><AgriMarket /></ProtectedRoute>} />
              <Route path="/agri-marketplace/:id" element={<ProtectedRoute userType="user"><AgriProductDetail /></ProtectedRoute>} />
              <Route path="/my-agri-orders" element={<ProtectedRoute userType="user"><MyAgriOrders /></ProtectedRoute>} />
              <Route path="/order-payment/:id" element={<Navigate to="/user/my-agri-orders" replace />} />
              <Route path="/agri-cart" element={<ProtectedRoute userType="user"><AgriCart /></ProtectedRoute>} />
              <Route path="/schemes/:id" element={<SchemeDetails />} />
            </Routes>
          </PageTransition>
        </Suspense>
      </div>

      {/* These components are OUTSIDE main Suspense and loaded lazily only when needed */}
      {!isBookingDetailsPage && !isBookingConfirmationPage && !isPublicPage && (
        <Suspense fallback={null}>
          <LiveBookingCard hasBottomNav={shouldShowBottomNav} />
        </Suspense>
      )}
      {shouldShowBottomNav && (
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
      )}
    </ErrorBoundary>
  );
};

export default UserRoutes;

