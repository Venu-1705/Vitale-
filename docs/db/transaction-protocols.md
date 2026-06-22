# Vitalé — Canonical DB Transaction Protocols

> Companion to `VITALE_DB_ARCHITECTURE.md` and `VITALE_IMPLEMENTATION_SPEC.md`.
> These are **mandatory write-ordering protocols** for cases where a single logical
> operation spans tables joined by a circular foreign key. They do not change any frozen
> design decision; they document the required insert order the schema already implies.

---

## Protocol 1 — Program enrollment with payment (circular FK: `program_enrollments` ↔ `enrollment_payments`)

### Why this protocol exists

The two tables reference each other:

- `program_enrollments.payment_id` → `enrollment_payments(id)`  (**nullable**)
- `enrollment_payments.enrollment_id` → `program_enrollments(id)`  (NOT NULL)

Neither row can be inserted "first" if both FKs were required at insert time. The cycle is
broken by making **`program_enrollments.payment_id` nullable**: the enrollment is created
without a payment, the payment is created pointing at the enrollment, then the enrollment
is back-filled with the payment id.

### The exact three-step sequence (run inside ONE transaction)

```sql
BEGIN;

-- Step 1: insert the enrollment with payment_id = NULL
INSERT INTO program_enrollments
  (id, program_id, program_version_id, organization_id, user_id, status,
   enrolled_at, payment_id)
VALUES
  ($enrollment_id, $program_id, $program_version_id, $org_id, $user_id, 'active',
   now(), NULL);                                   -- payment_id deliberately NULL

-- Step 2: insert the payment referencing the enrollment created in Step 1
INSERT INTO enrollment_payments
  (id, enrollment_id, user_id, organization_id, program_id,
   amount_paise, currency, razorpay_order_id, razorpay_payment_id, status, captured_at)
VALUES
  ($payment_id, $enrollment_id, $user_id, $org_id, $program_id,
   $amount_paise, 'INR', $rzp_order_id, $rzp_payment_id, 'captured', now());

-- Step 3: back-fill the enrollment with the payment id
UPDATE program_enrollments
   SET payment_id = $payment_id
 WHERE id = $enrollment_id;

COMMIT;
```

### Rules

1. **All three statements execute in a single transaction.** A partial apply (enrollment
   without payment, or payment without back-fill) must never be visible.
2. **Order is fixed:** enrollment (1) → payment (2) → enrollment back-fill (3). Do not
   reorder; Step 2 requires the enrollment row from Step 1, and Step 3 requires the
   payment row from Step 2.
3. **`program_enrollments.payment_id` stays nullable permanently** — it is the column
   that breaks the cycle. The transient `NULL` between Step 1 and Step 3 is expected.
4. The downstream `tg_enrollment_grant` trigger (creates the source-bound `access_grant`)
   and the `tg_reconcile_revenue_split` constraint trigger fire within this same
   transaction; the deferred reconciliation constraint is satisfied at `COMMIT`.

### Drizzle / SQL column annotation

`program_enrollments.payment_id` carries this comment in the generated schema:

```
-- nullable: resolves circular FK with enrollment_payments;
-- populated in step 3 of the enrollment transaction (see docs/db/transaction-protocols.md)
```
