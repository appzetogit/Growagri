import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSettings, FiSave, FiUser, FiMail, FiShield, FiMapPin, FiPhone, FiHeadphones } from 'react-icons/fi';
import { getSettings, updateSettings, updateAdminProfile, getAdminProfile } from '../../services/settingsService';
import CityManagement from '../Cities';
import { toast } from 'react-hot-toast';

const AdminSettings = () => {
  // Support Settings State
  const [supportSettings, setSupportSettings] = useState({
    supportEmail: '',
    supportPhone: '',
    supportWhatsapp: ''
  });
  const [supportLoading, setSupportLoading] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    email: '',
    role: 'admin',
    assignedCity: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [profileLoading, setProfileLoading] = useState(false);
  const [activeView, setActiveView] = useState('main'); // 'main', 'profile', 'system', 'cities'

  const isSuperAdmin = profile.role === 'super_admin';

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await getAdminProfile();
        if (res.success && res.data) {
          setProfile(prev => ({
            ...prev,
            email: res.data.email,
            name: res.data.name || 'Admin',
            role: res.data.role || 'admin',
            assignedCity: res.data.cityName || res.data.cityId?.name || ''
          }));
          const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
          const newData = { ...adminData, ...res.data };
          localStorage.setItem('adminData', JSON.stringify(newData));
        }
      } catch (error) {
        console.error('Error loading admin profile:', error);
      }
    };

    const loadSettings = async () => {
      try {
        const res = await getSettings();
        if (res?.settings) {
          // Load support settings
          setSupportSettings({
            supportEmail: res.settings.supportEmail || '',
            supportPhone: res.settings.supportPhone || '',
            supportWhatsapp: res.settings.supportWhatsapp || ''
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };

    loadProfile();
    loadSettings();
  }, []);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  // Handle support settings change
  const handleSupportChange = (e) => {
    const { name, value } = e.target;
    setSupportSettings(prev => ({ ...prev, [name]: value }));
  };

  // Save support settings
  const handleSupportSave = async (e) => {
    e.preventDefault();
    setSupportLoading(true);
    try {
      await updateSettings(supportSettings);
      toast.success('Support settings updated');
    } catch (error) {
      toast.error('Failed to update support settings');
    } finally {
      setSupportLoading(false);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (profile.newPassword && !profile.currentPassword) {
      return toast.error('Current password required');
    }

    setProfileLoading(true);
    try {
      const updateData = { email: profile.email };
      if (profile.newPassword) {
        updateData.currentPassword = profile.currentPassword;
        updateData.newPassword = profile.newPassword;
      } else if (profile.currentPassword) {
        updateData.currentPassword = profile.currentPassword;
      }

      await updateAdminProfile(updateData);
      const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
      adminData.email = profile.email;
      localStorage.setItem('adminData', JSON.stringify(adminData));

      toast.success('Profile updated');
      setProfile(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update');
    } finally {
      setProfileLoading(false);
    }
  };

  // Render Function for Main Settings Menu
  const renderMainMenu = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Profile Settings Card */}
      <div onClick={() => setActiveView('profile')}
        className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group">
        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
          <FiUser className="w-6 h-6 text-blue-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">Profile Settings</h3>
        <p className="text-sm text-gray-500">Manage your personal account details and password</p>
      </div>

      {/* System Settings Card - Super Admin Only */}
      {isSuperAdmin && (
        <div onClick={() => setActiveView('system')}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group">
          <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-100 transition-colors">
            <FiSettings className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">System & Support</h3>
          <p className="text-sm text-gray-500">Manage auto-assignment and help contact info</p>
        </div>
      )}

      {/* City Management Card - Super Admin Only */}
      {isSuperAdmin && (
        <div onClick={() => setActiveView('cities')}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group">
          <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
            <FiMapPin className="w-6 h-6 text-teal-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">City Management</h3>
          <p className="text-sm text-gray-500">Manage operational cities and default location</p>
        </div>
      )}

    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* Header / Breadcrumb */}
      {activeView !== 'main' && (
        <button onClick={() => setActiveView('main')}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 transition-colors">
          <span className="text-lg">←</span> Back to Settings
        </button>
      )}

      {activeView === 'main' && renderMainMenu()}

      <AnimatePresence mode="wait">

        {/* Profile View */}
        {activeView === 'profile' && (
          <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
            <div className="max-w-2xl mx-auto bg-white rounded-xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-2xl">
                  {profile.name ? profile.name.charAt(0).toUpperCase() : <FiUser />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{profile.name || 'Admin'}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      {isSuperAdmin && <FiShield className="text-amber-500" />}
                      {isSuperAdmin ? 'Super Admin' : 'Admin'} • {profile.email}
                    </p>
                    {profile.role !== 'super_admin' ? (
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-bold rounded-lg border border-teal-100 flex items-center gap-1">
                        <FiMapPin className="w-2.5 h-2.5" />
                        {profile.assignedCity || 'Restricted Access'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-lg border border-amber-100">
                        Global Access
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input type="email" name="email" value={profile.email} onChange={handleProfileChange} required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
                </div>

                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Change Password</h3>
                  <div className="space-y-4">
                    <input type="password" name="currentPassword" value={profile.currentPassword} onChange={handleProfileChange}
                      placeholder="Current Password"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-all" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input type="password" name="newPassword" value={profile.newPassword} onChange={handleProfileChange}
                        placeholder="New Password"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-all" />
                      <input type="password" name="confirmPassword" value={profile.confirmPassword} onChange={handleProfileChange}
                        placeholder="Confirm New Password"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-all" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6">
                  <button type="submit" disabled={profileLoading}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-70 shadow-lg shadow-blue-200 transition-all">
                    {profileLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiSave className="w-5 h-5" />}
                    Update Profile
                  </button>
                </div>
              </form>
            </div>
          </motion.div >
        )}

        {/* System & Support View */}
        {
          activeView === 'system' && (
            <motion.div key="system" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Support Settings */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-fit">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FiHeadphones className="w-5 h-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-bold text-gray-800">Contact & Support</h2>
                </div>

                <form onSubmit={handleSupportSave} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Support Email</label>
                    <div className="relative">
                      <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input type="email" name="supportEmail" value={supportSettings.supportEmail} onChange={handleSupportChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-all" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Support Phone</label>
                    <div className="relative">
                      <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input type="tel" name="supportPhone" value={supportSettings.supportPhone} onChange={handleSupportChange}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-blue-500 transition-all" />
                    </div>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button type="submit" disabled={supportLoading}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-blue-200">
                      {supportLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiSave className="w-4 h-4" />}
                      Save Details
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )
        }

        {/* City Management View */}
        {
          activeView === 'cities' && (
            <motion.div key="cities" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <CityManagement />
            </motion.div>
          )
        }

      </AnimatePresence >
    </motion.div >
  );
};
export default AdminSettings;
