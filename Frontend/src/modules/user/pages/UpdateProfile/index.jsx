import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiMail, FiPhone, FiCamera } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../../theme';
import { userAuthService } from '../../../../services/authService';

import { z } from "zod";
import api from '../../../../services/api';

// Zod schema
const profileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address").refine(val => val.includes('@'), "Invalid email address"),
});

const UpdateProfile = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    profilePhoto: '', // URL
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});


  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch user profile on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // First check localStorage
        const storedUserData = localStorage.getItem('userData');
        if (storedUserData) {
          const userData = JSON.parse(storedUserData);
          setFormData({
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
            profilePhoto: userData.profilePhoto || '',
          });
        }

        // Fetch fresh data from API
        const response = await userAuthService.getProfile();
        if (response.success && response.user) {
          const user = response.user;
          setFormData({
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            profilePhoto: user.profilePhoto || '',
          });

          // Update localStorage with fresh data including photo
          if (storedUserData) {
            const updatedLocal = { ...JSON.parse(storedUserData), ...user };
            localStorage.setItem('userData', JSON.stringify(updatedLocal));
          }
        }
      } catch (error) {
        // Use localStorage data if API fails
        const storedUserData = localStorage.getItem('userData');
        if (storedUserData) {
          const userData = JSON.parse(storedUserData);
          setFormData({
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
            profilePhoto: userData.profilePhoto || '',
          });
        } else {
          toast.error('Failed to load profile data');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Upload file helper
  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/image/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    if (!data.success) throw new Error(data.message || 'Upload failed');
    return data.imageUrl;
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size should be less than 5MB');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Format phone number for display
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    if (phone.startsWith('+91')) return phone;
    if (phone.length === 10) return `+91 ${phone}`;
    return phone;
  };

  const validateEmail = (email) => {
    if (!email) return "";
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|org|in|net|co)$/i;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'email') {
      setErrors(prev => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handleSave = async () => {
    // Zod Validation
    const validationResult = profileSchema.safeParse({
      name: formData.name.trim(),
      email: formData.email.trim()
    });

    if (!validationResult.success) {
      toast.error(validationResult.error?.issues?.[0]?.message || 'Please check your inputs');
      return;
    }

    setIsSaving(true);
    setUploading(true);
    try {
      let photoUrl = formData.profilePhoto;

      // Upload photo if selected
      if (photoFile) {
        try {
          photoUrl = await uploadFile(photoFile);
        } catch (err) {
          console.error('Photo upload failed:', err);
          toast.error('Failed to upload profile photo');
          setIsSaving(false);
          setUploading(false);
          return;
        }
      }

      const response = await userAuthService.updateProfile({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        profilePhoto: photoUrl
      });

      if (response.success) {
        toast.success('Profile updated successfully!');
        // authService.updateProfile already updates localStorage with response.user
        // but let's ensure we have the latest data
        if (response.user) {
          const storedUserData = localStorage.getItem('userData');
          if (storedUserData) {
            const existingData = JSON.parse(storedUserData);
            const updatedData = { ...existingData, ...response.user };
            localStorage.setItem('userData', JSON.stringify(updatedData));
          } else {
            localStorage.setItem('userData', JSON.stringify(response.user));
          }
        }
        navigate('/user/account');
      } else {
        toast.error(response.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
      setUploading(false);
    }
  };

  const handleBack = () => {
    navigate('/user/account');
  };

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FiArrowLeft className="w-5 h-5 text-black" />
            </button>
            <h1 className="text-xl font-bold text-black">Update Profile</h1>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Profile Form */}
        <div className="space-y-4">
          {/* Profile Photo */}
          <div className="flex flex-col items-center justify-center mb-6">
            <div className="relative group">
              <div
                className="w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-xl"
                style={{ background: '#f0f0f0' }}
              >
                {photoPreview || formData.profilePhoto ? (
                  <img
                    src={photoPreview || formData.profilePhoto}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                    <FiUser className="w-12 h-12" />
                  </div>
                )}
              </div>

              <label
                htmlFor="user-photo-upload"
                className="absolute bottom-1 right-1 p-2 rounded-full cursor-pointer shadow-lg transition-transform active:scale-95 hover:scale-105"
                style={{ background: themeColors.button }}
              >
                <FiCamera className="w-5 h-5 text-white" />
                <input
                  id="user-photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <div
                className="absolute left-3 top-1/2 transform -translate-y-1/2"
                style={{ color: themeColors.button }}
              >
                <FiUser className="w-5 h-5" />
              </div>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                disabled={isLoading}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{
                  focusRingColor: themeColors.button,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = themeColors.button;
                  e.target.style.boxShadow = '0 0 0 3px rgba(0, 166, 166, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="Enter your full name"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div
                className="absolute left-3 top-1/2 transform -translate-y-1/2"
                style={{ color: themeColors.button }}
              >
                <FiMail className="w-5 h-5" />
              </div>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={isLoading}
                className={`w-full pl-11 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                onFocus={(e) => {
                  e.target.style.borderColor = errors.email ? '#ef4444' : themeColors.button;
                  e.target.style.boxShadow = errors.email ? '0 0 0 3px rgba(239, 68, 68, 0.1)' : '0 0 0 3px rgba(0, 166, 166, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.email ? '#ef4444' : '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
                placeholder="Enter your email address"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-500 font-medium ml-1">
                  {errors.email}
                </p>
              )}
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <div
                className="absolute left-3 top-1/2 transform -translate-y-1/2"
                style={{ color: themeColors.button }}
              >
                <FiPhone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                name="phone"
                value={formatPhoneNumber(formData.phone)}
                disabled
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed"
                placeholder="Phone number cannot be changed"
              />
              <p className="text-xs text-gray-500 mt-1 ml-1">
                Phone number cannot be changed for security reasons
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="w-full text-white font-bold py-3.5 rounded-xl active:scale-98 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${themeColors.button} 0%, ${themeColors.icon} 100%)`,
              boxShadow: '0 4px 12px rgba(0, 166, 166, 0.4)',
            }}
            onMouseEnter={(e) => {
              if (!isLoading && !isSaving) {
                e.target.style.boxShadow = '0 6px 16px rgba(0, 166, 166, 0.5)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.boxShadow = '0 4px 12px rgba(0, 166, 166, 0.4)';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  );
};

export default UpdateProfile;

