// =============================================================================
// Vitalé — D8 Subscriptions, Payments, Billing & Compliance (Phase 5)
// Ground truth: VITALE_DB_ARCHITECTURE §4 D8 (lines 399-461) + §7 policy catalog (lines
// 737-745) + VITALE_IMPLEMENTATION_SPEC Part 2 D8 (lines 394-442) + Part 6 Phase 5 order
// (line 1118: subscription_plans/_features/plan_limits → billing_metrics → coach_subscriptions
// → coach_invoices/invoice_line_items → credit_notes → enrollment_payments → revenue_splits →
// refunds/disputes/payouts/settlements → payment_webhook_events).
//
// All 15 D8 tables are NON-partitioned, PK-V7, so Drizzle owns the full DDL here. Money is
// `bigint` paise (arch §2) modeled as { mode: "number" } per the established convention
// (programs.pricePaise, assets.sizeBytes). Same-row arithmetic invariants are expressed as
// native CHECK constraints (settlements gross=net+fees+tax — the §4.4 tg_check_settlement_totals
// invariant; invoice line GST split + line-total reconciliation; non-negative splits; positive
// refund). Cross-row invariants (revenue_splits sum = captured payment; refund ≤ captured) need
// a sibling-table read and are therefore enforced by triggers in the raw companion, not here.
//
// This module owns table DDL + drizzle-zod validators only. RLS, grants, financial triggers,
// document numbering, plan-limit enforcement, and the Blocker-1 FK discharge all live in the
// raw post-companion 0107_billing_rls.sql:
//   • RLS-ON public-read catalogs: subscription_plans / subscription_features / plan_limits
//     (anon+authenticated SELECT; admin write) — arch §7 line 737.
//   • RLS-ON owner-read: billing_metrics (org owner + admin SELECT; rollup-job/service-role write).
//   • RLS-FORCE + REVOKE-API on every [B] financial table (service-role writes; org owner / payer /
//     admin SELECT only) — arch §7 line 745.
//   • tg_touch_updated_at (subscription_plans — the one D8 table with updated_at).
//   • tg_assign_invoice_number / tg_assign_credit_note_number (gap-free, advisory-locked,
//     per-fiscal-year numbers from document_number_sequences — 0006).
//   • tg_reconcile_revenue_split (CONSTRAINT TRIGGER, DEFERRABLE — money conservation vs payment).
//   • IMMUT-ISSUE (tg_block_update_after_issue, 0004) on the [B] tables; IMMUT-BLOCK
//     (tg_block_update_delete) on credit_notes; tg_payload_immutable on payment_webhook_events.
//   • tg_enforce_plan_limit wired onto the metered tables (organization_members / programs /
//     diet_charts / active program_enrollments) — now unblocked since plan_limits lands here.
//   • Blocker-1: program_enrollments.payment_id → enrollment_payments(id) FK added there
//     (plain/VALID; tables empty at build). programs.ts intentionally models payment_id as a
//     plain nullable uuid to avoid the circular import; the constraint is raw-SQL.
//
// [B] convention: financial records carry created_at + explicit lifecycle *_at columns
// (issued_at / captured_at / processed_at / …) and NO updated_at — they are never "touched";
// they transition through audited status moves frozen by IMMUT-ISSUE. subscription_plans is the
// lone [A]-style catalog with updated_at.
// =============================================================================
import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { pkV7, timestamps } from "./_shared";
import {
  billingInterval, creditNoteStatus, disputeStatus, invoiceStatus, limitMetric,
  paymentStatus, payoutStatus, refundStatus, revenueSplitStatus, settlementStatus,
  subscriptionStatus, webhookProvider,
} from "./enums";
import { users } from "./identity";
import { coachOrganizations } from "./organizations";
import { programEnrollments, programs } from "./programs";

// created_at-only audit stamp (no updated_at) for [B] / "Triggers: —" tables.
const createdAtOnly = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

// ----- Subscription configuration (data-driven plans; RLS-ON public read) ----

