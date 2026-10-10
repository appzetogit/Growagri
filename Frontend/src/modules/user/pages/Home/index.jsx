import React, { useState, useEffect, useLayoutEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import SearchBar from './components/SearchBar';
import ServiceCategories from './components/ServiceCategories';
import { publicCatalogService } from '../../../../services/catalogService';
import { useCart } from '../../../../context/CartContext';
import { useCity } from '../../../../context/CityContext';
import { useSocket } from '../../../../context/SocketContext';
import { toast } from 'react-hot-toast';
import { registerFCMToken } from '../../../../services/pushNotificationService';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowLeft, FiX } from 'react-icons/fi';

import { userAuthService } from '../../../../services/authService';
// Lazy load heavy components for better initial load performance
import PromoCarousel from './components/PromoCarousel';
// Lazy load OTHER heavy components
const NewAndNoteworthy = lazy(() => import('./components/NewAndNoteworthy'));
const CuratedServices = lazy(() => import('./components/CuratedServices'));
import ReferEarnSection from './components/ReferEarnSection';
import CategoryModal from './components/CategoryModal';
import SearchOverlay from './components/SearchOverlay';
import WeatherWidget from './components/WeatherWidget';
import AgriMarketplaceSection from './components/AgriMarketplaceSection';
import MachineryDiscoverySection from './components/MachineryDiscoverySection';
import GovernmentSchemesSection from './components/GovernmentSchemesSection';
import LogoLoader from '../../../../components/common/LogoLoader';
import AddressSelectionModal from '../Checkout/components/AddressSelectionModal';



const toAssetUrl = (url, options = {}) => {
  if (!url) return '';
  let clean = url.replace('/api/upload', '/upload');
  if (clean.includes('res.cloudinary.com') && clean.includes('/upload/') && !clean.includes('f_auto')) {
    const width = options.width ? `,w_${options.width}` : '';
    const height = options.height ? `,h_${options.height}` : '';
    const crop = options.crop ? `,c_${options.crop}` : '';
    clean = clean.replace('/upload/', `/upload/f_auto,q_auto${width}${height}${crop}/`);
  }
  if (clean.startsWith('http')) return clean;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
  return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
};

