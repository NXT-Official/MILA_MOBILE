/**
 * COPIED VERBATIM from the web project's `src/constants/subscriptions.ts`
 * (Appendix A). One line, and it decides whether a paying member keeps access.
 *
 * `past_due` is in force **on purpose**: a failed renewal enters dunning and
 * Paddle retries for days. Locking a member out the moment a card bounces would
 * take away something she has paid for, over a payment that usually succeeds on
 * the retry. Removing it here would do exactly that.
 */
export const IN_FORCE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"];
