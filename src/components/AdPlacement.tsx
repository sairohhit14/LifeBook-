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
      <div className="p-4 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] text-[#454A46] text-xs space-y-2">
        <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-[#8A8F8B]">
          <span>Recommended Partner</span>
          <span className="px-1.5 py-0.5 bg-[#E5E5E1] text-[#454A46]">Ad</span>
        </div>
        <p className="font-bold text-[#1E2521]">Need Extra Storage for Your Vault?</p>
        <p className="text-[11px] leading-relaxed">Upgrade to any individual or family tier to hide all advertisements completely.</p>
        {onUpgradeClick && (
          <button 
            onClick={onUpgradeClick}
            className="w-full py-1.5 bg-[#315C4A] text-[#FCFBF7] font-medium text-[10px] uppercase tracking-[0.12em] cursor-pointer"
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
        className="p-4 bg-gradient-to-r from-[#F1EFEC] via-[#E2EBE4] to-[#EFE9DD] border border-[#E5E5E1] hover:border-[#315C4A]/50 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4 group"
      >
        <div className="flex items-center gap-3">
          <img 
            src={matchingAd.imageUrl} 
            alt={matchingAd.title}
            className="w-12 h-12 object-cover border border-[#E5E5E1] flex-shrink-0" 
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono font-medium uppercase tracking-[0.15em] bg-[#315C4A]/20 text-[#315C4A] px-1.5 py-0.5">
                Sponsored
              </span>
              <span className="text-[10px] text-[#8A8F8B] font-mono">{matchingAd.sponsorName}</span>
            </div>
            <h5 className="text-xs font-semibold text-[#1E2521] group-hover:text-[#315C4A] transition-colors mt-0.5">
              {matchingAd.title}
            </h5>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[10px] text-[#454A46] font-mono hidden md:inline">Ad shown to Free users</span>
          <button className="px-3 py-1.5 bg-[#E5E5E1] group-hover:bg-[#315C4A] group-hover:text-[#FCFBF7] text-white text-[10px] font-medium uppercase tracking-[0.12em] transition-colors flex items-center gap-1">
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
      className="p-4 bg-[#F1EFEC] border border-[#E5E5E1] hover:border-[#315C4A]/60 transition-all cursor-pointer space-y-3 group"
    >
      <div className="flex justify-between items-center text-[9px] font-mono text-[#8A8F8B]">
        <span className="bg-[#315C4A]/20 text-[#315C4A] px-1.5 py-0.5 font-medium uppercase tracking-[0.15em]">
          Sponsored Card
        </span>
        <span>{matchingAd.sponsorName}</span>
      </div>

      {matchingAd.imageUrl && (
        <div className="h-28 w-full overflow-hidden bg-[#FCFBF7]">
          <img 
            src={matchingAd.imageUrl} 
            alt={matchingAd.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}

      <div>
        <h5 className="text-xs font-semibold text-[#1E2521] group-hover:text-[#315C4A] transition-colors">
          {matchingAd.title}
        </h5>
      </div>

      <div className="pt-2 border-t border-[#E5E5E1] flex justify-between items-center text-[10px]">
        <span className="text-[#8A8F8B]">Advertisement</span>
        <span className="text-[#315C4A] font-bold flex items-center gap-1">
          Visit Sponsor <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
