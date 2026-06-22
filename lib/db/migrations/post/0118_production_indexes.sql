-- =============================================================================
-- Vitalé — Post-companion 0118: production indexes (arch §8)
-- Ground truth: VITALE_DB_ARCHITECTURE §8 (lines 700-709).
--
-- Covers:
--   • pg_trgm GIN indexes (food_items.name, metric_definitions.display_name)
--   • Composite sort-aware indexes for feeds, leaderboards, inbox
--   • Time-series partition-local composite indexes (declared on parents;
--     Postgres replicates to partitions)
--   • Idempotency unique indexes not already in Drizzle schema
--
-- Indexes already created in Drizzle pgTable definitions (partial-unique,
-- FK indexes, existing composite indexes) are NOT duplicated here.
--
-- Apply order: after 0117 (lexical). Idempotent: CREATE INDEX IF NOT EXISTS.
-- =============================================================================

-- ============================================================================
-- SECTION 1 — pg_trgm GIN indexes (fuzzy text search)
-- SUBSTRATE NOTE (vanilla PG): pg_trgm is installed WITH SCHEMA extensions
-- (0001_extensions), so its operator class is extensions.gin_trgm_ops — NOT
-- public.gin_trgm_ops. Qualify explicitly; these CREATE INDEX statements run
-- outside any function so they do not inherit a search_path that includes
-- the extensions schema.
-- ============================================================================

-- food_items: ingredient + food search (arch §8, D4)
CREATE INDEX IF NOT EXISTS food_items_name_trgm_idx
  ON public.food_items USING gin (name extensions.gin_trgm_ops);

-- metric_definitions: health metric display-name search (arch §8, D5)
CREATE INDEX IF NOT EXISTS metric_definitions_name_trgm_idx
  ON public.metric_definitions USING gin (display_name extensions.gin_trgm_ops);

-- community_posts: body-text search for feed discovery
-- (the post text column is `body`; image/poll/announcement posts may have none)
CREATE INDEX IF NOT EXISTS community_posts_content_trgm_idx
  ON public.community_posts USING gin (body extensions.gin_trgm_ops)
  WHERE body IS NOT NULL;

-- ============================================================================
-- SECTION 2 — composite sort-aware indexes for feeds / leaderboards / inbox
-- ============================================================================

-- Community feed: org-scoped newest-first (primary feed sort)
-- post_status enum = (active, hidden, removed); visible posts are 'active'.
CREATE INDEX IF NOT EXISTS community_posts_org_created_idx
  ON public.community_posts (organization_id, created_at DESC)
  WHERE status = 'active';

-- Leaderboard scores: scope + program + period ranking
CREATE INDEX IF NOT EXISTS leaderboard_scores_scope_program_period_idx
  ON public.leaderboard_scores (scope, program_id, period, score DESC);

-- Notifications inbox: unread-first per user (recipient column is user_id)
CREATE INDEX IF NOT EXISTS notifications_user_read_date_idx
  ON public.notifications (user_id, read, created_date_ist DESC);

-- Messages inbox: conversation timeline
CREATE INDEX IF NOT EXISTS messages_conversation_date_idx
  ON public.messages (conversation_id, created_date_ist DESC);

-- Program enrollments: org-scoped enrollment list
CREATE INDEX IF NOT EXISTS program_enrollments_org_created_idx
  ON public.program_enrollments (organization_id, created_at DESC);

-- ============================================================================
-- SECTION 3 — health time-series (partition-local, declared on parent)
-- ============================================================================

-- Primary health read path: subject × metric × date (arch §8)
CREATE INDEX IF NOT EXISTS health_obs_subject_metric_date_idx
  ON public.health_observations (subject_user_id, metric_definition_id, measured_date_ist DESC);

-- Nutrition logs: subject × date (partition key is logged_date_ist)
CREATE INDEX IF NOT EXISTS nutrition_logs_user_date_idx
  ON public.nutrition_logs (user_id, logged_date_ist DESC);

-- ============================================================================
-- SECTION 4 — idempotency unique indexes (finance)
-- Arch §8: payment_webhook_events.provider_event_id,
--          disputes.razorpay_dispute_id, settlements.settlement_ref
-- These may already exist via Drizzle schema; CREATE UNIQUE INDEX IF NOT EXISTS
-- is a no-op if the constraint/index already covers the column.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_events_provider_event_id_key
  ON public.payment_webhook_events (provider_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS disputes_razorpay_dispute_id_key
  ON public.disputes (razorpay_dispute_id);

CREATE UNIQUE INDEX IF NOT EXISTS settlements_settlement_ref_key
  ON public.settlements (settlement_ref);

-- ============================================================================
-- SECTION 5 — additional FK support indexes (high-join paths not in Drizzle)
-- ============================================================================

-- care_plan_versions: FK + created_at ordering
CREATE INDEX IF NOT EXISTS care_plan_versions_plan_created_idx
  ON public.care_plan_versions (care_plan_id, created_at DESC);

-- clinical_notes: subject + date (REVOKE-API; coach reads via RPC)
CREATE INDEX IF NOT EXISTS clinical_notes_subject_created_idx
  ON public.clinical_notes (subject_user_id, created_at DESC);

-- access_grants: liveness check (status + end_date — hot path in RLS helpers)
CREATE INDEX IF NOT EXISTS access_grants_liveness_idx
  ON public.access_grants (organization_id, user_id, status, end_date)
  WHERE status = 'active';

-- admin_support_access: SLA monitoring query (job 6 hot path)
CREATE INDEX IF NOT EXISTS admin_support_access_sla_idx
  ON public.admin_support_access (approval_mode, status, review_deadline)
  WHERE status = 'active' AND post_review_at IS NULL;

-- ============================================================================
-- NOTES
-- • pg_trgm GIN requires pg_trgm extension (enabled in 0001_extensions).
-- • Indexes on partitioned parents are auto-replicated to partitions (PG11+).
-- • Run EXPLAIN (ANALYZE, BUFFERS) on hot paths post-launch to confirm index
--   use; adjust if the planner prefers seq-scans on small partitions.
-- • Indexes 4 (idempotency) are CREATE UNIQUE INDEX IF NOT EXISTS — they are
--   safe no-ops if the Drizzle-generated unique constraints already exist.
-- =============================================================================
