#!/usr/bin/env bash
# =============================================================================
# Vitalé — OS-cron runner for the in-database job_*() procedures.
# This is the vanilla-PostgreSQL replacement for pg_cron: instead of
# cron.schedule(...) inside the database, the host scheduler (cron / launchd)
# invokes this script, which CALLs the corresponding procedure over psql.
#
# Each procedure is idempotent and writes its outcome to public.job_runs, so a
# missed or double run is safe. The failed-run alerter reads job_runs.
#
# Usage:   run-job.sh <procedure_name>      # e.g. run-job.sh job_grant_reaper
# Env:     DATABASE_URL   (required)        postgres connection string for the
#                                           service/owner role (BYPASSRLS).
#          PSQL           (optional)        path to psql; defaults to `psql` on PATH.
#
# The procedures connect with the migration/service identity; long sweeps that
# need to exceed statement_timeout do `SET LOCAL statement_timeout = '0'` inside
# their own transaction (see Part 5 notes), so no per-call override is needed.
# =============================================================================
set -euo pipefail

JOB="${1:?usage: run-job.sh <job_proc_name>  (e.g. job_grant_reaper)}"
: "${DATABASE_URL:?DATABASE_URL must be set (postgres connection string)}"
PSQL="${PSQL:-psql}"

# Only allow the known job procedures (defence against arg injection).
case "$JOB" in
  job_partition_provision|job_partition_retention|job_grant_reaper|job_metrics_rollup|\
  job_streak_rollover|job_admin_access_sla|job_audit_chain_verify|job_consent_expiry_scan|\
  job_invoice_issue|job_payout_reconcile|job_webhook_retry_sweep|\
  job_notification_dispatch_enqueue|job_notification_cleanup|job_asset_retention_sweep|\
  job_subscription_dunning) ;;
  *) echo "run-job.sh: unknown job '$JOB'" >&2; exit 2 ;;
esac

exec "$PSQL" "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -q -c "CALL public.${JOB}();"
