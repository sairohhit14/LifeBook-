import React from "react";
import { DashboardStats, User } from "../types";
import { Heart, Image, Video, Mic, Shield, Users, BookOpen, ChevronRight, MessageSquare, Plus, CheckCircle, HelpCircle } from "lucide-react";
import StorageBanner from "./StorageBanner";
import AdPlacement from "./AdPlacement";
import { MONETIZATION_ENABLED } from "../config";

interface DashboardHomeProps {
  stats: DashboardStats;
  user: User;
  onNavigate: (tab: string) => void;
  guestMode?: boolean;
  storageUsedGB?: number;
  storageLimitGB?: number;
}

export default function DashboardHome({ 
  stats, 
  user, 
  onNavigate, 
  guestMode,
  storageUsedGB = 1.2,
  storageLimitGB = 15
}: DashboardHomeProps) {
  // Let's create an action-oriented legacy completion helper Checklist
  const checklist = [
    { text: "Add your first memory", bonus: "+5%", completed: stats.totalMemories > 0, targetTab: "memories" },
    { text: "Add memory photos (up to 5)", bonus: "+2% each", completed: stats.photosCount > 0, count: stats.photosCount, max: 5, targetTab: "memories" },
    { text: "Log memory video testimonies (up to 5)", bonus: "+3% each", completed: stats.videosCount > 0, count: stats.videosCount, max: 5, targetTab: "memories" },
    { text: "Record personal voice stories (up to 5)", bonus: "+3% each", completed: stats.voicesCount > 0, count: stats.voicesCount, max: 5, targetTab: "memories" },
    { text: "Add a milestones timeline event", bonus: "+2% each", completed: stats.totalMemories > 0 && stats.legacyCompletion > 5, targetTab: "timeline" },
    { text: "Add family members", bonus: "+2% each", completed: stats.familyMembersCount > 0, targetTab: "family" },
    { text: "Secure legacy files (Wills, insurance, etc.)", bonus: "+3% each", completed: stats.documentsCount > 0, targetTab: "vault" },
    { text: "Generate an AI Memoir Book", bonus: "+10% each", completed: stats.storiesGeneratedCount > 0, targetTab: "stories" },
  ];

  return (
    <div id="dashboard-home" className="space-y-8 animate-fade-in">
      
      {/* Prominent Freemium Storage Banner */}
      {!guestMode && MONETIZATION_ENABLED && (
        <StorageBanner 
          planTier={user.planTier || "Free"}
          storageUsedGB={storageUsedGB}
          storageLimitGB={storageLimitGB}
          onLearnMore={() => onNavigate("plans")}
          onUpgradeStorage={() => onNavigate("plans")}
        />
      )}

      {/* Ad Placement Banner (Shown exclusively to Free tier users) */}
      {!guestMode && (
        <AdPlacement placement="banner" user={user} />
      )}

      {/* Welcome Banner */}
      <div id="dashboard-hero" className="p-8 md:p-10 bg-white border border-[#E5E5E1] shadow-sm relative rounded-none flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#F1EFEC]/40 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col justify-between h-full space-y-4 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[9px] uppercase font-bold tracking-widest bg-[#1A1A1A] text-white">Digital Legacy Space</span>
            {guestMode && (
              <span className="px-2.5 py-1 text-[9px] uppercase font-bold tracking-widest bg-yellow-100 border border-yellow-300 text-yellow-800">Family Member Guest Mode</span>
            )}
          </div>
          <h2 className="text-3xl md:text-5xl font-serif italic text-[#1A1A1A] tracking-tight leading-tight" style={{ fontFamily: "Georgia, serif" }}>
            {guestMode ? `Reviewing ${user.name}'s LifeBook` : `Welcome, ${user.name}`}
          </h2>
          <p className="text-[#1A1A1A]/70 text-sm max-w-xl leading-relaxed">
            {guestMode 
              ? "You have view-only access to explore precious memories, read generated biographies, review milestones, and download permitted digital documents."
              : "Your life journey is an invaluable gift for your loved ones. Let's capture, catalog, and transform your reflections into a lasting digital legacy."}
          </p>
        </div>

        <div id="completion-gauge" className="flex flex-col items-center p-6 bg-[#F1EFEC] rounded-none border border-[#E5E5E1] min-w-[220px] relative z-10">
          <div className="flex justify-between w-full text-xs font-mono uppercase tracking-wider text-[#1A1A1A]/80 mb-2 font-bold">
            <span>Legacy Progress</span>
            <span className="text-[#1A1A1A]">{stats.legacyCompletion}%</span>
          </div>
          <div className="w-full h-2 bg-[#E5E5E1] rounded-none overflow-hidden">
            <div 
              className="h-full bg-[#1A1A1A] transition-all duration-1000 ease-out" 
              style={{ width: `${stats.legacyCompletion}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-[#1A1A1A]/60 mt-2 font-medium tracking-wide uppercase text-center">
            {stats.legacyCompletion === 100 
              ? "Your legacy vault is complete!" 
              : "Build your legacy ledger"}
          </p>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div id="stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div id="stat-memories" className="p-6 bg-white border border-[#E5E5E1] rounded-none shadow-sm hover:border-[#1A1A1A] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]" onClick={() => onNavigate("memories")}>
          <div className="flex justify-between items-start text-[#1A1A1A] mb-3">
            <Heart className="w-5 h-5" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">Memories</span>
          </div>
          <div>
            <p className="text-3xl font-serif text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>{stats.totalMemories}</p>
            <p className="text-xs text-[#1A1A1A]/60 mt-1">Reflections preserved</p>
          </div>
        </div>

        <div id="stat-media" className="p-6 bg-white border border-[#E5E5E1] rounded-none shadow-sm hover:border-[#1A1A1A] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]" onClick={() => onNavigate("memories")}>
          <div className="flex gap-2 items-start text-[#1A1A1A] mb-3 justify-between">
            <div className="flex gap-1.5">
              <Image className="w-4 h-4 text-[#1A1A1A]/80" />
              <Video className="w-4 h-4 text-[#1A1A1A]/80" />
              <Mic className="w-4 h-4 text-[#1A1A1A]/80" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">Vault Media</span>
          </div>
          <div>
            <p className="text-3xl font-serif text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>
              {stats.photosCount + stats.videosCount + stats.voicesCount}
            </p>
            <p className="text-[10px] text-[#1A1A1A]/60 mt-1 uppercase font-bold tracking-tight">
              {stats.photosCount} Img • {stats.videosCount} Vid • {stats.voicesCount} Aud
            </p>
          </div>
        </div>

        <div id="stat-vault" className="p-6 bg-white border border-[#E5E5E1] rounded-none shadow-sm hover:border-[#1A1A1A] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]" onClick={() => onNavigate("vault")}>
          <div className="flex justify-between items-start text-[#1A1A1A] mb-3">
            <Shield className="w-5 h-5 text-[#1A1A1A]" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">Credentials</span>
          </div>
          <div>
            <p className="text-3xl font-serif text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>{stats.documentsCount}</p>
            <p className="text-xs text-[#1A1A1A]/60 mt-1">Schedules &amp; records</p>
          </div>
        </div>

        <div id="stat-stories" className="p-6 bg-white border border-[#E5E5E1] rounded-none shadow-sm hover:border-[#1A1A1A] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]" onClick={() => onNavigate("stories")}>
          <div className="flex justify-between items-start text-[#1A1A1A] mb-3">
            <BookOpen className="w-5 h-5 text-[#1A1A1A]" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#1A1A1A]/60">Memoirs</span>
          </div>
          <div>
            <p className="text-3xl font-serif text-[#1A1A1A]" style={{ fontFamily: "Georgia, serif" }}>{stats.storiesGeneratedCount}</p>
            <p className="text-xs text-[#1A1A1A]/60 mt-1">Biography books written</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Guide Checklist */}
        <div className="lg:col-span-2 p-8 bg-white border border-[#E5E5E1] rounded-none space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-[#E5E5E1]">
            <h3 className="font-serif text-2xl text-[#1A1A1A] flex items-center gap-2" style={{ fontFamily: "Georgia, serif" }}>
              <span>Legacy Building Ledger</span>
              <span className="text-xs font-sans font-bold text-[#1A1A1A]/50 bg-[#F1EFEC] px-2 py-0.5 rounded-none">
                {checklist.filter(c => c.completed).length}/{checklist.length} Completed
              </span>
            </h3>
            <button onClick={() => onNavigate("companion")} className="text-[#1A1A1A] hover:opacity-80 text-xs font-bold uppercase tracking-wider flex items-center cursor-pointer underline">
              Ask Companion <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {checklist.map((item, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-none border flex items-center justify-between transition-all ${
                  item.completed 
                    ? "bg-[#F1EFEC]/40 border-[#E5E5E1] text-[#1A1A1A]/70" 
                    : "bg-white border-[#E5E5E1] text-[#1A1A1A] hover:border-[#1A1A1A] cursor-pointer"
                }`}
                onClick={() => !guestMode && onNavigate(item.targetTab)}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-5 h-5 flex-shrink-0 ${item.completed ? "text-[#1A1A1A] fill-[#1A1A1A]/10" : "text-[#E5E5E1]"}`} />
                  <span className="text-xs font-semibold text-[#1A1A1A]">
                    {item.text} 
                    {item.count !== undefined && item.max && (
                      <span className="text-[9px] text-[#1A1A1A]/50 ml-1.5 font-mono uppercase font-bold">({item.count}/{item.max})</span>
                    )}
                  </span>
                </div>
                <span className={`text-[9px] font-bold uppercase px-2.5 py-1 ${item.completed ? "bg-[#1A1A1A] text-white" : "bg-[#F1EFEC] text-[#1A1A1A]/60"}`}>
                  {item.completed ? "Complete" : item.bonus}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Tips & Interactive Side Panels */}
        <div className="space-y-6">
          {/* AI companion miniature card */}
          <div className="p-8 bg-white border border-[#E5E5E1] rounded-none text-[#1A1A1A] space-y-4 relative">
            <div className="absolute -top-3 -left-3 bg-[#1A1A1A] text-white px-3 py-1 text-[9px] uppercase tracking-wider font-bold">
              Personal Coach
            </div>
            <div className="flex items-center gap-2 text-[#1A1A1A] pt-2">
              <MessageSquare className="w-5 h-5" />
              <h4 className="font-serif italic text-lg" style={{ fontFamily: "Georgia, serif" }}>Empathetic Life Coach</h4>
            </div>
            <p className="text-xs leading-relaxed text-[#1A1A1A]/80 italic">
              &ldquo;Hello! I'm here to ask you questions about your favorite childhood memories, your first school journey, or special values you want your family to inherit. Let's have a cozy chat.&rdquo;
            </p>
            <button
              onClick={() => onNavigate("companion")}
              className="w-full py-3 bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white rounded-none text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate Dialogue</span>
            </button>
          </div>

          {/* Quick Stats Summary */}
          <div className="p-6 bg-[#F1EFEC]/60 border border-[#E5E5E1] rounded-none space-y-3 text-xs text-[#1A1A1A]">
            <h4 className="font-bold text-[#1A1A1A] text-xs uppercase tracking-wider flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#1A1A1A]/60" />
              <span>Progress Allocation</span>
            </h4>
            <ul className="space-y-1.5 text-[#1A1A1A]/70 list-none font-medium">
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>First Logged Memory:</span> <span className="font-bold text-[#1A1A1A]">+5%</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Each Memory Photo:</span> <span className="font-bold text-[#1A1A1A]">+2% (max 10)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Each Memory Video:</span> <span className="font-bold text-[#1A1A1A]">+3% (max 15)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Each Oral Recording:</span> <span className="font-bold text-[#1A1A1A]">+3% (max 15)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Milestones events:</span> <span className="font-bold text-[#1A1A1A]">+2% (max 10)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Family Connections:</span> <span className="font-bold text-[#1A1A1A]">+2% (max 10)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Secure Vault Documents:</span> <span className="font-bold text-[#1A1A1A]">+3% (max 15)</span></li>
              <li className="flex justify-between pb-1 font-bold text-[#1A1A1A]"><span>Biography memoir story:</span> <span>+10% (max 20)</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
