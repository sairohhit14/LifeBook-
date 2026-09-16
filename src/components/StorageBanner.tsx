import React from "react";
import { Sparkles, HardDrive, ArrowRight, ShieldCheck } from "lucide-react";

interface StorageBannerProps {
  onLearnMore: () => void;
  onUpgradeStorage: () => void;
  planTier?: string;
  storageUsedGB?: number;
  storageLimitGB?: number;
}

export default function StorageBanner({ 
  onLearnMore, 
  onUpgradeStorage, 
  planTier = "Free",
  storageUsedGB = 1.2,
  storageLimitGB = 15
}: StorageBannerProps) {
  const percentage = Math.min(100, Math.round((storageUsedGB / storageLimitGB) * 100));

  return (
    <div 
      id="freemium-storage-banner"
      className="p-6 md:p-8 bg-gradient-to-r from-[#F1EFEC] via-[#E2EBE4] to-[#EFE9DD] border border-[#315C4A]/30 rounded-[16px] shadow-xl relative overflow-hidden group transition-all duration-300"
    >
      {/* Subtle Background Glow Accent */}
      <div className="absolute -right-12 -top-12 w-56 h-56 bg-[#315C4A]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#315C4A]/20 transition-all duration-700"></div>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        
        {/* Left Info Section */}
        <div className="flex items-start gap-4 max-w-3xl">
          <div className="p-3 bg-[#315C4A]/15 border border-[#315C4A]/40 text-[#315C4A] rounded-[16px] flex-shrink-0 mt-1">
            <Sparkles className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-[9px] font-mono font-medium uppercase tracking-[0.15em] bg-[#315C4A] text-[#FCFBF7]">
                100% FREE AI MEMORIES
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-[#E5E5E1] text-[#1E2521] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#4E7A64]" /> Active Tier: {planTier}
              </span>
            </div>

            <h3 className="text-lg md:text-xl font-serif text-[#1E2521] leading-snug font-bold">
              AI-powered memory preservation is <span className="text-[#315C4A] underline decoration-[#315C4A]/40">FREE for everyone</span>. Upgrade only if you need additional cloud storage.
            </h3>

            <p className="text-xs text-[#454A46] leading-relaxed">
              Enjoy unlimited AI memoir generation, voice transcription, and life companion interactions. You only pay when expanding your encrypted multi-device cloud storage.
            </p>
          </div>
        </div>

        {/* Right CTA Actions & Storage Mini Gauge */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto flex-shrink-0">
          
          {/* Storage Mini Pill */}
          <div className="px-4 py-2.5 bg-[#FCFBF7]/80 border border-[#E5E5E1] text-[#1E2521] flex flex-col justify-center gap-1 min-w-[140px]">
            <div className="flex justify-between items-center text-[10px] font-mono text-[#454A46] font-bold">
              <span>Cloud Storage</span>
              <span className="text-[#315C4A]">{storageUsedGB} / {storageLimitGB} GB</span>
            </div>
            <div className="w-full h-1.5 bg-[#E5E5E1] rounded-[16px] overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${percentage >= 85 ? "bg-[#B4543E]" : "bg-[#315C4A]"}`} 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>

          <button
            onClick={onLearnMore}
            className="px-4 py-2.5 bg-[#F1EFEC] hover:bg-[#E5E5E1] border border-[#475569] text-[#1E2521] text-xs font-medium uppercase tracking-[0.12em] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Learn More
          </button>

          <button
            onClick={onUpgradeStorage}
            className="px-5 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] text-xs font-medium uppercase tracking-[0.12em] transition-all cursor-pointer shadow-lg hover:shadow-[#315C4A]/20 flex items-center justify-center gap-2"
          >
            <HardDrive className="w-4 h-4" />
            <span>Upgrade Storage</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
