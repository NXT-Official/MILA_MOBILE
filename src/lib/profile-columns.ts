import { PROFILE_WRITABLE_COLUMNS } from "@/types/models";

/**
 * The last check before a profile write leaves the device.
 *
 * §7 grants a member UPDATE on a fixed column list; `suspended` and
 * `paddle_customer_id` are not on it, and sending either fails the grant — it
 * does not silently no-op. `StyleProfileUpdate` already makes them
 * unrepresentable, but TypeScript only rejects excess keys on an object
 * *literal*: a spread of a wider object compiles fine and would be sent.
 *
 * The column grant on the server is the real boundary — this is not a security
 * control, it is a better error. Failing here names the offending column
 * instead of surfacing an opaque Postgres permission error to a member
 * mid-onboarding.
 */
export function assertWritableColumns(payload: object): void {
  const permitted = new Set<string>(PROFILE_WRITABLE_COLUMNS);
  const forbidden = Object.keys(payload).filter((key) => !permitted.has(key));
  if (forbidden.length > 0) {
    throw new Error(`Refusing to write non-permitted profile column(s): ${forbidden.join(", ")}`);
  }
}
