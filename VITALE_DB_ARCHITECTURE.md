# Vitalé — Final Database Architecture (FREEZE-READY · Review Round 3)

> **Status:** **Freeze-ready.** All R3 product decisions ratified (2026-06-02).
> **No schema code is generated yet** — generate Drizzle only after this document is
> frozen.
>
> **Scope:** B2B2C SaaS health-&-wellness coaching platform for **independent health
> coaches in India**. Single shared platform (**NOT multi-tenant**; never introduce
> `tenant_id`). Business ownership is modeled with `coach_organizations`; data
> isolation is enforced by RBAC + `access_grants` + RLS.
>
> **Permanent business constraint:** One Coach owns exactly one Organization; one
> Organization has exactly one Owner Coach (`UNIQUE(owner_coach_id)`). Clinics,
> branches, franchises, multi-owner and multi-coach businesses are **permanently out
> of scope**. Ownership *transfer* is supported; multi-ownership is not.

---

## 1. Operating model (the source of truth for every decision below)

| Actor | Where they work | What they own / can touch |
|---|---|---|
| **Admin** (Vitalé staff) | SaaS web | Subscriptions, revenue, KYC, moderation, compliance, analytics. **No ambient access to customer health data** — only via a time-boxed, audited `admin_support_access` case. |
| **Coach** (paying customer) | SaaS web | Owns exactly one `coach_organization`. Billing owner + primary admin. Creates programs, diet charts, communities, clinical records, staff, products. |
| **Nutritionist** (staff of a coach) | SaaS web | `organization_member`. Capabilities = a subset of the org's, granted by the owner coach. Has a professional profile. |
| **Community Manager** (staff of a coach) | SaaS web | `organization_member`. Typically `moderate_community` only; no health access. |
| **Customer / User** (consumer) | Mobile app only | Owns all their own health/meal/profile data. Grants temporary, scoped access to an org via `access_grants`. |

**Ownership rule.** Programs, diet charts, communities, enrollments, access grants,
products, clinical records and staff assignments belong to the **organization**, not
to an individual coach user. Staff continuity is automatic (a nutritionist leaves →
their diet charts and clinical notes remain owned by the org, authorship preserved).

**Ownership cardinality (PERMANENT).** One verified coach owns exactly one
organization — enforced by `UNIQUE(coach_organizations.owner_coach_id)`. Orgs gain
people only through `organization_members` (staff). `member_role` has no `coach`
value. Multi-owner / multi-coach / clinic / branch / franchise models are
**permanently out of scope** and drive no design decision.

**Ownership transfer (supported, zero-migration).** Because every asset FKs to
`organization_id` (never to `owner_coach_id`), transferring a business =
(1) update `coach_organizations.owner_coach_id`, (2) swap the `organization_members`
row whose `member_role='owner_coach'`, (3) write an audit record. No asset re-parenting.
This is the single strongest reason the org entity exists under single-owner.

**Historical attribution (PERMANENT).** Removing/suspending a member revokes only
*future* access. It must **never** rewrite history: `created_by` / author columns are
immutable values, never nulled or repointed; membership rows are status-flipped
(`removed`), never deleted. Every historical record continues to show who originally
created it.

---

## 2. Global conventions

| Concern | Decision | Notes |
|---|---|---|
| Primary keys | **UUIDv7** on all domain tables | Time-ordered → good index locality. App-layer generated (see §9). |
| `users.id` | **= Supabase `auth.users.id`** (uuid, 1:1) | RLS uses `auth.uid() = users.id`. Only PK not v7. |
| Money | **`bigint` paise** + `currency` | INR minor units; `currency` column present for future international. |
| Timestamps | **`timestamptz`** everywhere | Plus a `*_date_ist date` column where IST business-day grouping/partitioning is needed. |
| Business day | Centralized **IST helper** | `*_date_ist = (ts AT TIME ZONE 'Asia/Kolkata')::date`. Computed in app + checked in DB. |
| Controlled vocabularies | **Postgres `enum`** for *stable closed sets*; **lookup tables** for *evolving sets* | Evolving sets (`badge_types`, `notification_types`, `lab_vendors`) are tables — Postgres can't drop enum values. Stable sets (roles, statuses, `access_source_type`, capabilities) stay enums. |
| **Permissions** | **Relational capability model** | `organization_member_permissions` rows (audited, `granted_by`); `coach_capability` enum. **No JSONB permission blobs.** Non-security UI prefs may live in `organization_members.settings jsonb`. |
| Text search | **`pg_trgm`** GIN index | On `food_items.name` and `metric_definitions.display_name`. |
| Soft-delete | **3 categories** | A) user content → `deleted_at`+`deleted_by`; B) compliance/financial/clinical → immutable append-only; C) relationships → `status`+`ended_at`/`revoked_at`. |
| Audit writes | **In-transaction** for health/financial access; immutable | Never updatable/deletable. Async/batched only for low-sensitivity telemetry. |
| Tamper-evidence | **Selective hash-chaining (Phase 2)** | `prev_hash` chain on `coach_data_access_audit` + admin-access audit **only**. Not all audit tables. |
| Partitioning | **Range, monthly** | `nutrition_logs`, `nutrition_log_items`, `coach_data_access_audit`, `health_observations`, `messages`, `notifications`. See §6. |

**Soft-delete category per table is annotated `[A]`, `[B]`, or `[C]` below.**

---

## 3. Enums (complete list)

