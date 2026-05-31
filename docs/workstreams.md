# Implementation Workstreams

Execution plan for the POC. Five workstreams. **W1 is the gating
dependency** — nothing else can start until tenant context and the
Prisma scoping are in place. After W1, W2/W3/W4 run in parallel.
W5 (tests) ramps alongside everything.

Production-rollout migration is sketched in design doc §8; it is not
required for the POC.

---

## Dependency graph

```text
W1 (Tenancy + Prisma scoping)
   │
   ├──► W2 (RBAC + CASL)
   ├──► W3 (Units + UnitAction)
   ├──► W4 (White-labeling — spans NestJS + Next.js)
   │
   └──► W5 (Tests + CI) ── runs continuously, gates merges
```

---

## W1 — Tenancy + Prisma scoping (foundation)

| | |
|---|---|
| Scope | `Tenant` entity, `Community` linked to tenant, `Membership`, `User` (global), Prisma client wrapper that scopes every query by `tenant_id` derived from request context, soft-delete + timestamp conventions, partial-unique-index pattern |
| Modules | `prisma/schema.prisma`, `src/tenancy/`, `src/prisma/` |
| Depends on | — |

**Why it gates everything:** every other workstream needs `tenant_id`
columns and the request-scoped tenant context before it can write
tenant-aware code.

Production hardening upgrade path (out of POC scope): replace app-level
scoping with Postgres RLS + a Prisma middleware that runs
`SET app.tenant_id` per connection. Design doc §10.

---

## W2 — RBAC service + CASL

| | |
|---|---|
| Scope | `Permission`, `Role`, `RolePermission`, `MembershipRole` (with optional `block_id`/`unit_id` scope), system role-template seeder (one tier), CASL ability builder for `(user, community, scope)`, `RbacAuditLog` interceptor on all RBAC mutations, admin endpoints for role CRUD + role-permission edit + membership-role assign/revoke |
| Modules | `src/rbac/`, `src/permissions/` |
| Depends on | W1 |

The ability is resolved per request from the DB in the POC. The
production Redis ability cache is described in design doc §5; the
invalidation contract (every RBAC mutation busts the affected key) is
the only architectural commitment that has to be honoured by the POC
service shape, even without the cache.

---

## W3 — Units + UnitAction

| | |
|---|---|
| Scope | `Block`, `Unit` entities, `UnitAction` with **immutable path-column snapshots** (tenant_id, community_id, block_id, unit_id, actor_user_id captured at write time), write-time validation that `block ∈ community ∈ tenant`, INSERT-only service path (no UPDATE/DELETE), indexes on `(community_id, created_at DESC)` and `(unit_id, created_at DESC)` |
| Modules | `src/units/`, `src/actions/` |
| Depends on | W1 |

Production hardening (out of scope): monthly range-partitioning via
`pg_partman` with retention and archival; temporal `UnitOccupant`
table (owner/tenant/family, start/end dates) for ownership-history
queries. Design doc §10.

---

## W4 — White-labeling (spans NestJS + Next.js)

| | |
|---|---|
| Scope | Tenant branding fields (`logo`, `primaryColor`, `theme`), backend resolver endpoint, Next.js edge middleware for tenant resolution + branding application, admin branding UI |
| Modules | **NestJS:** `src/tenancy/`, `src/branding/`. **Next.js:** `app/middleware.ts`, `app/layout.tsx`, `app/_components/branding/`, `app/admin/branding/` |
| Depends on | W1 |

### NestJS side

- Tenant middleware: reads `Host`, strips port, resolves tenant by
  `slug`, attaches `req.tenant`.
- `GET /v1/tenants/resolve?host=<hostname>` — single source of truth
  for tenant + branding config. Redis-cached in production.
- Cache invalidation hook on every tenant/branding mutation (production).
- Admin endpoints: `GET/PATCH /v1/tenants/me/branding`.

### Next.js side

- `middleware.ts` at the edge: reads `Host`, calls the NestJS resolver,
  attaches tenant context to request headers via
  `NextResponse.next({ headers: { 'x-tenant-id': ... } })`.
