import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiUser, FiMail, FiPhone, FiCheckCircle, FiChevronLeft, FiX } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { userAuthService } from '../../../services/authService';
import Logo from '../../../components/common/Logo';
import LogoLoader from '../../../components/common/LogoLoader';
import API from '../../../services/api';

import { z } from "zod";

// Zod schemas
const phoneSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
});

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").regex(/^[a-zA-Z\s]+$/, "Name can only contain letters"),
  email: z.string().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Invalid email address"),
});

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  const [step, setStep] = useState('phone'); // 'phone', 'otp' or 'details' (new users only)
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
      const res = await API.get(`/content/policy/user/${type}`);
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

  // Refs for focus management
  const phoneInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const otpInputRefs = useRef([]);

  // Auto-focus logic
  useEffect(() => {
    // Redirect if already logged in
    if (localStorage.getItem('accessToken')) {
      navigate('/user', { replace: true });
      return;
    }

    if (step === 'phone' && phoneInputRef.current) {
      setTimeout(() => phoneInputRef.current?.focus(), 100);
    } else if (step === 'otp' && otpInputRefs.current[0]) {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } else if (step === 'details' && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [step, navigate]);

  const resetToPhone = () => {
    setOtp(['', '', '', '', '', '']);
    setOtpToken('');
    setVerificationToken('');
    setStep('phone');
    setResendTimer(0);
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();

    // Zod Validation
    const validationResult = phoneSchema.safeParse({ phone: phoneNumber });
    if (!validationResult.success) {
      toast.error(validationResult.error?.issues?.[0]?.message || 'Invalid phone number');
      return;
    }

    setIsLoading(true);
    try {
      // Same OTP for new and existing users; verify-login decides which one it is
      const response = await userAuthService.sendOTP(phoneNumber);

      if (response.success) {
        setOtpToken(response.token);
        setStep('otp');
        setResendTimer(120); // Start 2 min timer
        toast.success(
          <div className="flex items-center gap-2">
            <FiCheckCircle className="text-green-500" />
            <span>OTP sent successfully!</span>
          </div>
        );
      } else {
        toast.error(response.message || 'Failed to send OTP');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    // Allow only numbers
    if (value && !/^\d+$/.test(value)) return;

    if (value.length > 1) {
      // Handle paste of full OTP
      if (index === 0 && value.length === 6) {
        const chars = value.split('');
        setOtp(chars);
        // Focus the last input or verify button
        otpInputRefs.current[5]?.focus();
        return;
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
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
      const response = await userAuthService.verifyLogin({
        phone: phoneNumber,
        otp: otpValue
      });

      if (response.success) {
        if (response.isNewUser) {
          // First time with this number -> collect name, then register
          setVerificationToken(response.verificationToken);
          setOtp(['', '', '', '', '', '']);
          setIsLoading(false);
          setStep('details');
          toast.success('Phone verified! Please complete your registration.');
        } else {
          toast.success('Welcome back!');
          navigate('/user', { replace: true });
        }
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Verification failed');
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(error.response?.data?.message || 'Verification failed. Please try again.');
    }
  };

  const handleDetailsSubmit = async (e) => {
    e.preventDefault();

    // Zod Validation
    const validationResult = detailsSchema.safeParse({ name, email });
    if (!validationResult.success) {
      toast.error(validationResult.error?.issues?.[0]?.message || 'Invalid details');
      return;
    }

    setIsLoading(true);
    try {
      const response = await userAuthService.register({
        name: name.trim(),
        email: email || null,
        verificationToken,
        referralCode: referralCode || undefined
      });
      if (response.success) {
        toast.success(
          <div className="flex flex-col">
            <span className="font-bold">Successfully Registered!</span>
            <span className="text-xs">Welcome to GrooAgri.</span>
          </div>,
          { icon: <FiCheckCircle className="text-green-500" /> }
        );
        navigate('/user', { replace: true });
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Registration failed');
      }
    } catch (error) {
      setIsLoading(false);
      toast.error(error.response?.data?.message || 'Registration failed. Please try again.');
    }
  };

  // Dark Green Theme Colors from Mockup
  const brandColor = '#426B4F'; // Solid dark green for buttons and text
  const inputBgColor = '#DFE8E2'; // Light green for inputs

  // Mobile layout is anchored to the top with fixed px sizes (no vh, no vertical centering):
  // the keyboard shrinks the viewport, and anything sized or centered against it would jump.
  return (
    <div
      className="min-h-[100dvh] flex flex-col relative overflow-x-hidden bg-white justify-start sm:justify-center items-center pt-[175px] sm:pt-0 pb-10 sm:pb-0"
    >
      {/* Top Background with Wave */}
      <div
        className="absolute top-0 left-0 w-full h-[180px] bg-cover bg-center z-0 sm:hidden"
        style={{ backgroundImage: "url('/auth-bg.jpg')" }}
      >
        <svg className="absolute bottom-0 w-full text-white" viewBox="0 0 1440 320" preserveAspectRatio="none" style={{ height: '50px', transform: 'translateY(1px)' }}>
          <path fill="currentColor" fillOpacity="1" d="M0,224L80,197.3C160,171,320,117,480,122.7C640,128,800,192,960,208C1120,224,1280,192,1360,176L1440,160L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
        </svg>
      </div>

      <div className="bg-transparent px-8 py-4 w-full z-20 sm:max-w-md sm:mx-auto relative flex flex-col">
        <div className="mb-8 text-center relative z-10 flex flex-col items-center">
          <div className="relative inline-block mb-2">
            <Logo className="h-24 w-auto" />
          </div>
          {step === 'phone' && (
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">
              Login
            </h2>
          )}
          {step === 'otp' && (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: brandColor }}>
                Verify Phone
              </h2>
              <p className="text-sm font-medium text-gray-500 mt-1">
                Code sent to +91 {phoneNumber}
              </p>
            </>
          )}
          {step === 'details' && (
            <>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 tracking-tight">
                Create your <span style={{ color: brandColor }}>new account</span>
              </h2>
              <p className="text-sm font-medium text-gray-500 mt-1">
                Enter your details to get started
              </p>
            </>
          )}
        </div>

        {step === 'phone' && (
          <form className="space-y-6" onSubmit={handlePhoneSubmit}>
            <div>
              <div
                className="relative flex items-center rounded-xl overflow-hidden px-4 py-1 border border-transparent focus-within:border-[#426B4F]/30 transition-colors"
                style={{ backgroundColor: inputBgColor }}
              >
                <div className="flex items-center text-[#426B4F] mr-3">
                  <FiPhone className="h-5 w-5" />
                  <span className="font-semibold ml-2 border-r border-[#426B4F]/20 pr-3">+91</span>
                </div>
                <input
                  ref={phoneInputRef}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  id="phone"
                  className="block w-full py-4 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[#426B4F] font-bold placeholder-[#426B4F]/60 sm:text-sm"
                  style={{ outline: 'none' }}
                  placeholder="Mobile Number"
                  value={phoneNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    if (val.length <= 10) setPhoneNumber(val);
                  }}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || phoneNumber.length < 10}
                className="w-full flex justify-center py-4 px-4 rounded-3xl text-sm font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-lg relative overflow-hidden"
                style={{ backgroundColor: brandColor, boxShadow: '0 4px 14px 0 rgba(66, 107, 79, 0.39)' }}
              >
                {isLoading ? (
                  <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                ) : (
                  <span>Continue</span>
                )}
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form className="space-y-8" onSubmit={handleOtpSubmit}>
            <div className="flex justify-center gap-2 sm:gap-3 py-4">
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
                  className="w-12 h-12 text-center text-xl font-bold rounded-xl outline-none focus:outline-none focus:ring-0 border-transparent transition-all duration-300"
                  style={{ backgroundColor: inputBgColor, color: brandColor, outline: 'none' }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between px-2 text-sm font-medium">
              <button
                type="button"
                onClick={resetToPhone}
                className="flex items-center text-gray-400 hover:text-[#426B4F] transition-colors"
              >
                <FiChevronLeft className="mr-1" /> Change Number
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (isLoading || resendTimer > 0) return;
                  try {
                    setIsLoading(true);
                    const response = await userAuthService.sendOTP(phoneNumber);
                    if (response.success) {
                      setOtpToken(response.token);
                      setResendTimer(120);
                      toast.success('OTP resent!');
                    }
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Error sending OTP');
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading || resendTimer > 0}
                className="text-[#426B4F] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                {resendTimer > 0
                  ? `Resend in ${Math.floor(resendTimer / 60)}:${String(resendTimer % 60).padStart(2, '0')}`
                  : 'Resend OTP'}
              </button>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || otp.join('').length !== 6}
                className="w-full flex justify-center py-4 px-4 rounded-3xl text-sm font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:-translate-y-0.5"
                style={{ backgroundColor: brandColor }}
              >
                {isLoading ? (
                  <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                ) : (
                  <span>Verify</span>
                )}
              </button>
            </div>
          </form>
        )}

        {step === 'details' && (
          <form className="space-y-4 sm:space-y-5" onSubmit={handleDetailsSubmit}>
            <div>
              <div
                className="relative flex items-center rounded-xl overflow-hidden px-4 py-1 border border-transparent focus-within:border-[#426B4F]/30 transition-colors"
                style={{ backgroundColor: inputBgColor }}
              >
                <div className="flex items-center text-[#426B4F] mr-3">
                  <FiUser className="h-5 w-5" />
                </div>
                <input
                  ref={nameInputRef}
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  // Live Restriction for Name: Only allow alphabets and spaces
                  onChange={(e) => setName(e.target.value.replace(/[^A-Za-z\s]/g, ''))}
                  className="block w-full py-4 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[#426B4F] font-bold placeholder-[#426B4F]/60 sm:text-sm"
                  style={{ outline: 'none' }}
                  placeholder="Full Name"
                />
              </div>
            </div>

            <div>
              <div
                className="relative flex items-center rounded-xl overflow-hidden px-4 py-1 border border-transparent focus-within:border-[#426B4F]/30 transition-colors"
                style={{ backgroundColor: inputBgColor }}
              >
                <div className="flex items-center text-[#426B4F] mr-3">
                  <FiMail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.trim())}
                  className="block w-full py-4 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-[#426B4F] font-bold placeholder-[#426B4F]/60 sm:text-sm"
                  style={{ outline: 'none' }}
                  placeholder="Email (optional)"
                />
              </div>
            </div>

            <div className="flex items-start bg-gray-50 p-3 rounded-xl border border-gray-100">
              <input
                type="checkbox"
                id="user-terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 text-[#426B4F] focus:ring-[#426B4F] border-gray-300 rounded cursor-pointer"
              />
              <label htmlFor="user-terms" className="ml-3 block text-sm text-gray-700">
                I agree to the{' '}
                <button type="button" onClick={() => handleOpenPolicy('terms', 'Terms and Conditions')} className="text-[#426B4F] hover:underline font-bold">Terms and Conditions</button>
                {' '}and{' '}
                <button type="button" onClick={() => handleOpenPolicy('privacy', 'Privacy Policy')} className="text-[#426B4F] hover:underline font-bold">Privacy Policy</button>.
              </label>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading || !acceptedTerms || name.trim().length < 2}
                className="w-full flex justify-center py-4 px-4 rounded-3xl text-sm font-bold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
                style={{ backgroundColor: brandColor, boxShadow: '0 4px 14px 0 rgba(66, 107, 79, 0.39)' }}
              >
                {isLoading ? (
                  <LogoLoader fullScreen={false} inline={true} size="w-6 h-6" />
                ) : (
                  <span>Register</span>
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={resetToPhone}
                className="inline-flex items-center text-sm font-medium text-gray-400 hover:text-[#426B4F] transition-colors"
              >
                <FiChevronLeft className="mr-1" /> Change Number
              </button>
            </div>
          </form>
        )}
      </div>

      {showPolicyModal && createPortal(
        <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-fade-in m-auto relative">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-bold text-gray-900">{policyTitle}</h3>
              <button type="button" onClick={() => setShowPolicyModal(false)} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors">
                <FiX size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 whitespace-pre-wrap text-sm text-gray-700">
              {policyContent}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end">
              <button type="button" onClick={() => setShowPolicyModal(false)} className="px-6 py-2 bg-[#426B4F] text-white rounded-lg font-bold hover:bg-[#34533e] transition-colors">
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

export default Login;
