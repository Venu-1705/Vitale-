// =============================================================================
// Vitalé — D15 Assets (Phase 3, "build early")
// Ground truth: VITALE_DB_ARCHITECTURE §4 D15 (lines 562-567) + VITALE_IMPLEMENTATION_SPEC
// Part 2 D15 + Part 6 Phase 3 (assets is the typed-FK target for many later tables, so it
// is created first in Phase 3).
//
// The PHI media gateway: one row per uploaded file. Object storage is NOT under Postgres
// RLS — the API mints a signed URL only AFTER an RLS/permission check on the OWNING row,
// and (when is_phi) writes an audit row. There is NO polymorphic asset_links table: owning
// rows hold typed *_asset_id FKs (users.avatar_asset_id, organization_profiles.logo_asset_id,
// professional_profiles.photo_asset_id, programs.cover_asset_id, lab_reports.report_asset_id);
// messages use message_attachments. This module adds the three D0/D1 typed FKs that Phase 2
// left deferred ("FK → assets added in Phase 3").
//
// Logical Drizzle model only. RLS (ENABLE + FORCE — a row is reachable via the owning row's
// policy + is_phi, never ambiently by admins), the `(subject_user_id) WHERE is_phi` partial
// index, the touch trigger, and the retention sweep live in the raw post-table companion
// (migrations/post/0102_assets_rls.sql).
// =============================================================================
import { sql } from "drizzle-orm";
import { type AnyPgColumn, bigint, boolean, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { assetStatus, assetType } from "./enums";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";

// assets — every uploaded file; signed-URL gateway (object storage outside RLS). [A → anonymize]
export const assets = pgTable(
  "assets",
  {
    id: pkV7(),
    // owner org; NULL for user-owned (avatars, user health uploads). [arch §4 D15]
    organizationId: uuid("organization_id").references((): AnyPgColumn => coachOrganizations.id),
    uploadedByUserId: uuid("uploaded_by_user_id").notNull().references((): AnyPgColumn => users.id),
    subjectUserId: uuid("subject_user_id").references((): AnyPgColumn => users.id), // NULL unless this file is about a person (PHI subject)
    assetType: assetType("asset_type").notNull(),
    isPhi: boolean("is_phi").notNull().default(false),
    storageBucket: text("storage_bucket").notNull(),
    storagePath: text("storage_path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    checksum: text("checksum").notNull(),
    retentionUntil: date("retention_until"), // NULL = no scheduled purge; drives the retention sweep job
    status: assetStatus("status").notNull().default("active"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft-delete marker (object purged separately)
    ...timestamps,
  },
  (t) => [
    // PHI assets indexed by subject (audit/erasure sweeps); arch §4 D15 indexes.
    index("assets_subject_phi_idx").on(t.subjectUserId).where(sql`${t.isPhi}`),
    index("assets_org_idx").on(t.organizationId),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertAssetSchema = createInsertSchema(assets);
export const selectAssetSchema = createSelectSchema(assets);
