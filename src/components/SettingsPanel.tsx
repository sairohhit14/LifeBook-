import React, { useState, useEffect } from "react";
import { User } from "../types";
import { api } from "../api";
import { 
  Settings, User as UserIcon, Mail, Phone, Calendar, Lock, ShieldAlert, 
  Trash2, Loader, AlertCircle, CheckCircle, Upload, Server, Key, LogOut
} from "lucide-react";

interface SettingsPanelProps {
  user: User;
  onProfileUpdated: (user: User) => void;
  onLogout: () => void;
}

export default function SettingsPanel({ user, onProfileUpdated, onLogout }: SettingsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isGuest = (user as any).isGuestViewer || user.id.startsWith("guest_");

  // Legacy Key sharing states
  const [legacyKey, setLegacyKey] = useState(user.legacyKey || "");
  const [copied, setCopied] = useState(false);

  // Profile forms
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [dob, setDob] = useState(user.dob);
  const [phone, setPhone] = useState(user.phone || "");
  const [profilePhoto, setProfilePhoto] = useState(user.profilePhoto || "");
  const [uploading, setUploading] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Email delivery config
  const [protocol, setProtocol] = useState<"SMTP" | "Resend">("SMTP");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [resendFrom, setResendFrom] = useState("");

  useEffect(() => {
    fetchEmailConfig();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const config = await api.getEmailConfig();
      if (config) {
        setProtocol(config.protocol || "SMTP");
        setSmtpHost(config.smtpHost || "");
        setSmtpPort(config.smtpPort || "587");
        setSmtpUser(config.smtpUser || "");
        setSmtpPass(config.smtpPass || "");
        setSmtpFrom(config.smtpFrom || "");
        setResendApiKey(config.resendApiKey || "");
        setResendFrom(config.resendFrom || "");
      }
    } catch (err: any) {
      console.error("Failed to load email config:", err);
    }
  };

  const handleUpdateEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await api.updateEmailConfig({
        protocol,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        smtpFrom,
        resendApiKey,
        resendFrom
      });
      setSuccess("Email delivery service credentials updated and secured!");
    } catch (err: any) {
      setError(err.message || "Failed to update email delivery credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const updatedUser = await api.updateProfile({ name, email, dob, phone, profilePhoto });
      onProfileUpdated(updatedUser);
      setSuccess("Profile settings successfully updated!");
    } catch (err: any) {
      setError(err.message || "Failed to update profile details");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateKey = async () => {
    if (isGuest) return;
    if (window.confirm("Are you sure you want to regenerate your Legacy Access Key? This will invalidate the previous key immediately.")) {
      setError("");
      setSuccess("");
      setLoading(true);
      try {
        const result = await api.regenerateLegacyKey();
        setLegacyKey(result.legacyKey);
        onProfileUpdated({ ...user, legacyKey: result.legacyKey });
        setSuccess("Your secure Legacy Key has been regenerated successfully!");
      } catch (err: any) {
        setError(err.message || "Failed to regenerate legacy key");
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(legacyKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setSuccess("Your password was updated securely!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (err: any) {
      setError(err.message || "Could not change password");
    } finally {
      setLoading(false);
    }
  };

  const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      const result = await api.uploadFile(file.name, base64Data, "image");
      setProfilePhoto(result.url);
    } catch (err: any) {
      setError("Portrait upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.confirm(
      "WARNING: Doing this will PERMANENTLY delete your LifeBook account, your entire Memory Vault, timeline events, legacy messages, family trees, and secure vault documents. This cannot be undone! Are you absolutely sure?"
    );
    if (!confirmation) return;

    setLoading(true);
    try {
      await api.deleteAccount();
      onLogout();
    } catch (err: any) {
      setError("Failed to delete account: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="settings-root" className="space-y-8 animate-fade-in font-sans text-[#1A1A1A]">
      <div className="pb-4 border-b border-[#E5E5E1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] tracking-tight flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
            <Settings className="w-6 h-6 text-[#1A1A1A]" />
            <span>Profile &amp; Security Settings</span>
          </h2>
          <p className="text-[#1A1A1A]/70 text-xs mt-1">Manage your personal legacy owner record, update passwords, and manage database persistence.</p>
        </div>
        <button
          onClick={onLogout}
          className="self-start sm:self-center px-4 py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white rounded-none text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Account</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-none text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] text-[#1A1A1A] rounded-none text-xs flex items-center gap-2 font-bold">
          <CheckCircle className="w-4 h-4 text-[#1A1A1A] flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Profile Card */}
        <div className="p-6 bg-white border border-[#E5E5E1] rounded-none space-y-6 shadow-sm">
          <div className="flex justify-between items-start">
            <h3 className="font-serif italic text-lg text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>Personal Legacy Record</h3>
            {isGuest && (
              <span className="px-2 py-0.5 bg-[#F1EFEC] border border-[#1A1A1A]/10 text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">
                View Only
              </span>
            )}
          </div>

          {isGuest && (
            <div className="p-3 bg-[#F1EFEC] border border-[#1A1A1A]/10 text-[#1A1A1A]/70 text-[10px] font-medium leading-normal">
              You are signed in as a family guest. You can view the owner's profile info but are restricted from editing it.
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            
            {/* Avatar picker */}
            <div className="flex items-center gap-4 p-4 bg-[#F1EFEC] border border-[#E5E5E1] rounded-none">
              <div className="w-14 h-14 rounded-none bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-lg font-serif font-bold uppercase">
                {profilePhoto ? (
                  <img src={profilePhoto} alt={name} className="w-full h-full object-cover" />
                ) : name[0]}
              </div>

              {!isGuest && (
                <div>
                  <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] px-3 py-1.5 rounded-none flex items-center gap-1 cursor-pointer text-[10px] font-bold text-[#1A1A1A] transition-colors uppercase tracking-wider">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Update Portrait Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePortraitUpload}
                    />
                  </label>
                  {uploading && <p className="text-[10px] text-[#1A1A1A]/60 mt-1 font-semibold animate-pulse">Uploading...</p>}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  disabled={isGuest}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  disabled={isGuest}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Date of Birth</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    required
                    disabled={isGuest}
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Phone</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    disabled={isGuest}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {!isGuest && (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white rounded-none text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Update Profile Record</span>}
              </button>
            )}
          </form>
        </div>

        {/* Security / Password / Account Deletion card */}
        <div className="space-y-6">
          
          {/* Legacy Key card */}
          <div className="p-6 bg-white border border-[#E5E5E1] rounded-none space-y-4 shadow-sm">
            <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-1.5" style={{ fontFamily: "Georgia, serif" }}>
              <Key className="w-5 h-5 text-[#1A1A1A]" />
              <span>Secure Legacy Share Key</span>
            </h3>
            <p className="text-xs text-[#1A1A1A]/70 leading-relaxed">
              Your unique **Legacy Key** allows family members and heirs to securely view your uploaded memories, biography shelves, and public chronicles from the home screen in View-Only mode.
            </p>

            <div className="p-4 bg-[#F1EFEC] border border-[#E5E5E1] rounded-none flex flex-col items-center justify-center gap-3">
              <span className="text-[9px] uppercase tracking-wider font-bold text-[#1A1A1A]/60">Your Sharing Key</span>
              <div className="text-xl font-mono font-bold tracking-widest text-[#1A1A1A] select-all">
                {legacyKey || "LB-XXXXXX"}
              </div>
              <div className="flex gap-2 w-full mt-2">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  disabled={!legacyKey}
                  className="flex-1 py-2 border border-[#E5E5E1] hover:bg-white bg-[#F1EFEC] text-[#1A1A1A] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  {copied ? "Copied Key!" : "Copy Share Key"}
                </button>
                {!isGuest && (
                  <button
                    type="button"
                    onClick={handleRegenerateKey}
                    disabled={loading}
                    className="flex-1 py-2 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Regenerate Key
                  </button>
                )}
              </div>
            </div>
            
            <p className="text-[10px] text-[#1A1A1A]/50 italic">
              * Keep this key secure and distribute it only to trusted family members. Regenerating a key will immediately revoke access to any device currently logged in using the previous key.
            </p>
          </div>
          
          {!isGuest && (
            <>
              {/* Email Delivery Configuration form */}
              <div className="p-6 bg-white border border-[#E5E5E1] rounded-none space-y-6 shadow-sm">
                <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-1.5" style={{ fontFamily: "Georgia, serif" }}>
                  <Server className="w-5 h-5 text-[#1A1A1A]" />
                  <span>Email Delivery Configuration</span>
                </h3>
            <p className="text-xs text-[#1A1A1A]/70 leading-relaxed">
              Configure your personal SMTP server (Nodemailer) or Resend API credentials to automate legacy message delivery. If unconfigured, the system will fall back to server environment variables.
            </p>

            <form onSubmit={handleUpdateEmailConfig} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Delivery Protocol</label>
                <select
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value as any)}
                  className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] cursor-pointer font-bold uppercase tracking-wider text-[10px]"
                >
                  <option value="SMTP">SMTP (Nodemailer)</option>
                  <option value="Resend">Resend API</option>
                </select>
              </div>

              {protocol === "SMTP" ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">SMTP Host</label>
                      <input
                        type="text"
                        placeholder="smtp.gmail.com"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Port</label>
                      <input
                        type="text"
                        placeholder="587"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(e.target.value)}
                        className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">SMTP Username</label>
                    <input
                      type="text"
                      placeholder="your-email@gmail.com"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">SMTP Password / App Key</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Sender "From" Email</label>
                    <input
                      type="text"
                      placeholder='"LifeBook Legacy" <no-reply@lifebook.com>'
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Resend API Key</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
                        <Key className="w-4 h-4" />
                      </span>
                      <input
                        type="password"
                        placeholder="re_xxxxxxxxxxxxxx"
                        value={resendApiKey}
                        onChange={(e) => setResendApiKey(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Resend Sender Email (Verified Domain)</label>
                    <input
                      type="text"
                      placeholder="onboarding@resend.dev"
                      value={resendFrom}
                      onChange={(e) => setResendFrom(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white rounded-none text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Save Email Credentials</span>}
              </button>
            </form>
          </div>

          {/* Password form */}
          <div className="p-6 bg-white border border-[#E5E5E1] rounded-none space-y-6 shadow-sm">
            <h3 className="font-serif italic text-lg text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>Security Credentials</h3>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Current Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-[#1A1A1A]/70 uppercase tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#1A1A1A]/50">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-white hover:bg-[#F1EFEC] border border-[#E5E5E1] text-[#1A1A1A] rounded-none text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Update Secure Password</span>}
              </button>
            </form>
          </div>

          {/* Dangerous Zone */}
          <div className="p-6 bg-red-50 border border-red-200 rounded-none space-y-4">
            <h3 className="font-serif italic text-lg text-red-800 flex items-center gap-1.5" style={{ fontFamily: "Georgia, serif" }}>
              <ShieldAlert className="w-5 h-5 text-red-700" />
              <span>Danger Management Area</span>
            </h3>
            <p className="text-xs text-red-800/80 leading-relaxed">
              Erasing your account immediately, irreversibly purges your identity ledgers, database profiles, uploaded photos/documents, family connection circles, and generated memoir volumes.
            </p>

            <button
              onClick={handleDeleteAccount}
              disabled={loading}
              className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white rounded-none text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete LifeBook Account</span>
            </button>
          </div>
        </>
      )}

        </div>
      </div>
    </div>
  );
}
