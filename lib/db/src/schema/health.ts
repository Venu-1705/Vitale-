// =============================================================================
// Vitalé — D5 Health Data (Phase 3) — catalog half
// Ground truth: VITALE_DB_ARCHITECTURE §4 D5 (lines 350-363) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D5 (metric_definitions line 344-345) + Part 6 Phase 3 order (line 1108:
// assets → metric_definitions (+pg_trgm) → health_observations [raw partitioned] → ...).
//
// The D5 redesign is "catalog + observations": a metric is a ROW in metric_definitions, not a
// migration; every reading is one scalar row in health_observations (kills the old
// health_logs value_secondary overloading). This module owns ONLY the catalog half —
// metric_definitions — because it is PK-V7, non-partitioned, and PostgREST-exposed (a
// low-sensitivity public-read catalog), so Drizzle can express it fully.
//
// NOT here (authored in raw post-SQL, because Drizzle cannot express PARTITION BY RANGE and
// they FK into this catalog): health_observations [A, PARTITIONED monthly on measured_date_ist,
// REVOKE-API, reached only via rpc_read_health_observations]. Its parent table, monthly
// partitions, REVOKE/RLS-FORCE policies (owner OR can_read_health(subject) OR
// admin_has_support_access; INSERT owner OR coach with view_client_health+active grant), the
// tg_set_measured_date_ist IST setter, and the read RPC live in a later post companion.
//
// For metric_definitions itself, the GIN pg_trgm(display_name) index and RLS (ENABLE — public
// read, admins write) + tg_touch_updated_at live in the raw companion
// (migrations/post/0103_health_catalog_rls.sql) — arch §9: trgm/RLS/triggers are raw-owned.
// =============================================================================
import { boolean, index, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { metricCategory, metricValueType } from "./enums";

// metric_definitions — the metric catalog; drives validation, units & international
// conversions. Adding a metric = inserting a row (admin-only), never a migration. [public read]
export const metricDefinitions = pgTable(
  "metric_definitions",
  {
    id: pkV7(),
    code: text("code").notNull(), // stable machine key, e.g. 'blood_pressure_systolic'
    displayName: text("display_name").notNull(), // human label; GIN pg_trgm index in raw companion
    category: metricCategory("category").notNull(),
    valueType: metricValueType("value_type").notNull(), // numeric | integer | boolean | enum
    canonicalUnit: text("canonical_unit"), // nullable: boolean/enum metrics are unitless
    unitConversions: jsonb("unit_conversions"), // nullable: factor map to/from canonical_unit (international)
    compoundGroup: text("compound_group"), // nullable: links members of a compound reading (e.g. BP systolic/diastolic)
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("metric_definitions_code_key").on(t.code),
    index("metric_definitions_category_idx").on(t.category),
    // GIN pg_trgm on display_name → raw companion (arch §9: trgm indexes live in raw migrations).
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertMetricDefinitionSchema = createInsertSchema(metricDefinitions);
export const selectMetricDefinitionSchema = createSelectSchema(metricDefinitions);
