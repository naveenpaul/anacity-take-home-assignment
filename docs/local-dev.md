# Local Development

How to run Anacity on your laptop. This is the dev experience that the
W1–W4 workstreams deliver — the design above this doc specifies the
behavior; this doc specifies the developer ergonomics that follow.

> **Status:** this repo currently contains the design + POC code. If
> any of the commands below don't yet exist for you, check
> [`workstreams.md`](./workstreams.md) for which workstream owns them.

---

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node.js | ≥ 20 LTS | NestJS + Next.js runtime |
| pnpm | ≥ 9 | Monorepo-friendly package manager |
| Docker + Compose | recent | Postgres (+ Redis if you want to test the production cache path) |
| Git | any | obvious |

That's it. **No Caddy locally, no TLS, no Let's Encrypt, no DNS gymnastics.**
The custom-domain / on-demand TLS pipeline is production-only — design
doc §10.

---

## First-time setup

```bash
git clone <repo>
cd anacity
pnpm install                        # installs both apps (api/ + web/)
cp .env.example .env                # one .env at the root, both apps read it
docker compose up -d postgres       # add 'redis' if you want to test the cache path
pnpm db:migrate                     # applies schema
pnpm db:seed                        # seeds 2 tenants × 2 communities + 5 users
```

Verify the seed:

```bash
pnpm db:status
# Expected:
#   tenants:      2 (prestige, sobha)
#   communities:  4 (lakeside, falcon, dream_acres, forest_view)
#   blocks:       9
#   units:       36
#   users:        5 (alice, bob, carol, dave, ravi)
#   roles:        8 (4 system templates × 2 tenants, instantiated per community)
#   memberships:  9
```

---

## Running the apps

Two processes, two terminals:

```bash
# Terminal 1 — NestJS API
pnpm --filter api dev
# → listening on http://localhost:3001
# → Prisma client connected

# Terminal 2 — Next.js
pnpm --filter web dev
# → ready on http://localhost:3000
```

Or in one shot:

```bash
pnpm dev    # uses turbo/concurrently to run both
```

---

## Visiting the app — the `*.localhost` pattern

Every modern browser resolves any `*.localhost` to `127.0.0.1`. We use
that to simulate per-tenant subdomains **without editing `/etc/hosts`**:

| URL | Tenant the app sees | What renders |
|---|---|---|
| `http://prestige.localhost:3000` | Prestige | Prestige branding, Prestige's 2 communities |
| `http://sobha.localhost:3000` | Sobha | Sobha branding, Sobha's 2 communities |
| `http://localhost:3000` | None | 404 with a hint to use a tenant subdomain |

Behind the scenes, `web/middleware.ts` reads `Host`, strips `:3000`,
and calls `GET http://localhost:3001/v1/tenants/resolve?host=<host>` —
the same code path that runs in production.

### What about real custom domains (`prestige.com`)?

Locally, not supported — that path requires Caddy on-demand TLS and
real DNS. See design doc §10 for the production approach. The POC
demonstrates white-labeling via subdomains, which is sufficient to
exercise the entire tenant resolution + branding propagation path.

---

## Logging in as different actors

Seed users (password is always `dev`):

| Email | Tenants | Memberships | Use for |
|---|---|---|---|
| `alice@prestige.dev` | Prestige | Admin @ Lakeside, Resident @ Falcon | Multi-community management within one tenant |
| `bob@sobha.dev` | Sobha | Admin @ both Sobha communities | Multi-community admin within a tenant |
| `carol@anacity.dev` | Prestige + Sobha | Resident @ Lakeside AND @ Dream Acres | Cross-tenant identity (same login, scoped per host) |
| `dave@prestige.dev` | Prestige | Resident @ Falcon | Recipient of the dynamic-role demo |
| `ravi@prestige.dev` | Prestige | Security across both Prestige communities | Block-scoped permission tests |

```bash
# Carol is the most useful test user — she has memberships in both
# tenants, so you can verify that her global identity token works on
# prestige.localhost and sobha.localhost and only shows the right
# communities on each.
```

---

## Common dev workflows

### Add a new permission key

```bash
pnpm cli permission:add view_clubhouse_calendar
# → inserts into Permission table
# → optionally attaches to a system role template
```

