import { IN_FORCE_SUBSCRIPTION_STATUSES } from "@/constants/subscriptions";

/**
 * What a subscription row means, as one decision.
 *
 * Pure, and separated from every screen, because this is the only place the app
 * comes close to reasoning about entitlement — and it must not. It **reads** the
 * row the Paddle webhook wrote; it never computes access, never predicts a
 * renewal, and never decides affordability. `inForce` here is a rendering
 * concern: what to say and which date to say it about (§9).
 */
export type MembershipRow = {
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
};

export type MembershipState = {
  /** True when the server's status is one of the in-force set. Display only. */
  inForce: boolean;
  /**
   * `cancel_at_period_end` is the whole distinction between "Renews on" and
   * "Ends on". Getting it backwards tells a member who cancelled that she will
   * be charged again, or tells a paying member her access is about to stop.
   */
  headline: "renews" | "ends" | "lapsed" | "none";
  /** ISO date the headline refers to, or null when the row has no period end. */
  date: string | null;
  /** Raw status, for the badge. Never interpreted beyond the fields above. */
  status: string | null;
  /**
   * A renewal that failed and is being retried. Still in force — the member is
   * not locked out mid-dunning — but worth telling her about, because the fix
   * is hers to make.
   */
  paymentFailing: boolean;
};

const NO_MEMBERSHIP: MembershipState = {
  inForce: false,
  headline: "none",
  date: null,
  status: null,
  paymentFailing: false,
};

export function resolveMembership(row: MembershipRow | null | undefined): MembershipState {
  if (!row) return NO_MEMBERSHIP;

  const inForce = IN_FORCE_SUBSCRIPTION_STATUSES.includes(row.status);

  if (!inForce) {
    // Cancelled, paused, or expired. The date is still shown when there is one,
    // because "ended on the 4th" is more useful than "not a member".
    return {
      inForce: false,
      headline: "lapsed",
      date: row.current_period_end,
      status: row.status,
      paymentFailing: false,
    };
  }

  return {
    inForce: true,
    headline: row.cancel_at_period_end ? "ends" : "renews",
    date: row.current_period_end,
    status: row.status,
    paymentFailing: row.status === "past_due",
  };
}

/** A plain date, in the member's own locale. Never a raw ISO string. */
export function formatPeriodDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}
