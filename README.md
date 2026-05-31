# Anacity — Tenant-Aware Multi-Community Platform

> Re-architecting a residential-community SaaS from a session-based,
> single-active-community, fixed-role system into a multi-tenant
> platform with stateless APIs, dynamic RBAC, community-scoped
> permissions, and per-tenant white-labeling.

This repository contains the **design + POC** for that re-architecture.
The canonical design is in
[`anacity_rearchitecture_design.md`](./anacity_rearchitecture_design.md).
A focused test plan is in [`docs/test-plan.md`](./docs/test-plan.md).

> **New here?** Start with
> [`docs/scope-rationale.md`](./docs/scope-rationale.md) — it explains
> what was deliberately cut from the POC (RLS, vanity domains,
> partitioning, temporal occupancy) and where the upgrade path lives
> in the design.

---

## Run it locally

Prerequisites: Node 20+, pnpm 9+, Docker (with the daemon running).

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres        # Postgres on host port 5433
pnpm db:migrate                      # apply Prisma schema
pnpm db:seed                         # 2 tenants × 2 communities, 7 users
pnpm dev                             # api :3001, web :3000
```

Then open in your browser (no `/etc/hosts` edits — modern browsers
resolve `*.localhost` to 127.0.0.1):

- `http://prestige.localhost:3000` — blue Prestige brand
- `http://sobha.localhost:3000` — green Sobha brand

Seed users (password is always `dev`):

| Email | Use for |
|---|---|
| `boss@prestige.dev` | Tenant super admin — tenant-wide grant over every Prestige community |
| `boss@sobha.dev` | Tenant super admin — tenant-wide grant over every Sobha community |
| `alice@prestige.dev` | Admin @ Lakeside, Resident @ Falcon — multi-community within a tenant |
| `bob@sobha.dev` | Admin @ both Sobha communities |
| `carol@anacity.dev` | Resident in BOTH Prestige Lakeside AND Sobha Dream Acres — cross-tenant identity |
| `dave@prestige.dev` | Resident @ Falcon — recipient of the dynamic-role demo |
| `ravi@prestige.dev` | Security across both Prestige communities |

### Run the test suite

```bash
pnpm --filter api test           # 43 backend tests (isolation + RBAC CRUD), ~13s
pnpm --filter api test:isolation # same suite, named target
pnpm --filter web test           # web component tests (Vitest + Testing Library)
```

The suite covers every row of design doc §12: cross-tenant deny,
cross-community deny, privilege-escalation block, revoke-takes-effect,
block-scoped grant enforcement, hierarchy validation, append-only
UnitAction, and cross-tenant identity.

### Demo flow (matches design doc §9)

1. `prestige.localhost:3000` → log in as **alice** → see Lakeside +
   Falcon side-by-side, no Sobha leakage
2. "Open dashboard →" on Lakeside → drill to a unit → "+ Action" →
   record `visitor_approved`
3. New tab to `sobha.localhost:3000` → log in as **carol** → only
   Sobha Dream Acres visible (same identity, different scope per host)
4. As alice → "Roles" → "+ New custom role" → "Night Shift Security"
   with `approve_visitor` only → save
5. "Memberships" → "+ Add member" (search an existing tenant user, or
   type a new email to create one inline) → then "+ Grant role" → grant
   Night Shift Security to **dave** with Block scope = Block A → save
6. Sign in as **dave** → on Block A units the "Approve visitor"
   action appears; on Block B units it doesn't (scope enforced)
7. "Brand settings" → upload a logo and/or change the primary color →
   the header logo + accent update on next navigation

---

## The problem (limitations in the current system)

| # | Limitation | Why it hurts users |
|---|---|---|
| 1 | **Session-based community switching** — users must "switch into" one community before they can act on it | A community manager responsible for 5 buildings cannot view or act on them in parallel. They constantly toggle context and lose state. |
| 2 | **Single active community per session** | Multi-tab workflows are impossible. Bookmarks, deep links, and shared URLs are broken because the action depends on hidden server-side session state. |
| 3 | **Fixed, hard-coded roles** (`Admin`, `Resident`, `Security`, `Manager`) | Every new role — Election Committee, Pet Committee, Maintenance Auditor, Clubhouse Manager — requires a code change and a deployment. Customers can't self-serve. |
| 4 | **Tight coupling between session and authorization** | Authorization decisions depend on which community is "currently selected." This produces bugs in multi-tab and API-client usage and makes the system hard to scale horizontally. |
| 5 | **No tenant boundary** | Customer organizations (Prestige, Sobha, …) are not first-class entities. Branding lives at the community level and fragments the customer's identity. |
| 6 | **No support for true multi-community management** | A user who owns units in two communities, or manages five, has to log in and out or jump through workflows the data model was not built to express. |
| 7 | **Weak white-labeling** | Branding lives at the community level, not the customer-organization level, so a customer's brand isn't consistent across their communities. |

---

## What this redesign delivers

