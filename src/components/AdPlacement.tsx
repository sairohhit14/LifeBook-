import React, { useEffect, useState } from "react";
import { ExternalLink, Info, Sparkles } from "lucide-react";
import { api } from "../api";
import { Advertisement, User } from "../types";

interface AdPlacementProps {
  placement: "sidebar" | "feed" | "banner" | "bottom" | "sponsored_card";
  user: User;
  onUpgradeClick?: () => void;
}

export default function AdPlacement({ placement, user, onUpgradeClick }: AdPlacementProps) {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [loading, setLoading] = useState(true);

  // If paid subscriber, NEVER render ads!
  if (user && user.planTier && user.planTier !== "Free") {
    return null;
  }

  useEffect(() => {
    fetchAds();
  }, [user?.id, user?.planTier]);

  const fetchAds = async () => {
    try {
      const data = await api.getAdvertisements();
      setAds(data || []);
    } catch (err) {
      console.error("Failed to load advertisements:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filter ad by placement or pick first available
  const matchingAd = ads.find(a => a.placement === placement) || ads[0];

  useEffect(() => {
    if (matchingAd?.id) {
      api.trackAdView(matchingAd.id);
    }
  }, [matchingAd?.id]);

  if (loading) return null;

  if (!matchingAd) {
    // Render default partner placeholder card if no specific ad loaded
    return (
      <div className="p-4 bg-[#0F172A] border border-[#334155] rounded-none text-[#94A3B8] text-xs space-y-2">
        <div className="flex justify-between items-center text-[9px] font-mono uppercase tracking-widest text-[#64748B]">
          <span>Recommended Partner</span>
          <span className="px-1.5 py-0.5 bg-[#334155] text-[#94A3B8]">Ad</span>
        </div>
        <p className="font-bold text-[#F1F5F9]">Need Extra Storage for Your Vault?</p>
        <p className="text-[11px] leading-relaxed">Upgrade to any individual or family tier to hide all advertisements completely.</p>
        {onUpgradeClick && (
          <button 
            onClick={onUpgradeClick}
            className="w-full py-1.5 bg-[#F59E0B] text-[#0F172A] font-bold text-[10px] uppercase tracking-wider cursor-pointer"
          >
            Remove Ads &amp; Upgrade
          </button>
        )}
      </div>
    );
  }

  const handleAdClick = () => {
    api.trackAdClick(matchingAd.id);
    window.open(matchingAd.targetUrl, "_blank");
  };

  if (placement === "banner" || placement === "bottom") {
    return (
      <div 
        onClick={handleAdClick}
        className="p-4 bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] border border-[#334155] hover:border-[#F59E0B]/50 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-3">
          <img 
            src={matchingAd.imageUrl} 
            alt={matchingAd.title}
            className="w-12 h-12 object-cover border border-[#334155] flex-shrink-0" 
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest bg-[#F59E0B]/20 text-[#F59E0B] px-1.5 py-0.5">
                Sponsored
              </span>
              <span className="text-[10px] text-[#64748B] font-mono">{matchingAd.sponsorName}</span>
            </div>
            <h5 className="text-xs font-bold text-[#F1F5F9] group-hover:text-[#F59E0B] transition-colors mt-0.5">
              {matchingAd.title}
            </h5>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[10px] text-[#94A3B8] font-mono hidden md:inline">Ad shown to Free users</span>
          <button className="px-3 py-1.5 bg-[#334155] group-hover:bg-[#F59E0B] group-hover:text-[#0F172A] text-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1">
            <span>Learn More</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={handleAdClick}
      className="p-4 bg-[#1E293B] border border-[#334155] hover:border-[#F59E0B]/60 transition-all cursor-pointer space-y-3 group"
    >
      <div className="flex justify-between items-center text-[9px] font-mono text-[#64748B]">
        <span className="bg-[#F59E0B]/20 text-[#F59E0B] px-1.5 py-0.5 font-bold uppercase tracking-widest">
          Sponsored Card
        </span>
        <span>{matchingAd.sponsorName}</span>
      </div>

      {matchingAd.imageUrl && (
        <div className="h-28 w-full overflow-hidden bg-[#0F172A]">
          <img 
            src={matchingAd.imageUrl} 
            alt={matchingAd.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <div>
        <h5 className="text-xs font-bold text-[#F1F5F9] group-hover:text-[#F59E0B] transition-colors">
          {matchingAd.title}
        </h5>
      </div>

      <div className="pt-2 border-t border-[#334155] flex justify-between items-center text-[10px]">
        <span className="text-[#64748B]">Advertisement</span>
        <span className="text-[#F59E0B] font-bold flex items-center gap-1">
          Visit Sponsor <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
