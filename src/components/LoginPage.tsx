import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  Truck, 
  TrendingUp, 
  Clock, 
  ShieldCheck, 
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  UserPlus,
  LogIn,
  CheckCircle2,
  Phone,
  Smartphone,
  ShieldAlert,
  Key,
  LogOut,
  ChevronDown
} from 'lucide-react';

import { 
  registerDeviceSession
} from '../utils';

import {
  loginApi,
  registerApi,
  resetPasswordApi,
  fetchUsers,
  fetchUserProfile,
  UserProfile
} from '../api';

interface LoginPageProps {
  onLoginSuccess: (username: string, role: 'owner' | 'customer') => void;
  logoutNotice?: string | null;
}

export default function LoginPage({ onLoginSuccess, logoutNotice }: LoginPageProps) {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState<'request' | 'verify' | 'reset'>('request');
  
  // Role Selector State
  const [loginRole, setLoginRole] = useState<'owner' | 'customer'>('owner');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [customerPasscode, setCustomerPasscode] = useState('1234');
  const [customCustomerName, setCustomCustomerName] = useState('');
  const [isCustomCustomer, setIsCustomCustomer] = useState(false);

  // Available users list from backend cloud DB
  const [dbUsers, setDbUsers] = useState<UserProfile[]>([]);

  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Register Form States
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regShowPassword, setRegShowPassword] = useState(false);

  // Forgot Password / OTP States
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [resendCountdown, setResendCountdown] = useState(60);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const demoUser = 'admin';
  const demoPass = 'password';

  // Fetch users list from backend DB on mount
  useEffect(() => {
    let isMounted = true;
    fetchUsers().then((users) => {
      if (isMounted && users && users.length > 0) {
        setDbUsers(users);
        const customers = users.filter(u => u.role === 'customer');
        if (customers.length > 0 && !selectedCustomer) {
          setSelectedCustomer(customers[0].username);
        }
      }
    });
    return () => { isMounted = false; };
  }, []);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isForgotMode && forgotStep === 'verify' && resendCountdown > 0) {
      interval = setInterval(() => {
        setResendCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isForgotMode, forgotStep, resendCountdown]);

  const getCustomerNames = (): string[] => {
    const customerUsers = dbUsers.filter(u => u.role === 'customer').map(u => u.username);
    if (customerUsers.length > 0) {
      return Array.from(new Set(customerUsers));
    }
    return [
      'Aman Construction Group',
      'Verma Builders & Developers',
      'Shree Cement Agency',
      'National Highways Authority',
      'GMR Infrastructure Ltd'
    ];
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    let targetUsername = username.trim();
    if (loginRole === 'customer') {
      const custName = isCustomCustomer ? customCustomerName.trim() : selectedCustomer;
      if (!custName) {
        setError('Please select or enter your Customer Profile Name.');
        return;
      }
      if (!customerPasscode) {
        setError('Please enter your Customer Access PIN.');
        return;
      }
      targetUsername = custName;
    } else {
      if (!targetUsername || !password) {
        setError('Please fill in all required login fields.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const res = await loginApi({
        username: targetUsername,
        password,
        role: loginRole,
        customerPasscode,
        isCustomCustomer
      });

      setIsLoading(false);

      if (res.success && res.user) {
        registerDeviceSession(res.user.username, res.user.role);
        onLoginSuccess(res.user.username, res.user.role);
      } else {
        setError(res.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Server authentication error.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const formattedUser = regUsername.trim();
    const formattedPhone = regPhone.trim();

    if (!formattedUser || !regPassword || !regConfirmPassword || !formattedPhone) {
      setError('Please fill in all registration fields, including your phone number.');
      return;
    }

    if (formattedUser.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    const digitCount = formattedPhone.replace(/\D/g, '').length;
    if (digitCount < 7) {
      setError('Please enter a valid telephone number.');
      return;
    }

    if (regPassword.length < 5) {
      setError('Password must be at least 5 characters long.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await registerApi({
        username: formattedUser,
        password: regPassword,
        phone: formattedPhone,
        role: 'owner'
      });

      setIsLoading(false);

      if (res.success && res.user) {
        setSuccess(`Account "${res.user.username}" successfully registered in cloud database!`);
        setUsername(res.user.username);
        setPassword(regPassword);
        setRegUsername('');
        setRegPassword('');
        setRegConfirmPassword('');
        setRegPhone('');
        setIsRegisterMode(false);
        fetchUsers().then(u => setDbUsers(u));
      } else {
        setError(res.error || 'Registration failed.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Server error during registration.');
    }
  };

  const handleForgotPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const targetUser = forgotUsername.trim();
    const targetPhone = forgotPhone.trim();

    if (!targetUser || !targetPhone) {
      setError('Please enter both your registered username and phone number.');
      return;
    }

    setIsLoading(true);

    try {
      const userProfile = await fetchUserProfile(targetUser);
      setIsLoading(false);

      if (!userProfile) {
        setError('This username is not registered in the shared cloud database.');
        return;
      }

      const cleanInputPhone = targetPhone.replace(/\D/g, '');
      const cleanRegPhone = (userProfile.phone || '').replace(/\D/g, '');

      if (cleanInputPhone !== cleanRegPhone && targetUser.toLowerCase() !== demoUser) {
        setError(`Phone number mismatch. Registered phone ends with ...${(userProfile.phone || '').slice(-4) || 'unknown'}.`);
        return;
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setResendCountdown(60);
      setForgotStep('verify');
    } catch (err: any) {
      setIsLoading(false);
      setError('Error verifying profile from cloud backend.');
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otpInput.trim()) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    if (otpInput.trim() !== generatedOtp) {
      setError('Incorrect OTP code. Please enter the valid code sent to your device.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setForgotStep('reset');
    }, 500);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmNewPassword) {
      setError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 5) {
      setError('Password must be at least 5 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await resetPasswordApi({
        username: forgotUsername.trim(),
        phone: forgotPhone.trim(),
        newPassword
      });

      setIsLoading(false);

      if (res.success) {
        setSuccess(`Password for "${forgotUsername}" updated successfully in cloud database! Please log in.`);
        setUsername(forgotUsername.trim());
        setPassword(newPassword);
        setForgotUsername('');
        setForgotPhone('');
        setOtpInput('');
        setGeneratedOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
        setForgotStep('request');
        setIsForgotMode(false);
      } else {
        setError(res.error || 'Password reset failed.');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Server error resetting password.');
    }
  };

  const handleResendOtp = () => {
    if (resendCountdown > 0) return;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setResendCountdown(60);
    setError(null);
    setSuccess('A new OTP security pin has been simulated and sent.');
  };

  return (
    <div className="min-h-screen w-full bg-[#05070B] text-slate-100 flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans relative overflow-hidden">
      {/* Background radial glow accents */}
      <div className="absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-[#F9B000]/5 blur-[140px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Main Container */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-[1240px] min-h-[720px] grid grid-cols-1 lg:grid-cols-12 bg-[#0C1017] border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10"
      >
        {/* Left Side (55% width) - Enterprise Showcase */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-8 lg:p-10 relative overflow-hidden bg-[#070A0F] border-r border-white/10">
          
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:28px_28px] opacity-[0.07] pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#070A0F] via-transparent to-[#070A0F] pointer-events-none z-[1]" />

          {/* Top Logo Header */}
          <div className="relative z-10 flex items-center gap-3.5">
            <div className="w-11 h-11 bg-[#F9B000] rounded-xl flex items-center justify-center shadow-lg shadow-[#F9B000]/25 shrink-0">
              <span className="text-[#05070B] font-black text-xl tracking-tighter select-none">JCB</span>
            </div>
            <div>
              <h2 className="text-white font-black text-base tracking-wider uppercase leading-none">LEDGER PRO</h2>
              <p className="text-slate-400 text-[10px] font-mono tracking-widest mt-1">FLEET OPERATIONS</p>
            </div>
          </div>

          {/* Upper Section: Technical Wireframe Blueprint Visual */}
          <div className="relative z-10 my-4 w-full h-44 rounded-2xl overflow-hidden bg-[#04080E] border border-cyan-500/20 shadow-2xl flex items-center justify-center group">
            <img 
              src="/jcb_blueprint_bg.svg" 
              alt="JCB Machinery Blueprint Schematics" 
              className="w-full h-full object-cover opacity-50 transition-opacity duration-300 group-hover:opacity-65"
            />
            {/* Smooth Edge Blending Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#070A0F] via-transparent to-[#070A0F] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070A0F] via-transparent to-[#070A0F] pointer-events-none" />
            
            <div className="absolute top-3 left-3.5 text-[8px] font-mono text-cyan-400/70 uppercase tracking-widest pointer-events-none bg-[#070A0F]/80 px-2 py-0.5 rounded border border-cyan-500/20">
              JCB 3CX / JS220 / VM117 / 437 FLEET SCHEMATICS
            </div>
            <div className="absolute bottom-3 right-3.5 text-[8px] font-mono text-cyan-400/70 uppercase tracking-widest pointer-events-none bg-[#070A0F]/80 px-2 py-0.5 rounded border border-cyan-500/20">
              SCALE 1:25 ARCH-D // SYSTEM ONLINE
            </div>
          </div>

          {/* Lower Middle: Construction Machinery Atmosphere & Headline */}
          <div className="relative z-10 my-2 space-y-4">
            <div className="space-y-2">
              <span className="px-3 py-1 bg-[#F9B000]/10 border border-[#F9B000]/30 text-[#F9B000] text-[11px] font-mono rounded-full uppercase tracking-wider font-bold inline-block backdrop-blur-sm">
                FLEET MANAGEMENT PLATFORM
              </span>
              <h1 className="text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight">
                Track Hours,<br />
                <span className="text-[#F9B000]">Billing &amp; Earnings</span>
              </h1>
              <p className="text-slate-300 text-xs lg:text-sm leading-relaxed max-w-md font-medium">
                Streamlining heavy equipment logs, driver hours, and customer payments inside a unified, beautiful dashboard.
              </p>
            </div>

            {/* Bottom-left floating stats card */}
            <div className="p-4 bg-[#11161C]/90 border border-white/10 rounded-2xl space-y-3 backdrop-blur-md shadow-2xl w-[310px]">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-500/50" />
                SIMULATED LIVE STATS
              </p>
              
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Truck className="w-4 h-4 text-[#F9B000]" />
                    <span className="font-medium">Active Equipment</span>
                  </div>
                  <span className="font-mono font-bold text-white text-sm">4 Units</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Clock className="w-4 h-4 text-[#F9B000]" />
                    <span className="font-medium">Weekly Usage</span>
                  </div>
                  <span className="font-mono font-bold text-white text-sm">124.5 Hrs</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <TrendingUp className="w-4 h-4 text-[#F9B000]" />
                    <span className="font-medium">Payment Clearance</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-400 text-sm">96.8%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Left Panel Footer Security Badge */}
          <div className="relative z-10 pt-2 border-t border-white/5">
            <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>TLS Secure Local Storage Session</span>
            </div>
          </div>
        </div>

        {/* Right Side (45% width) - Modern Glassmorphism Login Card */}
        <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 lg:p-10 bg-[#0F141C] relative">
          
          {/* Mobile Top Header */}
          <div className="flex flex-col gap-3 lg:hidden mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#F9B000] rounded-xl flex items-center justify-center shadow-md shadow-[#F9B000]/20">
                  <span className="text-[#05070B] font-black text-base select-none">JCB</span>
                </div>
                <div>
                  <h2 className="text-white font-black text-xs tracking-wider uppercase">LEDGER PRO</h2>
                  <p className="text-slate-400 text-[9px] font-mono tracking-widest">FLEET OPERATIONS</p>
                </div>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-md font-mono">v1.3</span>
            </div>

            <div className="relative w-full h-24 rounded-xl overflow-hidden bg-[#04080E] border border-cyan-500/20 shadow-inner flex items-center justify-center">
              <img 
                src="/jcb_blueprint_bg.svg" 
                alt="JCB Blueprint Schematics" 
                className="w-full h-full object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F141C] via-transparent to-[#0F141C] pointer-events-none" />
              <span className="absolute bottom-2 left-3 text-[8px] font-mono text-cyan-400/70 uppercase tracking-wider">
                FLEET WIREFRAME SCHEMATICS
              </span>
            </div>
          </div>

          {/* Form Content Container */}
          <div className="my-auto max-w-md w-full mx-auto space-y-6">
            <AnimatePresence mode="wait">
              {isForgotMode ? (
                // --- FORGOT PASSWORD / OTP FLOW ---
                <motion.div
                  key="forgot"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(false);
                        setForgotStep('request');
                        setError(null);
                        setSuccess(null);
                      }}
                      className="text-slate-400 hover:text-[#F9B000] text-xs font-bold flex items-center gap-1.5 focus:outline-none transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Sign In
                    </button>
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      <Key className="w-6 h-6 text-[#F9B000]" />
                      Forgot Password
                    </h2>
                    <p className="text-xs text-slate-400">
                      Verify your telephone number with a simulated SMS One-Time Pin (OTP) to restore system access.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{success}</span>
                    </div>
                  )}

                  {/* STEP 1: Enter Username & Phone */}
                  {forgotStep === 'request' && (
                    <form onSubmit={handleForgotPasswordRequest} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Your Username
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <User className="w-4 h-4 text-slate-500" />
                          </div>
                          <input
                            type="text"
                            required
                            value={forgotUsername}
                            onChange={(e) => { setForgotUsername(e.target.value); setError(null); }}
                            placeholder="e.g. admin or custom user"
                            className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Registered Phone Number
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Phone className="w-4 h-4 text-slate-500" />
                          </div>
                          <input
                            type="text"
                            required
                            value={forgotPhone}
                            onChange={(e) => { setForgotPhone(e.target.value); setError(null); }}
                            placeholder="e.g. +1 (555) 123-4567"
                            className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 italic">
                          💡 Tip: For admin, enter registered phone number.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#F9B000] hover:bg-[#E5A200] text-[#05070B] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#F9B000]/20 hover:shadow-[#F9B000]/30 active:scale-[0.99] transition-all disabled:pointer-events-none"
                      >
                        {isLoading ? (
                          <span>Searching secure archives...</span>
                        ) : (
                          <>
                            <span>Send OTP Verification PIN</span>
                            <Smartphone className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </form>
                  )}

                  {/* STEP 2: Input and verify the OTP */}
                  {forgotStep === 'verify' && (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div className="p-3.5 bg-[#F9B000]/10 border border-[#F9B000]/20 rounded-2xl space-y-1.5">
                        <span className="text-[10px] font-bold text-[#F9B000] uppercase tracking-widest flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5 text-[#F9B000] animate-bounce" />
                          Simulating SMS Dispatch
                        </span>
                        <p className="text-xs text-slate-300">
                          We dispatched a simulated SMS to <span className="font-mono font-bold text-white">{forgotPhone}</span>.
                        </p>
                        <div className="pt-2 border-t border-[#F9B000]/10 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-400">Your simulated secure PIN is:</span>
                          <span className="font-mono text-sm text-white font-black bg-[#070A0E] px-2.5 py-1 rounded border border-[#F9B000]/30 tracking-wider">
                            {generatedOtp}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Enter 6-Digit Verification PIN
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <ShieldAlert className="w-4 h-4 text-slate-500" />
                          </div>
                          <input
                            type="text"
                            maxLength={6}
                            required
                            value={otpInput}
                            onChange={(e) => { setOtpInput(e.target.value.replace(/\D/g, '')); setError(null); }}
                            placeholder="6-digit number"
                            className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-lg font-mono font-bold tracking-widest text-center rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-700 focus:ring-1 focus:ring-[#F9B000]/30"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-slate-500">Didn't receive code?</span>
                        {resendCountdown > 0 ? (
                          <span className="text-slate-400 font-mono">Resend in {resendCountdown}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            className="text-[#F9B000] hover:underline font-bold focus:outline-none"
                          >
                            Resend security PIN
                          </button>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#F9B000] hover:bg-[#E5A200] text-[#05070B] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#F9B000]/20 active:scale-[0.99] transition-all"
                      >
                        {isLoading ? 'Verifying...' : 'Verify Secure PIN'}
                      </button>
                    </form>
                  )}

                  {/* STEP 3: Reset password */}
                  {forgotStep === 'reset' && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                      <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-start gap-2 text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>Identity verified! Establish a new password below.</span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          New Secure Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Lock className="w-4 h-4 text-slate-500" />
                          </div>
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            required
                            value={newPassword}
                            onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                            placeholder="Min. 5 characters"
                            className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(p => !p)}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                          >
                            {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Confirm New Password
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Lock className="w-4 h-4 text-slate-500" />
                          </div>
                          <input
                            type={showNewPassword ? 'text' : 'password'}
                            required
                            value={confirmNewPassword}
                            onChange={(e) => { setConfirmNewPassword(e.target.value); setError(null); }}
                            placeholder="Repeat new password"
                            className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-[#F9B000] hover:bg-[#E5A200] text-[#05070B] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#F9B000]/20 active:scale-[0.99] transition-all"
                      >
                        {isLoading ? 'Updating credentials...' : 'Establish Password & Log In'}
                      </button>
                    </form>
                  )}
                </motion.div>
              ) : !isRegisterMode ? (
                // --- SIGN IN MODE ---
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="space-y-1.5">
                    <h2 className="text-3xl font-black text-white tracking-tight">Welcome back</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Sign in to view your personalized dashboard, equipment worksheets, and invoices.
                    </p>
                  </div>

                  {/* Segmented Button Role Switcher */}
                  <div className="grid grid-cols-2 p-1.5 bg-[#070A0E] border border-white/10 rounded-xl text-xs font-bold text-slate-400">
                    <button
                      type="button"
                      onClick={() => { setLoginRole('owner'); setError(null); }}
                      className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        loginRole === 'owner'
                          ? 'bg-[#F9B000] text-[#05070B] shadow-md font-extrabold'
                          : 'hover:text-slate-200'
                      }`}
                    >
                      <User className="w-4 h-4 shrink-0" />
                      <span>Owner / Admin</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLoginRole('customer');
                        setError(null);
                        const names = getCustomerNames();
                        if (names.length > 0 && !selectedCustomer) {
                          setSelectedCustomer(names[0]);
                        }
                      }}
                      className={`py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        loginRole === 'customer'
                          ? 'bg-[#F9B000] text-[#05070B] shadow-md font-extrabold'
                          : 'hover:text-slate-200'
                      }`}
                    >
                      <User className="w-4 h-4 shrink-0" />
                      <span>Customer / User</span>
                    </button>
                  </div>

                  {/* Global Logout Notification Banner */}
                  {logoutNotice && (
                    <div className="p-3.5 bg-[#F9B000]/10 border border-[#F9B000]/30 text-[#F9B000] rounded-xl flex items-start gap-2.5 text-xs leading-relaxed shadow-sm">
                      <LogOut className="w-4 h-4 text-[#F9B000] shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <strong className="block text-white font-bold mb-0.5">Signed Out Globally</strong>
                        <span>{logoutNotice}</span>
                      </div>
                    </div>
                  )}

                  {/* Success Notification */}
                  {success && (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{success}</span>
                    </div>
                  )}

                  {/* Error Notification */}
                  {error && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4">
                    {loginRole === 'owner' ? (
                      <>
                        {/* Owner Username field */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                            USERNAME OR EMAIL
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <User className="w-4 h-4 text-slate-500" />
                            </div>
                            <input
                              type="text"
                              required
                              value={username}
                              onChange={(e) => { setUsername(e.target.value); setError(null); }}
                              placeholder="Enter username (e.g. admin)"
                              className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                            />
                          </div>
                        </div>

                        {/* Owner Password field */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                              PASSWORD
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setIsForgotMode(true);
                                setForgotStep('request');
                                setForgotUsername(username);
                                setError(null);
                                setSuccess(null);
                              }}
                              className="text-[11px] font-bold text-[#F9B000] hover:underline cursor-pointer"
                            >
                              Forgot?
                            </button>
                          </div>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <Lock className="w-4 h-4 text-slate-500" />
                            </div>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              required
                              value={password}
                              onChange={(e) => { setPassword(e.target.value); setError(null); }}
                              placeholder="••••••••"
                              className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(p => !p)}
                              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Customer Profile Selection */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                              CUSTOMER ACCOUNT
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setIsCustomCustomer(p => !p);
                                setError(null);
                              }}
                              className="text-[10px] font-bold text-[#F9B000] hover:underline cursor-pointer"
                            >
                              {isCustomCustomer ? 'Choose from list' : 'Type custom name'}
                            </button>
                          </div>
                          
                          {isCustomCustomer ? (
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                <User className="w-4 h-4 text-slate-500" />
                              </div>
                              <input
                                type="text"
                                required
                                value={customCustomerName}
                                onChange={(e) => { setCustomCustomerName(e.target.value); setError(null); }}
                                placeholder="Enter full customer or firm name"
                                className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                              />
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                                <User className="w-4 h-4 text-slate-500" />
                              </div>
                              <select
                                value={selectedCustomer}
                                onChange={(e) => { setSelectedCustomer(e.target.value); setError(null); }}
                                className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-8 py-3 outline-none transition-all cursor-pointer appearance-none relative focus:ring-1 focus:ring-[#F9B000]/30"
                              >
                                {getCustomerNames().map((name, i) => (
                                  <option key={i} value={name} className="bg-[#0C1017] text-slate-100">
                                    {name}
                                  </option>
                                ))}
                              </select>
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Customer Access PIN */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                            CLIENT ACCESS PIN
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <Lock className="w-4 h-4 text-slate-500" />
                            </div>
                            <input
                              type="password"
                              required
                              value={customerPasscode}
                              onChange={(e) => { setCustomerPasscode(e.target.value); setError(null); }}
                              placeholder="Default: 1234"
                              className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 italic">
                            💡 Enter demo code <span className="font-mono text-[#F9B000] font-bold">1234</span> to sign in.
                          </p>
                        </div>
                      </>
                    )}

                    {/* Remember session checkbox */}
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 rounded bg-[#070A0E] border-slate-800 text-[#F9B000] focus:ring-0 cursor-pointer accent-[#F9B000]"
                        />
                        <span className="text-xs text-slate-300 font-medium">Remember my session</span>
                      </label>
                    </div>

                    {/* Large Yellow Primary CTA Button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-2 bg-[#F9B000] hover:bg-[#E5A200] disabled:bg-[#F9B000]/50 text-[#05070B] py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#F9B000]/20 hover:shadow-[#F9B000]/30 active:scale-[0.99] transition-all disabled:pointer-events-none"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-[#05070B]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Authenticating secure access...</span>
                        </div>
                      ) : (
                        <>
                          <span>Access Portal</span>
                          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                        </>
                      )}
                    </button>

                    {/* Multi-Device Login Info Banner */}
                    <div className="mt-4 p-3.5 bg-[#F9B000]/10 border border-[#F9B000]/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                      <Smartphone className="w-5 h-5 text-[#F9B000] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#F9B000] block text-xs">Multi-Device Logins Supported:</span>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          You can log in to this account on multiple devices (mobile phones, site tablets, desktop computers) simultaneously without kicking off active sessions.
                        </p>
                      </div>
                    </div>
                  </form>

                  {/* Create account redirect for owners */}
                  {loginRole === 'owner' && (
                    <div className="text-center pt-3 border-t border-slate-800/60">
                      <p className="text-xs text-slate-400">
                        New operator or supervisor?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setIsRegisterMode(true);
                            setError(null);
                            setSuccess(null);
                          }}
                          className="text-[#F9B000] font-bold hover:underline transition-colors focus:outline-none cursor-pointer ml-1"
                        >
                          Create an account
                        </button>
                      </p>
                    </div>
                  )}
                </motion.div>
              ) : (
                // --- SIGN UP / CREATE ACCOUNT MODE ---
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-white tracking-tight">Create Fleet Account</h2>
                    <p className="text-xs text-slate-400">
                      Register a secure administrator or machinery operator account on this browser.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl flex items-start gap-2.5 text-xs leading-relaxed">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Desired Username
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <input
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => { setRegUsername(e.target.value); setError(null); }}
                          placeholder="e.g. supervisor_max"
                          className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Phone Number (for secure OTP resets)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Phone className="w-4 h-4 text-slate-500" />
                        </div>
                        <input
                          type="text"
                          required
                          value={regPhone}
                          onChange={(e) => { setRegPhone(e.target.value); setError(null); }}
                          placeholder="e.g. +1 (555) 123-4567"
                          className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-4 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Choose Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Lock className="w-4 h-4 text-slate-500" />
                        </div>
                        <input
                          type={regShowPassword ? 'text' : 'password'}
                          required
                          value={regPassword}
                          onChange={(e) => { setRegPassword(e.target.value); setError(null); }}
                          placeholder="Min. 5 characters"
                          className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                        />
                        <button
                          type="button"
                          onClick={() => setRegShowPassword(p => !p)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                        >
                          {regShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Lock className="w-4 h-4 text-slate-500" />
                        </div>
                        <input
                          type={regShowPassword ? 'text' : 'password'}
                          required
                          value={regConfirmPassword}
                          onChange={(e) => { setRegConfirmPassword(e.target.value); setError(null); }}
                          placeholder="Repeat password"
                          className="w-full bg-[#070A0E] border border-slate-800 hover:border-slate-700 focus:border-[#F9B000] text-slate-100 text-sm rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder:text-slate-600 focus:ring-1 focus:ring-[#F9B000]/30"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full mt-2 bg-[#F9B000] hover:bg-[#E5A200] disabled:bg-[#F9B000]/50 text-[#05070B] py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#F9B000]/20 active:scale-[0.99] transition-all disabled:pointer-events-none"
                    >
                      {isLoading ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-[#05070B]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Creating secure fleet profile...</span>
                        </div>
                      ) : (
                        <>
                          <span>Register &amp; Continue</span>
                          <UserPlus className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="text-center pt-2 border-t border-slate-800/60">
                    <p className="text-xs text-slate-400">
                      Already registered?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsRegisterMode(false);
                          setError(null);
                          setSuccess(null);
                        }}
                        className="text-[#F9B000] font-bold hover:underline transition-colors focus:outline-none cursor-pointer ml-1"
                      >
                        Sign in instead
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom attribution/disclaimer */}
          <div className="text-center text-[10px] text-slate-500 mt-8 pt-4 border-t border-slate-800/50">
            JCB Ledger Pro Fleet Worksheets. Licensed operator usage only. Security key: TLS-256
          </div>
        </div>
      </motion.div>
    </div>
  );
}