// subscription_plans — billing tiers. Data-driven: new tiers ship with no schema change. [A]
export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: pkV7(),
    code: text("code").notNull(), // stable business code (unique); e.g. 'starter','pro'
    name: text("name").notNull(),
    description: text("description"),
    pricePaise: bigint("price_paise", { mode: "number" }).notNull(), // arch §2 money = bigint paise
    currency: text("currency").notNull().default("INR"),
    billingInterval: billingInterval("billing_interval").notNull(),
    razorpayPlanId: text("razorpay_plan_id"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps, // tg_touch_updated_at (raw companion) — the one D8 table with updated_at
  },
  (t) => [
    uniqueIndex("subscription_plans_code_key").on(t.code),
    index("subscription_plans_active_sort_idx").on(t.isActive, t.sortOrder),
  ],
);

// subscription_features — feature flags/values per plan. Triggers: — → created_at only.
export const subscriptionFeatures = pgTable(
  "subscription_features",
  {
    id: pkV7(),
    planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
    featureKey: text("feature_key").notNull(),
    featureValue: jsonb("feature_value").notNull(),
    ...createdAtOnly,
  },
  (t) => [uniqueIndex("subscription_features_plan_key_key").on(t.planId, t.featureKey)],
);

// plan_limits — metered ceilings per plan. NULL limit_value = unlimited. Read by
// tg_enforce_plan_limit for concurrency-safe enforcement (raw companion). Triggers: —.
export const planLimits = pgTable(
  "plan_limits",
  {
    id: pkV7(),
    planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
    limitKey: limitMetric("limit_key").notNull(),
    limitValue: bigint("limit_value", { mode: "number" }), // nullable = unlimited
    ...createdAtOnly,
  },
  (t) => [uniqueIndex("plan_limits_plan_key_key").on(t.planId, t.limitKey)],
);

// billing_metrics — per-org usage rollup/reporting (NOT the enforcement surface; enforcement is
// the live count + reservation in tg_enforce_plan_limit). RLS-ON: org owner + admin read;
// rollup-job/service-role write. Triggers: —.
export const billingMetrics = pgTable(
  "billing_metrics",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    metricKey: limitMetric("metric_key").notNull(),
    metricValue: bigint("metric_value", { mode: "number" }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    ...createdAtOnly,
  },
  (t) => [index("billing_metrics_org_metric_period_idx").on(t.organizationId, t.metricKey, t.periodStart.desc())],
);

// ----- B2B SaaS billing (org → Vitalé) ---------------------------------------

// coach_subscriptions — the org's subscription to Vitalé. [B] (IMMUT-ISSUE). Partial-unique:
// at most one active subscription per org. amount/plan frozen post-create except via the
// documented upgrade RPC (deferred — see companion footer).
export const coachSubscriptions = pgTable(
  "coach_subscriptions",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id), // authoritative org↔subscription link
    ownerCoachId: uuid("owner_coach_id").notNull().references(() => users.id),
    planId: uuid("plan_id").notNull().references(() => subscriptionPlans.id),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    status: subscriptionStatus("status").notNull(), // active | past_due | cancelled | paused (explicit; no default)
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("coach_subscriptions_active_org_key").on(t.organizationId).where(sql`${t.status} = 'active'`),
    index("coach_subscriptions_org_idx").on(t.organizationId),
  ],
);

