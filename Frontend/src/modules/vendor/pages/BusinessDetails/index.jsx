import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSave, FiUploadCloud, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import { FormContainer, FormSection } from '../../../../components/common';
import { vendorAuthService } from '../../../../services/authService';

const BusinessDetails = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form State: Lab Registration
  const [labName, setLabName] = useState('');
  const [labLicenseNumber, setLabLicenseNumber] = useState('');
  const [certDoc, setCertDoc] = useState('');
  const [certPreview, setCertPreview] = useState('');

  const [errors, setErrors] = useState({});

  useEffect(() => {
    // Load from local storage first
    const storedVendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
    if (storedVendorData && Object.keys(storedVendorData).length > 0) {
      setProfile(storedVendorData);

      if (storedVendorData.labDetails) {
        setLabName(storedVendorData.labDetails.labName || '');
        setLabLicenseNumber(storedVendorData.labDetails.licenseNumber || '');
        setCertPreview(storedVendorData.labDetails.certificationDocument || '');
      }
    }

    const fetchData = async () => {
      try {
        const profileRes = await vendorAuthService.getProfile();

        if (profileRes.success && profileRes.vendor) {
          const v = profileRes.vendor;
          setProfile(v);

          if (v.labDetails) {
            setLabName(v.labDetails.labName || '');
            setLabLicenseNumber(v.labDetails.licenseNumber || '');
            setCertPreview(v.labDetails.certificationDocument || '');
          }
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleLabFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        toast.error('File size should not exceed 15MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCertDoc(reader.result);
        setCertPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    let validationErrors = {};

    if (!labName.trim()) {
      validationErrors.labName = 'Lab Name is required';
    } else if (labName.trim().length < 3) {
      validationErrors.labName = 'Lab Name must be at least 3 characters';
    } else if (!/^[A-Za-z0-9\s&*.,-]+$/.test(labName.trim())) {
      validationErrors.labName = 'Special characters are not allowed';
    }

    if (!labLicenseNumber.trim()) {
      validationErrors.labLicenseNumber = 'License Number is required';
    } else if (labLicenseNumber.trim().length < 4) {
      validationErrors.labLicenseNumber = 'License Number must be at least 4 characters';
    } else if (!/^[A-Za-z0-9-\s]+$/.test(labLicenseNumber.trim())) {
      validationErrors.labLicenseNumber = 'Only alphanumeric characters and hyphens allowed';
    }

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSave = async () => {
    if (!profile) return;

    if (!validateForm()) {
      toast.error('Please fix the errors in the form.');
      return;
    }

    setIsSaving(true);

    try {
      const currentServices = Array.isArray(profile.service)
        ? [...profile.service]
        : (profile.service ? [profile.service] : []);
      if (!currentServices.includes('soil_testing')) currentServices.push('soil_testing');

      const updateData = { services: currentServices, labName, licenseNumber: labLicenseNumber };
      if (certDoc) updateData.certificationDocument = certDoc;

      const profileRes = await vendorAuthService.updateBusinessProfile(updateData);
      if (profileRes.success) {
        toast.success('Details saved successfully!');
        navigate('/vendor/profile', { replace: true });
      } else {
        toast.error(profileRes.message || 'Failed to update business profile');
      }

    } catch (err) {
      console.error('Save error:', err);
      toast.error('Server error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: themeColors.backgroundGradient }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: themeColors.button }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-6" style={{ background: themeColors.backgroundGradient }}>
      <div className="bg-white px-4 py-4 flex items-center gap-3 shadow-sm sticky top-0 z-20">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl active:bg-gray-100 transition-colors">
          <FiArrowLeft className="w-5 h-5 text-gray-800" />
        </button>
        <h1 className="text-xl font-bold text-gray-800 flex-1">Registred for Soil Testing</h1>
      </div>

      <main className="p-4">
        <FormContainer>
          {/* Soil Lab Details Form */}
            <FormSection subtitle="Soil testing" title="Lab Details" icon={FiCheckCircle}>
              <div>
                <label className={`block text-xs font-semibold mb-1.5 ml-1 ${errors.labName ? 'text-red-500' : 'text-gray-700'}`}>Lab Name *</label>
                <input
                  type="text"
                  value={labName}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^A-Za-z0-9\s&*.,-]/g, '');
                    setLabName(val);
                    if (errors.labName && val.length >= 3) setErrors({ ...errors, labName: null });
                  }}
                  placeholder="Enter Registered Lab Name"
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-all text-sm focus:outline-none text-gray-800 ${errors.labName ? 'border-red-300 bg-red-50 focus:border-red-400' : 'bg-gray-50 border-transparent focus:border-teal-100 focus:bg-white'
                    }`}
                />
                {errors.labName && <p className="text-[10px] text-red-500 mt-1 ml-1 font-semibold">{errors.labName}</p>}
              </div>

              <div>
                <label className={`block text-xs font-semibold mb-1.5 ml-1 ${errors.labLicenseNumber ? 'text-red-500' : 'text-gray-700'}`}>License/Registration Number *</label>
                <input
                  type="text"
                  value={labLicenseNumber}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^A-Za-z0-9-\s]/g, '').toUpperCase();
                    setLabLicenseNumber(val);
                    if (errors.labLicenseNumber && val.length >= 4) setErrors({ ...errors, labLicenseNumber: null });
                  }}
                  placeholder="e.g. LAB-2023-XXXX"
                  className={`w-full px-4 py-3 rounded-xl border-2 transition-all text-sm focus:outline-none text-gray-800 ${errors.labLicenseNumber ? 'border-red-300 bg-red-50 focus:border-red-400' : 'bg-gray-50 border-transparent focus:border-teal-100 focus:bg-white'
                    }`}
                />
                {errors.labLicenseNumber && <p className="text-[10px] text-red-500 mt-1 ml-1 font-semibold">{errors.labLicenseNumber}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5 ml-1">Certification Document (Image/PDF)</label>
                <div className="relative">
                  <input
                    type="file"
                    id="certUpload"
                    className="hidden"
                    onChange={handleLabFileChange}
                    accept="image/*,application/pdf"
                  />

                  {certPreview ? (
                    <div className="relative w-full rounded-xl overflow-hidden border border-gray-100 animate-fade-in" style={{ height: '140px' }}>
                      {certPreview.includes('application/pdf') ? (
                        <div className="w-full h-full flex items-center justify-center bg-gray-50 flex-col gap-2">
                          <FiUploadCloud className="w-8 h-8 text-gray-400" />
                          <span className="text-xs text-gray-500">PDF Uploaded</span>
                        </div>
                      ) : (
                        <img src={certPreview} alt="Certification" className="w-full h-full object-cover" />
                      )}
                      <label
                        htmlFor="certUpload"
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <span className="text-white text-xs font-bold px-3 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">Change File</span>
                      </label>
                    </div>
                  ) : (
                    <label
                      htmlFor="certUpload"
                      className="w-full flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <div className="space-y-1 text-center">
                        <FiUploadCloud className="mx-auto h-8 w-8 text-gray-400" />
                        <div className="text-xs text-gray-600">
                          <span className="font-semibold text-teal-600">Upload a file</span> or drag and drop
                        </div>
                        <p className="text-[10px] text-gray-500">PNG, JPG, PDF up to 15MB</p>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 mt-2">
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  <span className="font-bold">Note:</span> Enabling Soil Testing mode requires admin verification.
                </p>
              </div>
            </FormSection>

        </FormContainer>
      </main>

      {/* Save Button */}
      <div className="px-4 pb-8 pt-2">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full py-4 rounded-xl text-white font-bold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{
            backgroundColor: isSaving ? '#6b7280' : themeColors.button,
            opacity: isSaving ? 0.7 : 1,
            boxShadow: `0 8px 16px ${hexToRgba(themeColors.button, 0.25)}`
          }}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <FiSave className="w-5 h-5" />
              Save Details
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Helper function
const hexToRgba = (hex, alpha) => {
  if (!hex) return '';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default BusinessDetails;