```
-- Identity & org
user_role             : admin | coach | nutritionist | community_manager | customer   -- coarse PLATFORM flags only
user_status           : active | suspended | anonymized
gender                : male | female | other | prefer_not_to_say
kyc_status            : pending | verified | rejected
org_status            : active | suspended | closed
member_role           : owner_coach | nutritionist | community_manager                 -- no 'coach'
member_status         : invited | active | suspended | removed
invitation_status     : pending | accepted | revoked | expired
coach_capability      : view_client_health | manage_programs | manage_diet_charts
                      | message_clients | moderate_community | manage_staff
                      | view_revenue | manage_lab_recommendations | manage_products
                      | write_clinical_notes | manage_care_plans

-- Access control & DPDP
grant_data_category   : health_data | meals | programs | lab_results | community | orders | messages | clinical
access_source_type    : program_enrollment | diet_assignment | lab_review | care_plan | collaboration_agreement | manual_consent
grant_type            : primary | collaborating
access_level          : view_only | full
grant_status          : active | revoked | expired
consent_type          : data_processing | health_data_sharing | marketing | terms | coach_access | clinical_care
audit_acting_as       : owner_coach | nutritionist | community_manager | collaborating_specialist | admin
audit_resource_type   : lab_report | health_observation | nutrition_log | program | diet_chart
                      | care_plan | clinical_note | message | asset | profile | community
                      | access_grant | member_permission        -- [HARDENING] see note below
audit_action          : view | export | update | download | grant | revoke   -- [HARDENING] see note below

  [HARDENING CORRECTION — access-control change auditing]
  The trailing audit_resource_type values (access_grant, member_permission) and
  audit_action values (grant, revoke) are an authorized additive extension, NOT a
  business-model change. The original value set described data-READ access only and
  could not express access-control CHANGE events, yet the spec's own audit triggers
  require them: tg_audit_grant_change (IMPL_SPEC §4.5) records grant create/revoke/
  expire on access_grants, and tg_audit_permission_change (IMPL_SPEC §4.2) records
  staff-capability grant/revoke on organization_member_permissions. Mapping:
    • access_grant      → resource_type for an access_grants row change
    • member_permission → resource_type for an organization_member_permissions change
    • grant             → action: grant created / capability added (INSERT)
    • revoke            → action: grant revoked-or-expired / capability removed (DELETE)
  Grant EXPIRY is recorded as 'revoke'; the precise cause (revoked vs expired) stays
  on the linked access_grants row, reachable via the audit row's resource_id, so no
  separate 'expire' action is needed. audit_acting_as is intentionally NOT extended:
  the actor's capacity is the actor's organization_members.member_role (owner_coach |
  nutritionist | community_manager), all already valid acting_as values, or 'admin'.
  Applied by migrations/post/0100_audit_enum_hardening.sql (authoritative under the
  migrate-first pipeline) and mirrored in 0002_enums.sql and schema/enums.ts.
deletion_status       : requested | processing | completed | rejected
support_reason_code   : support_ticket | compliance_investigation | legal_request | fraud_review
support_approval_mode : self | dual | break_glass
support_status        : requested | active | expired | revoked

-- Programs & nutrition
program_status        : draft | published | archived
program_visibility    : public | private | invite_only
session_content_type  : video | article | live | task
enrollment_status     : active | completed | cancelled | expired
meal_type             : breakfast | lunch | dinner | snack
diet_chart_status     : draft | active | archived
assignment_status     : active | paused | ended
nutrition_source      : manual | diet_chart | recipe
food_source           : system | coach | user

-- Health (redesigned: catalog + observations)
metric_category       : vital | body_composition | activity | sleep | nutrition_derived | lab | wearable
metric_value_type     : numeric | integer | boolean | enum
health_obs_source     : manual | wearable | lab | coach_entered

-- Gamification (badge kinds → badge_types lookup table, not an enum)
streak_type           : meal_logging | health_logging | program | overall
leaderboard_scope     : program | platform
leaderboard_period    : weekly | monthly | all_time

-- Community
post_type             : text | image | recipe | poll | announcement
post_status           : active | hidden | removed
flag_reason           : spam | abuse | misinformation | inappropriate | other
flag_status           : open | reviewed | actioned | dismissed
-- friend_status REMOVED (no friends graph; messaging is co-membership-scoped)

-- Messaging (new)
conversation_type     : coach_user | staff_user | care_team | community_peer
conversation_status   : active | archived

-- Clinical coaching (new)
clinical_note_type    : observation | assessment | progress_note | recommendation | addendum
note_visibility       : internal | shared_with_user
clinical_author_role  : owner_coach | nutritionist | collaborating_specialist
intervention_status   : active | completed | cancelled
outcome_status        : on_track | achieved | missed | abandoned

-- Assets (new)
asset_type            : lab_report_pdf | health_photo | message_attachment | profile_image
                      | program_media | clinical_attachment | other
asset_status          : active | deleted

-- Subscriptions, payments, billing & compliance
billing_interval      : monthly | yearly
limit_metric          : staff_count | active_clients | program_count | diet_chart_count | monthly_revenue_paise | storage_mb
subscription_status   : active | past_due | cancelled | paused
payment_status        : created | authorized | captured | failed | refunded
revenue_split_status  : pending | processed | failed
webhook_provider      : razorpay | lab_vendor
invoice_status        : draft | issued | paid | cancelled
credit_note_status    : issued | applied
refund_status         : requested | processing | processed | failed
dispute_status        : open | under_review | won | lost | accepted
payout_status         : pending | processing | paid | failed
settlement_status     : pending | reconciled | discrepancy

-- Collaboration & care
collab_request_status : pending | accepted | declined | cancelled
collab_meeting_status : scheduled | completed | cancelled
collab_agreement_status : active | ended
care_plan_status      : active | completed | archived
care_team_role        : lead | nutritionist | community_manager | collaborating_specialist
care_member_status    : active | removed

-- Notifications & lab (notification kinds & lab vendors → lookup tables)
notification_priority : low | normal | high
lab_booking_status    : pending | booked | sample_collected | processing | reported | cancelled
lab_payment_status    : pending | paid | refunded
lab_report_status     : pending | ready
```

---

## 4. Tables by domain

> Notation: `PK` uuidv7 unless noted. `→T` = FK to table T. `[A/B/C]` = soft-delete category.
> Every table has `created_at timestamptz` (and `updated_at` where mutable) even if not re-listed.

### D0 — Organizations & Membership (the workspace layer)

**`coach_organizations`** `[C]` — the business / billing / ownership boundary (the "account"). Lean anchor; assets FK here.
- `id` PK · `owner_coach_id →users` · `business_name` (display/brand) · `slug` (unique)
- `status org_status` (default active)
- **Unique:** `(owner_coach_id)` — **one org per coach, permanent** · unique `(slug)`
- **Removed:** `subscription_id` (resolved the org↔subscription cycle; the link lives on `coach_subscriptions.organization_id`).
- Ownership transfer = update `owner_coach_id` + swap the `owner_coach` member row + audit (no asset migration).

**`organization_members`** `[C]` — owner coach + staff
- `id` PK · `organization_id →coach_organizations` · `user_id →users`
- `member_role member_role` · `status member_status` (default invited)
- `invited_by →users` · `invited_at` · `joined_at` · `removed_at` · `settings jsonb` (**non-security UI prefs only**)
- **Partial unique:** `(organization_id, user_id) WHERE status <> 'removed'` (one live membership per user/org)
- **Partial unique:** `(organization_id) WHERE member_role='owner_coach'` (exactly one owner row per org)
- Trigger: the `owner_coach` row's `user_id` must equal `coach_organizations.owner_coach_id` (keeps the two in sync)
- Index: `(user_id)` (reverse lookup)

**`organization_member_permissions`** — **relational capability grants** (replaces the old `permissions jsonb`)
- `id` PK · `member_id →organization_members` · `capability coach_capability`
- `granted_by →users` · `granted_at`
- **Unique:** `(member_id, capability)`
- Invariant: owner_coach holds **all** capabilities implicitly (no rows needed); staff hold an explicit, owner-delegated subset. RLS forbids a member writing their **own** permission rows (no self-escalation).

**`organization_profiles`** `[A]` — 1:1 **business identity** (public + financial), separate from the coach *person*
- `id` PK · `organization_id →coach_organizations` (unique)
- `legal_name` · `logo_asset_id →assets` · `description` · `website_url` · `social_links jsonb`
- `gstin` · `business_address jsonb` · `kyc_status kyc_status` · `razorpay_linked_account_id` (nullable — **set only after KYC verified**)
- `pan_encrypted` · `bank_details_encrypted` (app-layer encryption; raw values never plaintext)

**`invitations`** `[C]` — staff onboarding before a `users` row exists
- `id` PK · `organization_id →coach_organizations` · `email` · `invited_role member_role`
- `token` (unique) · `status invitation_status` · `invited_by →users` · `expires_at`
- `accepted_user_id →users` (nullable) · `accepted_at`

### D1 — Identity & Auth

**`users`** `[A → anonymize, §7]` — mirrors `auth.users`
- `id` PK **= auth.users.id** · `phone` (unique, +91) · `email` (nullable, unique) · `full_name` · `avatar_asset_id →assets`
- `roles user_role[]` (**coarse platform flags only** — org authority comes from `organization_members`, never from here)
- `status user_status` · `is_anonymized bool` · `last_active_at`

**`user_profiles`** `[A]` — 1:1 consumer profile
- `id` PK · `user_id →users` (unique) · `date_of_birth` · `gender gender`
- `city` · `state` · `country` (default 'India') · `locale` · `timezone` (default 'Asia/Kolkata')
- `goals jsonb` · `dietary_preferences jsonb` · `onboarding_completed_at`
- (Baseline height/weight are now `health_observations`, not profile columns.)

