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
      alert(err.message || "We couldn't process that payment. Please check your details and try again.");
      setProcessing(false);
    }
  };

  return (
    <div id="subscription-plans-page" className="space-y-12 animate-fade-in pb-12">
      
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#315C4A]/10 border border-[#315C4A]/30 text-[#315C4A] text-xs font-mono font-medium uppercase tracking-[0.15em]">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Flexible SaaS Storage Tiers</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-serif italic text-[#1E2521] leading-tight">
          Simple, Transparent Cloud Storage Plans
        </h1>
        <p className="text-sm md:text-base text-[#454A46] leading-relaxed">
          AI-powered memory preservation is <strong className="text-[#315C4A]">100% FREE for everyone</strong>. Upgrade only when you require additional cloud storage for high-resolution photos, 4K video testimonies, and encrypted documents.
        </p>
      </div>

      {/* Storage Plans Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-[#E5E5E1] pb-3">
          <h2 className="text-lg font-medium uppercase tracking-[0.12em] text-[#1E2521] flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#315C4A]" />
            <span>Individual Cloud Storage Plans</span>
          </h2>
          <span className="text-xs text-[#454A46] font-mono">Cancel or change anytime</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {individualPlans.map((plan) => {
            const isCurrent = user.planTier === plan.name;
            return (
              <div 
                key={plan.id}
                className={`relative bg-[#F1EFEC] border p-6 flex flex-col justify-between transition-all duration-300 ${
                  plan.popular 
                    ? "border-[#315C4A] shadow-2xl shadow-[#315C4A]/10 ring-1 ring-[#315C4A]" 
                    : "border-[#E5E5E1] hover:border-[#475569]"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#315C4A] text-[#FCFBF7] text-[10px] font-medium uppercase tracking-[0.15em] shadow-md flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Most Popular
                  </div>
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-[#454A46]">{plan.badge}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-serif font-bold text-[#1E2521]">{plan.priceDisplay}</span>
                      <span className="text-xs text-[#454A46] font-mono">{plan.period}</span>
                    </div>
                    <div className="inline-block px-2.5 py-1 bg-[#315C4A]/10 text-[#315C4A] border border-[#315C4A]/20 text-xs font-mono font-bold">
                      {plan.storage}
                    </div>
                  </div>

                  <ul className="space-y-3 pt-4 border-t border-[#E5E5E1]">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-[#454A46]">
                        <Check className="w-4 h-4 text-[#4E7A64] flex-shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-[#E5E5E1]">
                  <button
                    onClick={() => handleCheckout(plan)}
                    disabled={isCurrent}
                    className={`w-full py-3 text-xs font-medium uppercase tracking-[0.12em] transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isCurrent
                        ? "bg-[#E5E5E1] text-[#454A46] cursor-not-allowed"
                        : plan.popular
                        ? "bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] shadow-lg"
                        : "bg-[#FCFBF7] hover:bg-[#E5E5E1] text-[#1E2521] border border-[#475569]"
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
          <div className="bg-[#F1EFEC] border border-[#E5E5E1] rounded-[16px] max-w-lg w-full p-6 text-[#1E2521] shadow-2xl relative space-y-6">
            
            <button 
              onClick={() => setSelectedPlanForPayment(null)}
              className="absolute top-4 right-4 text-[#8A8F8B] hover:text-[#1E2521] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#E5E5E1] pb-4">
              <div className="p-3 bg-[#315C4A]/10 text-[#315C4A] border border-[#315C4A]/30">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-medium uppercase tracking-[0.12em] text-[#1E2521]">Secure Payment Gateway</h3>
                <p className="text-xs text-[#454A46]">256-bit Encrypted Checkout</p>
              </div>
            </div>

            {/* Plan Summary */}
            <div className="p-4 bg-[#FCFBF7] border border-[#E5E5E1] flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold text-[#1E2521]">{selectedPlanForPayment.name}</p>
                <p className="text-xs text-[#315C4A] font-mono">{selectedPlanForPayment.storage}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-serif font-bold text-[#1E2521]">{selectedPlanForPayment.priceDisplay}</span>
                <p className="text-[10px] text-[#8A8F8B]">{selectedPlanForPayment.period}</p>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="text-xs font-mono text-[#454A46] uppercase font-medium">Select Payment Option:</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "UPI", label: "UPI Instant", icon: <QrCode className="w-4 h-4 text-[#4E7A64]" /> },
                  { id: "Credit Card", label: "Credit / Debit Card", icon: <CreditCard className="w-4 h-4 text-[#315C4A]" /> },
                  { id: "Net Banking", label: "Net Banking / Wallet", icon: <Smartphone className="w-4 h-4 text-[#AAA0C9]" /> }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`p-3 text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === m.id 
                        ? "bg-[#315C4A]/10 border-[#315C4A] text-[#315C4A]" 
                        : "bg-[#FCFBF7] border-[#E5E5E1] text-[#454A46] hover:text-[#1E2521]"
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
                <label className="text-xs font-mono text-[#454A46]">Enter VPA / UPI ID</label>
                <input 
                  type="text" 
                  value={upiId} 
                  onChange={(e) => setUpiId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FCFBF7] border border-[#E5E5E1] text-xs text-[#1E2521] font-mono focus:border-[#315C4A] outline-none"
                  placeholder="e.g. mobile@upi"
                />
              </div>
            )}

            {paymentMethod === "Credit Card" && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-[#454A46]">Card Number</label>
                  <input 
                    type="text" 
                    value={cardNumber} 
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FCFBF7] border border-[#E5E5E1] text-xs text-[#1E2521] font-mono focus:border-[#315C4A] outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-mono text-[#454A46]">Expiry Date</label>
                    <input type="text" defaultValue="12/28" className="w-full px-3 py-2 bg-[#FCFBF7] border border-[#E5E5E1] text-xs text-[#1E2521] font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[#454A46]">CVV</label>
                    <input type="password" defaultValue="888" className="w-full px-3 py-2 bg-[#FCFBF7] border border-[#E5E5E1] text-xs text-[#1E2521] font-mono outline-none" />
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                onClick={handleConfirmPayment}
                disabled={processing}
                className="w-full py-3 bg-[#315C4A] hover:bg-[#27493A] text-[#FCFBF7] text-xs font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer shadow-xl flex items-center justify-center gap-2"
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