// coach_invoices — GST tax invoice for SaaS billing (seller = Vitalé, buyer = org). [B immutable
// once issued]. invoice_number assigned by tg_assign_invoice_number when status→issued (NULL
// while draft → uniqueIndex tolerates many NULL drafts). IMMUT-ISSUE freezes once issued.
export const coachInvoices = pgTable(
  "coach_invoices",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    subscriptionId: uuid("subscription_id").references(() => coachSubscriptions.id), // nullable (one-off invoices)
    invoiceNumber: text("invoice_number"), // assigned at issue (tg_assign_invoice_number); NULL while draft
    status: invoiceStatus("status").notNull().default("draft"),
    placeOfSupplyState: text("place_of_supply_state"), // GST POS (drives CGST/SGST vs IGST)
    sellerGstin: text("seller_gstin"),
    buyerGstin: text("buyer_gstin"), // nullable (unregistered buyer)
    subtotalPaise: bigint("subtotal_paise", { mode: "number" }).notNull(),
    taxTotalPaise: bigint("tax_total_paise", { mode: "number" }).notNull(),
    totalPaise: bigint("total_paise", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("INR"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("coach_invoices_number_key").on(t.invoiceNumber), // NULLs are distinct → drafts unconstrained
    index("coach_invoices_org_issued_idx").on(t.organizationId, t.issuedAt.desc()),
    check("coach_invoices_total_consistent", sql`${t.totalPaise} = ${t.subtotalPaise} + ${t.taxTotalPaise}`),
  ],
);

// invoice_line_items — GST line items. [B] frozen with parent (tg_freeze_line_item_after_issue,
// companion). GST split must be intra-state (CGST+SGST, IGST=0) XOR inter-state (IGST only);
// line_total reconciles taxable_value + all taxes.
export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: pkV7(),
    invoiceId: uuid("invoice_id").notNull().references(() => coachInvoices.id),
    description: text("description").notNull(),
    hsnSacCode: text("hsn_sac_code"),
    quantity: integer("quantity").notNull().default(1),
    unitPricePaise: bigint("unit_price_paise", { mode: "number" }).notNull(),
    taxableValuePaise: bigint("taxable_value_paise", { mode: "number" }).notNull(),
    cgstPaise: bigint("cgst_paise", { mode: "number" }).notNull().default(0),
    sgstPaise: bigint("sgst_paise", { mode: "number" }).notNull().default(0),
    igstPaise: bigint("igst_paise", { mode: "number" }).notNull().default(0),
    lineTotalPaise: bigint("line_total_paise", { mode: "number" }).notNull(),
    ...createdAtOnly,
  },
  (t) => [
    index("invoice_line_items_invoice_idx").on(t.invoiceId),
    // intra-state (CGST/SGST, IGST=0) XOR inter-state (IGST, CGST=SGST=0)
    check("invoice_line_items_gst_split", sql`(${t.igstPaise} = 0) OR (${t.cgstPaise} = 0 AND ${t.sgstPaise} = 0)`),
    check("invoice_line_items_total", sql`${t.lineTotalPaise} = ${t.taxableValuePaise} + ${t.cgstPaise} + ${t.sgstPaise} + ${t.igstPaise}`),
  ],
);

