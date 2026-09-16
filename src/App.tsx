import React, { useState, useEffect } from "react";
import { User, DashboardStats, Notification, UserRole } from "./types";
import { api } from "./api";

// Sub Components
import LandingPage from "./components/LandingPage";
import DashboardHome from "./components/DashboardHome";
import MemoryVault from "./components/MemoryVault";
import LifeTimeline from "./components/LifeTimeline";
import LegacyMessages from "./components/LegacyMessages";
import FamilyCircle from "./components/FamilyCircle";
import SecureVault from "./components/SecureVault";
import BiographyBooks from "./components/BiographyBooks";
import LegacyCompanion from "./components/LegacyCompanion";
import GlobalSearch from "./components/GlobalSearch";
import SettingsPanel from "./components/SettingsPanel";
import GoogleFlowVideo from "./components/GoogleFlowVideo";

// SaaS Monetization Sub Components
import SubscriptionPlans from "./components/SubscriptionPlans";
import FamilyDashboard from "./components/FamilyDashboard";
import OrganizationDashboard from "./components/OrganizationDashboard";
import BillingPage from "./components/BillingPage";
import { StorageUsageMeter } from "./components/StorageUsageMeter";
import AdPlacement from "./components/AdPlacement";

// Icons
import {
  BookOpen, Heart, Calendar, Lock, Users, HardDrive, MessageSquare, 
  Search, Settings, Bell, LogOut, ChevronRight, Menu, X, ShieldAlert, Sparkles, Video,
  CreditCard, Image
} from "lucide-react";
import { MONETIZATION_ENABLED } from "./config";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);

  // Shell states
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // SaaS Subscription & Storage state
  const [subInfo, setSubInfo] = useState<{
    storageUsedGB: number;
    storageLimitGB: number;
    storagePercentage: number;
    planTier: string;
    role: string;
    autoRenew: boolean;
  }>({
    storageUsedGB: 1.2,
    storageLimitGB: 15,
    storagePercentage: 8,
    planTier: "Free",
    role: "Free User",
    autoRenew: false
  });

  useEffect(() => {
    bootstrapSession();
  }, []);

  const bootstrapSession = async () => {
    setLoading(true);
    try {
      if (api.isLoggedIn()) {
        const currentUser = await api.getCurrentUser();
        setUser(currentUser);
        if (currentUser.id.startsWith("guest_")) {
          setGuestMode(true);
        } else {
          setGuestMode(false);
        }
        await refreshStatsAndNotifications();
      }
    } catch (err) {
      console.error("Session restoration failed:", err);
      api.clearSession();
    } finally {
      setLoading(false);
    }
  };

  const refreshStatsAndNotifications = async () => {
    try {
      const dashboardStats = await api.getDashboardStats();
      setStats(dashboardStats);
      const notifyList = await api.getNotifications();
      setNotifications(notifyList);

      if (api.isLoggedIn()) {
        const sInfo = await api.getCurrentSubscription();
        setSubInfo(sInfo);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
  };

  const handleLoginSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setGuestMode(false);
    await refreshStatsAndNotifications();
    setActiveTab("dashboard");
  };

  const handleEnterGuestMode = async (legacyKey: string, familyMemberName: string) => {
    const guestUser = await api.familyLogin(legacyKey, familyMemberName);
    setUser(guestUser);
    setGuestMode(true);
    await refreshStatsAndNotifications();
    setActiveTab("dashboard");
  };

  const handleLogout = () => {
    api.clearSession();
    setUser(null);
    setGuestMode(false);
    setStats(null);
    setNotifications([]);
    setActiveTab("dashboard");
  };

  const handleMarkNotificationRead = async (id: string) => {
    if (guestMode) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      return;
    }
    try {
      await api.markNotificationRead(id);
      const list = await api.getNotifications();
      setNotifications(list);
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  };

  const handleClearNotifications = async () => {
    if (guestMode) {
      setNotifications([]);
      return;
    }
    try {
      await api.clearAllNotifications();
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    }
  };

  if (loading) {
    return (
      <div id="app-bootstrap-loader" className="min-h-screen bg-[#F7F4ED] text-[#1E2521] flex flex-col items-center justify-center font-sans gap-4">
        <LoaderComponent />
        <span className="text-sm text-[#8A8F8B] animate-pulse">Opening your LifeBook…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <LandingPage 
        onLoginSuccess={handleLoginSuccess} 
        onEnterGuestMode={handleEnterGuestMode} 
      />
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;
  const currentPlan = user.planTier || subInfo.planTier || "Free";
  const currentRole = user.role || subInfo.role || "Free User";

  return (
    <div id="app-shell" className="min-h-screen bg-[#F7F4ED] text-[#1E2521] flex flex-col font-sans">
      
      {/* Top Header */}
      <header id="app-header" className="h-20 border-b border-[#E5E5E1] bg-[#FCFBF7]/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            className="p-2 hover:bg-[#F1EFEC] rounded-[10px] lg:hidden text-[#454A46] transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("dashboard")}>
            <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E2EBE4] bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <img src="/logo.png" alt="LifeBook Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-serif italic tracking-tight text-[#1E2521] leading-none">LifeBook</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-[#7E9B89] font-medium hidden sm:inline">Your life. Your legacy. Forever.</span>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2 md:gap-3 relative">

          {/* Quick Storage Meter (Compact Top Bar Pill) */}
          <div 
            onClick={() => MONETIZATION_ENABLED && setActiveTab("plans")}
            className={`hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[10px] transition-all ${MONETIZATION_ENABLED ? "hover:border-[#B8C9BD] cursor-pointer" : "cursor-default"}`}
          >
            <HardDrive className="w-4 h-4 text-[#315C4A]" />
            <div className="flex flex-col text-right leading-none">
              <span className="text-[11px] font-medium text-[#1E2521]">
                {subInfo.storageUsedGB} / {subInfo.storageLimitGB} GB
              </span>
              <span className="text-[9px] text-[#8A8F8B]">
                {currentPlan} plan
              </span>
            </div>
          </div>

          {/* Universal Search quick link */}
          <button 
            onClick={() => setActiveTab("search")}
            aria-label="Search your LifeBook"
            className={`p-2 rounded-[10px] transition-all cursor-pointer ${activeTab === "search" ? "text-[#315C4A] bg-[#E2EBE4]" : "text-[#8A8F8B] hover:text-[#1E2521] hover:bg-[#F1EFEC]"}`}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications Center Bell */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
              className={`p-2 rounded-[10px] transition-all cursor-pointer relative ${activeTab && showNotifications ? "text-[#315C4A] bg-[#E2EBE4]" : "text-[#8A8F8B] hover:text-[#1E2521] hover:bg-[#F1EFEC]"}`}
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#C9826B] rounded-full"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] shadow-[0_4px_12px_rgba(30,37,33,0.06),0_16px_40px_rgba(30,37,33,0.09)] p-4 space-y-3 z-50 text-[#1E2521] animate-fade-in">
                <div className="flex justify-between items-center pb-2 border-b border-[#E5E5E1]">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-[#454A46]">Notifications</h5>
                  {notifications.length > 0 && (
                    <button 
                      onClick={handleClearNotifications}
                      className="text-[10px] text-[#8A8F8B] hover:text-[#1E2521] cursor-pointer transition-colors underline underline-offset-2"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#8A8F8B] py-4 text-center">You're all caught up.</p>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => handleMarkNotificationRead(n.id)}
                        className={`p-2.5 text-xs leading-normal transition-all cursor-pointer rounded-[10px] border ${
                          n.read 
                            ? "bg-[#F7F4ED] border-[#E5E5E1] text-[#8A8F8B]" 
                            : "bg-[#E2EBE4]/60 border-[#B8C9BD] text-[#1E2521] font-medium"
                        }`}
                      >
                        {n.title && <p className="font-semibold mb-0.5">{n.title}</p>}
                        <p>{n.message || (n as any).text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Badge & Dropdown */}
          <div className="relative flex items-center">
            <button 
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2.5 pl-2 border-l border-[#E5E5E1] hover:bg-[#F1EFEC] p-1.5 rounded-[10px] transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 rounded-full bg-[#E2EBE4] border border-[#B8C9BD] flex items-center justify-center text-xs font-serif italic font-semibold text-[#315C4A] overflow-hidden flex-shrink-0">
                {user.profilePhoto ? (
                  <img referrerPolicy="no-referrer" src={user.profilePhoto} className="w-full h-full object-cover" />
                ) : (
                  user.name.split(" ").map(n => n[0]).join("")
                )}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-[#1E2521] leading-none">{user.name}</p>
                <span className="text-[9px] text-[#8A8F8B]">{currentRole}</span>
              </div>
            </button>

            {userDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)}></div>
                
                <div className="absolute right-0 top-11 mt-2 w-64 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] shadow-[0_4px_12px_rgba(30,37,33,0.06),0_16px_40px_rgba(30,37,33,0.09)] p-2 z-50 text-[#1E2521] animate-fade-in space-y-1">
                  <div className="p-3 border-b border-[#E5E5E1]">
                    <p className="text-xs font-semibold text-[#1E2521] leading-none">{user.name}</p>
                    <p className="text-[10px] text-[#8A8F8B] mt-1 truncate">{user.email}</p>
                    <div className="mt-2 pt-2 border-t border-[#E5E5E1]/60 flex justify-between items-center text-[10px]">
                      <span className="text-[#8A8F8B]">Plan:</span>
                      <span className="text-[#315C4A] font-semibold">{currentPlan}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    {MONETIZATION_ENABLED && (
                    <button
                      onClick={() => { setActiveTab("plans"); setUserDropdownOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium rounded-[10px] hover:bg-[#F1EFEC] transition-colors cursor-pointer text-[#1E2521]"
                    >
                      <HardDrive className="w-4 h-4 text-[#315C4A]" />
                      <span>Upgrade storage</span>
                    </button>
                    )}
                    {MONETIZATION_ENABLED && (
                    <button
                      onClick={() => { setActiveTab("billing"); setUserDropdownOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium rounded-[10px] hover:bg-[#F1EFEC] transition-colors cursor-pointer text-[#1E2521]"
                    >
                      <CreditCard className="w-4 h-4 text-[#8A8F8B]" />
                      <span>Billing &amp; invoices</span>
                    </button>
                    )}
                    <button
                      onClick={() => { setActiveTab("settings"); setUserDropdownOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium rounded-[10px] hover:bg-[#F1EFEC] transition-colors cursor-pointer text-[#1E2521]"
                    >
                      <Settings className="w-4 h-4 text-[#8A8F8B]" />
                      <span>Settings</span>
                    </button>
                    <button
                      onClick={() => { handleLogout(); setUserDropdownOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs font-medium rounded-[10px] text-[#B4543E] hover:bg-[#B4543E]/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div id="app-body-container" className="flex-1 flex relative">
        
        {/* Navigation Sidebar */}
        <aside 
          id="app-sidebar" 
          className={`w-64 border-r border-[#E5E5E1] bg-[#FCFBF7] p-4 space-y-6 flex-shrink-0 flex flex-col justify-between fixed lg:sticky top-20 bottom-0 z-30 transition-all duration-300 ${
            mobileMenuOpen ? "left-0" : "-left-64 lg:left-0"
          }`}
        >
          <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-160px)]">
            
            {/* Storage Meter Sidebar Widget */}
            <StorageUsageMeter 
              storageUsedGB={subInfo.storageUsedGB}
              storageLimitGB={subInfo.storageLimitGB}
              onUpgradeClick={() => MONETIZATION_ENABLED && setActiveTab("plans")}
              variant="sidebar"
            />

            <span className="text-[10px] font-semibold text-[#8A8F8B] uppercase tracking-[0.2em] pl-3 block pt-2">
              Your Legacy
            </span>

            <nav className="space-y-1" aria-label="Main navigation">
              {[
                { id: "dashboard", label: "Home", icon: <Heart className="w-4 h-4" /> },
                { id: "memories", label: "Memories", icon: <Heart className="w-4 h-4" /> },
                { id: "timeline", label: "Timeline", icon: <Calendar className="w-4 h-4" /> },
                { id: "messages", label: "Messages", icon: <Lock className="w-4 h-4" /> },
                { id: "family", label: "Family", icon: <Users className="w-4 h-4" /> },
                { id: "vault", label: "Vault", icon: <ShieldAlert className="w-4 h-4" /> },
                { id: "stories", label: "Stories", icon: <BookOpen className="w-4 h-4" /> },
                { id: "companion", label: "AI Companion", icon: <MessageSquare className="w-4 h-4" /> },
                { id: "video", label: "Legacy Film", icon: <Video className="w-4 h-4" /> },
                ...(MONETIZATION_ENABLED ? [{ id: "plans", label: "Storage Plans", icon: <HardDrive className="w-4 h-4 text-[#315C4A]" />, highlight: true }] : []),
                ...(MONETIZATION_ENABLED ? [{ id: "billing", label: "Billing", icon: <CreditCard className="w-4 h-4" /> }] : [])
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  aria-current={activeTab === item.id ? "page" : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium transition-all cursor-pointer rounded-[10px] ${
                    activeTab === item.id 
                      ? "bg-[#E2EBE4] text-[#315C4A]" 
                      : "text-[#454A46] hover:bg-[#F1EFEC] hover:text-[#1E2521]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${activeTab === item.id ? "rotate-90" : "opacity-0"}`} />
                </button>
              ))}
            </nav>

            {/* Sidebar Ad Placement (Shown ONLY to Free Tier Users) */}
            <AdPlacement placement="sidebar" user={user} onUpgradeClick={() => setActiveTab("plans")} />
          </div>

          {/* Sidebar Footer */}
          <div className="space-y-1 pt-4 border-t border-[#E5E5E1]">
            <button
              onClick={() => { setActiveTab("settings"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all cursor-pointer rounded-[10px] ${
                activeTab === "settings" 
                  ? "bg-[#E2EBE4] text-[#315C4A]" 
                  : "text-[#454A46] hover:bg-[#F1EFEC] hover:text-[#1E2521]"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#B4543E] hover:bg-[#B4543E]/10 transition-all cursor-pointer rounded-[10px]"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Content Canvas Container */}
        <main id="app-main-canvas" className="flex-grow p-6 md:p-8 pb-24 md:pb-8 bg-[#F7F4ED] overflow-y-auto max-w-full">
          {guestMode && (
            <div className="mb-6 p-4 bg-[#E2EBE4]/70 border border-[#B8C9BD] rounded-[16px] flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#315C4A] text-[#FCFBF7] rounded-[10px]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#315C4A]">Family view</h4>
                  <p className="text-xs text-[#454A46]">
                    You're visiting <span className="font-semibold text-[#1E2521]">{user?.ownerName || "the legacy owner"}</span>'s LifeBook with view-only access.
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 bg-[#FCFBF7] border border-[#B8C9BD] text-[10px] tracking-wider font-medium text-[#315C4A] rounded-full">
                View only
              </div>
            </div>
          )}

          {activeTab === "dashboard" && stats && (
            <DashboardHome 
              stats={stats} 
              user={user} 
              onNavigate={(tab) => setActiveTab(tab)} 
              guestMode={guestMode}
              storageUsedGB={subInfo.storageUsedGB}
              storageLimitGB={subInfo.storageLimitGB}
            />
          )}

          {MONETIZATION_ENABLED && activeTab === "plans" && (
            <SubscriptionPlans 
              user={user}
              onPlanSelected={() => {
                refreshStatsAndNotifications();
                setActiveTab("billing");
              }}
            />
          )}

          {MONETIZATION_ENABLED && activeTab === "billing" && (
            <BillingPage 
              user={user}
              onUpgradeClick={() => setActiveTab("plans")}
            />
          )}

          {activeTab === "memories" && (
            <MemoryVault 
              onMemoryChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "timeline" && (
            <LifeTimeline 
              onTimelineChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "messages" && (
            <LegacyMessages 
              onMessagesChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "family" && (
            <FamilyCircle 
              onFamilyChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "vault" && (
            <SecureVault 
              onVaultChanged={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "stories" && (
            <BiographyBooks 
              onStoryGenerated={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "companion" && (
            <LegacyCompanion 
              onMemoryAdded={refreshStatsAndNotifications} 
              guestMode={guestMode}
            />
          )}

          {activeTab === "video" && (
            <GoogleFlowVideo 
              guestMode={guestMode}
            />
          )}

          {activeTab === "search" && (
            <GlobalSearch 
              onNavigateToTab={(tab) => setActiveTab(tab)} 
            />
          )}

          {activeTab === "settings" && (
            <SettingsPanel 
              user={user} 
              onProfileUpdated={(updatedUser) => setUser(updatedUser)} 
              onLogout={handleLogout}
            />
          )}
        </main>

        {/* Mobile bottom navigation (§19): high-frequency destinations + drawer for the rest */}
        <nav
          id="app-mobile-nav"
          aria-label="Quick navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around items-stretch bg-[#FCFBF7]/90 backdrop-blur-md border-t border-[#E5E5E1] pb-[env(safe-area-inset-bottom)]"
        >
          {[
            { id: "dashboard", label: "Home", icon: <Heart className="w-5 h-5" /> },
            { id: "memories", label: "Memories", icon: <Image className="w-5 h-5" /> },
            { id: "timeline", label: "Timeline", icon: <Calendar className="w-5 h-5" /> },
            { id: "family", label: "Family", icon: <Users className="w-5 h-5" /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              aria-current={activeTab === item.id ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 text-[10px] font-medium transition-colors cursor-pointer ${
                activeTab === item.id ? "text-[#315C4A]" : "text-[#454A46]"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="More sections"
            aria-expanded={mobileMenuOpen}
            className="flex flex-col items-center justify-center gap-0.5 py-2.5 px-2 text-[10px] font-medium text-[#454A46] transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

// Inline Helper: a small open-book mark while LifeBook wakes up
function LoaderComponent() {
  return (
    <div className="relative w-14 h-14 flex items-center justify-center animate-breathe" aria-hidden="true">
      <div className="absolute inset-0 rounded-full bg-[#E2EBE4]"></div>
      <BookOpen className="relative w-6 h-6 text-[#315C4A]" />
    </div>
  );
}
