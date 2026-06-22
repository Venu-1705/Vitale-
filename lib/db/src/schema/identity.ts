// =============================================================================
// Vitalé — D1 Identity & Auth (Phase 2)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D1 + VITALE_IMPLEMENTATION_SPEC Part 2 (users
// [A→anonymize], user_profiles [A], professional_profiles [A]).
//
// Logical Drizzle models only. RLS (users/user_profiles = FORCE; professional_profiles =
// public-discovery ON), JIT provisioning (rpc_provision_user, post/0140 — invoked by the
// API on first authenticated request; no auth.users / no trigger), tg_touch_updated_at
// attachments, the partial-unique email index, and the pg_trgm display_name GIN index are
// applied in the raw post-table companion (authored once `generate` emits the CREATE TABLEs).
// =============================================================================
import { sql } from "drizzle-orm";
import {
  boolean, date, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { assets } from "./assets";
import { gender, userRole, userStatus } from "./enums";

// users — PK = the Supabase JWT `sub` (the ONLY non-v7 PK; JIT-provisioned). [A → anonymize]
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // = Supabase JWT `sub` (JIT-provisioned by rpc_provision_user; no DB default)
    phone: text("phone"), // nullable: Supabase email/Google users have no phone. +91 E.164; UNIQUE WHERE NOT NULL (index below)
    email: text("email"), // nullable; UNIQUE WHERE NOT NULL (partial index below)
    fullName: text("full_name"),
    avatarAssetId: uuid("avatar_asset_id").references(() => assets.id), // typed FK (D15 assets)
    roles: userRole("roles").array().notNull().default(sql`'{}'`), // coarse platform flags ONLY
    status: userStatus("status").notNull().default("active"),
    isAnonymized: boolean("is_anonymized").notNull().default(false),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_phone_key").on(t.phone).where(sql`${t.phone} IS NOT NULL`),
    uniqueIndex("users_email_key").on(t.email).where(sql`${t.email} IS NOT NULL`),
  ],
);

// user_profiles — 1:1 consumer profile. [A]
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    dateOfBirth: date("date_of_birth"),
    gender: gender("gender"),
    city: text("city"),
    state: text("state"),
    country: text("country").notNull().default("India"),
    locale: text("locale"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    goals: jsonb("goals"),
    dietaryPreferences: jsonb("dietary_preferences"),
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [uniqueIndex("user_profiles_user_key").on(t.userId)],
);

// professional_profiles — generalized per-person professional identity. [A]
// No organization_id (derived via organization_members); no KYC/financial data.
export const professionalProfiles = pgTable(
  "professional_profiles",
  {
    id: pkV7(),
    userId: uuid("user_id").notNull().references(() => users.id),
    displayName: text("display_name"),
    bio: text("bio"),
    photoAssetId: uuid("photo_asset_id").references(() => assets.id), // typed FK (D15 assets)
    specialties: text("specialties").array(),
    credentials: jsonb("credentials"),
    yearsExperience: integer("years_experience"),
    languages: text("languages").array(),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }),
    ratingCount: integer("rating_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("professional_profiles_user_key").on(t.userId)],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertUserProfileSchema = createInsertSchema(userProfiles);
export const selectUserProfileSchema = createSelectSchema(userProfiles);
export const insertProfessionalProfileSchema = createInsertSchema(professionalProfiles);
export const selectProfessionalProfileSchema = createSelectSchema(professionalProfiles);
