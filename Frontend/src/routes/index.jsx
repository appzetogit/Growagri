import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';

const SchemeRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/user/schemes/${id}`} replace />;
};

// Lazy load module routes for fast initial bundle and code-splitting
const UserRoutes = lazy(() => import('../modules/user/routes'));
const VendorRoutes = lazy(() => import('../modules/vendor/routes'));
const WorkerRoutes = lazy(() => import('../modules/worker/routes'));
const AdminRoutes = lazy(() => import('../modules/admin/routes'));

// Lazy load landing pages
const LandingPage = lazy(() => import('../modules/landing/LandingPage'));
const AboutPage = lazy(() => import('../modules/landing/pages/AboutPage'));
const ServicesPage = lazy(() => import('../modules/landing/pages/ServicesPage'));
const WorkflowPage = lazy(() => import('../modules/landing/pages/WorkflowPage'));
const FAQPage = lazy(() => import('../modules/landing/pages/FAQPage'));
const BlogListing = lazy(() => import('../modules/landing/pages/BlogListing'));
const BlogDetail = lazy(() => import('../modules/landing/pages/BlogDetail'));
const ArticleListing = lazy(() => import('../modules/landing/pages/ArticleListing'));
const ArticleDetail = lazy(() => import('../modules/landing/pages/ArticleDetail'));

// Lazy load global widgets
const LocationPermissionChecker = lazy(() =>
  import('../components/common').then((m) => ({ default: m.LocationPermissionChecker }))
);
const Chatbot = lazy(() =>
  import('../components/common').then((m) => ({ default: m.Chatbot }))
);

// Minimal route fallback
const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-3 border-[#426B4F] border-t-transparent rounded-full animate-spin" />
  </div>
);

const AppRoutes = () => {
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isVendorRoute = location.pathname.startsWith('/vendor');
  const isWorkerRoute = location.pathname.startsWith('/worker');
  const isAuthRoute =
    location.pathname.includes('/login') ||
    location.pathname.includes('/signup');

  const hideGlobalElements =
    isAdminRoute ||
    isVendorRoute ||
    isWorkerRoute ||
    isAuthRoute ||
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
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>

      {!hideGlobalElements && (
        <Suspense fallback={null}>
          <LocationPermissionChecker />
          {isHomePage && <Chatbot />}
        </Suspense>
      )}
    </>
  );
};

export default AppRoutes;

