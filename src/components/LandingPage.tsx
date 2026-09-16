import React, { useState } from "react";
import { api } from "../api";
import { User } from "../types";
import { BookOpen, Shield, Heart, Lock, User as UserIcon, Mail, Phone, Calendar, ArrowRight, Loader, X } from "lucide-react";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "../firebase";

interface LandingPageProps {
  onLoginSuccess: (user: User) => void;
  onEnterGuestMode: (legacyKey: string, familyMemberName: string) => Promise<void>;
}

export default function LandingPage({ onLoginSuccess, onEnterGuestMode }: LandingPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isFamilyMode, setIsFamilyMode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");

  // Family Mode states
  const [familyName, setFamilyName] = useState("");
  const [familyKey, setFamilyKey] = useState("");

  // Forgot Password / OTP Login States
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isOtpStep, setIsOtpStep] = useState(false);
  const [recoverySuccessMessage, setRecoverySuccessMessage] = useState("");
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);

  // Google Login States
  const [showGooglePicker, setShowGooglePicker] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState("");
  const [customGoogleName, setCustomGoogleName] = useState("");

  const handleGoogleLogin = async (selectedEmail: string, selectedName: string, selectedId?: string) => {
    setError("");
    setLoading(true);
    setShowGooglePicker(false);
    try {
      const user = await api.loginWithGoogle(selectedEmail, selectedName, selectedId);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "We couldn't sign you in with Google. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const triggerGoogleAuth = async () => {
    setError("");
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      if (googleUser.email) {
        const user = await api.loginWithGoogle(
          googleUser.email,
          googleUser.displayName || "Google User",
          googleUser.uid
        );
        onLoginSuccess(user);
      } else {
        throw new Error("Could not retrieve email from Google Account.");
      }
    } catch (err: any) {
      console.warn("Real Google Auth failed/unavailable, falling back to simulated sandbox picker:", err.message);
      setShowGooglePicker(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setRecoverySuccessMessage("");
    setEmailPreviewUrl(null);
    setLoading(true);
    try {
      const result = await api.forgotPassword(recoveryEmail);
      setRecoverySuccessMessage(result.message);
      if (result.previewUrl) {
        setEmailPreviewUrl(result.previewUrl);
      }
      setIsOtpStep(true);
    } catch (err: any) {
      setError(err.message || "We couldn't start password recovery. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) {
      setError("Please enter the 6-digit confirmation code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const user = await api.confirmLogin(recoveryEmail, otpCode);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || "That code didn't match. Please check your email and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleFamilySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyName || !familyKey) {
      setError("Please enter both your name and the Legacy Key.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onEnterGuestMode(familyKey, familyName);
    } catch (err: any) {
      setError(err.message || "That key didn't match. Please double-check it and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        if (!email || !password) {
          throw new Error("Please fill in all fields.");
        }
        const user = await api.login({ email, password });
        onLoginSuccess(user);
      } else {
        if (!name || !email || !password || !dob) {
          throw new Error("Name, Email, Password, and Date of Birth are required.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        const user = await api.register({ name, email, password, dob, phone });
        onLoginSuccess(user);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="landing-container" className="min-h-screen bg-[#F7F4ED] text-[#1E2521] flex flex-col md:flex-row font-sans">
      {/* Visual / Introduction Side */}
      <div id="landing-intro" className="flex-1 p-8 md:p-16 flex flex-col justify-between bg-[#FCFBF7] border-r border-[#E5E5E1]">
        <div id="landing-brand-logo" className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-[#315C4A]/50 bg-white flex items-center justify-center flex-shrink-0 shadow-lg">
            <img src="/logo.png" alt="LifeBook Logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-3xl font-serif italic tracking-tight text-[#1E2521]">LifeBook</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#315C4A] font-bold">Your Life. Your Legacy. Forever.</span>
          </div>
        </div>

        <div id="intro-hero" className="my-auto py-12 max-w-lg animate-rise-in">
          <p className="text-xs uppercase tracking-[0.2em] text-[#7E9B89] font-medium mb-5">A quiet home for a life's story</p>
          <h1 className="text-4xl md:text-6xl font-serif text-[#1E2521] mb-6 leading-[1.08]">
            Preserve what matters.
            <br />
            <span className="italic text-[#315C4A]">Forever.</span>
          </h1>
          <p className="text-[#454A46] text-base mb-10 leading-relaxed">
            LifeBook keeps your memories, milestones, letters, and important documents in one calm, private place — so the people you love can hear your story in your own words, long after today.
          </p>

          <div id="intro-features" className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] transition-all hover:border-[#B8C9BD] hover:shadow-sm">
              <div className="p-2 bg-[#E2EBE4] text-[#315C4A] rounded-[10px] flex-shrink-0">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif text-base text-[#1E2521]">A vault for every memory</h4>
                <p className="text-[#8A8F8B] text-sm mt-0.5">Photos, videos, and voice recordings — kept warm, kept safe.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] transition-all hover:border-[#B8C9BD] hover:shadow-sm">
              <div className="p-2 bg-[#E2EBE4] text-[#315C4A] rounded-[10px] flex-shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif text-base text-[#1E2521]">Your biography, written with you</h4>
                <p className="text-[#8A8F8B] text-sm mt-0.5">A gentle AI turns your timeline into an elegant book your family will keep.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] transition-all hover:border-[#B8C9BD] hover:shadow-sm">
              <div className="p-2 bg-[#C9A66B]/15 text-[#8A6B3B] rounded-[10px] flex-shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-serif text-base text-[#1E2521]">Private by design</h4>
                <p className="text-[#8A8F8B] text-sm mt-0.5">Wills, letters, and records stay sealed — shared only when you decide.</p>
              </div>
            </div>
          </div>
        </div>

        <div id="intro-footer" className="text-xs text-[#8A8F8B]">
          © 2026 LifeBook. Your memories stay yours.
        </div>
      </div>

      {/* Auth Form Side */}        <div id="landing-auth" className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-[#F1EFEC]/60">
        <div className="max-w-md w-full mx-auto space-y-8 bg-[#FCFBF7] p-8 md:p-10 rounded-[24px] border border-[#E5E5E1] shadow-sm">
          <div id="auth-header" className="text-center md:text-left pb-4 border-b border-[#E5E5E1]">
            <h2 className="text-3xl font-serif italic text-[#1E2521] tracking-tight">
              {isFamilyMode 
                ? "Family Member Access" 
                : forgotPasswordMode
                  ? "Account Recovery"
                  : isLogin 
                    ? "Welcome Back" 
                    : "Begin Your Legacy"}
            </h2>
            <p className="text-[#8A8F8B] text-xs mt-2 uppercase font-mono font-bold tracking-wider">
              {isFamilyMode
                ? "Enter your name and the legacy key generated by the book owner to view their chronicles."
                : forgotPasswordMode
                  ? isOtpStep
                    ? "Verify the 6-digit confirmation code sent to your inbox to log in."
                    : "Enter your registered email address to recover your password and login."
                  : isLogin 
                    ? "Sign in to review and write your digital life story." 
                    : "Create a private ledger and preserve memoirs for future generations."}
            </p>
          </div>

          {error && (
            <div id="auth-error" className="p-4 bg-[#B4543E]/10 border border-[#B4543E] text-[#B4543E] rounded-[16px] text-xs font-semibold">
              {error}
            </div>
          )}

          {isFamilyMode ? (
            <form id="family-auth-form" onSubmit={handleFamilySubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Your Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                    <UserIcon className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    placeholder="E.g., Jane Smith"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Owner's Legacy Key</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={familyKey}
                    onChange={(e) => setFamilyKey(e.target.value)}
                    placeholder="E.g., LB-A1B2C3"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A] font-mono font-bold tracking-wider"
                  />
                </div>
              </div>

              <button
                id="submit-family-btn"
                type="submit"
                disabled={loading}
                className="w-full py-3 mt-4 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] rounded-[10px] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Enter Legacy Vault</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError("");
                  setIsFamilyMode(false);
                }}
                className="w-full py-3 border border-[#E5E5E1] hover:bg-[#FCFBF7] bg-[#FCFBF7] text-[#1E2521] rounded-[10px] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span>Go Back to Owner Sign In</span>
              </button>
            </form>
          ) : forgotPasswordMode ? (
            <>
              {recoverySuccessMessage && (
                <div id="recovery-success" className="p-4 bg-[#4E7A64]/10 border border-[#4E7A64] text-[#34D399] rounded-[16px] text-xs font-semibold leading-relaxed">
                  {recoverySuccessMessage}
                </div>
              )}

              {isOtpStep ? (
                <form id="confirm-login-form" onSubmit={handleConfirmLoginSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">6-Digit Confirmation Code</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="E.g., 123456"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm font-mono tracking-widest focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A] placeholder:font-sans placeholder:tracking-normal"
                      />
                    </div>
                    <p className="text-[10px] text-[#8A8F8B] leading-relaxed italic">
                      Please check your email. If you don't receive it shortly, check your spam folder.
                    </p>
                  </div>

                  {emailPreviewUrl && (
                    <div className="p-4 bg-[#315C4A]/10 border border-[#315C4A] text-[#FBBF24] rounded-[16px] text-xs space-y-2">
                      <p className="font-medium uppercase tracking-[0.12em] text-[9px] text-[#315C4A]">
                        [Test Mode] Automatic Email Delivery Interceptor
                      </p>
                      <p className="leading-relaxed text-[11px]">
                        Since this is a simulated sandbox environment, the system has dispatched a test Ethereal message containing your credentials and code.
                      </p>
                      <a
                        href={emailPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E2521] hover:underline uppercase tracking-wide bg-[#FCFBF7] px-2.5 py-1.5 border border-[#E5E5E1] shadow-xs"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Open Sent Email Preview ↗</span>
                      </a>
                    </div>
                  )}

                  <button
                    id="submit-confirm-login-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 mt-4 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] rounded-[10px] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Confirm Login & Enter</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setRecoverySuccessMessage("");
                        setIsOtpStep(false);
                        setOtpCode("");
                      }}
                      className="flex-1 py-2.5 border border-[#E5E5E1] hover:bg-[#FCFBF7] bg-[#FCFBF7] text-[#1E2521] rounded-[10px] text-sm font-medium flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <span>Resend Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError("");
                        setRecoverySuccessMessage("");
                        setForgotPasswordMode(false);
                        setIsOtpStep(false);
                        setOtpCode("");
                        setRecoveryEmail("");
                        setEmailPreviewUrl(null);
                      }}
                      className="flex-1 py-2.5 border border-[#E5E5E1] hover:bg-[#FCFBF7] bg-[#FCFBF7] text-[#1E2521] rounded-[10px] text-sm font-medium flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <span>Cancel</span>
                    </button>
                  </div>
                </form>
              ) : (
                <form id="forgot-password-form" onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Registered Email Address</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A]"
                      />
                    </div>
                  </div>

                  <button
                    id="submit-forgot-password-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 mt-4 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] rounded-[10px] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Send Recovery Email</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setRecoverySuccessMessage("");
                      setForgotPasswordMode(false);
                      setIsOtpStep(false);
                      setRecoveryEmail("");
                      setEmailPreviewUrl(null);
                    }}
                    className="w-full py-3 border border-[#E5E5E1] hover:bg-[#FCFBF7] bg-[#FCFBF7] text-[#1E2521] rounded-[10px] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <span>Back to Sign In</span>
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <form id="auth-form" onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Full Name</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                        <UserIcon className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="E.g., John Doe"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A]"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="type" // Keep original
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A]"
                    />
                  </div>
                </div>

                {!isLogin && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Date of Birth</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                          <Calendar className="w-4 h-4" />
                        </span>
                        <input
                          type="date"
                          required
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Phone (Optional)</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                          <Phone className="w-4 h-4" />
                        </span>
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 000-0000"
                          className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Password</label>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setForgotPasswordMode(true);
                            setRecoveryEmail(email); // Autofill from main email input if entered
                            setIsOtpStep(false);
                            setRecoverySuccessMessage("");
                          }}
                          className="text-[10px] font-bold text-[#8A8F8B] hover:text-[#1E2521] uppercase tracking-wider underline cursor-pointer focus:outline-none"
                        >
                          Forgot Password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                        <Lock className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A]"
                      />
                    </div>
                  </div>

                  {!isLogin && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#8A8F8B] uppercase tracking-wider">Confirm Password</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                          <Lock className="w-4 h-4" />
                        </span>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-4 py-2.5 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[10px] text-[#1E2521] text-sm focus:outline-none focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A]"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  id="submit-auth-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 mt-4 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] rounded-[10px] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{isLogin ? "Log In" : "Create Account"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-[#E5E5E1]"></div>
                  <span className="flex-shrink mx-4 text-[9px] text-[#8A8F8B] uppercase tracking-wider font-bold">Or continue with</span>
                  <div className="flex-grow border-t border-[#E5E5E1]"></div>
                </div>

                <button
                  id="google-signin-btn"
                  type="button"
                  onClick={triggerGoogleAuth}
                  disabled={loading}
                  className="w-full py-3 bg-white hover:bg-[#F1EFEC] text-[#1E2521] rounded-[16px] text-xs font-medium uppercase tracking-[0.12em] flex items-center justify-center gap-2.5 cursor-pointer transition-colors border border-[#E5E5E1] disabled:opacity-50"
                >
                  <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </form>

              <div id="auth-toggle-container" className="flex flex-col gap-4 text-center pt-2">
                <button
                  id="toggle-auth-btn"
                  onClick={() => {
                    setError("");
                    setIsLogin(!isLogin);
                  }}
                  className="text-xs text-[#8A8F8B] hover:text-[#1E2521] font-medium uppercase tracking-[0.12em] underline cursor-pointer"
                >
                  {isLogin 
                    ? "Don't have an account? Create New Account" 
                    : "Already registered? Log in to your account"}
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-[#E5E5E1]"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-[#8A8F8B] uppercase tracking-wider font-bold">Or enter as family member</span>
                  <div className="flex-grow border-t border-[#E5E5E1]"></div>
                </div>

                <button
                  id="guest-mode-btn"
                  onClick={() => {
                    setError("");
                    setIsFamilyMode(true);
                  }}
                  className="w-full py-3 border border-[#E5E5E1] hover:bg-[#FCFBF7] bg-[#FCFBF7] text-[#1E2521] rounded-[10px] text-sm font-medium flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>Continue as Family Member</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {showGooglePicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FCFBF7] border border-[#E5E5E1] max-w-sm w-full p-6 text-[#1E2521] shadow-2xl relative space-y-6">
            
            <button 
              onClick={() => setShowGooglePicker(false)}
              className="absolute top-4 right-4 text-[#8A8F8B] hover:text-[#1E2521] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center space-y-2 pb-4 border-b border-[#E5E5E1]">
              <div className="inline-flex justify-center p-2 bg-white rounded-full mb-2">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-[#1E2521]">Sign in with Google</h3>
              <p className="text-xs text-[#454A46]">Choose an account to continue to LifeBook</p>
            </div>

            {/* List of Simulated Google Accounts */}
            <div className="space-y-2.5">
              {[
                { name: "Jane Smith", email: "jane.smith@gmail.com", avatar: "JS" },
                { name: "John Doe", email: "john.doe@gmail.com", avatar: "JD" },
                { name: "Sarah Connor", email: "sarah.connor@gmail.com", avatar: "SC" }
              ].map((acc, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleGoogleLogin(acc.email, acc.name, `google_sim_${index}`)}
                  className="w-full flex items-center gap-3 p-3 bg-[#F7F4ED] hover:bg-[#FCFBF7] border border-[#E5E5E1] hover:border-[#475569] text-left transition-all cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-full bg-[#315C4A]/20 text-[#315C4A] font-bold text-xs flex items-center justify-center border border-[#315C4A]/30">
                    {acc.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1E2521]">{acc.name}</p>
                    <p className="text-[10px] text-[#8A8F8B] font-mono">{acc.email}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[#E5E5E1]"></div>
              <span className="flex-shrink mx-3 text-[9px] text-[#8A8F8B] uppercase tracking-wider font-bold">Use Custom Account</span>
              <div className="flex-grow border-t border-[#E5E5E1]"></div>
            </div>

            {/* Custom Google Account Input */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (customGoogleEmail && customGoogleName) {
                  handleGoogleLogin(customGoogleEmail, customGoogleName);
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-[#454A46] uppercase">Full Name</label>
                <input 
                  type="text"
                  required
                  placeholder="E.g., Jane Doe"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4ED] border border-[#E5E5E1] text-xs text-[#1E2521] focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A] outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-[#454A46] uppercase">Google Email</label>
                <input 
                  type="email"
                  required
                  placeholder="e.g. name@gmail.com"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4ED] border border-[#E5E5E1] text-xs text-[#1E2521] focus:border-[#315C4A] focus:ring-1 focus:ring-[#315C4A] outline-none font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] text-xs font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer"
              >
                Sign In with Custom Google Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