// credit_notes — GST-correct refunds/adjustments against an invoice. [B immutable] → IMMUT-BLOCK
// (append-only). credit_note_number assigned at insert (tg_assign_credit_note_number).
export const creditNotes = pgTable(
  "credit_notes",
  {
    id: pkV7(),
    invoiceId: uuid("invoice_id").notNull().references(() => coachInvoices.id),
    creditNoteNumber: text("credit_note_number"), // assigned at insert (tg_assign_credit_note_number)
    reason: text("reason"),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    taxReversedPaise: bigint("tax_reversed_paise", { mode: "number" }).notNull().default(0),
    status: creditNoteStatus("status").notNull().default("issued"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("credit_notes_number_key").on(t.creditNoteNumber),
    index("credit_notes_invoice_idx").on(t.invoiceId),
  ],
);

// ----- B2C program payments (customer → program), splits & disputes ----------

// enrollment_payments — customer → program payment. [B] (IMMUT-ISSUE, frozen once captured).
// enrollment_id is NOT NULL (Blocker-1: the back-reference program_enrollments.payment_id is the
// nullable side, populated in step 3 of the enrollment transaction).
export const enrollmentPayments = pgTable(
  "enrollment_payments",
  {
    id: pkV7(),
    enrollmentId: uuid("enrollment_id").notNull().references(() => programEnrollments.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    programId: uuid("program_id").notNull().references(() => programs.id),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("INR"),
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),
    status: paymentStatus("status").notNull().default("created"),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    index("enrollment_payments_org_captured_idx").on(t.organizationId, t.capturedAt.desc()),
    index("enrollment_payments_user_idx").on(t.userId),
    uniqueIndex("enrollment_payments_razorpay_payment_key").on(t.razorpayPaymentId).where(sql`${t.razorpayPaymentId} IS NOT NULL`),
  ],
);

// revenue_splits — Razorpay Route split per payment. [B] (IMMUT-ISSUE). Money conservation
// (platform_fee + coach_amount = captured payment) enforced by the DEFERRABLE constraint trigger
// tg_reconcile_revenue_split (companion); same-row non-negativity guarded here.
export const revenueSplits = pgTable(
  "revenue_splits",
  {
    id: pkV7(),
    paymentId: uuid("payment_id").notNull().references(() => enrollmentPayments.id),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    platformFeePaise: bigint("platform_fee_paise", { mode: "number" }).notNull(),
    coachAmountPaise: bigint("coach_amount_paise", { mode: "number" }).notNull(),
    razorpayTransferId: text("razorpay_transfer_id"),
    status: revenueSplitStatus("status").notNull().default("pending"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("revenue_splits_payment_key").on(t.paymentId), // one split per payment
    index("revenue_splits_org_status_idx").on(t.organizationId, t.status),
    check("revenue_splits_nonneg", sql`${t.platformFeePaise} >= 0 AND ${t.coachAmountPaise} >= 0`),
  ],
);

// refunds — B2C refunds against a payment. [B] (IMMUT-ISSUE). amount ≤ captured is a cross-row
// invariant enforced by tg_check_refund_amount (companion); positivity guarded here.
export const refunds = pgTable(
  "refunds",
  {
    id: pkV7(),
    paymentId: uuid("payment_id").notNull().references(() => enrollmentPayments.id),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    reason: text("reason"),
    razorpayRefundId: text("razorpay_refund_id"),
    status: refundStatus("status").notNull().default("requested"),
    initiatedBy: uuid("initiated_by").references(() => users.id), // nullable: provider/webhook-initiated refunds
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    index("refunds_payment_idx").on(t.paymentId),
    uniqueIndex("refunds_razorpay_refund_key").on(t.razorpayRefundId).where(sql`${t.razorpayRefundId} IS NOT NULL`),
    check("refunds_amount_positive", sql`${t.amountPaise} > 0`),
  ],
);

// disputes — chargebacks. [B] (IMMUT-ISSUE; status machine open→under_review→won/lost/accepted).
// razorpay_dispute_id is the idempotency key (unique). evidence accrues during under_review.
export const disputes = pgTable(
  "disputes",
  {
    id: pkV7(),
    paymentId: uuid("payment_id").notNull().references(() => enrollmentPayments.id),
    razorpayDisputeId: text("razorpay_dispute_id").notNull(),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    reasonCode: text("reason_code"),
    status: disputeStatus("status").notNull().default("open"),
    evidence: jsonb("evidence"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("disputes_razorpay_dispute_key").on(t.razorpayDisputeId), // idempotency
    index("disputes_status_idx").on(t.status),
  ],
);

// ----- Settlement of coach earnings & provider reconciliation ----------------

// payouts — settlement of coach earnings to the org's Razorpay account. [B] (IMMUT-ISSUE).
export const payouts = pgTable(
  "payouts",
  {
    id: pkV7(),
    organizationId: uuid("organization_id").notNull().references(() => coachOrganizations.id),
    razorpayTransferId: text("razorpay_transfer_id"),
    amountPaise: bigint("amount_paise", { mode: "number" }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: payoutStatus("status").notNull().default("pending"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    index("payouts_org_period_idx").on(t.organizationId, t.periodStart.desc()),
    index("payouts_status_idx").on(t.status),
  ],
);

// settlements — provider settlement reconciliation. [B] (IMMUT-ISSUE). settlement_ref is the
// idempotency key. gross = net + fees + tax (the §4.4 tg_check_settlement_totals invariant) as
// a native same-row CHECK.
export const settlements = pgTable(
  "settlements",
  {
    id: pkV7(),
    provider: webhookProvider("provider").notNull(),
    settlementRef: text("settlement_ref").notNull(),
    grossPaise: bigint("gross_paise", { mode: "number" }).notNull(),
    feesPaise: bigint("fees_paise", { mode: "number" }).notNull().default(0),
    taxPaise: bigint("tax_paise", { mode: "number" }).notNull().default(0),
    netPaise: bigint("net_paise", { mode: "number" }).notNull(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    status: settlementStatus("status").notNull().default("pending"),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("settlements_ref_key").on(t.settlementRef), // idempotency
    index("settlements_status_idx").on(t.status),
    check("settlements_totals", sql`${t.grossPaise} = ${t.netPaise} + ${t.feesPaise} + ${t.taxPaise}`),
  ],
);

// payment_webhook_events — idempotent, signature-verified webhook intake. [B] + REVOKE-API
// (service-role only). provider_event_id is the idempotency key. tg_payload_immutable freezes the
// raw payload; only processed/processed_at may flip.
export const paymentWebhookEvents = pgTable(
  "payment_webhook_events",
  {
    id: pkV7(),
    provider: webhookProvider("provider").notNull(),
    eventType: text("event_type").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").notNull().default(false),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    ...createdAtOnly,
  },
  (t) => [
    uniqueIndex("payment_webhook_events_provider_event_key").on(t.providerEventId), // idempotency
    index("payment_webhook_events_processed_received_idx").on(t.processed, t.receivedAt),
  ],
);

// ----- drizzle-zod validators (arch §11) -------------------------------------
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const selectSubscriptionPlanSchema = createSelectSchema(subscriptionPlans);
export const insertSubscriptionFeatureSchema = createInsertSchema(subscriptionFeatures);
export const selectSubscriptionFeatureSchema = createSelectSchema(subscriptionFeatures);
export const insertPlanLimitSchema = createInsertSchema(planLimits);
export const selectPlanLimitSchema = createSelectSchema(planLimits);
export const insertBillingMetricSchema = createInsertSchema(billingMetrics);
export const selectBillingMetricSchema = createSelectSchema(billingMetrics);
export const insertCoachSubscriptionSchema = createInsertSchema(coachSubscriptions);
export const selectCoachSubscriptionSchema = createSelectSchema(coachSubscriptions);
export const insertCoachInvoiceSchema = createInsertSchema(coachInvoices);
export const selectCoachInvoiceSchema = createSelectSchema(coachInvoices);
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems);
export const selectInvoiceLineItemSchema = createSelectSchema(invoiceLineItems);
export const insertCreditNoteSchema = createInsertSchema(creditNotes);
export const selectCreditNoteSchema = createSelectSchema(creditNotes);
export const insertEnrollmentPaymentSchema = createInsertSchema(enrollmentPayments);
export const selectEnrollmentPaymentSchema = createSelectSchema(enrollmentPayments);
export const insertRevenueSplitSchema = createInsertSchema(revenueSplits);
export const selectRevenueSplitSchema = createSelectSchema(revenueSplits);
export const insertRefundSchema = createInsertSchema(refunds);
export const selectRefundSchema = createSelectSchema(refunds);
export const insertDisputeSchema = createInsertSchema(disputes);
export const selectDisputeSchema = createSelectSchema(disputes);
export const insertPayoutSchema = createInsertSchema(payouts);
export const selectPayoutSchema = createSelectSchema(payouts);
export const insertSettlementSchema = createInsertSchema(settlements);
export const selectSettlementSchema = createSelectSchema(settlements);
export const insertPaymentWebhookEventSchema = createInsertSchema(paymentWebhookEvents);
export const selectPaymentWebhookEventSchema = createSelectSchema(paymentWebhookEvents);
