import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiHome,
  FiUsers,
  FiBriefcase,
  FiUser,
  FiShoppingBag,
  FiGrid,
  FiDollarSign,
  FiFileText,
  FiBell,
  FiSettings,
  FiChevronDown,
  FiX,
  FiPackage,
  FiTrash2,
  FiStar,
  FiActivity,
  FiAlertTriangle,
  FiGlobe,
  FiTruck,
  FiAward,
  FiCreditCard,
  FiTrendingUp,
} from "react-icons/fi";
import adminMenu from "../../config/adminMenu.json";
import dashboardService from "../../services/dashboardService";

// Icon mapping for menu items
const iconMap = {
  Dashboard: FiHome,
  Farmers: FiUsers,
  "Farmer Analytics": FiActivity,
  "Owner Analytics": FiAward,
  "Equipment Owners": FiBriefcase,
  Bookings: FiShoppingBag,
  "User Catalog": FiGrid,
  Payments: FiDollarSign,
  Reports: FiFileText,
  Notifications: FiBell,
  "Admin Revenue": FiTrendingUp,
  Reviews: FiStar,
  Settlements: FiDollarSign,
  "Vendor Wallet Management": FiCreditCard,
  "Vendor Withdraw": FiDollarSign,
  Settings: FiSettings,
  Plans: FiPackage,
  "Agri Marketplace": FiShoppingBag,
  "Soil Testing": FiActivity,
  Disputes: FiAlertTriangle,
  "Scheme Management": FiAward,
  "Equipment Catalog": FiGrid,
  "Machinery Management": FiPackage,
  "Manage Website": FiGlobe
};

// Helper function to convert child name to route path
const getChildRoute = (parentRoute, childName) => {
  const routeMap = {

    "/admin/equipment-catalog": {
      "Home": "/admin/equipment-catalog/home",
      "Manage Categories": "/admin/equipment-catalog/categories",
    },
    "/admin/reports": {
      "Revenue Report": "/admin/reports/revenue",
      "Booking Report": "/admin/reports/bookings",
      "Agriculture Insights": "/admin/reports/agri-insights",
    },
    "/admin/notifications": {
      "Push Notifications": "/admin/notifications/push",
      "Custom Messages": "/admin/notifications/messages",
      "Notification Settings": "/admin/notifications/settings",
    },
    "/admin/settings": {
      "General Settings": "/admin/settings/general",
      "Equipment Configuration": "/admin/settings/service-config",
      "System Settings": "/admin/settings/system",
    },
    "/admin/marketplace": {
      "Marketplace Manager": "/admin/marketplace",
      "Global Orders": "/admin/products/orders",
      "Store Approvals": "/admin/marketplace/store-approvals",
      "Registered Shops": "/admin/marketplace/registered-shops",
    },
    "/admin/manage-website": {
      "Blogs": "/admin/manage-website/blogs",
      "Articles": "/admin/manage-website/articles",
      "Reviews": "/admin/manage-website/reviews",
      "FAQ": "/admin/manage-website/faq",
      "About Us": "/admin/manage-website/about-us",
      "App Guide": "/admin/manage-website/app-guide",
      "Policies": "/admin/manage-website/policies",
    },
  };

  return routeMap[parentRoute]?.[childName] || parentRoute;
};

const AdminSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [adminUser, setAdminUser] = useState({ name: 'Admin', email: '', role: 'admin' });
  const [counts, setCounts] = useState({
    bookings: 0,
    owners: 0,
    withdrawals: 0,
    pendingSettlements: 0
  });

  // Load admin user from storage
  useEffect(() => {
    try {
      const storedData = sessionStorage.getItem('adminData') || localStorage.getItem('adminData');
      const stored = JSON.parse(storedData || '{}');
      if (stored.name || stored.email) {
        setAdminUser({
          name: stored.name || 'Admin',
          email: stored.email || '',
          role: stored.role || 'admin'
        });
      }
    } catch (e) {
      console.error('Failed to parse admin data:', e);
    }
  }, []);

  // Filter menu items by role
  const filteredMenu = useMemo(() => adminMenu.filter(item => {
    if (!item.allowedRoles) return true;
    return item.allowedRoles.includes(adminUser.role);
  }), [adminUser.role]);

  // Fetch pending counts for badges
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const response = await dashboardService.getStats();
        if (response.success && response.data?.stats) {
          const stats = response.data.stats;
          setCounts({
            bookings: stats.pendingBookings || 0,
            owners: stats.pendingVendors || 0,
            withdrawals: stats.pendingWithdrawals || 0,
            pendingSettlements: stats.pendingSettlements || 0
          });
        }
      } catch (error) {
        console.error("Error fetching sidebar counts:", error);
      }
    };

    fetchCounts();
    // Refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Auto-close sidebar on mobile when route changes
  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    // Only close if screen is small (mobile)
    if (window.innerWidth < 1024) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]); // Remove onClose to prevent re-triggering when parent re-renders

  // Auto-expand menu items when their route is active
  useEffect(() => {
    // 1. Try to find parent by explicit child route match first
    let activeItem = filteredMenu.find((item) => {
      return item.children?.some(child => {
        const childRoute = getChildRoute(item.route, child);
        return location.pathname === childRoute ||
          (childRoute !== item.route && location.pathname.startsWith(childRoute + '/'));
      });
    });

    // 2. Fall back to prefix matching if no explicit child route matched
    //    (skip when the path is itself a top-level item, e.g. /admin/vendors/analytics)
    if (!activeItem && !filteredMenu.some((item) => item.route === location.pathname)) {
      activeItem = filteredMenu.find((item) => {
        if (item.route === "/admin/dashboard") {
          return location.pathname === "/admin/dashboard";
        }
        const isChildRoute =
          location.pathname.startsWith(item.route) &&
          location.pathname !== item.route;
        return isChildRoute;
      });
    }

    if (activeItem && activeItem.children && activeItem.children.length > 0) {
      setExpandedItems((prev) => {
        if (prev[activeItem.title]) {
          return prev;
        }
        return {
          [activeItem.title]: true,
        };
      });
    }
  }, [location.pathname, filteredMenu]);

  // Check if a menu item is active
  const isActive = (item) => {
    const route = item.route;
    if (route === "/admin/dashboard") {
      return location.pathname === "/admin/dashboard";
    }

    // If item has children, check if any child is active
    if (item.children && item.children.length > 0) {
      return item.children.some(child => {
        const childRoute = getChildRoute(item.route, child);
        return location.pathname === childRoute ||
          (childRoute !== item.route && location.pathname.startsWith(childRoute + '/'));
      });
    }

    // Vendor Withdraw lives under /admin/settlements but is its own menu item
    if (route === "/admin/settlements" && location.pathname.startsWith("/admin/settlements/withdrawals")) {
      return false;
    }

    // Special case for Equipment Catalog to prevent false active state on sub-routes
    if (route === "/admin/equipment-catalog") {
      if (location.pathname.startsWith("/admin/equipment-catalog/vendor-")) {
        return false;
      }
    }

    // Strict prefix check: either exact match OR followed by a slash
    return location.pathname === route || location.pathname.startsWith(route + '/');
  };

  // Toggle expanded state for menu items with children
  const toggleExpand = (title, closeOthers = true) => {
    setExpandedItems((prev) => {
      if (closeOthers) {
        return {
          [title]: !prev[title],
        };
      } else {
        return {
          ...prev,
          [title]: !prev[title],
        };
      }
    });
  };

  // Handle menu item click
  const handleMenuItemClick = (route, parentTitle = null) => {
    if (parentTitle) {
      setExpandedItems((prev) => {
        return {
          [parentTitle]: true,
        };
      });
    }
    navigate(route);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  // Render menu item
  const renderMenuItem = (item) => {
    const Icon = iconMap[item.title] || FiHome;
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems[item.title];
    const active = isActive(item);

    return (
      <div key={item.route} className="mb-1">
        {/* Main Menu Item */}
        <div
          className={`
            flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 cursor-pointer
            ${active
              ? "bg-primary-600 text-white shadow-sm"
              : "text-gray-300 hover:bg-slate-700"
            }
          `}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.title, true);
            } else {
              handleMenuItemClick(item.route);
            }
          }}>
          <Icon
            className={`text-xl flex-shrink-0 ${active ? "text-white" : "text-gray-400"
              }`}
          />
          <span className="font-semibold flex-1 text-base">{item.title}</span>

          {/* Badge Display */}
          {item.title === "Bookings" && counts.bookings > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse mr-2">
              {counts.bookings > 99 ? '99+' : counts.bookings}
            </span>
          )}
          {item.title === "Equipment Owners" && counts.owners > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse mr-2">
              {counts.owners > 99 ? '99+' : counts.owners}
            </span>
          )}
          {item.title === "Settlements" && counts.pendingSettlements > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse mr-2">
              {counts.pendingSettlements > 99 ? '99+' : counts.pendingSettlements}
            </span>
          )}
          {item.title === "Vendor Withdraw" && counts.withdrawals > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse mr-2">
              {counts.withdrawals > 99 ? '99+' : counts.withdrawals}
            </span>
          )}


          {hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}>
              <FiChevronDown className="text-gray-400 text-sm" />
            </motion.div>
          )}
        </div>

        {/* Children Items */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden">
              <div className="ml-4 mt-1 pl-4 border-l-2 border-slate-600 space-y-1">
                {item.children.map((child, index) => {
                  const childRoute = getChildRoute(item.route, child);
                  const isChildActive =
                    location.pathname === childRoute ||
                    (childRoute !== item.route &&
                      location.pathname.startsWith(childRoute));

                  return (
                    <div
                      key={index}
                      onClick={() =>
                        handleMenuItemClick(childRoute, item.title)
                      }
                      className={`
                        px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer flex justify-between items-center
                        ${isChildActive
                          ? "bg-primary-50 text-white font-medium"
                          : "text-gray-400 hover:bg-slate-700"
                        }
                      `}>
                      <span>{child}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Sidebar content
  const sidebarContent = (
    <div className="h-full w-full flex flex-col bg-slate-800">
      {/* Header Section */}
      <div className="px-4 py-6 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shadow-md flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #2874F0 0%, #4787F7 100%)',
              }}
            >
              <FiUser className="text-white text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-white text-base truncate">
                {adminUser.name}
              </h2>
              <p className="text-xs text-gray-400 truncate">
                {adminUser.role === 'super_admin' ? '' : 'Admin'}
              </p>
            </div>
          </div>

          {/* Close Button - Mobile Only */}
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 lg:hidden"
            aria-label="Close sidebar">
            <FiX className="text-xl text-gray-300" />
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 overflow-y-auto p-3 scrollbar-admin lg:pb-3">
        {filteredMenu.map((item) => renderMenuItem(item))}
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile: Overlay Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[99998] lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 w-[280px] z-[99999] lg:hidden shadow-2xl"
          >
            {sidebarContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar - Desktop Fixed */}
      <div
        className="hidden lg:flex fixed left-0 top-0 bottom-0 z-30"
        style={{ width: '278px' }}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default AdminSidebar;

