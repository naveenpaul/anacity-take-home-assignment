# Scope Rationale

Why the design and POC are sized the way they are, and what was
deliberately left out. Front-loaded so it's clear which cuts were
considered-and-deferred versus simply missed.

The goal: redesign a session-based, single-active-community,
fixed-role residential-community SaaS into a multi-community,
dynamic-RBAC, white-labeled system, with **working code and a
functioning POC with UI**.

The architecture is built to that goal. Not larger.

---

## What was considered and cut from the POC

Every item below was designed, written down in the production-hardening
section of the design doc (§10), and explicitly chosen *not* to ship in
the POC. The upgrade path is preserved in every case.

### Postgres Row-Level Security

**Why it was considered:** multi-tenant SaaS standard. RLS at the DB
layer means a forgotten app-level filter cannot leak across tenants —
defense in depth.

**Why it was cut from the POC:** app-level `where tenant_id = ?`
scoping is sufficient to *demonstrate* the tenant boundary in a code
review. RLS is operational rigor layered on top, not a different
architecture. The Prisma client wrapper that injects `tenant_id` in
the POC is the same place that swaps to `SET app.tenant_id` per
connection in production — a code-line change, not a redesign.

**Where the upgrade lives:** design doc §10, table row 1.

### Caddy on-demand TLS for vanity apex domains

**Why it was considered:** real white-labeling means customers point
their own domains (`prestige.com`) at the platform with no per-tenant
ops work. Caddy's on-demand TLS plus an `ask` endpoint is the
Vercel-style solution.

**Why it was cut from the POC:** the POC demonstrates white-labeling
via subdomains (`prestige.localhost:3000` vs `sobha.localhost:3000`),
which exercises the entire tenant-resolution + branding-application
path. The ACME pipeline is a deployment concern, not an architecture
concern. Building it for the POC would consume days for zero
additional architectural signal.

**Where the upgrade lives:** design doc §10, table row 2. The
`Tenant` entity has a `slug` column today; adding a `custom_domain`
column plus the Caddy `ask` endpoint is the production work.

### Three-tier role templates (system → tenant → community)

**Why it was considered:** an enterprise customer with 100+
communities shouldn't hand-rebuild the same six roles per community.
Three tiers let the tenant override the system template once and have
it propagate.

**Why it was simplified to one tier:** the requirements ask for dynamic
roles per community, not a multi-org role-management product. A single
tier of system templates → community-instantiated roles solves the
"don't hand-rebuild" problem with half the complexity to defend. The
middle tier was solving a problem the requirements don't have.

### UnitOccupant temporal model

**Why it was considered:** real residential communities have owners,
tenants, family members, ownership transfers, and "who lived in 4B in
2023" audit queries.

**Why it was cut from the POC:** the requirements say "users under units."
Temporal occupancy is real-world but strictly additive — it doesn't
change the RBAC or multi-community story at all. A simple
`Membership` row suffices for the POC.

**Where the upgrade lives:** design doc §10, table row 5.

### pg_partman partitioning of UnitAction

**Why it was considered:** unit-action volume grows linearly with
units × time. At enterprise scale a single table is wrong.

**Why it was cut from the POC:** premature for a POC seed of ~36
units. A single indexed table is fine; partitioning is a scale-out
operation with a clear upgrade path (`pg_partman`, monthly ranges).

**Where the upgrade lives:** design doc §10, table row 4.

### 5-phase strangler-fig migration with reconciliation jobs

**Why it was considered:** the existing system is live. A big-bang
cutover of authorization is the highest-blast-radius change possible.

**Why it was compressed:** this is a POC, not a live
cutover. The migration phases exist for completeness — and the
three mandatory regression tests are still listed — but a full
dual-write bridge service is software that won't be exercised. A
5-line plan with per-tenant rollback is the right depth for a design
doc; the implementation is a follow-on if the design is accepted.

---

## What was preserved (and why)

The design *kept* the items below because cutting them would weaken
the architecture itself, not because they're nice-to-have.

| Kept | If it were cut, this would happen |
|---|---|
| **Tenant as first-class entity** | Branding would have to live on the community, fragmenting the customer's identity — the exact problem called out under "weak white-labeling." |
| **Stateless URL-scoped APIs** | Multi-tab + deep-links + bookmarks would still be broken — the headline problem. Dynamic roles can technically work without this, but the multi-community story falls apart. |
| **Permission-based CASL checks** | "Dynamic roles" without permission-based checks is just a UI for editing role *names*. Business logic stays coupled to role names, and the new role doesn't actually do anything until code changes. |
| **Block/unit-scoped role grants** | The hierarchy goes Community → Block → Unit. A real role like "Tower-3 Night Security" needs scope below community. One paragraph + one worked example earns its place. |
| **RBAC audit log** | First question after any privilege incident is "who granted whom what, when?" For production RBAC this is table stakes. |
| **Migration story (compressed)** | The system is currently session-based and must move to the new architecture. Without a migration plan, the design is incomplete — but five lines is sufficient depth for a POC. |
| **Mandatory regression tests** | The three regressions (existing users can still log in; fixed roles map to dynamic roles with identical permissions; existing unit↔user links become memberships with no data loss) are the only thing standing between a successful design and a customer outage during cutover. |

---

## Engineering signals deliberately preserved

Sound backend architecture demonstrates *judgment* as much as
*coverage*. The design preserves the following signals:

- **Defense-in-depth thinking** → §10 RLS upgrade path with the
  reasoning for why it's deferred rather than missing.
- **Cache invalidation correctness** → §5 mutation-driven invalidation
  contract (a revoked role loses access on the next request, not on
  token expiry). The cache itself is optional in the POC; the contract
  is not.
- **Audit + forensics** → §7 `RbacAuditLog` for every RBAC mutation
  and §6 `UnitAction` immutable path snapshots that survive renames.
- **Migration risk management** → §8 per-tenant rollback +
  three mandatory regression tests that block a cutover if they fail.
- **Test discipline** → §12 isolation matrix framed as the
  highest-value test surface ("a green happy-path with a broken
  isolation test is a customer data leak").
- **Scope discipline** → this document.

---

## Anti-pattern: shipping everything

A common failure mode is to ship the entire production system at POC
depth — Caddy stub, fake ACME, mock RLS, half-implemented
partitioning. The result is breadth without quality, and a system
where nothing is actually load-bearing.

This POC ships the core requirements at depth, and names every cut
explicitly. The cuts above are not gaps in the design; they are
deliberate scoping decisions with the upgrade path written down.

---

## If you only read three things

1. Design doc §4 — Dynamic RBAC entity model + ER diagram.
2. Design doc §5 — Authorization flow per request (sequence diagram).
3. Design doc §10 — Production hardening (what was cut and why).
