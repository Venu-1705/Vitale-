-- =============================================================================
-- Vitalé — Post-companion 0124: NEUTRALIZED (no-op stub)
-- -----------------------------------------------------------------------------
-- This file ORIGINALLY bundled lifecycle cascade triggers spanning THREE domains
-- (D3 programs, D4 diet-chart assignments, D2 member/grant cascades). It was never
-- applied to the live cluster and was never accepted. Its bodies also failed the
-- production bar (e.g. the program-publish snapshot captured only title/description,
-- not the full curriculum; the enrollment grant over-granted 'health_data').
--
-- It has been deliberately neutralized to a no-op so that a full `db:raw:post` re-run
-- does NOT silently activate UNACCEPTED cross-domain triggers. Each domain owns its
-- lifecycle in its own accepted companion:
--   • D3 Programs (publish→version snapshot, enrollment→grant, completion/cancel→grant
--     revoke, coach read branches, enroll/cancel RPCs) ........ 0137_programs_lifecycle.sql
--   • D4 diet-chart assignment grants/cascades ................ (to be authored in the D4
--                                                               access-cascade acceptance phase)
--   • D2 member-removal / grant-revoke cascades .............. (to be authored in the D2
--                                                               access-cascade acceptance phase)
--
-- Intentionally empty below this line. Kept as a numbered placeholder to preserve the
-- migration sequence and document the supersession.
-- =============================================================================

DO $$ BEGIN
  RAISE NOTICE '0124 neutralized — D3 lifecycle now owned by 0137_programs_lifecycle.sql; D4/D2 cascades deferred to their own accepted companions.';
END $$;
