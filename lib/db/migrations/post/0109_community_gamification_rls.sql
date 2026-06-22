-- =============================================================================
-- Vitalé — Post-companion 0109: D7 Community + D6 Gamification (RLS, grants, counters)
-- Phase 7. Ground truth: VITALE_DB_ARCHITECTURE §4 D6 (367-378) / D7 (380-395) + §7 policy
-- catalog (lines 744, 751) + VITALE_IMPLEMENTATION_SPEC Part 2 D6 (352-363) / D7 (367-390) +
-- Part 6 Phase 7 (lines 1126-1129: community_posts → post_comments → post_likes →
-- post_poll_votes → post_flags (+ counter triggers) → user_streaks/user_badges/
-- leaderboard_scores; RLS for all) + trigger registry (line 1037: tg_post_counts/
-- tg_like_count/tg_comment_count | community | AFTER INSERT/DELETE | maintain denorm counters).
--
-- Two-layer split (arch §9): the nine NON-partitioned tables themselves (DDL + drizzle-zod +
-- CHECKs + indexes) are Drizzle-owned (lib/db/src/schema/{community,gamification}.ts, applied
-- in step 2). This raw companion owns ONLY the behavioural layer that Drizzle cannot express:
-- SECURITY DEFINER helpers, RLS enable + policies, grants, the denorm-counter triggers, the
-- touch triggers, and the raw FK user_badges.badge_type_id → badge_types (badge_types is the
-- raw-only lookup seeded in 0003 — no Drizzle pgTable to .references()).
--
-- Posture: RLS-ON (ENABLE, per the per-table specs — NOT FORCE; community is org-scoped data,
-- not [B] deny-all). REVOKE the Supabase default grants from anon (community is authenticated-
-- only) and re-GRANT precise DML to authenticated; rows are gated by the policies below. NOT
-- forcing RLS also lets the SECURITY DEFINER counter triggers (owned by the BYPASSRLS migration
-- role) maintain community_posts.like_count/comment_count without tripping the table's own RLS.
-- service_role (BYPASSRLS) runs the streak-rollover / badge-award / leaderboard-aggregation jobs.
--
-- COUNTER TRIGGERS — names per arch/spec: a SINGLE function public.tg_post_counts() (the arch
-- attributes "maintain like_count/comment_count" to community_posts) is invoked by TWO triggers
-- named tg_like_count (on post_likes) and tg_comment_count (on post_comments). The mutation must
-- originate on the CHILD tables (you cannot maintain a denorm count from a trigger on the table
-- that holds it); the atomic UPDATE … SET c = GREATEST(c ± 1, 0) keeps counts consistent under
-- concurrent likes/comments (spec test line 1129).
--
-- DPDP: no ambient admin reach into community content. is_admin() appears ONLY where a per-table
-- spec explicitly grants it (community_memberships SELECT line 386; user_streaks SELECT line 357).
-- =============================================================================

-- =============================================================================
-- SECTION 1 — Community-scope helpers (SECURITY DEFINER STABLE; owned by the BYPASSRLS migration
-- role so the lookups are not themselves RLS-filtered, mirroring 0005/0101/0108). These resolve
-- the org of a post/comment and test community membership / program participation, so the policies
-- never embed RLS-sensitive subqueries directly. GRANT EXECUTE to authenticated only (no anon).
-- =============================================================================

-- caller holds an ACTIVE community membership in the org (the community-read principal)
CREATE OR REPLACE FUNCTION public.is_community_member(p_org uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_memberships cm
    WHERE cm.organization_id = p_org AND cm.user_id = auth.uid() AND cm.status = 'active');
$$;

-- community-read scope: an active community member OR any active staff member of the org
-- (coaches/managers see their own community feed). Used as the SELECT/INSERT base for D7 content.
CREATE OR REPLACE FUNCTION public.can_view_org_community(p_org uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.is_community_member(p_org) OR public.is_active_org_member(p_org);
$$;

-- resolve a post's owning org (used to scope comments/likes/votes/flags to the post's community)
CREATE OR REPLACE FUNCTION public.post_organization(p_post uuid)
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT cp.organization_id FROM public.community_posts cp WHERE cp.id = p_post;
$$;

-- resolve a comment's owning org (via its parent post)
CREATE OR REPLACE FUNCTION public.comment_organization(p_comment uuid)
  RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT cp.organization_id
  FROM public.post_comments pc
  JOIN public.community_posts cp ON cp.id = pc.post_id
  WHERE pc.id = p_comment;
