import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // Versioned table DDL (arch §9: switch push → generate + migrate). Drizzle owns ONLY the
  // table layer; the hand-written numbered SQL in ./migrations carries everything Drizzle
  // can't express (extensions, enums, SECURITY DEFINER helpers, RLS policies, triggers,
  // partition machinery) and is applied in order by `pnpm db:raw`.
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  // Stay out of Supabase-managed schemas (auth, storage, realtime, extensions, partman, cron).
  schemaFilter: ["public"],
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
