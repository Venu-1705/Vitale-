// =============================================================================
// Vitalé — D5 Health Data HTTP surface
// -----------------------------------------------------------------------------
// Canonical pipeline (authedRoute → withUserContext): validate → user context →
// DB → map errors → respond. Authorization is owned by the D5 RLS policies + grants
// (migrations post/0103 catalog, post/0104 + post/0131 observations), NOT re-implemented here.
//
// Two halves, two access shapes:
//   • metric_definitions [catalog, PK-V7, NON-partitioned, public-read] — Drizzle-owned.
//     SELECT granted to anon+authenticated (metric_definitions_select_public USING(true));
//     INSERT/UPDATE/DELETE gated by is_admin(). SELECT grant exists → .returning() is safe.
//   • health_observations [A, PARTITIONED monthly on measured_date_ist, REVOKE-API, RLS-FORCE] —
//     raw SQL (Drizzle cannot express PARTITION BY RANGE; there is no Drizzle model). authenticated
//     holds INSERT+UPDATE only, NO SELECT grant (0131) → cannot use RETURNING; insert the
//     app-generated uuidv7 id and echo it. The measured_date_ist partition key is set by the
//     tg_set_measured_date_ist BEFORE-INSERT trigger from measured_at (IST) — we never send it.
//     Reads go EXCLUSIVELY through the audited rpc_read_health_observations (0120): it re-enforces
//     the ho_select predicate and writes a coach_data_access_audit row in the same transaction
//     (coach/admin reads audited; self-reads are not). A raw SELECT would be denied (no grant).
//
// Write paths gated by RLS WITH CHECK:
//   • ho_insert_self — subject_user_id = auth.uid() (self-logging).
//   • ho_insert_coach — source='coach_entered' AND recorded_by_user_id=auth.uid() AND caller is an
//     active org member with an active 'health_data' grant on the subject + view_client_health.
//   • ho_update_owner — owner self-correction only (subject_user_id = auth.uid()), USING+WITH CHECK.
//     No DELETE policy ⇒ delete denied (observations are corrected, not removed).
// =============================================================================
import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { metricDefinitions, uuidv7 } from "@workspace/db";
import { z } from "zod";
import { authedRoute } from "../lib/route";
import { ApiError } from "../lib/http";

const router: IRouter = Router();

// ----- enum mirrors (exact DB values) ----------------------------------------
const METRIC_CATEGORY = ["vital", "body_composition", "activity", "sleep", "nutrition_derived", "lab", "wearable"] as const;
const METRIC_VALUE_TYPE = ["numeric", "integer", "boolean", "enum"] as const;
const HEALTH_OBS_SOURCE = ["manual", "wearable", "lab", "coach_entered"] as const;

const IdParam = z.object({ id: z.string().uuid() });

// =============================================================================
// Metric definitions — the public metric catalog (read: everyone; write: admin via RLS)
// =============================================================================
const ListMetricsQuery = z.object({
  category: z.enum(METRIC_CATEGORY).optional(),
  activeOnly: z.coerce.boolean().optional(),
});

// GET /metric-definitions — public catalog. RLS USING(true) → visible to any authenticated caller.
router.get(
  "/metric-definitions",
  authedRoute({ query: ListMetricsQuery }, async ({ db, query }) => {
    const conds = [];
    if (query.category) conds.push(eq(metricDefinitions.category, query.category));
    if (query.activeOnly) conds.push(eq(metricDefinitions.isActive, true));
    const rows = conds.length
      ? await db.select().from(metricDefinitions).where(and(...conds))
      : await db.select().from(metricDefinitions);
    return { count: rows.length, metrics: rows };
  }),
);

