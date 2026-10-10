import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FiPhone, FiArrowRight, FiChevronLeft, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { themeColors } from '../../../theme';
import { sendOTP, verifyLogin } from '../services/authService';
import Logo from '../../../components/common/Logo';
import LogoLoader from '../../../components/common/LogoLoader';

import { z } from "zod";

// Zod schema
const phoneSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit Indian phone number"),
});

const VendorLogin = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpToken, setOtpToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

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

  // Refs for auto-focus
  const phoneInputRef = useRef(null);
  const otpInputRefs = useRef([]);

  // Auto-focus logic
  useEffect(() => {
    // Redirect if already logged in
    if (localStorage.getItem('vendorAccessToken')) {
      navigate('/vendor', { replace: true });
      return;
    }

    if (step === 'phone' && phoneInputRef.current) {
      setTimeout(() => phoneInputRef.current.focus(), 100);
    } else if (step === 'otp' && otpInputRefs.current[0]) {
      setTimeout(() => otpInputRefs.current[0].focus(), 100);
    }
  }, [step, navigate]);

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();

    // Zod Validation
    const validationResult = phoneSchema.safeParse({ phone: phoneNumber });
    if (!validationResult.success) {
      toast.error(validationResult.error?.issues?.[0]?.message || 'Invalid phone number');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    setIsLoading(true);
    try {
      const response = await sendOTP(cleanPhone);
      if (response.success) {
        // Speculative check: If backend sends vendor info at this stage
        if (response.vendor?.adminApproval?.toLowerCase() === 'pending') {
          toast.error('Your account is currently under review. Please wait for admin approval.', {
            duration: 5000,
            icon: '⏳'
          });
          return;
        }

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
      toast.error(error.response?.data?.message || 'Failed to send OTP. Please try again.');
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
      const response = await verifyLogin({
        phone: phoneNumber.replace(/\D/g, ''),
        otp: otpValue
      });

      if (response.success) {
        setIsLoading(false);

        if (response.isNewUser) {
          toast.success('Phone verified! Please complete registration.');
          navigate('/vendor/signup', {
            state: { phone: phoneNumber.replace(/\D/g, ''), verificationToken: response.verificationToken }
          });
        } else {
          // Check for admin approval status
          if (response.vendor?.adminApproval === 'PENDING' || response.vendor?.adminApproval === 'pending') {
            toast.error('Your account is currently under review. Please wait for admin approval.', {
              duration: 5000,
              icon: '⏳'
            });
            // Clear tokens if they were set by the service
            localStorage.removeItem('vendorAccessToken');
            localStorage.removeItem('vendorRefreshToken');
            localStorage.removeItem('vendorData');
            return;
          }

          toast.success(
            <div className="flex flex-col">
              <span className="font-bold">Welcome Back!</span>
              <span className="text-xs">Successfully logged into your vendor account.</span>
            </div>,
            { icon: <FiCheckCircle className="text-green-500" /> }
          );
          navigate('/vendor', { replace: true });
        }
      } else {
        setIsLoading(false);
        toast.error(response.message || 'Login failed');
      }
    } catch (error) {
      setIsLoading(false);
      const errorMessage = error.response?.data?.message || 'Verification failed. Please try again.';
      toast.error(errorMessage);
    }
  };

  // Dark Green Theme Colors from Mockup
  const brandColor = '#426B4F'; // Solid dark green for buttons and text
  const inputBgColor = '#DFE8E2'; // Light green for inputs

  return (
    <div
      className="min-h-[100dvh] flex flex-col relative overflow-x-hidden bg-white justify-center items-center"
    >
      {/* Top Background with Wave */}
      <div
        className="absolute top-0 left-0 w-full h-[25vh] bg-cover bg-center z-0 sm:hidden"
        style={{ backgroundImage: "url('/auth-bg.jpg')", filter: 'brightness(0.95)' }}
      >
        <svg className="absolute bottom-0 w-full text-white" viewBox="0 0 1440 320" preserveAspectRatio="none" style={{ height: '50px', transform: 'translateY(1px)' }}>
          <path fill="currentColor" fillOpacity="1" d="M0,224L80,197.3C160,171,320,117,480,122.7C640,128,800,192,960,208C1120,224,1280,192,1360,176L1440,160L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
        </svg>
      </div>

      <div className="bg-transparent px-8 py-4 w-full z-20 sm:max-w-md sm:mx-auto relative flex flex-col justify-center pb-10 sm:pb-0">
        <div className="mb-8 text-center relative z-10 flex flex-col items-center">


          <div className="relative inline-block mb-2">
            {step === 'phone' ? (
              <Logo className="h-16 w-auto" />
            ) : (
              <h2 className="text-[32px] font-bold tracking-tight mb-2" style={{ color: brandColor }}>
                Verify Phone
              </h2>
            )}
          </div>
          {step === 'phone' ? (
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 tracking-tight">
              Equipment Owner Sign In
            </h2>
          ) : (
            <p className="text-sm font-medium text-gray-500">
              Code sent to +91 {phoneNumber}
            </p>
          )}
        </div>

        {step === 'phone' ? (
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

            <div className="flex items-center justify-between text-xs px-2 mt-2">
              <label className="flex items-center text-[#426B4F] font-medium cursor-pointer">
                <input type="checkbox" className="mr-2 rounded-full text-[#426B4F] focus:ring-[#426B4F] border-gray-300 shadow-sm" />
                Remember Me
              </label>
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
                  <span>Login</span>
                )}
              </button>
            </div>

            <div className="mt-8 text-center text-sm">
              <span className="text-gray-400 font-medium">Don't have a partner account? </span>
              <Link to="/vendor/signup" className="text-[#426B4F] font-bold hover:underline">
                Register Now
              </Link>
            </div>
          </form>
        ) : (
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
                onClick={(e) => {
                  e.preventDefault();
                  setOtp(['', '', '', '', '', '']);
                  setOtpToken('');
                  setStep('phone');
                  setResendTimer(0);
                }}
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
                    const response = await sendOTP(phoneNumber.replace(/\D/g, ''));
                    if (response.success) {
                      setOtpToken(response.token);
                      setResendTimer(120);
                      toast.success('OTP resent!');
                    }
                  } catch (err) {
                    toast.error('Error sending OTP');
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
      </div>
    </div>
  );
};

export default VendorLogin;
