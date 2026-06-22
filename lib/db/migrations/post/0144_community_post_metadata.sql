-- =============================================================================
-- Vitalé — Migration post/0144: community_posts.metadata
-- -----------------------------------------------------------------------------
-- Recipe/poll posts carry structured payloads (ingredients/steps, poll options) that
-- the create body previously dropped. Add a nullable JSONB `metadata` column to persist
-- them. Drizzle owns the column (lib/db/src/schema/community.ts); this companion makes a
-- fresh db:raw run idempotent. No existing column/row is changed (additive, nullable).
-- =============================================================================
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS metadata jsonb;
