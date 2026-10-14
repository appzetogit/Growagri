import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiEdit2, FiMapPin, FiPhone, FiMail, FiBriefcase, FiStar, FiArrowRight, FiSettings, FiChevronRight, FiCreditCard, FiLogOut, FiClock, FiCheckCircle, FiPackage, FiActivity } from 'react-icons/fi';
import { FaTractor } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import { vendorAuthService } from '../../../../services/authService';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import LogoLoader from '../../../../components/common/LogoLoader';
import vendorProductService from '../../services/vendorProductService';

const Profile = () => {
  const navigate = useNavigate();

  // Helper function to convert hex to rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasOutOfStockProducts, setHasOutOfStockProducts] = useState(false);

  const menuItems = React.useMemo(() => [
    { id: 12, label: 'My Agri-Store', icon: FaTractor, path: '/vendor/store' },
    { id: 14, label: 'Registered for Soil Testing', icon: FiBriefcase, path: '/vendor/business-details' },
    { id: 5, label: 'My Ratings', icon: FiStar, path: '/vendor/my-ratings' },
    { id: 7, label: 'Manage Address', icon: FiMapPin, path: '/vendor/address-management' },
    { id: 8, label: 'Settings', icon: FiSettings, path: '/vendor/settings' },
    { id: 10, label: 'Maintenance Calendar', icon: FiClock, path: '/vendor/maintenance' },
    { id: 11, label: 'Legal Compliance', icon: FiCheckCircle, path: '/vendor/compliance' },
    { id: 13, label: 'Soil Test Requests', icon: FiActivity, path: '/vendor/soil-tests' },
    { id: 9, label: 'About GrooAgri', icon: null, customIcon: 'G', path: '/vendor/about-groo' },
  ], [profile, hasOutOfStockProducts]);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = themeColors.backgroundGradient;

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      // Try to load from local storage first for immediate display
      const storedVendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
      if (storedVendorData && Object.keys(storedVendorData).length > 0) {
        setProfile({
          name: storedVendorData.name || 'Vendor Name',
          businessName: storedVendorData.businessName || null,
          phone: storedVendorData.phone || '',
          email: storedVendorData.email || '',
          address: storedVendorData.address ?
            (typeof storedVendorData.address === 'string' ? storedVendorData.address :
              `${storedVendorData.address.addressLine1 || ''} ${storedVendorData.address.addressLine2 || ''} ${storedVendorData.address.city || ''} ${storedVendorData.address.state || ''} ${storedVendorData.address.pincode || ''}`.trim() || 'Not set')
            : 'Not set',
          rating: storedVendorData.rating || 0,
          totalJobs: storedVendorData.totalJobs || 0,
          completionRate: storedVendorData.completionRate || 0,
          serviceCategory: storedVendorData.service || '',
          skills: [],
          photo: storedVendorData.profilePhoto || null,
          approvalStatus: storedVendorData.approvalStatus,
          isPhoneVerified: storedVendorData.isPhoneVerified || false,
          isEmailVerified: storedVendorData.isEmailVerified || false,
          shopDetails: storedVendorData.shopDetails || null
        });
        setIsLoading(false); // Show content immediately
      }

      setError(null);
      try {
        const response = await vendorAuthService.getProfile();
        if (response.success) {
          const vendorData = response.vendor;
          // Format address
          const addressString = vendorData.address
            ? (typeof vendorData.address === 'string' ? vendorData.address :
              `${vendorData.address.addressLine1 || ''} ${vendorData.address.addressLine2 || ''} ${vendorData.address.city || ''} ${vendorData.address.state || ''} ${vendorData.address.pincode || ''}`.trim() || 'Not set')
            : 'Not set';

          setProfile({
            name: vendorData.name || 'Vendor Name',
            businessName: vendorData.businessName || null,
            phone: vendorData.phone || '',
            email: vendorData.email || '',
            address: addressString,
            rating: vendorData.rating || 0,
            totalJobs: vendorData.totalJobs || 0,
            completionRate: vendorData.completionRate || 0,
            serviceCategory: vendorData.service || '',
            skills: [],
            photo: vendorData.profilePhoto || null,
            approvalStatus: vendorData.approvalStatus,
            isPhoneVerified: vendorData.isPhoneVerified || false,
            isEmailVerified: vendorData.isEmailVerified || false,
            shopDetails: vendorData.shopDetails || null
          });
          localStorage.setItem('vendorData', JSON.stringify(vendorData));
        } else {
          if (!storedVendorData || Object.keys(storedVendorData).length === 0) {
            setError(response.message || 'Failed to fetch profile');
            toast.error(response.message || 'Failed to fetch profile');
          }
        }
      } catch (err) {
        console.error('Error fetching vendor profile:', err);
        if (!storedVendorData || Object.keys(storedVendorData).length === 0) {
          setError(err.response?.data?.message || 'Failed to fetch profile');
          toast.error(err.response?.data?.message || 'Failed to fetch profile');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
    window.addEventListener('vendorDataUpdated', fetchProfile);
    window.addEventListener('vendorProfileUpdated', fetchProfile);

    return () => {
      window.removeEventListener('vendorDataUpdated', fetchProfile);
      window.removeEventListener('vendorProfileUpdated', fetchProfile);
    };
  }, []);

  if (isLoading) {
    return <LogoLoader />;
  }

  if (error && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: themeColors.backgroundGradient }}>
        <div className="text-center p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error loading profile</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl text-white font-semibold transition-all duration-300 hover:opacity-90"
            style={{ backgroundColor: themeColors.button }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Profile" />

      <main className="px-4 pt-4">
        {/* Profile Header Card with Phone & Email */}
        <div
          onClick={() => navigate('/vendor/profile/details')}
          className="rounded-2xl p-5 mb-4 shadow-xl relative overflow-hidden cursor-pointer group active:scale-[0.98] transition-all duration-300"
          style={{
            background: themeColors.button,
            border: `2px solid ${themeColors.button}`,
            boxShadow: `0 8px 24px ${hexToRgba(themeColors.button, 0.3)}, 0 4px 12px ${hexToRgba(themeColors.button, 0.2)}`,
          }}
        >
          {/* Decorative Patterns */}
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
            style={{
              background: `radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)`,
              transform: 'translate(30px, -30px)',
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-8"
            style={{
              background: `radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%)`,
              transform: 'translate(-20px, 20px)',
            }}
          />

          <div className="relative z-10">
            <div className="flex items-start gap-4">
              {/* Profile Photo - Circle with Rating Below */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-18 h-18 rounded-full flex items-center justify-center overflow-hidden mb-2"
                  style={{
                    background: 'rgba(255, 255, 255, 0.35)',
                    backdropFilter: 'blur(15px)',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.25), inset 0 2px 6px rgba(255, 255, 255, 0.5)',
                    border: '3.5px solid rgba(255, 255, 255, 0.6)',
                    width: '72px',
                    height: '72px',
                  }}
                >
                  {profile.photo ? (
                    <img
                      src={profile.photo}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FiUser className="w-9 h-9 text-white" />
                  )}
                </div>
                {/* Star Rating Below Photo */}
                {profile.rating > 0 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/25 backdrop-blur-sm">
                    <FiStar className="w-3 h-3 text-yellow-300" style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))' }} />
                    <span className="text-xs font-bold text-white">{profile.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {/* Name and Info */}
              <div className="flex-1 min-w-0 flex flex-col">
                <h2 className="text-xl font-bold text-white mb-1 break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{profile.name}</h2>
                <p className="text-white text-sm opacity-95 mb-2.5 font-medium break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{profile.businessName}</p>

                {/* Phone and Email */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-white/15 backdrop-blur-sm flex-shrink-0">
                      <FiPhone className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs text-white font-semibold break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{profile.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-white/15 backdrop-blur-sm flex-shrink-0">
                      <FiMail className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs text-white font-semibold break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>{profile.email}</span>
                  </div>
                </div>
              </div>

              {/* Arrow Button Visual Cue */}
              <div
                className="p-3.5 rounded-xl flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 mt-1"
                style={{
                  background: 'rgba(255, 255, 255, 0.28)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
                  border: '1.5px solid rgba(255, 255, 255, 0.35)',
                }}
              >
                <FiArrowRight className="w-5 h-5 text-white" style={{ fontWeight: 'bold' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Out of Stock Alert Banner */}
        {hasOutOfStockProducts && (
          <div className="mx-4 mb-5 p-4 bg-rose-50 rounded-3xl border border-rose-100 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center text-white flex-shrink-0">
              <FiPackage className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-[11px] font-black text-rose-800 uppercase tracking-wider">Product Out of Stock</h4>
              <p className="text-[10px] font-bold text-rose-500 mt-0.5 leading-snug">One or more items in your store are out of stock.</p>
            </div>
            <button onClick={() => navigate('/vendor/store')} className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[9px] font-black rounded-xl uppercase tracking-wider transition-all flex-shrink-0">
              Update
            </button>
          </div>
        )}

        {/* Menu List Section */}
        <div className="px-4 mb-4 space-y-3">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-teal-200 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  {item.customIcon ? (
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors group-hover:bg-teal-50"
                      style={{
                        backgroundColor: hexToRgba(themeColors.button, 0.1),
                        border: `1px solid ${hexToRgba(themeColors.button, 0.2)}`,
                      }}
                    >
                      <span className="text-sm font-bold" style={{ color: themeColors.button }}>{item.customIcon}</span>
                    </div>
                  ) : (
                    IconComponent && (
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors relative"
                        style={{ backgroundColor: hexToRgba(themeColors.button, 0.1) }}
                      >
                        <IconComponent className="w-6 h-6" style={{ color: themeColors.button }} />
                        {item.id === 12 && hasOutOfStockProducts && (
                          <>
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white shadow-sm animate-ping" style={{ animationDuration: '1.5s' }} />
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white shadow-sm" />
                          </>
                        )}
                      </div>
                    )
                  )}
                  <span className="text-[15px] font-bold text-gray-800 text-left flex items-center gap-2">
                    {item.label}
                    {item.id === 12 && hasOutOfStockProducts && (
                      <span className="animate-pulse bg-rose-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm shadow-rose-500/20">
                        Out of Stock
                      </span>
                    )}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                  <FiChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Logout Button */}
        <div className="px-4 mb-3">
          <button
            type="button"
            onClick={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              try {
                await vendorAuthService.logout();
                toast.success('Logged out successfully');
                navigate('/vendor/login');
              } catch (error) {
                localStorage.removeItem('vendorAccessToken');
                localStorage.removeItem('vendorRefreshToken');
                localStorage.removeItem('vendorData');
                toast.success('Logged out successfully');
                navigate('/vendor/login');
              }
            }}
            className="w-full font-semibold py-3 rounded-xl active:scale-98 transition-all text-white flex items-center justify-center gap-2"
            style={{
              backgroundColor: '#EF4444',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#DC2626';
              e.target.style.boxShadow = '0 6px 16px rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#EF4444';
              e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.3)';
            }}
          >
            <FiLogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default Profile;

