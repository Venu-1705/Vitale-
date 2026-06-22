// =============================================================================
// Vitalé — pg enum objects (typing layer for Drizzle columns)
// These MIRROR the closed-set enums created in raw migration 0002_enums.sql, which is the
// authoritative DDL owner (arch §2: enums for STABLE closed sets; evolving sets are lookup
// TABLES — see badge_types/notification_types/lab_vendors in 0003). Drizzle needs these
// pgEnum objects only to TYPE the columns; the CREATE TYPE statements live in 0002.
//
// ⚠ Keep value lists byte-for-byte in sync with 0002_enums.sql. Blocker-3 note: community
// membership status is a CHECK ('active'|'left'), NOT an enum — intentionally absent here.
//
// ⚠ GENERATE CAVEAT (verified empirically): `drizzle-kit generate` emits a `CREATE TYPE`
// for EVERY exported pgEnum here (72/72 in an isolated run), regardless of whether a table
// column uses it. Since 0002 is the authoritative creator (arch §9 line 714: raw-SQL
// companions own enum DDL), the first full-schema generated migration must NOT re-create
// them over a DB where 0002 already ran (errors with duplicate_object 42710). Resolution at
// first full generate — keep 0002 as the creator and neutralize Drizzle's emission via a
// committed baseline snapshot (preferred) OR by stripping the CREATE TYPE lines from the
// generated migration. Do NOT flip enum ownership to Drizzle. Until then, do not run the
// real `generate` (the schema barrel still carries legacy modules too).
// =============================================================================
import { pgEnum } from "drizzle-orm/pg-core";

// ----- Identity & org --------------------------------------------------------
export const userRole = pgEnum("user_role", ["admin", "coach", "nutritionist", "community_manager", "customer"]);
export const userStatus = pgEnum("user_status", ["active", "suspended", "anonymized"]);
export const gender = pgEnum("gender", ["male", "female", "other", "prefer_not_to_say"]);
export const kycStatus = pgEnum("kyc_status", ["pending", "verified", "rejected"]);
export const orgStatus = pgEnum("org_status", ["active", "suspended", "closed"]);
export const memberRole = pgEnum("member_role", ["owner_coach", "nutritionist", "community_manager"]);
export const memberStatus = pgEnum("member_status", ["invited", "active", "suspended", "removed"]);
export const invitationStatus = pgEnum("invitation_status", ["pending", "accepted", "revoked", "expired"]);
export const coachCapability = pgEnum("coach_capability", [
  "view_client_health", "manage_programs", "manage_diet_charts", "message_clients",
  "moderate_community", "manage_staff", "view_revenue", "manage_lab_recommendations",
  "manage_products", "write_clinical_notes", "manage_care_plans",
]);

// ----- Access control & DPDP -------------------------------------------------
export const grantDataCategory = pgEnum("grant_data_category", ["health_data", "meals", "programs", "lab_results", "community", "orders", "messages", "clinical"]);
export const accessSourceType = pgEnum("access_source_type", ["program_enrollment", "diet_assignment", "lab_review", "care_plan", "collaboration_agreement", "manual_consent"]);
export const grantType = pgEnum("grant_type", ["primary", "collaborating"]);
export const accessLevel = pgEnum("access_level", ["view_only", "full"]);
export const grantStatus = pgEnum("grant_status", ["active", "revoked", "expired"]);
export const consentType = pgEnum("consent_type", ["data_processing", "health_data_sharing", "marketing", "terms", "coach_access", "clinical_care"]);
export const auditActingAs = pgEnum("audit_acting_as", ["owner_coach", "nutritionist", "community_manager", "collaborating_specialist", "admin"]);
// audit_resource_type / audit_action: the final two values of each enum
// ('access_grant','member_permission' / 'grant','revoke') are an authorized
// ARCHITECTURE HARDENING CORRECTION (see migrations/post/0100_audit_enum_hardening.sql
// and VITALE_DB_ARCHITECTURE.md §2). They let the access-control audit triggers
// (tg_audit_grant_change §4.5, tg_audit_permission_change §4.2) record grant /
// member-permission CHANGE events, which the original data-READ-only value set
// could not express. Additive only — no existing value renamed or dropped.
export const auditResourceType = pgEnum("audit_resource_type", ["lab_report", "health_observation", "nutrition_log", "program", "diet_chart", "care_plan", "clinical_note", "message", "asset", "profile", "community", "access_grant", "member_permission"]);
export const auditAction = pgEnum("audit_action", ["view", "export", "update", "download", "grant", "revoke"]);
export const deletionStatus = pgEnum("deletion_status", ["requested", "processing", "completed", "rejected"]);
export const supportReasonCode = pgEnum("support_reason_code", ["support_ticket", "compliance_investigation", "legal_request", "fraud_review"]);
export const supportApprovalMode = pgEnum("support_approval_mode", ["self", "dual", "break_glass"]);
export const supportStatus = pgEnum("support_status", ["requested", "active", "expired", "revoked"]);

// ----- Programs & nutrition --------------------------------------------------
export const programStatus = pgEnum("program_status", ["draft", "published", "archived"]);
export const programVisibility = pgEnum("program_visibility", ["public", "private", "invite_only"]);
export const sessionContentType = pgEnum("session_content_type", ["video", "article", "live", "task"]);
export const enrollmentStatus = pgEnum("enrollment_status", ["active", "completed", "cancelled", "expired"]);
export const mealType = pgEnum("meal_type", ["breakfast", "lunch", "dinner", "snack"]);
export const dietChartStatus = pgEnum("diet_chart_status", ["draft", "active", "archived"]);
export const assignmentStatus = pgEnum("assignment_status", ["active", "paused", "ended"]);
export const nutritionSource = pgEnum("nutrition_source", ["manual", "diet_chart", "recipe"]);
export const foodSource = pgEnum("food_source", ["system", "coach", "user"]);