$$;

-- caller is an active participant of a program (leaderboard program-scope read principal)
CREATE OR REPLACE FUNCTION public.is_program_participant(p_program uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.program_enrollments e
    WHERE e.program_id = p_program AND e.user_id = auth.uid() AND e.status = 'active');
$$;

GRANT EXECUTE ON FUNCTION
  public.is_community_member(uuid),
  public.can_view_org_community(uuid),
  public.post_organization(uuid),
  public.comment_organization(uuid),
  public.is_program_participant(uuid)
TO authenticated;

-- =============================================================================
-- SECTION 2 — Denorm counter function. ONE function, two trigger bindings (see header). The atomic
-- UPDATE makes concurrent ±1 mutations serialisable on the target post row; GREATEST(…,0) floors
-- the count defensively. SECURITY DEFINER (BYPASSRLS owner) so it can write community_posts even
-- though the liker/commenter has no UPDATE policy on the post. AFTER trigger ⇒ return value ignored.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.tg_post_counts() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_post  uuid    := COALESCE(NEW.post_id, OLD.post_id);
  v_delta integer := CASE TG_OP WHEN 'INSERT' THEN 1 WHEN 'DELETE' THEN -1 ELSE 0 END;
BEGIN
  IF TG_ARGV[0] = 'like_count' THEN
    UPDATE public.community_posts
       SET like_count = GREATEST(like_count + v_delta, 0)
     WHERE id = v_post;
  ELSIF TG_ARGV[0] = 'comment_count' THEN
    UPDATE public.community_posts
       SET comment_count = GREATEST(comment_count + v_delta, 0)
     WHERE id = v_post;
  END IF;
  RETURN NULL;
END $$;

-- =============================================================================
-- SECTION 3 — Raw FK: user_badges.badge_type_id → badge_types(id). badge_types is the raw-only
-- evolving-set lookup (created/seeded in 0003); Drizzle models badge_type_id as a plain uuid, so
-- the constraint is added here (guarded for idempotency; tables empty at build ⇒ plain/VALID).
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_badges_badge_type_fk') THEN
    ALTER TABLE public.user_badges
      ADD CONSTRAINT user_badges_badge_type_fk
      FOREIGN KEY (badge_type_id) REFERENCES public.badge_types (id);
  END IF;
END $$;

-- =============================================================================
-- SECTION 4 — RLS enable (RLS-ON; not FORCE) + trigger attachments for all nine tables.
-- tg_touch_updated_at goes on the five tables that carry updated_at (community_posts,
-- post_comments, post_flags, community_memberships, user_streaks); the counter triggers go on the
-- two child tables. post_likes / post_poll_votes / user_badges / leaderboard_scores have no
-- updated_at (no touch trigger).
-- =============================================================================
ALTER TABLE public.community_posts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_poll_votes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_flags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_scores     ENABLE ROW LEVEL SECURITY;

-- touch triggers (updated_at maintenance)
DROP TRIGGER IF EXISTS community_posts_touch ON public.community_posts;
CREATE TRIGGER community_posts_touch BEFORE UPDATE ON public.community_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS post_comments_touch ON public.post_comments;
CREATE TRIGGER post_comments_touch BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS post_flags_touch ON public.post_flags;
CREATE TRIGGER post_flags_touch BEFORE UPDATE ON public.post_flags
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS community_memberships_touch ON public.community_memberships;
CREATE TRIGGER community_memberships_touch BEFORE UPDATE ON public.community_memberships
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
DROP TRIGGER IF EXISTS user_streaks_touch ON public.user_streaks;
CREATE TRIGGER user_streaks_touch BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- denorm counters (tg_post_counts bound twice — see header / SECTION 2)
DROP TRIGGER IF EXISTS tg_like_count ON public.post_likes;
CREATE TRIGGER tg_like_count AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.tg_post_counts('like_count');
DROP TRIGGER IF EXISTS tg_comment_count ON public.post_comments;
CREATE TRIGGER tg_comment_count AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.tg_post_counts('comment_count');

