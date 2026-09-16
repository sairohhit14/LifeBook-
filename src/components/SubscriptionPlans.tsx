import React, { useState } from "react";
import { 
  Check, Sparkles, ShieldCheck, HardDrive, Users, Building2, 
  Crown, ArrowRight, Zap, CreditCard, QrCode, Smartphone, X, Lock
} from "lucide-react";
import { api } from "../api";
import { User } from "../types";

interface SubscriptionPlansProps {
  user: User;
  onPlanSelected: () => void;
}

export default function SubscriptionPlans({ 
  user, 
  onPlanSelected
}: SubscriptionPlansProps) {
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("UPI");
  const [upiId, setUpiId] = useState("user@okaxis");
  const [cardNumber, setCardNumber] = useState("4111 2222 3333 4444");
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const individualPlans = [
    {
      id: "ind_monthly",
      badge: "🥉 Individual Monthly",
      name: "Individual Monthly",
      priceDisplay: "₹15",
      period: "/ Month",
      rawPrice: 15,
      storage: "15 GB Extra Storage",
      popular: false,
      buttonText: "Upgrade Now",
      features: [
        "15 GB Extra Storage",
        "Secure Cloud Backup",
        "Multi-device Sync",
        "Lifetime Access to AI Features",
        "Secure Memory Storage"
      ]
    },
    {
      id: "ind_6month",
      badge: "🥈 Individual 6-Month",
      name: "Individual 6-Month Plan",
      priceDisplay: "₹80",
      period: "/ 6 Months",
      rawPrice: 80,
      storage: "15 GB Extra Storage",
      popular: false,
      buttonText: "Choose Plan",
      features: [
        "15 GB Extra Storage",
        "Discounted Pricing (Save ~11%)",
        "Secure Backup",
        "Multi-device Sync",
        "Lifetime Access to AI Features"
      ]
    },
    {
      id: "ind_yearly",
      badge: "🥇 Individual Yearly Plan",
      name: "Individual Yearly Plan",
      priceDisplay: "₹500",
      period: "/ Year",
      rawPrice: 500,
      storage: "30 GB Extra Storage",
      popular: true,
      buttonText: "Most Popular",
      features: [
        "30 GB Extra Storage",
        "Best Value (Save Big)",
        "Secure Cloud Storage",
        "Fast Backup & Sync",
        "Premium Badge Included",
        "Lifetime Access to AI Features"
      ]
    }
  ];

  const handleCheckout = async (plan: any) => {
    setSelectedPlanForPayment(plan);
  };

  const handleConfirmPayment = async () => {
    if (!selectedPlanForPayment) return;
    setProcessing(true);
    try {
      await api.upgradeSubscription(selectedPlanForPayment.name, paymentMethod);
      setPaymentSuccess(true);
      setTimeout(() => {
        setProcessing(false);
        setPaymentSuccess(false);
        setSelectedPlanForPayment(null);
        onPlanSelected();
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Payment process failed");
      setProcessing(false);
    }
  };

  return (
    <div id="subscription-plans-page" className="space-y-12 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] text-xs font-mono font-bold uppercase tracking-widest">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Flexible SaaS Storage Tiers</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-serif italic text-[#F1F5F9] leading-tight" style={{ fontFamily: "Georgia, serif" }}>
          Simple, Transparent Cloud Storage Plans
        </h1>
        <p className="text-sm md:text-base text-[#94A3B8] leading-relaxed">
          AI-powered memory preservation is <strong className="text-[#F59E0B]">100% FREE for everyone</strong>. Upgrade only when you require additional cloud storage for high-resolution photos, 4K video testimonies, and encrypted documents.
        </p>
      </div>

      {/* Storage Plans Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#334155] pb-3">
          <h2 className="text-lg font-bold uppercase tracking-wider text-[#F1F5F9] flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#F59E0B]" />
            <span>Individual Cloud Storage Plans</span>
          </h2>
          <span className="text-xs text-[#94A3B8] font-mono">Cancel or change anytime</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {individualPlans.map((plan) => {
            const isCurrent = user.planTier === plan.name;
            return (
              <div 
                key={plan.id}
                className={`relative bg-[#1E293B] border p-6 flex flex-col justify-between transition-all duration-300 ${
                  plan.popular 
                    ? "border-[#F59E0B] shadow-2xl shadow-[#F59E0B]/10 ring-1 ring-[#F59E0B]" 
                    : "border-[#334155] hover:border-[#475569]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#F59E0B] text-[#0F172A] text-[10px] font-bold uppercase tracking-widest shadow-md flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Most Popular
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-[#94A3B8]">{plan.badge}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-serif font-bold text-[#F1F5F9]">{plan.priceDisplay}</span>
                      <span className="text-xs text-[#94A3B8] font-mono">{plan.period}</span>
                    </div>
                    <div className="inline-block px-2.5 py-1 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 text-xs font-mono font-bold">
                      {plan.storage}
                    </div>
                  </div>

                  <ul className="space-y-3 pt-4 border-t border-[#334155]">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#CBD5E1]">
                        <Check className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-[#334155]">
                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={isCurrent}
                    className={`w-full py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isCurrent
                        ? "bg-[#334155] text-[#94A3B8] cursor-not-allowed"
                        : plan.popular
                        ? "bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] shadow-lg"
                        : "bg-[#0F172A] hover:bg-[#334155] text-[#F1F5F9] border border-[#475569]"
                    }`}
                  >
                    <span>{isCurrent ? "Active Plan" : plan.buttonText}</span>
                    {!isCurrent && <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Payment Gateway Modal */}
      {selectedPlanForPayment && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#1E293B] border border-[#334155] rounded-none max-w-lg w-full p-6 text-[#F1F5F9] shadow-2xl relative space-y-6">
            
            <button 
              onClick={() => setSelectedPlanForPayment(null)}
              className="absolute top-4 right-4 text-[#64748B] hover:text-[#F1F5F9] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#334155] pb-4">
              <div className="p-3 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/30">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold uppercase tracking-wider text-[#F1F5F9]">Secure Payment Gateway</h3>
                <p className="text-xs text-[#94A3B8]">256-bit Encrypted Checkout</p>
              </div>
            </div>

            {/* Plan Summary */}
            <div className="p-4 bg-[#0F172A] border border-[#334155] flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-[#F1F5F9]">{selectedPlanForPayment.name}</p>
                <p className="text-xs text-[#F59E0B] font-mono">{selectedPlanForPayment.storage}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-serif font-bold text-[#F1F5F9]">{selectedPlanForPayment.priceDisplay}</span>
                <p className="text-[10px] text-[#64748B]">{selectedPlanForPayment.period}</p>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="text-xs font-mono text-[#94A3B8] uppercase font-bold">Select Payment Option:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "UPI", label: "UPI Instant", icon: <QrCode className="w-4 h-4 text-[#10B981]" /> },
                  { id: "Credit Card", label: "Credit / Debit Card", icon: <CreditCard className="w-4 h-4 text-[#3B82F6]" /> },
                  { id: "Net Banking", label: "Net Banking / Wallet", icon: <Smartphone className="w-4 h-4 text-[#8B5CF6]" /> }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-3 text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === m.id 
                        ? "bg-[#F59E0B]/10 border-[#F59E0B] text-[#F59E0B]" 
                        : "bg-[#0F172A] border-[#334155] text-[#94A3B8] hover:text-[#F1F5F9]"
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Method Inputs */}
            {paymentMethod === "UPI" && (
              <div className="space-y-2">
                <label className="text-xs font-mono text-[#94A3B8]">Enter VPA / UPI ID</label>
                <input 
                  type="text" 
                  value={upiId} 
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] text-xs text-[#F1F5F9] font-mono focus:border-[#F59E0B] outline-none"
                  placeholder="e.g. mobile@upi"
                />
              </div>
            )}

            {paymentMethod === "Credit Card" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-[#94A3B8]">Card Number</label>
                  <input 
                    type="text" 
                    value={cardNumber} 
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] text-xs text-[#F1F5F9] font-mono focus:border-[#F59E0B] outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-mono text-[#94A3B8]">Expiry Date</label>
                    <input type="text" defaultValue="12/28" className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] text-xs text-[#F1F5F9] font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[#94A3B8]">CVV</label>
                    <input type="password" defaultValue="888" className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] text-xs text-[#F1F5F9] font-mono outline-none" />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                onClick={handleConfirmPayment}
                disabled={processing}
                className="w-full py-3 bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xl flex items-center justify-center gap-2"
              >
                {processing ? (
                  <span>Processing Payment...</span>
                ) : paymentSuccess ? (
                  <span>Payment Complete! 🎉</span>
                ) : (
                  <span>Pay {selectedPlanForPayment.priceDisplay} &amp; Upgrade Storage</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
