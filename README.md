# Vitalé

Vitalé is a **B2B2C health-coaching platform**. Health coaches run their practice on it;
their clients use a mobile app to follow programs, log meals & health data, join the
community, attend Zoom sessions, and buy products. It is built as a **single monorepo**
with three apps that share common code.

> **New to the project? Read this whole file once, then start at [Quick start](#quick-start).**
> For the exhaustive database spec, see [`VITALE_DB_ARCHITECTURE.md`](./VITALE_DB_ARCHITECTURE.md).

---

## 1. What's in the box

| App | Folder | Stack | Who uses it |
|---|---|---|---|
| **API server** | `artifacts/api-server` | Node + Express, Drizzle ORM | Backend for both clients (the only thing that talks to the database) |
| **Coach platform** | `artifacts/coach-platform` | React + Vite | Coaches & their staff (web dashboard) |
| **Mobile app** | `artifacts/mobile` | React Native + Expo | Customers (iOS/Android) |

**Shared libraries** (`lib/*`) used by the apps:

| Library | Purpose |
|---|---|
| `lib/db` | Database schema (Drizzle models) + all SQL migrations + the access-control helpers |
| `lib/api-spec` | The OpenAPI contract (`openapi.yaml`) — the single source of truth for the API shape |
| `lib/api-client-react` | Auto-generated typed API client (React Query) used by both front-ends |
| `lib/api-zod` | Auto-generated request/response validation schemas |

**Key principle:** the **API server is the only component that touches the database.** The web
and mobile apps only ever call the API. **Supabase is used for *login/authentication only*** —
it is **not** the database; all real data lives in PostgreSQL.

---

## 2. The operating model (who can do what)

Everything in the system is owned by an **organization**, not by an individual person.

| Role | Works in | Owns / can do |
|---|---|---|
| **Customer / User** | Mobile app | Owns all their own health, meal & profile data. Grants *temporary, scoped* access to a coach org. |
| **Coach** | Web | Owns exactly **one** organization (billing owner + admin). Creates programs, diet charts, community, clinical records, products, and staff. |
| **Nutritionist** (staff) | Web | A member of a coach's org with a *subset* of the org's capabilities, granted by the coach. |
| **Community Manager** (staff) | Web | A member with (typically) community-moderation only; no health-data access. |
| **Admin** (Vitalé staff) | Web | Subscriptions, revenue, KYC, moderation, compliance. **No ambient access to customer health data** — only via a time-boxed, audited support case. |

**Three rules that shape the entire schema:**
1. **Org owns the assets, not the coach.** One verified coach = one organization (permanent). Staff
   come and go via membership rows; if a nutritionist leaves, their diet charts and notes *stay* with
   the org, with original authorship preserved.
2. **No ambient health access.** A coach can see a customer's health data **only** while the customer
   has an *active, unexpired access grant* **and** the staff member holds the right capability.
3. **History is immutable.** Records are never hard-deleted; they are status-flipped. "Who created this"
   is never rewritten.

---

## 3. Prerequisites

Install these **before** anything else:

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **22.x** | See [`.nvmrc`](./.nvmrc). Use `nvm install 22 && nvm use`. |
| **pnpm** | **11.x** | This repo uses pnpm workspaces. `corepack enable` will auto-install the pinned version. **Do not use npm/yarn.** |
| **PostgreSQL** | **18.x** | The tested version. The schema installs cleanly on a vanilla local install (heavy add-ons are optional). |
| **`psql`** CLI | any recent | Needed to apply the database migrations. (macOS: `brew install libpq && brew link --force libpq`.) |

You also need **access credentials** (Supabase keys, database password, etc.) — these are **not** in the
repo for security. **Ask the project owner for the shared `.env` values** (see [section 5](#5-environment-variables)).

---

## 4. Quick start

```bash
# 1. Install dependencies for the whole monorepo
corepack enable
pnpm install

# 2. Create a local database named "vitale"
createdb vitale          # or: psql -c "CREATE DATABASE vitale;"

# 3. Point the DB tools at it (used by the migration scripts below)
export DATABASE_URL="postgresql://postgres@localhost:5432/vitale"

# 4. Build the schema — TWO batches, in this order:
pnpm --filter @workspace/db db:raw        # foundation (extensions, enums, functions, RLS helpers)
pnpm --filter @workspace/db db:raw:post   # all domain tables, policies & triggers

# 5. Create the env files (see section 5), then start the three apps in separate terminals:
pnpm --filter @workspace/api-server dev     # → http://localhost:3000  (API at /api)
pnpm --filter @workspace/coach-platform dev # → http://localhost:5173  (coach web)
pnpm --filter @workspace/mobile dev         # → Expo dev server (scan QR with Expo Go)
```

**Optional — sample data:** `pnpm --filter @workspace/scripts seed` fills the DB with demo content.
It currently keys off two specific seeded user emails, so it only works after those users exist (created
by signing up through the app). New team members can simply **sign up fresh** in the coach web app instead.

**Tip — skip login while testing the API/mobile:** set `DEMO_MODE=true` and a `DEMO_USER_ID` in the API
server's `.env` to bypass real authentication locally. (The coach web app always uses real login — just
sign up.)

---

## 5. Environment variables

Each app reads a local, git-ignored `.env`. Copy the template and fill in the shared values:

```bash
cp artifacts/api-server/.env.example     artifacts/api-server/.env
cp artifacts/coach-platform/.env.example artifacts/coach-platform/.env
cp artifacts/mobile/.env.example         artifacts/mobile/.env
```

| App | Must set | Where it comes from |
|---|---|---|
| **api-server** | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | Your local DB + the shared Supabase project (the last two are **secrets** — ask the owner) |
| **coach-platform** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` | Shared Supabase project (anon key is public-safe) + `http://localhost:3000/api` |
| **mobile** | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` | Same Supabase project + your machine's API URL (use your LAN IP for a physical phone) |

Payments (Cashfree) and video (Zoom) keys are **optional** — only needed to test those specific features.
**Never commit a `.env` file.**

---

## 6. How the database is organized

PostgreSQL holds everything. The schema (in `lib/db/src/schema/`) is split into **16 domains**:

| | Domain | What it holds |
|---|---|---|
| D0 | **Organizations & Membership** | `coach_organizations`, `organization_members`, permissions, invitations |
| D1 | **Identity** | `users` (`id` = Supabase login id), `user_profiles`, `professional_profiles` |
| D2 | **Access Control & DPDP** | `access_grants`, consent records, audit logs |
| D3 | **Programs & Enrollment** | `programs` → modules → sessions; `program_enrollments` |
| D4 | **Nutrition & Diet** | `diet_charts` (+ versions, assignments), `nutrition_logs` |
| D5 | **Health Data** | `metric_definitions` + `health_observations` (catalog + readings) |
| D6 | **Gamification** | badges, points, streaks |
| D7 | **Community** | `community_posts`, comments, likes, polls, flags |
| D8 | **Payments & Billing** | subscriptions, invoices, enrollment payments, payouts (money in **paise**, immutable) |
| D9 | **Collaboration & Care** | `care_plans`, `care_team_members`, cross-coach agreements |
| D10 | **Notifications** | per-user notifications |
| D11 | **Lab Tests** | org-aware lab orders & reports |
| D12 | **Commerce / Shop** | org-owned products, orders |
| D13 | **Messaging** | conversations, messages, attachments |
| D14 | **Clinical Coaching** | append-only `clinical_notes` (corrections via addenda) |
| D15 | **Assets** | media gateway (avatars, PHI files via signed URLs) |

**Conventions worth knowing day one:**
- **IDs:** every table uses a time-ordered **UUIDv7**, generated in code (not by the DB). `users.id` is the exception — it equals the Supabase login id.
- **Money:** stored as **`bigint` paise** (₹1 = 100), never floats.
- **Time:** `timestamptz` everywhere; business-day grouping uses an IST date column.
- **Deletes:** nothing is truly deleted — user content gets a `deleted_at`; financial/clinical records are append-only; relationships flip a `status`.
- **High-volume tables** (health observations, nutrition logs, messages, notifications, audit) are **month-partitioned**.

---

## 7. Roles & relationships (how the pieces connect)

```
users ─1:1─ user_profiles / professional_profiles
coach_organizations ─owned by(1:1)→ users (the coach)
coach_organizations ─1:N─ organization_members ─1:N─ permissions     (staff + their capabilities)
coach_organizations ─1:N─ programs / diet_charts / community / products / care_plans
program_enrollments / diet_chart_assignments ──→ users               (the customer)
users ──(data subject)── access_grants ──(grantee)── coach_organizations
        effective access = access_grant  ∩  member capabilities  ∩  care-team scope   (most restrictive wins)
care_plans ─1:N─ care_team_members ──→ users     (cross-org needs a collaboration_agreement)
conversations ─1:N─ participants + messages      (coach↔client via grant; peer↔peer via shared context)
```

The crucial edge is **`access_grants`**: a customer (on mobile) explicitly grants an org *scoped, time-boxed*
access to a category of their data. A coach's actual visibility is the **intersection** of (a) that grant,
(b) the staff member's granted capabilities, and (c) any care-team scope — always the *most restrictive*.

---

## 8. The access rules (security model)

Security is enforced **in the database** via PostgreSQL **Row-Level Security (RLS)**, which is **ON for every
table**. The API sets the current user, and the database itself decides what each query may see.

- **`withUserContext`** — the normal path. Runs the query *as the logged-in user* (`auth.uid()` is set), so
  RLS policies apply. **Use this for almost everything.**
- **`withServiceContext`** — bypasses RLS. **Only** for trusted server jobs and payment webhooks (e.g.
  confirming a Cashfree payment). Never use it to serve a user request.

**The five guarantees the schema enforces (do not work around these):**
1. **No ambient health access** — needs an active grant *and* the `view_client_health` capability; admins only via an audited support case.
2. **No orphaned access** — every grant is tied to a live source (an enrollment, a care plan…); when the source ends, access is retired.
3. **No privilege escalation** — a member can never grant *themselves* permissions; effective access is the intersection of grant ∩ capabilities ∩ care-team.
4. **No stale access** — grants expire; removing a staff member revokes their access while keeping their authorship intact.
5. **Full auditability** — every health-data read and permission change is recorded in an immutable audit log.

> **Practical rule for developers:** never read from Supabase's `auth.users`; never put real secrets or
> `x-user-id` headers into production code (that header is DEMO_MODE only); pass `numeric` columns as strings.

---

## 9. Project structure

```
artifacts/
  api-server/        Express API  (src/routes = endpoints, src/middlewares = auth/identity)
  coach-platform/    React web app (src/pages, src/lib = data hooks, src/components)
  mobile/            Expo app      (app/ = screens, lib/ = data hooks, context/ = state)
lib/
  db/                schema (src/schema), migrations (migrations/ + migrations/post/), access helpers
  api-spec/          openapi.yaml  (regenerate the client after editing it)
  api-client-react/  generated typed API client
  api-zod/           generated validation schemas
infra/               AWS deployment (Terraform) — see infra/DEPLOY.md
scripts/             seed + maintenance scripts
```

---

## 10. Common commands

```bash
pnpm install                                   # install everything
pnpm --filter @workspace/<app> dev             # run an app (api-server | coach-platform | mobile)
pnpm --filter @workspace/<app> typecheck       # type-check one package
pnpm typecheck                                 # type-check the whole repo
pnpm --filter @workspace/coach-platform build  # production build of the coach web app
pnpm --filter @workspace/db db:raw && pnpm --filter @workspace/db db:raw:post   # (re)build the schema
pnpm --filter @workspace/api-spec codegen      # regenerate the API client after editing openapi.yaml
```

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| `Use pnpm instead` on install | Run `corepack enable`, then `pnpm install` (npm/yarn are blocked on purpose). |
| Coach web loads but can't log in / fetch | The API isn't running or `.env` is missing — start `api-server` and check `VITE_API_URL`. |
| DB build errors about `pg_cron` / `pg_partman` | Harmless — those add-ons are optional and skipped automatically on a local install. |
| "permission denied" on a query | RLS is working as intended — the logged-in user lacks an access grant/capability for that data. |
| Mobile can't reach the API on a real phone | Set `EXPO_PUBLIC_API_URL` to your computer's LAN IP (e.g. `http://192.168.1.5:3000/api`), not `localhost`. |

---

## 12. Where to go deeper

- **[`VITALE_DB_ARCHITECTURE.md`](./VITALE_DB_ARCHITECTURE.md)** — the full database spec: every table, enum, policy, and the complete relationship map.
- **`infra/DEPLOY.md`** — how the project deploys to AWS.
- **`lib/api-spec/openapi.yaml`** — the complete API contract.
