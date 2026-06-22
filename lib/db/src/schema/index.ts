// ----- New-model schema (91-table architecture) ------------------------------
// Phase 1 foundations live in raw migrations (lib/db/migrations/0001-0006). Phase 2 D0/D1
// table models below. Phase 3 begins with D15 assets (the typed-FK target many later tables
// reference). Access-control (D2): the three net-new tables (data_deletion_requests,
// admin_support_access, dpdp_consent_records) are wired now via ./access; only the new-shape
// access_grants + coach_data_access_audit land in Phase 8 alongside the labs.ts refactor (they
// would collide with the legacy ./users exports below, which labs.ts + scripts/seed.ts depend on).
export * from "./enums";
export * from "./identity";
export * from "./organizations";
export * from "./assets"; // D15 (Phase 3 "build early"); identity/organizations FK into it
export * from "./health"; // D5 catalog half (metric_definitions); health_observations is raw-partitioned (post companion)
export * from "./programs"; // D3 (Phase 4): programs + versions/modules/sessions/enrollments/session_watches
export * from "./nutrition"; // D4 (Phase 4) catalog half: food_items/recipes/diet_charts/...; nutrition_logs are raw-partitioned
export * from "./billing"; // D8 (Phase 5): subscriptions/plans/limits + invoices/payments/splits/refunds/disputes/payouts/settlements/webhooks
export * from "./messaging"; // D13 (Phase 6) non-partitioned half: conversations/conversation_participants/message_attachments; messages+notifications are raw-partitioned (post companion 0108)
export * from "./gamification"; // D6 (Phase 7): user_streaks/user_badges/leaderboard_scores; badge_types is the raw-only lookup (0003), user_badges.badge_type_id FK added raw 0109
export * from "./community"; // D7 (Phase 7): community_posts/post_comments/post_likes/post_poll_votes/post_flags + community_memberships (Blocker 3, community half of shares_active_context); RLS+counter triggers in post companion 0109
export * from "./care"; // D9: collaboration_requests/meetings/agreements + care_plans/care_team_members/care_plan_versions; runtime backing for on_care_team()/can_read_health() (raw 0005); RLS+triggers in post companion 0110
export * from "./clinical"; // D14: clinical_notes (append-only, REVOKE-API)/interventions/outcomes; RLS+IMMUT-BLOCK in post companion 0111
export * from "./access"; // D2 (net-new): data_deletion_requests/admin_support_access/dpdp_consent_records; closes admin_has_support_access() fwd-ref (0005); RLS+triggers in post companion 0112. access_grants/coach_data_access_audit deferred to Phase 8 (legacy ./users collision)
export * from "./sessions"; // coaching_sessions: coach↔client scheduled sessions + Zoom meeting persistence; RLS+grants+touch trigger in post companion 0142

// ----- Legacy / provisional schema (Phase-8 migration targets) ---------------
export * from "./shop";
export * from "./commerce";
export * from "./lab";
// ./users removed Phase 8 — old-shape access_grants + coach_data_access_audit superseded by
// access_grants in ./access and raw-partitioned 0113_coach_audit_table.sql.
