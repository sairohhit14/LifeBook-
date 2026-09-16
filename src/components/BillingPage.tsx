import React, { useState, useEffect } from "react";
import { 
  CreditCard, ShieldCheck, Download, RefreshCw, AlertCircle, 
  CheckCircle, ArrowUpRight, HardDrive, ToggleLeft, ToggleRight, FileText, QrCode, Smartphone
} from "lucide-react";
import { api } from "../api";
import { User, Invoice, Payment, Subscription } from "../types";

interface BillingPageProps {
  user: User;
  onUpgradeClick: () => void;
}

export default function BillingPage({ user, onUpgradeClick }: BillingPageProps) {
  const [billingData, setBillingData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRenew, setAutoRenew] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    loadBillingSummary();
  }, []);

  const loadBillingSummary = async () => {
    setLoading(true);
    try {
      const data = await api.getBillingSummary();
      setBillingData(data);
      if (data.subscription) {
        setAutoRenew(data.subscription.autoRenew !== false);
      }
    } catch (err) {
      console.error("Failed to load billing details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    setToggling(true);
    try {
      if (autoRenew) {
        await api.cancelSubscription();
        setAutoRenew(false);
      } else {
        // Upgrade / Re-enable
        await api.upgradeSubscription(user.planTier || "Individual Monthly", "UPI");
        setAutoRenew(true);
      }
    } catch (err: any) {
      alert(err.message || "Failed to update auto renewal setting");
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs font-mono text-[#64748B] uppercase tracking-widest animate-pulse">
        Loading Billing &amp; Invoice Ledger...
      </div>
    );
  }

  const sub: Subscription | null = billingData?.subscription;
  const invoices: Invoice[] = billingData?.invoices || [];
  const payments: Payment[] = billingData?.payments || [];
  
  const storageLimit = user.storageLimitGB || sub?.storageAllocatedGB || 15;
  const storageUsed = user.storageUsedGB || 1.2;
  const remaining = Math.max(0, +(storageLimit - storageUsed).toFixed(1));

  return (
    <div id="billing-page" className="space-y-8 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="p-8 bg-gradient-to-r from-[#1E293B] via-[#0F172A] to-[#1E293B] border border-[#334155] flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
            <CreditCard className="w-7 h-7" />
          </div>
          <div>
            <span className="text-[10px] font-mono text-[#F59E0B] font-bold uppercase tracking-widest">SaaS Billing Console</span>
            <h1 className="text-3xl font-serif italic text-[#F1F5F9]" style={{ fontFamily: "Georgia, serif" }}>
              Billing &amp; Subscription Management
            </h1>
            <p className="text-xs text-[#94A3B8] mt-1">Review active plan, storage meters, renewal cycles, and downloadable tax invoices.</p>
          </div>
        </div>

        <button
          onClick={onUpgradeClick}
          className="px-5 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-lg flex items-center gap-2"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Upgrade Storage Tier</span>
        </button>
      </div>

      {/* Grid 1: Current Plan & Storage Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Current Plan Card */}
        <div className="p-6 bg-[#1E293B] border border-[#334155] space-y-4">
          <div className="flex justify-between items-center border-b border-[#334155] pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9]">Current Subscription</h3>
            <span className="px-2.5 py-0.5 bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 text-[10px] font-mono font-bold uppercase">
              {sub?.status || "Active"}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono text-[#94A3B8]">Active Storage Tier</span>
            <p className="text-2xl font-serif font-bold text-[#F59E0B]">{user.planTier || sub?.planTier || "Free Tier"}</p>
            <p className="text-xs text-[#CBD5E1]">
              Billing Cycle: <strong className="text-[#F1F5F9] capitalize">{sub?.billingCycle || "Monthly"}</strong>
            </p>
          </div>

          <div className="p-3 bg-[#0F172A] border border-[#334155] text-xs space-y-1">
            <div className="flex justify-between text-[#94A3B8]">
              <span>Next Renewal Date:</span>
              <span className="text-[#F1F5F9] font-mono font-bold">{sub?.nextBillingDate ? new Date(sub.nextBillingDate).toLocaleDateString() : "Lifetime Free"}</span>
            </div>
            <div className="flex justify-between text-[#94A3B8]">
              <span>Payment Method:</span>
              <span className="text-[#F1F5F9] font-mono">{sub?.paymentMethod || "Free"}</span>
            </div>
          </div>

          {/* Auto Renewal Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-bold text-[#F1F5F9]">Auto Renewal</p>
              <p className="text-[10px] text-[#64748B]">Automatically renew storage allocation upon expiry</p>
            </div>
            <button
              onClick={handleToggleAutoRenew}
              disabled={toggling}
              className="p-1 cursor-pointer transition-transform hover:scale-105"
            >
              {autoRenew ? (
                <ToggleRight className="w-8 h-8 text-[#10B981]" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-[#64748B]" />
              )}
            </button>
          </div>
        </div>

        {/* Storage Meter Breakdown */}
        <div className="p-6 bg-[#1E293B] border border-[#334155] space-y-4">
          <div className="flex justify-between items-center border-b border-[#334155] pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9] flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#F59E0B]" />
              <span>Storage Quota Breakdown</span>
            </h3>
            <span className="text-xs font-mono text-[#F59E0B] font-bold">{storageUsed} GB / {storageLimit} GB</span>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-[#94A3B8]">
              <span>Storage Used: {storageUsed} GB</span>
              <span>Storage Remaining: {remaining} GB</span>
            </div>
            <div className="w-full h-3 bg-[#0F172A] border border-[#334155] rounded-none overflow-hidden">
              <div 
                className="h-full bg-[#F59E0B] transition-all duration-700" 
                style={{ width: `${Math.min(100, Math.round((storageUsed / storageLimit) * 100))}%` }}
              ></div>
            </div>
          </div>

          {/* Supported Payments Card */}
          <div className="pt-4 border-t border-[#334155] space-y-2">
            <span className="text-[10px] font-mono text-[#64748B] uppercase font-bold">Supported Payment Gateways:</span>
            <div className="flex flex-wrap gap-2">
              {["UPI (GPay / PhonePe)", "Credit Card", "Debit Card", "Net Banking", "Wallets (Paytm / Mobikwik)"].map((method, idx) => (
                <span key={idx} className="px-2.5 py-1 bg-[#0F172A] border border-[#334155] text-[10px] font-mono text-[#CBD5E1]">
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Invoices & Payment History Table */}
      <div className="p-6 bg-[#1E293B] border border-[#334155] space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#F1F5F9] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#F59E0B]" />
          <span>Payment History &amp; Downloadable Invoices ({invoices.length})</span>
        </h3>

        {invoices.length === 0 ? (
          <div className="p-8 text-center bg-[#0F172A] border border-[#334155] text-xs text-[#64748B]">
            No previous billing invoices recorded. Free Tier active.
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div key={inv.id} className="p-4 bg-[#0F172A] border border-[#334155] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-mono font-bold text-[#F59E0B]">{inv.invoiceNumber}</span>
                  <h4 className="text-sm font-bold text-[#F1F5F9] mt-0.5">{inv.planName}</h4>
                  <p className="text-[10px] text-[#64748B]">Date: {new Date(inv.date).toLocaleDateString()} • Method: {inv.paymentMethod}</p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right font-mono">
                    <p className="font-bold text-[#F1F5F9] text-sm">₹{inv.totalAmount.toLocaleString()}</p>
                    <span className="text-[9px] text-[#10B981] uppercase font-bold">{inv.status}</span>
                  </div>

                  <button
                    onClick={() => alert(`Downloading Official Tax Invoice ${inv.invoiceNumber}...`)}
                    className="px-3 py-1.5 bg-[#1E293B] hover:bg-[#334155] border border-[#475569] text-[#F1F5F9] text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