-- =============================================================================
-- SECTION 5 — Grants. REVOKE Supabase defaults from anon (community is authenticated-only) and
-- from authenticated, then re-GRANT precise DML. Read-only-for-clients tables (user_streaks,
-- user_badges, leaderboard_scores) get SELECT only — the rollover / award-RPC / aggregation jobs
-- write as service_role (BYPASSRLS). No DELETE on soft-deleted/append content (posts, comments,
-- flags, memberships); post_likes gets DELETE (unlike) and post_poll_votes gets UPDATE/DELETE
-- (change/retract a vote).
-- =============================================================================
REVOKE ALL ON public.community_posts        FROM anon, authenticated;
REVOKE ALL ON public.post_comments          FROM anon, authenticated;
REVOKE ALL ON public.post_likes             FROM anon, authenticated;
REVOKE ALL ON public.post_poll_votes        FROM anon, authenticated;
REVOKE ALL ON public.post_flags             FROM anon, authenticated;
REVOKE ALL ON public.community_memberships  FROM anon, authenticated;
REVOKE ALL ON public.user_streaks           FROM anon, authenticated;
REVOKE ALL ON public.user_badges            FROM anon, authenticated;
REVOKE ALL ON public.leaderboard_scores     FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE         ON public.community_posts        TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.post_comments          TO authenticated;
GRANT SELECT, INSERT, DELETE         ON public.post_likes             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_poll_votes        TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.post_flags             TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.community_memberships  TO authenticated;
GRANT SELECT                         ON public.user_streaks           TO authenticated;
GRANT SELECT                         ON public.user_badges            TO authenticated;
GRANT SELECT                         ON public.leaderboard_scores     TO authenticated;

-- =============================================================================
-- SECTION 6 — Policies (TO authenticated; no anon). DROP IF EXISTS first for idempotency.
-- =============================================================================

-- community_posts: community members + org staff read; a member posts as themselves; author or
-- moderate_community staff edit (status hide/remove, pin). Denorm counts are trigger-managed.
DROP POLICY IF EXISTS community_posts_select ON public.community_posts;
CREATE POLICY community_posts_select ON public.community_posts FOR SELECT TO authenticated
  USING (public.can_view_org_community(organization_id));
DROP POLICY IF EXISTS community_posts_insert ON public.community_posts;
CREATE POLICY community_posts_insert ON public.community_posts FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid() AND public.can_view_org_community(organization_id));
DROP POLICY IF EXISTS community_posts_update ON public.community_posts;
CREATE POLICY community_posts_update ON public.community_posts FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid() OR public.is_org_member(organization_id, 'moderate_community'))
  WITH CHECK (author_user_id = auth.uid() OR public.is_org_member(organization_id, 'moderate_community'));

-- post_comments: scoped to the parent post's community (same readers as the post). Author or
-- moderate_community staff edit.
DROP POLICY IF EXISTS post_comments_select ON public.post_comments;
CREATE POLICY post_comments_select ON public.post_comments FOR SELECT TO authenticated
  USING (public.can_view_org_community(public.post_organization(post_id)));
DROP POLICY IF EXISTS post_comments_insert ON public.post_comments;
CREATE POLICY post_comments_insert ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid() AND public.can_view_org_community(public.post_organization(post_id)));
DROP POLICY IF EXISTS post_comments_update ON public.post_comments;
CREATE POLICY post_comments_update ON public.post_comments FOR UPDATE TO authenticated
  USING (author_user_id = auth.uid() OR public.is_org_member(public.post_organization(post_id), 'moderate_community'))
  WITH CHECK (author_user_id = auth.uid() OR public.is_org_member(public.post_organization(post_id), 'moderate_community'));

-- post_likes: community read; self-write (like as self, unlike own).
DROP POLICY IF EXISTS post_likes_select ON public.post_likes;
CREATE POLICY post_likes_select ON public.post_likes FOR SELECT TO authenticated
  USING (public.can_view_org_community(public.post_organization(post_id)));
DROP POLICY IF EXISTS post_likes_insert ON public.post_likes;
CREATE POLICY post_likes_insert ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_org_community(public.post_organization(post_id)));
DROP POLICY IF EXISTS post_likes_delete ON public.post_likes;
CREATE POLICY post_likes_delete ON public.post_likes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- post_poll_votes: community read; self casts/changes/retracts their own one vote (UNIQUE enforces one).
DROP POLICY IF EXISTS post_poll_votes_select ON public.post_poll_votes;
CREATE POLICY post_poll_votes_select ON public.post_poll_votes FOR SELECT TO authenticated
  USING (public.can_view_org_community(public.post_organization(post_id)));
