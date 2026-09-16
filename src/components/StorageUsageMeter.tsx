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
          <span className="text-[11px] font-mono font-bold text-[#F1F5F9]">
            {storageUsedGB} GB / {storageLimitGB} GB
          </span>
          <span className="text-[9px] text-[#64748B] font-semibold">
            {remainingGB} GB remaining ({percentage}%)
          </span>
        </div>
        {MONETIZATION_ENABLED && (
        <button
          onClick={onUpgradeClick}
          className="px-2.5 py-1 bg-[#F59E0B] text-[#0F172A] hover:bg-[#D97706] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          Upgrade
        </button>
        )}
      </div>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="p-3 bg-[#0F172A] border border-[#334155] rounded-none space-y-2 text-[#F1F5F9]">
        <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase">
          <span className="flex items-center gap-1 text-[#64748B]">
            <HardDrive className="w-3.5 h-3.5 text-[#F59E0B]" /> Cloud Storage
          </span>
          <span className={isFull ? "text-[#EF4444]" : isWarning ? "text-[#F59E0B]" : "text-[#F1F5F9]"}>
            {percentage}%
          </span>
        </div>

        <div className="w-full h-2 bg-[#1E293B] rounded-none overflow-hidden border border-[#334155]">
          <div 
            className={`h-full transition-all duration-500 ${
              isFull ? "bg-[#EF4444]" : isWarning ? "bg-[#F59E0B]" : "bg-[#10B981]"
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>

        <div className="flex justify-between text-[9px] font-mono text-[#94A3B8]">
          <span>{storageUsedGB} GB Used</span>
          <span>{storageLimitGB} GB Limit</span>
        </div>

        <button
          onClick={() => isFull && setShowFullModal(true)}
          className={`w-full py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
            isFull 
              ? "bg-[#EF4444] text-white hover:bg-[#DC2626]" 
              : "bg-[#334155] text-[#F1F5F9] hover:bg-[#475569]"
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
    <div id="storage-usage-meter" className="p-6 bg-[#1E293B] border border-[#334155] rounded-none shadow-md space-y-4 text-[#F1F5F9]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334155] pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">Encrypted Cloud Storage</h4>
            <p className="text-[11px] text-[#64748B]">Multi-device synced vault storage meter</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xl font-mono font-bold text-[#F59E0B]">
            {storageUsedGB} GB <span className="text-xs text-[#64748B] font-normal">/ {storageLimitGB} GB Used</span>
          </span>
          {MONETIZATION_ENABLED && (
          <button
            onClick={onUpgradeClick}
            className="px-4 py-2 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Upgrade</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-mono text-[#94A3B8]">
          <span>Usage Progress ({percentage}%)</span>
          <span>{remainingGB} GB Remaining</span>
        </div>
        <div className="w-full h-3 bg-[#0F172A] border border-[#334155] rounded-none overflow-hidden p-0.5">
          <div 
            className={`h-full transition-all duration-700 ${
              isFull ? "bg-[#EF4444]" : isWarning ? "bg-[#F59E0B]" : "bg-[#10B981]"
            }`}
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>

      {isFull && (
        <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/40 flex items-center justify-between text-xs text-[#F87171]">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <span>Storage is completely full! Upgrade now to continue saving photos, voice notes, and videos.</span>
          </div>
          <button 
            onClick={() => setShowFullModal(true)}
            className="px-3 py-1 bg-[#EF4444] text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer"
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
      <div className="bg-[#1E293B] border-2 border-[#F59E0B] rounded-none max-w-md w-full p-6 text-[#F1F5F9] shadow-2xl relative space-y-6">
        
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-[#64748B] hover:text-[#F1F5F9] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444]">
            <HardDrive className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold uppercase tracking-wide text-[#F1F5F9]">Storage Full</h3>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#F59E0B] font-bold">Capacity Limit Reached</span>
          </div>
        </div>

        <p className="text-sm text-[#CBD5E1] leading-relaxed">
          Your memories are safe. Free storage is full, so new photo and video uploads are paused — your existing memories remain fully accessible.
        </p>

        <div className="p-3 bg-[#0F172A] border border-[#334155] text-xs text-[#94A3B8]">
          <p className="font-bold text-[#F59E0B] mb-1">What happens when storage is full?</p>
          <ul className="list-disc list-inside space-y-1 text-[11px]">
            <li>Existing memories &amp; documents remain 100% secure and accessible.</li>
            <li>New high-resolution photo/video uploads are temporarily paused until storage is expanded.</li>
            <li>AI features stay 100% free and uninterrupted.</li>
          </ul>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#334155] hover:bg-[#475569] text-[#F1F5F9] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Later
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer font-bold shadow-lg"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