| # | Problem | How the redesign solves it |
|---|---|---|
| 1 | Session-based switching | **Stateless APIs**: the URL carries the community (`/communities/:id/...`). No "active community" exists on the server. |
| 2 | Single active community | **Global identity token** (one login, all communities) + per-request `(user, community, scope)` ability resolution. Open 5 tabs to 5 communities, all work in parallel. |
| 3 | Fixed roles | **Dynamic RBAC**: roles and role↔permission mappings are database rows, editable from the admin UI. A new role is created in 30 seconds, no deployment. |
| 4 | Session ↔ authz coupling | **Permission-based authz with CASL**: `ability.can('approve', 'Visitor')` instead of `if (role === 'admin')`. Abilities are computed per request (Redis-cached in production). |
| 5 | No tenant boundary | **`Tenant` becomes a first-class entity** above `Community`. Branding, slug, and (future) billing live on the tenant. All tenant-scoped queries filter by `tenant_id`. DB-layer enforcement via Postgres RLS is the production hardening path. |
| 6 | Multi-community management | **Users are global identities** with N `Memberships`. A user can manage 5 communities concurrently; each request authorizes against the community in the URL. |
| 7 | Weak white-labeling | **Branding lives on `Tenant`** with a unique `slug`. A middleware resolves tenant from `Host`; Next.js edge middleware applies branding server-side so there's no flash of unbranded content. POC uses subdomains (`prestige.localhost:3000`, `sobha.localhost:3000`). Vanity apex domains are production hardening, not POC scope. |

Plus additions the original system didn't have:

- **System role templates** so creating a community auto-instantiates standard roles (Admin/Resident/Security/Manager); each community can then edit them or add custom ones. Same instantiation pattern, no per-community hand-build.
- **Block/unit-scoped grants** so a tower committee member manages only their tower, not the whole community.
- **RBAC audit log** for every permission grant — closes the "who granted whom what?" forensic gap.
- **Admin user provisioning** — from a community's Memberships screen, an admin can attach an existing tenant user or create a brand-new account inline (one search-or-create field, backed by `POST /communities/:id/users`).
- **Per-tenant logo + accent** — the branding editor takes an uploaded logo (stored inline) and a primary color; both flow into the global header and every CTA/focus ring. No-tenant surfaces fall back to the Anacity brand.

---

## Architecture at a glance

### Before

```text
Platform → Community → Block → Unit → User
( session-based, single active community, fixed roles, no tenant layer )
```

### After

```text
Platform
 └── Tenants                ← customer org, owns N communities, hosts branding
      └── Communities       ← URL-scoped, stateless
           └── Blocks
                └── Units   ← actions recorded here

Users (global)
  └── Memberships (per community)
        └── MembershipRoles (with optional block/unit scope)
              └── Roles (instantiated from system templates)
                    └── Permissions
```

### Request flow

```text
Request
  ↓
Resolve tenant from Host header        ← Redis-cached in production
  ↓
Authenticate JWT (global identity)
  ↓
Resolve membership in the URL's community
  ↓
Build CASL ability for (user, community, scope)   ← Redis-cached in production
  ↓
Authorize via ability.can(action, subject)
  ↓
Query (filtered by tenant_id / community_id)
```

---

## Key decisions

Four load-bearing decisions; full design in
[`anacity_rearchitecture_design.md`](./anacity_rearchitecture_design.md):

- **Tenant as first-class entity above Community.** Branding, slug, and isolation boundary live on the tenant — a customer's identity is consistent across their communities. App-level `tenant_id` scoping ships in the POC; Postgres RLS is the production hardening path for defense in depth.
- **Stateless, URL-scoped APIs.** Identity in the token; community in the URL; ability resolved per request. Kills "current community" server state. Without it, multi-tab and dynamic roles both fail.
- **Cached `(user, community, scope)` ability with mutation-driven invalidation.** Stateless authz needs a cache or every request runs 4–5 DB queries. Redis with explicit invalidation on RBAC mutations gives both speed and instant revocation — a revoked role loses access on the next request, not when the token expires.
- **Negative/isolation tests are the product.** For multi-tenant authz, a green happy-path with a broken isolation test is a customer data leak. The test plan mandates cross-tenant deny, cross-community deny, privilege-escalation block, revoke-invalidates-cache, and three migration regressions.

---

## POC scope

Two tenants × two communities each, on subdomains that work locally with no
DNS or hosts-file changes:

```text
Tenant: Prestige   (prestige.localhost:3000)
  ├── Prestige Lakeside Habitat
  └── Prestige Falcon City

Tenant: Sobha      (sobha.localhost:3000)
  ├── Sobha Dream Acres
  └── Sobha Forest View

Users:
  boss(es) tenant super admin per tenant               (tenant-wide grant, all communities)
  alice    admin @ Lakeside, resident @ Falcon         (multi-community, same tenant)
  bob      admin @ both Sobha communities
  carol    resident @ Lakeside AND @ Dream Acres       (cross-tenant identity)
  dave     resident @ Falcon — gets a custom role mid-demo
  ravi     security across all Prestige communities
```

The demo flow (full 8 steps in §9 of the design doc) walks through:
multi-community side-by-side, stateless URLs, branding swap between
subdomains, creating a dynamic block-scoped role in the admin UI,
assigning it, the user gaining the capability instantly, and revocation
taking effect on the next request.

