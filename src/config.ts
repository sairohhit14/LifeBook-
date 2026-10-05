/**
 * Release switches.
 *
 * MONETIZATION_ENABLED=true shows the Storage Plans page, sidebar entry,
 * and upgrade buttons. ponytail: selecting a plan only updates the
 * subscription tier in the database — no real payment is collected until
 * a provider (e.g. Stripe/Razorpay) is wired into the upgrade endpoint.
 */
export const MONETIZATION_ENABLED = true;
