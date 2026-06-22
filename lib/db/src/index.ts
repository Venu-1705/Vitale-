import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// -----------------------------------------------------------------------------
// LEGACY single-pool handle.
// Predates the dual-pool / identity-context layer. Connects with the DATABASE_URL
// login role and does NOT establish a per-request identity, so it does not exercise
// RLS the way real users will. Retained ONLY so the pre-existing routes
// (labs/cart/shop/orders) keep working until they are migrated, per the
// ARCHITECTURE_FIRST_ROADMAP, onto withUserContext.
//
// DO NOT use `pool` / `db` for new code. New endpoints MUST go through
// withUserContext / withServiceContext below.
// -----------------------------------------------------------------------------
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";

// -----------------------------------------------------------------------------
// Runtime / identity-context layer (Phase 0). The sanctioned database-access API.
// -----------------------------------------------------------------------------
export * from "./runtime/pools";
export * from "./runtime/context";
export * from "./runtime/errors";
export * from "./runtime/ids";
