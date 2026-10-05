import React, { useState } from "react";
import {
  Check, Sparkles, ShieldCheck, HardDrive,
  Crown, ArrowRight, X, Lock
} from "lucide-react";
import { api } from "../api";
import { User } from "../types";

interface SubscriptionPlansProps {
  user: User;
  onPlanSelected: () => void;
}

// Razorpay Checkout is loaded lazily from their CDN on first use.
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function SubscriptionPlans({
  user,
  onPlanSelected
}: SubscriptionPlansProps) {
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<any | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const individualPlans = [
    {
      id: "ind_basic",
      badge: "🥉 Basic Plan",
      name: "Basic Plan",
      priceDisplay: "₹49",
      period: "/ Month",
      rawPrice: 49,
      storage: "15 GB Extra Cloud Storage",
      popular: false,
      buttonText: "Choose Basic",
      features: [
        "15 GB Extra Cloud Storage",
        "Secure Cloud Backup",
        "Multi-device Access"
      ]
    },
    {
      id: "ind_silver",
      badge: "🥈 Silver Plan",
      name: "Silver Plan",
      priceDisplay: "₹129",
      period: "/ Month",
      rawPrice: 129,
      storage: "50 GB Extra Cloud Storage",
      popular: false,
      buttonText: "Choose Silver",
      features: [
        "50 GB Extra Cloud Storage",
        "Cost Savings benefit",
        "Secure Backup & Sync"
      ]
    },
    {
      id: "ind_yearly",
      badge: "🥇 Yearly Plan",
      name: "Yearly Plan",
      priceDisplay: "₹499",
      period: "/ Year",
      rawPrice: 499,
      storage: "30 GB Extra Cloud",
      popular: true,
      buttonText: "Most Preferred",
      features: [
        "30 GB Extra Cloud",
        "Most Preferred",
        "Fast Cloud Sync",
        "Long-Term Safety"
      ]
    }
  ];

  const handleCheckout = async (plan: any) => {
    setSelectedPlanForPayment(plan);
  };

  // Real Razorpay flow: server creates the order → Razorpay Checkout collects
  // the payment (UPI/cards/netbanking) → server verifies the HMAC signature
  // before the upgrade is applied.
  const handleConfirmPayment = async () => {
    if (!selectedPlanForPayment || processing) return;
    setProcessing(true);
    try {
      const ok = await loadRazorpayScript();
      if (!ok) throw new Error("Could not load the payment gateway. Check your connection and retry.");

      const order = await api.createSubscriptionOrder(selectedPlanForPayment.name);
      const RazorpayCtor = (window as any).Razorpay;
      const rzp = new RazorpayCtor({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "LifeBook",
        description: `${order.planName} — ${order.planPeriod}ly cloud storage`,
        prefill: order.prefill || {},
        theme: { color: "#315C4A" },
        handler: async (response: any) => {
          try {
            await api.verifySubscriptionPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planName: order.planName,
            });
            setPaymentSuccess(true);
            setTimeout(() => {
              setProcessing(false);
              setPaymentSuccess(false);
              setSelectedPlanForPayment(null);
              onPlanSelected();
            }, 1500);
          } catch (err: any) {
            alert(err.message || "Payment captured but verification failed. Contact support with your payment ID: " + response.razorpay_payment_id);
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setProcessing(false),
        },
      });
      rzp.open();
    } catch (err: any) {
      alert(err.message || "We couldn't start the checkout. Please try again.");
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
          AI-powered memory preservation is <strong className="text-[#315C4A]">100% FREE for everyone</strong>, and every account starts with <strong className="text-[#315C4A]">1 GB</strong> of free cloud storage. Upgrade only when you require additional cloud storage for high-resolution photos, 4K video testimonies, and encrypted documents.
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

            {/* UPI, cards, netbanking and wallets are collected by Razorpay's
                PCI-DSS-compliant checkout — card details never touch this app. */}
            <p className="text-xs text-[#454A46] leading-relaxed flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-[#4E7A64] flex-shrink-0 mt-0.5" />
              <span>UPI, cards, net banking and wallets are handled securely by <strong>Razorpay Checkout</strong>. LifeBook never sees your payment details.</span>
            </p>

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
