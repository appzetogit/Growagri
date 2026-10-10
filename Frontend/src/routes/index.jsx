import React from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

const SchemeRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/user/schemes/${id}`} replace />;
};

// Import module routes
import LandingPage from '../modules/landing/LandingPage';
import UserRoutes from '../modules/user/routes';
import VendorRoutes from '../modules/vendor/routes';
import WorkerRoutes from '../modules/worker/routes';
import AdminRoutes from '../modules/admin/routes';
import BlogListing from '../modules/landing/pages/BlogListing';
import ArticleListing from '../modules/landing/pages/ArticleListing';
import BlogDetail from '../modules/landing/pages/BlogDetail';
import ArticleDetail from '../modules/landing/pages/ArticleDetail';
import AboutPage from '../modules/landing/pages/AboutPage';
import ServicesPage from '../modules/landing/pages/ServicesPage';
import WorkflowPage from '../modules/landing/pages/WorkflowPage';
import FAQPage from '../modules/landing/pages/FAQPage';
import { LocationPermissionChecker, Chatbot } from '../components/common';

const AppRoutes = () => {
  const location = useLocation();
  
  React.useEffect(() => {
    // console.log('📍 Current Route Path:', location.pathname);
  }, [location.pathname]);

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isVendorRoute = location.pathname.startsWith('/vendor');
  const isWorkerRoute = location.pathname.startsWith('/worker');

  const hideGlobalElements =
    isAdminRoute ||
    isVendorRoute ||
    isWorkerRoute ||
    [
      '/user/checkout',
      '/checkout',
      '/user/privacy',
      '/user/help-support',
      '/user/cancellation-policy',
      '/privacy',
      '/terms',
      '/support'
    ].includes(location.pathname);

  const isHomePage = ['/', '/user', '/user/', '/home', '/user/home'].includes(location.pathname);

  return (
    <>
      <Routes>
        {/* Module Routes - High Priority */}
        <Route path="/user/*" element={<UserRoutes />} />
        <Route path="/vendor/*" element={<VendorRoutes />} />
        <Route path="/worker/*" element={<WorkerRoutes />} />
        <Route path="/admin/*" element={<AdminRoutes />} />

        {/* Landing experience */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/workflow" element={<WorkflowPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/blogs" element={<BlogListing />} />
        <Route path="/blogs/:id" element={<BlogDetail />} />
        <Route path="/articles" element={<ArticleListing />} />
        <Route path="/articles/:id" element={<ArticleDetail />} />

        <Route path="/schemes/:id" element={<SchemeRedirect />} />
        <Route path="/privacy" element={<Navigate to="/user/privacy" replace />} />
        <Route path="/support" element={<Navigate to="/user/help-support" replace />} />
        <Route path="/terms" element={<Navigate to="/user/cancellation-policy" replace />} />

        {/* Fallback for any unknown user routes to go to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!hideGlobalElements && (
        <>
          <LocationPermissionChecker />
          {isHomePage && <Chatbot />}
        </>
      )}
    </>
  );
};

export default AppRoutes;