const Home = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [address, setAddress] = useState(localStorage.getItem('currentAddress') || 'Select Location');
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [houseNumber, setHouseNumber] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLocationSupported, setIsLocationSupported] = useState(true);
  const [detectedCityName, setDetectedCityName] = useState(localStorage.getItem('currentCity') || null);


  const { cartCount, addToCart } = useCart();
  const { currentCity, cities, selectCity, loading: cityLoading } = useCity();

  // Clean up legacy storage keys on mount
  useEffect(() => {
    ['userAddress', 'detectedCity', 'user_formatted_address', 'user_city'].forEach(key => localStorage.removeItem(key));
  }, []);

  // Sync detectedCityName with Address on mount/update if not already set
  useEffect(() => {
    if (address && address !== 'Select Location' && cities && cities.length > 0) {
      const foundCity = cities.find(c =>
        address.toLowerCase().includes(c.name.toLowerCase())
      );
      if (foundCity) {
        if (detectedCityName !== foundCity.name) {
          setDetectedCityName(foundCity.name);
          localStorage.setItem('currentCity', foundCity.name);
        }
      } else {
        // Address is present but doesn't contain any supported city name
        // Try to parse ANY city from the address string (e.g. "Bhopal")
        const parts = address.split(',').map(p => p.trim());
        // Usually city is 2nd or 3rd to last in Google address strings
        const cityCandidate = parts.length > 2 ? parts[parts.length - 3] : (parts.length > 1 ? parts[parts.length - 2] : parts[0]);

        if (detectedCityName !== cityCandidate) {
          setDetectedCityName(cityCandidate);
          localStorage.setItem('currentCity', cityCandidate);
        }
        setIsLocationSupported(false);
      }
    }
  }, [address, cities, detectedCityName]);

  // Validate city whenever detected name or cities list changes
  useEffect(() => {
    if (!detectedCityName || !cities || cities.length === 0) return;

    const matchedCity = cities.find(c => c.name.toLowerCase() === detectedCityName.toLowerCase()) ||
      cities.find(c => c.name.toLowerCase().includes(detectedCityName.toLowerCase()) ||
        detectedCityName.toLowerCase().includes(c.name.toLowerCase()));

    if (matchedCity) {
      setIsLocationSupported(true);
      const matchedId = matchedCity._id || matchedCity.id;
      const currentId = currentCity?._id || currentCity?.id;

      if (!cityLoading && currentId && matchedId !== currentId) {
        selectCity(matchedCity);
        toast.success(`Location updated to ${matchedCity.name}`);
      }
    } else {
      setIsLocationSupported(false);
      if (currentCity) selectCity(null);
    }
  }, [detectedCityName, cities, currentCity, cityLoading]);


  const handleAddressSave = (savedHouseNumber, locationObj) => {
    if (locationObj) {
      const newAddress = locationObj.address;
      setAddress(newAddress);
      localStorage.setItem('currentAddress', newAddress);

      // Try to parse city from location object (Google Places)
      const components = locationObj.components || locationObj.address_components;
      let city = '';
      if (components) {
        const getComponent = (type) => components.find(c => c.types.includes(type))?.long_name || '';
        city = getComponent('locality') || getComponent('administrative_area_level_2');
      }

      // Fallback city parsing from address string if components failed
      if (!city && newAddress) {
        const parts = newAddress.split(',').map(p => p.trim());
        city = parts.length > 2 ? parts[parts.length - 3] : (parts.length > 1 ? parts[parts.length - 2] : parts[0]);
      }

      if (city) {
        setDetectedCityName(city);
        localStorage.setItem('currentCity', city);

        // Sync location with profile for Weather Notifications
        const accessToken = localStorage.getItem('accessToken');
        if (accessToken && locationObj.lat && locationObj.lng) {
          userAuthService.updateProfile({
            addresses: [{
              addressLine1: newAddress,
              city: city,
              lat: locationObj.lat,
              lng: locationObj.lng,
              isDefault: true
            }]
          }).catch(err => console.log('Manual location sync failed', err));
        }

        // Immediate update of selected city if supported
        if (cities && cities.length > 0) {
          const matchedCity = cities.find(c => c.name.toLowerCase() === city.toLowerCase()) ||
            cities.find(c => c.name.toLowerCase().includes(city.toLowerCase()) ||
              city.toLowerCase().includes(c.name.toLowerCase()));
          if (matchedCity) {
            selectCity(matchedCity);
          } else {
            selectCity(null);
          }
        }

        toast.success(`Location set to ${city}`);
      }
    }
    setHouseNumber(savedHouseNumber);
    setIsAddressModalOpen(false);
  };

  // Auto-detect location on mount
  useEffect(() => {
    const autoDetectLocation = async () => {
      if (navigator.geolocation) {
        if (address === 'Select Location') {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              try {
                const { latitude, longitude } = position.coords;
                const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
                const response = await fetch(
                  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
                );
                const data = await response.json();

                if (data.status === 'OK' && data.results.length > 0) {
                  const result = data.results[0];
                  const getComponent = (type) =>
                    result.address_components.find(c => c.types.includes(type))?.long_name || '';

                  const area = getComponent('sublocality_level_1') || getComponent('neighborhood') || getComponent('locality');
                  const city = getComponent('locality') || getComponent('administrative_area_level_2');
                  const state = getComponent('administrative_area_level_1');

                  const formattedAddress = `${area}, ${city}, ${state}`;
                  setAddress(formattedAddress);
                  localStorage.setItem('currentAddress', formattedAddress);

                  if (city) {
                    setDetectedCityName(city);
                    localStorage.setItem('currentCity', city);

                    // Sync location with profile for Weather Notifications
                    const accessToken = localStorage.getItem('accessToken');
                    if (accessToken) {
                      userAuthService.updateProfile({
                        addresses: [{
                          addressLine1: formattedAddress,
                          city: city,
                          state: state,
                          lat: latitude,
                          lng: longitude,
                          isDefault: true
                        }]
                      }).catch(err => console.log('Location sync failed', err));
                    }

                    // Immediate update of selected city if supported
                    if (cities && cities.length > 0) {
                      const matchedCity = cities.find(c => c.name.toLowerCase() === city.toLowerCase()) ||
                        cities.find(c => c.name.toLowerCase().includes(city.toLowerCase()) ||
                          city.toLowerCase().includes(c.name.toLowerCase()));
                      if (matchedCity) {
                        selectCity(matchedCity);
                      } else {
                        selectCity(null);
                      }
                    }
                  }
                }
              } catch (error) {
                // Silent fail
              }
            },
            (error) => {
              console.log("GPS Error:", error);
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0
            }
          );
        }
      }
    };

    autoDetectLocation();

    // Register FCM token for user to receive push notifications
    registerFCMToken('user', true).catch(err => {/* Silent fail */ });
  }, []);

  const [categories, setCategories] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_home_categories');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [homeContent, setHomeContent] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_home_content');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    const cachedCat = localStorage.getItem('cached_home_categories');
    const cachedHome = localStorage.getItem('cached_home_content');
    return !cachedCat || !cachedHome;
  });

  // Handle scroll separately (only when needed)
  useEffect(() => {
    if (location.state?.scrollToTop) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      window.history.replaceState({}, '', location.pathname);
    }
  }, [location.state?.scrollToTop, location.pathname]);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [activeSectionTab, setActiveSectionTab] = useState(null); // 'Driver Based', 'Farming Equipment', 'Advance Service'

  // Fetch categories and home content on mount (and when city changes)
  useEffect(() => {
    if (cityLoading && !currentCity) return;

    const fetchData = async () => {
      try {
        if (!categories.length || !homeContent) {
          setLoading(true);
        }
        const cityId = currentCity?._id || currentCity?.id;

        const [categoriesRes, homeContentRes] = await Promise.all([
          publicCatalogService.getCategories({ cityId, forceRefresh: true }),
          publicCatalogService.getHomeContent(cityId)
        ]);

        if (categoriesRes.success && categoriesRes.categories) {
          const mappedCategories = categoriesRes.categories.map(cat => ({
            id: cat.id,
            title: cat.title,
            slug: cat.slug,
            icon: toAssetUrl(cat.icon, { width: 120, height: 120, crop: 'fill' }),
            hasSaleBadge: cat.hasSaleBadge,
            badge: cat.badge,
            requiresDriver: cat.requiresDriver,
            sectionType: cat.sectionType || 'General',
            showOnHome: cat.showOnHome ?? true
          }));
          setCategories(mappedCategories);
          try {
            localStorage.setItem('cached_home_categories', JSON.stringify(mappedCategories));
          } catch { }
        }

        if (homeContentRes.success && homeContentRes.homeContent) {
          setHomeContent(homeContentRes.homeContent);
          try {
            localStorage.setItem('cached_home_content', JSON.stringify(homeContentRes.homeContent));
          } catch { }
        }

        setLoading(false);
      } catch (error) {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentCity, cityLoading]);

  const { socket } = useSocket() || {};

  // Real-time synchronization: Instant updates when Admin adds, edits, deletes or toggles content
  useEffect(() => {
    const handleHomeContentUpdate = (eventOrData) => {
      const payload = eventOrData?.detail || eventOrData;
      if (!payload) return;

      publicCatalogService.invalidateCache();
      try {
        localStorage.removeItem('cached_home_content');
      } catch { }

      if (payload.homeContent) {
        setHomeContent(payload.homeContent);
      } else {
        const userCityId = currentCity?._id || currentCity?.id;
        publicCatalogService.getHomeContent(userCityId, true).then(res => {
          if (res?.success && res?.homeContent) {
            setHomeContent(res.homeContent);
          }
        });
      }
    };

    const handleCategoriesUpdate = () => {
      const userCityId = currentCity?._id || currentCity?.id;
      publicCatalogService.invalidateCache();
      try {
        localStorage.removeItem('cached_home_categories');
      } catch { }
      publicCatalogService.getCategories({ cityId: userCityId, forceRefresh: true }).then(res => {
        if (res?.success && res?.categories) {
          const mappedCategories = res.categories.map(cat => ({
            id: cat.id,
            title: cat.title,
            slug: cat.slug,
            icon: toAssetUrl(cat.icon, { width: 120, height: 120, crop: 'fill' }),
            hasSaleBadge: cat.hasSaleBadge,
            badge: cat.badge,
            requiresDriver: cat.requiresDriver,
            sectionType: cat.sectionType || 'General',
            showOnHome: cat.showOnHome ?? true
          }));
          setCategories(mappedCategories);
        }
      });
    };

    // 1. WebSocket network updates
    if (socket) {
      socket.on('home_content_updated', handleHomeContentUpdate);
      socket.on('categories_updated', handleCategoriesUpdate);
    }

    // 2. Custom window events (same-window communication)
    window.addEventListener('home_content_updated', handleHomeContentUpdate);
    window.addEventListener('categories_updated', handleCategoriesUpdate);

    // 3. BroadcastChannel (cross-tab communication)
    let bc = null;
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      try {
        bc = new BroadcastChannel('groo_catalog_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'HOME_CONTENT_UPDATED') {
            handleHomeContentUpdate(event.data);
          } else if (event.data?.type === 'CATEGORIES_UPDATED') {
            handleCategoriesUpdate();
          }
        };
      } catch (e) { }
    }

    return () => {
      if (socket) {
        socket.off('home_content_updated', handleHomeContentUpdate);
        socket.off('categories_updated', handleCategoriesUpdate);
      }
      window.removeEventListener('home_content_updated', handleHomeContentUpdate);
      window.removeEventListener('categories_updated', handleCategoriesUpdate);
      if (bc) bc.close();
    };
  }, [socket, currentCity]);
  // Open category modal from navigation state (e.g. from Cart 'Add Services')
  useEffect(() => {
    if (!loading && categories.length > 0 && (location.state?.openCategoryId || location.state?.openCategoryName)) {
      const targetId = location.state.openCategoryId;
      const targetName = location.state.openCategoryName;

      const cat = categories.find(c =>
        (targetId && (c.id === targetId || c._id === targetId)) ||
        (targetName && c.title === targetName)
      );

      if (cat) {
        handleCategoryClick(cat);
        // Clear state to prevent reopening on subsequent renders/refreshes
        window.history.replaceState({}, '', location.pathname);
      }
    }
  }, [loading, categories, location.state]);

  const handleSearch = (query) => {
    // Navigate to search results page
  };

  const handleCategoryClick = (category) => {
    if (category) {
      const slug = (category.slug || '').toLowerCase();
      const title = (category.title || '').toLowerCase();
      if (slug.includes('soil') || title.includes('soil')) {
        navigate('/user/soil-testing');
        return;
      }
    }
    setSelectedCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handlePromoClick = (promo) => {
    if (promo.targetCategoryId) {
      const cat = categories.find(c => (c.id === promo.targetCategoryId || c._id === promo.targetCategoryId));
      if (cat) {
        handleCategoryClick(cat);
        return;
      }
    }
    // Brand/slug pages were removed; slug-only promos fall back to their route
    if (promo.route) {
      if (promo.scrollToSection) {
        navigate(promo.route, {
          state: { scrollToSection: promo.scrollToSection }
        });
      } else {
        navigate(promo.route);
      }
    }
  };

  const handleServiceClick = (service) => {
    if (!service) return;
    if (service.targetCategoryId) {
      const cat = categories.find(c => (c.id === service.targetCategoryId || c._id === service.targetCategoryId));
      if (cat) {
        handleCategoryClick(cat);
        return;
      }
    }
    // Fallback if no targetCategoryId but has slug/title, we no longer navigate to slug
  };

  const handleAddClick = async (service) => {
    try {
      if (service.targetCategoryId) {
        const cat = categories.find(c => c.id === service.targetCategoryId);
        if (cat) {
          handleCategoryClick(cat);
          return;
        }
      }

      if (service.serviceId && service.categoryId) {
        const cartItemData = {
          serviceId: service.serviceId,
          categoryId: service.categoryId,
          title: service.title,
          description: service.subtitle || service.description || '',
          icon: service.image || '',
          category: service.category || 'Equipment',
          price: parseInt(service.price?.toString().replace(/,/g, '') || 0),
          originalPrice: service.originalPrice ? parseInt(service.originalPrice.toString().replace(/,/g, '')) : null,
          unitPrice: parseInt(service.price?.toString().replace(/,/g, '') || 0),
          serviceCount: 1,
          rating: service.rating || "4.8",
          reviews: service.reviews || "10k+",
          vendorId: service.vendorId || null,
          sectionId: service.sectionId || null // VITAL: Added for plan benefits
        };

        const response = await addToCart(cartItemData);
        if (response.success) {
          toast.success(`${service.title} added to cart!`);
          navigate('/user/cart');
        } else {
          toast.error(response.message || 'Failed to add to cart');
        }
      } else {
        if (service.targetCategoryId) {
          const cat = categories.find(c => (c.id === service.targetCategoryId || c._id === service.targetCategoryId));
          if (cat) {
            handleCategoryClick(cat);
          } else {
            toast.error('Unable to add this item to cart.');
          }
        } else {
          toast.error('Unable to add this item to cart.');
        }
      }
    } catch (error) {
      toast.error('Failed to add to cart. Please try again.');
    }
  };

  const handleReferClick = () => {
    navigate('/user/rewards');
  };

  const handleLocationClick = () => {
    setIsAddressModalOpen(true);
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  if (loading) {
    return <LogoLoader />;
  }

  return (
    <div className="min-h-screen pb-20 relative" style={{ backgroundColor: '#F1F8E9' }}>
      {/* Refined Brand Mesh Gradient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0"
          style={{
            background: `
              radial-gradient(at 0% 0%, ${themeColors?.brand?.teal || '#347989'}25 0%, transparent 70%),
              radial-gradient(at 100% 0%, ${themeColors?.brand?.yellow || '#D68F35'}20 0%, transparent 70%),
              radial-gradient(at 100% 100%, ${themeColors?.brand?.orange || '#BB5F36'}15 0%, transparent 75%),
              radial-gradient(at 0% 100%, ${themeColors?.brand?.teal || '#347989'}10 0%, transparent 70%),
              radial-gradient(at 50% 50%, ${themeColors?.brand?.teal || '#347989'}03 0%, transparent 100%),
              #F1F8E9
            `
          }}
        />
        {/* Elegant Dot Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(${themeColors?.brand?.teal || '#347989'} 0.8px, transparent 0.8px)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      <motion.div
        className="relative z-10"
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <motion.div
          variants={itemVariants}
          className="backdrop-blur-xl sticky top-0 z-50 border-b border-black/[0.03] rounded-b-[24px] shadow-[0_4px_30px_rgba(0,0,0,0.03)] transition-all duration-300"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
        >
          <Header
            location={address}
            onLocationClick={handleLocationClick}
          />
          <div className="px-5 pb-5 pt-1 max-w-lg mx-auto w-full">
            <SearchBar onInputClick={() => setIsSearchOpen(true)} categories={categories} />
          </div>
        </motion.div>

        <main className="pt-6 space-y-8 pb-24 max-w-screen-xl mx-auto w-full">
          {!isLocationSupported && (
            <div
              className="flex items-center justify-between gap-3 py-2.5 px-4 mx-4 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.07)'
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(251,146,60,0.18)', border: '1px solid rgba(251,146,60,0.35)' }}>
                  <span className="text-sm">📍</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-black text-white leading-tight" style={{ letterSpacing: '0.01em' }}>
                    Service not available in your city
                  </p>
                  <p className="text-[9.5px] font-semibold leading-tight" style={{ color: 'rgba(251,146,60,0.75)' }}>
                    Showing All-India default catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddressModalOpen(true)}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #f97316, #ea580c)',
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(249,115,22,0.45)'
                }}
              >
                Change
              </button>
            </div>
          )}

          <>
            {/* Hero Section - Promo Carousel */}
            {homeContent?.isPromosVisible !== false && (homeContent?.promos || []).length > 0 && (
              <motion.section variants={itemVariants} className="relative z-0 mb-0 pb-0">
                <PromoCarousel
                  promos={(homeContent?.promos || []).map(promo => ({
                    id: promo.id || promo._id,
                    title: promo.title || '',
                    subtitle: promo.subtitle || promo.description || '',
                    buttonText: promo.buttonText || 'Book now',
                    className: promo.gradientClass || 'from-[#00A6A6] to-[#008a8a]',
                    image: toAssetUrl(promo.imageUrl, { width: 800 }),
                    targetCategoryId: promo.targetCategoryId,
                    slug: promo.slug,
                    scrollToSection: promo.scrollToSection,
                    order: promo.order || 0,
                    route: null
                  })).sort((a, b) => (a.order || 0) - (b.order || 0))}
                  onPromoClick={handlePromoClick}
                />
              </motion.section>
            )}

            {/* Quick Agri Actions (3-Column Grid Matching Reference) */}
            {homeContent?.isPremiumOfferingsVisible !== false && (
              <motion.section variants={itemVariants} className="px-3 sm:px-5 pt-1 pb-3 mt-2 sm:mt-3">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex flex-col">
                    <h2 className="text-[18px] sm:text-[20px] font-black text-slate-900 tracking-tight">
                      {homeContent?.exploreServicesTitle || 'Explore Services'}
                    </h2>
                    {(homeContent?.exploreServicesSubtitle || 'Discover Services for a Better Tomorrow') && (
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        {homeContent?.exploreServicesSubtitle || 'Discover Services for a Better Tomorrow'}
                      </p>
                    )}
                  </div>
                </div>

                {/* 3-Column Grid */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
                  {(homeContent?.premiumOfferings || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map((item, idx) => (
                    <motion.div
                      key={item.id || item._id || idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => {
                        if (item.actionType === 'navigate' && item.route && item.route.trim() !== '') {
                          navigate(item.route.trim());
                        } else {
                          // setActiveSectionTab: use title as primary (admin sets category sectionType = tab title)
                          // Fall back to actionPayload if title is missing
                          const tabKey = (item.title || item.actionPayload || '').trim();
                          if (tabKey) setActiveSectionTab(tabKey);
                        }
                      }}
                      className="relative bg-white border border-slate-100/90 rounded-[20px] sm:rounded-[22px] px-1.5 py-3 sm:px-2.5 sm:py-3.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-md transition-all active:scale-95 group flex flex-col items-center justify-between text-center cursor-pointer min-h-[114px] sm:min-h-[128px]"
                    >
                      {/* Circular Illustration / Image Badge */}
                      <div
                        className="relative w-14 h-14 min-[390px]:w-15 min-[390px]:h-15 sm:w-16 sm:h-16 rounded-full p-1 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-xs border overflow-hidden"
                        style={{
                          backgroundColor: item.colorCode ? `${item.colorCode}14` : '#f0fdf4',
                          borderColor: item.colorCode ? `${item.colorCode}29` : '#dcfce7'
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            src={toAssetUrl(item.imageUrl, { width: 140, height: 140, crop: 'fill' })}
                            alt={item.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <span className="text-xl font-bold" style={{ color: item.colorCode || '#166534' }}>
                            {item.title?.charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Title (Single Line, No Subtitle) */}
                      <div className="w-full mt-2 sm:mt-2.5 flex-1 flex flex-col items-center justify-center">
                        <p className="text-[10.5px] min-[360px]:text-[11.5px] min-[390px]:text-[12px] sm:text-[13px] font-bold text-slate-800 leading-tight tracking-tight text-center whitespace-nowrap overflow-hidden text-ellipsis px-0.5">
                          {item.title}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  {/* Weather Button (Dynamic Toggle from Admin) */}
                  {homeContent?.showWeatherTile !== false && <WeatherWidget />}
                </div>
              </motion.section>
            )}


            {/* Categories Sections - Only show categories whose sectionType is NOT a tab (premiumOfferings tab titles) */}
            {homeContent?.isCategoriesVisible !== false && categories.length > 0 && (() => {
              // Collect all tab titles from premiumOfferings to exclude those sectionTypes
              const tabSectionTypes = new Set(
                (homeContent?.premiumOfferings || []).map(item => (item.title || '').trim().toLowerCase())
              );

              // Only show categories that are NOT tab-based (i.e. sectionType not in tabSectionTypes)
              const nonTabCategories = categories.filter(c =>
                c.showOnHome !== false &&
                !tabSectionTypes.has((c.sectionType || 'General').trim().toLowerCase())
              );

              if (nonTabCategories.length === 0) return null;

              const sectionTypes = [...new Set(nonTabCategories.map(c => (c.sectionType || 'General').trim()))];
              return (
                <>
                  {sectionTypes.map(sectionType => {
                    const sectionCategories = nonTabCategories.filter(c => (c.sectionType || 'General').trim() === sectionType);
                    if (sectionCategories.length === 0) return null;
                    return (
                      <motion.section key={sectionType} variants={itemVariants} className="relative overflow-hidden pt-2 mb-4">
                        <div className="absolute inset-0 bg-gradient-to-b from-gray-50/30 to-transparent pointer-events-none -z-10" />
                        <ServiceCategories
                          title={sectionType === 'General' ? 'General Services' : sectionType}
                          subtitle={sectionType === 'General' ? 'ALL OTHER SERVICES' : `EXPLORE ${sectionType.toUpperCase()}`}
                          categories={sectionCategories}
                          onCategoryClick={handleCategoryClick}
                          onSeeAllClick={() => { }}
                        />
                      </motion.section>
                    );
                  })}
                </>
              );
            })()}

            {/* Curated Services */}
            {homeContent?.isCuratedVisible !== false && (
              <motion.div variants={itemVariants}>
                <Suspense fallback={<div className="h-40 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                  <CuratedServices
                    services={(homeContent?.curated || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => ({
                      id: item.id || item._id,
                      title: item.title,
                      gif: toAssetUrl(item.gifUrl),
                      slug: item.slug,
                      targetCategoryId: item.targetCategoryId
                    }))}
                    onServiceClick={handleServiceClick}
                  />
                </Suspense>
              </motion.div>
            )}

            {/* New & Noteworthy */}
            {homeContent?.isNoteworthyVisible !== false && (
              <motion.div variants={itemVariants}>
                <Suspense fallback={<div className="h-40 bg-gray-50 animate-pulse rounded-xl mx-4" />}>
                  <NewAndNoteworthy
                    services={(homeContent?.noteworthy || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map(item => ({
                      id: item.id || item._id,
                      title: item.title,
                      image: toAssetUrl(item.imageUrl),
                      slug: item.slug,
                      targetCategoryId: item.targetCategoryId
                    }))}
                    onServiceClick={handleServiceClick}
                  />
                </Suspense>
              </motion.div>
            )}



            {/* Government Schemes Section */}
            <motion.div variants={itemVariants}>
              <GovernmentSchemesSection />
            </motion.div>

            {/* Refer & Earn Section */}
            <motion.div variants={itemVariants}>
              <ReferEarnSection onReferClick={handleReferClick} />
            </motion.div>

            {/* Machinery Discovery Section */}
            <motion.div variants={itemVariants}>
              <MachineryDiscoverySection />
            </motion.div>

            {/* Agriculture Marketplace */}
            <motion.div variants={itemVariants}>
              <AgriMarketplaceSection />
            </motion.div>


          </>
        </main>
      </motion.div>

      {/* Bottom Navigation */}
      {!isAddressModalOpen && <BottomNav />}

      {/* Category Modal */}
      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        category={selectedCategory}
        currentCity={currentCity}
      />

      {/* Section Tab Full Page Modal */}
      <AnimatePresence>
        {activeSectionTab && (
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            className="fixed inset-0 z-[9999] bg-[#F8FBFF] flex flex-col h-full w-full overflow-hidden"
          >
            {/* Top Navigation Bar */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 px-4 py-3.5 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveSectionTab(null)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700 transition-all"
                  aria-label="Back"
                >
                  <FiArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="font-black text-slate-900 text-base sm:text-lg leading-tight line-clamp-1">
                    {activeSectionTab}
                  </h1>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
                    Explore Services
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveSectionTab(null)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-600 transition-all"
                aria-label="Close"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Full-Page Body */}
            <div className="flex-1 overflow-y-auto px-4 py-6 pb-28">
              {(() => {
                const sectionCategories = categories.filter(
                  c => (c.sectionType || '').trim().toLowerCase() === (activeSectionTab || '').trim().toLowerCase()
                );

                if (sectionCategories.length > 0) {
                  return (
                    <div className="max-w-2xl mx-auto space-y-6">
                      <ServiceCategories
                        showHeader={false}
                        categories={sectionCategories}
                        onCategoryClick={(cat) => {
                          setActiveSectionTab(null);
                          handleCategoryClick(cat);
                        }}
                        onSeeAllClick={() => { }}
                      />
                    </div>
                  );
                }

                return (
                  <div className="py-20 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3 text-2xl font-bold">
                      !
                    </div>
                    <h3 className="font-bold text-slate-700 text-base mb-1">No Services Available</h3>
                    <p className="text-slate-400 text-xs max-w-xs">
                      Currently no services or equipment are listed under {activeSectionTab}.
                    </p>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        categories={categories}
        onCategoryClick={handleCategoryClick}
      />

      {/* Address Selection Modal */}
      <AddressSelectionModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        houseNumber={houseNumber}
        onHouseNumberChange={setHouseNumber}
        onSave={handleAddressSave}
      />


    </div>
  );
};

export default Home;
