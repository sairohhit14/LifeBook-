import React, { useState } from "react";
import { HardDrive, AlertTriangle, ArrowUpRight, X } from "lucide-react";
import { MONETIZATION_ENABLED } from "../config";

interface StorageUsageMeterProps {
  storageUsedGB: number;
  storageLimitGB: number;
  onUpgradeClick: () => void;
  variant?: "compact" | "full" | "sidebar";
}

export function StorageUsageMeter({ 
  storageUsedGB, 
  storageLimitGB, 
  onUpgradeClick,
  variant = "full" 
}: StorageUsageMeterProps) {
  const [showFullModal, setShowFullModal] = useState(false);
  const remainingGB = Math.max(0, +(storageLimitGB - storageUsedGB).toFixed(1));
  const percentage = Math.min(100, Math.round((storageUsedGB / storageLimitGB) * 100));
  const isFull = percentage >= 95;
  const isWarning = percentage >= 80 && !isFull;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col text-right">
          <span className="text-[11px] font-mono text-[#1E2521]">
            {storageUsedGB} GB / {storageLimitGB} GB
          </span>
          <span className="text-[9px] text-[#8A8F8B] font-semibold">
            {remainingGB} GB remaining ({percentage}%)
          </span>
        </div>
        {MONETIZATION_ENABLED && (
        <button
          onClick={onUpgradeClick}
          className="px-2.5 py-1 bg-[#315C4A] text-[#FCFBF7] hover:bg-[#27493A] text-[10px] font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer"
        >
          Upgrade
        </button>
        )}
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="p-3 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] space-y-2 text-[#1E2521]">
        <div className="flex items-center justify-between text-[10px] font-mono uppercase">
          <span className="flex items-center gap-1 text-[#8A8F8B]">
            <HardDrive className="w-3.5 h-3.5 text-[#315C4A]" /> Cloud Storage
          </span>
          <span className={isFull ? "text-[#B4543E]" : isWarning ? "text-[#315C4A]" : "text-[#1E2521]"}>
            {percentage}%
          </span>
        </div>

        <div className="w-full h-2 bg-[#F1EFEC] rounded-[16px] overflow-hidden border border-[#E5E5E1]">
          <div 
            className={`h-full transition-all duration-500 ${
              isFull ? "bg-[#B4543E]" : isWarning ? "bg-[#315C4A]" : "bg-[#4E7A64]"
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-[9px] font-mono text-[#454A46]">
          <span>{storageUsedGB} GB Used</span>
          <span>{storageLimitGB} GB Limit</span>
        </div>

        <button
          onClick={() => isFull && setShowFullModal(true)}
          className={`w-full py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-all cursor-pointer flex items-center justify-center gap-1 ${
            isFull 
              ? "bg-[#B4543E] text-white hover:bg-[#DC2626]" 
              : "bg-[#E5E5E1] text-[#1E2521] hover:bg-[#475569]"
          }`}
        >
          <span>{isFull ? "Storage Full - Details" : "Cloud Storage"}</span>
          {isFull && <ArrowUpRight className="w-3 h-3" />}
        </button>

        {showFullModal && (
          <StorageFullModal 
            onClose={() => setShowFullModal(false)}
            onUpgradeNow={() => {
              setShowFullModal(false);
              onUpgradeClick();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div id="storage-usage-meter" className="p-6 bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] shadow-md space-y-4 text-[#1E2521]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5E1] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#315C4A]/10 text-[#315C4A] border border-[#315C4A]/30">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-medium uppercase tracking-[0.12em] text-[#1E2521]">Encrypted Cloud Storage</h4>
            <p className="text-[11px] text-[#8A8F8B]">Multi-device synced vault storage meter</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xl font-mono font-bold text-[#315C4A]">
            {storageUsedGB} GB <span className="text-xs text-[#8A8F8B] font-normal">/ {storageLimitGB} GB Used</span>
          </span>
          {MONETIZATION_ENABLED && (
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] text-xs font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Upgrade</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono text-[#454A46]">
          <span>Usage Progress ({percentage}%)</span>
          <span>{remainingGB} GB Remaining</span>
        </div>
        <div className="w-full h-3 bg-[#FCFBF7] border border-[#E5E5E1] rounded-[16px] overflow-hidden p-0.5">
          <div 
            className={`h-full transition-all duration-700 ${
              isFull ? "bg-[#B4543E]" : isWarning ? "bg-[#315C4A]" : "bg-[#4E7A64]"
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>

      {isFull && (
        <div className="p-3 bg-[#B4543E]/10 border border-[#B4543E]/40 flex items-center justify-between text-xs text-[#F87171]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B4543E]" />
            <span>Storage is completely full! Upgrade now to continue saving photos, voice notes, and videos.</span>
          </div>
          <button 
            onClick={() => setShowFullModal(true)}
            className="px-3 py-1 bg-[#B4543E] text-white text-[10px] font-medium uppercase tracking-[0.12em] cursor-pointer"
          >
            View Alert
          </button>
        </div>
      )}

      {showFullModal && (
        <StorageFullModal 
          onClose={() => setShowFullModal(false)}
          onUpgradeNow={() => {
            setShowFullModal(false);
            onUpgradeClick();
          }}
        />
      )}
    </div>
  );
}

export function StorageFullModal({ 
  onClose, 
  onUpgradeNow 
}: { 
  onClose: () => void; 
  onUpgradeNow: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-[#F1EFEC] border-2 border-[#315C4A] rounded-[16px] max-w-md w-full p-6 text-[#1E2521] shadow-2xl relative space-y-6">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-[#8A8F8B] hover:text-[#1E2521] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#B4543E]/20 border border-[#B4543E] text-[#B4543E]">
            <HardDrive className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-medium uppercase tracking-wide text-[#1E2521]">Storage Full</h3>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#315C4A] font-bold">Capacity Limit Reached</span>
          </div>
        </div>

        <p className="text-sm text-[#454A46] leading-relaxed">
          Your memories are safe. Free storage is full, so new photo and video uploads are paused — your existing memories remain fully accessible.
        </p>

        <div className="p-3 bg-[#FCFBF7] border border-[#E5E5E1] text-xs text-[#454A46]">
          <p className="font-bold text-[#315C4A] mb-1">What happens when storage is full?</p>
          <ul className="list-disc list-inside space-y-1 text-[11px]">
            <li>Existing memories &amp; documents remain 100% secure and accessible.</li>
            <li>New high-resolution photo/video uploads are temporarily paused until storage is expanded.</li>
            <li>AI features stay 100% free and uninterrupted.</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#E5E5E1] hover:bg-[#475569] text-[#1E2521] text-xs font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer"
          >
            Later
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] text-xs font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer font-bold shadow-lg"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