// ----- Health (catalog + observations) ---------------------------------------
export const metricCategory = pgEnum("metric_category", ["vital", "body_composition", "activity", "sleep", "nutrition_derived", "lab", "wearable"]);
export const metricValueType = pgEnum("metric_value_type", ["numeric", "integer", "boolean", "enum"]);
export const healthObsSource = pgEnum("health_obs_source", ["manual", "wearable", "lab", "coach_entered"]);

// ----- Gamification ----------------------------------------------------------
export const streakType = pgEnum("streak_type", ["meal_logging", "health_logging", "program", "overall"]);
export const leaderboardScope = pgEnum("leaderboard_scope", ["program", "platform"]);
export const leaderboardPeriod = pgEnum("leaderboard_period", ["weekly", "monthly", "all_time"]);

// ----- Community -------------------------------------------------------------
export const postType = pgEnum("post_type", ["text", "image", "recipe", "poll", "announcement"]);
export const postStatus = pgEnum("post_status", ["active", "hidden", "removed"]);
export const flagReason = pgEnum("flag_reason", ["spam", "abuse", "misinformation", "inappropriate", "other"]);
export const flagStatus = pgEnum("flag_status", ["open", "reviewed", "actioned", "dismissed"]);

// ----- Messaging -------------------------------------------------------------
export const conversationType = pgEnum("conversation_type", ["coach_user", "staff_user", "care_team", "community_peer"]);
export const conversationStatus = pgEnum("conversation_status", ["active", "archived"]);

// ----- Clinical coaching -----------------------------------------------------
export const clinicalNoteType = pgEnum("clinical_note_type", ["observation", "assessment", "progress_note", "recommendation", "addendum"]);
export const noteVisibility = pgEnum("note_visibility", ["internal", "shared_with_user"]);
export const clinicalAuthorRole = pgEnum("clinical_author_role", ["owner_coach", "nutritionist", "collaborating_specialist"]);
export const interventionStatus = pgEnum("intervention_status", ["active", "completed", "cancelled"]);
export const outcomeStatus = pgEnum("outcome_status", ["on_track", "achieved", "missed", "abandoned"]);

// ----- Assets ----------------------------------------------------------------
export const assetType = pgEnum("asset_type", ["lab_report_pdf", "health_photo", "message_attachment", "profile_image", "program_media", "clinical_attachment", "other"]);
export const assetStatus = pgEnum("asset_status", ["active", "deleted"]);

// ----- Subscriptions, payments, billing & compliance -------------------------
export const billingInterval = pgEnum("billing_interval", ["monthly", "yearly"]);
export const limitMetric = pgEnum("limit_metric", ["staff_count", "active_clients", "program_count", "diet_chart_count", "monthly_revenue_paise", "storage_mb"]);
export const subscriptionStatus = pgEnum("subscription_status", ["active", "past_due", "cancelled", "paused"]);
export const paymentStatus = pgEnum("payment_status", ["created", "authorized", "captured", "failed", "refunded"]);
export const revenueSplitStatus = pgEnum("revenue_split_status", ["pending", "processed", "failed"]);
export const webhookProvider = pgEnum("webhook_provider", ["razorpay", "lab_vendor"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "issued", "paid", "cancelled"]);
export const creditNoteStatus = pgEnum("credit_note_status", ["issued", "applied"]);
export const refundStatus = pgEnum("refund_status", ["requested", "processing", "processed", "failed"]);
export const disputeStatus = pgEnum("dispute_status", ["open", "under_review", "won", "lost", "accepted"]);
export const payoutStatus = pgEnum("payout_status", ["pending", "processing", "paid", "failed"]);
export const settlementStatus = pgEnum("settlement_status", ["pending", "reconciled", "discrepancy"]);

// ----- Collaboration & care --------------------------------------------------
export const collabRequestStatus = pgEnum("collab_request_status", ["pending", "accepted", "declined", "cancelled"]);
export const collabMeetingStatus = pgEnum("collab_meeting_status", ["scheduled", "completed", "cancelled"]);
export const collabAgreementStatus = pgEnum("collab_agreement_status", ["active", "ended"]);
export const carePlanStatus = pgEnum("care_plan_status", ["active", "completed", "archived"]);
export const careTeamRole = pgEnum("care_team_role", ["lead", "nutritionist", "community_manager", "collaborating_specialist"]);
export const careMemberStatus = pgEnum("care_member_status", ["active", "removed"]);

// ----- Notifications & lab ---------------------------------------------------
export const notificationPriority = pgEnum("notification_priority", ["low", "normal", "high"]);
export const labBookingStatus = pgEnum("lab_booking_status", ["pending", "booked", "sample_collected", "processing", "reported", "cancelled"]);
export const labPaymentStatus = pgEnum("lab_payment_status", ["pending", "paid", "refunded"]);
export const labReportStatus = pgEnum("lab_report_status", ["pending", "ready"]);

// ----- Commerce / Shop (D12) -------------------------------------------------
// Fulfilment lifecycle of a (per-merchant) shop order. Payment state is gateway-neutral
// and tracked separately on the order (gateway_provider / gateway_payment_id).
export const orderStatus = pgEnum("order_status", ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "refunded"]);
