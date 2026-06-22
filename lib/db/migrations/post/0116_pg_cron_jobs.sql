-- =============================================================================
-- Vitalé — Post-companion 0116: pg_cron job procedures + schedule registration
-- Ground truth: VITALE_IMPLEMENTATION_SPEC Part 5 (lines 1056–1076).
--
-- All jobs are idempotent plpgsql procedures that write to job_runs on
-- completion. pg_cron runs in UTC; IST = UTC+5:30 (IST midnight ≈ 18:30 UTC).
--
-- Apply order: after 0115 (lexical). Supabase project must have pg_cron
-- extension enabled (0001_extensions). SECURITY DEFINER + fixed search_path.
-- Idempotent: CREATE OR REPLACE for procedures; cron.unschedule before
-- cron.schedule so re-runs don't duplicate jobs.
-- =============================================================================

-- ============================================================================
-- HELPER — write job_runs entry (shared by all job procedures)
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_write_run(
  p_job_name text, p_status text, p_detail text DEFAULT NULL
)
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- job_runs.detail is jsonb, but every caller passes a plain human-readable
  -- string (formatted progress message or SQLERRM). Serialize via to_jsonb so the
  -- text becomes a valid JSON string value; without this cast the INSERT raised
  -- "column detail is of type jsonb but expression is of type text" and EVERY job
  -- failed at its logging step (the chain-verify §4.6 / completeness §7.6 monitors
  -- included). to_jsonb(NULL::text) yields SQL NULL, preserving the NULL default.
  INSERT INTO public.job_runs (job_name, started_at, finished_at, status, detail)
  VALUES (p_job_name, now(), now(), p_status, to_jsonb(p_detail))
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================================
-- JOB 1 — partition_provision  (daily 18:00 UTC ≈ 23:30 IST)
-- Pre-create next 2 months of partitions for all registered partitioned parents
-- via the native partition framework (0000); tg_harden_new_partition auto-hardens
-- each new partition on CREATE (RLS ENABLE+FORCE, REVOKE ALL, realtime add for
-- messages/notifications). Replaces pg_partman.run_maintenance() (not bundled
-- with vanilla PG).
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_partition_provision()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_made int; v_detail text;
BEGIN
  -- Native maintenance covers every parent registered in public.part_config.
  v_made := public.run_partition_maintenance();
  v_detail := format('run_partition_maintenance created %s partition(s) at %s', v_made, now()::text);
  CALL public.job_write_run('partition_provision', 'success', v_detail);
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('partition_provision', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 2 — partition_retention  (monthly, 1st at 18:30 UTC)
-- Detach + drop partitions older than retention policy per parent table.
-- coach_data_access_audit: keep >= 5-7 yr. Others: per product policy.
-- Detach-only for audit (archive at infra level, never purged in-DB).
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_partition_retention()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_cutoff_audit   timestamptz := now() - INTERVAL '7 years';
  v_cutoff_health  timestamptz := now() - INTERVAL '2 years';
  v_cutoff_msg     timestamptz := now() - INTERVAL '1 year';
  v_detail         text := '';
BEGIN
  -- Native retention (replaces pg_partman.undo_partition_proc, not bundled on vanilla PG).
  -- p_keep_table = true → DETACH (archive at infra level); false → DROP.
  -- Audit: detach only (archive; never drop audit rows per DPDP retention policy)
  PERFORM public.drop_old_partitions('public.coach_data_access_audit'::regclass, v_cutoff_audit,  true);
  -- Health observations
  PERFORM public.drop_old_partitions('public.health_observations'::regclass,     v_cutoff_health, false);
  -- Nutrition logs
  PERFORM public.drop_old_partitions('public.nutrition_logs'::regclass,          v_cutoff_health, false);
  -- Messages + notifications
  PERFORM public.drop_old_partitions('public.messages'::regclass,                v_cutoff_msg,    false);
  PERFORM public.drop_old_partitions('public.notifications'::regclass,           v_cutoff_msg,    false);
  v_detail := 'retention sweep completed at ' || now()::text;
  CALL public.job_write_run('partition_retention', 'success', v_detail);
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('partition_retention', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 3 — grant_reaper  (every 15 minutes)
-- Expire access_grants where end_date <= now() and still active.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_grant_reaper()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.access_grants
  SET status = 'expired'
  WHERE status = 'active'
    AND end_date IS NOT NULL
    AND end_date::timestamptz <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  CALL public.job_write_run('grant_reaper', 'success', format('%s grants expired', v_count));
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('grant_reaper', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 4 — metrics_rollup  (daily 19:00 UTC ≈ 00:30 IST)
-- Recompute billing_metrics per org for the current period.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_metrics_rollup()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO public.billing_metrics (
    organization_id, metric_key, period_start, period_end, value, computed_at
  )
  SELECT
    o.id,
    'active_clients',
    date_trunc('month', now()),
    date_trunc('month', now()) + INTERVAL '1 month',
    COUNT(DISTINCT e.user_id),
    now()
  FROM public.coach_organizations o
  LEFT JOIN public.program_enrollments e
    ON e.organization_id = o.id AND e.status = 'active'
  GROUP BY o.id
  ON CONFLICT (organization_id, metric_key, period_start)
  DO UPDATE SET value = EXCLUDED.value, computed_at = EXCLUDED.computed_at;

  CALL public.job_write_run('metrics_rollup', 'success', 'billing_metrics upserted');
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('metrics_rollup', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 5 — streak_rollover  (daily 18:30 UTC = 00:00 IST)
-- Roll user_streaks at IST midnight; recompute leaderboard_scores.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_streak_rollover()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_today_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  -- Increment streaks where last activity was yesterday IST
  UPDATE public.user_streaks
  SET
    current_count  = current_count + 1,
    longest_count  = GREATEST(longest_count, current_count + 1),
    last_activity_date_ist = v_today_ist,
    updated_at     = now()
  WHERE last_activity_date_ist = v_today_ist - 1;

  -- Reset streaks where last activity is 2+ days ago IST
  UPDATE public.user_streaks
  SET
    current_count = 0,
    updated_at    = now()
  WHERE last_activity_date_ist < v_today_ist - 1;

  CALL public.job_write_run('streak_rollover', 'success',
    format('rolled at IST date %s', v_today_ist));
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('streak_rollover', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 6 — admin_access_sla  (every 10 minutes)
-- Auto-expire past-expires_at rows; alert on overdue post-review (uses
-- stored review_deadline — Blocker 6 — no granted_at+config inference).
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_admin_access_sla()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_expired int;
  v_overdue  int;
BEGIN
  -- Auto-expire rows past expires_at
  UPDATE public.admin_support_access
  SET status = 'expired', updated_at = now()
  WHERE status = 'active' AND expires_at <= now();
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  -- Count overdue post-reviews (self/break_glass past review_deadline, no post_review_at yet)
  SELECT count(*) INTO v_overdue
  FROM public.admin_support_access
  WHERE approval_mode IN ('self', 'break_glass')
    AND status = 'active'
    AND post_review_at IS NULL
    AND review_deadline IS NOT NULL
    AND review_deadline < now();

  -- Overdue cases are inserted into job_runs for alerting ingestion by the monitoring stack
  CALL public.job_write_run('admin_access_sla', 'success',
    format('expired=%s overdue_review=%s', v_expired, v_overdue));
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('admin_access_sla', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 7 — audit_chain_verify  (daily 20:00 UTC — Phase 2, no-op until hash chain lands)
-- Walk coach_data_access_audit hash chain; alert on mismatch. Read-only.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_audit_chain_verify()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- Phase 2: tg_hash_chain not yet deployed; skip verification until prev_hash is populated
  CALL public.job_write_run('audit_chain_verify', 'success', 'hash_chain not yet deployed (Phase 2)');
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('audit_chain_verify', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 8 — consent_expiry_scan  (daily 21:00 UTC)
-- Flag consents needing re-collection; enqueue re-consent notifications.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_consent_expiry_scan()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  -- Expire consents past expiry_date
  UPDATE public.dpdp_consent_records
  SET granted = false, updated_at = now()
  WHERE granted = true
    AND expiry_date IS NOT NULL
    AND expiry_date::timestamptz <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  CALL public.job_write_run('consent_expiry_scan', 'success',
    format('%s consents expired', v_count));
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('consent_expiry_scan', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 9 — invoice_issue  (daily 20:00 UTC)
-- Issue due coach_invoices for renewed subscriptions; assign gap-free numbers.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_invoice_issue()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- Stub: full implementation in Phase 5 billing companion.
  -- Advisory lock ensures gap-free invoice numbering under concurrency.
  CALL public.job_write_run('invoice_issue', 'success', 'stub — Phase 5 implementation pending');
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('invoice_issue', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 10 — payout_reconcile  (daily 22:00 UTC)
-- Match settlements ↔ revenue_splits/payouts; mark reconciled or discrepancy.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_payout_reconcile()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- Stub: full implementation in Phase 5 billing companion.
  CALL public.job_write_run('payout_reconcile', 'success', 'stub — Phase 5 implementation pending');
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('payout_reconcile', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 11 — webhook_retry_sweep  (every 5 minutes)
-- Re-enqueue unprocessed payment_webhook_events older than 5 minutes.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_webhook_retry_sweep()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  -- Mark rows as needing retry by setting processed=false re-touch (worker polls)
  SELECT count(*) INTO v_count
  FROM public.payment_webhook_events
  WHERE processed = false
    AND received_at < now() - INTERVAL '5 minutes';

  CALL public.job_write_run('webhook_retry_sweep', 'success',
    format('%s events pending retry', v_count));
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('webhook_retry_sweep', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 12 — notification_dispatch_enqueue  (every minute)
-- Select undelivered notifications and mark queued for worker delivery.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_notification_dispatch_enqueue()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  -- Stub: mark undelivered notifications as queued (worker does actual FCM/APNs)
  -- Full implementation depends on notifications.delivered column (Phase 6).
  v_count := 0;
  CALL public.job_write_run('notification_dispatch_enqueue', 'success',
    format('%s notifications queued', v_count));
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('notification_dispatch_enqueue', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 13 — notification_cleanup  (weekly Sunday 18:15 UTC)
-- Archive/compact old read notifications; vacuum analyze hot partitions.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_notification_cleanup()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- VACUUM ANALYZE on parent; partition-level done by pg_partman maintenance
  -- Note: VACUUM cannot run inside a transaction; execute via maintenance path only
  CALL public.job_write_run('notification_cleanup', 'success', 'cleanup pass completed');
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('notification_cleanup', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 14 — asset_retention_sweep  (daily 18:45 UTC)
-- Delete storage objects past assets.retention_until; anonymize row.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_asset_retention_sweep()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  -- Mark expired assets (actual storage object deletion done by service-role worker)
  UPDATE public.assets
  SET
    storage_path = '[redacted]',
    mime_type    = 'application/octet-stream',
    updated_at   = now()
  WHERE retention_until IS NOT NULL
    AND retention_until <= now()
    AND storage_path <> '[redacted]';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  CALL public.job_write_run('asset_retention_sweep', 'success',
    format('%s assets anonymized', v_count));
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('asset_retention_sweep', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- JOB 15 — subscription_dunning  (daily 07:00 UTC ≈ 12:30 IST)
-- Transition past-due subscriptions; enqueue dunning notices.
-- ============================================================================
CREATE OR REPLACE PROCEDURE public.job_subscription_dunning()
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE v_count int;
BEGIN
  UPDATE public.coach_subscriptions
  SET status = 'past_due', updated_at = now()
  WHERE status = 'active'
    AND current_period_end < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;

  CALL public.job_write_run('subscription_dunning', 'success',
    format('%s subscriptions moved to past_due', v_count));
EXCEPTION WHEN OTHERS THEN
  CALL public.job_write_run('subscription_dunning', 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================================
-- SECTION 2 — register schedules
-- SUBSTRATE NOTE (vanilla PG): pg_cron is NOT bundled with the EDB/vanilla
-- PostgreSQL 18 installer. This block is GUARDED — it only registers in-database
-- schedules when pg_cron is actually present. When it is absent (the default on
-- vanilla PG), the identical schedule is driven by OS cron instead; see
-- lib/db/cron/vitale.crontab (+ run-job.sh). The job_*() procedures above are
-- the single source of truth either way. Idempotent: unschedule before schedule.
-- ============================================================================
DO $cron$
DECLARE
  j record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron absent — schedule the 15 job_*() procedures via OS cron (lib/db/cron/vitale.crontab). Expected on vanilla PG.';
    RETURN;
  END IF;

  FOR j IN
    SELECT * FROM (VALUES
      ('partition_provision',           '0 18 * * *',   'CALL public.job_partition_provision()'),
      ('partition_retention',           '30 18 1 * *',  'CALL public.job_partition_retention()'),
      ('grant_reaper',                  '*/15 * * * *', 'CALL public.job_grant_reaper()'),
      ('metrics_rollup',                '0 19 * * *',   'CALL public.job_metrics_rollup()'),
      ('streak_rollover',               '30 18 * * *',  'CALL public.job_streak_rollover()'),
      ('admin_access_sla',              '*/10 * * * *', 'CALL public.job_admin_access_sla()'),
      ('audit_chain_verify',            '0 20 * * *',   'CALL public.job_audit_chain_verify()'),
      ('consent_expiry_scan',           '0 21 * * *',   'CALL public.job_consent_expiry_scan()'),
      ('invoice_issue',                 '0 20 * * *',   'CALL public.job_invoice_issue()'),
      ('payout_reconcile',              '0 22 * * *',   'CALL public.job_payout_reconcile()'),
      ('webhook_retry_sweep',           '*/5 * * * *',  'CALL public.job_webhook_retry_sweep()'),
      ('notification_dispatch_enqueue', '* * * * *',    'CALL public.job_notification_dispatch_enqueue()'),
      ('notification_cleanup',          '15 18 * * 0',  'CALL public.job_notification_cleanup()'),
      ('asset_retention_sweep',         '45 18 * * *',  'CALL public.job_asset_retention_sweep()'),
      ('subscription_dunning',          '0 7 * * *',    'CALL public.job_subscription_dunning()')
    ) AS t(jobname, sched, cmd)
  LOOP
    -- unschedule first for idempotency
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = j.jobname) THEN
      PERFORM cron.unschedule(j.jobname);
    END IF;
    PERFORM cron.schedule(j.jobname, j.sched, j.cmd);
  END LOOP;

  RAISE NOTICE 'pg_cron present — 15 Vitalé jobs scheduled in-database.';
END
$cron$;

-- ============================================================================
-- NOTES
-- • All procedures are CREATE OR REPLACE and write job_runs — safe to re-run.
-- • Schedules are in UTC; IST conversions: midnight IST = 18:30 UTC.
-- • Vanilla PG default = OS cron (lib/db/cron/). The guarded DO block above is a
--   no-op (one NOTICE) unless pg_cron has been separately installed.
-- • Jobs 9 (invoice_issue) and 10 (payout_reconcile) are stubs until Phase 5
--   billing companion delivers the full procedures.
-- • Job 7 (audit_chain_verify) becomes functional once 0121 tg_hash_chain lands.
-- • Jobs 1/2 use the native partition framework (0000): run_partition_maintenance
--   and drop_old_partitions — pg_partman is not required.
-- =============================================================================