DROP POLICY IF EXISTS post_poll_votes_insert ON public.post_poll_votes;
CREATE POLICY post_poll_votes_insert ON public.post_poll_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_org_community(public.post_organization(post_id)));
DROP POLICY IF EXISTS post_poll_votes_update ON public.post_poll_votes;
CREATE POLICY post_poll_votes_update ON public.post_poll_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS post_poll_votes_delete ON public.post_poll_votes;
CREATE POLICY post_poll_votes_delete ON public.post_poll_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- post_flags: SELECT = reporter + moderate_community; INSERT = any community member flags as self;
-- UPDATE (triage status/reviewed_by) = moderate_community. Org resolved from the single non-null
-- target (Blocker-5 CHECK guarantees exactly one of post_id/comment_id).
DROP POLICY IF EXISTS post_flags_select ON public.post_flags;
CREATE POLICY post_flags_select ON public.post_flags FOR SELECT TO authenticated
  USING ( reporter_user_id = auth.uid()
          OR public.is_org_member(COALESCE(public.post_organization(post_id), public.comment_organization(comment_id)), 'moderate_community') );
DROP POLICY IF EXISTS post_flags_insert ON public.post_flags;
CREATE POLICY post_flags_insert ON public.post_flags FOR INSERT TO authenticated
  WITH CHECK ( reporter_user_id = auth.uid()
               AND public.can_view_org_community(COALESCE(public.post_organization(post_id), public.comment_organization(comment_id))) );
DROP POLICY IF EXISTS post_flags_update ON public.post_flags;
CREATE POLICY post_flags_update ON public.post_flags FOR UPDATE TO authenticated
  USING (public.is_org_member(COALESCE(public.post_organization(post_id), public.comment_organization(comment_id)), 'moderate_community'))
  WITH CHECK (public.is_org_member(COALESCE(public.post_organization(post_id), public.comment_organization(comment_id)), 'moderate_community'));

-- community_memberships: SELECT = same-org community members + moderate_community staff + admins
-- (spec line 386 explicitly includes admins — membership is org metadata, not PHI). INSERT = self
-- join OR staff invite (moderate_community); UPDATE (leave) = self OR staff.
DROP POLICY IF EXISTS community_memberships_select ON public.community_memberships;
CREATE POLICY community_memberships_select ON public.community_memberships FOR SELECT TO authenticated
  USING ( public.is_community_member(organization_id)
          OR public.is_org_member(organization_id, 'moderate_community')
          OR public.is_admin() );
DROP POLICY IF EXISTS community_memberships_insert ON public.community_memberships;
CREATE POLICY community_memberships_insert ON public.community_memberships FOR INSERT TO authenticated
  WITH CHECK ( user_id = auth.uid() OR public.is_org_member(organization_id, 'moderate_community') );
DROP POLICY IF EXISTS community_memberships_update ON public.community_memberships;
CREATE POLICY community_memberships_update ON public.community_memberships FOR UPDATE TO authenticated
  USING ( user_id = auth.uid() OR public.is_org_member(organization_id, 'moderate_community') )
  WITH CHECK ( user_id = auth.uid() OR public.is_org_member(organization_id, 'moderate_community') );

-- user_streaks: SELECT self + admins (spec line 357). Writes = streak-rollover job (service_role);
-- no authenticated write policy.
DROP POLICY IF EXISTS user_streaks_select ON public.user_streaks;
CREATE POLICY user_streaks_select ON public.user_streaks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- user_badges: SELECT self + public profile (badges are public-profile achievements ⇒ readable by
-- any authenticated user; spec line 360). INSERT = award RPC (service_role); no authenticated write.
DROP POLICY IF EXISTS user_badges_select ON public.user_badges;
CREATE POLICY user_badges_select ON public.user_badges FOR SELECT TO authenticated
  USING (true);

-- leaderboard_scores: SELECT = own row, OR the whole platform board, OR (program board) program
-- participants (spec line 363). Writes = aggregation job (service_role); no authenticated write.
DROP POLICY IF EXISTS leaderboard_scores_select ON public.leaderboard_scores;
CREATE POLICY leaderboard_scores_select ON public.leaderboard_scores FOR SELECT TO authenticated
  USING ( user_id = auth.uid()
          OR scope = 'platform'
          OR (scope = 'program' AND public.is_program_participant(program_id)) );

-- =============================================================================
-- NOTES / deferred:
--   • user_badges "public profile" is implemented as authenticated-wide SELECT (USING true). If a
--     profile-visibility flag is later added (D1), tighten this to honour it.
--   • Community is NOT in the Realtime publication (spec §1.5 — only messages/notifications +
--     conversation presence). No publication wiring here.
--   • Comment-level likes are not tracked at launch (post_likes targets posts only); post_comments
--     .like_count is a managed column with no source table yet — left at its default.
-- =============================================================================