- Root layout (`app/layout.tsx`, server component): reads tenant from
  headers, applies CSS custom properties for theme, sets `<title>` /
  favicon / OG metadata for the tenant.
- Admin branding UI (`app/admin/branding/page.tsx`): edit logo URL +
  primary color → save via NestJS admin API → reflects on next
  navigation.
- No flash of unbranded content: branding is applied **server-side**
  before any HTML reaches the client.

### Shared

Both layers consume the same `GET /v1/tenants/resolve?host=...`
response shape. Response shape is versioned at the URL path
(`/v1/...`); breaking changes are a coordinated cross-app PR.

### Cross-app contract (the integration test that matters)

A Playwright E2E test verifies the round trip end-to-end:

```text
Update tenant branding via NestJS admin API
  ↓
Next.js middleware fetches fresh tenant on next request
  ↓
Page renders with new branding, no client-side reload
```

A failure here is a real cross-app integration bug, not a unit-test
gap. It lives in `test/e2e/branding-update-propagation.spec.ts`.

Production hardening (out of POC): Caddy edge proxy with wildcard TLS
for `*.anacity.com`, on-demand TLS via Let's Encrypt for vanity apex
domains, `ask` endpoint to gate ACME issuance, `Tenant.custom_domain`
+ `custom_domain_status` lifecycle. Design doc §10.

---

## W5 — Tests + CI

| | |
|---|---|
| Scope | Isolation matrix (cross-tenant, cross-community, privilege-escalation, revoke-takes-effect, block-scope-deny, inconsistent-hierarchy-reject, immutable-UnitAction), 5 Playwright E2E flows from design doc §12, structural checklist that every named test file exists, lint + typecheck + unit + integration on every PR |
| Modules | `test/`, `jest.config.ts`, `.github/workflows/` (or equivalent) |
| Depends on | W1 minimum; ramps continuously with W2/W3/W4 |

Coverage gates for the POC: Jest with thresholds focused on the
authz-critical modules (`src/rbac/`, `src/tenancy/`) and a structural
file-exists check for the isolation-matrix tests. Production hardening
adds `pgTAP` for RLS policies once RLS lands.

---

## Parallelization plan

```text
Day 1-2:  W1                  (foundation, blocking)
Day 3-7:  W2 ║ W3 ║ W4        (parallel; one engineer each, or one engineer time-sliced)
Day 4-7:  W5                  (tests catch up, runs alongside)
```

POC-realistic timeline. Production rollout (per-tenant cutover from the
old session-based system) is design doc §8 and lands after the POC is
accepted.

---

## Conflict points (parallel-work risks)

| Risk | Lanes | Mitigation |
|---|---|---|
| `prisma/schema.prisma` ordering | W2 ↔ W3 | W1 lands the base schema; W2 and W3 add migrations on top. Each PR includes a single migration file, named with a timestamp. |
| Redis key namespace (production) | W2 ↔ W4 | W2 owns `ability:*`, W4 owns `domain:*`. A shared `src/cache/keys.ts` module declares both prefixes. |
| Tenant resolver contract | W4 NestJS ↔ W4 Next.js | Versioned API path (`/v1/tenants/resolve`); breaking changes are a coordinated cross-app PR. |
| Test fixture drift | W5 ↔ everyone | Test fixtures (sample tenants, users, roles) live in `test/fixtures/` as a single source of truth, not duplicated per test file. |

---

## What this plan does NOT cover

All items below are described in design doc §10 as production
hardening, intentionally deferred from the POC:

- Postgres RLS for DB-layer tenant isolation
- Caddy edge proxy + on-demand TLS + Let's Encrypt for vanity apex domains
- Monthly range-partitioning of `UnitAction` via `pg_partman`
- Temporal `UnitOccupant` model
- Refresh-token rotation + device binding
- Sharding (Citus or app-level)
- Microservices decomposition (modular monolith first)
- Multi-region edge
- Per-customer email sender domains (DKIM/SPF)
- Analytics pipeline over `UnitAction`