### Add a custom role to a community

Through the UI (`http://prestige.localhost:3000/admin/roles`), or via
CLI for scripting:

```bash
pnpm cli role:create --community lakeside --name "Pet Committee" \
  --perms approve_pet,view_pet_log
```

### Assign a role with a block scope

```bash
pnpm cli role:assign --user dave --community falcon \
  --role "Night Shift Security" --block 3
# → dave can act on Block 3 units only, not Block 1 or 2
```

### Reset the database

```bash
pnpm db:reset    # drops, re-migrates, re-seeds
```

### Inspect / invalidate the ability cache (production cache path only)

```bash
pnpm cli cache:show --user alice
pnpm cli cache:invalidate --user alice --community falcon
# RBAC mutations do this automatically; the CLI is for debugging.
# Skip if you're running without Redis — POC resolves per request.
```

---

## Running tests

```bash
pnpm test                  # all Jest unit + integration
pnpm test:coverage         # with Istanbul
pnpm test:e2e              # Playwright (needs both apps running)
pnpm test:isolation        # the isolation matrix from the design doc
pnpm test:migration        # the 3 mandatory migration regressions
```

The full CI suite:

```bash
pnpm ci
# Runs in order: lint → typecheck → unit+coverage → integration → e2e → isolation → migration
# Fails fast on the first red layer
```

---

## What's NOT in local dev

| Production piece | Why it's skipped locally | Where it IS exercised |
|---|---|---|
| Caddy edge proxy | Plain `http://` is fine on localhost | Production deployment |
| Wildcard `*.anacity.com` TLS cert | No HTTPS needed locally | Production |
| On-demand TLS / Let's Encrypt for vanity domains | Needs real DNS and public reachability | Production (against a real test apex domain) |
| Postgres RLS | POC enforces tenant boundary at the app layer | Production — design doc §10 |
| Redis ability + domain caches | POC resolves per request from DB | Production (optional locally if you start the `redis` compose service) |
| Multi-region edge | Single process locally | Production-only |
| Real auth providers | Seed users have static passwords | Staging |

---

## Troubleshooting

### "I see Sobha's data on prestige.localhost"

A missing tenant filter on a query. The Prisma client wrapper is
supposed to inject `where tenant_id = req.tenant.id` into every
tenant-scoped query. The integration test
`test/isolation/cross-tenant.spec.ts` is designed to fail loudly if
this regresses — if you hit this in dev, that test should already be
red.

(In production this is also enforced at the DB layer via Postgres RLS;
see design doc §10. The POC enforces at the app layer only.)

### "I revoked a role but the user still has access"

Two possibilities:

1. **POC without Redis** — the ability is resolved per request from
   the DB, so revocation should be instant on the next request. If
   it's not, the revoke didn't write the row. Check
   `pnpm cli membership:roles --user <user>`.
2. **Production / dev with Redis** — the mutation didn't call
   `abilityCache.invalidate()`. Run
   `pnpm cli cache:invalidate --user <user> --community <community>`
   manually to confirm; if access disappears after that, find the
   missing invalidate call in the mutation path. RBAC mutations must
   invalidate. Always.

### "Port 3000 / 3001 already in use"

Another dev server is running. `lsof -i :3000` then `kill`. Or set
`PORT_API` / `PORT_WEB` in `.env`.

### "Multi-tab session looks weird"

That's expected — there *is* no session. Each tab is independent. If
two tabs show different community context, that's the design working,
not a bug. The only shared state is the JWT cookie (identity).

---

## Quick sanity check after first setup

If `pnpm test:smoke` passes, you have a working dev environment:

```bash
pnpm test:smoke
# → API responds on :3001
# → Web responds on :3000
# → prestige.localhost resolves to Prestige tenant
# → sobha.localhost resolves to Sobha tenant
# → alice@prestige.dev can log in
# → alice sees 2 communities (Lakeside, Falcon) and not Sobha's
# → carol logged in on prestige.localhost sees only Lakeside
# → carol logged in on sobha.localhost sees only Dream Acres
# → cross-tenant request (alice → Sobha community) is denied
# OK
```

That sequence touches every architectural layer the design specifies
(tenancy, identity, multi-community membership, isolation). If smoke
passes, the core wiring is correct.
