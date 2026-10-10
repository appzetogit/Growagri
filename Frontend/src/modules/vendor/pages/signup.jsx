import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { FiUser, FiMail, FiPhone, FiFileText, FiUpload, FiX, FiArrowRight, FiChevronLeft, FiCheckCircle, FiCamera, FiBriefcase, FiChevronDown, FiCheck, FiSearch, FiLayers } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../theme';
import { register, sendOTP as sendVendorOTP } from '../services/authService';
import LogoLoader from '../../../components/common/LogoLoader';
import Logo from '../../../components/common/Logo';
import { compressImage } from '../../../utils/imageCompression';
import API from '../../../services/api';

import { z } from "zod";
import { publicCatalogService } from '../../../services/catalogService';

// Zod schema for Vendor Signup
const vendorSignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").regex(/^[a-zA-Z\s]+$/, "Name can only contain letters"),
  email: z.string().email("Please enter a valid email address").optional().or(z.literal('')),
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
  businessName: z.string().min(3, "Business Name must be at least 3 characters"),
  service: z.array(z.string()).optional(),
  aadhar: z.string().regex(/^\d{12}$/, "Aadhar number must be exactly 12 digits"),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format (e.g. ABCDE1234F)").optional().or(z.literal(''))
});

const VendorSignup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState('details'); // 'details' or 'otp'
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('vendor_signup_form_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && !Array.isArray(parsed.service)) {
          parsed.service = parsed.service ? [parsed.service] : [];
        }
        return parsed;
      } catch (e) {
        console.error('Error parsing saved signup form data:', e);
      }
    }
    return {
      name: '',
      email: '',
      phoneNumber: '',
      businessName: '',
      service: [],
      aadhar: '',
      pan: '',
      documents: [],
      isLabRegistration: false,
      isShopRegistration: false,
      labDetails: { labName: '', licenseNumber: '' },
      shopDetails: { shopName: '', shopAddress: '', shopLicense: '' }
    };
  });
  const [categories, setCategories] = useState([]);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const categoryDropdownRef = useRef(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [documentPreview, setDocumentPreview] = useState({});
  const [uploadingDocs, setUploadingDocs] = useState({});
  const [resendTimer, setResendTimer] = useState(0);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyContent, setPolicyContent] = useState('');
  const [policyTitle, setPolicyTitle] = useState('');

  const handleOpenPolicy = async (type, title) => {
    setPolicyTitle(title);
    setShowPolicyModal(true);
    setPolicyContent('Loading...');
    try {
      const res = await API.get(`/content/policy/vendor/${type}`);
      if (res.data.success && res.data.data) {
        setPolicyContent(res.data.data.content || 'No content available.');
      } else {
        setPolicyContent('No content available.');
      }
    } catch {
      setPolicyContent('Failed to load policy content.');
    }
  };

  // Timer countdown effect
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Save form data to localStorage
  useEffect(() => {
    localStorage.setItem('vendor_signup_form_data', JSON.stringify(formData));
  }, [formData]);

  // Restore document previews on mount
  useEffect(() => {
    if (formData.documents && formData.documents.length > 0) {
      const previews = {};
      formData.documents.forEach(doc => {
        if (doc.type && doc.url) {
          previews[doc.type] = doc.url;
        }
      });
      setDocumentPreview(previews);
    }
  }, []);

  // Load dynamic categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await publicCatalogService.getCategories();
        if (response.success) {
          setCategories(response.categories || []);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Close category dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Refs for auto-focus
  const nameInputRef = useRef(null);
  const otpInputRefs = useRef([]);

  // Unified Flow: Pre-fill
  useEffect(() => {
    if (location.state?.phone && location.state?.verificationToken) {
      setFormData(prev => ({ ...prev, phoneNumber: location.state.phone }));
      setVerificationToken(location.state.verificationToken);
    }
  }, [location.state]);

  // Clear any existing vendor tokens on page load
  useEffect(() => {
    localStorage.removeItem('vendorAccessToken');
    localStorage.removeItem('vendorRefreshToken');
    localStorage.removeItem('vendorData');
  }, []);

  // Auto-focus logic
  useEffect(() => {
    if (step === 'details' && nameInputRef.current) {
      setTimeout(() => nameInputRef.current.focus(), 100);
    } else if (step === 'otp' && otpInputRefs.current[0]) {
      setTimeout(() => otpInputRefs.current[0].focus(), 100);
    }
  }, [step]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Live Restriction for Name: Only allow alphabets and spaces
    if (name === 'name') {
      const filteredValue = value.replace(/[^A-Za-z\s]/g, '');
      setFormData(prev => ({ ...prev, [name]: filteredValue }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLabShopChange = (type, field, value) => {
    setFormData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  const toggleServiceSelection = (title) => {
    setFormData(prev => {
      const currentServices = Array.isArray(prev.service) ? prev.service : [];
      if (currentServices.includes(title)) {
        return { ...prev, service: currentServices.filter(s => s !== title) };
      } else {
        return { ...prev, service: [...currentServices, title] };
      }
    });
  };

  const handleSelectAllCategories = (catsToSelect) => {
    setFormData(prev => {
      const current = Array.isArray(prev.service) ? [...prev.service] : [];
      const newItems = catsToSelect.map(c => c.title).filter(t => t && !current.includes(t));
      return { ...prev, service: [...current, ...newItems] };
    });
  };

  const handleClearAllCategories = () => {
    setFormData(prev => ({ ...prev, service: [] }));
  };

  const handleRemoveCategory = (title) => {
    setFormData(prev => {
      const current = Array.isArray(prev.service) ? prev.service : [];
      return { ...prev, service: current.filter(s => s !== title) };
    });
  };

  const filteredCategories = categories.filter(cat =>
    (cat?.title || '').toLowerCase().includes((categorySearchQuery || '').toLowerCase().trim())
  );

  const handleDocumentUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid image or PDF');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size should be less than 15MB');
      return;
    }

    setUploadingDocs(prev => ({ ...prev, [type]: true }));
    const loadingToast = toast.loading("Processing file...");

    try {
      let fileToUpload = file;
      let previewUrl = '';

      // Compress if it is an image
      if (file.type.startsWith('image/')) {
        try {
          const compressedFile = await compressImage(file, {
            maxWidth: 1280, // Reasonable max width for documents
            maxHeight: 1280,
            quality: 0.8
          });
          fileToUpload = compressedFile;
          toast.dismiss(loadingToast); // Dismiss compression loading
        } catch (compressionError) {
          console.error("Compression failed, using original file", compressionError);
          toast.error("Compression failed, using original");
          // fileToUpload remains original
        }
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        previewUrl = reader.result;
        setFormData(prev => ({
          ...prev,
          documents: [...prev.documents.filter(d => d.type !== type), { type, file: fileToUpload, url: previewUrl }]
        }));
        setDocumentPreview(prev => ({
          ...prev,
          [type]: previewUrl
        }));
        setUploadingDocs(prev => ({ ...prev, [type]: false }));
        toast.success("Image uploaded", { duration: 2000 });
      };

      reader.onerror = () => {
        console.error("FileReader failed");
        toast.error("Failed to read file");
        setUploadingDocs(prev => ({ ...prev, [type]: false }));
      };

      reader.readAsDataURL(fileToUpload);

    } catch (error) {
      console.error("Upload processing error", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to process file");
      setUploadingDocs(prev => ({ ...prev, [type]: false }));
    }
  };

  const removeDocument = (type) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.type !== type)
    }));
    setDocumentPreview(prev => {
      const newPreview = { ...prev };
      delete newPreview[type];
      return newPreview;
    });
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();

    // Zod Validation
    const validationResult = vendorSignupSchema.safeParse({
      name: formData.name,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      businessName: formData.businessName,
      service: formData.service,
      aadhar: formData.aadhar,
      pan: formData.pan
    });

    if (!validationResult.success) {
      // Zod v4 uses .issues instead of .errors
      const issues = validationResult.error?.issues || [];
      if (issues.length > 0) {
        issues.forEach(err => toast.error(err.message));
      } else {
        toast.error('Please check your form inputs and try again.');
      }
      return;
    }

    // Manual Document Validation remains
    const hasAadharDoc = formData.documents.some(d => d.type === 'aadhar');
    const hasAadharBackDoc = formData.documents.some(d => d.type === 'aadharBack');
    if (!hasAadharDoc) { toast.error('Please upload Aadhar Front document'); return; }
    if (!hasAadharBackDoc) { toast.error('Please upload Aadhar Back document'); return; }

    // Lab & Shop Validation
    if (formData.isLabRegistration) {
      if (!formData.labDetails.labName) { toast.error('Please enter Lab Name'); return; }
      if (!formData.documents.some(d => d.type === 'labCert')) { toast.error('Please upload Lab Certification Document'); return; }
    }
    if (formData.isShopRegistration) {
      if (!formData.shopDetails.shopName) { toast.error('Please enter Shop Name'); return; }
      if (!formData.shopDetails.shopAddress) { toast.error('Please enter Shop Address'); return; }
      if (!formData.documents.some(d => d.type === 'shopLicense')) { toast.error('Please upload Shop License Document'); return; }
    }

    setIsLoading(true);

    if (verificationToken) {
      try {
        const aadharDoc = formData.documents.find(d => d.type === 'aadhar')?.url || null;
        const aadharBackDoc = formData.documents.find(d => d.type === 'aadharBack')?.url || null;
        const panDoc = formData.documents.find(d => d.type === 'pan')?.url || null;
        const otherDocs = formData.documents.filter(d => d.type === 'other').map(d => d.url);
        
        let labDetailsPayload = null;
        if (formData.isLabRegistration) {
          labDetailsPayload = {
            ...formData.labDetails,
            certificationDocument: formData.documents.find(d => d.type === 'labCert')?.url || null
          };
        }

        let shopDetailsPayload = null;
        if (formData.isShopRegistration) {
          shopDetailsPayload = {
            ...formData.shopDetails,
            licenseDocument: formData.documents.find(d => d.type === 'shopLicense')?.url || null
          };
        }

        const registerData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phoneNumber,
          businessName: formData.businessName,
          aadhar: formData.aadhar,
          pan: formData.pan,
          service: formData.service, // It's already an array now
          aadharDocument: aadharDoc,
          aadharBackDocument: aadharBackDoc,
          panDocument: panDoc,
          otherDocuments: otherDocs,
          labDetails: labDetailsPayload ? JSON.stringify(labDetailsPayload) : null,
          shopDetails: shopDetailsPayload ? JSON.stringify(shopDetailsPayload) : null,
          verificationToken
        };

        const response = await register(registerData);

        if (response.success) {
          localStorage.removeItem('vendor_signup_form_data');
          toast.success(
            <div className="flex flex-col">
              <span className="font-bold">Successfully Registered!</span>
              <span className="text-xs">Your vendor account is pending admin approval.</span>
            </div>,
            { icon: <FiCheckCircle className="text-[#D68F35]" />, duration: 5000 }
          );
          navigate('/vendor/login');
        } else {
          toast.error(response.message || 'Registration failed');
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Registration failed');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      const response = await sendVendorOTP(formData.phoneNumber);
      if (response.success) {
        setOtpToken(response.token);
        setIsLoading(false);
        setStep('otp');
        setResendTimer(120); // Start timer
        toast.success('OTP sent successfully');
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(error.response?.data?.message || 'Failed to send OTP');
    }
  };

  const handleOtpChange = (index, value) => {
    // Allow only numbers
    if (value && !/^\d+$/.test(value)) return;

    // Handle paste of full OTP
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6);
      if (digits.length === 6) {
        const chars = digits.split('');
        setOtp(chars);
        otpInputRefs.current[5]?.focus();
        return;
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Auto-verify as last digit enters
  useEffect(() => {
    const otpValue = otp.join('');
    if (otpValue.length === 6 && !isLoading && otpToken) {
      handleOtpSubmit();
    }
  }, [otp]);

  const handleOtpSubmit = async (e) => {
    if (e) e.preventDefault();
    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error('Please enter complete OTP');
      return;
    }
    if (!otpToken) {
      toast.error('Please request OTP first');
      return;
    }
    setIsLoading(true);
    try {
      const aadharDoc = formData.documents.find(d => d.type === 'aadhar')?.url || null;
      const aadharBackDoc = formData.documents.find(d => d.type === 'aadharBack')?.url || null;
      const panDoc = formData.documents.find(d => d.type === 'pan')?.url || null;
      const otherDocs = formData.documents.filter(d => d.type === 'other').map(d => d.url);

      let labDetailsPayload = null;
      if (formData.isLabRegistration) {
        labDetailsPayload = {
          ...formData.labDetails,
          certificationDocument: formData.documents.find(d => d.type === 'labCert')?.url || null
        };
      }

      let shopDetailsPayload = null;
      if (formData.isShopRegistration) {
        shopDetailsPayload = {
          ...formData.shopDetails,
          licenseDocument: formData.documents.find(d => d.type === 'shopLicense')?.url || null
        };
      }

      const registerData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phoneNumber,
        businessName: formData.businessName,
        aadhar: formData.aadhar,
        pan: formData.pan,
        service: formData.service, 
        aadharDocument: aadharDoc,
        aadharBackDocument: aadharBackDoc,
        panDocument: panDoc,
        otherDocuments: otherDocs,
        labDetails: labDetailsPayload ? JSON.stringify(labDetailsPayload) : null,
        shopDetails: shopDetailsPayload ? JSON.stringify(shopDetailsPayload) : null,
        otp: otpValue,
        token: otpToken
      };

      const response = await register(registerData);

      if (response.success) {
        setIsLoading(false);
        localStorage.removeItem('vendor_signup_form_data');
        toast.success('Successfully Registered! Pending admin approval.');
        navigate('/vendor/login');
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Registration failed');
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(error.response?.data?.message || 'Registration failed');
    }
  };

  const brandColor = themeColors.brand?.teal || '#347989';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-start items-center py-10 px-4 sm:px-6 lg:px-8 relative">
      {/* Decorative Background Elements - Fixed Container to prevent scroll issues */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#347989] opacity-[0.03] rounded-full blur-3xl animate-floating" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#D68F35] opacity-[0.03] rounded-full blur-3xl animate-floating" style={{ animationDelay: '2s' }} />
      </div>

      <div className="w-full max-w-2xl text-center mb-8 relative z-10 animate-fade-in">
        <Logo className="h-16 w-auto mx-auto transform hover:scale-110 transition-transform duration-500" />
        <h2 className="mt-4 text-3xl font-extrabold text-gray-900 tracking-tight">
          {step === 'details' ? 'Partner Registration' : 'Verify Identity'}
        </h2>
        <p className="mt-2 text-sm text-gray-600 animate-stagger-1 animate-fade-in">
          Partner with GrooAgri and grow your business
        </p>
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="bg-white py-8 px-4 shadow-2xl shadow-gray-200/50 sm:rounded-2xl sm:px-10 border border-gray-100 relative overflow-hidden animate-slide-in-bottom">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#347989] via-[#D68F35] to-[#BB5F36]" />

          {step === 'details' ? (
            <form onSubmit={handleDetailsSubmit} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Details */}
                <div className="space-y-4 animate-stagger-1 animate-fade-in relative" style={{ zIndex: isCategoryDropdownOpen ? 40 : 1 }}>
                  <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Business Profile</h3>

                  <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner / Business Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                        <FiUser className="text-gray-400" />
                      </div>
                      <input
                        ref={nameInputRef}
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400"
                        style={{ '--tw-ring-color': brandColor }}
                        placeholder="Your Full Name"
                      />
                    </div>
                  </div>

                  <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business / Farm Name</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                        <FiBriefcase className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="businessName"
                        required
                        value={formData.businessName}
                        onChange={handleInputChange}
                        className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400"
                        style={{ '--tw-ring-color': brandColor }}
                        placeholder="e.g. Krishna Agri Services"
                      />
                    </div>
                  </div>

                  <div className="animate-fade-in relative" style={{ animationDelay: '0.2s', zIndex: isCategoryDropdownOpen ? 50 : 1 }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-700">
                        Equipment Category <span className="text-xs font-normal text-gray-500">(Multiple Select)</span>
                      </label>
                      {Array.isArray(formData.service) && formData.service.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllCategories}
                          className="text-xs font-semibold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Multi-Select Dropdown Container */}
                    <div ref={categoryDropdownRef} className="relative z-50">
                      <button
                        type="button"
                        onClick={() => setIsCategoryDropdownOpen(prev => !prev)}
                        className={`w-full min-h-[44px] px-3.5 py-2.5 text-left border rounded-xl flex items-center justify-between bg-white transition-all duration-200 outline-none cursor-pointer hover:border-gray-400 ${
                          isCategoryDropdownOpen
                            ? 'border-[#347989] ring-2 ring-[#347989]/20 shadow-sm'
                            : 'border-gray-300'
                        }`}
                        aria-haspopup="listbox"
                        aria-expanded={isCategoryDropdownOpen}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                          <FiLayers
                            className={`text-base flex-shrink-0 ${
                              Array.isArray(formData.service) && formData.service.length > 0
                                ? 'text-[#347989]'
                                : 'text-gray-400'
                            }`}
                          />
                          {(!formData.service || formData.service.length === 0) ? (
                            <span className="text-sm text-gray-400 truncate">Select Equipment Categories...</span>
                          ) : (
                            <span className="text-sm font-medium text-gray-800 truncate">
                              {formData.service.length === 1
                                ? formData.service[0]
                                : `${formData.service.length} Categories Selected`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {Array.isArray(formData.service) && formData.service.length > 0 && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#347989]/10 text-[#347989]">
                              {formData.service.length}
                            </span>
                          )}
                          <FiChevronDown
                            className={`text-gray-400 transition-transform duration-200 text-lg ${
                              isCategoryDropdownOpen ? 'transform rotate-180 text-[#347989]' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Dropdown Menu Popup */}
                      {isCategoryDropdownOpen && (
                        <div
                          className="absolute left-0 right-0 top-full mt-1.5 border border-gray-200 rounded-xl shadow-2xl overflow-hidden"
                          style={{ backgroundColor: '#ffffff', zIndex: 50 }}
                        >
                          {/* Search Bar inside Dropdown */}
                          <div className="p-2.5 border-b border-gray-100" style={{ backgroundColor: '#f9fafb' }}>
                            <div className="relative">
                              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                              <input
                                type="text"
                                value={categorySearchQuery}
                                onChange={(e) => setCategorySearchQuery(e.target.value)}
                                placeholder="Search category..."
                                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-[#347989] focus:ring-1 focus:ring-[#347989] transition-all"
                                autoFocus
                              />
                              {categorySearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setCategorySearchQuery('')}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                                >
                                  <FiX size={12} />
                                </button>
                              )}
                            </div>

                            {/* Header Actions */}
                            <div className="flex items-center justify-between mt-2 pt-1.5 px-0.5 text-[11px] text-gray-500">
                              <span>
                                {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'}
                              </span>
                              <div className="flex items-center space-x-2">
                                {filteredCategories.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAllCategories(filteredCategories)}
                                    className="text-[#347989] hover:underline font-semibold cursor-pointer"
                                  >
                                    Select All
                                  </button>
                                )}
                                {Array.isArray(formData.service) && formData.service.length > 0 && (
                                  <>
                                    <span className="text-gray-300">|</span>
                                    <button
                                      type="button"
                                      onClick={handleClearAllCategories}
                                      className="text-red-500 hover:underline font-semibold cursor-pointer"
                                    >
                                      Clear All
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Options List */}
                          <div className="max-h-52 overflow-y-auto divide-y divide-gray-50 p-1.5" style={{ backgroundColor: '#ffffff' }}>
                            {filteredCategories.length > 0 ? (
                              filteredCategories.map((cat, index) => {
                                const isSelected = Array.isArray(formData.service) && formData.service.includes(cat.title);
                                return (
                                  <div
                                    key={cat._id || cat.id || index}
                                    onClick={() => toggleServiceSelection(cat.title)}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                                      isSelected
                                        ? 'bg-[#347989]/10 text-[#347989] font-medium'
                                        : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                    style={{ backgroundColor: isSelected ? undefined : '#ffffff' }}
                                  >
                                    <span className="truncate pr-2">{cat.title}</span>
                                    <div
                                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                                        isSelected
                                          ? 'bg-[#347989] border-[#347989] text-white'
                                          : 'border-gray-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && <FiCheck className="stroke-[3] w-2.5 h-2.5" />}
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="py-6 text-center text-xs text-gray-400" style={{ backgroundColor: '#ffffff' }}>
                                {categories.length === 0 ? 'No categories available' : `No matches for "${categorySearchQuery}"`}
                              </div>
                            )}
                          </div>

                          {/* Footer / Done Button */}
                          <div className="p-2 border-t border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#f9fafb' }}>
                            <span className="text-[11px] text-gray-500 pl-1">
                              {Array.isArray(formData.service) ? formData.service.length : 0} selected
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsCategoryDropdownOpen(false)}
                              className="px-3 py-1 bg-[#347989] text-white text-xs font-semibold rounded-lg hover:bg-[#2b6471] transition-colors cursor-pointer"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Selected Categories Badge Cloud */}
                    {Array.isArray(formData.service) && formData.service.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                        {formData.service.map((serviceName) => (
                          <span
                            key={serviceName}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#347989]/10 text-[#347989] border border-[#347989]/20"
                          >
                            <span className="truncate max-w-[180px]">{serviceName}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCategory(serviceName);
                              }}
                              className="text-[#347989] hover:text-red-500 hover:bg-[#347989]/20 rounded-full p-0.5 transition-colors cursor-pointer"
                              title="Remove"
                            >
                              <FiX size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lab & Shop Checkboxes */}
                  <div className="animate-fade-in relative" style={{ animationDelay: '0.25s', zIndex: 0 }}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Additional Services</label>
                    <div className="flex flex-col gap-4">
                      <div className="border border-gray-200 rounded-xl p-3 bg-white">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isLabRegistration}
                            onChange={(e) => setFormData(prev => ({ ...prev, isLabRegistration: e.target.checked }))}
                            className="h-4 w-4 text-[#347989] border-gray-300 rounded focus:ring-[#347989]"
                          />
                          <span className="text-sm text-gray-700 font-bold">Register for Lab Services</span>
                        </label>
                        {formData.isLabRegistration && (
                          <div className="mt-3 pl-7 space-y-3 border-t pt-3">
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                                <FiBriefcase className="text-gray-400" />
                              </div>
                              <input
                                type="text"
                                required
                                placeholder="Lab Name * (e.g. Kisan Soil Testing Lab)"
                                value={formData.labDetails.labName}
                                onChange={(e) => handleLabShopChange('labDetails', 'labName', e.target.value)}
                                className={`block w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400 ${!formData.labDetails.labName ? 'border-red-300 focus:border-red-500 bg-red-50/30' : 'border-gray-300 focus:border-[#347989]'}`}
                                style={{ '--tw-ring-color': !formData.labDetails.labName ? '#ef4444' : brandColor }}
                              />
                            </div>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                                <FiFileText className="text-gray-400" />
                              </div>
                              <input
                                type="text"
                                placeholder="License Number (e.g. STL12345678)"
                                value={formData.labDetails.licenseNumber}
                                onChange={(e) => handleLabShopChange('labDetails', 'licenseNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))}
                                className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400 focus:border-[#347989]"
                                style={{ '--tw-ring-color': brandColor }}
                              />
                            </div>
                            <div className="space-y-2 mt-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Lab Certificate</p>
                              {documentPreview.labCert ? (
                                <div className="relative group overflow-hidden rounded-xl">
                                  <img src={documentPreview.labCert} className="w-full h-28 object-cover border transform group-hover:scale-110 transition-transform duration-500" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button type="button" onClick={() => removeDocument('labCert')} className="bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors">
                                      <FiX size={16} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-red-300 rounded-xl hover:bg-red-50 transition-all duration-300 hover:border-red-400 group bg-red-50/20 relative">
                                  {uploadingDocs.labCert ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#347989]"></div>
                                    </div>
                                  ) : null}
                                  <label className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full mb-1 hover:bg-blue-100">
                                      <FiUpload className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-bold">Upload Lab Cert</span>
                                    <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'labCert')} disabled={uploadingDocs.labCert} />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="border border-gray-200 rounded-xl p-3 bg-white">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isShopRegistration}
                            onChange={(e) => setFormData(prev => ({ ...prev, isShopRegistration: e.target.checked }))}
                            className="h-4 w-4 text-[#347989] border-gray-300 rounded focus:ring-[#347989]"
                          />
                          <span className="text-sm text-gray-700 font-bold">Register for Shop Services</span>
                        </label>
                        {formData.isShopRegistration && (
                          <div className="mt-3 pl-7 space-y-3 border-t pt-3">
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                                <FiBriefcase className="text-gray-400" />
                              </div>
                              <input
                                type="text"
                                required
                                placeholder="Shop Name * (e.g. Shree Ram Krishi Kendra)"
                                value={formData.shopDetails.shopName}
                                onChange={(e) => handleLabShopChange('shopDetails', 'shopName', e.target.value)}
                                className={`block w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400 ${!formData.shopDetails.shopName ? 'border-red-300 focus:border-red-500 bg-red-50/30' : 'border-gray-300 focus:border-[#347989]'}`}
                                style={{ '--tw-ring-color': !formData.shopDetails.shopName ? '#ef4444' : brandColor }}
                              />
                            </div>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                                <FiBriefcase className="text-gray-400" />
                              </div>
                              <input
                                type="text"
                                required
                                placeholder="Shop Address * (e.g. Krishi Mandi Road, Indore)"
                                value={formData.shopDetails.shopAddress}
                                onChange={(e) => handleLabShopChange('shopDetails', 'shopAddress', e.target.value)}
                                className={`block w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400 ${!formData.shopDetails.shopAddress ? 'border-red-300 focus:border-red-500 bg-red-50/30' : 'border-gray-300 focus:border-[#347989]'}`}
                                style={{ '--tw-ring-color': !formData.shopDetails.shopAddress ? '#ef4444' : brandColor }}
                              />
                            </div>
                            <div className="relative group">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                                <FiFileText className="text-gray-400" />
                              </div>
                              <input
                                type="text"
                                placeholder="Shop License (e.g. MPSEED7890)"
                                value={formData.shopDetails.shopLicense}
                                onChange={(e) => handleLabShopChange('shopDetails', 'shopLicense', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))}
                                className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400 focus:border-[#347989]"
                                style={{ '--tw-ring-color': brandColor }}
                              />
                            </div>
                            <div className="space-y-2 mt-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shop License Document</p>
                              {documentPreview.shopLicense ? (
                                <div className="relative group overflow-hidden rounded-xl">
                                  <img src={documentPreview.shopLicense} className="w-full h-28 object-cover border transform group-hover:scale-110 transition-transform duration-500" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button type="button" onClick={() => removeDocument('shopLicense')} className="bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors">
                                      <FiX size={16} />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-red-300 rounded-xl hover:bg-red-50 transition-all duration-300 hover:border-red-400 group bg-red-50/20 relative">
                                  {uploadingDocs.shopLicense ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
                                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#347989]"></div>
                                    </div>
                                  ) : null}
                                  <label className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full mb-1 hover:bg-blue-100">
                                      <FiUpload className="w-5 h-5" />
                                    </div>
                                    <span className="text-[10px] text-gray-500 font-bold">Upload Shop License</span>
                                    <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'shopLicense')} disabled={uploadingDocs.shopLicense} />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="animate-fade-in relative" style={{ animationDelay: '0.2s', zIndex: 0 }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                        <FiMail className="text-gray-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`block w-full pl-10 pr-10 py-2.5 border rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none ${
                          formData.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|org|in|net|co)$/i.test(formData.email) 
                            ? 'border-red-500 focus:border-red-500' 
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        style={{ '--tw-ring-color': brandColor }}
                        placeholder="vendor@example.com"
                      />
                      {(formData.email && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|org|in|net|co)$/i.test(formData.email)) && (
                        <FiCheckCircle className="text-green-500 absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5" />
                      )}
                    </div>
                    {formData.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|org|in|net|co)$/i.test(formData.email) && (
                      <p className="mt-1 text-xs text-red-500 font-medium">
                        Please enter a valid email address
                      </p>
                    )}
                  </div>

                  {!verificationToken && (
                    <div className="animate-fade-in relative" style={{ animationDelay: '0.3s', zIndex: 0 }}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 border-r pr-2 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm font-bold">+91</span>
                        </div>
                        <input
                          type="tel"
                          required
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData(p => ({ ...p, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                          className="block w-full pl-14 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400"
                          style={{ '--tw-ring-color': brandColor }}
                          placeholder="9876543210"
                        />
                      </div>
                    </div>
                  )}

                  <div className="animate-fade-in relative" style={{ animationDelay: '0.4s', zIndex: 0 }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Number (Owner)</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                        <FiFileText className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        required
                        value={formData.aadhar}
                        onChange={(e) => setFormData(p => ({ ...p, aadhar: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                        className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400"
                        style={{ '--tw-ring-color': brandColor }}
                        placeholder="1234 5678 9012"
                      />
                    </div>
                  </div>

                  <div className="animate-fade-in relative" style={{ animationDelay: '0.5s', zIndex: 0 }}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number (Business/Individual)</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none group-focus-within:text-[#347989] transition-colors">
                        <FiFileText className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={formData.pan}
                        onChange={(e) => setFormData(p => ({ ...p, pan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
                        className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 outline-none hover:border-gray-400"
                        style={{ '--tw-ring-color': brandColor }}
                        placeholder="ABCDE1234F"
                      />
                    </div>
                  </div>
                </div>

                {/* Documents Section */}
                <div className="space-y-4 animate-stagger-2 animate-fade-in relative" style={{ zIndex: 0 }}>
                  <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Identity Documents</h3>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Aadhar Upload */}
                    {/* Aadhar Front Upload */}
                    <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aadhar Card Front</p>
                      {documentPreview.aadhar ? (
                        <div className="relative group overflow-hidden rounded-xl">
                          <img src={documentPreview.aadhar} className="w-full h-28 object-cover border transform group-hover:scale-110 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button type="button" onClick={() => removeDocument('aadhar')} className="bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors">
                              <FiX size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:border-[#347989] group bg-white relative">
                          {uploadingDocs.aadhar ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#347989]"></div>
                            </div>
                          ) : null}
                          <label className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full mb-1 hover:bg-blue-100">
                              <FiUpload className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold">Upload Front</span>
                            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'aadhar')} disabled={uploadingDocs.aadhar} />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* Aadhar Back Upload */}
                    <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.25s' }}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aadhar Card Back</p>
                      {documentPreview.aadharBack ? (
                        <div className="relative group overflow-hidden rounded-xl">
                          <img src={documentPreview.aadharBack} className="w-full h-28 object-cover border transform group-hover:scale-110 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button type="button" onClick={() => removeDocument('aadharBack')} className="bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors">
                              <FiX size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:border-[#347989] group bg-white relative">
                          {uploadingDocs.aadharBack ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#347989]"></div>
                            </div>
                          ) : null}
                          <label className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full mb-1 hover:bg-blue-100">
                              <FiUpload className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold">Upload Back</span>
                            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'aadharBack')} disabled={uploadingDocs.aadharBack} />
                          </label>
                        </div>
                      )}
                    </div>

                    {/* PAN Upload */}
                    <div className="space-y-2 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">PAN Card Front</p>
                      {documentPreview.pan ? (
                        <div className="relative group overflow-hidden rounded-xl">
                          <img src={documentPreview.pan} className="w-full h-28 object-cover border transform group-hover:scale-110 transition-transform duration-500" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button type="button" onClick={() => removeDocument('pan')} className="bg-red-500 text-white rounded-full p-2 shadow-xl hover:bg-red-600 transition-colors">
                              <FiX size={16} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:border-[#347989] group bg-white relative">
                          {uploadingDocs.pan ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-xl">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#347989]"></div>
                            </div>
                          ) : null}
                          <label className="flex flex-col items-center cursor-pointer w-full h-full justify-center">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-full mb-1 hover:bg-blue-100">
                              <FiUpload className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold">Upload PAN</span>
                            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => handleDocumentUpload(e, 'pan')} disabled={uploadingDocs.pan} />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl mt-4 animate-pulse-subtle">
                    <p className="text-xs text-teal-700 leading-relaxed italic">
                      "GrooAgri values trust. Please ensure all documents are clear and valid for faster approval."
                    </p>
                  </div>
                </div>
              </div>

              <div className="animate-stagger-3 animate-fade-in space-y-4">
                <div className="flex items-start mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 text-[#347989] focus:ring-[#347989] border-gray-300 rounded cursor-pointer"
                  />
                  <label htmlFor="terms" className="ml-3 block text-sm text-gray-700">
                    I agree to the{' '}
                    <button type="button" onClick={() => handleOpenPolicy('terms', 'Terms and Conditions')} className="text-[#347989] hover:underline font-bold">Terms and Conditions</button>
                    {' '}and{' '}
                    <button type="button" onClick={() => handleOpenPolicy('privacy', 'Privacy Policy')} className="text-[#347989] hover:underline font-bold">Privacy Policy</button>.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !acceptedTerms}
                  className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl text-white transition-all transform hover:-translate-y-1 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                  style={{
                    backgroundColor: brandColor,
                    boxShadow: `0 10px 15px -3px ${brandColor}4D`
                  }}
                >
                  <span className="absolute inset-0 w-full h-full bg-white/10 group-hover:translate-x-full transition-transform duration-700 -translate-x-full" />
                  {isLoading ? (
                    <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                  ) : (
                    <span className="flex items-center relative z-10">
                      {verificationToken ? 'Finish Application' : 'Proceed to Verify'}
                      <FiArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <button
                onClick={() => setStep('details')}
                className="flex items-center text-sm text-gray-500 hover:text-[#347989] transition-colors mb-4 animate-fade-in"
              >
                <FiChevronLeft className="mr-1" /> Re-check details
              </button>

              <div className="text-center animate-fade-in">
                <h3 className="text-xl font-bold text-gray-900">One Last Step</h3>
                <p className="text-sm text-gray-500">Enter the 6-digit code sent to your phone</p>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-8">
                <div className="flex justify-between gap-3 px-4 sm:px-12 animate-stagger-1 animate-fade-in">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className="w-full h-14 text-center text-xl font-bold border border-gray-300 rounded-xl focus:ring-2 focus:ring-offset-2 outline-none transition-all duration-300 hover:border-gray-400"
                      style={{ '--tw-ring-color': brandColor, backgroundColor: digit ? `${brandColor}05` : 'white' }}
                    />
                  ))}
                </div>

                <div className="text-center animate-stagger-2 animate-fade-in">
                  <button
                    type="button"
                    onClick={async () => {
                      if (resendTimer > 0) return;
                      try {
                        const response = await sendVendorOTP(formData.phoneNumber);
                        if (response.success) {
                          setOtpToken(response.token);
                          setResendTimer(120);
                          toast.success('OTP sent again');
                        }
                      } catch { toast.error('Resend failed'); }
                    }}
                    disabled={resendTimer > 0}
                    className="text-sm font-semibold transition-colors duration-300 opacity-70 hover:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: brandColor }}
                  >
                    {resendTimer > 0
                      ? `Resend in ${Math.floor(resendTimer / 60)}:${String(resendTimer % 60).padStart(2, '0')}`
                      : 'Resend Code'}
                  </button>
                </div>

                <div className="animate-stagger-3 animate-fade-in">
                  <button
                    type="submit"
                    disabled={isLoading || otp.join('').length !== 6}
                    className="group relative w-full py-4 rounded-xl text-white font-bold transition-all transform hover:-translate-y-1 shadow-lg disabled:opacity-50 overflow-hidden"
                    style={{ backgroundColor: brandColor, boxShadow: `0 10px 15px -3px ${brandColor}4D` }}
                  >
                    <span className="absolute inset-0 w-full h-full bg-white/10 group-hover:translate-x-full transition-transform duration-700 -translate-x-full" />
                    <span className="relative z-10 flex items-center justify-center">
                      {isLoading ? (
                        <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                      ) : (
                        'Verify & Register'
                      )}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <p className="mt-8 mb-6 text-center text-sm text-gray-600 animate-fade-in animate-stagger-4">
          Already a partner?{' '}
          <Link to="/vendor/login" className="font-bold hover:text-[#D68F35] transition-colors" style={{ color: brandColor }}>
            Login here
          </Link>
        </p>
      </div >
      {showPolicyModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-fade-in m-auto relative">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-900">{policyTitle}</h3>
              <button onClick={() => setShowPolicyModal(false)} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 whitespace-pre-wrap text-sm text-gray-700">
              {policyContent}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button onClick={() => setShowPolicyModal(false)} className="px-6 py-2 bg-[#347989] text-white rounded-lg font-bold hover:bg-[#2a626f] transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div >
  );
};

export default VendorSignup;