**`professional_profiles`** `[A]` — **generalized** per-person professional identity (owner coaches, nutritionists, future credentialed specialists). Keyed by user; role context comes from `organization_members`, not duplicated here.
- `id` PK · `user_id →users` (unique) · `display_name` · `bio` · `photo_asset_id →assets`
- `specialties text[]` · `credentials jsonb` · `years_experience` · `languages text[]`
- `rating_avg` · `rating_count`
- **No `organization_id`** (derived via `organization_members`). No business/financial/KYC data (that's `organization_profiles`).

### D2 — Access Control & DPDP

**`access_grants`** `[C]` — **grantee is the organization**, scoped to staff by capability, **bound to its source**
- `id` PK · `organization_id →coach_organizations` (grantee) · `user_id →users` (data subject / customer)
- `source_type access_source_type` · `source_id uuid` — **the record that justifies this grant** (enrollment, assignment, lab review, care plan, agreement, or manual consent)
- `data_categories_granted grant_data_category[]` · `grant_type grant_type` · `access_level access_level` · `status grant_status`
- `start_date` · `end_date` (nullable) · `revoked_at` · `revoked_by →users`
- **Partial unique:** `(organization_id, user_id, source_type, source_id) WHERE status='active'` — **one live grant per source**. Two simultaneous program enrollments = two sources = two grants (the R2 bug is fixed).
- RLS liveness test: `status='active' AND (end_date IS NULL OR end_date > now())`.
- Index: `(user_id, status)`, `(organization_id, status)`, `(source_type, source_id)`

**`dpdp_consent_records`** `[B immutable]` — append-only consent ledger
- `id` PK · `user_id →users` · `consent_type consent_type` · `consent_version`
- `consent_text_snapshot text` (full text at time of consent) · `granted bool`
- `granted_at` · `revoked_at` · `ip_address` · `user_agent`
- Index: `(user_id, consent_type, created_at desc)`. **No UPDATE/DELETE** (RLS + trigger).

**`coach_data_access_audit`** `[B immutable, PARTITIONED, hash-chain Phase 2]` — who touched what
- `id` · `accessed_at timestamptz` · **PK = `(id, accessed_at)`**
- `organization_id →coach_organizations` · `accessor_user_id →users` (real person) · `data_subject_user_id →users`
- `acting_as audit_acting_as` · `resource_type audit_resource_type` · `resource_id` · `action audit_action`
- `calendar_day_ist date` · `prev_hash` / `row_hash` (Phase 2 tamper-evidence)
- Range-partition monthly on `accessed_at`. Index: `(data_subject_user_id, accessed_at desc)`, `(organization_id, accessed_at desc)`. Written **in-transaction**. **No UPDATE/DELETE.** Retention ≥ 5–7 yr (policy, §9).

**`data_deletion_requests`** `[B]` — DPDP right-to-erasure workflow
- `id` PK · `user_id →users` · `status deletion_status` · `reason`
- `requested_at` · `processed_at` · `processed_by →users` · `anonymization_completed_at`

**`admin_support_access`** `[B]` — the ONLY path for admin → customer health data (**hybrid model**)
- `id` PK · `subject_user_id →users` (data subject)
- `requested_by_admin_id →users` · `approved_by_admin_id →users` (nullable)
- `approval_mode support_approval_mode` (`self` | `dual` | `break_glass`)
- `reason_code support_reason_code` · `justification text` · `ticket_ref` · `scope_categories grant_data_category[]`
- `requested_at` · `granted_at` · `expires_at` (**time-boxed**) · `revoked_at` · `status support_status`
- `post_review_by →users` (nullable) · `post_review_at` · `post_review_note`
- **Constraints:** `approval_mode='dual'` ⇒ `approved_by_admin_id NOT NULL AND approved_by_admin_id <> requested_by_admin_id`; `approval_mode IN ('self','break_glass')` ⇒ mandatory post-hoc review (`post_review_*` filled within policy window, enforced by job + alerting).
- Every read under this case emits a `coach_data_access_audit` row with `acting_as='admin'`. **Config flag `require_second_approver` flips self→dual with no schema change.**

### D3 — Programs & Enrollment

**`programs`** `[A]` — owned by org
- `id` PK · `organization_id →coach_organizations` · `created_by_user_id →users`
- `title` · `slug` · `description` · `cover_asset_id →assets` · `price_paise bigint` · `currency`
- `duration_days` · `status program_status` · `visibility program_visibility` · `max_enrollments` (nullable) · `published_at`
- `current_version int` (default 1; → latest `program_versions`)
- **Lifecycle rule (DB-enforced):** a program with ≥1 **active** enrollment cannot be mutated — trigger blocks UPDATE of content fields; editing requires pulling from discovery and waiting for active enrollments to complete.
- Index: `(organization_id, status)`, unique `(organization_id, slug)`

**`program_versions`** `[B immutable]` — **publish-time snapshot** (history/compliance record of what was delivered; *not* the live read path)
- `id` PK · `program_id →programs` · `version_number int` · `snapshot jsonb` (program + modules + sessions at publish)
- `created_by_user_id →users` · `change_summary` · unique `(program_id, version_number)`

**`program_modules`** — `id` PK · `program_id →programs` · `title` · `description` · `sort_order`

**`program_sessions`** — `id` PK · `module_id →program_modules` · `program_id →programs` (denormalized)
- `title` · `content_type session_content_type` · `video_url` · `content jsonb` · `duration_seconds` · `sort_order`

**`program_enrollments`** `[C]`
- `id` PK · `program_id →programs` · `program_version_id →program_versions` (**stamped at enrollment** for as-delivered history) · `organization_id →coach_organizations` (denorm) · `user_id →users`
- `status enrollment_status` · `enrolled_at` · `started_at` · `completed_at` · `cancelled_at` · `expires_at`
- `progress_pct smallint` (denorm from `session_watches`) · `payment_id →enrollment_payments` (nullable)
- **Partial unique:** `(program_id, user_id) WHERE status='active'` (re-enrollment allowed after cancel/expire)
- Index: `(user_id, status)`
- *Live experience reads the live program tables (stable during enrollment per the lifecycle rule); the version stamp is for completed-enrollment history.*

**`session_watches`** — `id` PK · `enrollment_id →program_enrollments` · `session_id →program_sessions` · `user_id →users`
- `watched_seconds` · `completed bool` · `last_watched_at` · unique `(enrollment_id, session_id)`

> **Removed:** `program_history_summaries` — reconstructable from `program_versions` + `program_enrollments.program_version_id` + `session_watches`.

### D4 — Nutrition & Diet

**`food_items`** — `id` PK · `name` · `brand` · `category` · `serving_size_g`
- `calories` · `protein_g` · `carbs_g` · `fat_g` · `fiber_g` · `micronutrients jsonb`
- `source food_source` · `is_verified bool` · `created_by_user_id →users` (nullable) · **GIN `pg_trgm` on `name`**

**`recipes`** `[A]` — `id` PK · `organization_id →coach_organizations` (nullable = system) · `created_by_user_id →users`
- `title` · `description` · `instructions jsonb` · `servings` · `prep_minutes` · `total_calories` (denorm) · `is_public bool`

**`recipe_ingredients`** — `id` PK · `recipe_id →recipes` · `food_item_id →food_items` (nullable) · `name` · `quantity_g` · `sort_order`

**`diet_charts`** `[A]` — owned by org, attributed to author
- `id` PK · `organization_id →coach_organizations` · `authored_by_user_id →users`
- `title` · `description` · `total_daily_calories` · `status diet_chart_status` · `current_version int`

**`diet_chart_meals`** — `id` PK · `diet_chart_id →diet_charts` · `meal_type meal_type`
- `name` · `time_of_day` · `items jsonb` · `notes` · `sort_order`

**`diet_chart_assignments`** `[C]` — `id` PK · `diet_chart_id →diet_charts` · `diet_chart_version_id →diet_chart_versions` (stamped) · `user_id →users` · `organization_id →coach_organizations`
- `assigned_by_user_id →users` · `status assignment_status` · `start_date` · `end_date`
- **Partial unique:** `(diet_chart_id, user_id) WHERE status='active'`

**`diet_chart_versions`** `[B immutable]` — assign-time snapshot; clinical/legal record of exactly what a customer followed
- `id` PK · `diet_chart_id →diet_charts` · `version_number int` · `snapshot jsonb`
- `authored_by_user_id →users` · `change_summary` · unique `(diet_chart_id, version_number)`

**`nutrition_logs`** `[A, PARTITIONED]` — parent meal log
- `id` · `logged_date_ist date` · **PK = `(id, logged_date_ist)`**
- `user_id →users` · `logged_at timestamptz` · `meal_type meal_type` · `total_calories` (denorm) · `note` · `source nutrition_source`
- Range-partition monthly on `logged_date_ist`. Index: `(user_id, logged_date_ist desc)`

**`nutrition_log_items`** `[A, PARTITIONED]` — child items (**cross-program meal mixing**)
- `id` · `logged_date_ist date` · **PK = `(id, logged_date_ist)`**
- `nutrition_log_id` · `user_id →users` (denorm for RLS) · `food_item_id →food_items` (nullable)
- `source_diet_chart_id →diet_charts` (nullable) · `source_meal_id →diet_chart_meals` (nullable)
- `name` · `quantity_g` · `calories` · `protein_g` · `carbs_g` · `fat_g`
- Range-partition monthly on `logged_date_ist`. Index: `(user_id, logged_date_ist desc)`

### D5 — Health Data (redesigned: catalog + observations)

**`metric_definitions`** — the metric catalog; adding a metric = a row, not a migration. Drives validation, units, and international conversions.
- `id` PK · `code` (unique, e.g. `blood_pressure_systolic`) · `display_name` · `category metric_category`
- `value_type metric_value_type` · `canonical_unit` · `unit_conversions jsonb` · `compound_group` (nullable; links systolic/diastolic) · `is_active bool`
- **GIN `pg_trgm` on `display_name`**

**`health_observations`** `[A, PARTITIONED]` — one scalar observation per row; replaces `health_logs` (kills `value_secondary` overloading)
- `id` · `measured_date_ist date` · **PK = `(id, measured_date_ist)`**
- `subject_user_id →users` · `metric_definition_id →metric_definitions`
- `value_numeric numeric` · `value_bool` · `value_text` · `unit` · `reading_group_id uuid` (nullable; groups compound readings like BP)
- `measured_at timestamptz` · `source health_obs_source` · `source_device_id` · `source_external_id` · `recorded_by_user_id →users`
- Range-partition monthly on `measured_date_ist`. Index: `(subject_user_id, metric_definition_id, measured_date_ist desc)`
- Lab analytes are also normalized here (`source='lab'`) so manual/wearable/lab trends unify in one query path.

> **Deferred (not at launch):** `wearable_connections` (per-user OAuth tokens + sync cursors for Apple Health / Google Fit / Fitbit / Garmin). The model already accepts `source='wearable'`; the table ships when the wearable integration is built.

### D6 — Gamification

**`badge_types`** — lookup (evolving set; new badges without enum churn)
- `id` PK · `key` (unique) · `name` · `description` · `icon_asset_id →assets` (nullable) · `criteria jsonb` · `is_active bool`

**`user_streaks`** — `id` PK · `user_id →users` · `streak_type streak_type` · `current_count` · `longest_count` · `last_activity_date_ist` · unique `(user_id, streak_type)`

**`user_badges`** — `id` PK · `user_id →users` · `badge_type_id →badge_types` · `awarded_at` · `metadata jsonb` · unique `(user_id, badge_type_id)`

**`leaderboard_scores`** — `id` PK · `user_id →users` · `scope leaderboard_scope` · `program_id →programs` (nullable when platform)
- `period leaderboard_period` · `score bigint` · `rank int` (nullable) · `period_start_date` · Index: `(scope, program_id, period, score desc)`
- DB is source-of-truth; serving path may use a Redis sorted-set at scale.

### D7 — Community

**`community_posts`** `[A]` — community belongs to an org
- `id` PK · `organization_id →coach_organizations` · `author_user_id →users` · `post_type post_type`
- `body` · `media jsonb` · `recipe_id →recipes` (nullable) · `like_count` · `comment_count` (denorm)
- `status post_status` · `is_pinned bool` · `deleted_at` · `deleted_by →users` · Index: `(organization_id, created_at desc)`

**`post_comments`** `[A]` — `id` PK · `post_id →community_posts` · `author_user_id →users` · `parent_comment_id` (nullable) · `body` · `like_count` · `status post_status` · `deleted_at` · `deleted_by`

**`post_likes`** — `id` PK · `post_id →community_posts` · `user_id →users` · unique `(post_id, user_id)`

**`post_poll_votes`** — `id` PK · `post_id →community_posts` · `user_id →users` · `option_index int` · unique `(post_id, user_id)`

**`post_flags`** `[C]` — moderation queue for community managers
- `id` PK · `post_id →community_posts` (nullable) · `comment_id →post_comments` (nullable) · `reporter_user_id →users`
- `reason flag_reason` · `status flag_status` · `reviewed_by →users`

> **Removed:** `friends` — Vitalé is not a social network. Peer messaging is gated by **shared active context** (same community / program cohort), not a friends graph (§D13).

### D8 — Subscriptions, Payments, Billing & Compliance (all `bigint` paise; `[B]` immutable for financial records)

**Configurable subscription architecture** — plans are **data-driven**; new tiers/limits ship with no schema change.

**`subscription_plans`** — `id` PK · `code` (unique) · `name` · `description` · `price_paise bigint` · `currency`
- `billing_interval billing_interval` · `razorpay_plan_id` · `is_active bool` · `sort_order`

**`subscription_features`** — `id` PK · `plan_id →subscription_plans` · `feature_key` · `feature_value jsonb` · unique `(plan_id, feature_key)`

**`plan_limits`** — `id` PK · `plan_id →subscription_plans` · `limit_key limit_metric` · `limit_value bigint` (nullable = unlimited) · unique `(plan_id, limit_key)`

**`billing_metrics`** — per-org usage **rollup/reporting** (not the enforcement mechanism)
- `id` PK · `organization_id →coach_organizations` · `metric_key limit_metric` · `metric_value bigint`
- `period_start` · `period_end` · `recorded_at` · Index `(organization_id, metric_key, period_start desc)`
- **Limit enforcement** is a transactional live-count + reservation at write time (`SELECT … FOR UPDATE` on a per-org counter / in-tx `COUNT` vs `plan_limits`), *not* a read of this table.

**`coach_subscriptions`** `[B]` — billing for the org (B2B)
- `id` PK · `organization_id →coach_organizations` (authoritative link) · `owner_coach_id →users`
- `plan_id →subscription_plans` · `razorpay_subscription_id` · `status subscription_status`
- `current_period_start` · `current_period_end` · `amount_paise bigint` · `cancelled_at`
- **Partial unique:** `(organization_id) WHERE status='active'` (one active subscription per org)

**`coach_invoices`** `[B immutable once issued]` — **GST tax invoice** for SaaS billing (seller = Vitalé, buyer = org)
- `id` PK · `organization_id →coach_organizations` · `subscription_id →coach_subscriptions` (nullable)
- `invoice_number` (unique, sequential per fiscal year) · `status invoice_status`
- `place_of_supply_state` · `seller_gstin` · `buyer_gstin` (nullable)
- `subtotal_paise bigint` · `tax_total_paise bigint` · `total_paise bigint` · `currency`
- `issued_at` · `due_at` · `paid_at`

**`invoice_line_items`** `[B]` — `id` PK · `invoice_id →coach_invoices` · `description` · `hsn_sac_code`
- `quantity` · `unit_price_paise bigint` · `taxable_value_paise bigint`
- `cgst_paise bigint` · `sgst_paise bigint` · `igst_paise bigint` · `line_total_paise bigint`

**`credit_notes`** `[B immutable]` — GST-correct refunds/adjustments against an invoice
- `id` PK · `invoice_id →coach_invoices` · `credit_note_number` (unique) · `reason`
- `amount_paise bigint` · `tax_reversed_paise bigint` · `status credit_note_status` · `issued_at`

**`enrollment_payments`** `[B]` — customer → program payment (B2C)
- `id` PK · `enrollment_id →program_enrollments` · `user_id →users` · `organization_id →coach_organizations` · `program_id →programs`
- `amount_paise bigint` · `currency` · `razorpay_order_id` · `razorpay_payment_id` · `status payment_status` · `captured_at`

**`revenue_splits`** `[B]` — Razorpay Route split per payment
- `id` PK · `payment_id →enrollment_payments` · `organization_id →coach_organizations`
- `platform_fee_paise bigint` · `coach_amount_paise bigint` · `razorpay_transfer_id` · `status revenue_split_status` · `processed_at`
- **Reconciliation constraint:** `platform_fee_paise + coach_amount_paise = captured amount` (trigger/CHECK against the payment).

**`refunds`** `[B]` — B2C refunds
- `id` PK · `payment_id →enrollment_payments` · `amount_paise bigint` · `reason` · `razorpay_refund_id`
- `status refund_status` · `initiated_by →users` · `processed_at`

**`disputes`** `[B]` — chargebacks
- `id` PK · `payment_id →enrollment_payments` · `razorpay_dispute_id` (unique) · `amount_paise bigint`
- `reason_code` · `status dispute_status` · `evidence jsonb` · `opened_at` · `resolved_at`

**`payouts`** `[B]` — settlement of coach earnings to the org's Razorpay account
- `id` PK · `organization_id →coach_organizations` · `razorpay_transfer_id` · `amount_paise bigint`
- `period_start` · `period_end` · `status payout_status` · `processed_at`

**`settlements`** `[B]` — provider settlement reconciliation
- `id` PK · `provider webhook_provider` · `settlement_ref` (unique) · `gross_paise bigint` · `fees_paise bigint` · `tax_paise bigint` · `net_paise bigint` · `settled_at` · `status settlement_status` · `reconciled_at`

**`payment_webhook_events`** `[B]` — idempotent webhook intake (signature-verified)
- `id` PK · `provider webhook_provider` · `event_type` · `provider_event_id` (**unique → idempotency**) · `payload jsonb` · `processed bool` · `processed_at` · `received_at`

### D9 — Collaboration & Care (cross-coach on a shared customer)

**`collaboration_requests`** `[C]` — `id` PK · `from_organization_id →coach_organizations` · `to_organization_id →coach_organizations` · `user_id →users` (shared customer) · `status collab_request_status` · `message` · `requested_by →users` · `responded_at`

**`collaboration_meetings`** `[C]` — push notification, not Realtime
- `id` PK · `collaboration_request_id →collaboration_requests` (nullable) · `organization_id →coach_organizations` · `user_id →users` (nullable)
- `title` · `scheduled_at timestamptz` · `duration_minutes` · `meeting_url` · `status collab_meeting_status` · `created_by →users`

**`collaboration_agreements`** `[C]` — governs a multi-coach customer
- `id` PK · `primary_organization_id →coach_organizations` · `collaborating_organization_id →coach_organizations` · `user_id →users`
- `terms jsonb` · `revenue_share_pct` · `status collab_agreement_status` · `start_date` · `end_date`

**`care_plans`** `[C]` — the plan that anchors a customer's care
- `id` PK · `organization_id →coach_organizations` (primary org) · `user_id →users` (customer)
- `title` · `description` · `status care_plan_status` · `created_by_user_id →users` · `current_version int` · `start_date` · `end_date`
- Index `(user_id, status)`, `(organization_id, status)`

**`care_team_members`** `[C]` — specialists on the plan, with **per-customer** scoped capabilities
- `id` PK · `care_plan_id →care_plans` · `member_user_id →users` · `organization_id →coach_organizations`
- `role_in_team care_team_role` · `capabilities coach_capability[]` (typed array; always ⊆ the member's org capabilities) · `status care_member_status`
- `collaboration_agreement_id →collaboration_agreements` (nullable; set for **cross-org** specialists) · `added_by →users` · `added_at` · `removed_at`
- **Partial unique:** `(care_plan_id, member_user_id) WHERE status='active'`

**`care_plan_versions`** `[B immutable]` — snapshot history of a care plan
- `id` PK · `care_plan_id →care_plans` · `version_number int` · `snapshot jsonb` · `authored_by_user_id →users` · `change_summary` · unique `(care_plan_id, version_number)`

> **Three-layer permission model:** a specialist's effective access to a customer's data =
> **`access_grants`** (org→customer consent layer) **∩** **org-member capabilities** (`organization_member_permissions`) **∩**
> **`care_team_members.capabilities`** (per-customer). Most restrictive wins.

### D10 — Notifications

**`notification_types`** — lookup (evolving set) · `id` PK · `key` (unique) · `name` · `default_priority notification_priority` · `is_active bool`

**`notifications`** `[A, PARTITIONED]` — user-facing Realtime backbone
- `id` · `created_date_ist date` · **PK = `(id, created_date_ist)`**
- `user_id →users` (recipient) · `notification_type_id →notification_types` · `title` · `body` · `data jsonb`
- `read bool` · `read_at` · `priority notification_priority`
- Range-partition monthly on `created_date_ist`. Index: `(user_id, read, created_date_ist desc)`

### D11 — Lab Tests (de-vendored; org-aware)

**`lab_vendors`** — lookup (de-vendors Labs; onboard a 2nd provider without schema change)
- `id` PK · `code` (unique, e.g. `thyrocare`) · `name` · `config jsonb` · `is_active bool`

- **`lab_packages`** `[A]` — **platform-owned, vendor-managed** catalog; uuidv7 PK, `bigint` paise, `timestamptz`; `lab_vendor_id →lab_vendors` · `vendor_ref`.
- **`lab_tests`** — catalog detail; `lab_vendor_id →lab_vendors` · `vendor_ref`.
- **`lab_bookings`** `[C]` — `user_id →users`; `status lab_booking_status`; `payment_status lab_payment_status`; `amount_paise bigint`; `vendor_ref`.
- **`lab_reports`** `[A]` — **health data, RLS-protected**; `user_id →users`; `status lab_report_status`; `report_asset_id →assets` (PDF).
- **`lab_report_results`** — `report_id →lab_reports` (cascade); analytes also normalized into `health_observations`.
- **`coach_lab_recommendations`** — `organization_id →coach_organizations` + `recommended_by_user_id →users` (coaches *recommend*, do not own lab packages).

### D12 — Commerce / Shop (org-owned; new conventions)

`products` and all shop assets **belong to the organization** (`organization_id NOT NULL`); lab packages remain platform-owned (D11).

`product_categories`, **`products`** (`organization_id →coach_organizations` **NOT NULL**), `product_variants`, `product_reviews`,
`shop_banners` (`organization_id`), `coach_product_recommendations` (`organization_id` + `recommended_by_user_id`),
`addresses`, `carts`, `cart_items`, `shop_orders` `[B]`, `shop_order_items`, `shop_order_events`, `invoices` `[B]`.
All uuidv7 PK, `bigint` paise + `currency`, `timestamptz`, enum statuses.

### D13 — Messaging (new, first-class; co-membership-scoped)

Coach↔User, Staff↔User, care-team, and **peer** (community/cohort) messaging. **No friends graph** — a peer conversation requires both users to **share an active context** (same community / program cohort). Coach/staff↔user requires an **active `access_grant`** + `message_clients` capability.

**`conversations`** `[C]` — `id` PK · `organization_id →coach_organizations` (nullable only for pure peer) · `conversation_type conversation_type` · `subject_user_id →users` (nullable; the customer for coach/care contexts) · `status conversation_status`

**`conversation_participants`** — `id` PK · `conversation_id →conversations` · `user_id →users` · `joined_at` · `left_at` · `last_read_at`
- **Partial unique:** `(conversation_id, user_id) WHERE left_at IS NULL`

**`messages`** `[A, PARTITIONED]` — chat: **editable, soft-deletable, authorship immutable**
- `id` · `created_date_ist date` · **PK = `(id, created_date_ist)`**
- `conversation_id →conversations` · `sender_user_id →users` (**never updated** — authorship preserved through edits/deletes)
- `body` · `edited_at` (set on edit) · `deleted_at` (soft delete → tombstone)
- Range-partition monthly on `created_date_ist`. Index: `(conversation_id, created_date_ist desc)`

**`message_attachments`** — `id` PK · `(message_id, message_created_date_ist) →messages(id, created_date_ist)` (composite FK to partitioned parent) · `asset_id →assets` · `sort_order`

> **Deferred (not at launch):** `message_flags` (DM abuse reporting) — ships only if open peer DMs warrant it; community already has `post_flags`.

### D14 — Clinical Coaching (new, first-class; append-only)

Core platform capability (observations, recommendations, interventions, outcomes, user-visible feedback). Clinical records are **append-only**; corrections are addenda, never edits. Authorship preserved permanently.

**`clinical_notes`** `[B immutable]` — single-table self-referencing model
- `id` PK · `organization_id →coach_organizations` · `author_member_id →organization_members` (**immutable**; resolves to person + role)
- `author_role_at_time clinical_author_role` (**snapshot** so "written as nutritionist" survives later promotion)
- `subject_user_id →users` · `care_plan_id →care_plans` (nullable) · `note_type clinical_note_type`
- `parent_note_id →clinical_notes` (set **iff** `note_type='addendum'`) · `body` · `visibility note_visibility`
- **No `edited_at`/`deleted_at`/`updated_at`.** RLS denies UPDATE/DELETE to all roles.
- **CHECK:** `(note_type='addendum') = (parent_note_id IS NOT NULL)`
- Index: `(subject_user_id, created_at desc)`, `(care_plan_id)`

**`interventions`** — `id` PK · `care_plan_id →care_plans` · `subject_user_id →users` · `author_member_id →organization_members`
- `intervention_type` · `description` · `status intervention_status` · `started_at` · `ended_at`

**`outcomes`** — `id` PK · `care_plan_id →care_plans` · `subject_user_id →users` · `metric_definition_id →metric_definitions` (nullable) · `label`
- `baseline_value numeric` · `target_value numeric` · `observed_value numeric` · `status outcome_status` · `measured_at`

### D15 — Assets (new; PHI media gateway)

**`assets`** `[A]` — every uploaded file; access via **signed URLs minted by the API after an RLS/permission check** (object storage is *not* under Postgres RLS). PHI access is audited. **No polymorphic `asset_links`** — owning rows hold a typed `*_asset_id` FK; messages use `message_attachments`.
- `id` PK · `organization_id →coach_organizations` (owner; nullable for user-owned) · `uploaded_by_user_id →users` · `subject_user_id →users` (nullable; PHI subject)
- `asset_type asset_type` · `is_phi bool` · `storage_bucket` · `storage_path` · `mime_type` · `size_bytes` · `checksum`
- `retention_until date` (nullable) · `status asset_status` · `deleted_at`
- Erasure = delete object + anonymize row (audit retained). Index: `(subject_user_id) WHERE is_phi`, `(organization_id)`

---

## 5. Relationship map (key edges)

```
users ─1:1─ user_profiles
users ─1:1─ professional_profiles            (owner coaches, nutritionists, specialists)
coach_organizations ─1:1─ organization_profiles ─1:1(owner)→ users
coach_organizations ─1:N─ organization_members ─1:N─ organization_member_permissions
coach_organizations ─1:N─ invitations
coach_organizations ─1:1(active)─ coach_subscriptions ──→ subscription_plans ─1:N─ subscription_features / plan_limits
coach_subscriptions ─1:N─ coach_invoices ─1:N─ invoice_line_items ; coach_invoices ─1:N─ credit_notes
coach_organizations ─1:N─ programs ─1:N─ program_modules ─1:N─ program_sessions
programs ─1:N─ program_versions ; program_enrollments →program_versions (as-delivered stamp)
programs ─1:N─ program_enrollments ──→ users ─1:N─ session_watches
coach_organizations ─1:N─ diet_charts ─1:N─ diet_chart_meals ; diet_charts ─1:N─ diet_chart_versions
diet_charts ─1:N─ diet_chart_assignments ──→ users
users ─1:N─ nutrition_logs ─1:N─ nutrition_log_items ┄┄→ diet_charts (source mixing)
metric_definitions ─1:N─ health_observations ──→ users (subject)        [labs normalize in here too]
users ──(data subject)── access_grants ──(grantee)── coach_organizations ┄ bound to (source_type, source_id)
access_grants ∩ organization_member_permissions ∩ care_team_members.capabilities  → effective access
coach_organizations ─1:N─ community_posts ─1:N─ post_comments / post_likes / post_poll_votes / post_flags
enrollment_payments ─1:1─ revenue_splits ; enrollment_payments ─1:N─ refunds / disputes
coach_organizations ─1:N─ payouts ; settlements ←reconcile→ revenue_splits / payouts
coach_organizations ─1:N─ care_plans ──→ users ─1:N─ care_plan_versions / interventions / outcomes / clinical_notes
care_plans ─1:N─ care_team_members ──→ users   [┄ collaboration_agreements for cross-org]
conversations ─1:N─ conversation_participants ──→ users ; conversations ─1:N─ messages ─1:N─ message_attachments →assets
clinical_notes ─self─ parent_note_id (addenda) ; author_member_id →organization_members (immutable)
assets ←typed FK← organization_profiles.logo / users.avatar / professional_profiles.photo / programs.cover / lab_reports.pdf
coach_data_access_audit ──→ accessor_user_id + data_subject_user_id + organization_id
```

---

## 6. Partitioning design

Six high-volume tables are **range-partitioned by month** from day one:
`nutrition_logs`, `nutrition_log_items`, `coach_data_access_audit`, `health_observations`,
`messages`, `notifications`.

**Consequences modeled in the schema:**
- The partition key is part of the PK → composite PKs `(id, <date>)`.
- FKs into a partitioned parent use the composite key (e.g. `message_attachments → messages(id, created_date_ist)`; supported PG12+).
- Drizzle's `pgTable` cannot declare `PARTITION BY` → parent tables created via **raw SQL migrations** (committed beside the generated Drizzle migration); Drizzle models the logical table for `select`/`insert`.

**Raw SQL companion (illustrative):**
```sql
CREATE TABLE health_observations (
  id uuid NOT NULL,
  measured_date_ist date NOT NULL,
  subject_user_id uuid NOT NULL REFERENCES users(id),
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id),
  value_numeric numeric, value_bool boolean, value_text text, unit text,
  reading_group_id uuid,
  measured_at timestamptz NOT NULL,
  source health_obs_source NOT NULL DEFAULT 'manual',
  recorded_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, measured_date_ist)
) PARTITION BY RANGE (measured_date_ist);

CREATE TABLE health_observations_2026_06 PARTITION OF health_observations
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```
**Provisioning:** `pg_partman` (preferred on Supabase) or a `pg_cron` monthly job creating next month's partition. **Retention:** `coach_data_access_audit` ≥ 5–7 yr (health-access compliance, §9); others per product/legal policy.

---

## 7. RLS, permissions & access-control guarantees (Supabase)

RLS is **ON for every table**. `auth.uid()` returns the caller's `users.id`.

**Permission model (relational).** Org authority = `organization_member_permissions` rows.
Owner_coach holds all capabilities implicitly; staff hold an owner-delegated subset; a
member can never write **their own** permission rows (no self-escalation). Care-team
capabilities are a typed `coach_capability[]` per customer, always ⊆ the member's org set.

**Helper functions (SECURITY DEFINER, raw SQL migration):**
```sql
has_capability(member uuid, cap coach_capability) returns boolean   -- owner ⇒ true; else a permission row exists
is_org_member(org uuid, cap coach_capability) returns boolean       -- caller is an ACTIVE member of org with cap
org_has_active_grant(org uuid, subject uuid, category grant_data_category) returns boolean
                                                                    -- status='active' AND (end_date IS NULL OR end_date>now())
can_read_health(subject uuid) returns boolean                       -- owner OR (active member w/ view_client_health
                                                                    --   AND active grant) ∩ care_team scope when a care_plan exists
on_care_team(subject uuid, cap coach_capability) returns boolean
shares_active_context(a uuid, b uuid) returns boolean               -- co-membership of a community/program cohort (peer messaging gate)
is_admin() returns boolean
admin_has_support_access(subject uuid) returns boolean              -- ACTIVE, unexpired admin_support_access row
```

**Policy summary (representative):**

| Table | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `users`, `user_profiles`, `professional_profiles` | self; admins; org members for shared customers via grant | self only (admins limited) |
| `health_observations`, `nutrition_logs(_items)`, `lab_reports` | **owner** OR `can_read_health(subject)` OR `admin_has_support_access(subject)` | owner only |
| `metric_definitions` | public read | admins only |
| `access_grants` | data subject; members of grantee org | data subject creates/revokes; org cannot self-grant |
| `organization_member_permissions` | org members; admins | owner / `manage_staff` members; **a member cannot edit their own rows** |
| `coach_data_access_audit`, `dpdp_consent_records` | data subject; admins | INSERT only; **UPDATE/DELETE denied** (immutable) |
| `clinical_notes` | author's org members w/ grant + `write_clinical_notes`; subject when `visibility='shared_with_user'` | INSERT only; **UPDATE/DELETE denied**; corrections via addendum rows |
| `messages` | active `conversation_participants` | sender may edit `body`/`edited_at` + set `deleted_at`; **`sender_user_id` immutable** |
| `conversations` | participants | created when grant (coach/staff) or `shares_active_context` (peer) holds |
| `programs`, `diet_charts`, `community_posts` | enrolled/public; org members | org members with the matching capability; program content frozen while active enrollments exist |
| `coach_subscriptions`, `coach_invoices`, `enrollment_payments`, `revenue_splits`, `refunds`, `disputes`, `payouts`, `settlements` | org owner; admins | service role / webhook only; **immutable after issue/capture** |
| `admin_support_access` | admins | admins; dual-mode requires distinct approver; emits audit on use |
| `care_plans`, `care_team_members`, `interventions`, `outcomes` | active care-team members; admins | owner / `manage_care_plans`; cross-org adds require a `collaboration_agreement` |
| `organization_profiles` | org members; admins | owner coach only (KYC/banking) |
| `assets` | via owning row's policy + `is_phi` check; signed URL minted post-check | uploader / owning-row writers; PHI access audited |
| `*_versions` (program/diet_chart/care_plan) | same readers as parent | INSERT only; **no UPDATE/DELETE** |

**Lifecycle cascades (status transitions — never deletes; preserve attribution):**
- Revoke a grant → deactivate dependent `care_team_members`.
- Remove a member (`status='removed'`, `removed_at`) → revoke grants that exist *because of them* + deactivate their care-team rows; **`created_by`/`author_member_id` untouched** (history preserved).
- End a `collaboration_agreement` → deactivate its grant + the external org's care-team rows.
- Complete a `program_enrollment` → deactivate that enrollment's grant unless another live source keeps health access open.
- A **grant reaper** job sweeps time-expired grants (defense-in-depth; RLS already treats expired as dead).

**Hard guarantees (the five access-control invariants):**
1. **No ambient health access** — a customer's health data is invisible to an org without an **active, unexpired `access_grant`** *and* a member holding `view_client_health`; admins only via `admin_support_access`, every read audited `acting_as='admin'`.
2. **No orphaned access** — every grant is bound to a live `(source_type, source_id)`; cascades + reaper retire it when the source ends.
3. **No privilege escalation** — relational capabilities; self-edit blocked; effective access = grant ∩ member-caps ∩ care-team-caps (most restrictive).
4. **No stale / post-termination access** — grants carry `end_date`; RLS tests liveness; member removal flips status and cascades — while authorship stays immutable.
5. **Full auditability** — health reads audited in-tx & immutable (hash-chain Phase 2 on the two most sensitive logs); permission/grant changes audited; consent immutable.

**DPDP erasure (`data_deletion_requests`):** anonymize identifiers in `users`/`user_profiles` (set `is_anonymized`, null PII), revoke all `access_grants`, terminate enrollments/subscriptions, delete PHI asset objects, detach authored content (kept, re-attributed to org), **retain** audit/consent/financial rows (immutable legal basis), write a completion record. No hard delete of `[B]` data.

---

## 8. Indexing strategy (summary)

- **FK indexes** on every child→parent FK used in joins/filters (listed per table).
- **Partial unique** for "one active X": `program_enrollments`, `diet_chart_assignments`, `access_grants` (per source), `organization_members`, `coach_subscriptions`, `care_team_members`, `conversation_participants`, and `organization_members` owner-row.
- **Composite sort-aware** for feeds/leaderboards/inbox: `(organization_id, created_at desc)`, `(scope, program_id, period, score desc)`, `(user_id, read, created_date_ist desc)`, `(conversation_id, created_date_ist desc)`.
- **`pg_trgm` GIN** on `food_items.name`, `metric_definitions.display_name`.
- **Time-series**: partition-local `(subject/user_id, <date> desc)` on partitioned tables.
- **Health**: `(subject_user_id, metric_definition_id, measured_date_ist desc)`.
- **Idempotency** unique: `payment_webhook_events.provider_event_id`, `disputes.razorpay_dispute_id`, `settlements.settlement_ref`.

---

## 9. Migration strategy & open implementation notes

**Tooling:** switch from `drizzle-kit push` to **versioned `drizzle-kit generate` + `migrate`** before multi-dev work (add `generate`/`migrate` scripts to `lib/db/package.json`; keep `push` for local throwaway only). Raw-SQL companions (enums, partitioning, RLS, triggers, trgm, hash-chain) live in numbered migration files beside the generated ones.

**Migration ordering:**
1. Extensions: `pgcrypto` / `pg_uuidv7` (if used), `pg_trgm`, `pg_partman` (or `pg_cron`).
2. Enums (§3) + lookup tables (`badge_types`, `notification_types`, `lab_vendors`).
3. `users` → `user_profiles` → `professional_profiles` → `coach_organizations` → `organization_members` → `organization_member_permissions` → `coach_subscriptions`. (No org↔subscription cycle — `coach_organizations.subscription_id` removed; link lives on `coach_subscriptions`.)
4. `invitations`; Access/DPDP (`access_grants`, `dpdp_consent_records`, `coach_data_access_audit` [raw-SQL partitioned], `data_deletion_requests`, `admin_support_access`).
5. `assets` (referenced by many tables via typed `*_asset_id`).
6. `metric_definitions` → `health_observations` [partitioned]; Programs → nutrition [partitioned] → gamification → community → subscriptions/payments/billing → collaboration/care → notifications [partitioned] → messaging [partitioned] → clinical.
7. Migrate existing **lab** + **shop/commerce** tables to new conventions; **refactor `artifacts/api-server/src/routes/labs.ts`** to the org-scoped, source-bound `access_grants` (create a `lab_review` source grant) and the new `coach_data_access_audit` shape (`accessor_user_id`, `acting_as`, `resource_type`).
8. RLS policies + immutability triggers + the program "no-edit-while-enrolled" trigger + lifecycle-cascade triggers + reconciliation CHECK (raw SQL).
9. Phase 2: hash-chaining on `coach_data_access_audit` + admin-access audit.

**Open notes (calls at/ before code time):**
- **UUIDv7 generation:** Supabase has no native `uuidv7()` (PG18 only). Generate in the **application layer** (TypeScript); optional DB `DEFAULT` via `pg_uuidv7` where enabled. `users.id` stays = `auth.users.id`.
- **Retention durations (policy, non-blocking for schema):** confirm with legal — health-access audit ~5–7 yr, GST financial records ~6–8 yr, consent retained for life-of-account + statutory tail. Partitioning makes long retention cheap.
- **Admin access mode:** launch in `self` / `break_glass` with mandatory post-review; flip `require_second_approver` to `dual` later (no schema change).
- **Wearables / `message_flags`:** deferred; models already accommodate them.
- **FK to partitioned parents** (`message_attachments → messages`) requires the composite key form; validated as PG12+ supported.

---

## 10. Table inventory (count)

| Domain | Tables |
|---|---|
| D0 Organizations & Membership | 5 |
| D1 Identity | 3 |
| D2 Access / DPDP | 5 |
| D3 Programs | 6 |
| D4 Nutrition | 9 |
| D5 Health Data | 2 |
| D6 Gamification | 4 |
| D7 Community | 6 |
| D8 Subscriptions / Payments / Billing | 15 |
| D9 Collaboration & Care | 6 |
| D10 Notifications | 2 |
| D11 Lab | 7 |
| D12 Commerce | 13 |
| D13 Messaging | 4 |
| D14 Clinical Coaching | 3 |
| D15 Assets | 1 |
| **Total (launch)** | **91** |
| Deferred (`wearable_connections`, `message_flags`) | +2 |

---

## 11. Changelog — review round 3 (2026-06-02)

R2 (71 tables) → **R3 freeze (90 launch tables)**. Net: **+21 added, −2 removed/replaced** (`health_logs`→catalog+observations counts as a replace; `program_history_summaries`, `friends` removed; `asset_links`, separate `clinical_note_addenda` never created; `wearable_connections`, `message_flags` deferred).

**Removed / cut:** `friends`, `program_history_summaries`, `asset_links` (typed FKs instead), separate `clinical_note_addenda` (folded into `clinical_notes.parent_note_id`), `health_logs` (replaced), columns `coach_organizations.subscription_id` & `coach_profiles.organization_id`, `friend_status`/`health_metric_type` enums.

**Added domains:** D13 Messaging, D14 Clinical Coaching, D15 Assets; expanded D8 billing (invoices, line items, credit notes, refunds, disputes, payouts, settlements); D5 health redesign (`metric_definitions` + `health_observations`); `organization_member_permissions`; `invitations`; `professional_profiles` (generalized from `coach_profiles`); lookups (`badge_types`, `notification_types`, `lab_vendors`).

### Final Architecture Decision Log

| ID | Decision | Rationale |
|---|---|---|
| 1 | Keep `coach_organizations` + `UNIQUE(owner_coach_id)`; single-owner permanent | Transfer boundary, staff container, identity split |
| 2 | Ownership transfer = retarget `owner_coach_id` + swap owner member row | Zero asset migration |
| 3 | `organization_members` = sole org-authority source; `users.roles[]` = coarse platform flags | Kill quadruplicated source of truth |
| 4 | `access_grants` bound to `(source_type, source_id)`; unique per source; RLS liveness | Fixes simultaneous-enrollment bug; no orphaned/stale access |
| 5 | Relational permissions (`organization_member_permissions` + `coach_capability`); no self-escalation; staff ⊆ owner | Enforceable + queryable + auditable |
| 6 | Lifecycle = status transitions + cascades + reaper; authorship immutable | No stale/post-termination access; history preserved |
| 7 | Audit immutable + in-tx; hash-chain Phase 2 on health/admin only; `admin_support_access` hybrid (self/dual/break_glass + post-review) | Compliance baseline + targeted tamper-evidence + small-team practicality |
| 8 | Drop live version-pinning; `program/diet_chart/care_plan_versions` = publish/assign-time snapshots; stamp enrollment/assignment | Lifecycle rule freezes content mid-enrollment → pinning unneeded for reads; snapshots serve history/compliance |
| 9 | Health = `metric_definitions` + partitioned `health_observations` (compound via `reading_group_id`); labs normalize in | Scale, wearable/lab/international-ready; kills `value_secondary` |
| 10 | Messaging & clinical are separate domains: messages editable/soft-delete, clinical append-only | Chat UX vs clinical defensibility |
| 11 | No friends graph; peer messaging gated by shared active context | Not a social network |
| 12 | Generalize `coach_profiles` → `professional_profiles` (coaches, nutritionists, future specialists) | Avoid per-role profile tables |
| 13 | Products & shop assets org-owned; lab packages platform-owned | "All business assets belong to the Organization" |
| 14 | Billing: GST invoices/credit-notes (B2B), refunds/disputes/payouts/settlements (B2C), reconciliation CHECK | Production finance/compliance |
| 15 | Assets domain + signed-URL gateway + PHI audit; typed FKs (no `asset_links`) | Object storage outside RLS |
| 16 | Limits enforced by transactional live-count + reservation; `billing_metrics` = reporting | Counters can't gate writes |
| 17 | De-vendor labs (`lab_vendors`); evolving sets → lookup tables, stable sets → enums | Avoid enum churn |

### Revised scorecard (post-adoption target)

| Architecture | Security | Compliance | Scalability | Domain Modeling |
|---|---|---|---|---|
| 8/10 | 8/10 | 8/10 | 8/10 | 8/10 |

(9–10 is withheld until the enforcement code — RLS, triggers, reconciliation, hash-chain — is written and tested.)

### Freeze Readiness Report → **READY TO FREEZE**

All five prior conditions are resolved by R3 product decisions: clinical/chat mutability (separate domains), commerce ownership (org-owned), friends (dropped), admin approval (hybrid), and messaging immutability (append-only clinical). The only residual item is **retention-duration confirmation with legal** — a *policy/config* value (no schema impact), so it does not block the freeze.

---

### Final sign-off

This is the **frozen foundation (R3, 90 launch tables + 2 deferred)**. On your word I'll generate the complete Drizzle schema — one file per domain under `lib/db/src/schema/`, with: pg enums + lookup seeds, `pgTable` definitions, composite PKs + raw-SQL partitioning companions (6 tables), relational permissions, partial-unique + `pg_trgm` indexes, FK constraints (incl. composite FK to partitioned `messages`), RLS policy migrations + helper functions, immutability/lifecycle/no-edit-while-enrolled triggers, the revenue reconciliation CHECK, and `drizzle-zod` validators — wired into `schema/index.ts` and `drizzle.config.ts`, with `generate`/`migrate` scripts added to `lib/db/package.json`.
