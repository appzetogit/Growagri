/**
 * Predictive Route Prefetcher for GrooAgri User App
 * Preloads page chunks into browser memory in the background
 * so that navigation feels completely instantaneous (< 100ms).
 */

const prefetchedRoutes = new Set();

const ROUTE_LOADERS = {
  bookings: () => import('../modules/user/pages/MyBookings'),
  cart: () => import('../modules/user/pages/Cart'),
  account: () => import('../modules/user/pages/Account'),
  'agri-market': () => import('../modules/user/pages/AgriMarket'),
  machinery: () => import('../modules/user/pages/Machinery/MachineryExplorer'),
  'soil-testing': () => import('../modules/user/pages/SoilTesting'),
  weather: () => import('../modules/user/pages/WeatherReport'),
  rewards: () => import('../modules/user/pages/Rewards'),
  schemes: () => import('../modules/user/pages/Schemes/SchemeDetails'),
  checkout: () => import('../modules/user/pages/Checkout'),
  orders: () => import('../modules/user/pages/AgriMarket/MyOrders'),
};

/**
 * Prefetch a single user route chunk
 * @param {string} routeName 
 */
export const prefetchUserRoute = (routeName) => {
  if (!routeName || prefetchedRoutes.has(routeName)) return;

  const loader = ROUTE_LOADERS[routeName];
  if (loader) {
    prefetchedRoutes.add(routeName);
    // Execute dynamic import to cache chunk in browser HTTP & memory cache
    loader().catch(() => {
      // Allow retry if network failed
      prefetchedRoutes.delete(routeName);
    });
  }
};

/**
 * Schedule background prefetching during browser idle time
 * @param {string[]} routes 
 * @param {number} delayMs 
 */
export const scheduleIdlePrefetch = (
  routes = ['bookings', 'cart', 'account', 'agri-market'],
  delayMs = 1200
) => {
  if (typeof window === 'undefined') return;

  const runPrefetch = () => {
    routes.forEach((route, index) => {
      setTimeout(() => {
        prefetchUserRoute(route);
      }, index * 200); // Stagger prefetch requests by 200ms to keep network free
    });
  };

  if ('requestIdleCallback' in window) {
    setTimeout(() => {
      window.requestIdleCallback(runPrefetch, { timeout: 3000 });
    }, delayMs);
  } else {
    setTimeout(runPrefetch, delayMs);
  }
};
