import React, { useState } from "react";
import { User } from "../types";
import { api } from "../api";
import { 
  Settings, User as UserIcon, Mail, Phone, Calendar, Lock, ShieldAlert, 
  Trash2, Loader, AlertCircle, CheckCircle, Upload, Key, LogOut
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
      setError(err.message || "We couldn't save your profile changes. Please try again.");
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
        setError(err.message || "We couldn't create a new Legacy Key. Please try again.");
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
      setError("We couldn't upload that photo. " + err.message);
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
      setError("We couldn't delete your account. " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="settings-root" className="space-y-8 animate-fade-in font-sans text-[#1A1A1A]">
      <div className="pb-4 border-b border-[#E5E5E1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif italic text-[#1A1A1A] tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#1A1A1A]" />
            <span>Profile &amp; Security Settings</span>
          </h2>
          <p className="text-[#454A46] text-xs mt-1">Manage your personal legacy owner record, update passwords, and manage database persistence.</p>
        </div>
        <button
          onClick={onLogout}
          className="self-start sm:self-center px-4 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out of Account</span>
        </button>
      </div>

      {error && (
        <div className="p-3 bg-[#F9EFEB] border border-[#E8CDC4] text-[#B4543E] rounded-[16px] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#B4543E] flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-[#F1EFEC] border border-[#E5E5E1] text-[#1A1A1A] rounded-[16px] text-xs flex items-center gap-2 font-bold">
          <CheckCircle className="w-4 h-4 text-[#1A1A1A] flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Profile Card */}
        <div className="p-6 bg-white border border-[#E5E5E1] rounded-[16px] space-y-6 shadow-sm">
          <div className="flex justify-between items-start">
            <h3 className="font-serif italic text-lg text-[#1A1A1A]">Personal Legacy Record</h3>
            {isGuest && (
              <span className="px-2 py-0.5 bg-[#F1EFEC] border border-[#315C4A]/10 text-[9px] font-medium uppercase tracking-[0.12em] text-[#454A46]">
                View Only
              </span>
            )}
          </div>

          {isGuest && (
            <div className="p-3 bg-[#F1EFEC] border border-[#315C4A]/10 text-[#454A46] text-[10px] font-medium leading-normal">
              You are signed in as a family guest. You can view the owner's profile info but are restricted from editing it.
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            
            {/* Avatar picker */}
            <div className="flex items-center gap-4 p-4 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px]">
              <div className="w-14 h-14 rounded-[16px] bg-white border border-[#E5E5E1] flex items-center justify-center text-[#1A1A1A] text-lg font-serif font-medium uppercase">
                {profilePhoto ? (
                  <img src={profilePhoto} alt={name} className="w-full h-full object-cover" />
                ) : name[0]}
              </div>

              {!isGuest && (
                <div>
                  <label className="border border-[#E5E5E1] bg-white hover:bg-[#F1EFEC] px-3 py-1.5 rounded-[16px] flex items-center gap-1 cursor-pointer text-[10px] font-semibold text-[#1E2521] transition-colors uppercase tracking-wider">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Update Portrait Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePortraitUpload}
                    />
                  </label>
                  {uploading && <p className="text-[10px] text-[#454A46] mt-1 font-semibold animate-pulse">Uploading...</p>}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                  <UserIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  disabled={isGuest}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  disabled={isGuest}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Date of Birth</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    required
                    disabled={isGuest}
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Phone</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    disabled={isGuest}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A] disabled:opacity-70 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {!isGuest && (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Update Profile Record</span>}
              </button>
            )}
          </form>
        </div>

        {/* Security / Password / Account Deletion card */}
        <div className="space-y-6">
          
          {/* Legacy Key card */}
          <div className="p-6 bg-white border border-[#E5E5E1] rounded-[16px] space-y-4 shadow-sm">
            <h3 className="font-serif italic text-lg text-[#1A1A1A] flex items-center gap-1.5">
              <Key className="w-5 h-5 text-[#1A1A1A]" />
              <span>Secure Legacy Share Key</span>
            </h3>
            <p className="text-xs text-[#454A46] leading-relaxed">
              Your unique **Legacy Key** allows family members and heirs to securely view your uploaded memories, biography shelves, and public chronicles from the home screen in View-Only mode.
            </p>

            <div className="p-4 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] flex flex-col items-center justify-center gap-3">
              <span className="text-[9px] uppercase tracking-wider font-semibold text-[#1E2521]/60">Your Sharing Key</span>
              <div className="text-xl font-mono font-bold tracking-widest text-[#1A1A1A] select-all">
                {legacyKey || "LB-XXXXXX"}
              </div>
              <div className="flex gap-2 w-full mt-2">
                <button
                  type="button"
                  onClick={handleCopyKey}
                  disabled={!legacyKey}
                  className="flex-1 py-2 border border-[#E5E5E1] hover:bg-white bg-[#F1EFEC] text-[#1A1A1A] text-[10px] font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer"
                >
                  {copied ? "Copied Key!" : "Copy Share Key"}
                </button>
                {!isGuest && (
                  <button
                    type="button"
                    onClick={handleRegenerateKey}
                    disabled={loading}
                    className="flex-1 py-2 bg-[#315C4A] hover:bg-[#27493A] text-white text-[10px] font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer"
                  >
                    Regenerate Key
                  </button>
                )}
              </div>
            </div>
            
            <p className="text-[10px] text-[#8A8F8B] italic">
              * Keep this key secure and distribute it only to trusted family members. Regenerating a key will immediately revoke access to any device currently logged in using the previous key.
            </p>
          </div>
          
          {!isGuest && (
            <>
              {/* Password form */}
          <div className="p-6 bg-white border border-[#E5E5E1] rounded-[16px] space-y-6 shadow-sm">
            <h3 className="font-serif italic text-lg text-[#1A1A1A]">Security Credentials</h3>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Current Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-[#1E2521]/70 uppercase tracking-wider">Confirm New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-[#8A8F8B]">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#315C4A]"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 bg-white hover:bg-[#F1EFEC] border border-[#E5E5E1] text-[#1A1A1A] rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <span>Update Secure Password</span>}
              </button>
            </form>
          </div>

          {/* Dangerous Zone */}
          <div className="p-6 bg-[#F9EFEB] border border-[#E8CDC4] rounded-[16px] space-y-4">
            <h3 className="font-serif italic text-lg text-[#B4543E] flex items-center gap-1.5">
              <ShieldAlert className="w-5 h-5 text-[#B4543E]" />
              <span>Danger Management Area</span>
            </h3>
            <p className="text-xs text-[#B4543E]/80 leading-relaxed">
              Erasing your account immediately, irreversibly purges your identity ledgers, database profiles, uploaded photos/documents, family connection circles, and generated memoir volumes.
            </p>

            <button
              onClick={handleDeleteAccount}
              disabled={loading}
              className="px-4 py-2.5 bg-[#B4543E] hover:bg-[#9E4132] text-white rounded-[16px] text-[10px] font-medium uppercase tracking-[0.12em] flex items-center justify-center gap-1.5 transition-colors cursor-pointer w-full"
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