const CreateMetricBody = z.object({
  code: z.string().min(1),
  displayName: z.string().min(1),
  category: z.enum(METRIC_CATEGORY),
  valueType: z.enum(METRIC_VALUE_TYPE),
  canonicalUnit: z.string().min(1).optional(),
  unitConversions: z.record(z.string(), z.number()).optional(),
  compoundGroup: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

// POST /metric-definitions — admin-only (metric_definitions_insert_admin gates on is_admin()).
// SELECT grant exists on this catalog → .returning() is safe; RLS denial surfaces as 403.
router.post(
  "/metric-definitions",
  authedRoute({ body: CreateMetricBody }, async ({ db, body }) => {
    const rows = await db
      .insert(metricDefinitions)
      .values({
        id: uuidv7(),
        code: body.code,
        displayName: body.displayName,
        category: body.category,
        valueType: body.valueType,
        ...(body.canonicalUnit ? { canonicalUnit: body.canonicalUnit } : {}),
        ...(body.unitConversions ? { unitConversions: body.unitConversions } : {}),
        ...(body.compoundGroup ? { compoundGroup: body.compoundGroup } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      })
      .returning();
    return rows[0];
  }),
);

// =============================================================================
// Health observations — REVOKE-API; write here, read via audited RPC
// =============================================================================
// Exactly one of value_numeric / value_bool / value_text is set (table CHECK
// num_nonnulls(...) = 1). We mirror that with a Zod refine so an obviously malformed
// request fails fast (422) before the round-trip; the DB remains the authority.
const CreateObservationBody = z
  .object({
    subjectUserId: z.string().uuid(),
    metricDefinitionId: z.string().uuid(),
    valueNumeric: z.number().optional(),
    valueBool: z.boolean().optional(),
    valueText: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
    readingGroupId: z.string().uuid().optional(),
    measuredAt: z.string().datetime().optional(), // defaults to now() at the DB if omitted
    source: z.enum(HEALTH_OBS_SOURCE).optional(), // default 'manual'
    sourceDeviceId: z.string().min(1).optional(),
    sourceExternalId: z.string().min(1).optional(),
    recordedByUserId: z.string().uuid().optional(), // required by ho_insert_coach (= caller)
  })
  .refine(
    (b) => [b.valueNumeric !== undefined, b.valueBool !== undefined, b.valueText !== undefined].filter(Boolean).length === 1,
    { message: "Exactly one of valueNumeric, valueBool, valueText must be set.", path: ["valueNumeric"] },
  );

// POST /health-observations — log a reading. REVOKE-API: no SELECT grant → cannot RETURNING;
// insert and echo the app-generated id. RLS WITH CHECK (ho_insert_self / ho_insert_coach) owns
// authorization.
//
// Partition-routing note: health_observations is RANGE-partitioned on measured_date_ist, but that
// column is normally maintained by the tg_set_measured_date_ist BEFORE-INSERT trigger. PostgreSQL
// routes the tuple to a partition BEFORE the row trigger fires — so if measured_date_ist arrives
// NULL the row routes to _default and the trigger's later assignment is rejected ("moving row to
// another partition during a BEFORE FOR EACH ROW trigger is not supported"). We therefore supply
// measured_date_ist explicitly, computed by the DB with the SAME IST expression the trigger uses
// ((measured_at AT TIME ZONE 'Asia/Kolkata')::date) — evaluated in a CTE so the date and the stored
// measured_at derive from one timestamp. Routing lands in the right partition; the trigger then
// recomputes the identical value (no partition move). Trigger stays authoritative on UPDATE.
router.post(
  "/health-observations",
  authedRoute({ body: CreateObservationBody }, async ({ db, body }) => {
    const id = uuidv7();
    const measuredAt = body.measuredAt ? sql`${body.measuredAt}::timestamptz` : sql`now()`;
    await db.execute(sql`
      WITH v(m_at) AS (SELECT ${measuredAt})
      INSERT INTO public.health_observations
        (id, subject_user_id, metric_definition_id, measured_date_ist, value_numeric, value_bool,
         value_text, unit, reading_group_id, measured_at, source, source_device_id,
         source_external_id, recorded_by_user_id)
      SELECT ${id}::uuid,
             ${body.subjectUserId}::uuid,
             ${body.metricDefinitionId}::uuid,
             (v.m_at AT TIME ZONE 'Asia/Kolkata')::date,
             ${body.valueNumeric ?? null},
             ${body.valueBool ?? null},
             ${body.valueText ?? null},
             ${body.unit ?? null},
             ${body.readingGroupId ?? null}::uuid,
             v.m_at,
             ${body.source ?? "manual"}::public.health_obs_source,
             ${body.sourceDeviceId ?? null},
             ${body.sourceExternalId ?? null},
             ${body.recordedByUserId ?? null}::uuid
        FROM v
    `);
    return { id, subjectUserId: body.subjectUserId, metricDefinitionId: body.metricDefinitionId };
  }),
);

// GET /health-observations — the ONLY read path. Delegates to the SECURITY DEFINER, audited
// rpc_read_health_observations (0120): re-enforces ho_select, writes a coach_data_access_audit
// row in-transaction for coach/admin reads (self-reads of own data are not audited), returns rows.
// A raw SELECT would be denied (no SELECT grant). The RPC scopes EVERY read to a single metric and
// a closed date window (its predicate is `metric_definition_id = p_metric_id AND measured_date_ist
// BETWEEN p_from_date AND p_to_date` — not null-tolerant), so all four params are required.
const ReadObservationsQuery = z.object({
  subjectUserId: z.string().uuid(),
  metricDefinitionId: z.string().uuid(),
  fromDate: z.string().date(),
  toDate: z.string().date(),
});
router.get(
  "/health-observations",
  authedRoute({ query: ReadObservationsQuery }, async ({ db, query }) => {
    const result = await db.execute(
      sql`select * from public.rpc_read_health_observations(
        ${query.subjectUserId}::uuid,
        ${query.metricDefinitionId}::uuid,
        ${query.fromDate}::date,
        ${query.toDate}::date)`,
    );
    return { count: result.rows.length, observations: result.rows };
  }),
);

// PATCH /health-observations/:id — owner self-correction. REVOKE-API: a direct `UPDATE … WHERE`
// would need SELECT (denied) to target the row, so this delegates to the SECURITY DEFINER
// rpc_update_health_observation (0132): it re-enforces ho_update_owner (subject = auth.uid()) and
// performs the correction in definer context. A correction RESTATES the reading → exactly one of
// valueNumeric/valueBool/valueText is required (matches the table's num_nonnulls CHECK); unit is
// optional. The RPC returns the affected row count → 0 means not found / not owned → 404.
const UpdateObservationBody = z
  .object({
    valueNumeric: z.number().optional(),
    valueBool: z.boolean().optional(),
    valueText: z.string().min(1).optional(),
    unit: z.string().min(1).optional(),
  })
  .refine(
    (b) => [b.valueNumeric !== undefined, b.valueBool !== undefined, b.valueText !== undefined].filter(Boolean).length === 1,
    { message: "Exactly one of valueNumeric, valueBool, valueText must be set.", path: ["valueNumeric"] },
  );
router.patch(
  "/health-observations/:id",
  authedRoute({ params: IdParam, body: UpdateObservationBody }, async ({ db, params, body }) => {
    const result = await db.execute(
      sql`select public.rpc_update_health_observation(
        ${params.id}::uuid,
        ${body.valueNumeric ?? null},
        ${body.valueBool ?? null},
        ${body.valueText ?? null},
        ${body.unit ?? null}) as rows`,
    );
    const rows = Number((result.rows[0] as { rows: number } | undefined)?.rows ?? 0);
    if (rows === 0) {
      throw new ApiError(404, "not_found", "Observation not found or not editable.");
    }
    return { id: params.id, updated: true };
  }),
);

export default router;
