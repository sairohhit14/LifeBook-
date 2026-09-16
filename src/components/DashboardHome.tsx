import React from "react";
import { DashboardStats, User } from "../types";
import { Heart, Image, Video, Mic, Shield, Users, BookOpen, ChevronRight, MessageSquare, Plus, CheckCircle, HelpCircle } from "lucide-react";
import AdPlacement from "./AdPlacement";
import StorageBanner from "./StorageBanner";
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

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

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

      {/* Morning Hero */}
      <div id="dashboard-hero" className="p-8 md:p-12 bg-[#FCFBF7] border border-[#E5E5E1] shadow-sm relative rounded-[24px] overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-8 animate-rise-in">
        <div className="absolute -right-16 -top-16 w-80 h-80 bg-[#E2EBE4]/70 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>
        <div className="absolute right-32 bottom-0 w-40 h-40 bg-[#C9A66B]/15 rounded-full blur-3xl pointer-events-none" aria-hidden="true"></div>
        {/* Subtle 3D memory-book visual (decorative, hidden on small screens) */}
        <div className="hidden md:block absolute right-16 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true">
          <div className="book-scene">
            <div className="book-shadow"></div>
            <div className="book">
              <div className="page left"></div>
              <div className="page right"></div>
            </div>
            <div className="memory-card3d animate-ambient-float" style={{ top: "-14px", right: "-18px", "--float-rotate": "6deg", animationDelay: "0s" } as React.CSSProperties}></div>
            <div className="memory-card3d animate-ambient-float" style={{ bottom: "-8px", right: "36px", "--float-rotate": "-8deg", "--float-scale": 0.82, animationDelay: "1.6s" } as React.CSSProperties}></div>
            <div className="memory-card3d animate-ambient-float" style={{ top: "18px", left: "-30px", "--float-rotate": "-5deg", "--float-scale": 0.9, "--photo": "linear-gradient(135deg, #E5D5B3, #C9A66B)" } as React.CSSProperties}></div>
            <span className="absolute -top-5 right-8 text-[#C9A66B]/80 animate-ambient-float" style={{ animationDelay: "2.2s" }}>✦</span>
          </div>
        </div>
        <div className="relative z-10 flex flex-col justify-between h-full space-y-4 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 text-[10px] uppercase font-medium tracking-[0.15em] bg-[#C9A66B]/15 border border-[#C9A66B]/40 text-[#8A6B3B] rounded-full">Your legacy space</span>
            {guestMode && (
              <span className="px-3 py-1 text-[10px] uppercase font-medium tracking-[0.15em] bg-[#E2EBE4] border border-[#B8C9BD] text-[#315C4A] rounded-full">Family view</span>
            )}
          </div>
          <h2 className="text-3xl md:text-5xl font-serif text-[#1E2521] tracking-tight leading-[1.1]">
            {guestMode ? (
              <>Reviewing <span className="italic">{user.name}'s</span> LifeBook</>
            ) : (
              <>
                {greeting}, <span className="italic">{user.name.split(" ")[0]}</span>.
                <br />
                <span className="text-[#454A46]">Your story matters.</span>
              </>
            )}
          </h2>
          <p className="text-[#1A1A1A]/70 text-sm max-w-xl leading-relaxed">
            {guestMode 
              ? "You have view-only access to explore precious memories, read generated biographies, review milestones, and download permitted digital documents."
              : "Your life journey is an invaluable gift for your loved ones. Let's capture, catalog, and transform your reflections into a lasting digital legacy."}
          </p>
        </div>        <div id="completion-gauge" className="flex flex-col items-center p-6 bg-[#F1EFEC] rounded-[16px] border border-[#E5E5E1] min-w-[220px] relative z-10">
          <div className="flex justify-between w-full text-[11px] uppercase tracking-wider text-[#454A46] mb-2 font-semibold">
            <span>Your story</span>
            <span className="text-[#315C4A]">{stats.legacyCompletion}%</span>
          </div>

          <div className="w-full h-2 bg-[#E5E5E1] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#315C4A] transition-all duration-1000 ease-out" 
              style={{ width: `${stats.legacyCompletion}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-[#454A46] mt-2 text-center font-serif italic">
            {stats.legacyCompletion === 100 
              ? "A life beautifully preserved." 
              : "Your story is growing."}
          </p>
        </div>
      </div>

      {/* Bento Grid Stats */}
      <div id="stats-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <div id="stat-memories" className="p-6 bg-white border border-[#E5E5E1] rounded-[16px] shadow-sm hover:border-[#315C4A] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]" onClick={() => onNavigate("memories")}>
          <div className="flex justify-between items-start text-[#1A1A1A] mb-3">
            <Heart className="w-5 h-5" />
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A]/60">Memories</span>
          </div>
          <div>
            <p className="text-3xl font-serif text-[#1A1A1A]">{stats.totalMemories}</p>
            <p className="text-xs text-[#1A1A1A]/60 mt-1">Reflections preserved</p>
          </div>
        </div>

        <div id="stat-media" className="p-6 bg-white border border-[#E5E5E1] rounded-[16px] shadow-sm hover:border-[#315C4A] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]" onClick={() => onNavigate("memories")}>
          <div className="flex gap-2 items-start text-[#1A1A1A] mb-3 justify-between">
            <div className="flex gap-1.5">
              <Image className="w-4 h-4 text-[#1A1A1A]/80" />
              <Video className="w-4 h-4 text-[#1A1A1A]/80" />
              <Mic className="w-4 h-4 text-[#1A1A1A]/80" />
            </div>
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A]/60">Vault Media</span>
          </div>
          <div>
            <p className="text-3xl font-serif text-[#1A1A1A]">
              {stats.photosCount + stats.videosCount + stats.voicesCount}
            </p>
            <p className="text-[10px] text-[#1A1A1A]/60 mt-1 uppercase font-medium tracking-tight">
              {stats.photosCount} Img • {stats.videosCount} Vid • {stats.voicesCount} Aud
            </p>
          </div>
        </div>

        <div id="stat-vault" className="p-6 bg-white border border-[#E5E5E1] rounded-[16px] shadow-sm hover:border-[#315C4A] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]" onClick={() => onNavigate("vault")}>
          <div className="flex justify-between items-start text-[#1A1A1A] mb-3">
            <Shield className="w-5 h-5 text-[#1A1A1A]" />
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A]/60">Credentials</span>
          </div>
          <div>
            <p className="text-3xl font-serif text-[#1A1A1A]">{stats.documentsCount}</p>
            <p className="text-xs text-[#1A1A1A]/60 mt-1">Schedules &amp; records</p>
          </div>
        </div>

        <div id="stat-stories" className="p-6 bg-white border border-[#E5E5E1] rounded-[16px] shadow-sm hover:border-[#315C4A] transition-all cursor-pointer flex flex-col justify-between min-h-[140px]" onClick={() => onNavigate("stories")}>
          <div className="flex justify-between items-start text-[#1A1A1A] mb-3">
            <BookOpen className="w-5 h-5 text-[#1A1A1A]" />
            <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-[#1A1A1A]/60">Memoirs</span>
          </div>
          <div>
            <p className="text-3xl font-serif text-[#1A1A1A]">{stats.storiesGeneratedCount}</p>
            <p className="text-xs text-[#1A1A1A]/60 mt-1">Biography books written</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Guide Checklist */}
        <div className="lg:col-span-2 p-8 bg-white border border-[#E5E5E1] rounded-[16px] space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-[#E5E5E1]">
            <h3 className="font-serif text-2xl text-[#1A1A1A] flex items-center gap-2">
              <span>Legacy Building Ledger</span>
              <span className="text-xs font-sans font-semibold text-[#1E2521]/50 bg-[#F1EFEC] px-2 py-0.5 rounded-[16px]">
                {checklist.filter(c => c.completed).length}/{checklist.length} Completed
              </span>
            </h3>
            <button onClick={() => onNavigate("companion")} className="text-[#1A1A1A] hover:opacity-80 text-xs font-medium uppercase tracking-[0.12em] flex items-center cursor-pointer underline">
              Ask Companion <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {checklist.map((item, idx) => (
              <div 
                key={idx} 
                className={`p-4 rounded-[16px] border flex items-center justify-between transition-all ${
                  item.completed 
                    ? "bg-[#F1EFEC]/40 border-[#E5E5E1] text-[#1A1A1A]/70" 
                    : "bg-white border-[#E5E5E1] text-[#1A1A1A] hover:border-[#315C4A] cursor-pointer"
                }`}
                onClick={() => !guestMode && onNavigate(item.targetTab)}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className={`w-5 h-5 flex-shrink-0 ${item.completed ? "text-[#1A1A1A] fill-[#1A1A1A]/10" : "text-[#E5E5E1]"}`} />
                  <span className="text-xs font-semibold text-[#1A1A1A]">
                    {item.text} 
                    {item.count !== undefined && item.max && (
                      <span className="text-[9px] text-[#1A1A1A]/50 ml-1.5 font-mono uppercase font-medium">({item.count}/{item.max})</span>
                    )}
                  </span>
                </div>
                <span className={`text-[10px] font-medium uppercase px-2.5 py-1 ${item.completed ? "bg-[#315C4A] text-white" : "bg-[#F1EFEC] text-[#1A1A1A]/60"}`}>
                  {item.completed ? "Complete" : item.bonus}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Tips & Interactive Side Panels */}
        <div className="space-y-6">
          {/* AI companion miniature card */}
          <div className="p-8 bg-white border border-[#E5E5E1] rounded-[16px] text-[#1A1A1A] space-y-4 relative">
            <div className="absolute -top-3 -left-3 bg-[#315C4A] text-white px-3 py-1 text-[9px] uppercase tracking-wider font-bold">
              Personal Coach
            </div>
            <div className="flex items-center gap-2 text-[#1A1A1A] pt-2">
              <MessageSquare className="w-5 h-5" />
              <h4 className="font-serif italic text-lg">Empathetic Life Coach</h4>
            </div>
            <p className="text-xs leading-relaxed text-[#1A1A1A]/80 italic">
              &ldquo;Hello! I'm here to ask you questions about your favorite childhood memories, your first school journey, or special values you want your family to inherit. Let's have a cozy chat.&rdquo;
            </p>
            <button
              onClick={() => onNavigate("companion")}
              className="w-full py-3 bg-[#315C4A] hover:bg-[#27493A] text-white rounded-[10px] text-sm font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate Dialogue</span>
            </button>
          </div>

          {/* Quick Stats Summary */}
          <div className="p-6 bg-[#F1EFEC]/60 border border-[#E5E5E1] rounded-[16px] space-y-3 text-xs text-[#1A1A1A]">
            <h4 className="font-semibold text-[#1E2521] text-xs uppercase tracking-wider flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#1A1A1A]/60" />
              <span>Progress Allocation</span>
            </h4>
            <ul className="space-y-1.5 text-[#1A1A1A]/70 list-none font-medium">
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>First Logged Memory:</span> <span className="font-semibold text-[#1E2521]">+5%</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Each Memory Photo:</span> <span className="font-semibold text-[#1E2521]">+2% (max 10)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Each Memory Video:</span> <span className="font-semibold text-[#1E2521]">+3% (max 15)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Each Oral Recording:</span> <span className="font-semibold text-[#1E2521]">+3% (max 15)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Milestones events:</span> <span className="font-semibold text-[#1E2521]">+2% (max 10)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Family Connections:</span> <span className="font-semibold text-[#1E2521]">+2% (max 10)</span></li>
              <li className="flex justify-between border-b border-[#E5E5E1]/50 pb-1"><span>Secure Vault Documents:</span> <span className="font-semibold text-[#1E2521]">+3% (max 15)</span></li>
              <li className="flex justify-between pb-1 font-semibold text-[#1E2521]"><span>Biography memoir story:</span> <span>+10% (max 20)</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