---

## What's in scope vs deferred

**In scope** (design doc and POC):

- Tenant entity + per-tenant branding + subdomain resolution
- Global user identity + memberships + dynamic RBAC
- System role templates (one-tier instantiation)
- Block/unit-scoped role grants
- Stateless, URL-scoped APIs
- CASL permission-based authorization
- Migration plan from session-based system (5 phases, per-tenant rollback)
- Full isolation/regression test matrix
- RBAC audit log
- UnitAction with immutable path-column snapshots

**Deferred — production hardening** (acknowledged in §10 of the design doc, not silently dropped):

- **Postgres RLS** for DB-layer tenant isolation — defense in depth on top of app-level scoping.
- **Vanity apex domains** (`prestige.com`) via Caddy on-demand TLS + Let's Encrypt — POC subdomains demonstrate the white-labeling pattern fully.
- **Redis ability + domain caches** — the invalidation contract is described in the design; POC resolves per request from DB.
- **Partitioned `UnitAction`** via `pg_partman` — single indexed table is fine at POC volume.
- **Temporal `UnitOccupant`** (owner / tenant / family, start/end dates) — real-world but additive.
- **Refresh-token rotation + device binding** — recommended mitigation for the global-identity-token tradeoff.
- **Sharding** — RLS design preserves a clean upgrade path (Citus or app-level `tenant_id` shard key).
- **Per-customer email sender domains** (`noreply@prestige.com` with DKIM/SPF) — separate email-infra workstream.

---

## Tech stack

**Backend.** Node.js · TypeScript · NestJS · PostgreSQL · Prisma ORM · CASL (Prisma-integrated authorization) · Redis (optional in POC, required in production for ability + domain caches).

**Frontend.** Next.js (App Router) with React Server Components · TailwindCSS. Edge middleware (`middleware.ts`) handles domain → tenant resolution server-side so branding renders without flash. NestJS is the API; Next.js API routes are used only for BFF concerns.

**Test.** Jest + Supertest for backend integration (isolation matrix + RBAC CRUD/feed coverage) · Vitest + React Testing Library for web component tests (membership flows). Playwright for the 5 E2E flows is planned, not shipped in the POC — see [`docs/scope-rationale.md`](./docs/scope-rationale.md).

---

## Reading guide

| If you want to … | Read |
|---|---|
| **Understand what's in/out of POC scope and why** | [`docs/scope-rationale.md`](./docs/scope-rationale.md) — read this first |
| Understand the full design + every decision | [`anacity_rearchitecture_design.md`](./anacity_rearchitecture_design.md) — the canonical doc |
| See the entity-relationship diagram for RBAC | §4 of the design doc |
| See how isolation is enforced | §3 (tenant resolution) + §10 (production RLS path) |
| See how dynamic roles work | §4 "Dynamic RBAC" + §5 "Authorization flow per request" |
| See the migration approach | §8 "Migration from the session-based system" |
| See the test plan | §12 of the design doc; QA-focused view in [`docs/test-plan.md`](./docs/test-plan.md) |
| See the implementation workstreams | [`docs/workstreams.md`](./docs/workstreams.md) |
| See how to run it locally | [`docs/local-dev.md`](./docs/local-dev.md) — `*.localhost` tenant pattern, seed users, common workflows |
| See the backend tests | [`api/test/isolation/`](./api/test/isolation/) — 11 specs, 43 tests: design §12 isolation + RBAC CRUD/read/error branches + the activity feed |
| See the web tests | [`web/test/`](./web/test/) — Vitest component tests for the membership search-or-create + grant-role flows |

---

## Status

This project is a **design + working POC + isolation test suite**.
The foundation shipped as five workstreams:

| Workstream | Scope |
|---|---|
| W1 | Monorepo + Prisma schema + seed (2 tenants × 2 communities × 7 users) |
| W2 | Auth + dynamic RBAC + admin UI for roles and memberships |
| W3 | UnitAction recording + per-community dashboard with activity feed |
| W4 | Tenant branding admin (`manage_branding` permission + editor) |
| W5 | Test suite — backend isolation + RBAC CRUD (43 tests, 11 suites) and web component tests (Vitest), all green |

Subsequent passes on `main` build on that foundation:

- **Backend correctness** — race fixes, dedup, perf, and security-posture
  hardening across the API.
- **UX / interaction polish** — button + card feedback, drawer motion, and
  route-level loading skeletons (see [`DESIGN.md`](./DESIGN.md) §8).
- **Membership UX** — single search-or-create "Add member" flow, inline
  new-user creation, grant-role drawer, and explicit per-grant scope.
- **Branding** — logo upload (inline) + accent, rendered in the header with a
  graceful fallback; Anacity brand on no-tenant surfaces.

Every load-bearing claim in the design has working code, a UI page,
and a passing test (where the claim is API-enforceable). What's
deliberately not shipped — Postgres RLS, vanity-domain TLS, Redis
ability cache, `pg_partman` partitioning, temporal `UnitOccupant`,
Playwright E2E — is documented in
[`docs/scope-rationale.md`](./docs/scope-rationale.md) with the
upgrade path for each.
