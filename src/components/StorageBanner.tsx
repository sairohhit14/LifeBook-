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
      className="p-6 md:p-8 bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] border border-[#F59E0B]/30 rounded-none shadow-xl relative overflow-hidden group transition-all duration-300"
    >
      {/* Subtle Background Glow Accent */}
      <div className="absolute -right-12 -top-12 w-56 h-56 bg-[#F59E0B]/10 rounded-full blur-3xl pointer-events-none group-hover:bg-[#F59E0B]/20 transition-all duration-700"></div>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        
        {/* Left Info Section */}
        <div className="flex items-start gap-4 max-w-3xl">
          <div className="p-3 bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] rounded-none flex-shrink-0 mt-1">
            <Sparkles className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest bg-[#F59E0B] text-[#0F172A]">
                100% FREE AI MEMORIES
              </span>
              <span className="px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider bg-[#334155] text-[#F1F5F9] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#10B981]" /> Active Tier: {planTier}
              </span>
            </div>

            <h3 className="text-lg md:text-xl font-serif text-[#F1F5F9] leading-snug font-bold">
              AI-powered memory preservation is <span className="text-[#F59E0B] underline decoration-[#F59E0B]/40">FREE for everyone</span>. Upgrade only if you need additional cloud storage.
            </h3>

            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Enjoy unlimited AI memoir generation, voice transcription, and life companion interactions. You only pay when expanding your encrypted multi-device cloud storage.
            </p>
          </div>
        </div>

        {/* Right CTA Actions & Storage Mini Gauge */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto flex-shrink-0">
          
          {/* Storage Mini Pill */}
          <div className="px-4 py-2.5 bg-[#0F172A]/80 border border-[#334155] text-[#F1F5F9] flex flex-col justify-center gap-1 min-w-[140px]">
            <div className="flex justify-between items-center text-[10px] font-mono text-[#94A3B8] font-bold">
              <span>Cloud Storage</span>
              <span className="text-[#F59E0B]">{storageUsedGB} / {storageLimitGB} GB</span>
            </div>
            <div className="w-full h-1.5 bg-[#334155] rounded-none overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${percentage >= 85 ? "bg-[#EF4444]" : "bg-[#F59E0B]"}`} 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>

          <button
            onClick={onLearnMore}
            className="px-4 py-2.5 bg-[#1E293B] hover:bg-[#334155] border border-[#475569] text-[#F1F5F9] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            Learn More
          </button>

          <button
            onClick={onUpgradeStorage}
            className="px-5 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg hover:shadow-[#F59E0B]/20 flex items-center justify-center gap-2"
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
