CREATE TYPE "public"."access_level" AS ENUM('view_only', 'full');--> statement-breakpoint
CREATE TYPE "public"."access_source_type" AS ENUM('program_enrollment', 'diet_assignment', 'lab_review', 'care_plan', 'collaboration_agreement', 'manual_consent');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('active', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('lab_report_pdf', 'health_photo', 'message_attachment', 'profile_image', 'program_media', 'clinical_attachment', 'other');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."audit_acting_as" AS ENUM('owner_coach', 'nutritionist', 'community_manager', 'collaborating_specialist', 'admin');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('view', 'export', 'update', 'download');--> statement-breakpoint
CREATE TYPE "public"."audit_resource_type" AS ENUM('lab_report', 'health_observation', 'nutrition_log', 'program', 'diet_chart', 'care_plan', 'clinical_note', 'message', 'asset', 'profile', 'community');--> statement-breakpoint
CREATE TYPE "public"."billing_interval" AS ENUM('monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."care_member_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."care_plan_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."care_team_role" AS ENUM('lead', 'nutritionist', 'community_manager', 'collaborating_specialist');--> statement-breakpoint
CREATE TYPE "public"."clinical_author_role" AS ENUM('owner_coach', 'nutritionist', 'collaborating_specialist');--> statement-breakpoint
CREATE TYPE "public"."clinical_note_type" AS ENUM('observation', 'assessment', 'progress_note', 'recommendation', 'addendum');--> statement-breakpoint
CREATE TYPE "public"."coach_capability" AS ENUM('view_client_health', 'manage_programs', 'manage_diet_charts', 'message_clients', 'moderate_community', 'manage_staff', 'view_revenue', 'manage_lab_recommendations', 'manage_products', 'write_clinical_notes', 'manage_care_plans');--> statement-breakpoint
CREATE TYPE "public"."collab_agreement_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TYPE "public"."collab_meeting_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."collab_request_status" AS ENUM('pending', 'accepted', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('data_processing', 'health_data_sharing', 'marketing', 'terms', 'coach_access', 'clinical_care');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('coach_user', 'staff_user', 'care_team', 'community_peer');--> statement-breakpoint
CREATE TYPE "public"."credit_note_status" AS ENUM('issued', 'applied');--> statement-breakpoint
CREATE TYPE "public"."deletion_status" AS ENUM('requested', 'processing', 'completed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."diet_chart_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'under_review', 'won', 'lost', 'accepted');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'completed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."flag_reason" AS ENUM('spam', 'abuse', 'misinformation', 'inappropriate', 'other');--> statement-breakpoint
CREATE TYPE "public"."flag_status" AS ENUM('open', 'reviewed', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."food_source" AS ENUM('system', 'coach', 'user');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."grant_data_category" AS ENUM('health_data', 'meals', 'programs', 'lab_results', 'community', 'orders', 'messages', 'clinical');--> statement-breakpoint
CREATE TYPE "public"."grant_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."grant_type" AS ENUM('primary', 'collaborating');--> statement-breakpoint
CREATE TYPE "public"."health_obs_source" AS ENUM('manual', 'wearable', 'lab', 'coach_entered');--> statement-breakpoint
CREATE TYPE "public"."intervention_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."kyc_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."lab_booking_status" AS ENUM('pending', 'booked', 'sample_collected', 'processing', 'reported', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."lab_payment_status" AS ENUM('pending', 'paid', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."lab_report_status" AS ENUM('pending', 'ready');--> statement-breakpoint
CREATE TYPE "public"."leaderboard_period" AS ENUM('weekly', 'monthly', 'all_time');--> statement-breakpoint
CREATE TYPE "public"."leaderboard_scope" AS ENUM('program', 'platform');--> statement-breakpoint
CREATE TYPE "public"."limit_metric" AS ENUM('staff_count', 'active_clients', 'program_count', 'diet_chart_count', 'monthly_revenue_paise', 'storage_mb');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner_coach', 'nutritionist', 'community_manager');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('invited', 'active', 'suspended', 'removed');--> statement-breakpoint
CREATE TYPE "public"."metric_category" AS ENUM('vital', 'body_composition', 'activity', 'sleep', 'nutrition_derived', 'lab', 'wearable');--> statement-breakpoint
CREATE TYPE "public"."metric_value_type" AS ENUM('numeric', 'integer', 'boolean', 'enum');--> statement-breakpoint
CREATE TYPE "public"."note_visibility" AS ENUM('internal', 'shared_with_user');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."nutrition_source" AS ENUM('manual', 'diet_chart', 'recipe');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TYPE "public"."outcome_status" AS ENUM('on_track', 'achieved', 'missed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('created', 'authorized', 'captured', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('pending', 'processing', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."post_status" AS ENUM('active', 'hidden', 'removed');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('text', 'image', 'recipe', 'poll', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."program_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."program_visibility" AS ENUM('public', 'private', 'invite_only');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('requested', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."revenue_split_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."session_content_type" AS ENUM('video', 'article', 'live', 'task');--> statement-breakpoint
CREATE TYPE "public"."settlement_status" AS ENUM('pending', 'reconciled', 'discrepancy');--> statement-breakpoint
CREATE TYPE "public"."streak_type" AS ENUM('meal_logging', 'health_logging', 'program', 'overall');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'past_due', 'cancelled', 'paused');--> statement-breakpoint
CREATE TYPE "public"."support_approval_mode" AS ENUM('self', 'dual', 'break_glass');--> statement-breakpoint
CREATE TYPE "public"."support_reason_code" AS ENUM('support_ticket', 'compliance_investigation', 'legal_request', 'fraud_review');--> statement-breakpoint
CREATE TYPE "public"."support_status" AS ENUM('requested', 'active', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'coach', 'nutritionist', 'community_manager', 'customer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'anonymized');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('razorpay', 'lab_vendor');--> statement-breakpoint
CREATE TABLE "professional_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text,
	"bio" text,
	"photo_asset_id" uuid,
	"specialties" text[],
	"credentials" jsonb,
	"years_experience" integer,
	"languages" text[],
	"rating_avg" numeric(3, 2),
	"rating_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"date_of_birth" date,
	"gender" "gender",
	"city" text,
	"state" text,
	"country" text DEFAULT 'India' NOT NULL,
	"locale" text,
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"goals" jsonb,
	"dietary_preferences" jsonb,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"full_name" text,
	"avatar_asset_id" uuid,
	"roles" "user_role"[] DEFAULT '{}' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"is_anonymized" boolean DEFAULT false NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_organizations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"owner_coach_id" uuid NOT NULL,
	"business_name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "org_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"invited_role" "member_role" NOT NULL,
	"token" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_user_id" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_member_permissions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"capability" "coach_capability" NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"member_role" "member_role" NOT NULL,
	"status" "member_status" DEFAULT 'invited' NOT NULL,
	"invited_by" uuid,
	"invited_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"settings" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"legal_name" text,
	"logo_asset_id" uuid,
	"description" text,
	"website_url" text,
	"social_links" jsonb,
	"gstin" text,
	"business_address" jsonb,
	"kyc_status" "kyc_status" DEFAULT 'pending' NOT NULL,
	"razorpay_linked_account_id" text,
	"pan_encrypted" text,
	"bank_details_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"uploaded_by_user_id" uuid NOT NULL,
	"subject_user_id" uuid,
	"asset_type" "asset_type" NOT NULL,
	"is_phi" boolean DEFAULT false NOT NULL,
	"storage_bucket" text NOT NULL,
	"storage_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum" text NOT NULL,
	"retention_until" date,
	"status" "asset_status" DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_definitions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"display_name" text NOT NULL,
	"category" "metric_category" NOT NULL,
	"value_type" "metric_value_type" NOT NULL,
	"canonical_unit" text,
	"unit_conversions" jsonb,
	"compound_group" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_enrollments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"program_version_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"progress_pct" smallint DEFAULT 0 NOT NULL,
	"payment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_modules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"module_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content_type" "session_content_type" NOT NULL,
	"video_url" text,
	"content" jsonb,
	"duration_seconds" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"program_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"cover_asset_id" uuid,
	"price_paise" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"duration_days" integer,
	"status" "program_status" DEFAULT 'draft' NOT NULL,
	"visibility" "program_visibility" DEFAULT 'private' NOT NULL,
	"max_enrollments" integer,
	"published_at" timestamp with time zone,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_watches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"watched_seconds" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"last_watched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diet_chart_assignments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"diet_chart_id" uuid NOT NULL,
	"diet_chart_version_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"assigned_by_user_id" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'active' NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diet_chart_meals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"diet_chart_id" uuid NOT NULL,
	"meal_type" "meal_type" NOT NULL,
	"name" text,
	"time_of_day" text,
	"items" jsonb,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diet_chart_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"diet_chart_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"authored_by_user_id" uuid NOT NULL,
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diet_charts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"authored_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"total_daily_calories" numeric,
	"status" "diet_chart_status" DEFAULT 'draft' NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"category" text,
	"serving_size_g" numeric,
	"calories" numeric,
	"protein_g" numeric,
	"carbs_g" numeric,
	"fat_g" numeric,
	"fiber_g" numeric,
	"micronutrients" jsonb,
	"source" "food_source" NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipe_id" uuid NOT NULL,
	"food_item_id" uuid,
	"name" text NOT NULL,
	"quantity_g" numeric,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"created_by_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"instructions" jsonb,
	"servings" integer,
	"prep_minutes" integer,
	"total_calories" numeric,
	"is_public" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_metrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"metric_key" "limit_metric" NOT NULL,
	"metric_value" bigint NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid,
	"invoice_number" text,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"place_of_supply_state" text,
	"seller_gstin" text,
	"buyer_gstin" text,
	"subtotal_paise" bigint NOT NULL,
	"tax_total_paise" bigint NOT NULL,
	"total_paise" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_invoices_total_consistent" CHECK ("coach_invoices"."total_paise" = "coach_invoices"."subtotal_paise" + "coach_invoices"."tax_total_paise")
);
--> statement-breakpoint
CREATE TABLE "coach_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_coach_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"razorpay_subscription_id" text,
	"status" "subscription_status" NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"amount_paise" bigint NOT NULL,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"credit_note_number" text,
	"reason" text,
	"amount_paise" bigint NOT NULL,
	"tax_reversed_paise" bigint DEFAULT 0 NOT NULL,
	"status" "credit_note_status" DEFAULT 'issued' NOT NULL,
	"issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"razorpay_dispute_id" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"reason_code" text,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"evidence" jsonb,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"status" "payment_status" DEFAULT 'created' NOT NULL,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" text NOT NULL,
	"hsn_sac_code" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price_paise" bigint NOT NULL,
	"taxable_value_paise" bigint NOT NULL,
	"cgst_paise" bigint DEFAULT 0 NOT NULL,
	"sgst_paise" bigint DEFAULT 0 NOT NULL,
	"igst_paise" bigint DEFAULT 0 NOT NULL,
	"line_total_paise" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_line_items_gst_split" CHECK (("invoice_line_items"."igst_paise" = 0) OR ("invoice_line_items"."cgst_paise" = 0 AND "invoice_line_items"."sgst_paise" = 0)),
	CONSTRAINT "invoice_line_items_total" CHECK ("invoice_line_items"."line_total_paise" = "invoice_line_items"."taxable_value_paise" + "invoice_line_items"."cgst_paise" + "invoice_line_items"."sgst_paise" + "invoice_line_items"."igst_paise")
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"event_type" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"razorpay_transfer_id" text,
	"amount_paise" bigint NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"status" "payout_status" DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_limits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"limit_key" "limit_metric" NOT NULL,
	"limit_value" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"reason" text,
	"razorpay_refund_id" text,
	"status" "refund_status" DEFAULT 'requested' NOT NULL,
	"initiated_by" uuid,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_amount_positive" CHECK ("refunds"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "revenue_splits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"platform_fee_paise" bigint NOT NULL,
	"coach_amount_paise" bigint NOT NULL,
	"razorpay_transfer_id" text,
	"status" "revenue_split_status" DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revenue_splits_nonneg" CHECK ("revenue_splits"."platform_fee_paise" >= 0 AND "revenue_splits"."coach_amount_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"settlement_ref" text NOT NULL,
	"gross_paise" bigint NOT NULL,
	"fees_paise" bigint DEFAULT 0 NOT NULL,
	"tax_paise" bigint DEFAULT 0 NOT NULL,
	"net_paise" bigint NOT NULL,
	"settled_at" timestamp with time zone,
	"status" "settlement_status" DEFAULT 'pending' NOT NULL,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settlements_totals" CHECK ("settlements"."gross_paise" = "settlements"."net_paise" + "settlements"."fees_paise" + "settlements"."tax_paise")
);
--> statement-breakpoint
CREATE TABLE "subscription_features" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"feature_key" text NOT NULL,
	"feature_value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_paise" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"billing_interval" "billing_interval" NOT NULL,
	"razorpay_plan_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"last_read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"conversation_type" "conversation_type" NOT NULL,
	"subject_user_id" uuid,
	"status" "conversation_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"message_id" uuid NOT NULL,
	"message_created_date_ist" date NOT NULL,
	"asset_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leaderboard_scores" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"scope" "leaderboard_scope" NOT NULL,
	"program_id" uuid,
	"period" "leaderboard_period" NOT NULL,
	"score" bigint DEFAULT 0 NOT NULL,
	"rank" integer,
	"period_start_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_type_id" uuid NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "user_streaks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"streak_type" "streak_type" NOT NULL,
	"current_count" integer DEFAULT 0 NOT NULL,
	"longest_count" integer DEFAULT 0 NOT NULL,
	"last_activity_date_ist" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"left_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "community_memberships_status_chk" CHECK ("community_memberships"."status" IN ('active', 'left'))
);
--> statement-breakpoint
CREATE TABLE "community_posts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"post_type" "post_type" NOT NULL,
	"body" text,
	"media" jsonb,
	"recipe_id" uuid,
	"like_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"status" "post_status" DEFAULT 'active' NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"body" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"status" "post_status" DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_flags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"reporter_user_id" uuid NOT NULL,
	"reason" "flag_reason" NOT NULL,
	"status" "flag_status" DEFAULT 'open' NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_flags_target_exclusive" CHECK (("post_flags"."post_id" IS NULL) != ("post_flags"."comment_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "post_likes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_poll_votes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"option_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_plan_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"care_plan_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"authored_by_user_id" uuid NOT NULL,
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "care_plan_status" DEFAULT 'active' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"start_date" date,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "care_team_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"care_plan_id" uuid NOT NULL,
	"member_user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role_in_team" "care_team_role" NOT NULL,
	"capabilities" "coach_capability"[] DEFAULT '{}' NOT NULL,
	"status" "care_member_status" DEFAULT 'active' NOT NULL,
	"collaboration_agreement_id" uuid,
	"added_by" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaboration_agreements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"primary_organization_id" uuid NOT NULL,
	"collaborating_organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"terms" jsonb,
	"revenue_share_pct" numeric(5, 2),
	"status" "collab_agreement_status" DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaboration_agreements_revenue_share_chk" CHECK ("collaboration_agreements"."revenue_share_pct" >= 0 AND "collaboration_agreements"."revenue_share_pct" <= 100)
);
--> statement-breakpoint
CREATE TABLE "collaboration_meetings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"collaboration_request_id" uuid,
	"organization_id" uuid NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer,
	"meeting_url" text,
	"status" "collab_meeting_status" DEFAULT 'scheduled' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaboration_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"from_organization_id" uuid NOT NULL,
	"to_organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "collab_request_status" DEFAULT 'pending' NOT NULL,
	"message" text,
	"requested_by" uuid NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collaboration_requests_distinct_orgs_chk" CHECK ("collaboration_requests"."from_organization_id" <> "collaboration_requests"."to_organization_id")
);
--> statement-breakpoint
CREATE TABLE "clinical_notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"author_member_id" uuid NOT NULL,
	"author_role_at_time" "clinical_author_role" NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"care_plan_id" uuid,
	"note_type" "clinical_note_type" NOT NULL,
	"parent_note_id" uuid,
	"body" text NOT NULL,
	"visibility" "note_visibility" DEFAULT 'internal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clinical_notes_addendum_chk" CHECK (("clinical_notes"."note_type" = 'addendum') = ("clinical_notes"."parent_note_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "interventions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"care_plan_id" uuid NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"author_member_id" uuid NOT NULL,
	"intervention_type" text NOT NULL,
	"description" text,
	"status" "intervention_status" DEFAULT 'active' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcomes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"care_plan_id" uuid NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"metric_definition_id" uuid,
	"label" text NOT NULL,
	"baseline_value" numeric,
	"target_value" numeric,
	"observed_value" numeric,
	"status" "outcome_status" DEFAULT 'on_track' NOT NULL,
	"measured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_grants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" "access_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"data_categories_granted" "grant_data_category"[] DEFAULT '{}' NOT NULL,
	"grant_type" "grant_type" NOT NULL,
	"access_level" "access_level" NOT NULL,
	"status" "grant_status" DEFAULT 'active' NOT NULL,
	"start_date" date DEFAULT CURRENT_DATE NOT NULL,
	"end_date" date,
	"revoked_at" timestamp with time zone,
	"revoked_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_support_access" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_user_id" uuid NOT NULL,
	"requested_by_admin_id" uuid NOT NULL,
	"approved_by_admin_id" uuid,
	"approval_mode" "support_approval_mode" NOT NULL,
	"reason_code" "support_reason_code" NOT NULL,
	"justification" text NOT NULL,
	"ticket_ref" text,
	"scope_categories" "grant_data_category"[] DEFAULT '{}' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"status" "support_status" DEFAULT 'requested' NOT NULL,
	"post_review_by" uuid,
	"post_review_at" timestamp with time zone,
	"post_review_note" text,
	"review_deadline" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_support_access_dual_approver_chk" CHECK ("admin_support_access"."approval_mode" <> 'dual' OR ("admin_support_access"."approved_by_admin_id" IS NOT NULL AND "admin_support_access"."approved_by_admin_id" <> "admin_support_access"."requested_by_admin_id")),
	CONSTRAINT "admin_support_access_review_deadline_chk" CHECK ("admin_support_access"."approval_mode" NOT IN ('self', 'break_glass') OR "admin_support_access"."review_deadline" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "data_deletion_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "deletion_status" DEFAULT 'requested' NOT NULL,
	"reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by" uuid,
	"anonymization_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpdp_consent_records" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"consent_version" text NOT NULL,
	"consent_text_snapshot" text NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_product_recommendations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"coach_id" uuid NOT NULL,
	"coach_name" text NOT NULL,
	"coach_avatar_url" text,
	"product_id" uuid NOT NULL,
	"clinical_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"image_url" text,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"price_paise" integer NOT NULL,
	"mrp_paise" integer NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"weight_g" integer,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"short_description" text DEFAULT '' NOT NULL,
	"category_id" uuid NOT NULL,
	"brand" text,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_bestseller" boolean DEFAULT false NOT NULL,
	"is_new_in_store" boolean DEFAULT false NOT NULL,
	"hsn_code" text,
	"gst_rate" integer DEFAULT 18 NOT NULL,
	"avg_rating" integer DEFAULT 0 NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_banners" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"image_url" text NOT NULL,
	"bg_color" text DEFAULT '#16A34A' NOT NULL,
	"link" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text DEFAULT 'Home' NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"line1" text NOT NULL,
	"line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"pincode" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"pdf_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_order_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"variant_name" text NOT NULL,
	"qty" integer NOT NULL,
	"price_paise" integer NOT NULL,
	"gst_rate" integer DEFAULT 18 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"address_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"subtotal_paise" integer NOT NULL,
	"discount_paise" integer DEFAULT 0 NOT NULL,
	"shipping_paise" integer DEFAULT 0 NOT NULL,
	"gst_paise" integer DEFAULT 0 NOT NULL,
	"total_paise" integer NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"coupon_code" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_lab_recommendations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"coach_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_bookings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"address_id" uuid,
	"status" text DEFAULT 'pending' NOT NULL,
	"slot_date" text NOT NULL,
	"slot_time" text NOT NULL,
	"collection_type" text DEFAULT 'home' NOT NULL,
	"patient_name" text,
	"patient_age" integer,
	"patient_gender" text,
	"patient_phone" text,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"amount_paise" integer DEFAULT 0 NOT NULL,
	"thyrocare_order_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_packages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"tests_count" integer DEFAULT 0 NOT NULL,
	"price_paise" integer NOT NULL,
	"mrp_paise" integer NOT NULL,
	"turnaround_days" integer DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image_url" text,
	"popular" boolean DEFAULT false NOT NULL,
	"sample_type" text DEFAULT 'Blood' NOT NULL,
	"fasting_required" boolean DEFAULT false NOT NULL,
	"why_this_test" text,
	"recommended_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"niche" text,
	"color" text DEFAULT '#2563EB' NOT NULL,
	"thyrocare_code" text,
	"test_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lab_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "lab_report_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"test_id" uuid,
	"test_name" text NOT NULL,
	"value" real NOT NULL,
	"unit" text,
	"reference_range_low" real,
	"reference_range_high" real,
	"is_abnormal" boolean DEFAULT false NOT NULL,
	"flag" text DEFAULT 'normal' NOT NULL,
	"section" text DEFAULT 'General' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"booking_id" uuid,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"report_date" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"abnormal_count" integer DEFAULT 0 NOT NULL,
	"package_name" text,
	"thyrocare_report_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lab_tests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"package_id" uuid,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"unit" text,
	"reference_range_low" real,
	"reference_range_high" real,
	"description" text,
	"section" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_photo_asset_id_assets_id_fk" FOREIGN KEY ("photo_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_asset_id_assets_id_fk" FOREIGN KEY ("avatar_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_organizations" ADD CONSTRAINT "coach_organizations_owner_coach_id_users_id_fk" FOREIGN KEY ("owner_coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_user_id_users_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_permissions" ADD CONSTRAINT "organization_member_permissions_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member_permissions" ADD CONSTRAINT "organization_member_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_logo_asset_id_assets_id_fk" FOREIGN KEY ("logo_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_program_version_id_program_versions_id_fk" FOREIGN KEY ("program_version_id") REFERENCES "public"."program_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_enrollments" ADD CONSTRAINT "program_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_modules" ADD CONSTRAINT "program_modules_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_sessions" ADD CONSTRAINT "program_sessions_module_id_program_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."program_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_sessions" ADD CONSTRAINT "program_sessions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_cover_asset_id_assets_id_fk" FOREIGN KEY ("cover_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_watches" ADD CONSTRAINT "session_watches_enrollment_id_program_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."program_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_watches" ADD CONSTRAINT "session_watches_session_id_program_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."program_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_watches" ADD CONSTRAINT "session_watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_chart_assignments" ADD CONSTRAINT "diet_chart_assignments_diet_chart_id_diet_charts_id_fk" FOREIGN KEY ("diet_chart_id") REFERENCES "public"."diet_charts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_chart_assignments" ADD CONSTRAINT "diet_chart_assignments_diet_chart_version_id_diet_chart_versions_id_fk" FOREIGN KEY ("diet_chart_version_id") REFERENCES "public"."diet_chart_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_chart_assignments" ADD CONSTRAINT "diet_chart_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_chart_assignments" ADD CONSTRAINT "diet_chart_assignments_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_chart_assignments" ADD CONSTRAINT "diet_chart_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_chart_meals" ADD CONSTRAINT "diet_chart_meals_diet_chart_id_diet_charts_id_fk" FOREIGN KEY ("diet_chart_id") REFERENCES "public"."diet_charts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_chart_versions" ADD CONSTRAINT "diet_chart_versions_diet_chart_id_diet_charts_id_fk" FOREIGN KEY ("diet_chart_id") REFERENCES "public"."diet_charts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_chart_versions" ADD CONSTRAINT "diet_chart_versions_authored_by_user_id_users_id_fk" FOREIGN KEY ("authored_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_charts" ADD CONSTRAINT "diet_charts_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diet_charts" ADD CONSTRAINT "diet_charts_authored_by_user_id_users_id_fk" FOREIGN KEY ("authored_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_items" ADD CONSTRAINT "food_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_item_id_food_items_id_fk" FOREIGN KEY ("food_item_id") REFERENCES "public"."food_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_metrics" ADD CONSTRAINT "billing_metrics_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_invoices" ADD CONSTRAINT "coach_invoices_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_invoices" ADD CONSTRAINT "coach_invoices_subscription_id_coach_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."coach_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_subscriptions" ADD CONSTRAINT "coach_subscriptions_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_subscriptions" ADD CONSTRAINT "coach_subscriptions_owner_coach_id_users_id_fk" FOREIGN KEY ("owner_coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_subscriptions" ADD CONSTRAINT "coach_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_coach_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."coach_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_id_enrollment_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."enrollment_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_enrollment_id_program_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."program_enrollments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment_payments" ADD CONSTRAINT "enrollment_payments_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_coach_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."coach_invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_limits" ADD CONSTRAINT "plan_limits_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_enrollment_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."enrollment_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_initiated_by_users_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_splits" ADD CONSTRAINT "revenue_splits_payment_id_enrollment_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."enrollment_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_splits" ADD CONSTRAINT "revenue_splits_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_features" ADD CONSTRAINT "subscription_features_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_streaks" ADD CONSTRAINT "user_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_memberships" ADD CONSTRAINT "community_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_parent_comment_id_post_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comments" ADD CONSTRAINT "post_comments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_flags" ADD CONSTRAINT "post_flags_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_flags" ADD CONSTRAINT "post_flags_comment_id_post_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."post_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_flags" ADD CONSTRAINT "post_flags_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_flags" ADD CONSTRAINT "post_flags_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_poll_votes" ADD CONSTRAINT "post_poll_votes_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_poll_votes" ADD CONSTRAINT "post_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plan_versions" ADD CONSTRAINT "care_plan_versions_care_plan_id_care_plans_id_fk" FOREIGN KEY ("care_plan_id") REFERENCES "public"."care_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plan_versions" ADD CONSTRAINT "care_plan_versions_authored_by_user_id_users_id_fk" FOREIGN KEY ("authored_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_care_plan_id_care_plans_id_fk" FOREIGN KEY ("care_plan_id") REFERENCES "public"."care_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_member_user_id_users_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_collaboration_agreement_id_collaboration_agreements_id_fk" FOREIGN KEY ("collaboration_agreement_id") REFERENCES "public"."collaboration_agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "care_team_members" ADD CONSTRAINT "care_team_members_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_agreements" ADD CONSTRAINT "collaboration_agreements_primary_organization_id_coach_organizations_id_fk" FOREIGN KEY ("primary_organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_agreements" ADD CONSTRAINT "collaboration_agreements_collaborating_organization_id_coach_organizations_id_fk" FOREIGN KEY ("collaborating_organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_agreements" ADD CONSTRAINT "collaboration_agreements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_meetings" ADD CONSTRAINT "collaboration_meetings_collaboration_request_id_collaboration_requests_id_fk" FOREIGN KEY ("collaboration_request_id") REFERENCES "public"."collaboration_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_meetings" ADD CONSTRAINT "collaboration_meetings_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_meetings" ADD CONSTRAINT "collaboration_meetings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_meetings" ADD CONSTRAINT "collaboration_meetings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_from_organization_id_coach_organizations_id_fk" FOREIGN KEY ("from_organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_to_organization_id_coach_organizations_id_fk" FOREIGN KEY ("to_organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_requests" ADD CONSTRAINT "collaboration_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_author_member_id_organization_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_care_plan_id_care_plans_id_fk" FOREIGN KEY ("care_plan_id") REFERENCES "public"."care_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_parent_note_id_clinical_notes_id_fk" FOREIGN KEY ("parent_note_id") REFERENCES "public"."clinical_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_care_plan_id_care_plans_id_fk" FOREIGN KEY ("care_plan_id") REFERENCES "public"."care_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_author_member_id_organization_members_id_fk" FOREIGN KEY ("author_member_id") REFERENCES "public"."organization_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_care_plan_id_care_plans_id_fk" FOREIGN KEY ("care_plan_id") REFERENCES "public"."care_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcomes" ADD CONSTRAINT "outcomes_metric_definition_id_metric_definitions_id_fk" FOREIGN KEY ("metric_definition_id") REFERENCES "public"."metric_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_organization_id_coach_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."coach_organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_grants" ADD CONSTRAINT "access_grants_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_support_access" ADD CONSTRAINT "admin_support_access_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_support_access" ADD CONSTRAINT "admin_support_access_requested_by_admin_id_users_id_fk" FOREIGN KEY ("requested_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_support_access" ADD CONSTRAINT "admin_support_access_approved_by_admin_id_users_id_fk" FOREIGN KEY ("approved_by_admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_support_access" ADD CONSTRAINT "admin_support_access_post_review_by_users_id_fk" FOREIGN KEY ("post_review_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_deletion_requests" ADD CONSTRAINT "data_deletion_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpdp_consent_records" ADD CONSTRAINT "dpdp_consent_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_product_recommendations" ADD CONSTRAINT "coach_product_recommendations_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_product_recommendations" ADD CONSTRAINT "coach_product_recommendations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_events" ADD CONSTRAINT "shop_order_events_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_order_id_shop_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."shop_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_order_items" ADD CONSTRAINT "shop_order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_orders" ADD CONSTRAINT "shop_orders_address_id_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."addresses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_lab_recommendations" ADD CONSTRAINT "coach_lab_recommendations_coach_id_users_id_fk" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_lab_recommendations" ADD CONSTRAINT "coach_lab_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_lab_recommendations" ADD CONSTRAINT "coach_lab_recommendations_package_id_lab_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."lab_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_bookings" ADD CONSTRAINT "lab_bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_bookings" ADD CONSTRAINT "lab_bookings_package_id_lab_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."lab_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_report_results" ADD CONSTRAINT "lab_report_results_report_id_lab_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."lab_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_report_results" ADD CONSTRAINT "lab_report_results_test_id_lab_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."lab_tests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_booking_id_lab_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."lab_bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_package_id_lab_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."lab_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "professional_profiles_user_key" ON "professional_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_profiles_user_key" ON "user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_key" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email") WHERE "users"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "coach_organizations_owner_key" ON "coach_organizations" USING btree ("owner_coach_id");--> statement-breakpoint
CREATE UNIQUE INDEX "coach_organizations_slug_key" ON "coach_organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invitations_org_status_idx" ON "invitations" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "org_member_permissions_key" ON "organization_member_permissions" USING btree ("member_id","capability");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_live_key" ON "organization_members" USING btree ("organization_id","user_id") WHERE "organization_members"."status" <> 'removed';--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_owner_key" ON "organization_members" USING btree ("organization_id") WHERE "organization_members"."member_role" = 'owner_coach';--> statement-breakpoint
CREATE INDEX "organization_members_user_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_profiles_org_key" ON "organization_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assets_subject_phi_idx" ON "assets" USING btree ("subject_user_id") WHERE "assets"."is_phi";--> statement-breakpoint
CREATE INDEX "assets_org_idx" ON "assets" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_definitions_code_key" ON "metric_definitions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "metric_definitions_category_idx" ON "metric_definitions" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "program_enrollments_active_key" ON "program_enrollments" USING btree ("program_id","user_id") WHERE "program_enrollments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "program_enrollments_user_status_idx" ON "program_enrollments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "program_modules_program_sort_idx" ON "program_modules" USING btree ("program_id","sort_order");--> statement-breakpoint
CREATE INDEX "program_sessions_program_module_sort_idx" ON "program_sessions" USING btree ("program_id","module_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "program_versions_program_version_key" ON "program_versions" USING btree ("program_id","version_number");--> statement-breakpoint
CREATE INDEX "programs_org_status_idx" ON "programs" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "programs_org_slug_key" ON "programs" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "session_watches_enrollment_session_key" ON "session_watches" USING btree ("enrollment_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "diet_chart_assignments_active_key" ON "diet_chart_assignments" USING btree ("diet_chart_id","user_id") WHERE "diet_chart_assignments"."status" = 'active';--> statement-breakpoint
CREATE INDEX "diet_chart_assignments_user_status_idx" ON "diet_chart_assignments" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "diet_chart_meals_chart_sort_idx" ON "diet_chart_meals" USING btree ("diet_chart_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "diet_chart_versions_chart_version_key" ON "diet_chart_versions" USING btree ("diet_chart_id","version_number");--> statement-breakpoint
CREATE INDEX "diet_charts_org_status_idx" ON "diet_charts" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "food_items_category_idx" ON "food_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_sort_idx" ON "recipe_ingredients" USING btree ("recipe_id","sort_order");--> statement-breakpoint
CREATE INDEX "recipes_org_idx" ON "recipes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "recipes_public_idx" ON "recipes" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "billing_metrics_org_metric_period_idx" ON "billing_metrics" USING btree ("organization_id","metric_key","period_start" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "coach_invoices_number_key" ON "coach_invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "coach_invoices_org_issued_idx" ON "coach_invoices" USING btree ("organization_id","issued_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "coach_subscriptions_active_org_key" ON "coach_subscriptions" USING btree ("organization_id") WHERE "coach_subscriptions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "coach_subscriptions_org_idx" ON "coach_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_notes_number_key" ON "credit_notes" USING btree ("credit_note_number");--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_idx" ON "credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_razorpay_dispute_key" ON "disputes" USING btree ("razorpay_dispute_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "enrollment_payments_org_captured_idx" ON "enrollment_payments" USING btree ("organization_id","captured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "enrollment_payments_user_idx" ON "enrollment_payments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_payments_razorpay_payment_key" ON "enrollment_payments" USING btree ("razorpay_payment_id") WHERE "enrollment_payments"."razorpay_payment_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_key" ON "payment_webhook_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_processed_received_idx" ON "payment_webhook_events" USING btree ("processed","received_at");--> statement-breakpoint
CREATE INDEX "payouts_org_period_idx" ON "payouts" USING btree ("organization_id","period_start" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "plan_limits_plan_key_key" ON "plan_limits" USING btree ("plan_id","limit_key");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_razorpay_refund_key" ON "refunds" USING btree ("razorpay_refund_id") WHERE "refunds"."razorpay_refund_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_splits_payment_key" ON "revenue_splits" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "revenue_splits_org_status_idx" ON "revenue_splits" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "settlements_ref_key" ON "settlements" USING btree ("settlement_ref");--> statement-breakpoint
CREATE INDEX "settlements_status_idx" ON "settlements" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_features_plan_key_key" ON "subscription_features" USING btree ("plan_id","feature_key");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "subscription_plans_active_sort_idx" ON "subscription_plans" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_participants_active_key" ON "conversation_participants" USING btree ("conversation_id","user_id") WHERE "conversation_participants"."left_at" IS NULL;--> statement-breakpoint
CREATE INDEX "conversations_org_idx" ON "conversations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "conversations_subject_user_idx" ON "conversations" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "message_attachments_message_idx" ON "message_attachments" USING btree ("message_id","message_created_date_ist");--> statement-breakpoint
CREATE INDEX "message_attachments_asset_idx" ON "message_attachments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "leaderboard_scores_ranking_idx" ON "leaderboard_scores" USING btree ("scope","program_id","period","score" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "user_badges_user_badge_key" ON "user_badges" USING btree ("user_id","badge_type_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_streaks_user_type_key" ON "user_streaks" USING btree ("user_id","streak_type");--> statement-breakpoint
CREATE UNIQUE INDEX "community_memberships_active_key" ON "community_memberships" USING btree ("organization_id","user_id") WHERE "community_memberships"."status" = 'active';--> statement-breakpoint
CREATE INDEX "community_memberships_user_status_idx" ON "community_memberships" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "community_memberships_org_status_idx" ON "community_memberships" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "community_posts_org_created_idx" ON "community_posts" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "post_comments_post_created_idx" ON "post_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "post_comments_parent_idx" ON "post_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "post_flags_status_idx" ON "post_flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "post_flags_post_idx" ON "post_flags" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "post_flags_comment_idx" ON "post_flags" USING btree ("comment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_likes_post_user_key" ON "post_likes" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "post_poll_votes_post_user_key" ON "post_poll_votes" USING btree ("post_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "care_plan_versions_plan_version_key" ON "care_plan_versions" USING btree ("care_plan_id","version_number");--> statement-breakpoint
CREATE INDEX "care_plans_user_status_idx" ON "care_plans" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "care_plans_org_status_idx" ON "care_plans" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "care_team_members_active_key" ON "care_team_members" USING btree ("care_plan_id","member_user_id") WHERE "care_team_members"."status" = 'active';--> statement-breakpoint
CREATE INDEX "care_team_members_member_idx" ON "care_team_members" USING btree ("member_user_id");--> statement-breakpoint
CREATE INDEX "collaboration_agreements_user_status_idx" ON "collaboration_agreements" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "collaboration_agreements_primary_org_idx" ON "collaboration_agreements" USING btree ("primary_organization_id");--> statement-breakpoint
CREATE INDEX "collaboration_agreements_collaborating_org_idx" ON "collaboration_agreements" USING btree ("collaborating_organization_id");--> statement-breakpoint
CREATE INDEX "collaboration_meetings_org_scheduled_idx" ON "collaboration_meetings" USING btree ("organization_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "collaboration_requests_to_org_status_idx" ON "collaboration_requests" USING btree ("to_organization_id","status");--> statement-breakpoint
CREATE INDEX "collaboration_requests_user_idx" ON "collaboration_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clinical_notes_subject_created_idx" ON "clinical_notes" USING btree ("subject_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "clinical_notes_care_plan_idx" ON "clinical_notes" USING btree ("care_plan_id");--> statement-breakpoint
CREATE INDEX "interventions_care_plan_idx" ON "interventions" USING btree ("care_plan_id");--> statement-breakpoint
CREATE INDEX "interventions_subject_idx" ON "interventions" USING btree ("subject_user_id");--> statement-breakpoint
CREATE INDEX "outcomes_care_plan_idx" ON "outcomes" USING btree ("care_plan_id");--> statement-breakpoint
CREATE INDEX "outcomes_subject_idx" ON "outcomes" USING btree ("subject_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "access_grants_active_key" ON "access_grants" USING btree ("organization_id","user_id","source_type","source_id") WHERE "access_grants"."status" = 'active';--> statement-breakpoint
CREATE INDEX "access_grants_user_status_idx" ON "access_grants" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "access_grants_org_status_idx" ON "access_grants" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "access_grants_source_idx" ON "access_grants" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "admin_support_access_subject_status_idx" ON "admin_support_access" USING btree ("subject_user_id","status");--> statement-breakpoint
CREATE INDEX "admin_support_access_status_expires_idx" ON "admin_support_access" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "admin_support_access_review_deadline_idx" ON "admin_support_access" USING btree ("review_deadline") WHERE "admin_support_access"."post_review_at" IS NULL;--> statement-breakpoint
CREATE INDEX "data_deletion_requests_status_idx" ON "data_deletion_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_deletion_requests_user_idx" ON "data_deletion_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dpdp_consent_records_user_type_created_idx" ON "dpdp_consent_records" USING btree ("user_id","consent_type","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "reviews_product_idx" ON "product_reviews" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_slug_key" ON "products" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "addresses_user_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cart_items_cart_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_user_key" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "shop_order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "shop_order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "shop_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "coach_lab_rec_user_idx" ON "coach_lab_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lab_bookings_user_idx" ON "lab_bookings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lab_results_report_idx" ON "lab_report_results" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "lab_reports_user_idx" ON "lab_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "lab_tests_package_idx" ON "lab_tests" USING btree ("package_id");