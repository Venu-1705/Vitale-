// =============================================================================
// Vitalé — shared schema helpers
// Conventions from VITALE_DB_ARCHITECTURE §2/§9:
//   * Primary keys are app-generated UUIDv7 (time-ordered → index locality). The DB does
//     NOT default them — the application supplies the v7 id on insert. The single exception
//     is `users.id`, which equals the Supabase JWT `sub` (JIT-provisioned by the API via
//     rpc_provision_user; no auth.users, no trigger), still a uuid column with no DB default.
//   * Every mutable [A]/[C] table carries created_at + updated_at (timestamptz). updated_at
//     is maintained by the tg_touch_updated_at trigger (migration 0004), not the app.
// =============================================================================
import { timestamp, uuid } from "drizzle-orm/pg-core";

/** App-generated UUIDv7 primary key column named "id" (no DB default — app supplies v7). */
export const pkV7 = () => uuid("id").primaryKey();

/** Standard audit timestamps. updated_at is touched by tg_touch_updated_at (0004). */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};
