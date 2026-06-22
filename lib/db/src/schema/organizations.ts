// =============================================================================
// Vitalé — D0 Organizations & Membership (Phase 2)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D0 + VITALE_IMPLEMENTATION_SPEC Part 2.
// The organization is the ownership boundary (single-tenant; never tenant_id). One org per
// coach, permanent (UNIQUE owner_coach_id). Authority is RELATIONAL: capability rows in
// organization_member_permissions, never a JSONB blob (arch §2).
//
// Logical Drizzle models only. RLS, owner-sync / razorpay-guard / permission-audit /
// member-removal-cascade triggers, and the partial-unique indexes' predicates are applied in
// the raw post-table companion. partial-unique indexes are declared here too so `generate`
// emits them; the companion only adds what Drizzle can't express (RLS/REVOKE/triggers).
// =============================================================================
import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import { assets } from "./assets";
import {
  coachCapability, invitationStatus, kycStatus, memberRole, memberStatus, orgStatus,
} from "./enums";
import { users } from "./identity";

// coach_organizations — the business / billing / ownership boundary. [C]
export const coachOrganizations = pgTable(
  "coach_organizations",
  {
    id: pkV7(),
    ownerCoachId: uuid("owner_coach_id").notNull().references(() => users.id),
    businessName: text("business_name").notNull(),
    slug: text("slug").notNull(),
    status: orgStatus("status").notNull().default("active"),
    ...timestamps,
    // No subscription_id (org↔subscription cycle removed; link lives on coach_subscriptions).
  },
  (t) => [
    uniqueIndex("coach_organizations_owner_key").on(t.ownerCoachId), // one org per coach, permanent
    uniqueIndex("coach_organizations_slug_key").on(t.slug),
  ],
);

// organization_members — owner coach + staff. [C]
export const organizationMembers = pgTable(
  "organization_members",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    memberRole: memberRole("member_role").notNull(), // excludes 'coach' (enum has no such value)
    status: memberStatus("status").notNull().default("invited"),
    invitedBy: uuid("invited_by").references(() => users.id),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    settings: jsonb("settings").notNull().default(sql`'{}'`), // non-security UI prefs ONLY
    ...timestamps,
  },
  (t) => [
    // one live membership per (org,user); one owner_coach row per org
    uniqueIndex("organization_members_live_key").on(t.organizationId, t.userId).where(sql`${t.status} <> 'removed'`),
    uniqueIndex("organization_members_owner_key").on(t.organizationId).where(sql`${t.memberRole} = 'owner_coach'`),
    index("organization_members_user_idx").on(t.userId),
  ],
);

// organization_member_permissions — relational capability grants (no JSONB blobs).
// owner_coach holds ALL caps implicitly (no rows); staff hold an explicit owner-delegated
// subset. RLS forbids a member writing their OWN rows (no self-escalation).
export const organizationMemberPermissions = pgTable(
  "organization_member_permissions",
  {
    id: pkV7(),
    memberId: uuid("member_id").notNull().references(() => organizationMembers.id),
    capability: coachCapability("capability").notNull(),
    grantedBy: uuid("granted_by").references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("org_member_permissions_key").on(t.memberId, t.capability)],
);

// organization_profiles — 1:1 business identity (public + financial). [A]
export const organizationProfiles = pgTable(
  "organization_profiles",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    legalName: text("legal_name"),
    logoAssetId: uuid("logo_asset_id").references(() => assets.id), // typed FK (D15 assets)
    description: text("description"),
    websiteUrl: text("website_url"),
    socialLinks: jsonb("social_links"),
    gstin: text("gstin"),
    businessAddress: jsonb("business_address"),
    kycStatus: kycStatus("kyc_status").notNull().default("pending"),
    // set non-null ONLY after kyc_status='verified' (tg_guard_razorpay_account, raw companion)
    razorpayLinkedAccountId: text("razorpay_linked_account_id"),
    panEncrypted: text("pan_encrypted"), // app-layer ciphertext — raw value NEVER plaintext
    bankDetailsEncrypted: text("bank_details_encrypted"), // app-layer ciphertext
    ...timestamps,
  },
  (t) => [uniqueIndex("organization_profiles_org_key").on(t.organizationId)],
);

// invitations — staff onboarding before a users row exists. [C]
export const invitations = pgTable(
  "invitations",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    email: text("email").notNull(),
    invitedRole: memberRole("invited_role").notNull(), // no 'coach'
    token: text("token").notNull(),
    status: invitationStatus("status").notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedUserId: uuid("accepted_user_id").references(() => users.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("invitations_token_key").on(t.token),
    index("invitations_org_status_idx").on(t.organizationId, t.status),
    index("invitations_email_idx").on(t.email),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertCoachOrganizationSchema = createInsertSchema(coachOrganizations);
export const selectCoachOrganizationSchema = createSelectSchema(coachOrganizations);
export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers);
export const selectOrganizationMemberSchema = createSelectSchema(organizationMembers);
export const insertOrganizationMemberPermissionSchema = createInsertSchema(organizationMemberPermissions);
export const selectOrganizationMemberPermissionSchema = createSelectSchema(organizationMemberPermissions);
export const insertOrganizationProfileSchema = createInsertSchema(organizationProfiles);
export const selectOrganizationProfileSchema = createSelectSchema(organizationProfiles);
export const insertInvitationSchema = createInsertSchema(invitations);
export const selectInvitationSchema = createSelectSchema(invitations);
