/**
 * Release switches.
 *
 * MONETIZATION_ENABLED=false ships LifeBook as fully free: paid-plan,
 * billing, and upgrade UI is hidden app-wide. Flip to true once real
 * payments (e.g. Stripe) are wired up — until then "upgrades" would
 * only flip a field in the database.
 */
export const MONETIZATION_ENABLED = false;
